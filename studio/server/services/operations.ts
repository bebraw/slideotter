// Browser workflow operations coordinate candidate generation, previews, compare
// state, and explicit apply actions. Keep file writes behind service helpers and
// preserve the candidate boundary for LLM-backed workflows.
import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray,
  compactSentence as sentence,
  normalizeSentence
} from "../../shared/json-utils.ts";
import { buildAndRenderDeck } from "./build.ts";
import { normalizeVisualTheme } from "./deck-theme.ts";
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { buildDeckStructurePrompts, buildDrillWordingPrompts, buildIdeateSlidePrompts, buildIdeateThemePrompts, buildRedoLayoutPrompts } from "./llm/prompts.ts";
import { getDeckStructureResponseSchema, getIdeateSlideResponseSchema, getRedoLayoutResponseSchema, getThemeResponseSchema } from "./llm/schemas.ts";
import { validateSlideSpecInDom } from "./dom-validate.ts";
import {
  createGeneratedLayoutDefinition,
  createSlotRegionLayoutDefinition,
  describeLayoutDefinition,
  validateCustomLayoutDefinitionForSlide
} from "./generated-layout-definitions.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { getDeckContext } from "./state.ts";
import { createStructuredSlide, getSlide, readSlideSpec, writeSlideSpec } from "./slides.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import {
  collectStructureContext,
  createLocalFamilyChangeCandidates,
  createLocalStructureCandidates,
  firstFamilyChangeText,
  type StructureContext
} from "./local-slide-structure-candidates.ts";
import {
  createLibraryLayoutCandidates,
  createSameFamilyLayoutIntentSpec
} from "./local-layout-candidates.ts";
import {
  createSelectionApplyScope,
  describeSelectionScope,
  getPathValue,
  getSelectionEntries,
  mergeCandidateIntoSelectionScope
} from "./selection-scope.ts";
import { renderDeckStructureCandidatePreview } from "./deck-structure-preview.ts";
import { materializeCandidatesToVariants } from "./generated-variant-materialization.ts";
import {
  createCheckRemediationCandidates,
  issueRule,
  type CheckRemediationIssue
} from "./check-remediation-candidates.ts";
import { collectDeckStructureContext } from "./deck-structure-context.ts";
import { type DeckPlanEntry } from "./deck-structure-plan-construction.ts";
import { createDeckStructureCandidateFromLlmIntent } from "./deck-structure-llm-candidates.ts";
import { createLocalDeckStructureCandidates } from "./deck-structure-local-candidates.ts";
import {
  applyCandidateSlideDefaults,
  serializeSlideSpec,
  validateGeneratedVariantSlideSpec
} from "./generated-variant-safety.ts";

const ideateSlideLocks = new Set<string>();
const defaultCandidateCount = 5;
const minimumCandidateCount = 1;
const maximumCandidateCount = 8;

type JsonObject = Record<string, unknown>;

type SlideSpec = JsonObject;

type SlideRecord = JsonObject & {
  id: string;
  index?: number;
  path?: string;
  title?: string;
  type?: string;
};

type PromptSlide = {
  id: string;
  title: string;
};

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

type Candidate = JsonObject & {
  changeScope?: string;
  changeSummary?: string[];
  label: string;
  notes?: unknown;
  promptSummary?: unknown;
  remediationStrategy?: string;
  slideSpec: SlideSpec;
  sourceIssues?: JsonObject[];
};

type DeckStructureCandidate = JsonObject & {
  deckPatch?: unknown;
  id: string;
  label: string;
  outline?: unknown;
  preview?: JsonObject;
  slides: DeckPlanEntry[];
  summary?: unknown;
};

type OperationOptions = JsonObject & {
  baseSlideSpec?: unknown;
  candidateCount?: unknown;
  command?: unknown;
  dryRun?: unknown;
  labelFormatter?: (label: string) => string;
  layoutDefinition?: unknown;
  layoutTreatment?: unknown;
  multiSlidePreview?: unknown;
  notes?: unknown;
  onProgress?: ((progress: JsonObject) => void) | undefined;
  operation?: string;
  promoteIndices?: unknown;
  promoteInsertions?: unknown;
  promoteRemovals?: unknown;
  promoteReplacements?: unknown;
  promoteTitles?: unknown;
  selectionScope?: unknown;
};

