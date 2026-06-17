import { normalizeSentence } from "../../shared/text-utils.ts";
import {
  type DeckStructureContext,
  type DeckStructureSlide
} from "./deck-structure-context-types.ts";
import { assertVisibleSlideTextQuality } from "./visible-text-quality.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

export type DeckPlanEntry = JsonObject & {
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

export type DeckPlanInsertion = JsonObject & {
  createSlideSpec: (context: DeckStructureContext, proposedIndex: number) => SlideSpec;
  proposedIndex?: number;
  summary?: string;
  title?: string;
  type?: string;
};

export type DeckPlanReplacement = JsonObject & {
  createSlideSpec?: (context: DeckStructureContext, proposedIndex: number, proposedTitle: string, slide: DeckStructureSlide) => SlideSpec;
  currentIndex?: number;
  slideId?: string;
  sourceIndex?: number;
  summary?: string;
  type?: string;
};

export type DeckPlanRemoval = JsonObject & {
  currentIndex?: number;
  rationale?: string;
  role?: string;
  slideId?: string;
  sourceIndex?: number;
  summary?: string;
};

export type DeckStructurePlanDefinition = JsonObject & {
  focus?: string[];
  insertions?: DeckPlanInsertion[];
  order?: number[];
  rationales?: string[];
  removals?: DeckPlanRemoval[];
  replacements?: DeckPlanReplacement[];
  roles?: string[];
  titles?: unknown;
};

type DeckPlanActionKey =
  | "keep"
  | "move"
  | "move-and-replace"
  | "move-and-retitle"
  | "move-retitle-and-replace"
  | "replace"
  | "retitle"
  | "retitle-and-replace";

type DeckPlanEntryDraft = {
  focus: string | undefined;
  proposedIndex: number;
  rationale: string;
  role: string;
  title: string | undefined;
};

const deckPlanActionByFlags: Record<string, DeckPlanActionKey> = {
  "000": "keep",
  "001": "retitle",
  "010": "replace",
  "011": "retitle-and-replace",
  "100": "move",
  "101": "move-and-retitle",
  "110": "move-and-replace",
  "111": "move-retitle-and-replace"
};

function quarantineDeckPlanSlideSpec(slideSpec: SlideSpec, label: string): SlideSpec {
  return assertVisibleSlideTextQuality(slideSpec, label);
}

function describeDeckPlanAction(moved: boolean, replaced: boolean, retitled: boolean): DeckPlanActionKey {
  const key = `${moved ? 1 : 0}${replaced ? 1 : 0}${retitled ? 1 : 0}`;
  return deckPlanActionByFlags[key] ?? "keep";
}

function matchesDeckPlanSlide(entry: DeckPlanEntry, slide: DeckStructureSlide, sourceIndex: number): boolean {
  return (
    (typeof entry.slideId === "string" && entry.slideId === slide.id)
    || (Number.isFinite(entry.currentIndex) && entry.currentIndex === slide.index)
    || (Number.isFinite(entry.sourceIndex) && entry.sourceIndex === sourceIndex)
  );
}

function hasSourceSlide(context: DeckStructureContext, sourceIndex: unknown): sourceIndex is number {
  const numericIndex = Number(sourceIndex);
  return Number.isInteger(numericIndex)
    && numericIndex >= 0
    && numericIndex < context.slides.length;
}

function findRemovalSourceIndex(context: DeckStructureContext, removal: DeckPlanRemoval): number {
  if (Number.isFinite(removal.sourceIndex)) {
    return Number(removal.sourceIndex);
  }

  return context.slides.findIndex((slide: DeckStructureSlide, sourceIndex: number) => matchesDeckPlanSlide(removal, slide, sourceIndex));
}

function buildRemovedDeckPlanEntry(context: DeckStructureContext, removal: DeckPlanRemoval, index: number): DeckPlanEntry | null {
  const sourceIndex = findRemovalSourceIndex(context, removal);
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

function createRemovalSourceIndexes(context: DeckStructureContext, removals: DeckPlanRemoval[]): Set<number> {
  return new Set(
    removals
      .map((entry: DeckPlanRemoval) => findRemovalSourceIndex(context, entry))
      .filter((sourceIndex): sourceIndex is number => hasSourceSlide(context, sourceIndex))
  );
}

function createKeptOrder(context: DeckStructureContext, definition: DeckStructurePlanDefinition, removalSourceIndexes: Set<number>): number[] {
  if (Array.isArray(definition.order) && definition.order.length) {
    return definition.order.filter((sourceIndex: number) => hasSourceSlide(context, sourceIndex) && !removalSourceIndexes.has(sourceIndex));
  }

  return context.slides
    .map((_slide: DeckStructureSlide, index: number) => index)
    .filter((sourceIndex: number) => !removalSourceIndexes.has(sourceIndex));
}

function createInsertedDeckPlanEntry(params: {
  context: DeckStructureContext;
  focus: string | undefined;
  insertion: DeckPlanInsertion;
  proposedIndex: number;
  rationale: string;
  role: string;
  title: string | undefined;
}): DeckPlanEntry {
  const { context, focus, insertion, proposedIndex, rationale, role, title } = params;
  const insertedTitle = title || insertion.title;

  return {
    action: "insert",
    currentIndex: null,
    currentTitle: "",
    proposedIndex,
    proposedTitle: insertedTitle || "Inserted slide",
    rationale,
    role,
    scaffold: {
      slideSpec: quarantineDeckPlanSlideSpec(insertion.createSlideSpec(context, proposedIndex), `deck-structure insertion ${proposedIndex}`)
    },
    slideId: null,
    summary: focus || insertion.summary || rationale,
    type: insertion.type || "content"
  };
}

function createReplacementSlideSpec(
  context: DeckStructureContext,
  replacement: DeckPlanReplacement | undefined,
  proposedIndex: number,
  proposedTitle: string,
  slide: DeckStructureSlide
): SlideSpec | null {
  if (!replacement || typeof replacement.createSlideSpec !== "function") {
    return null;
  }

  return quarantineDeckPlanSlideSpec(
    replacement.createSlideSpec(context, proposedIndex, proposedTitle, slide),
    `deck-structure replacement ${slide.id}`
  );
}

function createExistingDeckPlanEntry(params: {
  context: DeckStructureContext;
  focus: string | undefined;
  proposedIndex: number;
  rationale: string;
  replacement: DeckPlanReplacement | undefined;
  role: string;
  slide: DeckStructureSlide;
  sourceIndex: number;
  title: string | undefined;
}): DeckPlanEntry {
  const { context, focus, proposedIndex, rationale, replacement, role, slide, sourceIndex, title } = params;
  const nextTitle = title || slide.outlineLine || slide.currentTitle;
  const nextFocus = focus || slide.intent;
  const moved = slide.index !== proposedIndex;
  const retitled = normalizeSentence(nextTitle).toLowerCase() !== normalizeSentence(slide.currentTitle).toLowerCase();
  const replacementSlideSpec = createReplacementSlideSpec(context, replacement, proposedIndex, nextTitle, slide);
  const replaced = Boolean(replacementSlideSpec);
  const action = describeDeckPlanAction(moved, replaced, retitled);

  return {
    action,
    currentIndex: slide.index,
    currentTitle: slide.currentTitle,
    proposedIndex,
    proposedTitle: nextTitle,
    rationale,
    replacement: replacementSlideSpec
      ? {
        slideSpec: replacementSlideSpec
      }
      : null,
    role,
    slideId: slide.id,
    sourceIndex,
    summary: replacement && replacement.summary ? replacement.summary : nextFocus,
    type: replacement && replacement.type ? replacement.type : slide.type
  };
}

function createDeckPlanEntryDraft(definition: DeckStructurePlanDefinition, proposedPosition: number): DeckPlanEntryDraft {
  const roles = Array.isArray(definition.roles) ? definition.roles : [];
  const titles = Array.isArray(definition.titles) ? definition.titles.map((title: unknown) => String(title || "")) : [];
  const focusItems = Array.isArray(definition.focus) ? definition.focus : [];
  const rationales = Array.isArray(definition.rationales) ? definition.rationales : [];
  const proposedIndex = proposedPosition + 1;
  const role = roles[proposedPosition] || `Beat ${proposedIndex}`;
  const focus = focusItems[proposedPosition];

  return {
    focus,
    proposedIndex,
    rationale: rationales[proposedPosition] || focus || role,
    role,
    title: titles[proposedPosition]
  };
}

function buildOrderedDeckPlanEntries(params: {
  context: DeckStructureContext;
  definition: DeckStructurePlanDefinition;
  insertions: DeckPlanInsertion[];
  keptOrder: number[];
  replacements: DeckPlanReplacement[];
}): DeckPlanEntry[] {
  const { context, definition, insertions, keptOrder, replacements } = params;
  const totalEntries = keptOrder.length + insertions.length;
  const entries: DeckPlanEntry[] = [];
  let existingCursor = 0;

  for (let proposedPosition = 0; proposedPosition < totalEntries; proposedPosition += 1) {
    const draft = createDeckPlanEntryDraft(definition, proposedPosition);
    const insertion = insertions.find((entry: DeckPlanInsertion) => entry.proposedIndex === draft.proposedIndex);

    if (insertion) {
      entries.push(createInsertedDeckPlanEntry({ context, insertion, ...draft }));
      continue;
    }

    const sourceIndex = keptOrder[existingCursor];
    const slide = typeof sourceIndex === "number" ? context.slides[sourceIndex] : undefined;
    existingCursor += 1;
    if (!slide || typeof sourceIndex !== "number") {
      continue;
    }

    entries.push(createExistingDeckPlanEntry({
      context,
      replacement: replacements.find((entry: DeckPlanReplacement) => matchesDeckPlanSlide(entry, slide, sourceIndex)),
      slide,
      sourceIndex,
      ...draft
    }));
  }

  return entries;
}

export function buildDeckPlanEntries(context: DeckStructureContext, definition: DeckStructurePlanDefinition): DeckPlanEntry[] {
  const insertions = Array.isArray(definition.insertions) ? definition.insertions.slice() : [];
  const removals = Array.isArray(definition.removals) ? definition.removals.slice() : [];
  const replacements = Array.isArray(definition.replacements) ? definition.replacements.slice() : [];
  const removalSourceIndexes = createRemovalSourceIndexes(context, removals);
  const keptOrder = createKeptOrder(context, definition, removalSourceIndexes);
  const entries = buildOrderedDeckPlanEntries({ context, definition, insertions, keptOrder, replacements });

  removals
    .map((removal: DeckPlanRemoval, index: number) => buildRemovedDeckPlanEntry(context, removal, index))
    .filter((entry: DeckPlanEntry | null): entry is DeckPlanEntry => Boolean(entry))
    .forEach((entry: DeckPlanEntry) => entries.push(entry));

  return entries;
}
