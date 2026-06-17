import { validateSlideSpec } from "./slide-specs/index.ts";

type JsonObject = Record<string, unknown>;

type ContentRunDeckPlanSlide = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  title?: unknown;
  value?: unknown;
  visualNeed?: unknown;
};

type ContentRunSlideSpecPayload = JsonObject & {
  skipped?: unknown;
  title?: unknown;
};

type ContentRunSlide = JsonObject & {
  slideContext?: unknown;
  slideSpec?: ContentRunSlideSpecPayload | null;
  status?: unknown;
};

type ContentRunState = JsonObject & {
  slides?: ContentRunSlide[];
};

type ContentRunDeckPlan = JsonObject & {
  slides?: ContentRunDeckPlanSlide[];
};

export type ContentRunDeck = {
  slideContexts: JsonObject;
  slideSpecs: ContentRunSlideSpecPayload[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSlideSpecPayload(value: unknown): value is ContentRunSlideSpecPayload {
  return isJsonObject(value);
}

function isContentRunSlide(value: unknown): value is ContentRunSlide {
  return isJsonObject(value);
}

function isDeckPlanSlide(value: unknown): value is ContentRunDeckPlanSlide {
  return isJsonObject(value);
}

function isDeckPlanPayload(value: unknown): value is ContentRunDeckPlan {
  return isJsonObject(value);
}

function deckPlanSlides(plan: unknown): ContentRunDeckPlanSlide[] {
  return isDeckPlanPayload(plan) && Array.isArray(plan.slides)
    ? plan.slides.filter(isDeckPlanSlide)
    : [];
}

function createSlideContext(planSlide: ContentRunDeckPlanSlide, index: number, fallbackTitle?: unknown): JsonObject {
  return {
    intent: planSlide.intent || "",
    layoutHint: planSlide.visualNeed || "",
    mustInclude: planSlide.keyMessage || "",
    notes: planSlide.sourceNeed || "",
    title: planSlide.title || fallbackTitle || `Slide ${index + 1}`,
    value: planSlide.value || ""
  };
}

function createSkippedContentRunSlideSpec(
  planSlide: ContentRunDeckPlanSlide,
  index: number,
  slideCount: number
): ContentRunSlideSpecPayload {
  const title = String(planSlide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`;
  const timestamp = new Date().toISOString();

  return {
    index: index + 1,
    skipMeta: {
      keyMessage: String(planSlide.keyMessage || ""),
      operation: "partial-content-acceptance",
      previousIndex: index + 1,
      role: String(planSlide.role || ""),
      skippedAt: timestamp,
      sourceNeed: String(planSlide.sourceNeed || ""),
      targetCount: slideCount,
      visualNeed: String(planSlide.visualNeed || "")
    },
    skipped: true,
    skipReason: "Partial generation accepted before this slide was drafted.",
    title,
    type: "divider"
  };
}

function createPlaceholderText(planSlide: ContentRunDeckPlanSlide, index: number): {
  intent: string;
  keyMessage: string;
  role: string;
  sourceNeed: string;
  title: string;
  visualNeed: string;
} {
  const title = String(planSlide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`;
  const intent = String(planSlide.intent || "").trim();
  return {
    intent,
    keyMessage: String(planSlide.keyMessage || intent || "Draft this slide from the approved outline.").trim(),
    role: String(planSlide.role || "").trim(),
    sourceNeed: String(planSlide.sourceNeed || "Use supplied context when relevant.").trim(),
    title,
    visualNeed: String(planSlide.visualNeed || "Use a simple readable layout.").trim()
  };
}

function createOpeningPlaceholderSlide(text: ReturnType<typeof createPlaceholderText>): ContentRunSlideSpecPayload {
  return {
    type: "cover",
    title: text.title,
    logo: "slideotter",
    eyebrow: "Pending",
    summary: text.keyMessage,
    note: text.intent || "Waiting for slide generation.",
    cards: [
      {
        id: "pending-intent",
        title: "Intent",
        body: text.intent || "Draft this opening slide from the approved outline."
      },
      {
        id: "pending-source",
        title: "Source",
        body: text.sourceNeed
      },
      {
        id: "pending-visual",
        title: "Visual",
        body: text.visualNeed
      }
    ]
  };
}

function createClosingPlaceholderSlide(text: ReturnType<typeof createPlaceholderText>): ContentRunSlideSpecPayload {
  return {
    type: "summary",
    title: text.title,
    eyebrow: "Pending",
    summary: text.keyMessage,
    resourcesTitle: "Outline context",
    bullets: [
      {
        id: "pending-intent",
        title: "Intent",
        body: text.intent || "Close the deck from the approved outline."
      },
      {
        id: "pending-message",
        title: "Message",
        body: text.keyMessage
      },
      {
        id: "pending-visual",
        title: "Visual",
        body: text.visualNeed
      }
    ],
    resources: [
      {
        id: "pending-source",
        title: "Source need",
        body: text.sourceNeed
      },
      {
        id: "pending-role",
        title: "Role",
        body: text.role || "Final slide"
      }
    ]
  };
}

function createContentPlaceholderSlide(text: ReturnType<typeof createPlaceholderText>): ContentRunSlideSpecPayload {
  return {
    type: "content",
    title: text.title,
    eyebrow: "Pending",
    summary: text.keyMessage,
    signalsTitle: "Outline context",
    guardrailsTitle: "Generation notes",
    signals: [
      {
        id: "pending-intent",
        title: "Intent",
        body: text.intent || "Draft this slide from the approved outline."
      },
      {
        id: "pending-message",
        title: "Key message",
        body: text.keyMessage
      },
      {
        id: "pending-source",
        title: "Source need",
        body: text.sourceNeed
      }
    ],
    guardrails: [
      {
        id: "pending-status",
        title: "Status",
        body: "Waiting for generation."
      },
      {
        id: "pending-role",
        title: "Role",
        body: text.role || "Outline slide"
      },
      {
        id: "pending-apply",
        title: "Boundary",
        body: "Generated content will replace this placeholder after validation."
      }
    ]
  };
}

function createLiveContentRunPlaceholderSlideSpec(
  planSlide: ContentRunDeckPlanSlide,
  index: number,
  slideCount: number
): ContentRunSlideSpecPayload {
  const text = createPlaceholderText(planSlide, index);

  if (index === 0) {
    return createOpeningPlaceholderSlide(text);
  }

  if (index === slideCount - 1) {
    return createClosingPlaceholderSlide(text);
  }

  return createContentPlaceholderSlide(text);
}

export function createLiveContentRunPlaceholderDeck(deckPlan: unknown): ContentRunDeck {
  const planSlides = deckPlanSlides(deckPlan);
  const slideCount = planSlides.length;
  const slideContexts: JsonObject = {};
  const slideSpecs = planSlides.map((planSlide: ContentRunDeckPlanSlide, index: number) => {
    const contextKey = `slide-${String(index + 1).padStart(2, "0")}`;
    slideContexts[contextKey] = createSlideContext(planSlide, index);
    return createLiveContentRunPlaceholderSlideSpec(planSlide, index, slideCount);
  });

  return {
    slideContexts,
    slideSpecs: slideSpecs.filter(isSlideSpecPayload)
  };
}

export function buildPartialContentRunDeck(run: ContentRunState, deckPlan: unknown): ContentRunDeck {
  const planSlides = deckPlanSlides(deckPlan);
  const runSlides = Array.isArray(run.slides) ? run.slides.filter(isContentRunSlide) : [];
  const slideCount = planSlides.length;
  const slideContexts: JsonObject = {};
  const slideSpecs = planSlides.map((planSlide: ContentRunDeckPlanSlide, index: number) => {
    const runSlide = runSlides[index] || {};
    const contextKey = `slide-${String(index + 1).padStart(2, "0")}`;
    if (runSlide.status === "complete" && isSlideSpecPayload(runSlide.slideSpec)) {
      slideContexts[contextKey] = runSlide.slideContext || createSlideContext(planSlide, index, runSlide.slideSpec.title);
      return validateSlideSpec({
        ...runSlide.slideSpec,
        index: index + 1
      });
    }

    slideContexts[contextKey] = createSlideContext(planSlide, index);
    return createSkippedContentRunSlideSpec(planSlide, index, slideCount);
  });

  return {
    slideContexts,
    slideSpecs: slideSpecs.filter(isSlideSpecPayload)
  };
}
