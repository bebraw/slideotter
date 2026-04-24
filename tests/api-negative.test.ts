const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { startServer } = require("../studio/server/index.ts");
const {
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");

const createdPresentationIds = new Set();
const originalActivePresentationId = listPresentations().activePresentationId;

async function startTestServer() {
  const server = startServer({ port: 0 });
  if (!server.listening) {
    await once(server, "listening");
  }

  const address = server.address();
  const port = address && typeof address === "object" ? address.port : null;
  assert.ok(port, "API tests need a local server port");

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server
  };
}

async function postJson(baseUrl, pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return {
    body: await response.json(),
    status: response.status
  };
}

async function postRaw(baseUrl, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });
  return {
    body: await response.json(),
    status: response.status
  };
}

function cleanupPresentations() {
  const existingIds = new Set(listPresentations().presentations.map((presentation) => presentation.id));
  for (const id of createdPresentationIds) {
    if (!existingIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch (error) {
      // Keep cleanup best-effort so assertion failures stay visible.
    }
  }

  const afterCleanup = listPresentations();
  if (afterCleanup.presentations.some((presentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  cleanupPresentations();
});

test("API reports malformed JSON and missing required identifiers", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const malformed = await postRaw(baseUrl, "/api/presentations/select", "{bad-json");
    assert.equal(malformed.status, 500);
    assert.match(malformed.body.error, /valid JSON/);

    const missingPresentationId = await postJson(baseUrl, "/api/presentations/select", {});
    assert.equal(missingPresentationId.status, 500);
    assert.match(missingPresentationId.body.error, /Expected presentationId/);

    const missingRegenerateId = await postJson(baseUrl, "/api/presentations/regenerate", {});
    assert.equal(missingRegenerateId.status, 500);
    assert.match(missingRegenerateId.body.error, /Expected presentationId/);

    const missingSlideId = await postJson(baseUrl, "/api/slides/delete", {});
    assert.equal(missingSlideId.status, 500);
    assert.match(missingSlideId.body.error, /Expected a slideId/);

    const missingVariantId = await postJson(baseUrl, "/api/variants/apply", {});
    assert.equal(missingVariantId.status, 500);
    assert.match(missingVariantId.body.error, /Expected variantId/);

    const missingSourceId = await postJson(baseUrl, "/api/sources/delete", {});
    assert.equal(missingSourceId.status, 500);
    assert.match(missingSourceId.body.error, /Expected sourceId/);
  } finally {
    server.close();
  }
});

test("API rejects unknown ids and invalid payload shapes without mutating active presentation", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const created = await postJson(baseUrl, "/api/presentations", {
      audience: "API coverage",
      constraints: "Temporary deck created by API negative tests.",
      generationMode: "local",
      objective: "Verify API error handling.",
      targetSlideCount: 5,
      title: `API Negative ${Date.now()}`
    });
    assert.equal(created.status, 200);
    assert.ok(created.body.presentation.id);
    assert.equal(created.body.slides.length, 5);
    assert.equal(created.body.presentation.targetSlideCount, 5);
    createdPresentationIds.add(created.body.presentation.id);

    const regenerated = await postJson(baseUrl, "/api/presentations/regenerate", {
      generationMode: "local",
      presentationId: created.body.presentation.id
    });
    assert.equal(regenerated.status, 200);
    assert.equal(regenerated.body.presentations.activePresentationId, created.body.presentation.id);
    assert.equal(regenerated.body.slides.length, 5);
    assert.equal(regenerated.body.presentation.targetSlideCount, 5);
    assert.match(regenerated.body.runtime.workflow.message, /Regenerated 5 slides/);

    const source = await postJson(baseUrl, "/api/sources", {
      text: "API source coverage confirms presentation-scoped retrieval material can be stored.",
      title: "API source coverage"
    });
    assert.equal(source.status, 200);
    assert.equal(source.body.sources.length, 1);
    assert.equal(source.body.sources[0].title, "API source coverage");

    const deletedSource = await postJson(baseUrl, "/api/sources/delete", {
      sourceId: source.body.source.id
    });
    assert.equal(deletedSource.status, 200);
    assert.equal(deletedSource.body.sources.length, 0);

    const unknownPresentation = await postJson(baseUrl, "/api/presentations/select", {
      presentationId: "missing-presentation"
    });
    assert.equal(unknownPresentation.status, 500);
    assert.match(unknownPresentation.body.error, /Unknown presentation/);

    const invalidSlideSpec = await postJson(baseUrl, "/api/slides/slide-01/slide-spec", {
      slideSpec: null
    });
    assert.equal(invalidSlideSpec.status, 500);
    assert.match(invalidSlideSpec.body.error, /Expected an object field named slideSpec/);

    const invalidMaterial = await postJson(baseUrl, "/api/materials", {
      dataUrl: "data:text/plain;base64,SGVsbG8="
    });
    assert.equal(invalidMaterial.status, 500);
    assert.match(invalidMaterial.body.error, /PNG, JPEG, GIF, or WebP/);

    const unknownVariant = await postJson(baseUrl, "/api/variants/apply", {
      variantId: "missing-variant"
    });
    assert.equal(unknownVariant.status, 500);
    assert.match(unknownVariant.body.error, /Unknown variant/);

    const afterErrors = await fetch(`${baseUrl}/api/presentations`);
    const presentations = await afterErrors.json();
    assert.equal(presentations.activePresentationId, created.body.presentation.id);
  } finally {
    server.close();
  }
});
