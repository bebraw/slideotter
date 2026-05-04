import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import {
  collectGeneratedVisibleText,
  parseMockChatRequest,
  type GeneratedPlanPoint,
  type GeneratedSlideSpec,
  type JsonRecord
} from "./helpers/presentation-generation-helpers.ts";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const { generateInitialDeckPlan,
  generateInitialPresentation,
  generatePresentationFromDeckPlan,
  generatePresentationFromDeckPlanIncremental,
  materializePlan } = require("../studio/server/services/presentation-generation.ts");
const { createMaterialFromDataUrl } = require("../studio/server/services/materials.ts");
const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;
const originalFetch = global.fetch;
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";
const htmxPresentationFixture = require("./fixtures/intro-to-htmx/presentation.json");
const htmxDeckContextFixture = require("./fixtures/intro-to-htmx/deck-context.json");

type CoveragePresentationFields = Record<string, unknown>;

type CoveragePresentation = JsonRecord & {
  id: string;
  slideCount?: number;
  targetSlideCount?: number;
  title?: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: CoveragePresentation[];
};

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

type GeneratedPlanSlide = {
  eyebrow?: string;
  guardrails?: GeneratedPlanPoint[];
  guardrailsTitle?: string;
  keyPoints?: GeneratedPlanPoint[];
  mediaMaterialId?: string;
  note?: string;
  resources?: GeneratedPlanPoint[];
  resourcesTitle?: string;
  role?: string;
  signalsTitle?: string;
  summary?: string;
  title?: string;
  type?: string;
};

type GeneratedPlan = {
  outline: string;
  references: unknown[];
  slides: GeneratedPlanSlide[];
  summary: string;
};

type GeneratedPlanOptions = {
  mediaMaterialId?: string;
  mediaSlideIndex?: number;
  sourceText?: string;
  startIndex?: number;
  total?: number;
};

type GeneratedDeckPlanSlide = {
  intent: string;
  keyMessage: string;
  role?: string;
  sourceNeed?: string;
  title: string;
  type?: string;
  visualNeed: string;
};

type GeneratedDeckPlan = {
  audience: string;
  language: string;
  narrativeArc: string;
  outline: string;
  slides: GeneratedDeckPlanSlide[];
  thesis: string;
};

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

function createCoveragePresentation(suffix: string, fields: CoveragePresentationFields = {}): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise high-risk filesystem-backed studio services.",
    title: `Coverage Risk ${Date.now()} ${suffix}`,
    ...fields
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function listCoveragePresentations(): PresentationRegistry {
  return listPresentations();
}