type CheckRemediationOptions = OperationOptions & {
  blockName?: unknown;
  issue?: unknown;
  issueIndex?: unknown;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toPromptSlide(slide: SlideRecord): PromptSlide {
  return {
    id: slide.id,
    title: textValue(slide.title, `Slide ${slide.index || ""}`.trim() || slide.id)
  };
}

function reportProgress(options: OperationOptions, progress: JsonObject): void {
  if (typeof options.onProgress === "function") {
    options.onProgress(progress);
  }
}

function normalizeCandidateCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return defaultCandidateCount;
  }

  return Math.min(maximumCandidateCount, Math.max(minimumCandidateCount, parsed));
}

function normalizeLayoutTreatment(value: unknown): string {
  const treatment = String(value || "").trim().toLowerCase();
  return treatment === "default" || !treatment ? "standard" : treatment;
}

function getLocalGenerationStatus() {
  return {
    available: false,
    fallbackReason: null,
    mode: "local",
    model: null,
    provider: "local"
  };
}

function resolveGeneration() {
  const llmStatus = getLlmStatus();
  if (!llmStatus.available) {
    throw new Error(`LLM generation is not configured. ${llmStatus.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating variants."}`);
  }

  return {
    available: true,
    fallbackReason: null,
    mode: "llm",
    model: llmStatus.model,
    provider: llmStatus.provider
  };
}

function describeVariantPersistence(_options: OperationOptions = {}): string {
  return "Generated as a session-only candidate; apply one to update the slide.";
}

async function createLlmThemeCandidates(slide: SlideRecord, slideType: unknown, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
  const count = normalizeCandidateCount(candidateCount);
  const promptSlideType = textValue(slideType, "body");
  const prompts = buildIdeateThemePrompts({
    candidateCount: count,
    context,
    currentTheme: context && context.deck ? context.deck.visualTheme : null,
    slide: toPromptSlide(slide),
    slideType: promptSlideType,
    source: textValue(source)
  });
  const result = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    onProgress: options.onProgress,
    promptContext: {
      workflowName: "theme-variant"
    },
    schema: getThemeResponseSchema(promptSlideType, count),
    schemaName: `ideate_theme_${promptSlideType}_candidates`,
    userPrompt: prompts.userPrompt,
    maxOutputTokens: Math.max(4200, count * 2200)
  });

  const data = asJsonObject(result.data);
  if (!Array.isArray(data.candidates) || data.candidates.length !== count) {
    throw new Error(`LLM theme ideation did not return ${count} structured candidates`);
  }

  return data.candidates.map((candidate: unknown) => {
    const sourceCandidate = asJsonObject(candidate);
    const contextPatch = asJsonObject(sourceCandidate.contextPatch);
    return {
    changeSummary: [
      ...(Array.isArray(sourceCandidate.changeSummary) ? sourceCandidate.changeSummary.map((entry: unknown) => String(entry)).slice(0, 3) : []),
      describeVariantPersistence(options)
    ],
    contextPatch: Object.keys(contextPatch).length ? contextPatch : null,
    generator: "llm",
    label: String(sourceCandidate.label || "Theme candidate"),
    model: result.model,
    notes: Object.keys(contextPatch).length && contextPatch.rationale
      ? `${sourceCandidate.notes || ""} Context patch proposed: ${contextPatch.rationale}`
      : String(sourceCandidate.notes || ""),
    promptSummary: String(sourceCandidate.promptSummary || ""),
    provider: result.provider,
    slideSpec: validateGeneratedVariantSlideSpec(sourceCandidate.slideSpec, "LLM theme candidate"),
    visualTheme: normalizeVisualTheme(sourceCandidate.visualTheme)
  };
  }).map((candidate: Candidate) => {
    if (candidate.slideSpec.type !== promptSlideType) {
      throw new Error(`LLM returned slide spec type "${candidate.slideSpec.type}" for "${promptSlideType}" theme candidate`);
    }

    return candidate;
  });
}

