// Staged presentation generation owns outline planning, slide drafting, local fallback
// materialization, and generation repair. Keep model output as candidate data; local
// validation and presentation write paths remain authoritative.
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { getGenerationMemoryContext } from "./memory.ts";
import { getGenerationMaterialContext } from "./materials.ts";
import { preserveApprovedSlideTypes } from "./generated-plan-repair.ts";
import { semanticallyRepairPlanText } from "./generated-text-repair.ts";
import { collectDeckPlanIssues, validateDeckPlan } from "./generated-deck-plan-issues.ts";
import { isDeckPlanSlide, normalizeDeckPlanForValidation } from "./generated-deck-plan-normalization.ts";
import { createDraftedSlidePromptContext, createGeneratedSlideContexts, createSingleSlideDeckPlan, createSingleSlidePromptContext, filterGeneratedPlanSlides } from "./generated-deck-context.ts";
import { buildDeckPlanPromptRequest, buildDeckPlanRepairPromptRequest, buildSlidePlanPromptRequest } from "./generated-prompting.ts";
import { dedupeRetrievalSnippets, serializeRetrievalSnippet, summarizeCombinedSourceBudget } from "./generated-retrieval-summary.ts";
import { collectProvidedUrls } from "./generation-source-urls.ts";
import { materializePlan } from "./generated-slide-materialization.ts";
import { finalizeGeneratedSlideSpecs } from "./generated-slide-quality.ts";
import type { MaterialCandidate } from "./generated-materials.ts";
import type { DeckPlan, DeckPlanSlide } from "./generated-deck-plan-types.ts";
import type { RetrievalSnippet, SourceBudget, SourceContextWithBudget } from "./generated-retrieval-summary.ts";
import type { GenerationMemoryContext, MemorySnippet } from "./memory.ts";
import type { GeneratedPlan, GeneratedPlanSlide, GeneratedSlideSpec, JsonObject } from "./generated-slide-types.ts";

const defaultSlideCount = 5;

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
};

type GenerationFields = ProgressOptions & JsonObject & {
  audience?: unknown;
  constraints?: unknown;
  includeActiveMaterials?: unknown;
  includeActiveSources?: unknown;
  lockedOutlineSlides?: unknown[];
  materialCandidates?: MaterialCandidate[] | undefined;
  materialContext?: GenerationContext | undefined;
  memoryContext?: GenerationMemoryContext | undefined;
  objective?: unknown;
  outline?: unknown;
  presentationDensity?: unknown;
  presentationSources?: unknown;
  presentationSourceText?: unknown;
  query?: unknown;
  slideIntent?: unknown;
  slideKeyMessage?: unknown;
  slideSourceNotes?: unknown;
  slideTitle?: unknown;
  slideValue?: unknown;
  sourceContext?: GenerationContext | undefined;
  sourceSnippets?: Array<{ url?: unknown }> | undefined;
  targetCount?: unknown;
  targetSlideCount?: unknown;
};

type GenerationContext = {
  budget?: SourceBudget;
  materials?: MaterialCandidate[];
  promptText?: string;
  snippets?: RetrievalSnippet[];
};

type DeckPlanningContexts = {
  materialContext: GenerationContext;
  memoryContext: GenerationMemoryContext;
  sourceContext: GenerationContext;
};

type PromptContexts = {
  materialPromptText: string;
  memoryPromptText: string;
  sourcePromptText: string;
  suppliedUrls: string[];
};

type GenerationRuntime = {
  model?: unknown;
  provider?: unknown;
};

type GenerationOptions = ProgressOptions & {
  initialGeneratedPlanSlides?: unknown[];
  initialSlideSpecs?: unknown[];
  onSlide?: (payload: unknown) => void;
  shouldStop?: () => boolean;
  startIndex?: unknown;
  totalSlides?: unknown;
  usedMaterialIds?: Set<string>;
};

