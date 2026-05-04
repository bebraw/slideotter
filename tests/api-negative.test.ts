import assert from "node:assert/strict";
import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { once } from "node:events";
import test from "node:test";

const { startServer } = require("../studio/server/index.ts");
const { deletePresentation,
  listPresentations,
  savePresentationCreationDraft,
  setActivePresentation } = require("../studio/server/services/presentations.ts");

type PresentationSummary = {
  id: string;
};

type MockLlmRequestBody = {
  response_format: {
    json_schema: {
      name: string;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isMockLlmRequestBody(value: unknown): value is MockLlmRequestBody {
  if (!isRecord(value) || !isRecord(value.response_format)) {
    return false;
  }

  const { json_schema: jsonSchema } = value.response_format;
  return isRecord(jsonSchema) && typeof jsonSchema.name === "string";
}

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;
const originalFetch = global.fetch;
const llmEnvKeys = [
  "LMSTUDIO_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

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

async function postJson(baseUrl: string, pathname: string, payload: unknown) {
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

function createLmStudioStreamResponse(data: unknown) {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { content }, finish_reason: null }],
        id: "chatcmpl-api-coverage",
        model: "api-coverage-model"
      })}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200
  });
}

function createGeneratedPlan(title: string, slideCount: number) {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : ["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5];
    const label = `${title} ${index + 1}`;

    return {
      eyebrow: isFirst ? "Opening" : isLast ? "Close" : `Section ${index + 1}`,
      guardrails: [
        { body: `${label} guardrail one is specific.`, title: `${label} check A` },
        { body: `${label} guardrail two is specific.`, title: `${label} check B` },
        { body: `${label} guardrail three is specific.`, title: `${label} check C` }
      ],
      guardrailsTitle: `${label} checks`,
      keyPoints: [
        { body: `${label} carries generated draft content.`, title: `${label} point A` },
        { body: `${label} adds a second distinct idea.`, title: `${label} point B` },
        { body: `${label} adds a third distinct idea.`, title: `${label} point C` },
        { body: `${label} adds a fourth distinct idea.`, title: `${label} point D` }
      ],
      mediaMaterialId: "",
      note: `${label} has a speaker note.`,
      resources: [
        { body: `${label} resource one.`, title: `${label} resource A` },
        { body: `${label} resource two.`, title: `${label} resource B` }
      ],
      resourcesTitle: `${label} resources`,
      role,
      signalsTitle: `${label} points`,
      summary: `${label} summarizes one useful generated idea.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content"
    };
  });

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: [],
    slides,
    summary: `${title} generated plan`
  };
}

function createGeneratedDeckPlan(title: string, slideCount: number) {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : ["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5];
    const label = `${title} ${index + 1}`;

    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear message.`,
      role,
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content",
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "API coverage",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should verify API generation behavior.`
  };
}

function readJsonRequestBody(init: RequestInit | undefined): MockLlmRequestBody {
  if (!init || typeof init.body !== "string") {
    throw new Error("Expected mocked LLM request body");
  }

  const body = JSON.parse(init.body);
  if (!isMockLlmRequestBody(body)) {
    throw new Error("Expected mocked LLM structured response request");
  }

  return body;
}

function configureMockLlm(baseUrl: string) {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "api-coverage-model";
  global.fetch = async (url, init) => {
    const urlText = String(url);
    if (urlText.startsWith(baseUrl)) {
      return originalFetch(url, init);
    }

    if (/\/chat\/completions$/.test(urlText)) {
      const requestBody = readJsonRequestBody(init);
      if (requestBody.response_format.json_schema.name === "initial_presentation_deck_plan") {
        return createLmStudioStreamResponse(createGeneratedDeckPlan("API Negative", 5));
      }

      assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_plan");
      return createLmStudioStreamResponse(createGeneratedPlan("API Negative", 5));
    }

    return originalFetch(url, init);
  };
}

function restoreMockLlm() {
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

async function postRaw(baseUrl: string, pathname: string, body: string) {
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
  const existingIds = new Set(listPresentations().presentations.map((presentation: PresentationSummary) => presentation.id));
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
  if (afterCleanup.presentations.some((presentation: PresentationSummary) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  cleanupPresentations();
  restoreMockLlm();
});

test("fresh studio launch clears stale new-presentation draft fields", async () => {
  savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan: null,
    fields: {
      audience: "Stale audience",
      targetSlideCount: 9,
      title: "Stale launch draft",
      tone: "Stale tone"
    },
    outlineLocks: {},
    stage: "brief"
  });

  const { baseUrl, server } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/api/v1/state`);
    const payload = await response.json();
    const fields = payload.creationDraft && payload.creationDraft.fields;

    assert.equal(response.status, 200);
    assert.equal(fields.title, "");
    assert.equal(fields.audience, "");
    assert.equal(fields.tone, "");
    assert.equal(fields.sourcingStyle, "");
    assert.equal(fields.targetSlideCount, null);
  } finally {
    server.close();
  }
});

