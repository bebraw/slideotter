import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { once } from "node:events";
import * as fs from "node:fs";
import test from "node:test";

const { startServer } = require("../studio/server/index.ts");
const { clearPresentationCreationDraft,
  deletePresentation,
  listPresentations,
  setActivePresentation } = require("../studio/server/services/presentations.ts");

const originalFetch = global.fetch;
const originalActivePresentationId = listPresentations().activePresentationId;
const llmEnvKeys = [
  "LMSTUDIO_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

type LlmRequestMessage = {
  content?: string;
};

type LlmRequestBody = {
  messages: LlmRequestMessage[];
  response_format: {
    json_schema: {
      name: string;
    };
  };
};

type LlmMockHandler = (requestBody: LlmRequestBody) => Promise<Response> | Response;

type DeckPlanSlide = {
  intent: string;
  keyMessage: string;
  role: string;
  sourceNeed: string;
  title: string;
  visualNeed: string;
};

type DeckPlan = {
  audience: string;
  language: string;
  narrativeArc: string;
  outline: string;
  slides: DeckPlanSlide[];
  thesis: string;
};

type ContentRunSlide = {
  errorLogPath?: string;
  skipped?: boolean;
  skipMeta?: {
    operation?: string;
  };
  slideSpec?: unknown;
  status?: string;
};

type ContentRun = {
  completed: number;
  failedSlideIndex?: number;
  slides: ContentRunSlide[];
  status: string;
  stopRequested?: boolean;
};

type CreationDraft = {
  contentRun: ContentRun | null;
  createdPresentationId: string | null;
  fields: {
    title?: string;
  };
};

type TestStatePayload = {
  context?: {
    deck?: {
      lengthProfile?: {
        activeCount?: number;
        skippedCount?: number;
        targetCount?: number;
      };
    };
  };
  creationDraft: CreationDraft;
  skippedSlides: ContentRunSlide[];
  slides: Array<{
    title?: string;
  }>;
};

type PostJsonResult = {
  payload: TestStatePayload;
  status: number;
};

type PresentationSummary = {
  id: string;
  title?: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createLmStudioStreamResponse(data: unknown): Response {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { content }, finish_reason: null }],
        id: `chatcmpl-progressive-${Date.now()}`,
        model: "progressive-content-run-test"
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

function roleForSlide(index: number, total: number): string {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  return ["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5] || "context";
}

function createDeckPlan(title: string, slideCount: number): DeckPlan {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const label = `${title} ${index + 1}`;
    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear generated message.`,
      role: roleForSlide(index, slideCount),
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "Progressive test audience",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should exercise progressive generation.`
  };
}

function createGeneratedPlan(title: string, slideNumber: number, total: number) {
  const absoluteIndex = slideNumber - 1;
  const label = `${title} ${slideNumber}`;
  return {
    outline: `${slideNumber}. ${label}`,
    references: [],
    slides: [
      {
        eyebrow: absoluteIndex === 0 ? "Opening" : absoluteIndex === total - 1 ? "Close" : `Step ${slideNumber}`,
        guardrails: [
          { body: `Guardrail ${slideNumber}.1 stays specific.`, title: `Check ${slideNumber}.1` },
          { body: `Guardrail ${slideNumber}.2 stays concrete.`, title: `Check ${slideNumber}.2` },
          { body: `Guardrail ${slideNumber}.3 stays bounded.`, title: `Check ${slideNumber}.3` }
        ],
        guardrailsTitle: `${label} checks`,
        keyPoints: [
          { body: `Draft ${slideNumber}.1 sets context.`, title: `Point ${slideNumber}.1` },
          { body: `Draft ${slideNumber}.2 adds contrast.`, title: `Point ${slideNumber}.2` },
          { body: `Draft ${slideNumber}.3 names action.`, title: `Point ${slideNumber}.3` },
          { body: `Draft ${slideNumber}.4 closes cleanly.`, title: `Point ${slideNumber}.4` }
        ],
        mediaMaterialId: "",
        note: `${label} has a speaker note.`,
        resources: [
          { body: `${label} resource one.`, title: `${label} resource A` },
          { body: `${label} resource two.`, title: `${label} resource B` }
        ],
        resourcesTitle: `${label} resources`,
        role: roleForSlide(absoluteIndex, total),
        signalsTitle: `${label} points`,
        summary: `${label} summarizes one useful generated idea.`,
        title: label
      }
    ],
    summary: `${label} generated plan`
  };
}

function installLlmMock(handler: LlmMockHandler): void {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "progressive-content-run-test";

  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    if (!/\/chat\/completions$/.test(String(url))) {
      return originalFetch(url, init);
    }

    const rawBody = init?.body;
    if (typeof rawBody !== "string") {
      throw new Error("Expected string LLM request body");
    }
    const requestBody: LlmRequestBody = JSON.parse(rawBody);
    const schemaName = requestBody.response_format.json_schema.name;
    if (schemaName === "presentation_semantic_text_repairs") {
      return createLmStudioStreamResponse({ repairs: [] });
    }

    return handler(requestBody);
  };
}