type DeckPlanResponse = {
  generation?: GenerationRuntime;
  materialContext?: GenerationContext;
  memoryContext?: GenerationMemoryContext;
  model?: unknown;
  plan?: DeckPlan | undefined;
  promptBudget?: unknown;
  provider?: unknown;
  responseId?: unknown;
  sourceContext?: GenerationContext;
};

type LlmPlanResponse = {
  model?: unknown;
  plan: GeneratedPlan;
  promptBudget?: unknown;
  provider?: unknown;
  responseId?: unknown;
};

type LlmPlanOptions = GenerationOptions & {
  deckPlan?: unknown;
  singleSlideContext?: JsonObject | null | undefined;
  slideTarget?: JsonObject | null | undefined;
};

type ContentRunStoppedError = Error & {
  code?: string;
};

type DraftSingleSlideResult = {
  generatedSlide: GeneratedPlanSlide;
  response: LlmPlanResponse;
  slideMemoryContext: GenerationMemoryContext;
  slideMaterialContext: GenerationContext;
  slideSourceContext: SourceContextWithBudget;
  slideSpec: GeneratedSlideSpec;
};

type IncrementalDraftState = {
  contexts: DeckPlanningContexts;
  deckPlanSlides: DeckPlanSlide[];
  generatedPlanSlides: GeneratedPlanSlide[];
  generation: GenerationRuntime;
  generationFields: GenerationFields;
  responses: LlmPlanResponse[];
  slideCount: number;
  slideMaterialContexts: GenerationContext[];
  slideMemoryContexts: GenerationMemoryContext[];
  slideSourceContexts: SourceContextWithBudget[];
  slideSpecs: GeneratedSlideSpec[];
  startIndex: number;
  usedMaterialIds: Set<string>;
};

type IncrementalRetrieval = {
  materialMap: Map<string, MaterialCandidate>;
  memorySnippets: MemorySnippet[];
  memoryContexts: GenerationMemoryContext[];
  sourceContexts: SourceContextWithBudget[];
  sourceSnippets: RetrievalSnippet[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isGeneratedSlideSpec(value: unknown): value is GeneratedSlideSpec {
  return isJsonObject(value);
}

function normalizeSlideCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return defaultSlideCount;
  }

  return Math.max(1, parsed);
}

function resolveGeneration(_options: ProgressOptions = {}) {
  const llmStatus = getLlmStatus();

  if (!llmStatus.available) {
    throw new Error(`LLM presentation generation is required. ${llmStatus.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating a presentation."}`);
  }

  return {
    available: true,
    fallbackReason: null,
    mode: "llm",
    model: llmStatus.model,
    provider: llmStatus.provider
  };
}

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

function emptyMemoryContext(): GenerationMemoryContext {
  return {
    budget: {
      maxPromptChars: 0,
      maxSnippetChars: 0,
      promptChars: 0,
      retrievedCount: 0,
      snippetLimit: 0,
      usedCount: 0
    },
    promptText: "",
    snippets: []
  };
}

function serializeMemorySnippet(snippet: MemorySnippet) {
  return {
    confidence: snippet.confidence,
    detail: snippet.detail,
    evidence: snippet.evidence,
    memoryId: snippet.memoryId,
    score: snippet.score,
    status: snippet.status,
    summary: snippet.summary,
    tags: snippet.tags,
    type: snippet.type
  };
}

function serializeMaterialCandidate(material: MaterialCandidate) {
  return {
    alt: material.alt,
    caption: material.caption,
    id: material.id,
    license: material.license,
    sourceUrl: material.sourceUrl,
    title: material.title,
    url: material.url
  };
}

function createDeckPlanningContexts(
  fields: GenerationFields,
  response: DeckPlanResponse = {}
): DeckPlanningContexts {
  return {
    materialContext: response.materialContext || getGenerationMaterialContext({
      includeActiveMaterials: fields.includeActiveMaterials !== false,
      materials: fields.presentationMaterials,
      maxMaterials: 8,
      query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
    }),
    memoryContext: response.memoryContext || getGenerationMemoryContext({
      ...fields,
      workflow: "deckPlanning"
    }),
    sourceContext: response.sourceContext || getGenerationSourceContext({
      ...fields,
      workflow: "deckPlanning"
    })
  };
}

