const { resolveTheme } = require("./deck-theme.ts");
const { getDeckContext } = require("./state.ts");
const { getActivePresentationId, readPresentationDeckContext } = require("./presentations.ts");
const { getSlides, readSlideSpec } = require("./slides.ts");
const { hydrateCustomVisualSlideSpec } = require("./custom-visuals.ts");
const { renderDeckDocument, renderPresentationDocument } = require("../../client/slide-dom.ts");

type DomPreviewOptions = {
  includeSkipped?: boolean;
  presentationId?: string;
};

type DeckContext = {
  deck?: Record<string, unknown>;
};

type SlideSummary = {
  id: string;
  index: number;
  title: string;
};

function getDomPreviewState(options: DomPreviewOptions = {}) {
  const presentationId = options.presentationId || getActivePresentationId();
  const context: DeckContext = presentationId === getActivePresentationId()
    ? getDeckContext()
    : readPresentationDeckContext(presentationId);
  const deck = context && context.deck ? context.deck : {};
  const slides = getSlides({
    includeSkipped: options.includeSkipped === true,
    presentationId
  }).map((slide: SlideSummary) => {
    try {
      return {
        id: slide.id,
        index: slide.index,
        slideSpec: hydrateCustomVisualSlideSpec(readSlideSpec(slide.id, { presentationId }), { presentationId }),
        title: slide.title
      };
    } catch (error) {
      return {
        id: slide.id,
        index: slide.index,
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
  const previewState = getDomPreviewState(options);
  return renderPresentationDocument(previewState);
}

module.exports = {
  getDomPreviewState,
  renderDomPreviewDocument,
  renderPresentationPreviewDocument
};