async function createLlmIdeateCandidates(slide: SlideRecord, slideType: unknown, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
  const count = normalizeCandidateCount(candidateCount);
  const promptSlideType = textValue(slideType, "body");
  const prompts = buildIdeateSlidePrompts({
    candidateCount: count,
    context,
    slide: toPromptSlide(slide),
    slideType: promptSlideType,
    source: textValue(source)
  });
  const result = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    onProgress: options.onProgress,
    promptContext: {
      workflowName: "slide-variant"
    },
    schema: getIdeateSlideResponseSchema(promptSlideType, count),
    schemaName: `ideate_slide_${promptSlideType}_variants`,
    userPrompt: prompts.userPrompt
  });

  const data = asJsonObject(result.data);
  if (!Array.isArray(data.variants) || data.variants.length !== count) {
    throw new Error(`LLM ideation did not return ${count} structured variants`);
  }

  return data.variants.map((variant: unknown) => {
    const sourceVariant = asJsonObject(variant);
    return {
    changeSummary: Array.isArray(sourceVariant.changeSummary) ? sourceVariant.changeSummary.map((entry: unknown) => String(entry)) : [],
    generator: "llm",
    label: String(sourceVariant.label || "Slide candidate"),
    model: result.model,
    notes: String(sourceVariant.notes || ""),
    promptSummary: String(sourceVariant.promptSummary || ""),
    provider: result.provider,
    slideSpec: validateGeneratedVariantSlideSpec(sourceVariant.slideSpec, "LLM slide candidate")
  };
  }).map((candidate: Candidate) => {
    if (candidate.slideSpec.type !== promptSlideType) {
      throw new Error(`LLM returned slide spec type "${candidate.slideSpec.type}" for "${promptSlideType}" slide`);
    }

    return candidate;
  });
}

async function createLlmWordingCandidates(slide: SlideRecord, slideType: unknown, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
  const count = normalizeCandidateCount(candidateCount);
  const promptSlideType = textValue(slideType, "body");
  const prompts = buildDrillWordingPrompts({
    candidateCount: count,
    context,
    slide: toPromptSlide(slide),
    selectionScope: options.selectionScope || null,
    slideType: promptSlideType,
    source: textValue(source)
  });
  const result = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    onProgress: options.onProgress,
    promptContext: {
      workflowName: "wording-variant"
    },
    schema: getIdeateSlideResponseSchema(promptSlideType, count),
    schemaName: `drill_wording_${promptSlideType}_variants`,
    userPrompt: prompts.userPrompt
  });

  const data = asJsonObject(result.data);
  if (!Array.isArray(data.variants) || data.variants.length !== count) {
    throw new Error(`LLM wording drill did not return ${count} structured variants`);
  }

  return data.variants.map((variant: unknown) => {
    const sourceVariant = asJsonObject(variant);
    return {
    changeSummary: Array.isArray(sourceVariant.changeSummary) ? sourceVariant.changeSummary.map((entry: unknown) => String(entry)) : [],
    generator: "llm",
    label: String(sourceVariant.label || "Wording candidate"),
    model: result.model,
    notes: String(sourceVariant.notes || ""),
    promptSummary: String(sourceVariant.promptSummary || ""),
    provider: result.provider,
    slideSpec: validateGeneratedVariantSlideSpec(sourceVariant.slideSpec, "LLM wording candidate")
  };
  }).map((candidate: Candidate) => {
    if (candidate.slideSpec.type !== slideType) {
      throw new Error(`LLM returned slide spec type "${candidate.slideSpec.type}" for "${slideType}" wording drill`);
    }

    return candidate;
  });
}

async function createLlmSelectionWordingCandidates(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
  const scope = options.selectionScope;
  const candidates = await createLlmWordingCandidates(
    slide,
    currentSpec.type,
    serializeSlideSpec(currentSpec),
    context,
    candidateCount,
    {
      ...options,
      selectionScope: scope
    }
  );
  const scopeLabel = describeSelectionScope(scope);

  return candidates.map((candidate: Candidate) => {
    const slideSpec = validateGeneratedVariantSlideSpec(
      mergeCandidateIntoSelectionScope(currentSpec, candidate.slideSpec, scope),
      "LLM selection wording candidate"
    );
    return {
      ...candidate,
      changeSummary: [
        `${scopeLabel} wording candidate.`,
        "Preserved non-selected slide fields.",
        ...(Array.isArray(candidate.changeSummary) ? candidate.changeSummary.slice(0, 2) : [])
      ],
      operationScope: createSelectionApplyScope(scope),
      promptSummary: candidate.promptSummary || `Selection-scoped wording candidate for ${scopeLabel}.`,
      slideSpec
    };
  });
}

