import { normalizeVisualTheme } from "./deck-theme.ts";
import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray,
  compactSentence as sentence,
  normalizeSentence
} from "../../shared/json-utils.ts";
import {
  buildDeckPlanDiff,
  buildDeckPlanPreview,
  collectDeckPlanStats,
  type DeckPlanEntry,
  type DeckStructureContext,
  type DeckStructureSlide,
  type JsonObject
} from "./deck-structure-plan-model.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

type SlideSpec = JsonObject;

type CreateDeckStructureCandidateOptions = {
  readExistingSlideSpec: (slideId: string) => SlideSpec | null;
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

function createSlideSpecFromDeckIntent(intent: JsonObject, proposedIndex: number | null, baseSpec: unknown = null): SlideSpec {
  const base = asJsonObject(baseSpec);
  const requestedType = String(intent.type || "");
  const type = ["cover", "toc", "content", "summary", "divider", "quote", "photo", "photoGrid"].includes(requestedType)
    ? requestedType
    : "content";
  const title = sentence(intent.proposedTitle || intent.currentTitle, "Planned slide", 10);
  const summary = sentence(intent.summary || intent.rationale, "Support the approved deck-structure plan.", 18);
  const grounding = Array.isArray(intent.grounding) ? intent.grounding.filter(Boolean) : [];
  const prefix = `deck-plan-${proposedIndex || "x"}`;

  if (type === "divider") {
    return asJsonObject(validateSlideSpec({
      index: proposedIndex,
      title,
      type: "divider"
    }));
  }

  if (type === "quote") {
    return asJsonObject(validateSlideSpec({
      attribution: base.attribution || "Deck plan",
      context: sentence(intent.rationale, summary, 16),
      index: proposedIndex,
      quote: sentence(grounding[0] || summary, summary, 18),
      source: base.source || grounding[1] || "",
      title,
      type: "quote"
    }));
  }

  if (type === "photo" && base.media) {
    return asJsonObject(validateSlideSpec({
      caption: summary,
      index: proposedIndex,
      media: { ...asJsonObject(base.media) },
      title,
      type: "photo"
    }));
  }

  if (type === "photoGrid" && Array.isArray(base.mediaItems) && base.mediaItems.length >= 2) {
    return asJsonObject(validateSlideSpec({
      caption: summary,
      index: proposedIndex,
      mediaItems: base.mediaItems.slice(0, 3).map((item: unknown) => ({ ...asJsonObject(item) })),
      summary,
      title,
      type: "photoGrid"
    }));
  }

  if (type === "cover" || type === "toc") {
    return asJsonObject(validateSlideSpec({
      cards: createDeckIntentCards(intent, prefix),
      eyebrow: sentence(intent.role, "Plan", 3),
      index: proposedIndex,
      note: sentence(intent.rationale, "Review before applying this deck plan.", 16),
      summary,
      title,
      type
    }));
  }

  if (type === "summary") {
    return asJsonObject(validateSlideSpec({
      bullets: createDeckIntentCards(intent, prefix).map((card: JsonObject, index: number) => ({
        ...card,
        id: `${prefix}-bullet-${index + 1}`
      })),
      eyebrow: sentence(intent.role, "Summary", 3),
      index: proposedIndex,
      resources: [
        {
          body: sentence(grounding[0], "Saved brief and current outline.", 12),
          bodyFontSize: 10.8,
          id: `${prefix}-resource-1`,
          title: "Grounding"
        },
        {
          body: "Preview/apply deck-structure workflow",
          bodyFontSize: 10.8,
          id: `${prefix}-resource-2`,
          title: "Apply path"
        }
      ],
      resourcesTitle: "Plan support",
      summary,
      title,
      type: "summary"
    }));
  }

  return asJsonObject(validateSlideSpec({
    eyebrow: sentence(intent.role, "Plan", 3),
    guardrails: [
      {
        body: sentence(grounding[0], "Ground this change in the saved deck context.", 14),
        id: `${prefix}-guardrail-1`,
        title: "Grounded"
      },
      {
        body: "Preview the changed deck before applying.",
        id: `${prefix}-guardrail-2`,
        title: "Preview"
      },
      {
        body: "Apply only the selected deck-plan candidate.",
        id: `${prefix}-guardrail-3`,
        title: "Apply"
      }
    ],
    guardrailsTitle: "Plan checks",
    index: proposedIndex,
    signals: [
      {
        body: summary,
        id: `${prefix}-signal-1`,
        title: "Role"
      },
      {
        body: sentence(intent.rationale, "Explain the narrative move.", 14),
        id: `${prefix}-signal-2`,
        title: "Rationale"
      },
      {
        body: sentence(grounding[1], "Use available source or outline notes.", 14),
        id: `${prefix}-signal-3`,
        title: "Evidence"
      },
      {
        body: "Materialize after the structure plan is approved.",
        id: `${prefix}-signal-4`,
        title: "Draft"
      }
    ],
    signalsTitle: "Plan intent",
    summary,
    title,
    type: "content"
  }));
}

export function createDeckStructureCandidateFromLlmIntent(
  context: DeckStructureContext,
  intent: JsonObject,
  result: JsonObject,
  options: CreateDeckStructureCandidateOptions
): JsonObject {
  const intentSlides = asJsonObjectArray(intent.slides);
  const entries: DeckPlanEntry[] = intentSlides.map((slideIntent: JsonObject, index: number) => {
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
  });
  const planStats = collectDeckPlanStats(entries);
  const intentDeckPatch = asJsonObject(intent.deckPatch);
  const deckPatch = Object.keys(intentDeckPatch).length
    ? {
      ...intentDeckPatch,
      visualTheme: intentDeckPatch.visualTheme ? normalizeVisualTheme(intentDeckPatch.visualTheme) : undefined
    }
    : null;
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
    outline: entries
      .filter((slide: DeckPlanEntry) => Number.isFinite(slide.proposedIndex) && slide.proposedTitle)
      .sort((left: DeckPlanEntry, right: DeckPlanEntry) => Number(left.proposedIndex) - Number(right.proposedIndex))
      .map((slide: DeckPlanEntry) => slide.proposedTitle)
      .join("\n"),
    planStats,
    preview,
    promptSummary: intent.promptSummary,
    provider: result.provider,
    slides: entries,
    summary: intent.summary
  };
}
