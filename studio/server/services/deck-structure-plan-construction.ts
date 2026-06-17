import {
  buildDeckPlanChangeSummary,
  buildDeckPlanDiff,
  buildDeckPlanPreview,
  collectDeckPlanStats
} from "./deck-structure-plan-model.ts";
import {
  buildDeckPlanEntries,
  type DeckStructurePlanDefinition
} from "./deck-structure-plan-entry-building.ts";
import {
  type DeckStructureContext
} from "./deck-structure-context-types.ts";

type JsonObject = Record<string, unknown>;

export type { DeckPlanEntry } from "./deck-structure-plan-entry-building.ts";

type DeckStructureDefinition = DeckStructurePlanDefinition & {
  changeLead: string;
  deckPatch?: unknown;
  kindLabel?: unknown;
  label: string;
  notes?: string;
  promptSummary?: string;
  summary: string;
};

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