async function createLlmRedoLayoutCandidates(slide: SlideRecord, currentSpec: SlideSpec, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
  const count = normalizeCandidateCount(candidateCount);
  const promptSlideType = textValue(currentSpec.type, "body");
  const prompts = buildRedoLayoutPrompts({
    candidateCount: count,
    context,
    slide: toPromptSlide(slide),
    slideType: promptSlideType,
    source: textValue(source)
  });
  const result = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    onProgress: options.onProgress,
    promptContext: {
      workflowName: "redo-layout"
    },
    schema: getRedoLayoutResponseSchema(count),
    schemaName: "redo_layout_family_variants",
    userPrompt: prompts.userPrompt
  });

  const data = asJsonObject(result.data);
  if (!Array.isArray(data.candidates) || data.candidates.length !== count) {
    throw new Error(`LLM redo-layout did not return ${count} structured intent candidates`);
  }

  const structureContext = collectStructureContext(slide, currentSpec, context);
  return data.candidates.map((intent: unknown) => createLlmRedoLayoutCandidateFromIntent(
    currentSpec,
    structureContext,
    intent,
    result,
    options
  ));
}

function createLlmRedoLayoutCandidateFromIntent(currentSpec: SlideSpec, structureContext: StructureContext, intent: unknown, result: JsonObject, options: OperationOptions = {}): Candidate {
  const sourceIntent = asJsonObject(intent);
  const targetFamily = String(sourceIntent.targetFamily || currentSpec.type);
  const droppedFields = Array.isArray(sourceIntent.droppedFields) ? sourceIntent.droppedFields.map((field: unknown) => String(field)).filter(Boolean) : [];
  const preservedFields = Array.isArray(sourceIntent.preservedFields) ? sourceIntent.preservedFields.map((field: unknown) => String(field)).filter(Boolean) : [];
  const localFamilyCandidate = targetFamily !== currentSpec.type
    ? createLocalFamilyChangeCandidates(currentSpec, structureContext, options)
      .find((candidate: Candidate) => candidate.slideSpec && candidate.slideSpec.type === targetFamily)
    : null;
  const slideSpec = localFamilyCandidate
    ? localFamilyCandidate.slideSpec
    : createSameFamilyLayoutIntentSpec(currentSpec, sourceIntent);
  const newFamily = slideSpec.type;
  const changeSummary = [
    currentSpec.type === newFamily
      ? `Kept slide family as ${newFamily}.`
      : `Changed slide family from ${currentSpec.type} to ${newFamily}.`,
    droppedFields.length
      ? `Intent drops fields: ${droppedFields.slice(0, 6).join(", ")}.`
      : "Intent keeps the existing structured fields.",
    preservedFields.length
      ? `Intent preserves fields: ${preservedFields.slice(0, 6).join(", ")}.`
      : "Intent preserves the current slide title and core message.",
    sentence(sourceIntent.rationale || sourceIntent.emphasis, "Selected the layout intent before local validation builds the candidate.", 18)
  ];
  const layoutDefinition = createGeneratedLayoutDefinition(currentSpec, slideSpec, sourceIntent);
  if (layoutDefinition) {
    changeSummary.push(`Proposed reusable ${describeLayoutDefinition(layoutDefinition)} layout definition for save/export review.`);
  }

  return {
    changeSummary,
    generator: "llm",
    label: String(sourceIntent.label || `Use ${targetFamily} layout intent`),
    layoutDefinition,
    model: result.model,
    notes: String(sourceIntent.rationale || sourceIntent.emphasis || ""),
    promptSummary: `LLM selected ${targetFamily} layout intent: ${sentence(sourceIntent.emphasis, sourceIntent.label || targetFamily, 12)}`,
    provider: result.provider,
    slideSpec
  };
}

