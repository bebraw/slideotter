import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import {
  createGeneratedDeckPlan,
  createGeneratedPlan,
  parseMockChatRequest,
  withVisiblePlanFields,
  type GeneratedSlideSpec,
  type JsonRecord
} from "./helpers/presentation-generation-helpers.ts";

const require = createRequire(import.meta.url);
const { createPresentation, deletePresentation, listPresentations, setActivePresentation } = require("../studio/server/services/presentations.ts");
const { createMaterialFromDataUrl } = require("../studio/server/services/materials.ts");
const { generateInitialPresentation, materializePlan } = require("../studio/server/services/presentation-generation.ts");

type CoveragePresentation = JsonRecord & {
  id: string;
};

type MaterialRecord = JsonRecord & {
  id: string;
  url: string;
};

type GeneratedPresentationResult = JsonRecord & {
  retrieval?: {
    materials?: MaterialRecord[];
  };
  slideSpecs: GeneratedSlideSpec[];
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;
const originalFetch = global.fetch;
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";
const llmEnvKeys = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "LMSTUDIO_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

function createCoveragePresentation(suffix: string): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise image material attachment during generated presentation creation.",
    title: `Coverage Materials ${Date.now()} ${suffix}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function createLmStudioStreamResponse(data: unknown): Response {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const payload = {
        choices: [
          {
            delta: {
              content
            },
            finish_reason: null
          }
        ],
        id: "chatcmpl-materials",
        model: "semantic-coverage-model"
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream"
    },
    status: 200
  });
}

function restoreLlmEnvironment(): void {
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

test.after(() => {
  const current = listPresentations();
  const knownIds = new Set(current.presentations.map((presentation: CoveragePresentation) => presentation.id));

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

  const afterCleanup = listPresentations();
  if (afterCleanup.presentations.some((presentation: CoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
  restoreLlmEnvironment();
});

test("presentation generation can attach semantically matching image materials", async () => {
  createCoveragePresentation("material-generation");
  const material = createMaterialFromDataUrl({
    alt: "HTMX request flow diagram",
    caption: "Request flow diagram",
    dataUrl: tinyPngDataUrl,
    fileName: "htmx-request-flow.png",
    title: "HTMX request flow"
  });

  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  let materialGenerationRequestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    const schemaName = requestBody.response_format.json_schema.name;
    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("HTMX request flow", 4));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    materialGenerationRequestCount += 1;
    return createLmStudioStreamResponse(createGeneratedPlan("HTMX request flow", 4, {
      mediaMaterialId: materialGenerationRequestCount === 1 ? material.id : "",
      mediaSlideIndex: 1
    }));
  };

  const generated: GeneratedPresentationResult = await generateInitialPresentation({
    includeActiveSources: false,
    objective: "Explain the HTMX request flow.",
    targetSlideCount: 4,
    title: "HTMX request flow"
  });
  const attachedMedia = generated.slideSpecs.flatMap((slideSpec: GeneratedSlideSpec) => slideSpec.media || []);

  assert.ok(attachedMedia.some((media: JsonRecord) => media.id === material.id), "generation should attach a semantically matching material");
  assert.ok(attachedMedia.some((media: JsonRecord) => /Request flow diagram/.test(String(media.caption || ""))), "attached material should carry a caption/source line");
  assert.equal(generated.retrieval?.materials?.[0]?.id, material.id, "generation diagnostics should report available material metadata");

  const attributedSlides = materializePlan({
    materialCandidates: [{
      alt: "Coverage beer",
      caption: "Creator: Coverage | License: cc0 | https://example.com/beer",
      creator: "Coverage",
      id: material.id,
      license: "cc0",
      sourceUrl: "https://example.com/beer",
      title: "Coverage beer",
      url: material.url
    }],
    title: "Coverage beer"
  }, {
    outline: "Coverage beer",
    references: [],
    slides: [
      withVisiblePlanFields({
        keyPoints: [
          { body: "Show the beer image with one clean attribution line.", title: "Image" },
          { body: "Keep the source close to the visual.", title: "Source" },
          { body: "Avoid repeating creator and license metadata.", title: "Credit" },
          { body: "Use a readable caption.", title: "Caption" }
        ],
        mediaMaterialId: material.id,
        role: "opening",
        summary: "Show sourced image metadata.",
        title: "Coverage beer"
      }, {
        eyebrow: "Opening",
        note: "Show the image attribution once.",
        resourcesTitle: "Resources",
        signalsTitle: "Image points"
      })
    ],
    summary: "Coverage attribution"
  });
  const caption = attributedSlides[0].media.caption;
  assert.equal((caption.match(/Creator:/g) || []).length, 1, "media captions should not repeat creator attribution");
  assert.equal((caption.match(/License:/g) || []).length, 1, "media captions should not repeat license attribution");
  assert.equal((caption.match(/https:\/\/example.com\/beer/g) || []).length, 1, "media captions should not repeat source URLs");

  const photoGridSlides = materializePlan({
    materialCandidates: [
      {
        alt: "Request field signal",
        id: "grid-field",
        title: "Field signal",
        url: material.url
      },
      {
        alt: "Request baseline evidence",
        id: "grid-baseline",
        title: "Baseline",
        url: material.url
      },
      {
        alt: "Request evidence detail",
        id: "grid-evidence",
        title: "Evidence",
        url: material.url
      }
    ],
    title: "HTMX request flow"
  }, {
    outline: "Compare request flow evidence",
    references: [],
    slides: [
      withVisiblePlanFields({
        keyPoints: [
          { body: "Compare the request path across three visual states.", title: "Compare" },
          { body: "Keep every image tied to the same request story.", title: "Tie" },
          { body: "Use the grid to show evidence instead of text-heavy claims.", title: "Evidence" },
          { body: "Make the visual comparison easy to inspect.", title: "Inspect" }
        ],
        role: "concept",
        summary: "Compare three request-flow images as visual evidence.",
        title: "Request flow image set",
        type: "photoGrid"
      })
    ],
    summary: "Photo-grid coverage"
  }, {
    startIndex: 1,
    totalSlides: 3,
    usedMaterialIds: new Set(["grid-field", "grid-baseline", "grid-evidence"])
  });
  const photoGridSlide = photoGridSlides[0] || {};
  assert.equal(photoGridSlide.type, "photoGrid", "photoGrid outline type should materialize as a photo grid when enough images exist");
  assert.equal(Array.isArray(photoGridSlide.mediaItems) ? photoGridSlide.mediaItems.length : 0, 3, "photoGrid materialization should use up to three image materials even when adjacent slides already used them");

  const withoutMaterials = await generateInitialPresentation({
    includeActiveMaterials: false,
    includeActiveSources: false,
    objective: "Explain the HTMX request flow.",
    targetSlideCount: 4,
    title: "HTMX request flow"
  });
  assert.equal(withoutMaterials.slideSpecs.some((slideSpec: GeneratedSlideSpec) => slideSpec.media), false, "generation can opt out of active material attachments");

  restoreLlmEnvironment();
});
