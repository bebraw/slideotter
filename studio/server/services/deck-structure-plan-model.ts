import * as path from "path";
import { getActivePresentationId } from "./presentations.ts";
import { peekNextStructuredSlideFileName } from "./slides.ts";

export type JsonObject = Record<string, unknown>;

export type DeckStructureSlide = JsonObject & {
  currentTitle: string;
  id: string;
  index: number;
};

export type DeckStructureContext = JsonObject & {
  deck: JsonObject;
  slides: DeckStructureSlide[];
};

export type DeckPlanEntry = JsonObject & {
  action?: string;
  currentIndex?: number | null;
  currentTitle?: string;
  proposedIndex?: number | null;
  proposedTitle?: string;
  slideId?: string | null;
  type?: string | null;
};

export type DeckPlanStats = {
  archived: number;
  inserted: number;
  moved: number;
  replaced: number;
  retitled: number;
  shared: number;
  total: number;
};

export type DeckPlanPreview = JsonObject & {
  cues: string[];
  overview: string;
};

export type DeckPlanDiff = JsonObject & {
  deck: JsonObject;
};

export type DeckStructureDefinition = JsonObject & {
  changeLead: string;
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asJsonObjectArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is JsonObject => asJsonObject(entry) === entry)
    : [];
}

export function collectDeckPlanStats(slides: unknown): DeckPlanStats {
  const stats = {
    archived: 0,
    inserted: 0,
    moved: 0,
    replaced: 0,
    shared: 0,
    retitled: 0,
    total: Array.isArray(slides) ? slides.length : 0
  };

  asJsonObjectArray(slides).forEach((slide: JsonObject) => {
    const action = String(slide.action || "");

    if (action === "insert") {
      stats.inserted += 1;
      return;
    }

    if (action === "remove") {
      stats.archived += 1;
      return;
    }

    if (action.includes("move")) {
      stats.moved += 1;
    }

    if (action.includes("replace")) {
      stats.replaced += 1;
    }

    if (action.includes("retitle")) {
      stats.retitled += 1;
    }
  });

  return stats;
}

function getDeckPlanLiveSlides(slides: unknown): DeckPlanEntry[] {
  return asJsonObjectArray(slides)
    .filter((slide: JsonObject): slide is DeckPlanEntry => Number.isFinite(slide.proposedIndex) && Boolean(slide.proposedTitle))
    .slice()
    .sort((left: DeckPlanEntry, right: DeckPlanEntry) => Number(left.proposedIndex) - Number(right.proposedIndex));
}

const deckPlanDeckFieldLabels = {
  audience: "Audience",
  author: "Author",
  company: "Company",
  constraints: "Constraints",
  lang: "Language",
  objective: "Objective",
  subject: "Subject",
  themeBrief: "Theme brief",
  title: "Deck title",
  tone: "Tone"
};

const deckPlanDesignConstraintLabels = {
  maxWordsPerSlide: "Max words per slide",
  minCaptionGapIn: "Min caption gap",
  minContentGapIn: "Min content gap",
  minFontSizePt: "Min font size",
  minPanelPaddingIn: "Min panel padding"
};

const deckPlanThemeLabels = {
  accent: "Accent color",
  bg: "Background color",
  light: "Light color",
  muted: "Muted color",
  panel: "Panel color",
  primary: "Primary color",
  progressFill: "Progress fill",
  progressTrack: "Progress track",
  secondary: "Secondary color",
  surface: "Surface color"
};