async function authorCustomLayoutSlide(slideId: string, options: OperationOptions = {}): Promise<JsonObject> {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  const slide = asJsonObject(getSlide(slideId));
  const originalSlideSpec = asJsonObject(readSlideSpec(slideId));
  const createdVariants: JsonObject[] = [];
  const dryRun = true;
  let previews = null;

  ideateSlideLocks.add(slideId);
  try {
    const layoutDefinition = validateCustomLayoutDefinitionForSlide(originalSlideSpec, options.layoutDefinition);
    const layoutTreatment = normalizeLayoutTreatment(options.layoutTreatment || originalSlideSpec.layout);
    const slideSpec = asJsonObject(validateSlideSpec({
      ...originalSlideSpec,
      layout: layoutTreatment,
      layoutDefinition
    }));
    const previewMode = options.multiSlidePreview === true ? "multi-slide" : "current-slide";
    const currentSlideValidation = await validateSlideSpecInDom({
      id: String(slide.id || ""),
      index: typeof slide.index === "number" || typeof slide.index === "string" ? slide.index : 0,
      slideSpec: {
        ...slideSpec,
        layoutDefinition
      },
      title: textValue(slide.title)
    });
    const candidate = {
      changeSummary: [
        `Previewed custom ${layoutDefinition.type} definition for ${slideSpec.type} slides.`,
        `${previewMode === "multi-slide" ? "Prepared favorite-ready multi-slide preview metadata." : "Prepared a current-slide preview for deck-local authoring."}`,
        currentSlideValidation.ok
          ? "Current-slide DOM validation passed for the preview."
          : `Current-slide DOM validation found ${currentSlideValidation.errors.length} blocking issue${currentSlideValidation.errors.length === 1 ? "" : "s"}.`,
        `Changed layout treatment to ${slideSpec.layout || "standard"} for DOM preview.`,
        "Kept the custom layout as validated JSON; no arbitrary CSS, HTML, SVG, or JavaScript was accepted."
      ],
      generator: "local",
      label: String(options.label || "Custom content layout"),
      layoutDefinition,
      layoutPreview: {
        currentSlideValidation,
        mode: previewMode,
        state: currentSlideValidation.ok ? "applicable" : "blocked",
        supportedTypes: [slideSpec.type]
      },
      model: null,
      notes: String(options.notes || "Custom layout authoring candidate."),
      promptSummary: "Custom layout authoring produced a validated layout definition candidate.",
      provider: "local",
      slideSpec
    };

    const variants = await materializeCandidatesToVariants(slideId, [candidate], {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label: string) => label,
      operation: "custom-layout"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation: getLocalGenerationStatus(),
    layoutValidation: createdVariants[0] && createdVariants[0].layoutPreview
      ? asJsonObject(createdVariants[0].layoutPreview).currentSlideValidation || null
      : null,
    previews,
    slideId,
    summary: `Prepared custom layout preview for ${slide.title || slideId}.`,
    variants: createdVariants
  };
}

async function createLlmDeckStructureCandidates(context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<JsonObject[]> {
  const count = normalizeCandidateCount(candidateCount);
  const structureContext = collectDeckStructureContext(context);
  const sourceContext = getGenerationSourceContext({
    audience: context.deck && context.deck.audience,
    constraints: context.deck && context.deck.constraints,
    objective: context.deck && context.deck.objective,
    outline: context.deck && context.deck.outline,
    query: [context.deck && context.deck.objective, context.deck && context.deck.outline].filter(Boolean).join(" "),
    themeBrief: context.deck && context.deck.themeBrief,
    title: context.deck && context.deck.title,
    workflow: "deckPlanning"
  });
  const prompts = buildDeckStructurePrompts({
    candidateCount: count,
    context,
    outlineLines: structureContext.outlineLines,
    slides: structureContext.slides,
    sourceSnippets: sourceContext.snippets
  });
  const result = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    maxOutputTokens: 5000,
    onProgress: options.onProgress,
    promptContext: {
      sourceBudget: sourceContext.budget,
      workflowName: "deck-structure"
    },
    schema: getDeckStructureResponseSchema(count),
    schemaName: "deck_structure_plan_candidates",
    userPrompt: prompts.userPrompt
  });

  if (!result.data || !Array.isArray(result.data.candidates) || result.data.candidates.length !== count) {
    throw new Error(`LLM deck-structure planning did not return ${count} structured candidates`);
  }

  return result.data.candidates.map((candidate: unknown) => createDeckStructureCandidateFromLlmIntent(
    structureContext,
    asJsonObject(candidate),
    asJsonObject(result),
    { readExistingSlideSpec }
  ));
}

function normalizeCheckRemediationIssue(value: unknown): CheckRemediationIssue {
  const source = asJsonObject(value);
  return {
    level: source.level,
    message: source.message,
    rule: source.rule,
    slide: source.slide
  };
}

async function remediateCheckIssue(slideId: string, options: CheckRemediationOptions = {}): Promise<JsonObject> {
  const issue = normalizeCheckRemediationIssue(options.issue);
  const baseSlideSpec = readSlideSpec(slideId);
  const candidates = createCheckRemediationCandidates(baseSlideSpec, issue);

  if (!candidates.length) {
    throw new Error(`No mechanical remediation candidates are available for ${issueRule(issue) || "this issue"}`);
  }

  const variants = await materializeCandidatesToVariants(slideId, candidates, {
    baseSlideSpec,
    operation: "check-remediation"
  });

  return {
    blockName: typeof options.blockName === "string" ? options.blockName : null,
    issue,
    issueIndex: Number.isInteger(Number(options.issueIndex)) ? Number(options.issueIndex) : null,
    slideId,
    summary: `Created ${variants.length} remediation candidate${variants.length === 1 ? "" : "s"}.`,
    transientVariants: variants
  };
}

