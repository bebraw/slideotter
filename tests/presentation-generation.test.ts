import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import {
  collectGeneratedVisibleText,
  createGeneratedDeckPlan,
  createGeneratedPlan,
  parseMockChatRequest,
  type GeneratedDeckPlanSlide,
  type GeneratedPlanSlide,
  type GeneratedSlideSpec,
  type JsonRecord
} from "./helpers/presentation-generation-helpers.ts";
import {
  createLlmRuntimeSnapshot,
  createLmStudioStreamResponse
} from "./helpers/presentation-generation-runtime.ts";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { generateInitialDeckPlan,
  generateInitialPresentation,
  generatePresentationFromDeckPlan,
  generatePresentationFromDeckPlanIncremental,
  materializePlan } = require("../studio/server/services/presentation-generation.ts");
const llmRuntime = createLlmRuntimeSnapshot();
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";
const htmxPresentationFixture = require("./fixtures/intro-to-htmx/presentation.json");
const htmxDeckContextFixture = require("./fixtures/intro-to-htmx/deck-context.json");

type MockProgressEvent = JsonRecord & {
  llm?: {
    promptBudget?: {
      schemaCharCount?: number;
      userPromptCharCount?: number;
      workflowName?: string;
    };
  };
  stage?: string;
};

type SourceSnippet = JsonRecord & {
  sourceId?: string;
  text: string;
};

type MaterialRecord = JsonRecord & {
  caption?: string;
  fileName: string;
  id: string;
  media?: unknown;
  url: string;
};

type GeneratedPresentationResult = JsonRecord & {
  retrieval?: {
    materials?: MaterialRecord[];
    snippets: SourceSnippet[];
  };
  slideContexts: Record<string, JsonRecord>;
  slideSpecs: GeneratedSlideSpec[];
};

test.after(() => {
  llmRuntime.restore();
});


test("initial presentation generation requires complete LLM-visible plans", async () => {
  const fields = {
    ...htmxDeckContextFixture.deck,
    description: htmxPresentationFixture.description,
    targetSlideCount: htmxDeckContextFixture.deck.lengthProfile.targetCount
  };
  const weakPlan = {
    outline: "Intro to HTMX",
    references: [
      {
        note: "Invented citation from a weak model response.",
        title: "Smith et al.",
        url: ""
      }
    ],
    slides: [
      {
        keyPoints: [
          { body: "HTMX enables rich interactions with minimal JavaScript by extending HTML attributes.", title: "summary" },
          { body: "It shifts complexity from client-side scripting to server-driven responses.", title: "title:" },
          { body: "HTMX enables rich interactions with minimal JavaScript by extending HTML attributes.", title: "summary" },
          { body: "Students should see a concrete request and response example.", title: "Example" }
        ],
        role: "opening",
        summary: "This presentation introduces HTMX as a server-driven way to build interactive web applications.",
        title: "Intro to HTMX"
      },
      {
        keyPoints: [
          { body: "hx-get issues a GET request from an HTML element.", title: "summary" },
          { body: "hx-target chooses the element that receives the returned fragment.", title: "Target" },
          { body: "hx-swap chooses how the fragment is inserted.", title: "Swap" },
          { body: "The server returns HTML, not a JSON view model.", title: "Response" }
        ],
        role: "mechanics",
        summary: "HTMX behavior is mostly declared through attributes on ordinary HTML elements.",
        title: "How requests work"
      },
      {
        keyPoints: [
          { body: "Review official documentation before citing specific behavior.", title: "Verify docs" },
          { body: "Try a small form submission before adopting HTMX broadly.", title: "Practice" },
          { body: "Compare server-rendered fragments with JSON API client rendering.", title: "Compare" },
          { body: "Academic References: Smith et al., Journal of Web Technologies, 2023...", title: "Academic References" }
        ],
        role: "handoff",
        summary: "Close by showing what students should verify and try next...",
        title: "References and next steps"
      }
    ],
    summary: "Weak model response shaped like the HTMX trial deck."
  };
  assert.throws(
    () => materializePlan(fields, weakPlan),
    /missing usable|needs \d+ distinct/,
    "materializer should reject weak LLM plans instead of inventing visible fallback copy"
  );

  const duplicatePlan = {
    outline: "Workshop planning",
    references: [],
    slides: Array.from({ length: 4 }, () => createGeneratedPlan("Repeated generated slide", 1).slides[0]),
    summary: "Weak model repeated one plan slide."
  };
  assert.throws(
    () => materializePlan({
      audience: "Workshop participants",
      objective: "Explain a planning workflow clearly.",
      title: "Workshop planning"
    }, duplicatePlan),
    /repeats slide/,
    "materializer should reject duplicate plans instead of replacing them with template copy"
  );

  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    if (requestBody.response_format.json_schema.name === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Intro to HTMX", fields.targetSlideCount));
    }

    assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_plan");
    assert.ok(
      (requestBody.max_tokens || 0) >= fields.targetSlideCount * 900,
      "initial presentation slide drafting should reserve enough output tokens for complete structured JSON"
    );
    return createLmStudioStreamResponse(createGeneratedPlan("Intro to HTMX", fields.targetSlideCount));
  };

  const generated: GeneratedPresentationResult = await generateInitialPresentation(fields);
  const generatedVisibleText = collectGeneratedVisibleText(generated.slideSpecs);

  assert.equal(generated.slideSpecs.length, 20, "LLM generation should respect the HTMX target length fixture");
  assert.equal(Object.keys(generated.slideContexts || {}).length, 20, "LLM generation should create slide context for each generated slide");
  assert.ok(generated.slideContexts["slide-01"]?.intent, "generated slide context should carry slide intent");
  assert.ok(generated.slideContexts["slide-01"]?.mustInclude, "generated slide context should carry required slide content");
  assert.ok(!generatedVisibleText.some((value) => /\.{3,}|…/.test(String(value))), "LLM generation should avoid ellipsis truncation");
  assert.ok(!generatedVisibleText.some((value) => /\b(a|an|and|as|at|before|by|for|from|in|into|of|on|or|the|through|to|when|where|while|with|within|without)$/i.test(String(value).trim())), "LLM generation should avoid dangling sentence endings");
  assert.ok(!generatedVisibleText.some((value) => /Refine constraints before expanding the deck|^Guardrails$|^Sources to verify$/i.test(String(value))), "LLM generation should avoid visible scaffolding labels");
  llmRuntime.restore();
});

