// Browser workflow operations coordinate candidate generation, previews, compare
// state, and explicit apply actions. Keep file writes behind service helpers and
// preserve the candidate boundary for LLM-backed workflows.
import * as fs from "fs";
import * as path from "path";
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
import { createStandaloneSlideHtml, withBrowser } from "./dom-export.ts";
import { getDomPreviewState } from "./dom-preview.ts";
import { validateSlideSpecInDom } from "./dom-validate.ts";
import {
  createGeneratedLayoutDefinition,
  createSlotRegionLayoutDefinition,
  describeLayoutDefinition,
  validateCustomLayoutDefinitionForSlide
} from "./generated-layout-definitions.ts";
import { applyLayoutToSlideSpec, readFavoriteLayouts, readLayouts } from "./layouts.ts";
import { getOutputConfig } from "./output-config.ts";
import { outputDir } from "./paths.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { applyDeckStructurePlan, getDeckContext, saveDeckContext } from "./state.ts";
import { createStructuredSlide, getSlide, getSlides, readSlideSpec, writeSlideSpec } from "./slides.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import {
  createSelectionApplyScope,
  describeSelectionScope,
  getPathValue,
  getSelectionEntries,
  mergeCandidateIntoSelectionScope
} from "./selection-scope.ts";
import {
  copyAllowedFile,
  ensureAllowedDir,
  removeAllowedPath
} from "./write-boundary.ts";
import { createContactSheet, listPages } from "./page-artifacts.ts";
import {
  createCheckRemediationCandidates,
  issueRule,
  type CheckRemediationIssue
} from "./check-remediation-candidates.ts";
import {
  buildDeckPlanChangeSummary,
  buildDeckPlanDiff,
  buildDeckPlanPreview,
  collectDeckPlanStats
} from "./deck-structure-plan-model.ts";
import {
  collectDeckStructureContext,
  type DeckStructureContext,
  type DeckStructureSlide
} from "./deck-structure-context.ts";
import { createDeckStructureCandidateFromLlmIntent } from "./deck-structure-llm-candidates.ts";
import {
  createBoundaryDeckPatch,
  createCompressedDeckPatch,
  createComposedDecisionHandoffDeckPatch,
  createDecisionDeckPatch,
  createOperatorDeckPatch,
  createSequenceDeckPatch
} from "./deck-structure-local-patches.ts";
import {
  rewriteContentSlideSpec,
  rewriteCoverSlideSpec,
  rewriteDividerSlideSpec,
  rewritePhotoGridSlideSpec,
  rewritePhotoSlideSpec,
  rewriteQuoteSlideSpec,
  rewriteSummarySlideSpec,
  rewriteTocSlideSpec
} from "./deck-structure-slide-rewrites.ts";
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

type StructureContext = JsonObject & {
  audience: string;
  currentTitle: string;
  intent: string;
  layoutHint: string;
  mustInclude: string;
  nextTitle: string;
  note: string;
  objective: string;
  outlineCurrent: string;
  outlineNext: string;
  previousTitle: string;
  themeBrief: string;
  tone: string;
};

type LocalStructureVariant = {
  label: string;
  notes: string;
  promptSummary: string;
  slideSpec: SlideSpec;
};

type FamilyChangeDetails = {
  label: string;
  notes: string;
  preservation: string;
  promptSummary: string;
};

type DeckPlanEntry = JsonObject & {
  action?: string;
  currentIndex?: number | null;
  currentTitle?: string;
  proposedIndex?: number | null;
  proposedTitle?: string;
  replacement?: { slideSpec?: SlideSpec } | null;
  scaffold?: { slideSpec?: SlideSpec } | null;
  slideId?: string | null;
  sourceIndex?: number;
  type?: string | null;
};

type DeckPlanInsertion = JsonObject & {
  createSlideSpec: (context: DeckStructureContext, proposedIndex: number) => SlideSpec;
  proposedIndex?: number;
  summary?: string;
  title?: string;
  type?: string;
};

type DeckPlanReplacement = JsonObject & {
  createSlideSpec?: (context: DeckStructureContext, proposedIndex: number, proposedTitle: string, slide: DeckStructureSlide) => SlideSpec;
  currentIndex?: number;
  slideId?: string;
  sourceIndex?: number;
  summary?: string;
  type?: string;
};

type DeckPlanRemoval = JsonObject & {
  currentIndex?: number;
  rationale?: string;
  role?: string;
  slideId?: string;
  sourceIndex?: number;
  summary?: string;
};

type DeckStructureDefinition = JsonObject & {
  changeLead: string;
  deckPatch?: unknown;
  focus?: string[];
  insertions?: DeckPlanInsertion[];
  kindLabel?: unknown;
  label: string;
  notes?: string;
  order?: number[];
  promptSummary?: string;
  rationales?: string[];
  removals?: DeckPlanRemoval[];
  replacements?: DeckPlanReplacement[];
  roles?: string[];
  summary: string;
  titles?: unknown;
};

type DeckPlanActionFlags = {
  moved?: boolean;
  replaced?: boolean;
  retitled?: boolean;
};

type DeckWideAuthoringDefinition = JsonObject & {
  changeLead: string;
  createSlideSpec: (context: DeckStructureContext, options: DeckWideAuthoringDetails) => SlideSpec;
  kindLabel?: unknown;
  label: string;
  roles?: string[];
  replacementSummary?: (slide: DeckStructureSlide, index: number) => string;
  summary: string;
  titles?: unknown;
};

type DeckWideAuthoringDetails = {
  currentSlide: DeckStructureSlide;
  currentSpec: SlideSpec;
  index: number;
  proposedIndex: number;
  proposedTitle: string;
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

function getIndexedJsonObject(items: unknown[], index: number): JsonObject {
  return asJsonObject(items[index]);
}

function reportProgress(options: OperationOptions, progress: JsonObject): void {
  if (typeof options.onProgress === "function") {
    options.onProgress(progress);
  }
}

function asAssetUrl(fileName: string): string {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function splitLines(value: unknown): string[] {
  return String(value || "")
    .split(/\n|;/)
    .map((line) => line.replace(/^[\s*-]+/, "").trim())
    .filter(Boolean);
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.map((value: unknown) => String(value || "").trim()).filter(Boolean))];
}