function restoreLlmMock(): void {
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

function parseTargetSlide(prompt: string): { slideNumber: number; total: number } {
  const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
  const slideNumberText = targetMatch?.[1];
  const totalText = targetMatch?.[2];
  if (!slideNumberText || !totalText) {
    throw new Error("Expected target slide marker in LLM prompt");
  }
  return {
    slideNumber: Number.parseInt(slideNumberText, 10),
    total: Number.parseInt(totalText, 10)
  };
}

function promptFromRequest(requestBody: LlmRequestBody): string {
  return requestBody.messages.map((message) => message.content || "").join("\n");
}

function requireContentRun(payload: TestStatePayload): ContentRun {
  const run = payload.creationDraft.contentRun;
  if (!run) {
    throw new Error("Expected content run");
  }
  return run;
}

function requireRunSlide(run: ContentRun, index: number): ContentRunSlide {
  const slide = run.slides[index];
  if (!slide) {
    throw new Error(`Expected content run slide ${index}`);
  }
  return slide;
}

function requireLengthProfile(payload: TestStatePayload) {
  const lengthProfile = payload.context?.deck?.lengthProfile;
  if (!lengthProfile) {
    throw new Error("Expected deck length profile");
  }
  return lengthProfile;
}

async function waitForState(
  baseUrl: string,
  predicate: (payload: TestStatePayload) => boolean,
  timeoutMs = 3000
): Promise<TestStatePayload> {
  const deadline = Date.now() + timeoutMs;
  let latest: TestStatePayload | null = null;
  while (Date.now() < deadline) {
    const response = await originalFetch(`${baseUrl}/api/state`);
    const payload: TestStatePayload = await response.json();
    latest = payload;
    if (predicate(payload)) {
      return payload;
    }
    await delay(25);
  }

  throw new Error(`Timed out waiting for state. Latest: ${JSON.stringify(latest)}`);
}

async function postJson(baseUrl: string, pathName: string, body: unknown = {}): Promise<PostJsonResult> {
  const response = await originalFetch(`${baseUrl}${pathName}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const payload: TestStatePayload & { error?: string } = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return {
    payload,
    status: response.status
  };
}

async function startTestServer() {
  clearPresentationCreationDraft();
  const server = startServer({ port: 0 });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
}

function cleanupGeneratedPresentations(): void {
  const current = listPresentations();
  current.presentations
    .filter((presentation: PresentationSummary) => /^progressive content run/i.test(presentation.title || ""))
    .forEach((presentation: PresentationSummary) => {
      try {
        deletePresentation(presentation.id);
      } catch (error) {
        // Keep cleanup best-effort so assertion failures stay visible.
      }
    });

  if (listPresentations().presentations.some((presentation: PresentationSummary) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  restoreLlmMock();
  clearPresentationCreationDraft();
  cleanupGeneratedPresentations();
});

test("draft create exposes completed slides before terminal deck creation", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_plan");
    requestCount += 1;
    const { slideNumber, total } = parseTargetSlide(promptFromRequest(requestBody));
    if (requestCount === 2) {
      await delay(250);
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run partial", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run partial", 3);
    const response = await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the deck concise.",
        objective: "Verify progressive visibility.",
        targetSlideCount: 3,
        title: "Progressive Content Run Partial",
        tone: "Direct"
      }
    });
    assert.equal(response.status, 202);

    const partial = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft.contentRun;
      const firstSlide = run && run.slides[0];
      return Boolean(run
        && run.status === "running"
        && run.completed >= 1
        && firstSlide
        && firstSlide.status === "complete"
        && firstSlide.slideSpec);
    });
    assert.equal(partial.creationDraft.createdPresentationId !== null, true);
    assert.ok(partial.slides.some((slide) => /Progressive content run partial/i.test(slide.title || "")));

    const finalState = await waitForState(baseUrl, (payload) => {
      return payload.creationDraft
        && !payload.creationDraft.createdPresentationId
        && payload.creationDraft.contentRun === null
        && payload.creationDraft.fields
        && payload.creationDraft.fields.title === ""
        && Array.isArray(payload.slides)
        && payload.slides.length === 3;
    }, 5000);
    assert.equal(finalState.creationDraft.contentRun, null);
    assert.equal(finalState.creationDraft.fields.title, "");
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});

test("failed content runs keep completed slides and retry from the failed slide", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    requestCount += 1;
    const { slideNumber, total } = parseTargetSlide(promptFromRequest(requestBody));
    if (requestCount === 2) {
      throw new Error("Synthetic slide failure");
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run retry", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run retry", 3);
    await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the deck concise.",
        objective: "Verify retry after failure.",
        targetSlideCount: 3,
        title: "Progressive Content Run Retry",
        tone: "Direct"
      }
    });

    const failed = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft.contentRun;
      return Boolean(run && run.status === "failed");
    });
    const failedRun = requireContentRun(failed);
    const failedFirstSlide = requireRunSlide(failedRun, 0);
    const failedSecondSlide = requireRunSlide(failedRun, 1);
    assert.equal(failedRun.completed, 1);
    assert.equal(failedRun.failedSlideIndex, 1);
    assert.equal(failedFirstSlide.status, "complete");
    assert.equal(failedSecondSlide.status, "failed");
    assert.ok(failedSecondSlide.errorLogPath);
    assert.ok(fs.existsSync(failedSecondSlide.errorLogPath));
    const diagnostic = JSON.parse(fs.readFileSync(failedSecondSlide.errorLogPath, "utf8"));
    assert.equal(diagnostic.context.failedSlideNumber, 2);
    assert.equal(diagnostic.context.operation, "create-presentation-from-outline");
    assert.match(diagnostic.error.message, /Synthetic slide failure/);

    const retryResponse = await postJson(baseUrl, "/api/presentations/draft/content/retry", {
      slideIndex: 1
    });
    const retryRun = requireContentRun(retryResponse.payload);
    assert.equal(retryResponse.status, 202);
    assert.equal(requireRunSlide(retryRun, 0).status, "complete");
    assert.equal(requireRunSlide(retryRun, 1).status, "pending");

    const finalState = await waitForState(baseUrl, (payload) => {
      return payload.creationDraft
        && !payload.creationDraft.createdPresentationId
        && payload.creationDraft.contentRun === null
        && payload.creationDraft.fields
        && payload.creationDraft.fields.title === ""
        && Array.isArray(payload.slides)
        && payload.slides.length === 3;
    }, 5000);
    assert.equal(finalState.creationDraft.contentRun, null);
    assert.equal(finalState.creationDraft.fields.title, "");
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});

test("stop content run keeps completed slides without writing a deck", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    requestCount += 1;
    const { slideNumber, total } = parseTargetSlide(promptFromRequest(requestBody));
    if (requestCount === 2) {
      await delay(250);
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run stopped", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run stopped", 3);
    await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the deck concise.",
        objective: "Verify stopping generation.",
        targetSlideCount: 3,
        title: "Progressive Content Run Stopped",
        tone: "Direct"
      }
    });

    await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft.contentRun;
      return Boolean(run && run.status === "running" && run.completed >= 1);
    });
    const stopResponse = await postJson(baseUrl, "/api/presentations/draft/content/stop");
    const stopRun = requireContentRun(stopResponse.payload);
    assert.equal(stopResponse.status, 202);
    assert.equal(stopRun.stopRequested, true);

    const stopped = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft.contentRun;
      return Boolean(run && run.status === "stopped");
    }, 5000);
    const stoppedRun = requireContentRun(stopped);
    assert.equal(stopped.creationDraft.createdPresentationId !== null, true);
    assert.ok(stoppedRun.completed >= 1);
    assert.equal(requireRunSlide(stoppedRun, 0).status, "complete");
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});

test("partial accept writes skipped placeholders for unfinished slides", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    requestCount += 1;
    const { slideNumber, total } = parseTargetSlide(promptFromRequest(requestBody));
    if (requestCount === 2) {
      await delay(250);
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run partial accept", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run partial accept", 4);
    await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the approved outline length visible.",
        objective: "Verify accepting partial generation.",
        targetSlideCount: 4,
        title: "Progressive Content Run Partial Accept",
        tone: "Direct"
      }
    });

    await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft.contentRun;
      return Boolean(run && run.status === "running" && run.completed >= 1);
    });
    await postJson(baseUrl, "/api/presentations/draft/content/stop");
    const stopped = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft.contentRun;
      return Boolean(run && run.status === "stopped" && run.completed >= 1 && run.completed < 4);
    }, 5000);
    const completedCount = requireContentRun(stopped).completed;

    const acceptResponse = await postJson(baseUrl, "/api/presentations/draft/content/accept-partial");
    assert.equal(acceptResponse.status, 200);
    assert.equal(acceptResponse.payload.creationDraft.contentRun, null);
    assert.equal(acceptResponse.payload.creationDraft.createdPresentationId, null);
    assert.equal(acceptResponse.payload.creationDraft.fields.title, "");

    const accepted = await waitForState(baseUrl, (payload) => {
      return Boolean(payload.creationDraft
        && !payload.creationDraft.createdPresentationId
        && payload.creationDraft.fields
        && payload.creationDraft.fields.title === ""
        && payload.context
        && payload.context.deck
        && payload.context.deck.lengthProfile
        && payload.context.deck.lengthProfile.targetCount === 4);
    }, 5000);
    const lengthProfile = requireLengthProfile(accepted);
    assert.equal(accepted.slides.length, completedCount, "only completed slides should be active");
    assert.equal(accepted.skippedSlides.length, 4 - completedCount, "unfinished outline beats should be skipped placeholders");
    assert.equal(lengthProfile.activeCount, completedCount);
    assert.equal(lengthProfile.skippedCount, 4 - completedCount);
    assert.equal(lengthProfile.targetCount, 4);
    accepted.skippedSlides.forEach((slide) => {
      assert.equal(slide.skipped, true);
      assert.equal(slide.skipMeta && slide.skipMeta.operation, "partial-content-acceptance");
    });
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});