async function ideateSlide(slideId: string, options: OperationOptions = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Ideate Slide is already running for ${slideId}`);
  }

  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;
  const dryRun = true;
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const slideType = originalSlideSpec.type;
  const generation = resolveGeneration();

  ideateSlideLocks.add(slideId);
  try {
    reportProgress(options, {
      message: "Gathering saved context for ideation...",
      stage: "gathering-context"
    });

    reportProgress(options, {
      message: `Generating slide variants with ${generation.provider} ${generation.model}...`,
      stage: "generating-variants"
    });
    const candidates = await createLlmIdeateCandidates(slide, slideType, serializeSlideSpec(originalSlideSpec), context, candidateCount, options);

    reportProgress(options, {
      message: `Rendering ${candidates.length} candidate preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label) => label,
      operation: "ideate-slide"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} session-only slide candidates for ${slide.title} using ${generation.provider} ${generation.model}.`,
    variants: createdVariants
  };
}

async function drillWordingSlide(slideId: string, options: OperationOptions = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;
  const dryRun = true;
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  ideateSlideLocks.add(slideId);
  try {
    reportProgress(options, {
      message: "Gathering the current slide copy for wording passes...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: `Generating wording variants with ${generation.provider} ${generation.model}...`,
      stage: "generating-variants"
    });
    const candidates = await createLlmWordingCandidates(slide, originalSlideSpec.type, serializeSlideSpec(originalSlideSpec), context, candidateCount, options);
    reportProgress(options, {
      message: `Rendering ${candidates.length} wording preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label) => label,
      operation: "drill-wording"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} session-only wording candidates for ${slide.title} using ${generation.provider} ${generation.model}.`,
    variants: createdVariants
  };
}

function createSelectionQuoteCandidate(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext, selectionScope: unknown): JsonObject {
  const entries = getSelectionEntries(selectionScope);
  const selectedText = entries
    .map((entry: JsonObject) => entry.selectedText || getPathValue(currentSpec, entry.fieldPath))
    .filter(Boolean)
    .join(" ");
  const structureContext = collectStructureContext(slide, currentSpec, context);
  const quote = sentence(selectedText, firstFamilyChangeText(currentSpec, structureContext.mustInclude, 18), 22);
  const slideSpec = asJsonObject(validateSlideSpec({
    attribution: currentSpec.attribution || "",
    context: sentence(structureContext.intent || currentSpec.summary || currentSpec.note, "Selection promoted into a quote slide.", 16),
    media: null,
    mediaItems: [],
    quote,
    source: currentSpec.source || "",
    title: sentence(currentSpec.title || slide.title, "Quote", 8),
    type: "quote"
  }));
  const familyChange = {
    droppedFields: Object.keys(currentSpec).filter((field) => !Object.hasOwn(slideSpec, field)),
    preservedFields: ["title", "quote"].filter((field) => Object.hasOwn(slideSpec, field)),
    targetFamily: "quote"
  };

  return {
    changeSummary: [
      `Changed slide family from ${currentSpec.type} to quote.`,
      `${describeSelectionScope(selectionScope)} becomes the dominant quote.`,
      `Dropped fields: ${familyChange.droppedFields.slice(0, 5).join(", ") || "none"}.`,
      `Preserved fields: ${familyChange.preservedFields.join(", ")}.`
    ],
    generator: "local",
    label: "Selection quote candidate",
    model: null,
    notes: "Promotes the selected text into a quote-family candidate.",
    operationScope: createSelectionApplyScope(selectionScope, {
      allowFamilyChange: true,
      familyChange
    }),
    promptSummary: "Turns the selected text into a quote slide while keeping apply review explicit.",
    provider: "local",
    slideSpec
  };
}

async function drillSelectionWordingSlide(slideId: string, selectionScope: unknown, options: OperationOptions = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;
  const dryRun = true;
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const wantsQuote = options.command && /turn\s+.*quote|quote\s+slide|into\s+a?\s*quote/i.test(String(options.command));
  const generation = wantsQuote ? getLocalGenerationStatus() : resolveGeneration();

  ideateSlideLocks.add(slideId);
  try {
    reportProgress(options, {
      message: `Gathering ${describeSelectionScope(selectionScope)} for selection-scoped wording...`,
      stage: "gathering-context"
    });

    const candidates = wantsQuote
      ? [createSelectionQuoteCandidate(slide, originalSlideSpec, context, selectionScope)]
      : await createLlmSelectionWordingCandidates(slide, originalSlideSpec, context, candidateCount, {
          ...options,
          selectionScope
        });

    reportProgress(options, {
      message: `Rendering ${candidates.length} selection-scoped candidate${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label) => label,
      operation: "selection-command"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} ${describeSelectionScope(selectionScope)} candidate${createdVariants.length === 1 ? "" : "s"} for ${slide.title}.`,
    variants: createdVariants
  };
}

async function ideateThemeSlide(slideId: string, options: OperationOptions = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;
  const dryRun = true;
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  ideateSlideLocks.add(slideId);
  try {
    reportProgress(options, {
      message: "Gathering saved theme context for the selected slide...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: `Generating theme variants with ${generation.provider} ${generation.model}...`,
      stage: "generating-variants"
    });
    const candidates = await createLlmThemeCandidates(slide, originalSlideSpec.type, serializeSlideSpec(originalSlideSpec), context, candidateCount, options);
    reportProgress(options, {
      message: `Rendering ${candidates.length} theme preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label) => `${label} candidate`,
      operation: "ideate-theme"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} session-only theme candidates for ${slide.title} using ${generation.provider} ${generation.model}.`,
    variants: createdVariants
  };
}

async function redoLayoutSlide(slideId: string, options: OperationOptions = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;
  const dryRun = true;
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  ideateSlideLocks.add(slideId);
  try {
    reportProgress(options, {
      message: "Gathering current layout context...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: `Generating layout variants with ${generation.provider} ${generation.model}...`,
      stage: "generating-variants"
    });
    const libraryCandidates = createLibraryLayoutCandidates(originalSlideSpec, options);
    const llmCandidates = await createLlmRedoLayoutCandidates(slide, originalSlideSpec, serializeSlideSpec(originalSlideSpec), context, candidateCount, options);
    const candidates = [...libraryCandidates, ...llmCandidates];
    reportProgress(options, {
      message: `Rendering ${candidates.length} layout preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label) => label,
      operation: "redo-layout"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} session-only layout candidates for ${slide.title} using ${generation.provider} ${generation.model}.`,
    variants: createdVariants
  };
}

async function ideateStructureSlide(slideId: string, options: OperationOptions = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;
  const dryRun = true;
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  ideateSlideLocks.add(slideId);
  try {
    reportProgress(options, {
      message: "Gathering current slide role and nearby outline context...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: `Generating structure variants with ${generation.provider} ${generation.model}...`,
      stage: "generating-variants"
    });
    const candidates = await createLlmRedoLayoutCandidates(slide, originalSlideSpec, serializeSlideSpec(originalSlideSpec), context, candidateCount, options);
    reportProgress(options, {
      message: `Rendering ${candidates.length} structure preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label) => `${label} candidate`,
      operation: "ideate-structure"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} session-only structure candidates for ${slide.title} using ${generation.provider} ${generation.model}.`,
    variants: createdVariants
  };
}

async function ideateDeckStructure(options: OperationOptions = {}) {
  const context = getDeckContext();
  const dryRun = options.dryRun !== false;
  const candidateCount = normalizeCandidateCount(options.candidateCount || 3);
  const generation = resolveGeneration();

  reportProgress(options, {
    message: "Gathering deck brief, outline, and current slide roles...",
    stage: "gathering-context"
  });

  reportProgress(options, {
    message: `Generating deck-plan candidates with ${generation.provider} ${generation.model}...`,
    stage: "generating-variants"
  });

  const candidates = await createLlmDeckStructureCandidates(context, candidateCount, options);

  reportProgress(options, {
    message: `Rendering ${candidates.length} deck-plan preview${candidates.length === 1 ? "" : "s"}...`,
    stage: "rendering-variants"
  });

  for (const candidate of candidates) {
    await renderDeckStructureCandidatePreview(candidate as DeckStructureCandidate, {
      applyDeckStructureCandidate
    });
  }

  return {
    candidates,
    dryRun,
    generation,
    summary: dryRun
      ? `Generated ${candidates.length} deck-plan candidates from the saved deck context using ${generation.provider} ${generation.model}.`
      : `Generated ${candidates.length} deck-plan candidates from the saved deck context using ${generation.provider} ${generation.model}.`
  };
}

function readExistingSlideSpec(slideId: string): SlideSpec | null {
  try {
    return asJsonObject(readSlideSpec(slideId));
  } catch (error) {
    return null;
  }
}

async function applyDeckStructureCandidate(candidate: unknown, options: OperationOptions = {}): Promise<JsonObject> {
  const candidateSource = asJsonObject(candidate);
  const plan = asJsonObjectArray(candidateSource.slides) as DeckPlanEntry[];
  const promoteInsertions = options.promoteInsertions !== false;
  const promoteRemovals = options.promoteRemovals !== false;
  const promoteReplacements = options.promoteReplacements !== false;
  let insertedSlides = 0;
  const promoteIndices = options.promoteIndices !== false;
  const promoteTitles = options.promoteTitles !== false;
  let indexUpdates = 0;
  let removedSlides = 0;
  let replacedSlides = 0;
  let titleUpdates = 0;

  if (promoteInsertions) {
    for (const entry of plan) {
      if (!entry || entry.action !== "insert" || !entry.scaffold || !entry.scaffold.slideSpec) {
        continue;
      }

      createStructuredSlide(entry.scaffold.slideSpec);
      insertedSlides += 1;
    }
  }

  if (promoteReplacements) {
    for (const entry of plan) {
      if (!entry || typeof entry.slideId !== "string" || !entry.slideId || !entry.replacement || !entry.replacement.slideSpec) {
        continue;
      }
      if (!readExistingSlideSpec(entry.slideId)) {
        continue;
      }

      writeSlideSpec(entry.slideId, entry.replacement.slideSpec);
      replacedSlides += 1;
    }
  }

  if (promoteRemovals) {
    for (const entry of plan) {
      if (!entry || entry.action !== "remove" || typeof entry.slideId !== "string" || !entry.slideId) {
        continue;
      }

      const slideSpec = readExistingSlideSpec(entry.slideId);
      if (!slideSpec) {
        continue;
      }
      if (slideSpec.archived === true) {
        continue;
      }

      writeSlideSpec(entry.slideId, {
        ...slideSpec,
        archived: true
      });
      removedSlides += 1;
    }
  }

  if (promoteTitles || promoteIndices) {
    for (const entry of plan) {
      if (!entry || entry.action === "remove" || typeof entry.slideId !== "string" || !entry.slideId) {
        continue;
      }

      const nextIndex = Number(entry.proposedIndex);
      const nextTitle = sentence(entry.proposedTitle, "", 18);
      if (!nextTitle) {
        if (!Number.isFinite(nextIndex)) {
          continue;
        }
      }

      const slideSpec = readExistingSlideSpec(entry.slideId);
      if (!slideSpec) {
        continue;
      }
      const currentIndex = Number(slideSpec.index);
      const currentTitle = sentence(slideSpec.title, "", 18);
      const shouldUpdateIndex = promoteIndices && Number.isFinite(nextIndex) && currentIndex !== nextIndex;
      const shouldUpdateTitle = promoteTitles && nextTitle
        && normalizeSentence(currentTitle).toLowerCase() !== normalizeSentence(nextTitle).toLowerCase();

      if (!shouldUpdateIndex && !shouldUpdateTitle) {
        continue;
      }

      writeSlideSpec(entry.slideId, {
        ...slideSpec,
        archived: false,
        index: shouldUpdateIndex ? nextIndex : slideSpec.index,
        title: shouldUpdateTitle ? nextTitle : slideSpec.title
      });
      if (shouldUpdateIndex) {
        indexUpdates += 1;
      }
      if (shouldUpdateTitle) {
        titleUpdates += 1;
      }
    }
  }

  const previews = (await buildAndRenderDeck()).previews;

  return {
    insertedSlides,
    indexUpdates,
    previews,
    removedSlides,
    replacedSlides,
    titleUpdates
  };
}

const _test = {
  applyCandidateSlideDefaults,
  authorCustomLayoutSlide,
  createGeneratedLayoutDefinition,
  createCheckRemediationCandidates,
  createLocalFamilyChangeCandidates,
  createLocalStructureCandidates,
  createSlotRegionLayoutDefinition,
  createLocalDeckStructureCandidates,
  validateGeneratedVariantSlideSpec,
  validateCustomLayoutDefinitionForSlide
};

export {
  _test,
  authorCustomLayoutSlide,
  applyDeckStructureCandidate,
  drillSelectionWordingSlide,
  drillWordingSlide,
  ideateDeckStructure,
  ideateStructureSlide,
  ideateThemeSlide,
  ideateSlide,
  remediateCheckIssue,
  redoLayoutSlide
};
