// Browser workflow operations coordinate candidate generation, previews, compare
// state, and explicit apply actions. Keep file writes behind service helpers and
// preserve the candidate boundary for LLM-backed workflows.
import {
  asRecord as asJsonObject
} from "../../shared/json-record-utils.ts";
import { compactSentence as sentence } from "../../shared/text-utils.ts";
import { renderDeckPreview } from "./build.ts";
import { getLlmStatus } from "./llm/client.ts";
import { validateSlideSpecInDom } from "./dom-validate.ts";
import {
  createGeneratedLayoutDefinition,
  createSlotRegionLayoutDefinition,
  validateCustomLayoutDefinitionForSlide
} from "./generated-layout-definitions.ts";
import { getDeckContext } from "./deck-context-store.ts";
import { getSlide, getSlides } from "./slide-queries.ts";
import { readSlideSpec } from "./slide-spec-store.ts";
import { writeSlideSpec } from "./slide-writes.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import {
  collectStructureContext,
  createCheckRemediationCandidates,
  createLibraryLayoutCandidates,
  createLlmIdeateCandidates,
  createLlmRedoLayoutCandidates,
  createLlmSelectionWordingCandidates,
  createLlmThemeCandidates,
  createLlmWordingCandidates,
  createLocalDeckStructureCandidates,
  createLocalFamilyChangeCandidates,
  createLocalStructureCandidates,
  firstFamilyChangeText,
  issueRule,
  applyDeckStructureCandidate,
  ideateDeckStructure,
  type CheckRemediationIssue
} from "./operation-candidate-services.ts";
import { createSelectionApplyScope } from "./selection-merge.ts";
import {
  describeSelectionScope,
  getSelectionEntries
} from "./selection-entries.ts";
import { getPathValue } from "./selection-path-values.ts";
import { materializeCandidatesToVariants } from "./generated-variant-materialization.ts";
import { hasDanglingEnding, isWeakLabel } from "./generated-text-hygiene.ts";
import {
  applyCandidateSlideDefaults,
  serializeSlideSpec,
  validateGeneratedVariantSlideSpec
} from "./generated-variant-safety.ts";
import {
  refineNarrationForSlide,
  type SlideSummary
} from "./narration-refinement.ts";

const ideateSlideLocks = new Set<string>();
const narrationRefinementLocks = new Set<string>();
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

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

function repairLayoutPreviewItems(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    const source = asJsonObject(item);
    const title = typeof source.title === "string" ? source.title : "";
    if (!isWeakLabel(source.title) && !/(\.\.\.|…)/.test(title)) {
      return source;
    }

    const body = typeof source.body === "string" ? source.body : source.value;
    return {
      ...source,
      title: shortLayoutPreviewTitle(body, source.title)
    };
  });
}

function shortLayoutPreviewTitle(value: unknown, fallback: unknown): string {
  const words = String(value || fallback || "")
    .replace(/(\.\.\.|…)/g, "")
    .match(/\S+/g) || [];

  const titleWords = words.slice(0, 6);
  while (titleWords.length > 1 && hasDanglingEnding(titleWords.join(" "))) {
    titleWords.pop();
  }

  return titleWords.join(" ") || String(fallback || "Detail");
}

function repairLayoutPreviewSlideSpec(slideSpec: JsonObject): JsonObject {
  const next: JsonObject = { ...slideSpec };
  ["bullets", "cards", "guardrails", "resources", "signals"].forEach((field) => {
    if (Array.isArray(slideSpec[field])) {
      next[field] = repairLayoutPreviewItems(slideSpec[field]);
    }
  });

  return next;
}

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

type DryRunSlideWorkflowState = {
  context: DeckContext;
  createdVariants: JsonObject[];
  dryRun: true;
  originalSlideSpec: SlideSpec;
  slide: SlideRecord;
};

type DryRunSlideWorkflowResult = {
  dryRun: true;
  previews: JsonObject | null;
  slide: SlideRecord;
  slideId: string;
  variants: JsonObject[];
};

type GenerationStatus = ReturnType<typeof resolveGeneration>;

type DryRunCandidateWorkflowState = DryRunSlideWorkflowState & {
  candidateCount: number;
  generation: GenerationStatus;
  options: OperationOptions;
  serializedSlideSpec: string;
};