function toBody(value: unknown, fallback: unknown): string {
  return sentence(value, fallback, 14);
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function createSameFamilyLayoutIntentSpec(currentSpec: SlideSpec, intent: unknown): SlideSpec {
  const sourceIntent = asJsonObject(intent);
  const emphasis = String([sourceIntent.emphasis, sourceIntent.label, sourceIntent.rationale].filter(Boolean).join(" ")).toLowerCase();
  const nextSpec = {
    ...currentSpec
  };

  if (currentSpec.type === "content") {
    if (/guardrail|solution|capabilit/.test(emphasis)) {
      nextSpec.layout = "checklist";
    } else if (/signal|problem|drift|timeline|process/.test(emphasis)) {
      nextSpec.layout = "steps";
    } else if (/quote|summary|impact|focus/.test(emphasis)) {
      nextSpec.layout = "focus";
    } else {
      nextSpec.layout = currentSpec.layout || "standard";
    }
  } else if (currentSpec.type === "summary") {
    nextSpec.layout = /resource|reference|handoff/.test(emphasis) ? "strip" : currentSpec.layout || "standard";
  } else if (currentSpec.type === "photoGrid") {
    const mediaItems = Array.isArray(currentSpec.mediaItems)
      ? currentSpec.mediaItems.map((item: unknown) => ({ ...asJsonObject(item) }))
      : [];
    if (/compare|comparison|side-by-side|contrast/.test(emphasis)) {
      nextSpec.layout = "standard";
      nextSpec.mediaItems = rotateItems(mediaItems, 1);
    } else if (/evidence|proof|sequence|story|set/.test(emphasis)) {
      nextSpec.layout = "strip";
      nextSpec.mediaItems = rotateItems(mediaItems, mediaItems.length > 2 ? 2 : 1);
    } else {
      nextSpec.layout = "focus";
      nextSpec.mediaItems = mediaItems;
    }
  } else if (["cover", "toc"].includes(String(currentSpec.type))) {
    nextSpec.layout = currentSpec.layout || "standard";
  }

  return asJsonObject(validateSlideSpec(nextSpec));
}

function rotateItems<T>(items: T[], offset = 0): T[] {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const shift = ((offset % items.length) + items.length) % items.length;
  return items.map((_item: T, index: number): T => {
    const nextItem = items[(index + shift) % items.length];
    if (nextItem === undefined) {
      return _item;
    }
    return cloneJson(nextItem);
  });
}

function createLibraryLayoutCandidates(currentSpec: SlideSpec, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const slideType = currentSpec && currentSpec.type ? String(currentSpec.type) : "";
  const deckLayouts = asJsonObjectArray(readLayouts().layouts).map((layout: JsonObject) => ({
    layout,
    sourceLabel: "deck",
    sourceName: "deck-local"
  }));
  const favoriteLayouts = asJsonObjectArray(readFavoriteLayouts().layouts).map((layout: JsonObject) => ({
    layout,
    sourceLabel: "favorite",
    sourceName: "favorite"
  }));

  return [...deckLayouts, ...favoriteLayouts]
    .filter(({ layout }: { layout: JsonObject }) => Array.isArray(layout.supportedTypes) && layout.supportedTypes.includes(slideType))
    .map(({ layout, sourceLabel, sourceName }: { layout: JsonObject; sourceLabel: string; sourceName: string }) => ({
      changeSummary: [
        `Applied saved ${sourceName} layout "${layout.name}".`,
        `Changed the slide layout treatment to ${layout.treatment}.`,
        "Reused a validated layout-library item while keeping the current slide family.",
        modeLabel
      ],
      generator: "local",
      label: `Use ${sourceLabel} layout: ${layout.name}`,
      model: null,
      notes: layout.description || `Reuses the ${layout.treatment} layout treatment from the ${sourceName} layout library.`,
      promptSummary: `Applies saved ${sourceName} layout ${layout.name} to this ${slideType} slide.`,
      provider: "local",
      slideSpec: asJsonObject(validateSlideSpec(applyLayoutToSlideSpec(
        currentSpec,
        `${sourceLabel}:${layout.id}`
      )))
    }));
}

function collectStructureContext(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext): StructureContext {
  const deck = asJsonObject(context.deck);
  const slideContext = context.slides[slide.id] || {};
  const slides = asJsonObjectArray(getSlides()).map((entry: JsonObject, index: number) => ({
    ...entry,
    id: String(entry.id || `slide-${index + 1}`),
    title: String(entry.title || `Slide ${index + 1}`)
  }));
  const slideIndex = slides.findIndex((entry: SlideRecord) => entry.id === slide.id);
  const previousSlide = slideIndex > 0 ? slides[slideIndex - 1] : null;
  const nextSlide = slideIndex >= 0 && slideIndex < slides.length - 1 ? slides[slideIndex + 1] : null;
  const outline = unique(splitLines(deck.outline));

  return {
    audience: sentence(deck.audience, "the next editor"),
    currentTitle: sentence(currentSpec.title || slide.title, slide.id, 12),
    intent: sentence(slideContext.intent, "make the slide's job clear before editing details"),
    layoutHint: sentence(slideContext.layoutHint, "use one deliberate reading path"),
    mustInclude: sentence(splitLines(slideContext.mustInclude)[0], "keep the main point visible"),
    nextTitle: sentence(nextSlide ? nextSlide.title : "", "the next slide"),
    note: sentence(splitLines(slideContext.notes)[0], "compare the candidate before applying it"),
    objective: sentence(deck.objective, "shorten the edit loop without hiding the source"),
    outlineCurrent: sentence(outline[Math.max(0, slideIndex)], intentForMissingStructure(deck, slideContext), 10),
    outlineNext: sentence(outline[Math.min(outline.length - 1, Math.max(0, slideIndex + 1))], nextSlide ? nextSlide.title : "validation", 10),
    previousTitle: sentence(previousSlide ? previousSlide.title : "", "the previous slide"),
    themeBrief: sentence(deck.themeBrief, "keep the surface quiet, readable, and deliberate"),
    tone: sentence(deck.tone, "calm and exact")
  };
}

function intentForMissingStructure(deck: JsonObject, slideContext: JsonObject): string {
  return sentence(
    slideContext.intent || deck.objective,
    "make the slide's role explicit"
  );
}

function createCardStructureCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const cards = asJsonObjectArray(currentSpec.cards);

  return [
    {
      label: "Sequence structure",
      notes: "Turns the slide into a clearer three-step sequence instead of a flat card list.",
      promptSummary: "Uses the saved outline and the next slide to reframe the card stack as a sequence.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...getIndexedJsonObject(cards, 0),
            body: toBody(`Open with ${structureContext.outlineCurrent}.`, "Open with the saved starting point."),
            title: "Start"
          },
          {
            ...getIndexedJsonObject(cards, 1),
            body: toBody(`Use ${structureContext.themeBrief}.`, "Use the shared system as the middle step."),
            title: "System"
          },
          {
            ...getIndexedJsonObject(cards, 2),
            body: toBody(`Close toward ${structureContext.outlineNext}.`, "Close on the next concrete step."),
            title: "Next"
          }
        ],
        eyebrow: "Sequence",
        note: `${structureContext.objective}. ${structureContext.note}.`,
        summary: `Frame the slide as a path from ${structureContext.outlineCurrent} toward ${structureContext.outlineNext}.`,
        title: currentSpec.title
      })
    },
    {
      label: "Boundary structure",
      notes: "Splits the slide into ownership layers so authorship, runtime, and gatekeeping are easier to read.",
      promptSummary: "Uses the deck objective and saved constraints to structure the slide around clear boundaries.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...getIndexedJsonObject(cards, 0),
            body: toBody(`Keep ${structureContext.intent}.`, "Keep the slide-specific job explicit."),
            title: "Authoring"
          },
          {
            ...getIndexedJsonObject(cards, 1),
            body: toBody(`Let the shared system carry ${structureContext.themeBrief}.`, "Let the shared system do the middle work."),
            title: "Runtime"
          },
          {
            ...getIndexedJsonObject(cards, 2),
            body: toBody(`Hold the slide to ${structureContext.mustInclude}.`, "Close on the one thing that must stay visible."),
            title: "Gate"
          }
        ],
        eyebrow: "Boundaries",
        note: `${structureContext.previousTitle} sets context; ${structureContext.nextTitle} should read like the next move.`,
        summary: "Separate authorship, runtime, and gatekeeping so the slide shows where each concern lives.",
        title: currentSpec.title
      })
    },
    {
      label: "Handoff structure",
      notes: "Frames the slide for a decision handoff by making the immediate takeaway, next step, and keep-nearby layer explicit.",
      promptSummary: "Uses audience, notes, and must-include guidance to structure the slide as a handoff surface.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...getIndexedJsonObject(cards, 0),
            body: toBody(structureContext.mustInclude, "Make the main point obvious."),
            title: "Now"
          },
          {
            ...getIndexedJsonObject(cards, 1),
            body: toBody(`Set up ${structureContext.nextTitle}.`, "Set up the next slide cleanly."),
            title: "Next"
          },
          {
            ...getIndexedJsonObject(cards, 2),
            body: toBody(`Keep the tone ${structureContext.tone} for ${structureContext.audience}.`, "Keep the surface practical for the next operator."),
            title: "Keep nearby"
          }
        ],
        eyebrow: "Handoff",
        note: `${structureContext.note}. ${structureContext.objective}.`,
        summary: "Use the slide as a handoff surface: what matters now, what happens next, and what should stay in view.",
        title: currentSpec.title
      })
    }
  ].map((variant: LocalStructureVariant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Reframed the three cards around a clearer narrative role instead of only changing wording or visual tone.",
      "Kept the current slide family while changing how the viewer should read the sequence.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: variant.slideSpec
  }));
}

function createContentStructureCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const guardrails = asJsonObjectArray(currentSpec.guardrails);
  const signals = asJsonObjectArray(currentSpec.signals);

  return [
    {
      label: "Sequence structure",
      notes: "Turns the scorecard into a visible operating sequence from setup through validation.",
      promptSummary: "Uses outline and adjacent slide context to structure the slide around a stepwise path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Sequence",
        guardrails: [
          { ...getIndexedJsonObject(guardrails, 0), label: "selected slide", value: "1" },
          { ...getIndexedJsonObject(guardrails, 1), label: "working file", value: "1" },
          { ...getIndexedJsonObject(guardrails, 2), label: "apply step", value: "1" }
        ],
        guardrailsTitle: "Sequence guardrails",
        signals: [
          { ...getIndexedJsonObject(signals, 0), label: "brief", value: getIndexedJsonObject(signals, 0).value },
          { ...getIndexedJsonObject(signals, 2), label: "layout", value: getIndexedJsonObject(signals, 2).value },
          { ...getIndexedJsonObject(signals, 1), label: "render", value: getIndexedJsonObject(signals, 1).value },
          { ...getIndexedJsonObject(signals, 3), label: "validate", value: getIndexedJsonObject(signals, 3).value }
        ],
        signalsTitle: "Sequence checkpoints",
        summary: `Turn the slide into a visible path from ${structureContext.outlineCurrent} toward ${structureContext.outlineNext}.`,
        title: currentSpec.title
      })
    },
    {
      label: "Boundary structure",
      notes: "Splits the left and right columns into responsibility layers instead of a generic signal scorecard.",
      promptSummary: "Uses the saved slide intent and deck objective to structure the slide around ownership boundaries.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Boundaries",
        guardrails: [
          { ...getIndexedJsonObject(guardrails, 0), label: "slide source", value: "1" },
          { ...getIndexedJsonObject(guardrails, 1), label: "shared engine", value: "1" },
          { ...getIndexedJsonObject(guardrails, 2), label: "quality gate", value: "1" }
        ],
        guardrailsTitle: "Boundary checks",
        signals: [
          { ...getIndexedJsonObject(signals, 0), label: "authoring", value: getIndexedJsonObject(signals, 0).value },
          { ...getIndexedJsonObject(signals, 2), label: "system", value: getIndexedJsonObject(signals, 2).value },
          { ...getIndexedJsonObject(signals, 1), label: "runtime", value: getIndexedJsonObject(signals, 1).value },
          { ...getIndexedJsonObject(signals, 3), label: "gate", value: getIndexedJsonObject(signals, 3).value }
        ],
        signalsTitle: "Responsibility split",
        summary: "Separate authorship, runtime, and gatekeeping so the slide reads like a boundary map rather than a flat scorecard.",
        title: currentSpec.title
      })
    },
    {
      label: "Decision structure",
      notes: "Frames the slide around the next decision by pulling the main evidence, boundary, and next move into a clearer structure.",
      promptSummary: "Uses must-include and slide notes to structure the slide around a decision and handoff path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Decision",
        guardrails: [
          { ...getIndexedJsonObject(guardrails, 0), label: "must-show", value: "1" },
          { ...getIndexedJsonObject(guardrails, 1), label: "compare pass", value: "1" },
          { ...getIndexedJsonObject(guardrails, 2), label: "apply once", value: "1" }
        ],
        guardrailsTitle: "Decision checks",
        signals: [
          { ...getIndexedJsonObject(signals, 0), label: "claim", value: getIndexedJsonObject(signals, 0).value },
          { ...getIndexedJsonObject(signals, 3), label: "proof", value: getIndexedJsonObject(signals, 3).value },
          { ...getIndexedJsonObject(signals, 2), label: "boundary", value: getIndexedJsonObject(signals, 2).value },
          { ...getIndexedJsonObject(signals, 1), label: "next step", value: getIndexedJsonObject(signals, 1).value }
        ],
        signalsTitle: "Decision inputs",
        summary: `Use the slide to support one decision for ${structureContext.audience}, then hand off cleanly to ${structureContext.nextTitle}.`,
        title: currentSpec.title
      })
    }
  ].map((variant: LocalStructureVariant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Retitled the two panels and relabeled the rows so the slide reads like a clearer framework.",
      "Kept the content slide family while changing the structural role of each column.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: variant.slideSpec
  }));
}

function createSummaryStructureCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const bullets = asJsonObjectArray(currentSpec.bullets);
  const resources = asJsonObjectArray(currentSpec.resources);

  return [
    {
      label: "Operating structure",
      notes: "Turns the closing slide into a cleaner operating sequence instead of a loose recap.",
      promptSummary: "Uses the deck objective and slide outline to structure the checklist as a run path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...getIndexedJsonObject(bullets, 0), title: "Prepare", body: toBody(`Start with ${structureContext.outlineCurrent}.`, "Start with the saved setup.") },
          { ...getIndexedJsonObject(bullets, 1), title: "Run", body: toBody(`Move toward ${structureContext.outlineNext}.`, "Move through the active workflow.") },
          { ...getIndexedJsonObject(bullets, 2), title: "Check", body: toBody(structureContext.mustInclude, "Keep the final check visible.") }
        ],
        eyebrow: "Run path",
        resources: resources.map((item: JsonObject) => ({ ...item })),
        resourcesTitle: "Run surface",
        summary: "Structure the close as a run path: prepare, run, and check before handoff.",
        title: currentSpec.title
      })
    },
    {
      label: "Ownership structure",
      notes: "Reframes the close around which layer owns what so the repo boundary is easier to keep in mind.",
      promptSummary: "Uses slide intent, theme brief, and runtime boundaries to structure the summary by ownership.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...getIndexedJsonObject(bullets, 0), title: "Slide layer", body: toBody(structureContext.intent, "Keep slide-specific content local.") },
          { ...getIndexedJsonObject(bullets, 1), title: "Shared layer", body: toBody(structureContext.themeBrief, "Let the shared system carry layout rules.") },
          { ...getIndexedJsonObject(bullets, 2), title: "Gate layer", body: toBody(`Close with ${structureContext.note}.`, "Close with explicit validation.") }
        ],
        eyebrow: "Ownership",
        resources: resources.map((item: JsonObject) => ({ ...item })),
        resourcesTitle: "Where each part lives",
        summary: "Use the close to separate slide content, shared runtime concerns, and the final validation gate.",
        title: currentSpec.title
      })
    },
    {
      label: "Handoff structure",
      notes: "Frames the final slide for the next operator by separating what to do now, what happens next, and what to keep nearby.",
      promptSummary: "Uses audience, must-include, and notes to structure the close as a handoff surface.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...getIndexedJsonObject(bullets, 0), title: "Do now", body: toBody(structureContext.mustInclude, "Do the main thing now.") },
          { ...getIndexedJsonObject(bullets, 1), title: "Do next", body: toBody(`Set up ${structureContext.nextTitle}.`, "Set up the next move.") },
          { ...getIndexedJsonObject(bullets, 2), title: "Keep in view", body: toBody(structureContext.note, "Keep the review step visible.") }
        ],
        eyebrow: "Handoff",
        resources: resources.map((item: JsonObject) => ({ ...item })),
        resourcesTitle: "Keep nearby",
        summary: `Use the close as a handoff for ${structureContext.audience}: do one thing now, set up the next step, and keep the right references nearby.`,
        title: currentSpec.title
      })
    }
  ].map((variant: LocalStructureVariant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Rewrote the checklist roles so the close reads like a clearer structure rather than a loose recap.",
      "Kept the summary slide family while changing how the viewer should use the slide.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: variant.slideSpec
  }));
}

function collectFamilyChangeText(spec: unknown): string[] {
  const source = asJsonObject(spec);
  if (!Object.keys(source).length) {
    return [];
  }

  const parts = [
    source.eyebrow,
    source.title,
    source.summary,
    source.note,
    source.caption,
    source.context,
    source.quote,
    source.signalsTitle,
    source.guardrailsTitle,
    source.resourcesTitle
  ];

  ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
    if (!Array.isArray(source[field])) {
      return;
    }

    source[field].forEach((item: unknown) => {
      const entry = asJsonObject(item);
      parts.push(entry.title, entry.body, entry.label, entry.value);
    });
  });

  return parts
    .filter((part) => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstFamilyChangeText(spec: SlideSpec, fallback: unknown, maxWords = 18): string {
  return sentence(collectFamilyChangeText(spec).find((part: string) => part !== spec.title), fallback, maxWords);
}

function summarizeDroppedFamilyFields(currentSpec: SlideSpec, nextSpec: SlideSpec): string {
  const nextType = nextSpec.type;
  const dropped: string[] = [];

  [
    "cards",
    "signals",
    "guardrails",
    "bullets",
    "resources",
    "quote",
    "media",
    "mediaItems",
    "summary",
    "note",
    "caption"
  ].forEach((field) => {
    const nextValue = nextSpec[field];
    const currentValue = currentSpec[field];
    const explicitlyCleared = Object.hasOwn(nextSpec, field) && (
      nextValue === null ||
      (Array.isArray(currentValue) && currentValue.length > 0 && Array.isArray(nextValue) && nextValue.length === 0)
    );

    if (
      Object.hasOwn(currentSpec, field) &&
      (!Object.hasOwn(nextSpec, field) || explicitlyCleared) &&
      currentValue !== undefined &&
      currentValue !== null
    ) {
      dropped.push(field);
    }
  });

  if (!dropped.length) {
    return `Changed the slide family from ${currentSpec.type} to ${nextType} without dropping stored structured fields.`;
  }

  return `Changed the slide family from ${currentSpec.type} to ${nextType}; dropped ${dropped.slice(0, 4).join(", ")}${dropped.length > 4 ? ", ..." : ""} from the candidate spec.`;
}

function createFamilyChangeCandidate(currentSpec: SlideSpec, _structureContext: StructureContext, nextSpec: SlideSpec, details: FamilyChangeDetails, options: OperationOptions = {}): Candidate {
  const modeLabel = describeVariantPersistence(options);
  const slideSpec = asJsonObject(validateSlideSpec(nextSpec));

  return {
    changeSummary: [
      `Changed slide family from ${currentSpec.type} to ${slideSpec.type}.`,
      summarizeDroppedFamilyFields(currentSpec, slideSpec),
      details.preservation,
      modeLabel
    ],
    generator: "local",
    label: details.label,
    model: null,
    notes: details.notes,
    promptSummary: details.promptSummary,
    provider: "local",
    slideSpec
  };
}

function collectFamilyMediaItems(currentSpec: SlideSpec): JsonObject[] {
  if (Array.isArray(currentSpec.mediaItems) && currentSpec.mediaItems.length) {
    return currentSpec.mediaItems.map((item: unknown) => ({ ...asJsonObject(item) }));
  }

  if (currentSpec.media) {
    return [{ ...asJsonObject(currentSpec.media) }];
  }

  return [];
}

function createLocalFamilyChangeCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const candidates: Candidate[] = [];
  const baseTitle = sentence(currentSpec.title || structureContext.currentTitle, "Untitled slide", 8);
  const textClaim = firstFamilyChangeText(currentSpec, structureContext.mustInclude, 18);
  const mediaItems = collectFamilyMediaItems(currentSpec);

  if (!["divider"].includes(String(currentSpec.type))) {
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        index: currentSpec.index,
        layout: undefined,
        media: null,
        mediaItems: [],
        title: sentence(baseTitle, "Section break", 8),
        type: "divider"
      },
      {
        label: "Change family: divider",
        notes: "Turns the current slide into a title-only section marker.",
        preservation: "Preserved the current title as the divider text and removed body-level content.",
        promptSummary: "Converts the slide into a first-class divider candidate."
      },
      options
    ));
  }

  if (!["quote"].includes(String(currentSpec.type))) {
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        attribution: currentSpec.attribution,
        context: sentence(structureContext.intent, currentSpec.context || "", 16),
        index: currentSpec.index,
        layout: undefined,
        media: null,
        mediaItems: [],
        quote: textClaim,
        source: currentSpec.source,
        title: baseTitle,
        type: "quote"
      },
      {
        label: "Change family: quote",
        notes: "Turns the strongest available text into a dominant pull quote.",
        preservation: "Preserved one compact claim as the quote and kept attribution/source when available.",
        promptSummary: "Converts the slide into a quote-family candidate."
      },
      options
    ));
  }

  if (currentSpec.type !== "photo" && (currentSpec.media || mediaItems.length)) {
    const media = currentSpec.media ? { ...asJsonObject(currentSpec.media) } : { ...getIndexedJsonObject(mediaItems, 0) };
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        caption: sentence(currentSpec.caption || structureContext.intent, "Use the image as visual evidence.", 16),
        index: currentSpec.index,
        layout: undefined,
        media,
        mediaItems: [],
        title: baseTitle,
        type: "photo"
      },
      {
        label: "Change family: photo",
        notes: "Turns the slide into one dominant image with a compact caption.",
        preservation: "Preserved the first attached media item as the dominant photo.",
        promptSummary: "Converts the slide into a photo-family candidate."
      },
      options
    ));
  }

  if (currentSpec.type !== "photoGrid" && mediaItems.length >= 2) {
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        caption: sentence(currentSpec.caption || structureContext.intent, "Compare the image set.", 16),
        index: currentSpec.index,
        layout: undefined,
        media: null,
        mediaItems: mediaItems.slice(0, 3),
        summary: sentence(structureContext.mustInclude, currentSpec.summary || "", 16),
        title: baseTitle,
        type: "photoGrid"
      },
      {
        label: "Change family: photo grid",
        notes: "Turns attached images into a two-to-three image comparison grid.",
        preservation: "Preserved up to three attached media items and kept captions/source metadata with each image.",
        promptSummary: "Converts the slide into a photo-grid-family candidate."
      },
      options
    ));
  }

  return candidates;
}

