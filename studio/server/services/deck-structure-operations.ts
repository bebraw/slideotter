import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-record-utils.ts";
import {
  compactSentence as sentence,
  normalizeSentence
} from "../../shared/text-utils.ts";
import { buildAndRenderDeck } from "./build.ts";
import { renderDeckStructureCandidatePreview } from "./deck-structure-preview.ts";
import { collectDeckStructureContext } from "./deck-structure-context.ts";
import { type DeckPlanEntry } from "./deck-structure-plan-construction.ts";
import { createDeckStructureCandidateFromLlmIntent } from "./deck-structure-llm-candidates.ts";
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { buildDeckStructurePrompts } from "./llm/prompts.ts";
import { getDeckStructureResponseSchema } from "./llm/schemas.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { getDeckContext } from "./state.ts";
import { createStructuredSlide, readSlideSpec, writeSlideSpec } from "./slides.ts";
import { assertVisibleSlideTextQuality } from "./visible-text-quality.ts";

const defaultCandidateCount = 5;
const minimumCandidateCount = 1;
const maximumCandidateCount = 8;

type JsonObject = Record<string, unknown>;

type SlideSpec = JsonObject;

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
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
  candidateCount?: unknown;
  dryRun?: unknown;
  onProgress?: ((progress: JsonObject) => void) | undefined;
  promoteIndices?: unknown;
  promoteInsertions?: unknown;
  promoteRemovals?: unknown;
  promoteReplacements?: unknown;
  promoteTitles?: unknown;
};

type DeckStructureApplyStats = {
  indexUpdates: number;
  insertedSlides: number;
  removedSlides: number;
  replacedSlides: number;
  titleUpdates: number;
};

type DeckPlanEntryWithSlideId = DeckPlanEntry & {
  slideId: string;
};

type DeckStructureOrderUpdate = {
  nextIndex: number;
  nextTitle: string;
  shouldUpdateIndex: boolean;
  shouldUpdateTitle: boolean;
  slideId: string;
  slideSpec: SlideSpec;
};

function reportProgress(options: OperationOptions, progress: JsonObject): void {
  if (typeof options.onProgress === "function") {
    options.onProgress(progress);
  }
}

function normalizeCandidateCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  const candidateCount = Number.isFinite(parsed) ? parsed : defaultCandidateCount;
  return Math.min(maximumCandidateCount, Math.max(minimumCandidateCount, candidateCount));
}

function resolveGeneration() {
  const llmStatus = getLlmStatus();
  if (!llmStatus.available) {
    throw new Error(`LLM generation is not configured. ${llmStatus.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating variants."}`);
  }

  const generation = {
    available: true,
    fallbackReason: null,
    mode: "llm",
    model: llmStatus.model,
    provider: llmStatus.provider
  };
  return generation;
}

function readExistingSlideSpec(slideId: string): SlideSpec | null {
  let slideSpec: unknown = null;
  try {
    slideSpec = readSlideSpec(slideId);
  } catch (error) {
    return null;
  }
  return asJsonObject(slideSpec);
}

function createDeckStructureSourceFields(context: DeckContext): JsonObject {
  const deck = context.deck;
  return {
    audience: deck.audience,
    constraints: deck.constraints,
    objective: deck.objective,
    outline: deck.outline,
    query: [deck.objective, deck.outline].filter(Boolean).join(" "),
    themeBrief: deck.themeBrief,
    title: deck.title,
    workflow: "deckPlanning"
  };
}

async function createLlmDeckStructureCandidates(context: DeckContext, candidateCount: unknown, options: OperationOptions = {}): Promise<JsonObject[]> {
  const count = normalizeCandidateCount(candidateCount);
  const structureContext = collectDeckStructureContext(context);
  const sourceContext = getGenerationSourceContext(createDeckStructureSourceFields(context));
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
    summary: `Generated ${candidates.length} deck-plan candidates from the saved deck context using ${generation.provider} ${generation.model}.`
  };
}

function createEmptyApplyStats(): DeckStructureApplyStats {
  return {
    indexUpdates: 0,
    insertedSlides: 0,
    removedSlides: 0,
    replacedSlides: 0,
    titleUpdates: 0
  };
}

function applyDeckStructureInsertions(plan: DeckPlanEntry[]): number {
  let insertedSlides = 0;

  for (const entry of plan) {
    if (!entry || entry.action !== "insert" || !entry.scaffold || !entry.scaffold.slideSpec) {
      continue;
    }

    createStructuredSlide(assertVisibleSlideTextQuality(entry.scaffold.slideSpec, "deck-structure insert apply"));
    insertedSlides += 1;
  }

  return insertedSlides;
}

function applyDeckStructureReplacements(plan: DeckPlanEntry[]): number {
  let replacedSlides = 0;

  for (const entry of plan) {
    if (!entry || typeof entry.slideId !== "string" || !entry.slideId || !entry.replacement || !entry.replacement.slideSpec) {
      continue;
    }
    if (!readExistingSlideSpec(entry.slideId)) {
      continue;
    }

    writeSlideSpec(entry.slideId, assertVisibleSlideTextQuality(entry.replacement.slideSpec, "deck-structure replacement apply"));
    replacedSlides += 1;
  }

  return replacedSlides;
}

