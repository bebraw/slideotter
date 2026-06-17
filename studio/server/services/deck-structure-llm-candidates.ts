import { normalizeVisualTheme } from "./deck-theme.ts";
import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-record-utils.ts";
import {
  compactSentence as sentence,
  normalizeSentence
} from "../../shared/text-utils.ts";
import {
  buildDeckPlanDiff,
  buildDeckPlanPreview,
  collectDeckPlanStats,
  type JsonObject
} from "./deck-structure-plan-model.ts";
import type {
  DeckStructureContext,
  DeckStructureSlide
} from "./deck-structure-context-types.ts";
import type { DeckPlanEntry } from "./deck-structure-plan-entry-building.ts";
import { validateSlideSpec } from "./validate-slide-spec.ts";
import { assertVisibleSlideTextQuality } from "./visible-text-quality-assertions.ts";

type SlideSpec = JsonObject;

type CreateDeckStructureCandidateOptions = {
  readExistingSlideSpec: (slideId: string) => SlideSpec | null;
};

type DeckIntentSpecContext = {
  base: JsonObject;
  grounding: unknown[];
  intent: JsonObject;
  prefix: string;
  proposedIndex: number | null;
  summary: string;
  title: string;
  type: string;
};

function normalizeDeckPlanAction(action: unknown): string {
  const normalized = String(action || "keep");
  if (normalized === "skip" || normalized === "restore") {
    return "remove";
  }
  return normalized;
}

function findDeckStructureSlide(context: DeckStructureContext, intent: unknown): DeckStructureSlide | null {
  const slides = Array.isArray(context.slides) ? context.slides : [];
  const deckIntent = asJsonObject(intent);
  if (!Object.keys(deckIntent).length) {
    return null;
  }

  if (deckIntent.slideId) {
    const byId = slides.find((slide: DeckStructureSlide) => slide.id === deckIntent.slideId);
    if (byId) {
      return byId;
    }
  }

  if (Number.isFinite(Number(deckIntent.currentIndex))) {
    const byIndex = slides.find((slide: DeckStructureSlide) => slide.index === Number(deckIntent.currentIndex));
    if (byIndex) {
      return byIndex;
    }
  }

  const currentTitle = normalizeSentence(deckIntent.currentTitle || "").toLowerCase();
  if (currentTitle) {
    return slides.find((slide: DeckStructureSlide) => normalizeSentence(slide.currentTitle).toLowerCase() === currentTitle) || null;
  }

  return null;
}

function createDeckIntentCards(intent: JsonObject, prefix: string): JsonObject[] {
  const grounding = Array.isArray(intent.grounding) ? intent.grounding.filter(Boolean) : [];
  return [
    {
      body: sentence(intent.summary, "Name the slide's job in the revised deck.", 16),
      id: `${prefix}-card-1`,
      title: "Role"
    },
    {
      body: sentence(intent.rationale, "Explain why this beat belongs here.", 16),
      id: `${prefix}-card-2`,
      title: "Why here"
    },
    {
      body: sentence(grounding[0], "Ground against the saved brief, outline, or source snippets.", 16),
      id: `${prefix}-card-3`,
      title: "Grounding"
    }
  ];
}

function createDeckIntentSpecContext(intent: JsonObject, proposedIndex: number | null, baseSpec: unknown): DeckIntentSpecContext {
  const base = asJsonObject(baseSpec);
  const requestedType = String(intent.type || "");
  const type = ["cover", "toc", "content", "summary", "divider", "quote", "photo", "photoGrid"].includes(requestedType)
    ? requestedType
    : "content";
  const title = sentence(intent.proposedTitle || intent.currentTitle, "Planned slide", 10);
  const summary = sentence(intent.summary || intent.rationale, "Support the approved deck-structure plan.", 18);
  const grounding = Array.isArray(intent.grounding) ? intent.grounding.filter(Boolean) : [];
  const prefix = `deck-plan-${proposedIndex || "x"}`;
  return { base, grounding, intent, prefix, proposedIndex, summary, title, type };
}

function createDividerIntentSpec(context: DeckIntentSpecContext): SlideSpec {
  return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
    index: context.proposedIndex,
    title: context.title,
    type: "divider"
  })), "deck-structure divider intent");
}

function createQuoteIntentSpec(context: DeckIntentSpecContext): SlideSpec {
  return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
    attribution: context.base.attribution || "Deck plan",
    context: sentence(context.intent.rationale, context.summary, 16),
    index: context.proposedIndex,
    quote: sentence(context.grounding[0] || context.summary, context.summary, 18),
    source: context.base.source || context.grounding[1] || "",
    title: context.title,
    type: "quote"
  })), "deck-structure quote intent");
}