function cleanupCoveragePresentations(): void {
  const current = listCoveragePresentations();
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

  const afterCleanup = listCoveragePresentations();
  if (afterCleanup.presentations.some((presentation: CoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
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

function withVisiblePlanFields(slide: GeneratedPlanSlide, fields: GeneratedPlanSlide = {}): GeneratedPlanSlide {
  return {
    eyebrow: fields.eyebrow || "Section",
    guardrails: fields.guardrails || [
      { body: "Keep the slide focused on one useful idea.", title: "Focus" },
      { body: "Make the claim concrete enough to discuss.", title: "Concrete" },
      { body: "Avoid adding unsupported details.", title: "Evidence" }
    ],
    guardrailsTitle: fields.guardrailsTitle || "Checks",
    mediaMaterialId: fields.mediaMaterialId || "",
    note: fields.note || "Introduce the slide in one clear sentence.",
    resources: fields.resources || [
      { body: "Use the next action while reviewing the draft.", title: "Action" },
      { body: "Keep one example ready for questions.", title: "Example" }
    ],
    resourcesTitle: fields.resourcesTitle || "Cues",
    signalsTitle: fields.signalsTitle || "Points",
    type: fields.type || "content",
    ...slide
  };
}

function createGeneratedPlan(title: string, slideCount: number, options: GeneratedPlanOptions = {}): GeneratedPlan {
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const total = Number.isFinite(Number(options.total)) ? Number(options.total) : slideCount;
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const absoluteIndex = startIndex + index;
    const isFirst = absoluteIndex === 0;
    const isLast = absoluteIndex === total - 1 && total > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : (["context", "concept", "mechanics", "example", "tradeoff"][(absoluteIndex - 1) % 5] ?? "context");
    const label = `${title} ${absoluteIndex + 1}`;
    const sourceBody = options.sourceText && index === 1 ? options.sourceText : `${label} carries generated draft content.`;
    const mediaMaterialId = options.mediaMaterialId && index === (options.mediaSlideIndex || 1) ? options.mediaMaterialId : "";

    return withVisiblePlanFields({
      keyPoints: [
        { body: sourceBody, title: `${label} point A` },
        { body: `${label} adds a second distinct idea.`, title: `${label} point B` },
        { body: `${label} adds a third distinct idea.`, title: `${label} point C` },
        { body: `${label} adds a fourth distinct idea.`, title: `${label} point D` }
      ],
      mediaMaterialId,
      role,
      summary: `${label} summarizes one useful generated idea.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content"
    }, {
      eyebrow: isFirst ? "Opening" : isLast ? "Close" : `Section ${index + 1}`,
      guardrails: [
        { body: `${label} guardrail one is specific.`, title: `${label} check A` },
        { body: `${label} guardrail two is specific.`, title: `${label} check B` },
        { body: `${label} guardrail three is specific.`, title: `${label} check C` }
      ],
      guardrailsTitle: `${label} checks`,
      note: `${label} has a speaker note.`,
      resources: [
        { body: `${label} resource one.`, title: `${label} resource A` },
        { body: `${label} resource two.`, title: `${label} resource B` }
      ],
      resourcesTitle: `${label} resources`,
      signalsTitle: `${label} points`
    });
  });

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: [],
    slides,
    summary: `${title} generated plan`
  };
}

function createGeneratedDeckPlan(title: string, slideCount: number): GeneratedDeckPlan {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : (["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5] ?? "context");
    const label = `${title} ${index + 1}`;

    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear generated message.`,
      role,
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content",
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "Coverage audience",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should exercise phased generation.`
  };
}

test.after(() => {
  cleanupCoveragePresentations();
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
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

  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
});

test("LLM presentation generation repairs duplicate deck plans before drafting", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM deck planning fills missing source needs from a usable outline", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM deck planning reserves opening and handoff roles for deck boundaries", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation fills missing slide eyebrows from usable drafts", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation derives missing point titles from usable bodies", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation drafts approved outlines one slide at a time", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation preserves approved photoGrid outline types", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
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
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation semantically shortens overlong visible text", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  const progressEvents: MockProgressEvent[] = [];
  let repairRequestSeen = false;
  let requestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    requestCount += 1;

    if (requestBody.response_format.json_schema.name === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("How to Make Presentations", 3));
    }

    if (requestBody.response_format.json_schema.name === "initial_presentation_plan") {
      return createLmStudioStreamResponse({
        outline: "1. Open\n2. Practice\n3. Close",
        references: [],
        slides: [
          withVisiblePlanFields({
            keyPoints: [
              { body: "Frame the practical goal for the audience before you show any detail.", title: "Goal" },
              { body: "Name the specific audience need that the talk will answer.", title: "Audience" },
              { body: "Preview the workflow in plain words before moving into examples.", title: "Workflow" },
              { body: "Promise one repeatable method that the listener can reuse.", title: "Promise" }
            ],
            role: "opening",
            summary: "Open by explaining the practical outcome and how the deck will help new presenters plan a clear talk.",
            title: "How to Make Presentations"
          }, { eyebrow: "Opening", note: "Start with the practical outcome." }),
          withVisiblePlanFields({
            keyPoints: [
              {
                body: "Practice your talk three times while timing each run to stay within the planned session limit and keep confidence.",
                title: "Practice under real timing conditions"
              },
              {
                body: "Record one rehearsal and watch it once to find distracting habits before the real delivery.",
                title: "Record one rehearsal"
              },
              {
                body: "Ask one peer to identify the moment where the presentation first becomes unclear.",
                title: "Ask for feedback"
              },
              {
                body: "Cut one low-value detail so the central lesson has more space.",
                title: "Trim the middle"
              }
            ],
            role: "example",
            summary: "Show a concrete rehearsal loop that keeps a presentation clear, timed, and easier to deliver.",
            title: "Practice Before You Present"
          }, { eyebrow: "Example", guardrailsTitle: "Checks" }),
          withVisiblePlanFields({
            keyPoints: [
              { body: "Use the same checklist on your next short talk.", title: "Reuse" },
              { body: "Keep notes about what changed after feedback.", title: "Reflect" },
              { body: "Turn one improvement into a habit for next time.", title: "Improve" },
              { body: "Share the deck only after the spoken path works.", title: "Share" }
            ],
            role: "handoff",
            summary: "Close with one next action and a reusable checklist for the next presentation.",
            title: "Use the Checklist"
          }, { eyebrow: "Close", resourcesTitle: "Next cues" })
        ],
        summary: "Coverage plan"
      });
    }

    assert.equal(requestBody.response_format.json_schema.name, "presentation_semantic_text_repairs");
    repairRequestSeen = /Practice your talk three times/.test(requestBody.messages[1]?.content || "");
    return createLmStudioStreamResponse({
      repairs: [
        {
          id: "slide-2-point-1-title",
          text: "Practice with timing"
        },
        {
          id: "slide-2-point-1-body",
          text: "Run three timed rehearsals before presenting."
        }
      ]
    });
  };

  try {
    const generated = await generateInitialPresentation({
      includeActiveSources: false,
      onProgress: (event: MockProgressEvent) => progressEvents.push(event),
      targetSlideCount: 3,
      title: "How to Make Presentations"
    });
    const visibleText = collectGeneratedVisibleText(generated.slideSpecs);

    assert.equal(requestCount, 3, "LLM generation should request deck planning, slide drafting, and semantic repair");
    assert.equal(repairRequestSeen, true, "semantic repair prompt should receive the original overlong text");
    assert.ok(visibleText.some((value) => value === "Run three timed rehearsals before presenting."), "semantic repair should preserve meaning in a shorter field");
    assert.ok(!visibleText.some((value) => /Practice your talk three times while timing each run to stay$/i.test(String(value))), "semantic repair should avoid deterministic clipped fragments");
    assert.ok(progressEvents.some((event: MockProgressEvent) => event.stage === "semantic-repair"), "semantic repair should publish progress");
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation repairs scaffold panel titles from generated points", () => {
  const fields = {
    audience: "Workshop participants",
    objective: "Explain a planning workflow clearly.",
    title: "Workshop planning"
  };
  const plan = {
    outline: "1. Open\n2. Align\n3. Close",
    references: [],
    slides: [
      withVisiblePlanFields({
        keyPoints: [
          { body: "Name the workshop outcome before showing details.", title: "Guardrails" },
          { body: "Show who should use the planning flow.", title: "Audience" },
          { body: "Preview the core planning steps.", title: "Steps" },
          { body: "Explain what a good plan enables.", title: "Use" }
        ],
        role: "opening",
        summary: "Open with the workshop outcome and the path participants will follow.",
        title: "Workshop planning"
      }, {
        eyebrow: "Opening",
        guardrailsTitle: "Guardrails",
        resourcesTitle: "Sources to verify",
        signalsTitle: "Key points"
      }),
      withVisiblePlanFields({
        keyPoints: [
          { body: "Write the decision before collecting supporting material.", title: "Decision first" },
          { body: "Keep each planning step tied to a concrete owner.", title: "Ownership" },
          { body: "Review evidence before expanding the plan.", title: "Evidence" },
          { body: "Use one checklist to decide what moves forward.", title: "Checklist" }
        ],
        role: "concept",
        summary: "Show how a planning flow keeps decisions and evidence connected.",
        title: "Key Points"
      }, {
        eyebrow: "Alignment",
        guardrails: [
          { body: "Keep the plan tied to the decision.", title: "Decision check" },
          { body: "Avoid adding unsupported tasks.", title: "Evidence check" },
          { body: "Confirm the next owner before closing.", title: "Owner check" }
        ],
        guardrailsTitle: "Guardrails",
        resources: [
          { body: "Use the current project brief during review.", title: "Project brief" },
          { body: "Keep the checklist beside the draft.", title: "Review checklist" }
        ],
        resourcesTitle: "Sources to verify",
        signalsTitle: "Key points"
      }),
      withVisiblePlanFields({
        keyPoints: [
          { body: "Choose one next action for the plan owner.", title: "Action" },
          { body: "Store the plan where reviewers can find it.", title: "Store" },
          { body: "Schedule a short review after the first use.", title: "Review" },
          { body: "Update the checklist with what changed.", title: "Improve" }
        ],
        role: "handoff",
        summary: "Close with one next action and a clear owner for the plan.",
        title: "Use the plan"
      }, {
        eyebrow: "Close",
        resourcesTitle: "Sources to verify",
        signalsTitle: "Key points"
      })
    ],
    summary: "Workshop planning generated plan"
  };

  const slideSpecs: GeneratedSlideSpec[] = materializePlan(fields, plan);
  assert.equal(slideSpecs[0]?.cards?.[0]?.title, "Name the workshop outcome", "cover card scaffold title should be repaired from generated body text");
  assert.equal(slideSpecs[1]?.title, "Show how a planning flow keeps decisions", "weak slide title should be repaired from generated summary text");
  assert.equal(slideSpecs[1]?.guardrailsTitle, "Decision check", "content scaffold guardrails title should come from generated guardrail text");
  assert.equal(slideSpecs[1]?.signalsTitle, "Decision first", "content scaffold signal title should come from generated key point text");
  assert.equal(slideSpecs[2]?.resourcesTitle, "Action", "summary scaffold resources title should come from generated resource text");
  const visibleText = slideSpecs.flatMap((slideSpec: GeneratedSlideSpec) => [
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle
  ].filter(Boolean));
  assert.ok(!visibleText.some((value) => /^(Guardrails|Sources to verify|Key points)$/i.test(String(value))), "panel titles should not leak scaffold labels");
});

test("generated content slides keep compact visible card copy", () => {
  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Compact generated content"
  }, createGeneratedPlan("Compact generated content", 5));
  const contentSlides = slideSpecs.filter((slideSpec: GeneratedSlideSpec) => slideSpec.type === "content");

  assert.ok(contentSlides.length >= 1, "fixture should include generated content slides");
  contentSlides.forEach((slideSpec: GeneratedSlideSpec) => {
    const cardBodies = [
      ...(slideSpec.signals || []),
      ...(slideSpec.guardrails || [])
    ].map((item: GeneratedPlanPoint) => String(item.body || ""));
    assert.equal((slideSpec.signals || []).length, 4, "content slides should preserve schema-required signal cards");
    assert.equal((slideSpec.guardrails || []).length, 3, "content slides should preserve schema-required guardrail cards");
    assert.ok(
      cardBodies.every((body: string) => body.split(/\s+/).filter(Boolean).length <= 8),
      "content slide card bodies should stay within compact word budgets"
    );
  });
});

test("generated slide notes do not leak internal role instructions", () => {
  const plan = createGeneratedPlan("Internal role instruction", 3);
  if (!plan.slides[0]) {
    throw new Error("fixture should include an opening slide");
  }
  plan.slides[0].note = "Use this slide as the opening frame for the presentation sequence.";

  const slideSpecs: GeneratedSlideSpec[] = materializePlan({
    title: "Internal role instruction"
  }, plan);

  assert.doesNotMatch(
    String(slideSpecs[0]?.note || ""),
    /opening frame|presentation sequence/i,
    "cover notes should not expose internal slide-role instructions"
  );
});

test("LLM presentation generation preserves non-English visible structure", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  let requestCount = 0;
  global.fetch = async (_url, init) => {
    const requestBody = parseMockChatRequest(init);
    requestCount += 1;
    const schemaName = requestBody.response_format.json_schema.name;
    if (schemaName === "initial_presentation_deck_plan") {
      assert.match(requestBody.messages[0]?.content || "", /Use the language requested or implied by the brief/);
      return createLmStudioStreamResponse({
        audience: "suomenkieliset esiintyjät",
        language: "suomi",
        narrativeArc: "Esitys kulkee lupauksesta menetelmään ja seuraavaan toimeen.",
        outline: "1. Alku\n2. Menetelmä\n3. Seuraavat askeleet",
        slides: [
          {
            intent: "Avaa aihe kuulijan hyödyn kautta.",
            keyMessage: "Hyvä esitys alkaa selkeällä lupauksella.",
            role: "opening",
            sourceNeed: "Käytä käyttäjän tavoitetta.",
            title: "Hyvä esitys",
            visualNeed: "Ei välttämätöntä kuvaa."
          },
          {
            intent: "Näytä rakenteen käytännön merkitys.",
            keyMessage: "Rakenne pitää viestin koossa.",
            role: "concept",
            sourceNeed: "Käytä briefin rajausta.",
            title: "Rakenna selkeä polku",
            visualNeed: "Yksinkertainen rakennekuva voi auttaa."
          },
          {
            intent: "Sulje yhdellä seuraavalla toimella.",
            keyMessage: "Kuulijan pitää tietää mitä tehdä seuraavaksi.",
            role: "handoff",
            sourceNeed: "Käytä tavoitetta.",
            title: "Seuraava askel",
            visualNeed: "Ei välttämätöntä kuvaa."
          }
        ],
        thesis: "Hyvä esitys auttaa kuulijaa toimimaan."
      });
    }

    assert.equal(schemaName, "initial_presentation_plan");
    assert.match(requestBody.messages[0]?.content || "", /Use the language requested or implied by the brief/);

    return createLmStudioStreamResponse({
      outline: "1. Alku\n2. Menetelmä\n3. Seuraavat askeleet",
      references: [],
      slides: [
        withVisiblePlanFields({
          keyPoints: [
            { body: "Kuulija näkee heti miksi aihe on hyödyllinen.", title: "Hyöty" },
            { body: "Tavoite rajaa esityksen yhteen selkeään lupaukseen.", title: "Tavoite" },
            { body: "Esimerkki tekee ideasta helpomman muistaa.", title: "Esimerkki" },
            { body: "Lopetus kertoo mitä tehdä seuraavaksi.", title: "Lopetus" }
          ],
          role: "opening",
          summary: "Avaa esitys yhdellä selkeällä lupauksella.",
          title: "Hyvä esitys"
        }, {
          eyebrow: "Alku",
          note: "Kerro miksi aihe on kuulijalle hyödyllinen.",
          resourcesTitle: "Vihjeet",
          signalsTitle: "Pääkohdat"
        }),
        withVisiblePlanFields({
          keyPoints: [
            { body: "Rakenne kuljettaa kuulijaa alusta päätökseen.", title: "Rakenne" },
            { body: "Jokainen dia vastaa yhteen kysymykseen.", title: "Kysymys" },
            { body: "Turha yksityiskohta jää puhujan muistiinpanoihin.", title: "Rajaus" },
            { body: "Kuva tukee sanomaa eikä täytä tilaa.", title: "Kuva" }
          ],
          role: "concept",
          summary: "Näytä miten rakenne pitää viestin koossa.",
          title: "Rakenna selkeä polku"
        }, {
          eyebrow: "Periaate",
          guardrails: [
            { body: "Pidä jokaisella dialla vain yksi tehtävä.", title: "Yksi tehtävä" },
            { body: "Siirrä lisätiedot puheeseen tai lähteisiin.", title: "Rajaa" },
            { body: "Tarkista että otsikko kertoo asian.", title: "Otsikko" }
          ],
          guardrailsTitle: "Tarkistukset",
          resourcesTitle: "Vihjeet",
          signalsTitle: "Pääkohdat"
        }),
        withVisiblePlanFields({
          keyPoints: [
            { body: "Harjoittele ääneen ennen jakamista.", title: "Harjoittele" },
            { body: "Pyydä palautetta yhdestä epäselvästä kohdasta.", title: "Palaute" },
            { body: "Korjaa ensin viesti ja vasta sitten ulkoasu.", title: "Korjaa" },
            { body: "Tallenna valmis versio arkistoon.", title: "Arkistoi" }
          ],
          role: "handoff",
          summary: "Sulje esitys yhdellä seuraavalla toimella.",
          title: "Seuraava askel"
        }, {
          eyebrow: "Lopetus",
          resources: [
            { body: "Tee yksi harjoituskierros ennen julkaisua.", title: "Harjoitus" },
            { body: "Kerää palaute seuraavaa versiota varten.", title: "Palaute" }
          ],
          resourcesTitle: "Seuraavaksi",
          signalsTitle: "Pääkohdat"
        })
      ],
      summary: "Suomenkielinen suunnitelma"
    });
  };

  try {
    const generated = await generateInitialPresentation({
      audience: "suomenkieliset esiintyjät",
      includeActiveSources: false,
      objective: "Näytä miten hyvä esitys rakennetaan.",
      targetSlideCount: 3,
      title: "Hyvä esitys"
    });
    const visibleText = collectGeneratedVisibleText(generated.slideSpecs);

    assert.equal(requestCount, 2, "non-English plans should use deck planning and slide drafting without repair");
    assert.ok(visibleText.some((value) => value === "Pääkohdat"), "LLM-supplied labels should reach slides");
    assert.ok(
      !visibleText.some((value) => /Opening|Close|Key points|Useful cues|Drafted|Checks|Reference lead/i.test(String(value))),
      "LLM generation should not inject fixed English visible labels into non-English decks"
    );
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
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

  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
});
