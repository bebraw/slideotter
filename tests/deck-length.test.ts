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
  getSlides,
  insertStructuredSlide,
  readSlideSpec
} = require("../studio/server/services/slides.ts");
const {
  applyDeckLengthPlan,
  planDeckLength,
  planDeckLengthSemantic,
  restoreSkippedSlides
} = require("../studio/server/services/deck-length.ts");

type JsonRecord = Record<string, unknown>;

type CoveragePresentation = JsonRecord & {
  id: string;
};

type CoverageSlideInfo = JsonRecord & {
  id: string;
  index: number;
  skipped?: boolean;
};

type CoverageSlideSpec = JsonRecord & {
  skipMeta?: {
    operation?: string;
  };
  skipped?: boolean;
};

type CoverageDeckLengthAction = JsonRecord & {
  action?: string;
  slideId?: string;
  slideSpec?: JsonRecord;
};

type MockChatRequest = JsonRecord & {
  messages: Array<{
    content: string;
  }>;
  response_format: {
    json_schema: {
      name: string;
    };
  };
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;
const originalFetch = global.fetch;
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

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function collectVisibleText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectVisibleText(entry));
  }

  if (!isJsonRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([key]) => key !== "id" && key !== "layoutDefinition" && key !== "skipMeta")
    .flatMap(([_key, entry]) => collectVisibleText(entry));
}

