import {
  asRecord as asJsonObject,
  compactSentence as sentence
} from "../../shared/json-utils.ts";
import { normalizeVisualTheme } from "./deck-theme.ts";
import {
  createGeneratedLayoutDefinition,
  describeLayoutDefinition
} from "./generated-layout-definitions.ts";
import {
  serializeSlideSpec,
  validateGeneratedVariantSlideSpec
} from "./generated-variant-safety.ts";
import { createStructuredResponse } from "./llm/client.ts";
import {
  buildDrillWordingPrompts,
  buildIdeateSlidePrompts,
  buildIdeateThemePrompts,
  buildRedoLayoutPrompts
} from "./llm/prompts.ts";
import {
  getIdeateSlideResponseSchema,
  getRedoLayoutResponseSchema,
  getThemeResponseSchema
} from "./llm/schemas.ts";
import {
  collectStructureContext,
  createLocalFamilyChangeCandidates,
  type StructureContext
} from "./local-slide-structure-candidates.ts";
import { createSameFamilyLayoutIntentSpec } from "./local-layout-candidates.ts";
import {
  createSelectionApplyScope,
  describeSelectionScope,
  mergeCandidateIntoSelectionScope
} from "./selection-scope.ts";

const defaultCandidateCount = 5;
const minimumCandidateCount = 1;
const maximumCandidateCount = 8;

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

type SlideRecord = JsonObject & {
  id: string;
  index?: number;
  title?: string;
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
  slideSpec: SlideSpec;
};

type OperationOptions = JsonObject & {
  candidateCount?: unknown;
  labelFormatter?: (label: string) => string;
  onProgress?: ((progress: JsonObject) => void) | undefined;
  operation?: string;
  selectionScope?: unknown;
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

function normalizeCandidateCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return defaultCandidateCount;
  }

  return Math.min(maximumCandidateCount, Math.max(minimumCandidateCount, parsed));
}

function describeVariantPersistence(_options: OperationOptions = {}): string {
  return "Generated as a session-only candidate; apply one to update the slide.";
}

export async function createLlmThemeCandidates(slide: SlideRecord, slideType: unknown, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
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

export async function createLlmIdeateCandidates(slide: SlideRecord, slideType: unknown, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
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

export async function createLlmWordingCandidates(slide: SlideRecord, slideType: unknown, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
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

export async function createLlmSelectionWordingCandidates(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
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

export async function createLlmRedoLayoutCandidates(slide: SlideRecord, currentSpec: SlideSpec, source: unknown, context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<Candidate[]> {
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
