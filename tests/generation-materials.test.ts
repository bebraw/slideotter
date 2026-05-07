import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  createMaterialFromDataUrl,
  createMaterialFromRemoteImage,
  getGenerationMaterialContext,
  getMaterial,
  getMaterialFilePath,
  listMaterials
} = require("../studio/server/services/materials.ts");
const { importImageSearchResults } = require("../studio/server/services/image-search.ts");
const {
  deriveAutomaticImageSearchQuery,
  searchCreationImagesAsMaterials
} = require("../studio/server/creation-image-search.ts");
const { getPresentationPaths } = require("../studio/server/services/presentations.ts");

type JsonRecord = Record<string, unknown>;

type ContextPresentation = JsonRecord & {
  id: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: ContextPresentation[];
};

type MaterialRecord = JsonRecord & {
  caption?: string;
  creator?: string;
  fileName: string;
  id: string;
  license?: string;
  sourceUrl?: string;
  url: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;
const originalFetch = global.fetch;
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";

function createContextPresentation(suffix: string): ContextPresentation {
  const presentation = createPresentation({
    audience: "Generation material validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise material generation context services.",
    title: `Generation Materials ${Date.now()} ${suffix}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function listContextPresentations(): PresentationRegistry {
  return listPresentations();
}

function cleanupContextPresentations(): void {
  const current = listContextPresentations();
  const knownIds = new Set(current.presentations.map((presentation: ContextPresentation) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch (error) {
      // Keep cleanup best-effort so the original assertion failure remains visible.
    }
  }

  const afterCleanup = listContextPresentations();
  if (afterCleanup.presentations.some((presentation: ContextPresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  cleanupContextPresentations();
  global.fetch = originalFetch;
});

test("materials accept only bounded image data and keep paths presentation-scoped", () => {
  const presentation = createContextPresentation("materials");
  const material = createMaterialFromDataUrl({
    alt: "Coverage material",
    caption: "Source: coverage fixture",
    dataUrl: tinyPngDataUrl,
    fileName: "coverage fixture.png"
  });

  assert.equal(getMaterial(material.id).id, material.id, "created material should be retrievable");
  assert.ok(
    listMaterials().some((entry: MaterialRecord) => entry.url.includes(`/presentation-materials/${presentation.id}/`)),
    "material URLs should be scoped to the active presentation"
  );
  assert.ok(
    getMaterialFilePath(presentation.id, material.fileName).startsWith(getPresentationPaths(presentation.id).materialsDir),
    "material file path should resolve inside the presentation material directory"
  );

  assert.throws(
    () => createMaterialFromDataUrl({ dataUrl: "data:text/plain;base64,SGVsbG8=" }),
    /PNG, JPEG, GIF, or WebP/,
    "non-image material uploads should be rejected"
  );
  assert.throws(
    () => getMaterialFilePath(presentation.id, "../escape.png"),
    /Invalid material filename/,
    "material file lookup should reject traversal filenames"
  );
});

test("remote material imports reject local and private IPv6 targets before fetch", async () => {
  await assert.rejects(
    () => createMaterialFromRemoteImage({ url: "http://[::1]/image.png" }),
    /local host/,
    "IPv6 loopback should be rejected before the image request"
  );
  await assert.rejects(
    () => createMaterialFromRemoteImage({ url: "http://[fd00::1]/image.png" }),
    /local host/,
    "IPv6 unique-local addresses should be rejected before the image request"
  );
  await assert.rejects(
    () => createMaterialFromRemoteImage({ url: "http://[fe80::1]/image.png" }),
    /local host/,
    "IPv6 link-local addresses should be rejected before the image request"
  );
  await assert.rejects(
    () => createMaterialFromRemoteImage({ url: "http://[::ffff:127.0.0.1]/image.png" }),
    /private network/,
    "IPv4-mapped loopback addresses should be rejected before the image request"
  );
});

test("generation material context ranks target-relevant materials before trimming", () => {
  createContextPresentation("material-ranking");
  createMaterialFromDataUrl({
    alt: "Team portrait in a meeting room",
    caption: "A general team portrait",
    dataUrl: tinyPngDataUrl,
    fileName: "team-portrait.png",
    title: "Team portrait"
  });
  const relevant = createMaterialFromDataUrl({
    alt: "HTMX request flow diagram",
    caption: "Request flow diagram for server-owned UI behavior",
    dataUrl: tinyPngDataUrl,
    fileName: "request-flow-diagram.png",
    sourceUrl: "https://example.com/request-flow",
    title: "Request flow diagram"
  });

  const rankedContext = getGenerationMaterialContext({
    maxMaterials: 1,
    query: "HTMX request flow diagram",
    slideIntent: "Explain request flow",
    slideKeyMessage: "Server-owned UI behavior",
    slideTitle: "Request flow"
  });

  assert.equal(rankedContext.materials.length, 1, "material prompt context should honor workflow material limits");
  assert.equal(rankedContext.materials[0].id, relevant.id, "material prompt context should keep the target-relevant material");
  assert.match(rankedContext.promptText, /Request flow diagram/, "material prompt should include compact relevant title and alt text");
  assert.doesNotMatch(rankedContext.promptText, /https:\/\/example.com\/request-flow/, "material prompt should omit attribution unless requested");

  const attributedContext = getGenerationMaterialContext({
    includeAttribution: true,
    maxMaterials: 1,
    query: "HTMX request flow diagram"
  });
  assert.match(attributedContext.promptText, /https:\/\/example.com\/request-flow/, "attribution workflow should include source URLs");
});

test("image search imports bounded remote results as presentation materials", async () => {
  createContextPresentation("image-search");
  const originalFetchForTest = global.fetch;
  const imagePayload = tinyPngDataUrl.split(",")[1] || "";
  const imageBuffer = Buffer.from(imagePayload, "base64");
  const requestedUrls: string[] = [];

  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("api.openverse.org")) {
      return new Response(JSON.stringify({
        results: [
          {
            creator: "Coverage",
            foreign_landing_url: "https://example.com/flow",
            license: "cc0",
            title: "HTMX request flow",
            url: "https://images.example.com/flow.png"
          }
        ]
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      });
    }

    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Length": String(imageBuffer.length),
        "Content-Type": "image/png"
      },
      status: 200
    });
  };

  try {
    const result = await importImageSearchResults({
      provider: "openverse",
      query: "HTMX request flow",
      restrictions: "license:cc0 source:flickr"
    });

    assert.equal(result.provider, "openverse", "image search should use the requested provider preset");
    assert.equal(result.imported.length, 1, "image search should import fetchable remote images");
    const importedMaterial = listMaterials()[0];
    assert.equal(importedMaterial.id, result.imported[0].id, "imported images should become presentation materials");
    assert.equal(importedMaterial.creator, "Coverage", "imported images should retain creator attribution");
    assert.equal(importedMaterial.license, "cc0", "imported images should retain license attribution");
    assert.equal(importedMaterial.sourceUrl, "https://example.com/flow", "imported images should retain source URL attribution");
    assert.equal(importedMaterial.caption, "Openverse: Coverage, cc0", "imported image captions should stay compact for slide display");
    assert.doesNotMatch(importedMaterial.caption, /https?:\/\//, "imported image captions should not expose long source URLs");
    assert.ok((requestedUrls[0] || "").includes("license_type=cc0"), "Openverse restrictions should map to license filters");
    assert.ok((requestedUrls[0] || "").includes("source=flickr"), "Openverse restrictions should map to source filters");
  } finally {
    global.fetch = originalFetchForTest;
  }
});

test("creation image search derives a material query from the brief", async () => {
  const originalFetchForTest = global.fetch;
  const requestedUrls: string[] = [];

  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    return new Response(JSON.stringify({
      results: [
        {
          creator: "Coverage",
          foreign_landing_url: "https://example.com/rose",
          license: "cc0",
          title: "Garden rose bloom",
          url: "https://images.example.com/rose.png"
        }
      ]
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  };

  try {
    const query = deriveAutomaticImageSearchQuery({
      objective: "Explain rose varieties and garden care",
      title: "Roses"
    });
    assert.match(query, /Roses/i, "automatic image search should use the requested presentation subject");
    assert.match(query, /rose varieties/i, "automatic image search should retain useful objective terms");

    const result = await searchCreationImagesAsMaterials({
      imageSearch: {
        count: 2,
        provider: "openverse"
      },
      objective: "Compare garden rose varieties",
      title: "Roses"
    });

    assert.equal(result.automatic, true, "blank image search fields should use automatic query derivation");
    assert.match(result.query, /Roses/i, "automatic image search should expose the derived query");
    assert.equal(result.materials.length, 1, "automatic image search should expose remote results as generation materials");
    assert.equal(result.materials[0].id, "material-search-openverse-1", "generated material IDs should be stable for plan prompts");
    assert.equal(result.materials[0].title, "Garden rose bloom", "search result titles should become material titles");
    assert.equal(result.materials[0].url, "https://images.example.com/rose.png", "search result URLs should become material URLs");
    assert.ok((requestedUrls[0] || "").includes("q=Roses"), "search request should use the derived query");
  } finally {
    global.fetch = originalFetchForTest;
  }
});

test("automatic creation image search fails open while explicit search reports errors", async () => {
  const originalFetchForTest = global.fetch;
  global.fetch = async () => {
    throw new Error("offline");
  };

  try {
    const automaticResult = await searchCreationImagesAsMaterials({
      objective: "Show rose photography",
      title: "Roses"
    });
    assert.equal(automaticResult.automatic, true, "brief-derived searches should be marked automatic");
    assert.deepEqual(automaticResult.materials, [], "automatic searches should not block outline generation when search is unavailable");

    await assert.rejects(
      () => searchCreationImagesAsMaterials({
        imageSearch: {
          query: "roses"
        },
        title: "Roses"
      }),
      /offline/,
      "explicit image searches should still report provider failures"
    );
  } finally {
    global.fetch = originalFetchForTest;
  }
});
