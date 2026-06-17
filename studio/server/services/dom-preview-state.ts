import { hydrateCustomVisualSlideSpec } from "./custom-visuals.ts";
import { resolveTheme } from "./deck-theme.ts";
import {
  normalizeDeckNavigation,
  orderSlidesForNavigation,
  validateDeckNavigation
} from "./navigation.ts";
import { getActivePresentationId } from "./active-presentation.ts";
import { readPresentationDeckContext } from "./presentation-context-store.ts";
import { getSlides } from "./slide-queries.ts";
import { readSlideSpec } from "./slide-spec-store.ts";
import { getDeckContext } from "./deck-context-store.ts";

type DomPreviewOptions = {
  includeDetours?: boolean;
  includeSkipped?: boolean;
  presentationId?: string;
};

type DeckContext = {
  deck?: Record<string, unknown>;
};

type SlideSummary = {
  id: string;
  index: number;
  skipped?: boolean;
  title: string;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function getDomPreviewState(options: DomPreviewOptions = {}) {
  const presentationId = options.presentationId || getActivePresentationId();
  const context: DeckContext = presentationId === getActivePresentationId()
    ? getDeckContext()
    : readPresentationDeckContext(presentationId);
  const deck = context && context.deck ? context.deck : {};
  const slideInfos = getSlides({
    includeSkipped: true,
    presentationId
  });
  const navigation = normalizeDeckNavigation(deck.navigation, slideInfos);
  const orderedSlides = options.includeSkipped === true
    ? slideInfos
    : orderSlidesForNavigation(slideInfos, navigation, { includeDetours: options.includeDetours === true });
  const navigationValidation = validateDeckNavigation(deck.navigation, slideInfos);
  const slides = orderedSlides.map((slide: SlideSummary & { x?: number; y?: number }) => {
    try {
      return {
        id: slide.id,
        index: slide.index,
        presentationX: Number.isFinite(Number(slide.x)) ? Number(slide.x) : slide.index,
        presentationY: Number.isFinite(Number(slide.y)) ? Number(slide.y) : 0,
        slideSpec: hydrateCustomVisualSlideSpec(readSlideSpec(slide.id, { presentationId }), { presentationId }),
        title: slide.title
      };
    } catch (error) {
      return {
        id: slide.id,
        index: slide.index,
        presentationX: Number.isFinite(Number(slide.x)) ? Number(slide.x) : slide.index,
        presentationY: Number.isFinite(Number(slide.y)) ? Number(slide.y) : 0,
        slideSpec: null,
        title: slide.title
      };
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    lang: textValue(deck.lang, "en"),
    metadata: {
      author: textValue(deck.author),
      company: textValue(deck.company),
      objective: textValue(deck.objective),
      subject: textValue(deck.subject)
    },
    navigation: {
      ...navigation,
      coordinates: navigationValidation.coordinates,
      issues: navigationValidation.issues,
      ok: navigationValidation.ok
    },
    presentationId,
    slides,
    theme: resolveTheme(optionalRecord(deck.visualTheme)),
    title: textValue(deck.title, "slideotter")
  };
}

export {
  getDomPreviewState
};
export type { DomPreviewOptions };