function createGenerationFields(fields: GenerationFields, contexts: DeckPlanningContexts): GenerationFields {
  return {
    ...fields,
    materialCandidates: contexts.materialContext.materials,
    materialContext: contexts.materialContext,
    memoryContext: contexts.memoryContext,
    sourceContext: contexts.sourceContext,
    sourceSnippets: contexts.sourceContext.snippets
  };
}

function createPromptContexts(fields: GenerationFields): PromptContexts {
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
  const memoryContext = fields.memoryContext || emptyMemoryContext();

  return {
    materialPromptText: materialContext.promptText || "",
    memoryPromptText: memoryContext.promptText || "",
    sourcePromptText: sourceContext.promptText || "",
    suppliedUrls: collectProvidedUrls(fields)
  };
}

function serializeRetrievalContexts(contexts: DeckPlanningContexts): JsonObject {
  return {
    budget: contexts.sourceContext.budget || null,
    memory: (contexts.memoryContext.snippets || []).map(serializeMemorySnippet),
    memoryBudget: contexts.memoryContext.budget || null,
    materials: (contexts.materialContext.materials || []).map(serializeMaterialCandidate),
    snippets: (contexts.sourceContext.snippets || []).map((snippet: RetrievalSnippet) => ({
      chunkIndex: snippet.chunkIndex,
      sourceId: snippet.sourceId,
      text: snippet.text,
      title: snippet.title,
      url: snippet.url
    }))
  };
}

function dedupeMemorySnippets(snippets: MemorySnippet[]): MemorySnippet[] {
  const seen = new Set<string>();
  const deduped: MemorySnippet[] = [];
  snippets.forEach((snippet: MemorySnippet) => {
    if (seen.has(snippet.memoryId)) {
      return;
    }
    seen.add(snippet.memoryId);
    deduped.push(snippet);
  });

  return deduped;
}

function preserveApprovedOutlineSlideTypes(plan: unknown, deckPlan: DeckPlan): GeneratedPlan {
  const sourcePlan = isJsonObject(plan) ? plan : { slides: [] };
  const generatedSlides = filterGeneratedPlanSlides(sourcePlan.slides);
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];

  return {
    ...sourcePlan,
    slides: preserveApprovedSlideTypes(generatedSlides, deckPlanSlides)
  };
}

function compactTextParts(parts: unknown[]): string {
  return parts.filter(Boolean).join(" ");
}

function slideSourceNeed(planSlide: DeckPlanSlide): unknown {
  return planSlide.sourceNotes || planSlide.sourceNeed || "";
}

function createSlideSourceFields(fields: GenerationFields, planSlide: DeckPlanSlide): GenerationFields {
  return {
    ...fields,
    outline: "",
    query: compactTextParts([
      planSlide.title,
      planSlide.intent,
      planSlide.value,
      planSlide.keyMessage,
      slideSourceNeed(planSlide)
    ]),
    slideIntent: planSlide.intent || "",
    slideKeyMessage: planSlide.keyMessage || "",
    slideSourceNotes: slideSourceNeed(planSlide),
    slideTitle: planSlide.title || "",
    slideValue: planSlide.value || "",
    workflow: "slideDrafting"
  };
}