function applyDeckStructureRemovals(plan: DeckPlanEntry[]): number {
  let removedSlides = 0;

  for (const entry of plan) {
    if (!entry || entry.action !== "remove" || typeof entry.slideId !== "string" || !entry.slideId) {
      continue;
    }

    const slideSpec = readExistingSlideSpec(entry.slideId);
    if (!slideSpec || slideSpec.archived === true) {
      continue;
    }

    writeSlideSpec(entry.slideId, {
      ...slideSpec,
      archived: true
    });
    removedSlides += 1;
  }

  return removedSlides;
}

function canPromoteDeckStructureEntry(entry: DeckPlanEntry): entry is DeckPlanEntryWithSlideId {
  return Boolean(entry && entry.action !== "remove" && typeof entry.slideId === "string" && entry.slideId);
}

function shouldUpdateDeckStructureTitle(currentTitle: string, nextTitle: string, promoteTitles: boolean): boolean {
  return promoteTitles && Boolean(nextTitle)
    && normalizeSentence(currentTitle).toLowerCase() !== normalizeSentence(nextTitle).toLowerCase();
}

function createPromotedDeckStructureSlideSpec(
  slideSpec: SlideSpec,
  updates: { nextIndex: number; nextTitle: string; shouldUpdateIndex: boolean; shouldUpdateTitle: boolean }
): SlideSpec {
  return {
    ...slideSpec,
    archived: false,
    index: updates.shouldUpdateIndex ? updates.nextIndex : slideSpec.index,
    title: updates.shouldUpdateTitle ? updates.nextTitle : slideSpec.title
  };
}

function createDeckStructureOrderUpdate(
  entry: DeckPlanEntry,
  options: { promoteIndices: boolean; promoteTitles: boolean }
): DeckStructureOrderUpdate | null {
  if (!canPromoteDeckStructureEntry(entry)) {
    return null;
  }

  const nextIndex = Number(entry.proposedIndex);
  const nextTitle = sentence(entry.proposedTitle, "", 18);
  if (!nextTitle && !Number.isFinite(nextIndex)) {
    return null;
  }

  const slideSpec = readExistingSlideSpec(entry.slideId);
  if (!slideSpec) {
    return null;
  }

  const currentIndex = Number(slideSpec.index);
  const currentTitle = sentence(slideSpec.title, "", 18);
  const shouldUpdateIndex = options.promoteIndices && Number.isFinite(nextIndex) && currentIndex !== nextIndex;
  const shouldUpdateTitle = shouldUpdateDeckStructureTitle(currentTitle, nextTitle, options.promoteTitles);
  if (!shouldUpdateIndex && !shouldUpdateTitle) {
    return null;
  }

  return {
    nextIndex,
    nextTitle,
    shouldUpdateIndex,
    shouldUpdateTitle,
    slideId: entry.slideId,
    slideSpec
  };
}

function applyDeckStructureOrderUpdates(
  plan: DeckPlanEntry[],
  options: { promoteIndices: boolean; promoteTitles: boolean }
): Pick<DeckStructureApplyStats, "indexUpdates" | "titleUpdates"> {
  let indexUpdates = 0;
  let titleUpdates = 0;

  for (const entry of plan) {
    const update = createDeckStructureOrderUpdate(entry, options);
    if (!update) {
      continue;
    }

    writeSlideSpec(update.slideId, createPromotedDeckStructureSlideSpec(update.slideSpec, {
      nextIndex: update.nextIndex,
      nextTitle: update.nextTitle,
      shouldUpdateIndex: update.shouldUpdateIndex,
      shouldUpdateTitle: update.shouldUpdateTitle
    }));
    if (update.shouldUpdateIndex) {
      indexUpdates += 1;
    }
    if (update.shouldUpdateTitle) {
      titleUpdates += 1;
    }
  }

  return {
    indexUpdates,
    titleUpdates
  };
}

function applyDeckStructurePlanUpdates(plan: DeckPlanEntry[], options: OperationOptions): DeckStructureApplyStats {
  const stats = createEmptyApplyStats();
  const promoteIndices = options.promoteIndices !== false;
  const promoteTitles = options.promoteTitles !== false;

  if (options.promoteInsertions !== false) {
    stats.insertedSlides = applyDeckStructureInsertions(plan);
  }

  if (options.promoteReplacements !== false) {
    stats.replacedSlides = applyDeckStructureReplacements(plan);
  }

  if (options.promoteRemovals !== false) {
    stats.removedSlides = applyDeckStructureRemovals(plan);
  }

  if (promoteTitles || promoteIndices) {
    const orderStats = applyDeckStructureOrderUpdates(plan, {
      promoteIndices,
      promoteTitles
    });
    stats.indexUpdates = orderStats.indexUpdates;
    stats.titleUpdates = orderStats.titleUpdates;
  }

  return stats;
}

async function applyDeckStructureCandidate(candidate: unknown, options: OperationOptions = {}): Promise<JsonObject> {
  const candidateSource = asJsonObject(candidate);
  const plan = asJsonObjectArray(candidateSource.slides) as DeckPlanEntry[];
  const stats = applyDeckStructurePlanUpdates(plan, options);

  const previews = (await buildAndRenderDeck()).previews;

  return {
    insertedSlides: stats.insertedSlides,
    indexUpdates: stats.indexUpdates,
    previews,
    removedSlides: stats.removedSlides,
    replacedSlides: stats.replacedSlides,
    titleUpdates: stats.titleUpdates
  };
}

export {
  applyDeckStructureCandidate,
  ideateDeckStructure
};