function createPhotoIntentSpec(context: DeckIntentSpecContext): SlideSpec | null {
  if (context.type === "photo" && context.base.media) {
    return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
      caption: context.summary,
      index: context.proposedIndex,
      media: { ...asJsonObject(context.base.media) },
      title: context.title,
      type: "photo"
    })), "deck-structure photo intent");
  }

  if (context.type === "photoGrid" && Array.isArray(context.base.mediaItems) && context.base.mediaItems.length >= 2) {
    return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
      caption: context.summary,
      index: context.proposedIndex,
      mediaItems: context.base.mediaItems.slice(0, 3).map((item: unknown) => ({ ...asJsonObject(item) })),
      summary: context.summary,
      title: context.title,
      type: "photoGrid"
    })), "deck-structure photo-grid intent");
  }

  return null;
}

function createCardIntentSpec(context: DeckIntentSpecContext): SlideSpec {
  return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
    cards: createDeckIntentCards(context.intent, context.prefix),
    eyebrow: sentence(context.intent.role, "Plan", 3),
    index: context.proposedIndex,
    note: sentence(context.intent.rationale, "Review before applying this deck plan.", 16),
    summary: context.summary,
    title: context.title,
    type: context.type
  })), `deck-structure ${context.type} intent`);
}

function createSummaryIntentSpec(context: DeckIntentSpecContext): SlideSpec {
  return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
    bullets: createDeckIntentCards(context.intent, context.prefix).map((card: JsonObject, index: number) => ({
      ...card,
      id: `${context.prefix}-bullet-${index + 1}`
    })),
    eyebrow: sentence(context.intent.role, "Summary", 3),
    index: context.proposedIndex,
    resources: [
      {
        body: sentence(context.grounding[0], "Saved brief and current outline.", 12),
        bodyFontSize: 10.8,
        id: `${context.prefix}-resource-1`,
        title: "Grounding"
      },
      {
        body: "Preview/apply deck-structure workflow",
        bodyFontSize: 10.8,
        id: `${context.prefix}-resource-2`,
        title: "Apply path"
      }
    ],
    resourcesTitle: "Plan support",
    summary: context.summary,
    title: context.title,
    type: "summary"
  })), "deck-structure summary intent");
}

function createContentIntentSpec(context: DeckIntentSpecContext): SlideSpec {
  return assertVisibleSlideTextQuality(asJsonObject(validateSlideSpec({
    eyebrow: sentence(context.intent.role, "Plan", 3),
    guardrails: [
      {
        body: sentence(context.grounding[0], "Ground this change in the saved deck context.", 14),
        id: `${context.prefix}-guardrail-1`,
        title: "Grounded"
      },
      {
        body: "Preview the changed deck before applying.",
        id: `${context.prefix}-guardrail-2`,
        title: "Preview"
      },
      {
        body: "Apply only the selected deck-plan candidate.",
        id: `${context.prefix}-guardrail-3`,
        title: "Apply"
      }
    ],
    guardrailsTitle: "Plan checks",
    index: context.proposedIndex,
    signals: [
      {
        body: context.summary,
        id: `${context.prefix}-signal-1`,
        title: "Role"
      },
      {
        body: sentence(context.intent.rationale, "Explain the narrative move.", 14),
        id: `${context.prefix}-signal-2`,
        title: "Rationale"
      },
      {
        body: sentence(context.grounding[1], "Use available source or outline notes.", 14),
        id: `${context.prefix}-signal-3`,
        title: "Evidence"
      }
    ],
    signalsTitle: "Plan intent",
    summary: context.summary,
    title: context.title,
    type: "content"
  })), "deck-structure content intent");
}

function createSlideSpecFromDeckIntent(intent: JsonObject, proposedIndex: number | null, baseSpec: unknown = null): SlideSpec {
  const context = createDeckIntentSpecContext(intent, proposedIndex, baseSpec);
  const mediaSpec = createPhotoIntentSpec(context);
  if (mediaSpec) {
    return mediaSpec;
  }

  if (context.type === "divider") {
    return createDividerIntentSpec(context);
  }
  if (context.type === "quote") {
    return createQuoteIntentSpec(context);
  }
  if (context.type === "cover" || context.type === "toc") {
    return createCardIntentSpec(context);
  }
  if (context.type === "summary") {
    return createSummaryIntentSpec(context);
  }

  return createContentIntentSpec(context);
}