type DryRunCandidateWorkflowOptions = {
  createCandidates: (state: DryRunCandidateWorkflowState) => JsonObject[] | Promise<JsonObject[]>;
  gatherMessage: string;
  generationLabel: string;
  labelFormatter: (label: string) => string;
  operation: string;
  renderLabel: string;
  summaryLabel: string;
  workflowName: string;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function reportProgress(options: OperationOptions, progress: JsonObject): void {
  if (typeof options.onProgress === "function") {
    options.onProgress(progress);
  }
}

async function restoreWorkingSlidePreview(slideId: string, originalSlideSpec: SlideSpec): Promise<JsonObject> {
  writeSlideSpec(slideId, originalSlideSpec);
  return renderDeckPreview();
}

async function runDryRunSlideWorkflow(
  slideId: string,
  workflowName: string,
  options: OperationOptions,
  runWorkflow: (state: DryRunSlideWorkflowState) => Promise<void>
): Promise<DryRunSlideWorkflowResult> {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`${workflowName} is already running for ${slideId}`);
  }

  const slide = asJsonObject(getSlide(slideId)) as SlideRecord;
  const originalSlideSpec = asJsonObject(readSlideSpec(slideId));
  const context = getDeckContext();
  const createdVariants: JsonObject[] = [];
  let previews = null;

  ideateSlideLocks.add(slideId);
  try {
    await runWorkflow({
      context,
      createdVariants,
      dryRun: true,
      originalSlideSpec,
      slide
    });
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
      previews = await restoreWorkingSlidePreview(slideId, originalSlideSpec);
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun: true,
    previews,
    slide,
    slideId,
    variants: createdVariants
  };
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
  return treatment || "standard";
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

function toSlideSummary(slide: SlideRecord): SlideSummary {
  const summary: SlideSummary = {
    id: slide.id,
    title: textValue(slide.title, slide.id)
  };
  if (typeof slide.index === "number") {
    summary.index = slide.index;
  }
  return summary;
}

