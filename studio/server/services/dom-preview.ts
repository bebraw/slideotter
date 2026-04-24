const { resolveTheme } = require("./deck-theme.ts");
const { getDeckContext } = require("./state.ts");
const { getSlides, readSlideSpec } = require("./slides.ts");
const { renderDeckDocument } = require("../../client/slide-dom.ts");

function getDomPreviewState() {
  const context = getDeckContext();
  const deck = context && context.deck ? context.deck : {};
  const slides = getSlides().map((slide) => {
    try {
      return {
        id: slide.id,
        index: slide.index,
        slideSpec: readSlideSpec(slide.id),
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

module.exports = {
  getDomPreviewState,
  renderDomPreviewDocument
};
