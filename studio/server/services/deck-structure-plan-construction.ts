import { normalizeSentence } from "../../shared/json-utils.ts";
import {
  buildDeckPlanChangeSummary,
  buildDeckPlanDiff,
  buildDeckPlanPreview,
  collectDeckPlanStats
} from "./deck-structure-plan-model.ts";
import {
  type DeckStructureContext,
  type DeckStructureSlide
} from "./deck-structure-context.ts";
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

function quarantineDeckPlanSlideSpec(slideSpec: SlideSpec, label: string): SlideSpec {
  return assertVisibleSlideTextQuality(slideSpec, label);
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
          slideSpec: quarantineDeckPlanSlideSpec(insertion.createSlideSpec(context, proposedPosition + 1), `deck-structure insertion ${proposedPosition + 1}`)
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
      ? quarantineDeckPlanSlideSpec(
          replacement.createSlideSpec(context, proposedPosition + 1, nextTitle, slide),
          `deck-structure replacement ${slide.id}`
        )
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

export function createDeckStructurePlan(context: DeckStructureContext, definition: DeckStructureDefinition): JsonObject {
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