test("API reports malformed JSON and missing required identifiers", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const malformed = await postRaw(baseUrl, "/api/v1/presentations/select", "{bad-json");
    assert.equal(malformed.status, 500);
    assert.match(malformed.body.error, /valid JSON/);

    const missingPresentationId = await postJson(baseUrl, "/api/v1/presentations/select", {});
    assert.equal(missingPresentationId.status, 500);
    assert.match(missingPresentationId.body.error, /Expected presentationId/);

    const missingRegenerateId = await postJson(baseUrl, "/api/v1/presentations/regenerate", {});
    assert.equal(missingRegenerateId.status, 500);
    assert.match(missingRegenerateId.body.error, /Expected presentationId/);

    const missingSlideId = await postJson(baseUrl, "/api/v1/slides/delete", {});
    assert.equal(missingSlideId.status, 500);
    assert.match(missingSlideId.body.error, /Expected a slideId/);

    const missingVariantId = await postJson(baseUrl, "/api/v1/variants/apply", {});
    assert.equal(missingVariantId.status, 500);
    assert.match(missingVariantId.body.error, /Expected variantId/);

    const missingSourceId = await postJson(baseUrl, "/api/v1/sources/delete", {});
    assert.equal(missingSourceId.status, 500);
    assert.match(missingSourceId.body.error, /Expected sourceId/);
  } finally {
    server.close();
  }
});

test("API rejects unknown ids and invalid payload shapes without mutating active presentation", async () => {
  const { baseUrl, server } = await startTestServer();
  configureMockLlm(baseUrl);

  try {
    const created = await postJson(baseUrl, "/api/v1/presentations", {
      audience: "API coverage",
      constraints: "Temporary deck created by API negative tests.",
      objective: "Verify API error handling.",
      targetSlideCount: 5,
      title: `API Negative ${Date.now()}`
    });
    assert.equal(created.status, 200);
    assert.ok(created.body.presentation.id);
    assert.equal(created.body.slides.length, 5);
    assert.equal(created.body.presentation.targetSlideCount, 5);
    createdPresentationIds.add(created.body.presentation.id);

    const regenerated = await postJson(baseUrl, "/api/v1/presentations/regenerate", {
      presentationId: created.body.presentation.id
    });
    assert.equal(regenerated.status, 200);
    assert.equal(regenerated.body.presentations.activePresentationId, created.body.presentation.id);
    assert.equal(regenerated.body.slides.length, 5);
    assert.equal(regenerated.body.presentation.targetSlideCount, 5);
    assert.match(regenerated.body.runtime.workflow.message, /Regenerated 5 slides/);

    const source = await postJson(baseUrl, "/api/v1/sources", {
      text: "API source coverage confirms presentation-scoped retrieval material can be stored.",
      title: "API source coverage"
    });
    assert.equal(source.status, 200);
    assert.equal(source.body.sources.length, 1);
    assert.equal(source.body.sources[0].title, "API source coverage");

    const deletedSource = await postJson(baseUrl, "/api/v1/sources/delete", {
      sourceId: source.body.source.id
    });
    assert.equal(deletedSource.status, 200);
    assert.equal(deletedSource.body.sources.length, 0);

    const unknownPresentation = await postJson(baseUrl, "/api/v1/presentations/select", {
      presentationId: "missing-presentation"
    });
    assert.equal(unknownPresentation.status, 500);
    assert.match(unknownPresentation.body.error, /Unknown presentation/);

    const invalidSlideSpec = await postJson(baseUrl, "/api/v1/slides/slide-01/slide-spec", {
      slideSpec: null
    });
    assert.equal(invalidSlideSpec.status, 500);
    assert.match(invalidSlideSpec.body.error, /Expected an object field named slideSpec/);

    const invalidMaterial = await postJson(baseUrl, "/api/v1/materials", {
      dataUrl: "data:text/plain;base64,SGVsbG8="
    });
    assert.equal(invalidMaterial.status, 500);
    assert.match(invalidMaterial.body.error, /PNG, JPEG, GIF, or WebP/);

    const unknownVariant = await postJson(baseUrl, "/api/v1/variants/apply", {
      variantId: "missing-variant"
    });
    assert.equal(unknownVariant.status, 500);
    assert.match(unknownVariant.body.error, /Unknown variant/);

    const afterErrors = await fetch(`${baseUrl}/api/v1/presentations`);
    const presentations = await afterErrors.json();
    assert.equal(presentations.state.activePresentationId, created.body.presentation.id);
  } finally {
    restoreMockLlm();
    server.close();
  }
});
