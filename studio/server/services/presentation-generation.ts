// Staged presentation generation owns outline planning, slide drafting, local fallback
// materialization, and generation repair. Keep model output as candidate data; local
// validation and presentation write paths remain authoritative.
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { getGenerationMaterialContext } from "./materials.ts";
import { preserveApprovedSlideTypes } from "./generated-plan-repair.ts";
import { semanticallyRepairPlanText } from "./generated-text-repair.ts";
import { collectDeckPlanIssues, isDeckPlanSlide, normalizeDeckPlanForValidation, validateDeckPlan } from "./generated-deck-plan-validation.ts";
import { createDraftedSlidePromptContext, createGeneratedSlideContexts, createSingleSlideDeckPlan, createSingleSlidePromptContext, filterGeneratedPlanSlides } from "./generated-deck-context.ts";
import { buildDeckPlanPromptRequest, buildDeckPlanRepairPromptRequest, buildSlidePlanPromptRequest } from "./generated-prompting.ts";
import { dedupeRetrievalSnippets, serializeRetrievalSnippet, summarizeCombinedSourceBudget } from "./generated-retrieval-summary.ts";
import { materializePlan } from "./generated-slide-materialization.ts";
import { finalizeGeneratedSlideSpecs } from "./generated-slide-quality.ts";
import type { MaterialCandidate } from "./generated-materials.ts";
import type { DeckPlan, DeckPlanSlide } from "./generated-deck-plan-validation.ts";
import type { RetrievalSnippet, SourceBudget, SourceContextWithBudget } from "./generated-retrieval-summary.ts";
import type { GeneratedPlan, GeneratedPlanSlide, GeneratedSlideSpec, JsonObject } from "./generated-slide-types.ts";

const defaultSlideCount = 5;
const maximumSlideCount = 30;

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
  objective?: unknown;
  outline?: unknown;
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
  slideMaterialContext: GenerationContext;
  slideSourceContext: SourceContextWithBudget;
  slideSpec: GeneratedSlideSpec;
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

  return Math.min(Math.max(1, parsed), maximumSlideCount);
}

function extractUrls(value: unknown): string[] {
  return String(value || "").match(/https?:\/\/[^\s),\]]+/g) || [];
}

function collectProvidedUrls(fields: GenerationFields = {}): string[] {
  const sourceUrls = Array.isArray(fields.sourceSnippets)
    ? fields.sourceSnippets.map((snippet) => snippet && snippet.url).filter(Boolean)
    : [];

  return [
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline,
    ...sourceUrls
  ].flatMap(extractUrls);
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

function preserveApprovedOutlineSlideTypes(plan: unknown, deckPlan: DeckPlan): GeneratedPlan {
  const sourcePlan = isJsonObject(plan) ? plan : { slides: [] };
  const generatedSlides = filterGeneratedPlanSlides(sourcePlan.slides);
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];

  return {
    ...sourcePlan,
    slides: preserveApprovedSlideTypes(generatedSlides, deckPlanSlides)
  };
}

function createSlideSourceFields(fields: GenerationFields, planSlide: DeckPlanSlide): GenerationFields {
  const query = [
    planSlide && planSlide.title,
    planSlide && planSlide.intent,
    planSlide && planSlide.value,
    planSlide && planSlide.keyMessage,
    planSlide && (planSlide.sourceNotes || planSlide.sourceNeed)
  ].filter(Boolean).join(" ");

  return {
    ...fields,
    outline: "",
    query,
    slideIntent: planSlide && planSlide.intent || "",
    slideKeyMessage: planSlide && planSlide.keyMessage || "",
    slideSourceNotes: planSlide && (planSlide.sourceNotes || planSlide.sourceNeed) || "",
    slideTitle: planSlide && planSlide.title || "",
    slideValue: planSlide && planSlide.value || "",
    workflow: "slideDrafting"
  };
}