function createCoveragePresentation(suffix: string): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise deck length planning.",
    title: `Coverage Deck Length ${Date.now()} ${suffix}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function cleanupCoveragePresentations(): void {
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
}

function restoreLlmEnv(): void {
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

function createContentSlideSpec(title: string, index = 2): JsonRecord {
  return {
    type: "content",
    index,
    title,
    eyebrow: "Coverage",
    summary: "A structured slide used to verify deck length behavior.",
    signalsTitle: "Signals",
    guardrailsTitle: "Guardrails",
    signals: [
      { id: "signal-one", label: "one", value: 0.8 },
      { id: "signal-two", label: "two", value: 0.7 },
      { id: "signal-three", label: "three", value: 0.6 }
    ],
    guardrails: [
      { id: "guardrail-one", label: "one", value: "1" },
      { id: "guardrail-two", label: "two", value: "1" },
      { id: "guardrail-three", label: "three", value: "1" }
    ]
  };
}

function parseMockChatRequest(init: RequestInit | undefined): MockChatRequest {
  const body = init?.body;
  if (typeof body !== "string") {
    throw new Error("mocked LLM request should provide a JSON string body");
  }
  const parsed: unknown = JSON.parse(body);
  if (!isJsonRecord(parsed) || !Array.isArray(parsed.messages)) {
    throw new Error("mocked LLM request should include messages");
  }
  const responseFormat = parsed.response_format;
  const jsonSchema = isJsonRecord(responseFormat) ? responseFormat.json_schema : null;
  if (!isJsonRecord(jsonSchema) || typeof jsonSchema.name !== "string") {
    throw new Error("mocked LLM request should include a schema name");
  }

  return {
    ...parsed,
    messages: parsed.messages.map((message: unknown) => {
      if (!isJsonRecord(message)) {
        throw new Error("mocked LLM message should be an object");
      }
      return {
        content: String(message.content || "")
      };
    }),
    response_format: {
      json_schema: {
        name: jsonSchema.name
      }
    }
  };
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
        id: "chatcmpl-coverage",
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

test.after(() => {
  cleanupCoveragePresentations();
  global.fetch = originalFetch;
  restoreLlmEnv();
});

test("deck length scaling marks slides as skipped and restores them without losing files", () => {
  createCoveragePresentation("deck-length");

  insertStructuredSlide(createContentSlideSpec("Implementation detail slide", 4), 4);
  insertStructuredSlide(createContentSlideSpec("Technical appendix slide", 5), 5);
  insertStructuredSlide(createContentSlideSpec("Reference material slide", 6), 6);

  assert.equal(getSlides().length, 6, "fixture should start with six active slides");

  const plan = planDeckLength({ mode: "appendix-first", targetCount: 4 });
  const skipActions = plan.actions.filter((action: CoverageDeckLengthAction) => action.action === "skip");

  assert.equal(plan.currentCount, 6, "planning should describe the active deck length");
  assert.equal(plan.nextCount, 4, "planning should converge on the requested shorter length");
  assert.equal(skipActions.length, 2, "shortening should propose skips instead of deletion");

  const shortened = applyDeckLengthPlan({
    actions: plan.actions,
    mode: plan.mode,
    targetCount: plan.targetCount
  });
  const skippedSlideIds = getSlides({ includeSkipped: true })
    .filter((slide: CoverageSlideInfo) => slide.skipped)
    .map((slide: CoverageSlideInfo) => slide.id);

  assert.equal(shortened.lengthProfile.activeCount, 4, "applying a shorter plan should reduce only the active slide count");
  assert.equal(shortened.lengthProfile.skippedCount, 2, "skipped slides should be counted in the length profile");
  assert.equal(getSlides().length, 4, "default slide listing should hide skipped slides");
  assert.equal(getSlides({ includeSkipped: true }).length, 6, "skipped slides should remain inspectable");
  assert.equal(skippedSlideIds.length, 2, "skipped slides should be marked on their slide specs");
  skippedSlideIds.forEach((slideId: string) => {
    const slideSpec: CoverageSlideSpec = readSlideSpec(slideId);
    assert.equal(slideSpec.skipped, true, "skipped specs should persist the skipped marker");
    assert.equal(slideSpec.skipMeta?.operation, "scale-deck-length", "skipped specs should record their source operation");
  });

  const restorePlan = planDeckLength({ targetCount: 6 });
  assert.equal(
    restorePlan.actions.filter((action: CoverageDeckLengthAction) => action.action === "restore").length,
    2,
    "lengthening should propose restoring previously skipped slides first"
  );

  const restoredByPlan = applyDeckLengthPlan({
    actions: restorePlan.actions,
    targetCount: restorePlan.targetCount
  });
  assert.equal(restoredByPlan.lengthProfile.activeCount, 6, "restore actions should return skipped slides to the active deck");
  assert.equal(getSlides({ includeSkipped: true }).filter((slide: CoverageSlideInfo) => slide.skipped).length, 0, "restore actions should clear skipped markers");

  const oneSkipPlan = planDeckLength({ targetCount: 5 });
  applyDeckLengthPlan({
    actions: oneSkipPlan.actions,
    targetCount: oneSkipPlan.targetCount
  });
  assert.equal(getSlides().length, 5, "second shortening pass should leave one skipped slide");

  const restoredAll = restoreSkippedSlides({ all: true });
  assert.equal(restoredAll.restoredSlides, 1, "bulk restore should report restored skipped slides");
  assert.deepEqual(
    getSlides().map((slide: CoverageSlideInfo) => slide.index),
    [1, 2, 3, 4, 5, 6],
    "restored slides should be compacted back into a contiguous active order"
  );
});

test("semantic deck length planning can insert detail slides when growing", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  createCoveragePresentation("semantic-length-grow");

  const plan = await planDeckLengthSemantic({
    mode: "semantic",
    targetCount: 5
  });
  const insertActions = plan.actions.filter((action: CoverageDeckLengthAction) => action.action === "insert");

  assert.equal(plan.currentCount, 3, "semantic growth planning should start from the active deck length");
  assert.equal(plan.nextCount, 5, "semantic growth planning should converge on the target length");
  assert.equal(insertActions.length, 2, "semantic growth should add new detail slide actions when there are no skipped slides to restore");
  assert.ok(insertActions.every((action: CoverageDeckLengthAction) => action.slideSpec && action.slideSpec.type === "content"), "insert actions should carry valid structured slide specs");
  assert.ok(
    insertActions.every((action: CoverageDeckLengthAction) => action.slideSpec && action.slideSpec.layout === "standard"),
    "inserted semantic slides should use the bounded standard content layout"
  );

  const insertedText = insertActions
    .flatMap((action: CoverageDeckLengthAction) => collectVisibleText(action.slideSpec))
    .join(" ");
  assert.doesNotMatch(insertedText, /\bPoint\s+\d+\b/i, "inserted semantic slides should not expose numbered filler labels");
  assert.doesNotMatch(insertedText, /Expansion rules/i, "inserted semantic slides should not expose workflow scaffolding");
  assert.doesNotMatch(insertedText, /adds useful detail without changing the deck's main arc/i, "inserted semantic slides should not expose fallback authoring text");
  assert.doesNotMatch(insertedText, /Preserve the original deck promise/i, "inserted semantic slides should not expose expansion planning notes");
  assert.doesNotMatch(insertedText, /not filler/i, "inserted semantic slides should not expose expansion planning notes");

  const applied = applyDeckLengthPlan({
    actions: plan.actions,
    targetCount: plan.targetCount
  });

  assert.equal(applied.insertedSlides, 2, "applying semantic growth should insert generated detail slides");
  assert.equal(getSlides().length, 5, "semantic growth should increase the active deck length");
});

test("semantic deck length planning can use LLM slide-ranking for shrink decisions", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  createCoveragePresentation("semantic-length-shrink");
  insertStructuredSlide(createContentSlideSpec("Optional technical detail", 4), 3);

  global.fetch = async (_url, init) => {
    const requestBody = parseMockChatRequest(init);
    assert.equal(requestBody.response_format.json_schema.name, "semantic_deck_length_plan");
    assert.match(requestBody.messages[1]?.content || "", /Optional technical detail/);

    return createLmStudioStreamResponse({
      actions: [
        {
          action: "skip",
          confidence: "high",
          keyPoints: [],
          reason: "This is optional implementation detail and can return when the deck has more room.",
          slideId: "slide-04",
          summary: "",
          targetIndex: 0,
          title: "Optional technical detail"
        }
      ],
      summary: "Skip one optional technical detail slide."
    });
  };

  try {
    const plan = await planDeckLengthSemantic({
      mode: "semantic",
      targetCount: 3
    });

    assert.equal(plan.actions.length, 1, "semantic shrink planning should return one skip action");
    assert.equal(plan.actions[0].slideId, "slide-04", "semantic shrink planning should honor the ranked LLM skip candidate");
    assert.match(plan.actions[0].reason, /optional implementation detail/i);
  } finally {
    global.fetch = originalFetch;
    restoreLlmEnv();
  }
});
