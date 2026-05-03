import { resolveTheme } from "./deck-theme.ts";
import { getDeckContext } from "./state.ts";
import { getActivePresentationId, readPresentationDeckContext } from "./presentations.ts";
import { getSlides, readSlideSpec } from "./slides.ts";
import { hydrateCustomVisualSlideSpec } from "./custom-visuals.ts";
import {
  normalizeDeckNavigation,
  orderSlidesForNavigation,
  validateDeckNavigation
} from "./navigation.ts";
import { renderDeckDocument, renderPresentationDocument } from "../../rendering/slide-dom.ts";

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
    slides,
    theme: resolveTheme(optionalRecord(deck.visualTheme)),
    title: textValue(deck.title, "slideotter")
  };
}

function renderDomPreviewDocument() {
  const previewState = getDomPreviewState();
  return renderDeckDocument(previewState);
}

function renderPresentationPreviewDocument(options: DomPreviewOptions = {}) {
  const previewState = getDomPreviewState({
    ...options,
    includeDetours: true
  });
  return renderPresentationDocument(previewState);
}

export {
  getDomPreviewState,
  renderDomPreviewDocument,
  renderPresentationPreviewDocument
};
