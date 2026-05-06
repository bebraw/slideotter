// Browser workflow operations coordinate candidate generation, previews, compare
// state, and explicit apply actions. Keep file writes behind service helpers and
// preserve the candidate boundary for LLM-backed workflows.
import {
  asRecord as asJsonObject,
  compactSentence as sentence
} from "../../shared/json-utils.ts";
import { renderDeckPreview } from "./build.ts";
import { getLlmStatus } from "./llm/client.ts";
import { validateSlideSpecInDom } from "./dom-validate.ts";
import {
  createGeneratedLayoutDefinition,
  createSlotRegionLayoutDefinition,
  validateCustomLayoutDefinitionForSlide
} from "./generated-layout-definitions.ts";
import { getDeckContext } from "./state.ts";
import { getSlide, readSlideSpec, writeSlideSpec } from "./slides.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import {
  collectStructureContext,
  createLocalFamilyChangeCandidates,
  createLocalStructureCandidates,
  firstFamilyChangeText
} from "./local-slide-structure-candidates.ts";
import { createLibraryLayoutCandidates } from "./local-layout-candidates.ts";
import {
  createSelectionApplyScope,
  describeSelectionScope,
  getPathValue,
  getSelectionEntries
} from "./selection-scope.ts";
import { materializeCandidatesToVariants } from "./generated-variant-materialization.ts";
import {
  createCheckRemediationCandidates,
  issueRule,
  type CheckRemediationIssue
} from "./check-remediation-candidates.ts";
import { createLocalDeckStructureCandidates } from "./deck-structure-local-candidates.ts";
import {
  applyDeckStructureCandidate,
  ideateDeckStructure
} from "./deck-structure-operations.ts";
import {
  applyCandidateSlideDefaults,
  serializeSlideSpec,
  validateGeneratedVariantSlideSpec
} from "./generated-variant-safety.ts";
import {
  createLlmIdeateCandidates,
  createLlmRedoLayoutCandidates,
  createLlmSelectionWordingCandidates,
  createLlmThemeCandidates,
  createLlmWordingCandidates
} from "./llm-slide-candidates.ts";

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

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
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
      previews = await restoreWorkingSlidePreview(slideId, originalSlideSpec);
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
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  const result = await runDryRunSlideWorkflow(slideId, "Ideate Slide", options, async ({
    context,
    createdVariants,
    dryRun,
    originalSlideSpec,
    slide
  }) => {
    const slideType = originalSlideSpec.type;
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
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} session-only slide candidates for ${result.slide.title} using ${generation.provider} ${generation.model}.`,
    variants: result.variants
  };
}

async function drillWordingSlide(slideId: string, options: OperationOptions = {}) {
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  const result = await runDryRunSlideWorkflow(slideId, "Wording drill", options, async ({
    context,
    createdVariants,
    dryRun,
    originalSlideSpec,
    slide
  }) => {
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
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} session-only wording candidates for ${result.slide.title} using ${generation.provider} ${generation.model}.`,
    variants: result.variants
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
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  const result = await runDryRunSlideWorkflow(slideId, "Theme ideation", options, async ({
    context,
    createdVariants,
    dryRun,
    originalSlideSpec,
    slide
  }) => {
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
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} session-only theme candidates for ${result.slide.title} using ${generation.provider} ${generation.model}.`,
    variants: result.variants
  };
}

async function redoLayoutSlide(slideId: string, options: OperationOptions = {}) {
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  const result = await runDryRunSlideWorkflow(slideId, "Redo layout", options, async ({
    context,
    createdVariants,
    dryRun,
    originalSlideSpec,
    slide
  }) => {
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
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} session-only layout candidates for ${result.slide.title} using ${generation.provider} ${generation.model}.`,
    variants: result.variants
  };
}

async function ideateStructureSlide(slideId: string, options: OperationOptions = {}) {
  const candidateCount = normalizeCandidateCount(options.candidateCount);
  const generation = resolveGeneration();

  const result = await runDryRunSlideWorkflow(slideId, "Structure ideation", options, async ({
    context,
    createdVariants,
    dryRun,
    originalSlideSpec,
    slide
  }) => {
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
  });

  return {
    dryRun: result.dryRun,
    generation,
    previews: result.previews,
    slideId,
    summary: `Generated ${result.variants.length} session-only structure candidates for ${result.slide.title} using ${generation.provider} ${generation.model}.`,
    variants: result.variants
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