function createDeckPlanEntryFromLlmIntent(
  context: DeckStructureContext,
  intent: JsonObject,
  options: CreateDeckStructureCandidateOptions,
  slideIntent: JsonObject,
  index: number
): DeckPlanEntry {
  const action = normalizeDeckPlanAction(slideIntent.action);
  const currentSlide = findDeckStructureSlide(context, slideIntent) || (action !== "insert" ? context.slides[index] : null);
  const currentIndex = currentSlide ? currentSlide.index : Number.isFinite(Number(slideIntent.currentIndex)) ? Number(slideIntent.currentIndex) : null;
  const proposedIndex = action === "remove"
    ? null
    : Number.isFinite(Number(slideIntent.proposedIndex)) ? Number(slideIntent.proposedIndex) : index + 1;
  const proposedTitle = sentence(slideIntent.proposedTitle || (currentSlide && currentSlide.currentTitle), "Planned slide", 10);
  const grounding = Array.isArray(slideIntent.grounding) ? slideIntent.grounding.filter(Boolean) : [];

  if ((action.includes("replace") || action.includes("retitle")) && !grounding.length) {
    throw new Error(`Deck-structure candidate "${intent.label}" has an ungrounded ${action} action for "${proposedTitle}"`);
  }

  const baseSpec = currentSlide ? options.readExistingSlideSpec(currentSlide.id) : null;
  const scaffoldSpec = action === "insert"
    ? createSlideSpecFromDeckIntent(slideIntent, proposedIndex, null)
    : null;
  const replacementSpec = action.includes("replace") && currentSlide
    ? createSlideSpecFromDeckIntent(slideIntent, proposedIndex, baseSpec)
    : null;

  return {
    action,
    currentIndex,
    currentTitle: currentSlide ? currentSlide.currentTitle : String(slideIntent.currentTitle || ""),
    proposedIndex,
    proposedTitle,
    rationale: slideIntent.rationale,
    replacement: replacementSpec
      ? {
        slideSpec: replacementSpec
      }
      : null,
    role: String(slideIntent.role || ""),
    scaffold: scaffoldSpec
      ? {
        outlineIntent: {
          grounding,
          rationale: slideIntent.rationale,
          role: slideIntent.role,
          summary: slideIntent.summary
        },
        slideSpec: scaffoldSpec
      }
      : null,
    slideId: currentSlide ? currentSlide.id : null,
    summary: String(slideIntent.summary || ""),
    type: String(slideIntent.type || (currentSlide && currentSlide.type) || "content")
  };
}

function createDeckPatchFromLlmIntent(intent: JsonObject): JsonObject | null {
  const intentDeckPatch = asJsonObject(intent.deckPatch);
  return Object.keys(intentDeckPatch).length
    ? {
      ...intentDeckPatch,
      visualTheme: intentDeckPatch.visualTheme ? normalizeVisualTheme(intentDeckPatch.visualTheme) : undefined
    }
    : null;
}

function createDeckStructureOutline(entries: DeckPlanEntry[]): string {
  return entries
    .filter((slide: DeckPlanEntry) => Number.isFinite(slide.proposedIndex) && slide.proposedTitle)
    .sort((left: DeckPlanEntry, right: DeckPlanEntry) => Number(left.proposedIndex) - Number(right.proposedIndex))
    .map((slide: DeckPlanEntry) => slide.proposedTitle)
    .join("\n");
}

export function createDeckStructureCandidateFromLlmIntent(
  context: DeckStructureContext,
  intent: JsonObject,
  result: JsonObject,
  options: CreateDeckStructureCandidateOptions
): JsonObject {
  const intentSlides = asJsonObjectArray(intent.slides);
  const entries = intentSlides.map((slideIntent: JsonObject, index: number) => createDeckPlanEntryFromLlmIntent(context, intent, options, slideIntent, index));
  const planStats = collectDeckPlanStats(entries);
  const deckPatch = createDeckPatchFromLlmIntent(intent);
  const diff = buildDeckPlanDiff(context, entries, planStats, deckPatch);
  planStats.shared = diff.deck && Number.isFinite(diff.deck.count) ? Number(diff.deck.count) : 0;
  const preview = buildDeckPlanPreview(context, entries, planStats, diff.deck);

  return {
    changeSummary: [
      intent.changeLead,
      preview.overview,
      ...preview.cues.slice(0, 2),
      `Generated with ${result.provider} ${result.model}; applying still uses guarded preview/apply.`
    ].filter(Boolean),
    deckPatch,
    diff,
    generator: "llm",
    id: `deck-structure-${String(intent.label || "llm-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    kindLabel: "Deck plan",
    label: intent.label,
    model: result.model,
    notes: intent.notes,
    outline: createDeckStructureOutline(entries),
    planStats,
    preview,
    promptSummary: intent.promptSummary,
    provider: result.provider,
    slides: entries,
    summary: intent.summary
  };
}