test("LLM presentation generation repairs duplicate deck plans before drafting", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  const progressEvents: MockProgressEvent[] = [];
  const requestSchemas: string[] = [];
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    const schemaName = requestBody.response_format.json_schema.name;
    requestSchemas.push(schemaName);

    if (schemaName === "initial_presentation_deck_plan") {
      const duplicated = createGeneratedDeckPlan("Finnish berries", 4);
      const duplicateSlide = duplicated.slides[1];
      if (!duplicateSlide) {
        throw new Error("generated fixture should include a second slide");
      }
      duplicated.slides[2] = {
        ...duplicateSlide,
        role: "concept"
      };
      return createLmStudioStreamResponse(duplicated);
    }

    if (schemaName === "initial_presentation_deck_plan_repair") {
      assert.match(requestBody.messages[1]?.content || "", /repeats an earlier slide/);
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Finnish berries", 4));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    assert.match(requestBody.messages[1]?.content || "", /Approved deck plan/);
    return createLmStudioStreamResponse(createGeneratedPlan("Berry", 4));
  };

  try {
    const generated: GeneratedPresentationResult = await generateInitialPresentation({
      audience: "Beginners",
      constraints: "Theme like a Finnish forest.",
      objective: "What kind of berries exist in Finland?",
      onProgress: (event: MockProgressEvent) => progressEvents.push(event),
      targetSlideCount: 4,
      title: "Introduction to Finnish Berries",
      tone: "Executive"
    });

    assert.deepEqual(
      requestSchemas,
      ["initial_presentation_deck_plan", "initial_presentation_deck_plan_repair", "initial_presentation_plan"],
      "duplicate deck planning should repair before slide drafting"
    );
    assert.equal(generated.slideSpecs.length, 4, "generation should continue after deck-plan repair");
    assert.ok(progressEvents.some((event) => event.stage === "deck-plan-repair"), "deck-plan repair should publish progress");
  } finally {
    llmRuntime.restore();
  }
});

test("LLM deck planning fills missing source needs from a usable outline", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "small-outline-model";

  const requestSchemas: string[] = [];
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    const schemaName = requestBody.response_format.json_schema.name;
    requestSchemas.push(schemaName);
    assert.equal(schemaName, "initial_presentation_deck_plan");

    const plan = createGeneratedDeckPlan("Bar", 4);
    plan.slides = plan.slides.map((slide: GeneratedDeckPlanSlide, index: number): GeneratedDeckPlanSlide => {
      if (index === 0) {
        return {
          intent: slide.intent,
          keyMessage: slide.keyMessage,
          title: slide.title,
          visualNeed: slide.visualNeed,
          ...(slide.role ? { role: slide.role } : {})
        };
      }
      return {
        ...slide,
        sourceNeed: index === 1 ? "N/A" : "none"
      };
    });
    return createLmStudioStreamResponse(plan);
  };

  try {
    const generated = await generateInitialDeckPlan({
      audience: "Maintainers",
      objective: "",
      targetSlideCount: 4,
      title: "Bar"
    });

    assert.deepEqual(
      requestSchemas,
      ["initial_presentation_deck_plan"],
      "missing sourceNeed should be hydrated locally without a full repair round trip"
    );
    assert.equal(generated.plan.slides.length, 4);
    generated.plan.slides.forEach((slide: GeneratedDeckPlanSlide) => {
      assert.ok(slide.sourceNeed, "each slide should receive usable source guidance");
      assert.ok(!/^(N\/A|none)$/i.test(slide.sourceNeed || ""), "weak source guidance should be replaced");
      assert.ok(slide.visualNeed, "existing visual guidance should be preserved");
    });
  } finally {
    llmRuntime.restore();
  }
});

