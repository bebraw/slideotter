import assert from "node:assert/strict";
import * as fs from "node:fs";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation } = require("../studio/server/services/presentations.ts");
const { generateInitialPresentation } = require("../studio/server/services/presentation-generation.ts");
const { createSource,
  deleteSource,
  getGenerationSourceContext,
  listSources,
  retrieveSourceSnippets } = require("../studio/server/services/sources.ts");
const { getPresentationPaths } = require("../studio/server/services/presentations.ts");

type JsonRecord = Record<string, unknown>;

type ContextPresentation = JsonRecord & {
  id: string;
  title?: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: ContextPresentation[];
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

type GeneratedPlanPoint = {
  body?: string;
  title?: string;
};

type GeneratedSlideSpec = JsonRecord & {
  bullets?: GeneratedPlanPoint[];
  cards?: GeneratedPlanPoint[];
  eyebrow?: string;
  guardrails?: GeneratedPlanPoint[];
  guardrailsTitle?: string;
  note?: string;
  resources?: GeneratedPlanPoint[];
  resourcesTitle?: string;
  signals?: GeneratedPlanPoint[];
  signalsTitle?: string;
  summary?: string;
  title?: string;
};

type SourceSnippet = JsonRecord & {
  sourceId?: string;
  text: string;
};

type GenerationSourceContext = {
  budget: {
    maxPromptChars: number;
    maxSnippetChars: number;
    omittedSnippetCount: number;
    promptCharCount: number;
    truncatedSnippetCount: number;
  };
  snippets: SourceSnippet[];
};

type GeneratedPresentationResult = JsonRecord & {
  retrieval?: {
    snippets?: SourceSnippet[];
  };
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

type GeneratedPlanOptions = {
  sourceText?: string;
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

function parseMockRequestBody(init: RequestInit | undefined): JsonRecord {
  const body = init?.body;
  if (typeof body !== "string") {
    throw new Error("mocked LLM request should provide a JSON string body");
  }
  const parsed: unknown = JSON.parse(body);
  if (!isJsonRecord(parsed)) {
    throw new Error("mocked LLM request body should parse to an object");
  }
  return parsed;
}

function parseMockChatRequest(init: RequestInit | undefined): MockChatRequest {
  const body = parseMockRequestBody(init);
  const responseFormat = body.response_format;
  if (!isJsonRecord(responseFormat)) {
    throw new Error("mocked LLM request should include response_format");
  }
  const jsonSchema = responseFormat.json_schema;
  if (!isJsonRecord(jsonSchema) || typeof jsonSchema.name !== "string") {
    throw new Error("mocked LLM request should include a schema name");
  }
  if (!Array.isArray(body.messages)) {
    throw new Error("mocked LLM request should include messages");
  }

  return {
    ...body,
    messages: body.messages.map((message: unknown) => {
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
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [
          {
            delta: {
              content
            },
            finish_reason: null
          }
        ],
        id: "chatcmpl-generation-context",
        model: "semantic-coverage-model"
      })}\n\n`));
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

function collectGeneratedVisibleText(slideSpecs: GeneratedSlideSpec[]): string[] {
  return slideSpecs.flatMap((slideSpec: GeneratedSlideSpec) => [
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle,
    ...(slideSpec.cards || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.signals || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.guardrails || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.bullets || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.resources || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body])
  ].filter((value): value is string => Boolean(value)));
}

function createContextPresentation(suffix: string): ContextPresentation {
  const presentation = createPresentation({
    audience: "Generation context validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise source and material generation context services.",
    title: `Generation Context ${Date.now()} ${suffix}`
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
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : (["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5] ?? "context");
    const label = `${title} ${index + 1}`;
    const sourceBody = options.sourceText && index === 1 ? options.sourceText : `${label} carries generated draft content.`;

    return withVisiblePlanFields({
      keyPoints: [
        { body: sourceBody, title: `${label} point A` },
        { body: `${label} adds a second distinct idea.`, title: `${label} point B` },
        { body: `${label} adds a third distinct idea.`, title: `${label} point C` },
        { body: `${label} adds a fourth distinct idea.`, title: `${label} point D` }
      ],
      role,
      summary: `${label} summarizes one useful generated idea.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content"
    }, {
      eyebrow: isFirst ? "Opening" : isLast ? "Close" : `Section ${index + 1}`,
      guardrailsTitle: `${label} checks`,
      note: `${label} has a speaker note.`,
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

function restoreLlmEnvironment(): void {
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

test.after(() => {
  cleanupContextPresentations();
  global.fetch = originalFetch;
  restoreLlmEnvironment();
});

test("presentation sources are presentation-scoped and retrieved during LLM generation", async () => {
  const presentation = createContextPresentation("sources");
  const paths = getPresentationPaths(presentation.id);

  const source = await createSource({
    text: [
      "HTMX swaps HTML fragments into the page so the server can own more interface behavior.",
      "Progressive enhancement remains practical because plain HTML forms and links can keep working."
    ].join(" "),
    title: "HTMX implementation notes"
  });
  const duplicateSource = await createSource({
    text: "HTMX swaps HTML fragments into the page so the server can own more interface behavior.",
    title: "Duplicate HTMX notes"
  });

  assert.ok(fs.existsSync(paths.sourcesFile), "sources should persist beside the active presentation state");
  assert.equal(listSources().length, 2, "created sources should be listed for the active presentation");

  const snippets: SourceSnippet[] = retrieveSourceSnippets("HTMX HTML fragments progressive enhancement", { limit: 4 });
  assert.equal(snippets[0]?.sourceId, source.id, "retrieval should return matching source snippets");
  assert.match(snippets[0]?.text || "", /HTML fragments/, "retrieved snippet should carry grounded source text");
  assert.equal(
    new Set(snippets.map((snippet: SourceSnippet) => snippet.text)).size,
    snippets.length,
    "retrieval should suppress duplicate chunks"
  );

  const budgetedContext: GenerationSourceContext = getGenerationSourceContext({
    includeActiveSources: false,
    presentationSources: [{
      text: Array.from({ length: 10 }, (_unused, index) => (
        `HTMX fragment budget ${index + 1}. ${"Detailed retrieval material for prompt budgeting. ".repeat(18)}`
      )).join("\n\n"),
      title: "Budget source"
    }],
    title: "HTMX fragment budget"
  });
  assert.ok(budgetedContext.snippets.length <= 6, "generation source context should cap prompt snippets");
  assert.ok(budgetedContext.budget.promptCharCount <= budgetedContext.budget.maxPromptChars, "generation source context should cap prompt source characters");
  assert.ok(
    budgetedContext.snippets.every((snippet: SourceSnippet) => snippet.text.length <= budgetedContext.budget.maxSnippetChars),
    "generation source context should cap each snippet excerpt"
  );
  assert.ok(
    budgetedContext.budget.truncatedSnippetCount > 0 || budgetedContext.budget.omittedSnippetCount > 0,
    "generation source context should report source prompt budget pressure"
  );
  const slideBudgetedContext: GenerationSourceContext = getGenerationSourceContext({
    includeActiveSources: false,
    presentationSources: [{
      text: Array.from({ length: 8 }, (_unused, index) => (
        `Slide-specific HTMX budget ${index + 1}. ${"Focused slide retrieval material. ".repeat(20)}`
      )).join("\n\n"),
      title: "Slide budget source"
    }],
    slideIntent: "Explain HTMX fragment swaps",
    slideKeyMessage: "HTML fragments keep server owned behavior",
    slideSourceNotes: "Use HTMX fragment material",
    slideTitle: "Fragment swaps",
    workflow: "slideDrafting"
  });
  assert.ok(slideBudgetedContext.snippets.length <= 4, "slide drafting should use a smaller source snippet budget");
  assert.ok(slideBudgetedContext.budget.maxPromptChars < budgetedContext.budget.maxPromptChars, "slide drafting should use a smaller source prompt budget than deck planning");
  deleteSource(duplicateSource.id);

  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  let generationRequestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = parseMockChatRequest(init);
    generationRequestCount += 1;
    const schemaName = requestBody.response_format.json_schema.name;

    if (generationRequestCount <= 2) {
      assert.match(requestBody.messages[1]?.content || "", /HTML fragments/);
    } else {
      assert.doesNotMatch(requestBody.messages[1]?.content || "", /HTML fragments/);
    }

    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Intro to HTMX", generationRequestCount <= 2 ? 5 : 3));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    if (generationRequestCount <= 2) {
      return createLmStudioStreamResponse(createGeneratedPlan("Intro to HTMX", 5, {
        sourceText: "HTMX swaps HTML fragments into the page."
      }));
    }

    return createLmStudioStreamResponse(createGeneratedPlan("Intro to HTMX", 3));
  };

  const generated: GeneratedPresentationResult = await generateInitialPresentation({
    objective: "Explain how HTMX handles HTML fragment swaps.",
    targetSlideCount: 5,
    title: "Intro to HTMX"
  });
  const visibleText = collectGeneratedVisibleText(generated.slideSpecs);

  assert.equal(generated.retrieval?.snippets?.[0]?.sourceId, source.id, "generation should report the retrieved source metadata");
  assert.ok(
    visibleText.some((value) => /HTML fragments/i.test(String(value))),
    "LLM generation should receive retrieved source snippets as candidate content"
  );

  const generatedWithoutActiveSources: GeneratedPresentationResult = await generateInitialPresentation({
    includeActiveSources: false,
    objective: "Explain how HTMX handles HTML fragment swaps.",
    targetSlideCount: 3,
    title: "Intro to HTMX"
  });
  assert.equal(
    generatedWithoutActiveSources.retrieval?.snippets?.length,
    0,
    "new presentation generation can opt out of previously active presentation sources"
  );

  global.fetch = originalFetch;
  restoreLlmEnvironment();

  await assert.rejects(
    () => createSource({ url: "http://localhost/source.html" }),
    /local host/,
    "source URL fetching should reject local hosts before making a request"
  );

  deleteSource(source.id);
  assert.equal(listSources().length, 0, "deleted sources should be removed from the active presentation");
});