function createLocalStructureCandidates(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext, options: OperationOptions = {}): Candidate[] {
  const structureContext = collectStructureContext(slide, currentSpec, context);
  const modeLabel = describeVariantPersistence(options);
  const withFamilyChanges = (candidates: Candidate[]): Candidate[] => [
    ...candidates,
    ...createLocalFamilyChangeCandidates(currentSpec, structureContext, options)
  ];

  if (currentSpec.type === "divider") {
    return withFamilyChanges([
      {
        label: "Boundary divider",
        notes: "Frames the divider as a boundary between the previous and next sections.",
        promptSummary: "Uses the adjacent slide titles to rewrite the divider as a clear boundary marker.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          title: sentence(`From ${structureContext.previousTitle} to ${structureContext.nextTitle}`, currentSpec.title, 8)
        })
      },
      {
        label: "Decision divider",
        notes: "Turns the divider into a short decision-stage heading.",
        promptSummary: "Uses the current outline and objective to rewrite the divider as a decision-stage title.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          title: sentence(`${structureContext.outlineCurrent}: the call`, currentSpec.title, 8)
        })
      },
      {
        label: "Operator divider",
        notes: "Reframes the divider around the operating routine the next section explains.",
        promptSummary: "Uses the saved notes and next-slide title to rewrite the divider as an operator-ready section marker.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          title: sentence(`Operating ${structureContext.nextTitle}`, currentSpec.title, 8)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the divider toward a ${variant.label.toLowerCase()}.`,
        "Changed the section title so the divider does more narrative work without adding body content.",
        "Kept the divider family title-only instead of expanding it into another content slide.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  if (currentSpec.type === "quote") {
    return withFamilyChanges([
      {
        label: "Claim quote",
        notes: "Turns the pull quote into a sharper claim for the current section.",
        promptSummary: "Uses the slide intent and surrounding titles to tighten the quote around one claim.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          context: sentence(`Sets up ${structureContext.nextTitle} for ${structureContext.audience}.`, currentSpec.context || "", 16),
          quote: sentence(structureContext.mustInclude, currentSpec.quote, 18),
          title: sentence(structureContext.outlineCurrent, currentSpec.title, 8)
        })
      },
      {
        label: "Evidence quote",
        notes: "Frames the quote as proof the audience should carry into the next slide.",
        promptSummary: "Uses the saved notes to rewrite the quote as compact evidence.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          context: sentence(structureContext.note, currentSpec.context || "Use this as compact evidence.", 16),
          quote: sentence(structureContext.intent, currentSpec.quote, 18)
        })
      },
      {
        label: "Handoff quote",
        notes: "Makes the quote point toward the next authoring or review action.",
        promptSummary: "Uses the next-slide title to make the quote act as a handoff.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          context: sentence(`Carry this into ${structureContext.nextTitle}.`, currentSpec.context || "", 14),
          quote: sentence(`The next move is ${structureContext.nextTitle}.`, currentSpec.quote, 14)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the quote toward a ${variant.label.toLowerCase()}.`,
        "Changed the quote/context while keeping the quote slide family intact.",
        "Kept attribution and source fields attached below the dominant quote.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  if (currentSpec.type === "photo") {
    return withFamilyChanges([
      {
        label: "Evidence photo",
        notes: "Frames the image as visual evidence for the current section.",
        promptSummary: "Uses the slide intent to retitle the photo as a proof point.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(structureContext.intent, currentSpec.caption || asJsonObject(currentSpec.media).caption || "", 16),
          title: sentence(structureContext.outlineCurrent, currentSpec.title, 8)
        })
      },
      {
        label: "Context photo",
        notes: "Makes the caption explain why the viewer should inspect the image.",
        promptSummary: "Uses saved notes and audience context to tighten the photo caption.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`For ${structureContext.audience}: ${structureContext.mustInclude}.`, currentSpec.caption || "", 16)
        })
      },
      {
        label: "Handoff photo",
        notes: "Points the visual toward the next slide's job.",
        promptSummary: "Uses the next-slide title to make the image act as a handoff.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`Use this image to set up ${structureContext.nextTitle}.`, currentSpec.caption || "", 14)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the photo toward a ${variant.label.toLowerCase()}.`,
        "Changed the title/caption while preserving the attached material.",
        "Kept the photo family and single-image structure intact.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  if (currentSpec.type === "photoGrid") {
    return withFamilyChanges([
      {
        label: "Comparison grid",
        notes: "Frames the image set as a direct comparison.",
        promptSummary: "Uses the slide intent to retitle the image grid as visual comparison.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(structureContext.intent, currentSpec.caption || currentSpec.summary || "", 16),
          title: sentence(structureContext.outlineCurrent, currentSpec.title, 8)
        })
      },
      {
        label: "Evidence grid",
        notes: "Makes the grid read as grouped evidence for the audience.",
        promptSummary: "Uses saved context to tighten the grid caption.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`For ${structureContext.audience}: ${structureContext.mustInclude}.`, currentSpec.caption || currentSpec.summary || "", 16)
        })
      },
      {
        label: "Handoff grid",
        notes: "Points the image set toward the next slide's job.",
        promptSummary: "Uses the next-slide title to make the image grid act as a handoff.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`Use these images to set up ${structureContext.nextTitle}.`, currentSpec.caption || currentSpec.summary || "", 14)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the photo grid toward a ${variant.label.toLowerCase()}.`,
        "Changed the title/caption while preserving the media item set.",
        "Kept the photo-grid family and fixed grid arrangement intact.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  switch (currentSpec.type) {
    case "cover":
    case "toc":
      return withFamilyChanges(createCardStructureCandidates(currentSpec, structureContext, options));
    case "content":
      return withFamilyChanges(createContentStructureCandidates(currentSpec, structureContext, options));
    case "summary":
      return withFamilyChanges(createSummaryStructureCandidates(currentSpec, structureContext, options));
    default:
      throw new Error(`Ideate Structure does not support slide type "${currentSpec.type}" yet`);
  }
}

function createInsertedDecisionCriteriaSlide(context: DeckStructureContext, proposedIndex: number): SlideSpec {
  return asJsonObject(validateSlideSpec({
    eyebrow: "Decision criteria",
    guardrails: [
      {
        body: "The slide must carry the claim, evidence, and next action.",
        id: `decision-criteria-guardrail-1`,
        title: "Must include"
      },
      {
        body: "Only the selected candidate should be promoted into the deck.",
        id: `decision-criteria-guardrail-2`,
        title: "Apply step"
      },
      {
        body: "The proof needs a visible preview before acceptance.",
        id: `decision-criteria-guardrail-3`,
        title: "Preview pass"
      }
    ],
    guardrailsTitle: "Decision checks",
    index: proposedIndex,
    signals: [
      {
        body: "Name the decision the audience should be able to make.",
        id: `decision-criteria-signal-1`,
        title: "Claim"
      },
      {
        body: "Show the structure options before judging them.",
        id: `decision-criteria-signal-2`,
        title: "Options"
      },
      {
        body: "Connect the proof slide to the shared runtime and validation path.",
        id: `decision-criteria-signal-3`,
        title: "Proof"
      },
      {
        body: "End with the concrete authoring or approval action.",
        id: `decision-criteria-signal-4`,
        title: "Action"
      }
    ],
    signalsTitle: "Decision inputs",
    summary: `Surface the criteria that connect ${context.slides[1] ? context.slides[1].currentTitle : "structure options"} to ${context.slides[2] ? context.slides[2].currentTitle : "proof"}.`,
    title: "Decision criteria",
    type: "content"
  }));
}