test("LLM deck planning reserves opening and handoff roles for deck boundaries", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "role-normalization-model";

  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_deck_plan");
    const plan = createGeneratedDeckPlan("Role normalization", 4);
    const secondSlide = plan.slides[1];
    const thirdSlide = plan.slides[2];
    if (!secondSlide || !thirdSlide) {
      throw new Error("generated fixture should include role-normalization slides");
    }
    secondSlide.role = "handoff";
    thirdSlide.role = "opening";
    return createLmStudioStreamResponse(plan);
  };

  try {
    const result = await generateInitialDeckPlan({
      audience: "Maintainers",
      constraints: "Keep the outline practical.",
      objective: "Verify outline role normalization.",
      targetSlideCount: 4,
      title: "Role normalization",
      tone: "Direct"
    });

    assert.deepEqual(
      result.plan.slides.map((slide: GeneratedDeckPlanSlide) => slide.role),
      ["opening", "context", "concept", "handoff"]
    );
  } finally {
    llmRuntime.restore();
  }
});

test("LLM presentation generation fills missing slide eyebrows from usable drafts", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "small-slide-model";

  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    const schemaName = requestBody.response_format.json_schema.name;

    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Small slide draft", 4));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    const plan = createGeneratedPlan("Small slide draft", 4);
    plan.slides = plan.slides.map((slide: GeneratedPlanSlide) => {
      const { eyebrow, summary, ...rest } = slide;
      return rest;
    });
    return createLmStudioStreamResponse(plan);
  };

  try {
    const generated: GeneratedPresentationResult = await generateInitialPresentation({
      audience: "Maintainers",
      objective: "Show that small local models can draft usable slides.",
      targetSlideCount: 4,
      title: "Small slide draft"
    });

    assert.equal(generated.slideSpecs.length, 4);
    assert.deepEqual(
      generated.slideSpecs.map((slide: GeneratedSlideSpec) => slide.eyebrow).filter(Boolean),
      ["Opening", "Context", "Concept", "Close"],
      "missing slide eyebrows should be derived from slide position and role"
    );
    assert.ok(
      generated.slideSpecs.every((slide: GeneratedSlideSpec) => typeof slide.summary === "string" && slide.summary.length > 0),
      "missing slide summaries should be derived from usable generated draft content"
    );
  } finally {
    llmRuntime.restore();
  }
});

test("LLM presentation generation derives missing point titles from usable bodies", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "small-point-title-model";

  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    const schemaName = requestBody.response_format.json_schema.name;

    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Small point draft", 4));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    const plan = createGeneratedPlan("Small point draft", 4);
    const firstPoint = plan.slides[2]?.keyPoints?.[0];
    if (!firstPoint) {
      throw new Error("generated fixture should include a third slide with key points");
    }
    delete firstPoint.title;
    return createLmStudioStreamResponse(plan);
  };

  try {
    const generated: GeneratedPresentationResult = await generateInitialPresentation({
      audience: "Maintainers",
      objective: "Show that small local models can omit a point title.",
      targetSlideCount: 4,
      title: "Small point draft"
    });

    assert.equal(generated.slideSpecs.length, 4);
    assert.equal(
      generated.slideSpecs[2]?.signals?.[0]?.title,
      "Small point draft 3",
      "missing key point titles should be derived from the point body"
    );
  } finally {
    llmRuntime.restore();
  }
});