function formatDeckPlanDiffValue(value: unknown, kind = "text"): string {
  if (value == null || value === "") {
    return "(empty)";
  }

  if (kind === "color") {
    const normalized = String(value).trim().replace(/^#/, "");
    return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : String(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function buildDeckContextDiff(context: DeckStructureContext, deckPatch: unknown): JsonObject {
  const deckPatchSource = asJsonObject(deckPatch);
  if (!Object.keys(deckPatchSource).length) {
    return {
      changes: [],
      count: 0,
      summary: "No shared deck changes."
    };
  }

  const currentDeck = asJsonObject(context.deck);
  const changes: JsonObject[] = [];

  Object.entries(deckPlanDeckFieldLabels).forEach(([field, label]) => {
    if (!Object.prototype.hasOwnProperty.call(deckPatchSource, field) || deckPatchSource[field] === currentDeck[field]) {
      return;
    }

    changes.push({
      after: formatDeckPlanDiffValue(deckPatchSource[field]),
      before: formatDeckPlanDiffValue(currentDeck[field]),
      field,
      label,
      scope: "deck"
    });
  });

  const designConstraints = asJsonObject(deckPatchSource.designConstraints);
  if (Object.keys(designConstraints).length) {
    Object.entries(deckPlanDesignConstraintLabels).forEach(([field, label]) => {
      if (!Object.prototype.hasOwnProperty.call(designConstraints, field)) {
        return;
      }

      const currentValue = asJsonObject(currentDeck.designConstraints)[field];
      const nextValue = designConstraints[field];
      if (nextValue === currentValue) {
        return;
      }

      changes.push({
        after: formatDeckPlanDiffValue(nextValue),
        before: formatDeckPlanDiffValue(currentValue),
        field,
        label,
        scope: "design-constraint"
      });
    });
  }

  const visualTheme = asJsonObject(deckPatchSource.visualTheme);
  if (Object.keys(visualTheme).length) {
    Object.entries(deckPlanThemeLabels).forEach(([field, label]) => {
      if (!Object.prototype.hasOwnProperty.call(visualTheme, field)) {
        return;
      }

      const currentValue = asJsonObject(currentDeck.visualTheme)[field];
      const nextValue = visualTheme[field];
      if (nextValue === currentValue) {
        return;
      }

      changes.push({
        after: formatDeckPlanDiffValue(nextValue, "color"),
        before: formatDeckPlanDiffValue(currentValue, "color"),
        field,
        label,
        scope: "visual-theme"
      });
    });
  }

  return {
    changes,
    count: changes.length,
    summary: changes.length
      ? `${changes.length} shared deck setting${changes.length === 1 ? "" : "s"} change.`
      : "No shared deck changes."
  };
}

function buildDeckPlanStatsSummary(stats: DeckPlanStats): string {
  const parts: string[] = [];

  if (stats.inserted) {
    parts.push(`${stats.inserted} insert`);
  }
  if (stats.replaced) {
    parts.push(`${stats.replaced} replace`);
  }
  if (stats.archived) {
    parts.push(`${stats.archived} archive`);
  }
  if (stats.moved) {
    parts.push(`${stats.moved} move`);
  }
  if (stats.retitled) {
    parts.push(`${stats.retitled} retitle`);
  }
  if (stats.shared) {
    parts.push(`${stats.shared} shared`);
  }

  return parts.length ? parts.join(", ") : "keep-only plan";
}

function buildDeckPlanActionCue(slide: DeckPlanEntry): string {
  const action = String(slide.action || "");
  const currentTitle = String(slide.currentTitle || "Untitled");
  const proposedTitle = String(slide.proposedTitle || currentTitle);

  if (action === "insert") {
    return `Insert ${proposedTitle} at ${slide.proposedIndex} as a new ${slide.type || "slide"} beat.`;
  }
  if (action === "remove") {
    return `Archive ${currentTitle} from the live deck while keeping the source recoverable.`;
  }
  if (action.includes("replace")) {
    return `Replace ${currentTitle} with ${proposedTitle} and keep the slide file under guarded apply.`;
  }
  if (action.includes("move")) {
    return `Move ${currentTitle} to ${slide.proposedIndex}${action.includes("retitle") ? ` and retitle it to ${proposedTitle}` : ""}.`;
  }
  if (action.includes("retitle")) {
    return `Retitle ${currentTitle} to ${proposedTitle}.`;
  }

  return `Keep ${currentTitle} in the live deck.`;
}

function getDeckPlanChangeKinds(action: unknown): string[] {
  const normalized = String(action || "");
  const changeKinds: string[] = [];

  if (normalized === "insert") {
    return ["create"];
  }
  if (normalized === "remove") {
    return ["archive"];
  }
  if (normalized.includes("move")) {
    changeKinds.push("reorder");
  }
  if (normalized.includes("retitle")) {
    changeKinds.push("retitle");
  }
  if (normalized.includes("replace")) {
    changeKinds.push("replace");
  }

  return changeKinds.length ? changeKinds : ["keep"];
}

function buildDeckPlanPreviewHint(slide: DeckPlanEntry): JsonObject {
  const action = String(slide.action || "keep");
  const currentIndex = Number.isFinite(slide.currentIndex) ? Number(slide.currentIndex) : null;
  const proposedIndex = Number.isFinite(slide.proposedIndex) ? Number(slide.proposedIndex) : null;
  const currentTitle = String(slide.currentTitle || "Untitled");
  const proposedTitle = String(slide.proposedTitle || currentTitle);

  return {
    action,
    cue: buildDeckPlanActionCue(slide),
    currentIndex,
    currentTitle,
    previewState: currentIndex ? "current" : "scaffold",
    proposedIndex,
    proposedTitle,
    slideId: slide && slide.slideId ? slide.slideId : null,
    type: slide && slide.type ? slide.type : null
  };
}

export function buildDeckPlanDiff(context: DeckStructureContext, slides: unknown, planStats: DeckPlanStats, deckPatch: unknown): DeckPlanDiff {
  const entries = asJsonObjectArray(slides) as DeckPlanEntry[];
  const currentSequence = context.slides.map((slide: DeckStructureSlide) => ({
    index: slide.index,
    title: slide.currentTitle
  }));
  const proposedSequence = getDeckPlanLiveSlides(entries).map((slide: DeckPlanEntry) => ({
    index: slide.proposedIndex,
    title: slide.proposedTitle
  }));
  const nextStructuredFile = peekNextStructuredSlideFileName();
  const changedSlides = entries.filter((slide: DeckPlanEntry) => String(slide.action || "") !== "keep");
  const deck = buildDeckContextDiff(context, deckPatch);
  const insertedTitles = changedSlides
    .filter((slide: DeckPlanEntry) => String(slide.action || "") === "insert")
    .map((slide: DeckPlanEntry) => slide.proposedTitle)
    .filter(Boolean);
  const archivedTitles = changedSlides
    .filter((slide: DeckPlanEntry) => String(slide.action || "") === "remove")
    .map((slide: DeckPlanEntry) => slide.currentTitle)
    .filter(Boolean);
  const files = changedSlides.map((slide: DeckPlanEntry) => {
    const changeKinds = getDeckPlanChangeKinds(slide.action);
    const presentationSlideDir = path.join("presentations", getActivePresentationId(), "slides");
    const targetPath = slide.action === "insert"
      ? path.join(presentationSlideDir, nextStructuredFile)
      : path.join(presentationSlideDir, `${slide.slideId}.json`);

    return {
      after: slide.action === "remove"
        ? "(archived from live deck)"
        : slide.proposedTitle || slide.currentTitle || "",
      before: slide.action === "insert"
        ? "(new slide)"
        : slide.currentTitle || "",
      changeKinds,
      currentIndex: Number.isFinite(slide.currentIndex) ? slide.currentIndex : null,
      note: buildDeckPlanActionCue(slide),
      proposedIndex: Number.isFinite(slide.proposedIndex) ? slide.proposedIndex : null,
      slideId: slide.slideId || null,
      targetPath
    };
  });

  return {
    counts: {
      afterSlides: proposedSequence.length,
      archived: planStats.archived,
      beforeSlides: currentSequence.length,
      inserted: planStats.inserted,
      moved: planStats.moved,
      replaced: planStats.replaced,
      shared: deck.count,
      retitled: planStats.retitled
    },
    deck,
    files,
    outline: {
      added: insertedTitles,
      archived: archivedTitles,
      currentSequence,
      moved: changedSlides
        .filter((slide: DeckPlanEntry) => String(slide.action || "").includes("move") && Number.isFinite(slide.proposedIndex))
        .map((slide: DeckPlanEntry) => ({
          from: slide.currentIndex,
          title: slide.currentTitle,
          to: slide.proposedIndex
        })),
      proposedSequence,
      retitled: changedSlides
        .filter((slide: DeckPlanEntry) => String(slide.action || "").includes("retitle"))
        .map((slide: DeckPlanEntry) => ({
          after: slide.proposedTitle,
          before: slide.currentTitle
        }))
    },
    summary: currentSequence.length === proposedSequence.length
      ? `Live deck stays at ${proposedSequence.length} slides while changing ${files.length} file target${files.length === 1 ? "" : "s"}.`
      : `Live deck changes from ${currentSequence.length} to ${proposedSequence.length} slides while changing ${files.length} file target${files.length === 1 ? "" : "s"}.`
  };
}

export function buildDeckPlanPreview(context: DeckStructureContext, slides: unknown, planStats: DeckPlanStats, deckDiff: unknown): DeckPlanPreview {
  const entries = asJsonObjectArray(slides) as DeckPlanEntry[];
  const diff = asJsonObject(deckDiff);
  const currentSequence = context.slides.map((slide: DeckStructureSlide) => ({
    id: slide.id,
    index: slide.index,
    title: slide.currentTitle
  }));
  const proposedSequence = getDeckPlanLiveSlides(entries).map((slide: DeckPlanEntry) => ({
    action: slide.action,
    index: slide.proposedIndex,
    title: slide.proposedTitle
  }));
  const changedSlides = entries.filter((slide: DeckPlanEntry) => String(slide.action || "") !== "keep");
  const cues = changedSlides.slice(0, 3).map((slide: DeckPlanEntry) => buildDeckPlanActionCue(slide));
  const deckChanges = asJsonObjectArray(diff.changes);
  const deckCues = deckChanges.length
    ? deckChanges.slice(0, 2).map((change: JsonObject) => `Set ${String(change.label || "").toLowerCase()} to ${change.after}.`)
    : [];
  const previewHints = changedSlides.slice(0, 4).map((slide: DeckPlanEntry) => buildDeckPlanPreviewHint(slide));
  const overview = proposedSequence.length === currentSequence.length
    ? `Live deck stays at ${proposedSequence.length} slides with ${buildDeckPlanStatsSummary(planStats)}.`
    : `Live deck changes from ${currentSequence.length} to ${proposedSequence.length} slides with ${buildDeckPlanStatsSummary(planStats)}.`;

  return {
    currentSequence,
    deckCues,
    overview,
    proposedSequence,
    cues: cues.concat(deckCues),
    previewHints
  };
}

export function buildDeckPlanChangeSummary(definition: DeckStructureDefinition, preview: DeckPlanPreview): string[] {
  return [
    definition.changeLead,
    preview.overview,
    ...preview.cues.slice(0, 2),
    "Applying this candidate stays inside the guarded slide-file promotion path."
  ];
}