function createReplacementOperatorChecklistSlide(context: DeckStructureContext, proposedIndex: number, proposedTitle: string): SlideSpec {
  const proofSlide = context.slides.find((slide: DeckStructureSlide) => slide.index === 3);
  const proofTitle = proofSlide ? proofSlide.currentTitle : "the proof block";

  return asJsonObject(validateSlideSpec({
    bullets: [
      {
        body: `Restate the main decision with ${proofTitle} attached as the supporting evidence.`,
        id: "operator-checklist-bullet-1",
        title: "State the call"
      },
      {
        body: "Carry forward the guardrails and the one apply path before asking for sign-off.",
        id: "operator-checklist-bullet-2",
        title: "Carry the guardrails"
      },
      {
        body: "Close with the explicit next owner, timing, and preview check that keeps the deck honest.",
        id: "operator-checklist-bullet-3",
        title: "Name the next move"
      }
    ],
    eyebrow: "Operator checklist",
    index: proposedIndex,
    resources: [
      {
        body: "Saved outline plus promoted slide titles and order",
        id: "operator-checklist-resource-1",
        title: "Plan source",
        bodyFontSize: 10.8
      },
      {
        body: "Preview rebuild plus npm run quality:gate",
        id: "operator-checklist-resource-2",
        title: "Approval gate",
        bodyFontSize: 10.8
      }
    ],
    resourcesTitle: "Keep nearby",
    summary: `Replace the closing slide with one operator-ready checklist that turns ${proofTitle} into an explicit handoff.`,
    title: proposedTitle || "Operator checklist",
    type: "summary"
  }));
}

function createDeckWideAuthoringPlan(context: DeckStructureContext, definition: DeckWideAuthoringDefinition): JsonObject {
  return createDeckStructurePlan(context, {
    ...definition,
    kindLabel: String(definition.kindLabel || "Deck authoring"),
    replacements: context.slides.map((slide: DeckStructureSlide, index: number) => ({
      createSlideSpec: (currentContext: DeckStructureContext, proposedIndex: number, proposedTitle: string, currentSlide: DeckStructureSlide) => {
        const currentSpec = asJsonObject(readSlideSpec(currentSlide.id));
        return definition.createSlideSpec(currentContext, {
          currentSlide,
          currentSpec,
          index,
          proposedIndex,
          proposedTitle
        });
      },
      currentIndex: slide.index,
      slideId: slide.id,
      summary: typeof definition.replacementSummary === "function"
        ? definition.replacementSummary(slide, index)
        : `Rewrite ${slide.currentTitle} as part of the ${definition.label.toLowerCase()} pass.`,
      type: slide.type || "content"
    })),
    titles: Array.isArray(definition.titles) ? definition.titles.map((title: unknown) => String(title || "")) : []
  });
}

function describeDeckPlanAction({ moved, replaced, retitled }: DeckPlanActionFlags): string {
  if (moved && retitled && replaced) {
    return "move-retitle-and-replace";
  }

  if (moved && replaced) {
    return "move-and-replace";
  }

  if (retitled && replaced) {
    return "retitle-and-replace";
  }

  if (replaced) {
    return "replace";
  }

  if (moved && retitled) {
    return "move-and-retitle";
  }

  if (moved) {
    return "move";
  }

  if (retitled) {
    return "retitle";
  }

  return "keep";
}

function matchesDeckPlanSlide(entry: DeckPlanEntry, slide: DeckStructureSlide, sourceIndex: number): boolean {
  return (
    (typeof entry.slideId === "string" && entry.slideId === slide.id)
    || (Number.isFinite(entry.currentIndex) && entry.currentIndex === slide.index)
    || (Number.isFinite(entry.sourceIndex) && entry.sourceIndex === sourceIndex)
  );
}

function buildRemovedDeckPlanEntry(context: DeckStructureContext, removal: DeckPlanEntry, index: number): DeckPlanEntry | null {
  const sourceIndex = Number.isFinite(removal.sourceIndex)
    ? Number(removal.sourceIndex)
    : context.slides.findIndex((slide: DeckStructureSlide) => (
      (typeof removal.slideId === "string" && removal.slideId === slide.id)
      || (Number.isFinite(removal.currentIndex) && removal.currentIndex === slide.index)
    ));
  const slide = context.slides[sourceIndex];

  if (!slide) {
    return null;
  }

  return {
    action: "remove",
    currentIndex: slide.index,
    currentTitle: slide.currentTitle,
    proposedIndex: null,
    proposedTitle: "",
    rationale: removal.rationale || removal.summary || `Remove ${slide.currentTitle} from the live deck path.`,
    replacement: null,
    role: removal.role || `Removed beat ${index + 1}`,
    slideId: slide.id,
    summary: removal.summary || `Archive ${slide.currentTitle} so the remaining deck moves faster.`,
    type: slide.type
  };
}

function restoreDeckStructurePreviewState(originalSpecs: Map<string, SlideSpec>): void {
  originalSpecs.forEach((slideSpec: SlideSpec, slideId: string) => {
    writeSlideSpec(slideId, slideSpec);
  });

  const currentSlides = getSlides({ includeArchived: true });
  currentSlides.forEach((slide: SlideRecord) => {
    if (!originalSpecs.has(slide.id)) {
      if (typeof slide.path === "string") {
        removeAllowedPath(slide.path, { force: true });
      }
    }
  });
}