async function createLlmPlan(fields: GenerationFields, slideCount: number, options: LlmPlanOptions = {}): Promise<LlmPlanResponse> {
  const suppliedUrls = collectProvidedUrls(fields);
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
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
      materialPromptText: materialContext.promptText || "",
      singleSlideContext,
      slideCount,
      slideTarget,
      sourcePromptText: sourceContext.promptText || "",
      suppliedUrls
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
  const suppliedUrls = collectProvidedUrls(fields);
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
  const lockedOutlineSlides = Array.isArray(fields.lockedOutlineSlides) ? fields.lockedOutlineSlides : [];
  const result = await createStructuredResponse({
    ...buildDeckPlanPromptRequest({
      compactJson,
      fields,
      lockedOutlineSlides,
      materialPromptText: materialContext.promptText || "",
      slideCount,
      sourcePromptText: sourceContext.promptText || "",
      suppliedUrls
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
  const sourceContext = getGenerationSourceContext({
    ...fields,
    workflow: "deckPlanning"
  });
  const materialContext = getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 8,
    query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
  });
  const generationFields = {
    ...fields,
    materialCandidates: materialContext.materials,
    materialContext,
    sourceContext,
    sourceSnippets: sourceContext.snippets
  };
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
    materialContext,
    plan: deckPlanResponse.plan,
    retrieval: {
      budget: sourceContext.budget || null,
      materials: (materialContext.materials || []).map((material: MaterialCandidate) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: (sourceContext.snippets || []).map((snippet: RetrievalSnippet) => ({
        chunkIndex: snippet.chunkIndex,
        sourceId: snippet.sourceId,
        text: snippet.text,
        title: snippet.title,
        url: snippet.url
      }))
    },
    responseId: deckPlanResponse.responseId,
    sourceContext,
    targetSlideCount: slideCount
  };
}

async function generatePresentationFromDeckPlan(fields: GenerationFields = {}, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = deckPlanResponse.generation || resolveGeneration(fields);
  const sourceContext = deckPlanResponse.sourceContext || getGenerationSourceContext({
    ...fields,
    workflow: "deckPlanning"
  });
  const materialContext = deckPlanResponse.materialContext || getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 8,
    query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
  });
  const generationFields = {
    ...fields,
    materialCandidates: materialContext.materials,
    materialContext,
    sourceContext,
    sourceSnippets: sourceContext.snippets
  };

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
    onProgress: fields.onProgress
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
      budget: sourceContext.budget || null,
      materials: (materialContext.materials || []).map((material: MaterialCandidate) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: (sourceContext.snippets || []).map((snippet: RetrievalSnippet) => ({
        chunkIndex: snippet.chunkIndex,
        sourceId: snippet.sourceId,
        text: snippet.text,
        title: snippet.title,
        url: snippet.url
      }))
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
  const slideSourceContext = getGenerationSourceContext(createSlideSourceFields(fields, planSlide));
  const slideMaterialContext = getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 4,
    query: [
      planSlide.title,
      planSlide.intent,
      planSlide.value,
      planSlide.keyMessage,
      planSlide.visualNeed
    ].filter(Boolean).join(" "),
    slideIntent: planSlide.intent || "",
    slideKeyMessage: planSlide.keyMessage || "",
    slideTitle: planSlide.title || "",
    slideValue: planSlide.value || ""
  });
  const slideGenerationFields = {
    ...generationFields,
    materialCandidates: slideMaterialContext.materials,
    materialContext: slideMaterialContext,
    sourceContext: slideSourceContext,
    sourceSnippets: slideSourceContext.snippets
  };
  const singleSlideDeckPlan = createSingleSlideDeckPlan(deckPlan, slideIndex, slideCount);
  const singleSlideContext = createSingleSlidePromptContext(deckPlan, slideIndex, slideCount);
  const response = await createLlmPlan(slideGenerationFields, 1, {
    deckPlan: singleSlideDeckPlan,
    onProgress: fields.onProgress,
    singleSlideContext: {
      ...singleSlideContext,
      alreadyDraftedSlides: createDraftedSlidePromptContext(previousSlideSpecs)
    },
    slideTarget: {
      intent: planSlide.intent || "",
      keyMessage: planSlide.keyMessage || "",
      role: planSlide.role || "",
      slideCount,
      slideNumber: slideIndex + 1,
      title: planSlide.title || "",
      type: planSlide.type || "content",
      value: planSlide.value || ""
    }
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

  const [slideSpec] = finalizeGeneratedSlideSpecs(materializePlan(slideGenerationFields, plan, {
    startIndex: slideIndex,
    totalSlides: slideCount,
    usedMaterialIds
  }), {
    onProgress: fields.onProgress
  });
  if (!slideSpec) {
    throw new Error(`Generated slide ${slideIndex + 1} did not produce a slide spec.`);
  }

  return {
    generatedSlide,
    response,
    slideMaterialContext,
    slideSourceContext,
    slideSpec
  };
}

async function generatePresentationFromDeckPlanIncremental(fields: GenerationFields = {}, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse = {}, options: GenerationOptions = {}) {
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];
  const slideCount = deckPlanSlides.length || normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = deckPlanResponse.generation || resolveGeneration(fields);
  const deckLevelSourceContext = deckPlanResponse.sourceContext || getGenerationSourceContext({
    ...fields,
    workflow: "deckPlanning"
  });
  const deckLevelMaterialContext = deckPlanResponse.materialContext || getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 8,
    query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
  });
  const generationFields = {
    ...fields,
    materialCandidates: deckLevelMaterialContext.materials,
    materialContext: deckLevelMaterialContext,
    sourceContext: deckLevelSourceContext,
    sourceSnippets: deckLevelSourceContext.snippets
  };
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Math.max(0, Number(options.startIndex)) : 0;
  const seededSlideSpecs = Array.isArray(options.initialSlideSpecs) ? options.initialSlideSpecs.filter(isGeneratedSlideSpec) : [];
  const seededPlanSlides = filterGeneratedPlanSlides(options.initialGeneratedPlanSlides);
  const slideSpecs: GeneratedSlideSpec[] = startIndex > 0 ? seededSlideSpecs.slice(0, startIndex) : [];
  const generatedPlanSlides: GeneratedPlanSlide[] = startIndex > 0 ? seededPlanSlides.slice(0, startIndex) : [];
  const responses: LlmPlanResponse[] = [];
  const slideSourceContexts: SourceContextWithBudget[] = [];
  const slideMaterialContexts: GenerationContext[] = [];
  const usedMaterialIds = new Set<string>(options.usedMaterialIds instanceof Set ? Array.from(options.usedMaterialIds).filter(Boolean) : []);

  for (let slideIndex = startIndex; slideIndex < slideCount; slideIndex += 1) {
    if (typeof options.shouldStop === "function" && options.shouldStop()) {
      throw createContentRunStoppedError();
    }

    const planSlide = deckPlanSlides[slideIndex] || {};
    if (typeof fields.onProgress === "function") {
      fields.onProgress({
        message: `Drafting slide ${slideIndex + 1}/${slideCount}: ${planSlide.title || `Slide ${slideIndex + 1}`}`,
        slideCount,
        slideIndex: slideIndex + 1,
        stage: "drafting-slide"
      });
    }

    const drafted = await draftSingleSlideFromDeckPlan({
      deckPlan,
      fields,
      generationFields,
      planSlide,
      previousSlideSpecs: slideSpecs,
      slideCount,
      slideIndex,
      usedMaterialIds
    });
    responses.push(drafted.response);
    slideSourceContexts.push(drafted.slideSourceContext);
    slideMaterialContexts.push(drafted.slideMaterialContext);
    generatedPlanSlides.push(drafted.generatedSlide);

    const nextSlideSpecs = finalizeGeneratedSlideSpecs([...slideSpecs, drafted.slideSpec], {
      onProgress: fields.onProgress,
      repairNearbyDuplicateItems: true
    });
    slideSpecs.splice(0, slideSpecs.length, ...nextSlideSpecs);

    if (typeof options.onSlide === "function") {
      await options.onSlide({
        outline: deckPlan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
        slideCount,
        slideContexts: createGeneratedSlideContexts(slideSpecs, { slides: generatedPlanSlides }, deckPlan),
        slideIndex: slideIndex + 1,
        slideSpec: drafted.slideSpec,
        slideSpecs: [...slideSpecs],
        targetSlideCount: slideCount
      });
    }

    if (typeof options.shouldStop === "function" && options.shouldStop()) {
      throw createContentRunStoppedError();
    }
  }

  const lastResponse = responses[responses.length - 1] || null;
  const retrievalSourceContexts = slideSourceContexts.length ? slideSourceContexts : [deckLevelSourceContext];
  const retrievalMaterials = (slideMaterialContexts.length ? slideMaterialContexts : [deckLevelMaterialContext])
    .flatMap((context) => context.materials || []);
  const materialMap = new Map();
  retrievalMaterials.forEach((material) => {
    if (!materialMap.has(material.id)) {
      materialMap.set(material.id, material);
    }
  });
  const retrievalSnippets = dedupeRetrievalSnippets(retrievalSourceContexts.flatMap((context) => context.snippets || []));

  return {
    generation: {
      ...generation,
      deckPlanResponseId: deckPlanResponse.responseId || null,
      model: lastResponse ? lastResponse.model : generation.model,
      provider: lastResponse ? lastResponse.provider : generation.provider,
      responseId: lastResponse ? lastResponse.responseId : null,
      slideResponseIds: responses.map((response) => response.responseId).filter(Boolean)
    },
    retrieval: {
      budget: summarizeCombinedSourceBudget(retrievalSourceContexts),
      materials: Array.from(materialMap.values()).map((material) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: retrievalSnippets.map(serializeRetrievalSnippet)
    },
    deckPlan,
    outline: deckPlan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideContexts: createGeneratedSlideContexts(slideSpecs, { slides: generatedPlanSlides }, deckPlan),
    slideSpecs,
    summary: `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} one at a time with ${lastResponse ? `${lastResponse.provider} ${lastResponse.model}` : "the configured LLM"}.`,
    targetSlideCount: slideCount
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
