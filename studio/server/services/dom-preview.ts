const { resolveTheme } = require("./deck-theme.ts");
const { getDeckContext } = require("./state.ts");
const { getActivePresentationId, readPresentationDeckContext } = require("./presentations.ts");
const { getSlides, readSlideSpec } = require("./slides.ts");
const { hydrateCustomVisualSlideSpec } = require("./custom-visuals.ts");
const {
  normalizeDeckNavigation,
  orderSlidesForNavigation,
  validateDeckNavigation
} = require("./navigation.ts");
const { renderDeckDocument, renderPresentationDocument } = require("../../client/preview/slide-dom.ts");

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
    lang: deck.lang || "en",
    metadata: {
      author: deck.author || "",
      company: deck.company || "",
      objective: deck.objective || "",
      subject: deck.subject || ""
    },
    navigation: {
      ...navigation,
      coordinates: navigationValidation.coordinates,
      issues: navigationValidation.issues,
      ok: navigationValidation.ok
    },
    slides,
    theme: resolveTheme(deck.visualTheme),
    title: deck.title ? deck.title : "slideotter"
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

module.exports = {
  getDomPreviewState,
  renderDomPreviewDocument,
  renderPresentationPreviewDocument
};