async function renderDeckStructureCandidatePreview(candidate: DeckStructureCandidate): Promise<void> {
  const originalSlides = getSlides({ includeArchived: true });
  const originalSpecs = new Map<string, SlideSpec>(originalSlides.map((slide: SlideRecord) => [slide.id, asJsonObject(readSlideSpec(slide.id))]));
  const originalContext = getDeckContext();
  const { deckStructurePreviewDir, previewDir } = getOutputConfig();
  const candidateDir = path.join(deckStructurePreviewDir, candidate.id);
  const currentRenderedPages = listPages(previewDir);

  ensureAllowedDir(deckStructurePreviewDir);
  removeAllowedPath(candidateDir, { force: true, recursive: true });
  ensureAllowedDir(candidateDir);

  try {
    const currentCopiedPages = currentRenderedPages.map((pageFile: string, index: number) => {
      const targetPath = path.join(candidateDir, `before-page-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);
      return targetPath;
    });
    const currentStripPath = path.join(candidateDir, "current-strip.png");
    if (currentCopiedPages.length) {
      await createContactSheet(currentCopiedPages, currentStripPath);
    }

    applyDeckStructurePlan({
      deckPatch: candidate.deckPatch,
      label: candidate.label,
      outline: candidate.outline,
      slides: candidate.slides,
      summary: candidate.summary
    });

    await applyDeckStructureCandidate(candidate, {
      promoteIndices: true,
      promoteInsertions: true,
      promoteRemovals: true,
      promoteReplacements: true,
      promoteTitles: true
    });

    const renderedPages = listPages(previewDir);
    const copiedPages = renderedPages.map((pageFile: string, index: number) => {
      const targetPath = path.join(candidateDir, `page-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);
      return targetPath;
    });
    const stripPath = path.join(candidateDir, "strip.png");
    await createContactSheet(copiedPages, stripPath);

    const preview = candidate.preview || {};
    const previewHints = asJsonObjectArray(preview.previewHints);
    const renderedHints = previewHints.map((hint: JsonObject, index: number) => {
      const proposedIndex = Number(hint.proposedIndex);
      const pageFile = Number.isFinite(proposedIndex) ? copiedPages[proposedIndex - 1] : null;

      if (!pageFile || !fs.existsSync(pageFile)) {
        return {
          ...hint,
          proposedPreview: null
        };
      }

      const targetPath = path.join(candidateDir, `hint-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);

      return {
        ...hint,
        proposedPreview: {
          fileName: path.basename(targetPath),
          url: asAssetUrl(targetPath)
        }
      };
    });

    candidate.preview = {
      ...preview,
      currentStrip: fs.existsSync(currentStripPath)
        ? {
          fileName: path.basename(currentStripPath),
          pageCount: currentCopiedPages.length,
          url: asAssetUrl(currentStripPath)
        }
        : null,
      previewHints: renderedHints,
      strip: {
        fileName: path.basename(stripPath),
        pageCount: copiedPages.length,
        url: asAssetUrl(stripPath)
      }
    };
  } finally {
    restoreDeckStructurePreviewState(originalSpecs);
    saveDeckContext(originalContext);
    await buildAndRenderDeck();
  }
}

function buildDeckPlanEntries(context: DeckStructureContext, definition: DeckStructureDefinition): DeckPlanEntry[] {
  const insertions = Array.isArray(definition.insertions) ? definition.insertions.slice() : [];
  const removals = Array.isArray(definition.removals) ? definition.removals.slice() : [];
  const replacements = Array.isArray(definition.replacements) ? definition.replacements.slice() : [];
  const roles = Array.isArray(definition.roles) ? definition.roles : [];
  const titles = Array.isArray(definition.titles) ? definition.titles.map((title: unknown) => String(title || "")) : [];
  const focusItems = Array.isArray(definition.focus) ? definition.focus : [];
  const rationales = Array.isArray(definition.rationales) ? definition.rationales : [];
  const hasSourceSlide = (sourceIndex: unknown): sourceIndex is number => {
    const numericIndex = Number(sourceIndex);
    return Number.isInteger(numericIndex)
      && numericIndex >= 0
      && numericIndex < context.slides.length;
  };
  const removalSourceIndexes = new Set(
    removals
      .map((entry: DeckPlanRemoval) => {
        if (Number.isFinite(entry.sourceIndex)) {
          return entry.sourceIndex;
        }

        return context.slides.findIndex((slide: DeckStructureSlide, sourceIndex: number) => matchesDeckPlanSlide(entry, slide, sourceIndex));
      })
      .filter(hasSourceSlide)
  );
  const keptOrder = Array.isArray(definition.order) && definition.order.length
    ? definition.order.filter((sourceIndex: number) => hasSourceSlide(sourceIndex) && !removalSourceIndexes.has(sourceIndex))
    : context.slides
      .map((_slide: DeckStructureSlide, index: number) => index)
      .filter((sourceIndex: number) => !removalSourceIndexes.has(sourceIndex));
  const totalEntries = keptOrder.length + insertions.length;
  const entries: DeckPlanEntry[] = [];
  let existingCursor = 0;

  for (let proposedPosition = 0; proposedPosition < totalEntries; proposedPosition += 1) {
    const insertion = insertions.find((entry: DeckPlanInsertion) => entry.proposedIndex === proposedPosition + 1);
    const role = roles[proposedPosition] || `Beat ${proposedPosition + 1}`;
    const title = titles[proposedPosition];
    const focus = focusItems[proposedPosition];
    const rationale = rationales[proposedPosition] || focus || role;

    if (insertion) {
      const insertedTitle = title || insertion.title;
      entries.push({
        action: "insert",
        currentIndex: null,
        currentTitle: "",
        proposedIndex: proposedPosition + 1,
        proposedTitle: insertedTitle || "Inserted slide",
        rationale,
        role,
        scaffold: {
          slideSpec: insertion.createSlideSpec(context, proposedPosition + 1)
        },
        slideId: null,
        summary: focus || insertion.summary || rationale,
        type: insertion.type || "content"
      });
      continue;
    }

    const sourceIndex = keptOrder[existingCursor];
    const slide = typeof sourceIndex === "number" ? context.slides[sourceIndex] : undefined;
    existingCursor += 1;
    if (!slide) {
      continue;
    }

    const nextTitle = title || slide.outlineLine || slide.currentTitle;
    const nextFocus = focus || slide.intent;
    const moved = slide.index !== proposedPosition + 1;
    const retitled = normalizeSentence(nextTitle).toLowerCase() !== normalizeSentence(slide.currentTitle).toLowerCase();
    const replacement = typeof sourceIndex === "number"
      ? replacements.find((entry: DeckPlanReplacement) => matchesDeckPlanSlide(entry, slide, sourceIndex))
      : undefined;
    const replacementSlideSpec = replacement && typeof replacement.createSlideSpec === "function"
      ? replacement.createSlideSpec(context, proposedPosition + 1, nextTitle, slide)
      : null;
    const replaced = Boolean(replacementSlideSpec);
    const action = describeDeckPlanAction({ moved, replaced, retitled });

    entries.push({
      action,
      currentIndex: slide.index,
      currentTitle: slide.currentTitle,
      proposedIndex: proposedPosition + 1,
      proposedTitle: nextTitle,
      rationale,
      replacement: replacementSlideSpec
        ? {
          slideSpec: replacementSlideSpec
        }
        : null,
      role,
      slideId: slide.id,
      summary: replacement && replacement.summary ? replacement.summary : nextFocus,
      type: replacement && replacement.type ? replacement.type : slide.type
    });
  }

  removals
    .map((removal: DeckPlanRemoval, index: number) => buildRemovedDeckPlanEntry(context, removal, index))
    .filter((entry: DeckPlanEntry | null): entry is DeckPlanEntry => Boolean(entry))
    .forEach((entry: DeckPlanEntry) => entries.push(entry));

  return entries;
}

function createDeckStructurePlan(context: DeckStructureContext, definition: DeckStructureDefinition): JsonObject {
  const slides = buildDeckPlanEntries(context, definition);
  const planStats = collectDeckPlanStats(slides);
  const deckPatch = definition && definition.deckPatch && typeof definition.deckPatch === "object"
    ? definition.deckPatch
    : null;
  const diff = buildDeckPlanDiff(context, slides, planStats, deckPatch);
  planStats.shared = diff.deck && Number.isFinite(diff.deck.count) ? Number(diff.deck.count) : 0;
  const preview = buildDeckPlanPreview(context, slides, planStats, diff.deck);

  return {
    changeSummary: buildDeckPlanChangeSummary(definition, preview),
    deckPatch,
    id: `deck-structure-${definition.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    kindLabel: definition.kindLabel || "Deck plan",
    label: definition.label,
    notes: definition.notes,
    outline: slides
      .filter((slide) => Number.isFinite(slide.proposedIndex) && slide.proposedTitle)
      .map((slide) => slide.proposedTitle)
      .join("\n"),
    diff,
    planStats,
    preview,
    promptSummary: definition.promptSummary,
    slides,
    summary: definition.summary
  };
}

function createLocalDeckStructureCandidates(context: DeckContext): JsonObject[] {
  const structureContext = collectDeckStructureContext(context);
  const currentLines = structureContext.slides.map((slide) => slide.outlineLine);
  const currentTitles = structureContext.slides.map((slide) => slide.currentTitle);
  const fallbackTitles = currentLines.length ? currentLines : currentTitles;

  return [
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck as a clearer start-to-finish operating sequence.",
      deckPatch: createSequenceDeckPatch(),
      focus: [
        `Open with the main claim for ${structureContext.audience}.`,
        "Show the shared system that makes the claim hold together.",
        "Put the strongest evidence and constraints in one place.",
        "Close on the operating or handoff path."
      ],
      label: "Sequence-led structure",
      notes: "Turns the deck into a stepwise path from framing through proof and handoff.",
      promptSummary: "Uses the deck objective and saved outline to build a cleaner sequence across the whole deck.",
      rationales: [
        "Keep the first slide as the frame so the deck states its claim immediately.",
        "Use the second slide to explain the shared system before proof details land.",
        "Let the third slide carry the strongest evidence and constraints.",
        "Reserve the final slide for the concrete handoff or next step."
      ],
      roles: ["Frame", "System", "Proof", "Handoff"],
      summary: `Organize the deck as a sequence that moves from ${fallbackTitles[0] || "framing"} toward ${fallbackTitles[fallbackTitles.length - 1] || "handoff"}.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        fallbackTitles[1] || "Shared system",
        fallbackTitles[2] || "Proof and guardrails",
        fallbackTitles[3] || "What to do next"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around ownership boundaries instead of a linear walkthrough.",
      deckPatch: createBoundaryDeckPatch(),
      focus: [
        "Start by showing what belongs in the deck itself.",
        "Make the validation and boundary logic explicit before the shared runtime details.",
        "Clarify which concerns belong to the shared runtime.",
        "Close on what the next operator should keep in view."
      ],
      label: "Boundary-led structure",
      notes: "Frames the presentation around authorship, runtime, validation, and handoff boundaries.",
      order: [0, 2, 1, 3],
      promptSummary: "Uses deck constraints, theme brief, and current slide roles to build a clearer ownership map.",
      rationales: [
        "Keep the first slide focused on what the deck owns.",
        "Move the proof slide earlier so the validation boundary is visible before runtime details.",
        "Push the shared runtime explanation after the validation frame.",
        "Close on handoff so the operator leaves with a clear next move."
      ],
      roles: ["Authoring", "Guardrails", "Runtime", "Handoff"],
      summary: `Organize the deck as a boundary map so ${structureContext.constraints}.`,
      titles: [
        "Slide-owned content",
        "Validation guardrails",
        "Shared runtime system",
        "Editor handoff"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around one decision path rather than a general demo tour.",
      deckPatch: createDecisionDeckPatch(structureContext),
      focus: [
        "Open with the core decision or claim the deck needs to support.",
        "Show the options or structure that shape that decision.",
        "Insert one explicit criteria slide before the proof block so the decision rules are visible.",
        "Make the strongest proof and operational limits explicit.",
        "Close on the action the team should take next."
      ],
      insertions: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number) => createInsertedDecisionCriteriaSlide(context, proposedIndex),
          proposedIndex: 3,
          summary: "Insert one decision-criteria slide to bridge the options and proof sections.",
          title: "Decision criteria",
          type: "content"
        }
      ],
      label: "Decision-led structure",
      notes: "Turns the presentation into a decision-support flow aimed at a concrete next move.",
      promptSummary: "Uses audience, objective, and saved notes to build a more decision-oriented presentation structure.",
      rationales: [
        "Keep the opening slide focused on the decision instead of a generic intro.",
        "Use the second slide to surface the available structure options.",
        "Add one explicit criteria slide so the audience sees how options are judged before proof lands.",
        "Let the third slide act as the proof block that narrows the decision.",
        "Turn the final slide into the explicit action to take next."
      ],
      roles: ["Decision", "Options", "Criteria", "Evidence", "Action"],
      summary: `Organize the deck around one decision path for ${structureContext.audience}, then close on the next action.`,
      titles: [
        "The decision to make",
        "The structure options",
        "Decision criteria",
        "The proof and limits",
        "The next action"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around a stronger operator handoff by replacing the closing slide with a checklist scaffold.",
      deckPatch: createOperatorDeckPatch(),
      focus: [
        "Open with the deck claim and keep the audience anchored on the decision.",
        "Use the structure slide to show the available paths before the proof lands.",
        "Keep the proof slide focused on evidence and limits.",
        "Replace the final slide with an operator checklist that turns the proof into an explicit handoff."
      ],
      label: "Operator-checklist structure",
      notes: "Keeps the current deck length but repurposes the closing slot into a more operational summary surface.",
      promptSummary: "Uses the saved objective and tone to turn the final slide into an operator-ready checklist instead of a generic summary.",
      rationales: [
        "Keep the opening claim visible so the rest of the deck still has a clear frame.",
        "Use the second slide to orient the audience before the proof block.",
        "Leave the third slide as the concentrated evidence layer.",
        "Replace the last slide with one checklist surface so the deck ends on a concrete handoff."
      ],
      replacements: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number, proposedTitle: string) => createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle),
          currentIndex: 4,
          summary: "Replace the final summary slide with an operator checklist that names the decision, guardrails, and next owner.",
          type: "summary"
        }
      ],
      roles: ["Frame", "Orientation", "Proof", "Checklist"],
      summary: `Organize the deck as a proof-backed handoff for ${structureContext.audience}, then replace the closing slide with an explicit operator checklist.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        "The structure map",
        fallbackTitles[2] || "Proof and guardrails",
        "Operator checklist"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Compressed the deck by archiving the explicit outline slide and moving straight from framing to proof to handoff.",
      deckPatch: createCompressedDeckPatch(),
      focus: [
        "Open with the core claim and keep the audience oriented on the decision.",
        "Move directly into proof and operating limits without restating the outline.",
        "Close on the operator-facing handoff."
      ],
      label: "Compressed proof structure",
      notes: "Shortens the deck to three live slides by archiving the outline beat instead of deleting its source file.",
      order: [0, 2, 3],
      promptSummary: "Uses the saved outline and objective to collapse the deck into a shorter frame-proof-handoff path.",
      rationales: [
        "Keep the opening claim so the deck still has a clear frame.",
        "Move straight into the proof block once the audience has the frame.",
        "End on the handoff instead of keeping a separate outline recap."
      ],
      removals: [
        {
          currentIndex: 2,
          rationale: "Archive the outline slide once the opening frame already explains the path.",
          role: "Archived outline",
          summary: "Remove the explicit outline slide from the live deck while keeping its source file recoverable."
        }
      ],
      roles: ["Frame", "Proof", "Handoff"],
      summary: `Compress the deck for ${structureContext.audience} by archiving the outline beat and moving directly from frame to proof to handoff.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        fallbackTitles[2] || "Proof and guardrails",
        "Operator handoff"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Composed a tighter decision path by archiving the outline slide, inserting explicit criteria, and replacing the close with an operator checklist.",
      deckPatch: createComposedDecisionHandoffDeckPatch(structureContext),
      focus: [
        "Open with the decision or claim the audience needs to make.",
        "Insert one compact criteria slide immediately so the audience knows how options will be judged.",
        "Move from criteria into proof and constraints without the separate outline beat.",
        "Replace the final close with an operator checklist that turns the proof into an explicit handoff."
      ],
      insertions: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number) => createInsertedDecisionCriteriaSlide(context, proposedIndex),
          proposedIndex: 2,
          summary: "Insert a compact criteria slide before the proof block so the decision rules are visible early.",
          title: "Decision criteria",
          type: "content"
        }
      ],
      label: "Composed decision handoff",
      notes: "Combines archive, insert, replacement, retitle, and reorder moves into one guarded deck-level compose pass.",
      order: [0, 2, 3],
      promptSummary: "Uses the saved objective and outline to compose one tighter decision-support deck path with explicit criteria and handoff scaffolding.",
      rationales: [
        "Keep the opening slide focused on the decision instead of re-explaining the outline.",
        "Insert criteria before the proof so the audience knows how evidence will be judged.",
        "Let the proof slide narrow the decision with the strongest constraints in one place.",
        "Replace the final close with a checklist so the deck ends on a concrete operating handoff."
      ],
      removals: [
        {
          currentIndex: 2,
          rationale: "Archive the explicit outline beat once the deck already moves as a clear decision path.",
          role: "Archived outline",
          summary: "Remove the separate outline slide from the live deck while keeping the source file available."
        }
      ],
      replacements: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number, proposedTitle: string) => createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle),
          currentIndex: 4,
          summary: "Replace the closing summary with an operator checklist that carries the decision and guardrails into execution.",
          type: "summary"
        }
      ],
      roles: ["Decision", "Criteria", "Proof", "Checklist"],
      summary: `Compose the deck into a tighter decision-support path for ${structureContext.audience} by combining criteria, proof, and handoff in one guarded plan.`,
      titles: [
        "The decision to make",
        "Decision criteria",
        "The proof and limits",
        "Operator checklist"
      ]
    }),
    createDeckWideAuthoringPlan(structureContext, {
      changeLead: "Rewrote the full deck around one explicit decision path so every live slide carries claim, proof, and next action language.",
      createSlideSpec: (currentContext: DeckStructureContext, details: DeckWideAuthoringDetails) => {
        const objective = currentContext.objective;
        const audience = currentContext.audience;
        const baseSpec = details.currentSpec;

        switch (baseSpec.type) {
          case "divider":
            return rewriteDividerSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle);
          case "quote":
            return rewriteQuoteSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              attribution: "Decision path",
              context: `Use this pull quote to keep ${audience} focused on the approval call.`,
              quote: "A deck earns trust when the decision, proof, and next move stay visible.",
              source: "Authored deck copy"
            });
          case "photo":
            return rewritePhotoSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Use the image as visual evidence for the decision, proof, and next move."
            });
          case "photoGrid":
            return rewritePhotoGridSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Use the image set as visual evidence for the decision, proof, and next move.",
              summary: "Keep the grid focused on comparison, proof, and the next action."
            });
          case "cover":
            return rewriteCoverSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: `State the decision clearly for ${audience} before showing tooling detail.`,
                  title: "Decision"
                },
                {
                  body: "Make the judging criteria visible so the audience knows how proof will be read.",
                  title: "Criteria"
                },
                {
                  body: "Close the opener on the concrete move the team should approve next.",
                  title: "Next move"
                }
              ],
              eyebrow: "Decision",
              note: "Carry one claim, the evaluation criteria, and the next move through the whole deck.",
              summary: `Frame the presentation as one decision-support path that helps ${audience} ${objective}.`
            });
          case "toc":
            return rewriteTocSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "Open with the decision and the audience context instead of a generic product tour.",
                  title: "Frame the call"
                },
                {
                  body: "Show the shared runtime and the checks that explain why the decision is defensible.",
                  title: "Explain the system"
                },
                {
                  body: "End on proof, limits, and the concrete approval step.",
                  title: "Approve the move"
                }
              ],
              eyebrow: "Path",
              note: "The outline should read like a decision path, not a neutral contents page.",
              summary: `Map the deck as a short path from framing through proof to the next move for ${audience}.`
            });
          case "content":
            return rewriteContentSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              eyebrow: "Evidence",
              guardrails: [
                {
                  body: `Keep the live path to ${currentContext.slides.length} reviewed slides.`,
                  title: "Slides in path"
                },
                {
                  body: "Ask for one explicit approval after comparison.",
                  title: "Approval step"
                },
                {
                  body: "Run the local quality gate before archive update.",
                  title: "Quality gate"
                }
              ],
              guardrailsTitle: "Decision guardrails",
              signals: [
                {
                  body: "The slide should state the decision the deck supports.",
                  title: "Claim"
                },
                {
                  body: "The runtime path explains why the claim is maintainable.",
                  title: "System"
                },
                {
                  body: "Validation and baseline checks make the proof inspectable.",
                  title: "Proof"
                },
                {
                  body: "The final slide should name the next authoring action.",
                  title: "Action"
                }
              ],
              signalsTitle: "Decision signals",
              summary: "Concentrate the strongest proof and operating limits on one slide before asking for approval."
            });
          case "summary":
            return rewriteSummarySlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              bullets: [
                {
                  body: "Restate the decision in one sentence so the close names the actual call to make.",
                  title: "Approve the call"
                },
                {
                  body: "Name the owner, timing, and apply step so the audience knows what happens next.",
                  title: "Assign the next move"
                },
                {
                  body: "Run the rebuild and validation gate before treating the deck as approved output.",
                  title: "Validate the result"
                }
              ],
              eyebrow: "Action",
              resources: [
                {
                  body: "slides/output/<presentation-id>.pdf",
                  title: "Approval artifact"
                },
                {
                  body: "npm run quality:gate",
                  title: "Final check"
                }
              ],
              resourcesTitle: "Decision support",
              summary: `Close on an explicit approval path so ${audience} can act on the deck without guessing.`
            });
          default:
            return baseSpec;
        }
      },
      focus: [
        "Open on the decision and the audience context instead of a generic demo frame.",
        "Turn the outline into an explicit path from framing through proof to approval.",
        "Make the strongest evidence and operating limits visible on one concentrated slide.",
        "Close on approval, ownership, and the validation step."
      ],
      deckPatch: createDecisionDeckPatch(structureContext),
      kindLabel: "Deck authoring",
      label: "Decision narrative authoring",
      notes: "Batch-authors every live slide so the whole deck reads as one decision path instead of a demo tour.",
      promptSummary: "Uses the saved deck objective and audience to rewrite the current slide files into a tighter decision-support narrative.",
      rationales: [
        "Retitle and rewrite the opener so the whole deck starts on the decision to make.",
        "Rewrite the outline slide as a real narrative path instead of a neutral contents list.",
        "Turn the evidence slide into an explicit proof-and-guardrails surface.",
        "Close on approval, ownership, and the final validation step."
      ],
      replacementSummary: (slide: DeckStructureSlide) => `Rewrite ${slide.currentTitle} so it supports the full-deck decision narrative instead of only its current local role.`,
      roles: ["Decision", "Path", "Evidence", "Approval"],
      summary: `Rewrite the live deck for ${structureContext.audience} as one decision narrative with explicit proof and action language.`,
      titles: [
        "The decision to make",
        "The decision path",
        "Evidence and guardrails",
        "Approve the next move"
      ]
    }),
    createDeckWideAuthoringPlan(structureContext, {
      changeLead: "Rewrote the full deck as an operator-facing handoff so every slide carries maintenance, validation, and ownership language.",
      createSlideSpec: (currentContext: DeckStructureContext, details: DeckWideAuthoringDetails) => {
        const objective = currentContext.objective;
        const baseSpec = details.currentSpec;

        switch (baseSpec.type) {
          case "divider":
            return rewriteDividerSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle);
          case "quote":
            return rewriteQuoteSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              attribution: "Operator handoff",
              context: `Use this pull quote to keep ${objective} attached to validation and ownership.`,
              quote: "A maintained deck keeps the source, preview, and validation path in the same loop.",
              source: "Authored deck copy"
            });
          case "photo":
            return rewritePhotoSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Keep the image attached to the source, preview, and validation loop."
            });
          case "photoGrid":
            return rewritePhotoGridSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Keep the image set attached to the source, preview, and validation loop.",
              summary: "Use the grid to compare maintained artifacts without losing provenance."
            });
          case "cover":
            return rewriteCoverSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "State what the deck must preserve when someone new edits or extends it.",
                  title: "Hold the source"
                },
                {
                  body: "Make the runtime and layout rules readable before any edits are proposed.",
                  title: "Understand the system"
                },
                {
                  body: "Leave the opener with the one approval gate the next operator must run.",
                  title: "Keep the gate"
                }
              ],
              eyebrow: "Operator",
              note: "Treat the deck as a maintained system: source, runtime, preview, and validation stay connected.",
              summary: `Frame the deck as an operator handoff that helps the next editor ${objective}.`
            });
          case "toc":
            return rewriteTocSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "Start with the authoring boundary so slide-specific and shared logic do not blur together.",
                  title: "Authoring boundary"
                },
                {
                  body: "Show how the runtime and preview loop keep structure, rendering, and state aligned.",
                  title: "Runtime loop"
                },
                {
                  body: "End on validation and handoff so the operating routine is explicit.",
                  title: "Validation routine"
                }
              ],
              eyebrow: "Routine",
              note: "The outline should read like a maintenance loop for the next operator.",
              summary: "Map the deck as one operating routine from authoring boundary through runtime checks to handoff."
            });
          case "content":
            return rewriteContentSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              eyebrow: "Guardrails",
              guardrails: [
                {
                  body: `Keep edits scoped to the ${currentContext.slides.length} active slide files.`,
                  title: "Slide files"
                },
                {
                  body: "Keep browser preview and export on the shared DOM path.",
                  title: "Runtime path"
                },
                {
                  body: "Treat render validation as the handoff gate.",
                  title: "Render gate"
                }
              ],
              guardrailsTitle: "Operating guardrails",
              signals: [
                {
                  body: "Deck context and slide specs describe the intended edit.",
                  title: "Authoring"
                },
                {
                  body: "The DOM renderer owns preview and exported output.",
                  title: "Runtime"
                },
                {
                  body: "Compare surfaces show candidates before apply.",
                  title: "Preview"
                },
                {
                  body: "The quality gate confirms text, layout, media, and render state.",
                  title: "Validation"
                }
              ],
              signalsTitle: "Operating signals",
              summary: "Make the runtime signals and validation guardrails explicit so the next editor knows what keeps the deck stable."
            });
          case "summary":
            return rewriteSummarySlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              bullets: [
                {
                  body: "Save the brief, context, and structure plan before changing slide files.",
                  title: "Carry the context"
                },
                {
                  body: "Rebuild previews after edits so the working deck stays visible and comparable.",
                  title: "Rebuild the truth"
                },
                {
                  body: "Run the quality gate before treating the change as a finished handoff.",
                  title: "Close the gate"
                }
              ],
              eyebrow: "Handoff",
              resources: [
                {
                  body: "presentations/<id>/state/deck-context.json",
                  title: "Saved context"
                },
                {
                  body: "render baseline + npm run quality:gate",
                  title: "Gate surface"
                }
              ],
              resourcesTitle: "Keep nearby",
              summary: "End with the concrete operating routine the next editor should follow before shipping a change."
            });
          default:
            return baseSpec;
        }
      },
      focus: [
        "Open on the maintenance contract the next editor must preserve.",
        "Explain the operating routine instead of only listing sections.",
        "Show the signals and guardrails that keep the deck stable.",
        "End on the handoff checklist the next editor should follow."
      ],
      deckPatch: createOperatorDeckPatch(),
      kindLabel: "Deck authoring",
      label: "Operator handoff authoring",
      notes: "Batch-authors every live slide around ownership boundaries, runtime routine, and the operator-facing validation loop.",
      promptSummary: "Uses the saved constraints, objective, and theme brief to rewrite the live deck as an operator handoff rather than a product demo.",
      rationales: [
        "Rewrite the opener so the deck starts on the maintenance contract instead of the demo surface.",
        "Turn the outline into an operating routine the next editor can actually follow.",
        "Make the proof slide explicitly about signals and guardrails that keep the deck stable.",
        "Finish on a checklist-style handoff for the next editor."
      ],
      replacementSummary: (slide: DeckStructureSlide) => `Rewrite ${slide.currentTitle} so it contributes to one operator-facing handoff across the full deck.`,
      roles: ["Contract", "Routine", "Guardrails", "Handoff"],
      summary: `Rewrite the live deck as an operator handoff so the next editor can maintain the system without reconstructing the workflow.`,
      titles: [
        "What the deck must hold",
        "How the deck is maintained",
        "What keeps it stable",
        "Operator handoff"
      ]
    })
  ];
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

async function materializeCandidatesToVariants(slideId: string, candidates: unknown, options: OperationOptions = {}): Promise<JsonObject[]> {
  const createdVariants: JsonObject[] = [];

  for (const candidate of asJsonObjectArray(candidates)) {
    const slideSpec = applyCandidateSlideDefaults(candidate.slideSpec, options.baseSlideSpec);
    const source = serializeSlideSpec(slideSpec);
    const variant = createTransientVariant({
      changeSummary: candidate.changeSummary,
      generator: candidate.generator,
      kind: "generated",
      label: options.labelFormatter ? options.labelFormatter(String(candidate.label || "")) : candidate.label,
      layoutDefinition: candidate.layoutDefinition || null,
      layoutPreview: candidate.layoutPreview || null,
      model: candidate.model,
      notes: candidate.notes,
      operation: options.operation,
      operationScope: candidate.operationScope || null,
      promptSummary: candidate.promptSummary,
      provider: candidate.provider,
      remediationStrategy: candidate.remediationStrategy,
      sourceIssues: candidate.sourceIssues,
      changeScope: candidate.changeScope,
      slideId,
      slideSpec,
      source,
      visualTheme: candidate.visualTheme || null
    });
    const previewImage = await renderVariantPreview(slideId, slideSpec, String(variant.id || ""), candidate.visualTheme);
    createdVariants.push({
      ...variant,
      previewImage
    });
  }

  return createdVariants;
}

function createTransientVariant(options: JsonObject): JsonObject {
  const timestamp = new Date().toISOString();
  return {
    changeSummary: Array.isArray(options.changeSummary) ? options.changeSummary : [],
    changeScope: typeof options.changeScope === "string" ? options.changeScope : null,
    createdAt: timestamp,
    id: `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: options.kind || "generated",
    label: options.label,
    layoutDefinition: options.layoutDefinition && typeof options.layoutDefinition === "object" && !Array.isArray(options.layoutDefinition)
      ? options.layoutDefinition
      : null,
    layoutPreview: options.layoutPreview && typeof options.layoutPreview === "object" && !Array.isArray(options.layoutPreview)
      ? options.layoutPreview
      : null,
    notes: options.notes || "",
    operation: options.operation || null,
    operationScope: options.operationScope && typeof options.operationScope === "object" && !Array.isArray(options.operationScope)
      ? options.operationScope
      : null,
    generator: options.generator || null,
    model: options.model || null,
    persisted: false,
    previewImage: options.previewImage || null,
    promptSummary: options.promptSummary || "",
    provider: options.provider || null,
    remediationStrategy: typeof options.remediationStrategy === "string" ? options.remediationStrategy : null,
    slideId: options.slideId,
    slideSpec: options.slideSpec || null,
    source: options.source,
    sourceIssues: Array.isArray(options.sourceIssues) ? options.sourceIssues.filter((issue: unknown) => asJsonObject(issue) === issue) : [],
    updatedAt: timestamp,
    visualTheme: options.visualTheme && typeof options.visualTheme === "object" && !Array.isArray(options.visualTheme)
      ? options.visualTheme
      : null
  };
}

async function renderVariantPreview(slideId: string, slideSpec: SlideSpec, variantId: string, visualTheme: unknown = null): Promise<JsonObject> {
  const slide = getSlide(slideId);
  const { variantPreviewDir } = getOutputConfig();
  ensureAllowedDir(variantPreviewDir);
  const previewState = getDomPreviewState();
  const theme = visualTheme && typeof visualTheme === "object" && !Array.isArray(visualTheme)
    ? { ...previewState.theme, ...visualTheme }
    : previewState.theme;
  const targetFile = path.join(variantPreviewDir, `${variantId}.png`);
  const html = createStandaloneSlideHtml(
    { ...previewState, theme },
    {
      id: slide.id,
      index: slide.index,
      slideSpec,
      title: slide.title
    }
  );

  await withBrowser(async (browser: { newPage: (options: JsonObject) => Promise<{ close: () => Promise<void>; screenshot: (options: JsonObject) => Promise<unknown>; setContent: (html: string, options: JsonObject) => Promise<unknown> }> }) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({
      omitBackground: false,
      path: targetFile,
      type: "png"
    });
    await page.close();
  });

  return {
    fileName: path.basename(targetFile),
    url: asAssetUrl(targetFile)
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
    await renderDeckStructureCandidatePreview(candidate as DeckStructureCandidate);
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