function getNeighborSlides(slides: SlideRecord[], slideId: string) {
  const index = slides.findIndex((entry) => entry.id === slideId);
  const previousSlide = index > 0 ? slides[index - 1] : null;
  const nextSlide = index >= 0 && index < slides.length - 1 ? slides[index + 1] : null;
  return {
    nextSlide: nextSlide ? toSlideSummary(nextSlide) : null,
    previousSlide: previousSlide ? toSlideSummary(previousSlide) : null
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

async function createCustomLayoutCandidate(
  slide: JsonObject,
  originalSlideSpec: JsonObject,
  options: OperationOptions
): Promise<JsonObject> {
  const layoutDefinition = validateCustomLayoutDefinitionForSlide(originalSlideSpec, options.layoutDefinition);
  const layoutTreatment = normalizeLayoutTreatment(options.layoutTreatment || originalSlideSpec.layout);
  const slideSpec = repairLayoutPreviewSlideSpec(asJsonObject(validateSlideSpec({
    ...originalSlideSpec,
    layout: layoutTreatment,
    layoutDefinition
  })));
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

  return {
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
}

function customLayoutResult(params: {
  createdVariants: JsonObject[];
  dryRun: boolean;
  previews: unknown;
  slide: JsonObject;
  slideId: string;
}): JsonObject {
  return {
    dryRun: params.dryRun,
    generation: getLocalGenerationStatus(),
    layoutValidation: params.createdVariants[0] && params.createdVariants[0].layoutPreview
      ? asJsonObject(params.createdVariants[0].layoutPreview).currentSlideValidation || null
      : null,
    previews: params.previews,
    slideId: params.slideId,
    summary: `Prepared custom layout preview for ${params.slide.title || params.slideId}.`,
    variants: params.createdVariants
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
    const candidate = await createCustomLayoutCandidate(slide, originalSlideSpec, options);
    const variants = await materializeCandidatesToVariants(slideId, [candidate], {
      baseSlideSpec: originalSlideSpec,
      dryRun,
      labelFormatter: (label: string) => label,
      operation: "custom-layout"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      previews = await restoreWorkingSlidePreview(slideId, originalSlideSpec);
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return customLayoutResult({
    createdVariants,
    dryRun,
    previews,
    slide,
    slideId
  });
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

async function runDryRunCandidateWorkflow(
  slideId: string,
  options: OperationOptions,
  workflowOptions: DryRunCandidateWorkflowOptions
) {
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();
  const result = await runDryRunSlideWorkflow(slideId, workflowOptions.workflowName, options, async (state) => {
    reportProgress(options, {
      message: workflowOptions.gatherMessage,
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: `Generating ${workflowOptions.generationLabel} variants with ${generation.provider} ${generation.model}...`,
      stage: "generating-variants"
    });
    const candidates = await workflowOptions.createCandidates({
      ...state,
      candidateCount,
      generation,
      options,
      serializedSlideSpec: serializeSlideSpec(state.originalSlideSpec)
    });
    reportProgress(options, {
      message: `Rendering ${candidates.length} ${workflowOptions.renderLabel} preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      baseSlideSpec: state.originalSlideSpec,
      dryRun: state.dryRun,
      labelFormatter: workflowOptions.labelFormatter,
      operation: workflowOptions.operation
    });
    state.createdVariants.push(...variants);
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} session-only ${workflowOptions.summaryLabel} candidates for ${result.slide.title} using ${generation.provider} ${generation.model}.`,
    variants: result.variants
  };
}

async function ideateSlide(slideId: string, options: OperationOptions = {}) {
  return runDryRunCandidateWorkflow(slideId, options, {
    createCandidates: (state) => createLlmIdeateCandidates(
      state.slide,
      state.originalSlideSpec.type,
      state.serializedSlideSpec,
      state.context,
      state.candidateCount,
      state.options
    ),
    gatherMessage: "Gathering saved context for ideation...",
    generationLabel: "slide",
    labelFormatter: (label) => label,
    operation: "ideate-slide",
    renderLabel: "candidate",
    summaryLabel: "slide",
    workflowName: "Ideate Slide"
  });
}

async function drillWordingSlide(slideId: string, options: OperationOptions = {}) {
  return runDryRunCandidateWorkflow(slideId, options, {
    createCandidates: (state) => createLlmWordingCandidates(
      state.slide,
      state.originalSlideSpec.type,
      state.serializedSlideSpec,
      state.context,
      state.candidateCount,
      state.options
    ),
    gatherMessage: "Gathering the current slide copy for wording passes...",
    generationLabel: "wording",
    labelFormatter: (label) => label,
    operation: "drill-wording",
    renderLabel: "wording",
    summaryLabel: "wording",
    workflowName: "Wording drill"
  });
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
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const wantsQuote = options.command && /turn\s+.*quote|quote\s+slide|into\s+a?\s*quote/i.test(String(options.command));
  const generation = wantsQuote ? getLocalGenerationStatus() : resolveGeneration();

  const result = await runDryRunSlideWorkflow(slideId, "Selection wording drill", options, async ({
    context,
    createdVariants,
    dryRun,
    originalSlideSpec,
    slide
  }) => {
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
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} ${describeSelectionScope(selectionScope)} candidate${result.variants.length === 1 ? "" : "s"} for ${result.slide.title}.`,
    variants: result.variants
  };
}

async function ideateThemeSlide(slideId: string, options: OperationOptions = {}) {
  return runDryRunCandidateWorkflow(slideId, options, {
    createCandidates: (state) => createLlmThemeCandidates(
      state.slide,
      state.originalSlideSpec.type,
      state.serializedSlideSpec,
      state.context,
      state.candidateCount,
      state.options
    ),
    gatherMessage: "Gathering saved theme context for the selected slide...",
    generationLabel: "theme",
    labelFormatter: (label) => `${label} candidate`,
    operation: "ideate-theme",
    renderLabel: "theme",
    summaryLabel: "theme",
    workflowName: "Theme ideation"
  });
}

async function redoLayoutSlide(slideId: string, options: OperationOptions = {}) {
  return runDryRunCandidateWorkflow(slideId, options, {
    createCandidates: async (state) => {
      const libraryCandidates = createLibraryLayoutCandidates(state.originalSlideSpec, state.options);
      const llmCandidates = await createLlmRedoLayoutCandidates(
        state.slide,
        state.originalSlideSpec,
        state.serializedSlideSpec,
        state.context,
        state.candidateCount,
        state.options
      );
      return [...libraryCandidates, ...llmCandidates];
    },
    gatherMessage: "Gathering current layout context...",
    generationLabel: "layout",
    labelFormatter: (label) => label,
    operation: "redo-layout",
    renderLabel: "layout",
    summaryLabel: "layout",
    workflowName: "Redo layout"
  });
}

async function ideateStructureSlide(slideId: string, options: OperationOptions = {}) {
  return runDryRunCandidateWorkflow(slideId, options, {
    createCandidates: (state) => createLlmRedoLayoutCandidates(
      state.slide,
      state.originalSlideSpec,
      state.serializedSlideSpec,
      state.context,
      state.candidateCount,
      state.options
    ),
    gatherMessage: "Gathering current slide role and nearby outline context...",
    generationLabel: "structure",
    labelFormatter: (label) => `${label} candidate`,
    operation: "ideate-structure",
    renderLabel: "structure",
    summaryLabel: "structure",
    workflowName: "Structure ideation"
  });
}

async function refineSlideNarration(slideId: string, options: OperationOptions = {}) {
  const lockKey = `slide:${slideId}`;
  if (narrationRefinementLocks.has(lockKey)) {
    throw new Error(`Narration refinement is already running for ${slideId}`);
  }

  const generation = resolveGeneration();
  const slides = getSlides().map((slide) => asJsonObject(slide) as SlideRecord);
  const slide = asJsonObject(getSlide(slideId)) as SlideRecord;
  const originalSlideSpec = asJsonObject(readSlideSpec(slideId));
  const context = getDeckContext();
  const neighbors = getNeighborSlides(slides, slideId);

  narrationRefinementLocks.add(lockKey);
  try {
    reportProgress(options, {
      message: "Gathering slide text and deck context for narration...",
      stage: "gathering-context"
    });
    const result = await refineNarrationForSlide({
      context,
      existingSlideSpec: originalSlideSpec,
      nextSlide: neighbors.nextSlide,
      previousSlide: neighbors.previousSlide,
      slide: toSlideSummary(slide),
      ...(options.onProgress ? { onProgress: options.onProgress } : {})
    });
    reportProgress(options, {
      message: "Writing refined narration and rebuilding previews...",
      stage: "writing-narration"
    });
    writeSlideSpec(slideId, result.slideSpec, { preservePlacement: true });
    const previews = await renderDeckPreview();

    return {
      generation,
      narration: result.narration,
      previews,
      rationale: result.rationale,
      slideId,
      slideSpec: result.slideSpec,
      summary: `Refined narration for ${slide.title} using ${generation.provider} ${generation.model}.`
    };
  } finally {
    narrationRefinementLocks.delete(lockKey);
  }
}

async function refineDeckNarrationSlide(params: {
  context: JsonObject;
  failures: JsonObject[];
  options: OperationOptions;
  results: JsonObject[];
  slide: SlideRecord;
  slides: SlideRecord[];
}) {
  const slideSpec = asJsonObject(readSlideSpec(params.slide.id));
  const neighbors = getNeighborSlides(params.slides, params.slide.id);
  reportProgress(params.options, {
    message: `Refining narration for ${params.slide.title || params.slide.id}...`,
    slideId: params.slide.id,
    stage: "generating-narration"
  });

  try {
    const result = await refineNarrationForSlide({
      context: params.context,
      existingSlideSpec: slideSpec,
      nextSlide: neighbors.nextSlide,
      previousSlide: neighbors.previousSlide,
      slide: toSlideSummary(params.slide),
      ...(params.options.onProgress ? { onProgress: params.options.onProgress } : {})
    });
    writeSlideSpec(params.slide.id, result.slideSpec, { preservePlacement: true });
    params.results.push({
      durationSeconds: result.narration.durationSeconds,
      rationale: result.rationale,
      slideId: params.slide.id,
      title: params.slide.title
    });
  } catch (error) {
    params.failures.push({
      message: errorMessage(error),
      slideId: params.slide.id,
      title: params.slide.title
    });
  }
}

function summarizeDeckNarrationResult(results: JsonObject[], failures: JsonObject[], generation: GenerationStatus) {
  return failures.length
    ? `Refined narration for ${results.length} slide${results.length === 1 ? "" : "s"} using ${generation.provider} ${generation.model}; ${failures.length} slide${failures.length === 1 ? "" : "s"} kept existing narration.`
    : `Refined narration for ${results.length} slide${results.length === 1 ? "" : "s"} using ${generation.provider} ${generation.model}.`;
}

async function refineDeckNarration(options: OperationOptions = {}) {
  const lockKey = "deck";
  if (narrationRefinementLocks.has(lockKey)) {
    throw new Error("Deck narration refinement is already running.");
  }

  const generation = resolveGeneration();
  const slides = getSlides().map((slide) => asJsonObject(slide) as SlideRecord);
  const context = getDeckContext();
  const results: JsonObject[] = [];
  const failures: JsonObject[] = [];

  narrationRefinementLocks.add(lockKey);
  try {
    for (const slide of slides) {
      await refineDeckNarrationSlide({ context, failures, options, results, slide, slides });
    }

    const previews = results.length ? await renderDeckPreview() : null;
    return {
      failures,
      generation,
      previews,
      results,
      summary: summarizeDeckNarrationResult(results, failures, generation)
    };
  } finally {
    narrationRefinementLocks.delete(lockKey);
  }
}

const operationTestHooks = {
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
  operationTestHooks,
  authorCustomLayoutSlide,
  applyDeckStructureCandidate,
  drillSelectionWordingSlide,
  drillWordingSlide,
  ideateDeckStructure,
  ideateStructureSlide,
  ideateThemeSlide,
  ideateSlide,
  refineDeckNarration,
  refineSlideNarration,
  remediateCheckIssue,
  redoLayoutSlide
};