async function createLlmPlan(fields: GenerationFields, slideCount: number, options: LlmPlanOptions = {}): Promise<LlmPlanResponse> {
  const promptContexts = createPromptContexts(fields);
  const deckPlan = validateDeckPlan(
    normalizeDeckPlanForValidation(fields, isJsonObject(options.deckPlan) ? options.deckPlan : { slides: [] }, slideCount),
    slideCount
  );
  const slideTarget = options.slideTarget || null;
  const singleSlideContext = options.singleSlideContext || null;
  const result = await createStructuredResponse({
    ...buildSlidePlanPromptRequest({
      compactJson,
      deckPlan,
      fields,
      materialPromptText: promptContexts.materialPromptText,
      memoryPromptText: promptContexts.memoryPromptText,
      singleSlideContext,
      slideCount,
      slideTarget,
      sourcePromptText: promptContexts.sourcePromptText,
      suppliedUrls: promptContexts.suppliedUrls
    }),
    onProgress: options.onProgress,
  });

  return {
    model: result.model,
    plan: preserveApprovedOutlineSlideTypes(result.data, deckPlan),
    promptBudget: result.promptBudget || null,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function createLlmDeckPlan(fields: GenerationFields, slideCount: number, options: ProgressOptions = {}): Promise<DeckPlanResponse> {
  const promptContexts = createPromptContexts(fields);
  const lockedOutlineSlides = Array.isArray(fields.lockedOutlineSlides) ? fields.lockedOutlineSlides : [];
  const result = await createStructuredResponse({
    ...buildDeckPlanPromptRequest({
      compactJson,
      fields,
      lockedOutlineSlides,
      materialPromptText: promptContexts.materialPromptText,
      memoryPromptText: promptContexts.memoryPromptText,
      slideCount,
      sourcePromptText: promptContexts.sourcePromptText,
      suppliedUrls: promptContexts.suppliedUrls
    }),
    onProgress: options.onProgress,
  });

  return {
    model: result.model,
    plan: await repairDeckPlanIfNeeded(fields, result.data, slideCount, options),
    promptBudget: result.promptBudget || null,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function repairDeckPlanIfNeeded(fields: GenerationFields, plan: unknown, slideCount: number, options: ProgressOptions = {}): Promise<DeckPlan> {
  const normalizedPlan = normalizeDeckPlanForValidation(fields, plan, slideCount);
  const issues = collectDeckPlanIssues(normalizedPlan, slideCount);
  if (!issues.length) {
    return validateDeckPlan(normalizedPlan, slideCount);
  }

  if (typeof options.onProgress === "function") {
    options.onProgress({
      message: `Repairing deck outline before slide drafting (${issues.length} issue${issues.length === 1 ? "" : "s"}).`,
      stage: "deck-plan-repair"
    });
  }

  const result = await createStructuredResponse({
    ...buildDeckPlanRepairPromptRequest({
      compactJson,
      fields,
      issues,
      normalizedPlan,
      slideCount
    }),
    onProgress: options.onProgress,
  });

  return validateDeckPlan(normalizeDeckPlanForValidation(fields, result.data, slideCount), slideCount);
}

async function generateInitialPresentation(fields: GenerationFields = {}) {
  const deckPlanResponse = await generateInitialDeckPlan(fields);
  const generated = await generatePresentationFromDeckPlan(fields, deckPlanResponse.plan || { slides: [] }, deckPlanResponse);

  return generated;
}

async function generateInitialDeckPlan(fields: GenerationFields = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = resolveGeneration(fields);
  const contexts = createDeckPlanningContexts(fields);
  const generationFields = createGenerationFields(fields, contexts);
  if (typeof fields.onProgress === "function") {
    fields.onProgress({
      message: "Planning deck structure with the LLM...",
      stage: "planning-deck"
    });
  }
  const deckPlanResponse = await createLlmDeckPlan(generationFields, slideCount, {
    onProgress: fields.onProgress
  });

  return {
    generation,
    materialContext: contexts.materialContext,
    plan: deckPlanResponse.plan,
    retrieval: serializeRetrievalContexts(contexts),
    responseId: deckPlanResponse.responseId,
    memoryContext: contexts.memoryContext,
    sourceContext: contexts.sourceContext,
    targetSlideCount: slideCount
  };
}

async function generatePresentationFromDeckPlan(fields: GenerationFields = {}, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = deckPlanResponse.generation || resolveGeneration(fields);
  const contexts = createDeckPlanningContexts(fields, deckPlanResponse);
  const generationFields = createGenerationFields(fields, contexts);

  if (typeof fields.onProgress === "function") {
    fields.onProgress({
      message: "Drafting slide details from the approved deck plan...",
      stage: "drafting-slides"
    });
  }
  const response = await createLlmPlan(generationFields, slideCount, {
    deckPlan,
    onProgress: fields.onProgress
  });
  const repairedPlan = await semanticallyRepairPlanText(response.plan, {
    onProgress: fields.onProgress
  });
  const plan = preserveApprovedOutlineSlideTypes(repairedPlan, deckPlan);
  const slideSpecs = finalizeGeneratedSlideSpecs(materializePlan(generationFields, plan), {
    onProgress: fields.onProgress,
    repairNearbyDuplicateItems: true
  });

  return {
    generation: {
      ...generation,
      deckPlanResponseId: deckPlanResponse.responseId || null,
      model: response ? response.model : generation.model,
      provider: response ? response.provider : generation.provider,
      responseId: response ? response.responseId : null
    },
    retrieval: {
      ...serializeRetrievalContexts(contexts)
    },
    deckPlan,
    outline: deckPlan.outline || plan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideContexts: createGeneratedSlideContexts(slideSpecs, plan, deckPlan),
    slideSpecs,
    summary: `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with ${response.provider} ${response.model}.`,
    targetSlideCount: slideCount
  };
}

function createContentRunStoppedError() {
  const error: ContentRunStoppedError = new Error("Slide generation stopped.");
  error.code = "CONTENT_RUN_STOPPED";
  return error;
}

function shouldStopContentRun(options: GenerationOptions): boolean {
  return typeof options.shouldStop === "function" && options.shouldStop();
}

function resolveIncrementalStartIndex(options: GenerationOptions): number {
  return Number.isFinite(Number(options.startIndex)) ? Math.max(0, Number(options.startIndex)) : 0;
}

function createUsedMaterialIdSet(options: GenerationOptions): Set<string> {
  if (!(options.usedMaterialIds instanceof Set)) {
    return new Set<string>();
  }

  return new Set<string>(Array.from(options.usedMaterialIds).filter(Boolean));
}

function createIncrementalDraftState(
  fields: GenerationFields,
  deckPlan: DeckPlan,
  deckPlanResponse: DeckPlanResponse,
  options: GenerationOptions
): IncrementalDraftState {
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];
  const slideCount = deckPlanSlides.length || normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const contexts = createDeckPlanningContexts(fields, deckPlanResponse);
  const startIndex = resolveIncrementalStartIndex(options);
  const seededSlideSpecs = Array.isArray(options.initialSlideSpecs) ? options.initialSlideSpecs.filter(isGeneratedSlideSpec) : [];
  const seededPlanSlides = filterGeneratedPlanSlides(options.initialGeneratedPlanSlides);

  return {
    contexts,
    deckPlanSlides,
    generatedPlanSlides: startIndex > 0 ? seededPlanSlides.slice(0, startIndex) : [],
    generation: deckPlanResponse.generation || resolveGeneration(fields),
    generationFields: createGenerationFields(fields, contexts),
    responses: [],
    slideCount,
    slideMaterialContexts: [],
    slideMemoryContexts: [],
    slideSourceContexts: [],
    slideSpecs: startIndex > 0 ? seededSlideSpecs.slice(0, startIndex) : [],
    startIndex,
    usedMaterialIds: createUsedMaterialIdSet(options)
  };
}

function reportIncrementalDraftProgress(
  fields: GenerationFields,
  planSlide: DeckPlanSlide,
  slideIndex: number,
  slideCount: number
): void {
  if (typeof fields.onProgress !== "function") {
    return;
  }

  fields.onProgress({
    message: `Drafting slide ${slideIndex + 1}/${slideCount}: ${planSlide.title || `Slide ${slideIndex + 1}`}`,
    slideCount,
    slideIndex: slideIndex + 1,
    stage: "drafting-slide"
  });
}

function appendIncrementalDraft(state: IncrementalDraftState, drafted: DraftSingleSlideResult, fields: GenerationFields): void {
  state.responses.push(drafted.response);
  state.slideSourceContexts.push(drafted.slideSourceContext);
  state.slideMemoryContexts.push(drafted.slideMemoryContext);
  state.slideMaterialContexts.push(drafted.slideMaterialContext);
  state.generatedPlanSlides.push(drafted.generatedSlide);

  const nextSlideSpecs = finalizeGeneratedSlideSpecs([...state.slideSpecs, drafted.slideSpec], {
    onProgress: fields.onProgress,
    repairNearbyDuplicateItems: true
  });
  state.slideSpecs.splice(0, state.slideSpecs.length, ...nextSlideSpecs);
}

async function emitIncrementalSlideProgress(
  options: GenerationOptions,
  deckPlan: DeckPlan,
  state: IncrementalDraftState,
  drafted: DraftSingleSlideResult,
  slideIndex: number
): Promise<void> {
  if (typeof options.onSlide !== "function") {
    return;
  }

  await options.onSlide({
    outline: deckPlan.outline || state.slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideCount: state.slideCount,
    slideContexts: createGeneratedSlideContexts(state.slideSpecs, { slides: state.generatedPlanSlides }, deckPlan),
    slideIndex: slideIndex + 1,
    slideSpec: drafted.slideSpec,
    slideSpecs: [...state.slideSpecs],
    targetSlideCount: state.slideCount
  });
}

function createSlideMaterialContext(fields: GenerationFields, planSlide: DeckPlanSlide): GenerationContext {
  return getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 4,
    query: compactTextParts([
      planSlide.title,
      planSlide.intent,
      planSlide.value,
      planSlide.keyMessage,
      planSlide.visualNeed
    ]),
    slideIntent: planSlide.intent || "",
    slideKeyMessage: planSlide.keyMessage || "",
    slideTitle: planSlide.title || "",
    slideValue: planSlide.value || ""
  });
}

function createSlideGenerationFields(
  generationFields: GenerationFields,
  slideMaterialContext: GenerationContext,
  slideMemoryContext: GenerationMemoryContext,
  slideSourceContext: SourceContextWithBudget
): GenerationFields {
  return {
    ...generationFields,
    materialCandidates: slideMaterialContext.materials,
    materialContext: slideMaterialContext,
    memoryContext: slideMemoryContext,
    sourceContext: slideSourceContext,
    sourceSnippets: slideSourceContext.snippets
  };
}

function createSlideTarget(planSlide: DeckPlanSlide, slideIndex: number, slideCount: number): JsonObject {
  return {
    intent: planSlide.intent || "",
    keyMessage: planSlide.keyMessage || "",
    role: planSlide.role || "",
    slideCount,
    slideNumber: slideIndex + 1,
    title: planSlide.title || "",
    type: planSlide.type || "content",
    value: planSlide.value || ""
  };
}

async function createSingleSlidePlanResponse(params: {
  deckPlan: DeckPlan;
  fields: GenerationFields;
  planSlide: DeckPlanSlide;
  previousSlideSpecs: GeneratedSlideSpec[];
  slideCount: number;
  slideGenerationFields: GenerationFields;
  slideIndex: number;
}): Promise<{
  generatedSlide: GeneratedPlanSlide;
  plan: GeneratedPlan;
  response: LlmPlanResponse;
}> {
  const {
    deckPlan,
    fields,
    planSlide,
    previousSlideSpecs,
    slideCount,
    slideGenerationFields,
    slideIndex
  } = params;
  const singleSlideDeckPlan = createSingleSlideDeckPlan(deckPlan, slideIndex, slideCount);
  const singleSlideContext = createSingleSlidePromptContext(deckPlan, slideIndex, slideCount);
  const response = await createLlmPlan(slideGenerationFields, 1, {
    deckPlan: singleSlideDeckPlan,
    onProgress: fields.onProgress,
    singleSlideContext: {
      ...singleSlideContext,
      alreadyDraftedSlides: createDraftedSlidePromptContext(previousSlideSpecs)
    },
    slideTarget: createSlideTarget(planSlide, slideIndex, slideCount)
  });
  const repairedPlan = await semanticallyRepairPlanText(response.plan, {
    onProgress: fields.onProgress
  });
  const plan = preserveApprovedOutlineSlideTypes(repairedPlan, singleSlideDeckPlan);
  const generatedSlides = filterGeneratedPlanSlides(plan.slides);
  if (generatedSlides.length !== 1) {
    throw new Error(`Generated slide ${slideIndex + 1} returned ${generatedSlides.length} slides instead of one.`);
  }

  const generatedSlide = generatedSlides[0];
  if (!generatedSlide) {
    throw new Error(`Generated slide ${slideIndex + 1} did not include plan data.`);
  }

  return {
    generatedSlide,
    plan,
    response
  };
}

function materializeSingleSlideSpec(
  fields: GenerationFields,
  plan: GeneratedPlan,
  slideIndex: number,
  slideCount: number,
  usedMaterialIds: Set<string>
): GeneratedSlideSpec {
  const [slideSpec] = finalizeGeneratedSlideSpecs(materializePlan(fields, plan, {
    startIndex: slideIndex,
    totalSlides: slideCount,
    usedMaterialIds
  }), {
    onProgress: fields.onProgress
  });
  if (!slideSpec) {
    throw new Error(`Generated slide ${slideIndex + 1} did not produce a slide spec.`);
  }

  return slideSpec;
}

async function draftSingleSlideFromDeckPlan(params: {
  deckPlan: DeckPlan;
  fields: GenerationFields;
  generationFields: GenerationFields;
  planSlide: DeckPlanSlide;
  previousSlideSpecs?: GeneratedSlideSpec[];
  slideCount: number;
  slideIndex: number;
  usedMaterialIds: Set<string>;
}): Promise<DraftSingleSlideResult> {
  const {
    deckPlan,
    fields,
    generationFields,
    planSlide,
    previousSlideSpecs = [],
    slideCount,
    slideIndex,
    usedMaterialIds
  } = params;
  const slideContextFields = createSlideSourceFields(fields, planSlide);
  const slideSourceContext = getGenerationSourceContext(slideContextFields);
  const slideMemoryContext = getGenerationMemoryContext(slideContextFields);
  const slideMaterialContext = createSlideMaterialContext(fields, planSlide);
  const slideGenerationFields = createSlideGenerationFields(
    generationFields,
    slideMaterialContext,
    slideMemoryContext,
    slideSourceContext
  );
  const singleSlidePlan = await createSingleSlidePlanResponse({
    deckPlan,
    fields,
    planSlide,
    previousSlideSpecs,
    slideCount,
    slideGenerationFields,
    slideIndex
  });

  return {
    generatedSlide: singleSlidePlan.generatedSlide,
    response: singleSlidePlan.response,
    slideMemoryContext,
    slideMaterialContext,
    slideSourceContext,
    slideSpec: materializeSingleSlideSpec(slideGenerationFields, singleSlidePlan.plan, slideIndex, slideCount, usedMaterialIds)
  };
}

async function draftIncrementalSlides(
  fields: GenerationFields,
  deckPlan: DeckPlan,
  options: GenerationOptions,
  state: IncrementalDraftState
): Promise<void> {
  for (let slideIndex = state.startIndex; slideIndex < state.slideCount; slideIndex += 1) {
    if (shouldStopContentRun(options)) {
      throw createContentRunStoppedError();
    }

    const planSlide = state.deckPlanSlides[slideIndex] || {};
    reportIncrementalDraftProgress(fields, planSlide, slideIndex, state.slideCount);

    const drafted = await draftSingleSlideFromDeckPlan({
      deckPlan,
      fields,
      generationFields: state.generationFields,
      planSlide,
      previousSlideSpecs: state.slideSpecs,
      slideCount: state.slideCount,
      slideIndex,
      usedMaterialIds: state.usedMaterialIds
    });
    appendIncrementalDraft(state, drafted, fields);
    await emitIncrementalSlideProgress(options, deckPlan, state, drafted, slideIndex);

    if (shouldStopContentRun(options)) {
      throw createContentRunStoppedError();
    }
  }
}

function createIncrementalRetrieval(state: IncrementalDraftState): IncrementalRetrieval {
  const sourceContexts = state.slideSourceContexts.length ? state.slideSourceContexts : [state.contexts.sourceContext];
  const memoryContexts = state.slideMemoryContexts.length ? state.slideMemoryContexts : [state.contexts.memoryContext];
  const retrievalMaterials = (state.slideMaterialContexts.length ? state.slideMaterialContexts : [state.contexts.materialContext])
    .flatMap((context) => context.materials || []);

  const materialMap = new Map<string, MaterialCandidate>();
  retrievalMaterials.forEach((material) => {
    if (!materialMap.has(material.id)) {
      materialMap.set(material.id, material);
    }
  });

  return {
    materialMap,
    memoryContexts,
    memorySnippets: dedupeMemorySnippets(memoryContexts.flatMap((context) => context.snippets || [])),
    sourceContexts,
    sourceSnippets: dedupeRetrievalSnippets(sourceContexts.flatMap((context) => context.snippets || []))
  };
}

function createIncrementalGenerationSummary(state: IncrementalDraftState, deckPlanResponse: DeckPlanResponse): JsonObject {
  const lastResponse = state.responses[state.responses.length - 1] || null;

  return {
    ...state.generation,
    deckPlanResponseId: deckPlanResponse.responseId || null,
    model: lastResponse ? lastResponse.model : state.generation.model,
    provider: lastResponse ? lastResponse.provider : state.generation.provider,
    responseId: lastResponse ? lastResponse.responseId : null,
    slideResponseIds: state.responses.map((response) => response.responseId).filter(Boolean)
  };
}

function createIncrementalRetrievalSummary(retrieval: IncrementalRetrieval): JsonObject {
  return {
    budget: summarizeCombinedSourceBudget(retrieval.sourceContexts),
    memory: retrieval.memorySnippets.map(serializeMemorySnippet),
    memoryBudget: {
      promptChars: retrieval.memoryContexts.reduce((total: number, context: GenerationMemoryContext) => total + context.budget.promptChars, 0),
      retrievedCount: retrieval.memoryContexts.reduce((total: number, context: GenerationMemoryContext) => total + context.budget.retrievedCount, 0),
      usedCount: retrieval.memorySnippets.length
    },
    materials: Array.from(retrieval.materialMap.values()).map(serializeMaterialCandidate),
    snippets: retrieval.sourceSnippets.map(serializeRetrievalSnippet)
  };
}

async function generatePresentationFromDeckPlanIncremental(fields: GenerationFields = {}, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse = {}, options: GenerationOptions = {}) {
  const state = createIncrementalDraftState(fields, deckPlan, deckPlanResponse, options);

  await draftIncrementalSlides(fields, deckPlan, options, state);

  const lastResponse = state.responses[state.responses.length - 1] || null;
  const retrieval = createIncrementalRetrieval(state);

  return {
    generation: createIncrementalGenerationSummary(state, deckPlanResponse),
    retrieval: createIncrementalRetrievalSummary(retrieval),
    deckPlan,
    outline: deckPlan.outline || state.slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideContexts: createGeneratedSlideContexts(state.slideSpecs, { slides: state.generatedPlanSlides }, deckPlan),
    slideSpecs: state.slideSpecs,
    summary: `Generated ${state.slideSpecs.length} initial slide${state.slideSpecs.length === 1 ? "" : "s"} one at a time with ${lastResponse ? `${lastResponse.provider} ${lastResponse.model}` : "the configured LLM"}.`,
    targetSlideCount: state.slideCount
  };
}

export {
  generateInitialDeckPlan,
  generateInitialPresentation,
  generatePresentationFromDeckPlan,
  generatePresentationFromDeckPlanIncremental,
  materializePlan,
  normalizeSlideCount
};