test("LLM presentation generation drafts approved outlines one slide at a time", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "incremental-coverage-model";

  const deckPlan = createGeneratedDeckPlan("Incremental deck", 4);
  const progressEvents: MockProgressEvent[] = [];
  const writtenCounts: number[] = [];
  const writtenContextCounts: number[] = [];
  const targetSlides: number[] = [];
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    const schemaName = requestBody.response_format.json_schema.name;
    assert.equal(schemaName, "initial_presentation_plan");

    const prompt = String(requestBody.messages.map((message: { content: string }) => message.content).join("\n"));
    const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
    if (!targetMatch) {
      throw new Error("incremental drafting should name the target outline slide");
    }
    assert.match(prompt, /Compact deck sequence context:/, "incremental drafting should send compact sequence context");
    assert.doesNotMatch(prompt, /Complete approved deck plan for context:/, "incremental drafting should not repeat the full approved deck plan");
    const slideNumber = Number.parseInt(targetMatch[1] || "", 10);
    const total = Number.parseInt(targetMatch[2] || "", 10);
    targetSlides.push(slideNumber);

    return createLmStudioStreamResponse(createGeneratedPlan("Incremental deck", 1, {
      startIndex: slideNumber - 1,
      total
    }));
  };

  try {
    const generated = await generatePresentationFromDeckPlanIncremental({
      audience: "Maintainers",
      objective: "Show incremental reliability",
      onProgress: (event: MockProgressEvent) => progressEvents.push(event),
      targetSlideCount: 4,
      title: "Incremental deck",
      tone: "Direct"
    }, deckPlan, {}, {
      onSlide: ({ slideContexts, slideSpecs }: { slideContexts: Record<string, JsonRecord>; slideSpecs: GeneratedSlideSpec[] }) => {
        writtenCounts.push(slideSpecs.length);
        writtenContextCounts.push(Object.keys(slideContexts || {}).length);
      }
    });

    assert.deepEqual(targetSlides, [1, 2, 3, 4], "drafting should request each outline slide in order");
    assert.deepEqual(writtenCounts, [1, 2, 3, 4], "partial slide specs should be available after every slide");
    assert.deepEqual(writtenContextCounts, [1, 2, 3, 4], "partial slide contexts should be available after every slide");
    assert.equal(generated.slideSpecs.length, 4, "incremental generation should return the complete deck");
    assert.equal(Object.keys(generated.slideContexts || {}).length, 4, "incremental generation should return context for every slide");
    assert.ok(generated.slideContexts["slide-04"].mustInclude, "incremental slide context should include required slide content");
    assert.equal(generated.slideSpecs[0].type, "cover", "first generated slide should remain a cover");
    assert.equal(generated.slideSpecs[3].type, "summary", "last generated slide should remain a handoff summary");
    assert.ok(progressEvents.some((event) => event.stage === "drafting-slide"), "drafting should publish per-slide progress");
    const promptBudgetEvent = progressEvents.find((event: MockProgressEvent) => event.llm && event.llm.promptBudget && event.llm.promptBudget.workflowName === "staged-slide-drafting");
    if (!promptBudgetEvent) {
      throw new Error("LLM progress should include prompt budget diagnostics");
    }
    assert.ok((promptBudgetEvent.llm?.promptBudget?.userPromptCharCount || 0) > 0, "prompt budget should record user prompt characters");
    assert.ok((promptBudgetEvent.llm?.promptBudget?.schemaCharCount || 0) > 0, "prompt budget should record schema characters");
  } finally {
    llmRuntime.restore();
  }
});

test("LLM presentation generation preserves approved photoGrid outline types", async () => {
  llmRuntime.clearEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "approved-type-model";

  const deckPlan = createGeneratedDeckPlan("Approved grid deck", 4);
  const approvedGridSlide = deckPlan.slides[1];
  if (!approvedGridSlide) {
    throw new Error("generated deck plan fixture should include a second slide");
  }
  approvedGridSlide.type = "photoGrid";

  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_plan");

    const plan = createGeneratedPlan("Approved grid deck", 4);
    const generatedGridSlide = plan.slides[1];
    if (!generatedGridSlide) {
      throw new Error("generated plan fixture should include a second slide");
    }
    generatedGridSlide.type = "content";

    return createLmStudioStreamResponse(plan);
  };

  try {
    const generated = await generatePresentationFromDeckPlan({
      audience: "Maintainers",
      objective: "Preserve the approved media-heavy outline.",
      presentationMaterials: [
        {
          alt: "First approved image",
          id: "approved-grid-1",
          title: "Approved grid one",
          url: tinyPngDataUrl
        },
        {
          alt: "Second approved image",
          id: "approved-grid-2",
          title: "Approved grid two",
          url: tinyPngDataUrl
        },
        {
          alt: "Third approved image",
          id: "approved-grid-3",
          title: "Approved grid three",
          url: tinyPngDataUrl
        }
      ],
      targetSlideCount: 4,
      title: "Approved grid deck"
    }, deckPlan);

    assert.equal(generated.slideSpecs[1]?.type, "photoGrid", "approved outline slide type should override provider draft type");
    assert.equal(
      Array.isArray(generated.slideSpecs[1]?.mediaItems) ? generated.slideSpecs[1]?.mediaItems.length : 0,
      3,
      "approved photoGrid slides should materialize as image grids"
    );
  } finally {
    llmRuntime.restore();
  }
});
