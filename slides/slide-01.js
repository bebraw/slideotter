const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "cover",
  index: 1,
  title: "Presentation Template Demo"
};

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: "f4f8fc" };

  canvas.addShape("cover-background", pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    line: { color: theme.bg, transparency: 100 },
    fill: {
      color: theme.bg,
      transparency: 0
    }
  }, {
    group: "background",
    skipBounds: true,
    skipOverlap: true
  });

  canvas.addShape("cover-right-panel", pres.ShapeType.rect, {
    x: 6.45,
    y: 0,
    w: 3.55,
    h: 5.625,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  }, {
    group: "background",
    skipBounds: true,
    skipOverlap: true
  });

  canvas.addShape("cover-overlay-panel", pres.ShapeType.rect, {
    x: 5.95,
    y: 0.4,
    w: 3.55,
    h: 4.85,
    line: { color: theme.primary, transparency: 100 },
    fill: { color: theme.primary, transparency: 6 }
  }, {
    group: "background",
    skipBounds: true,
    skipOverlap: true
  });

  canvas.addShape("cover-accent-arc", pres.ShapeType.arc, {
    x: 6.15,
    y: 1.2,
    w: 2.6,
    h: 2.6,
    line: { color: theme.accent, pt: 2.5 },
    fill: { color: theme.accent, transparency: 100 },
    adjustPoint: 0.21
  }, {
    group: "background",
    skipBounds: true,
    skipOverlap: true
  });

  canvas.addText("cover-eyebrow", "pdf-slide-generator skill", {
    x: 0.7,
    y: 0.7,
    w: 3.4,
    h: 0.5,
    fontFace,
    fontSize: 11.5,
    bold: true,
    color: theme.secondary,
    charSpace: 1.1,
    allCaps: true,
    margin: 0
  }, {
    group: "cover-header"
  });

  canvas.addText("cover-title", slideConfig.title, {
    x: 0.7,
    y: 1.15,
    w: 4.6,
    h: 0.88,
    fontFace,
    fontSize: 24,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group: "cover-header"
  });

  canvas.addText("cover-summary", "A compact deck showing the imported skill, the shared theme, and the native PDF build flow.", {
    x: 0.72,
    y: 2.35,
    w: 4.4,
    h: 0.76,
    fontFace,
    fontSize: 12.5,
    color: "4d657d",
    valign: "mid",
    margin: 0
  }, {
    group: "cover-summary"
  });

  canvas.addText("cover-footnote", "Slides are authored as CommonJS modules and compiled into a local PDF.", {
    x: 0.72,
    y: 4.55,
    w: 4.9,
    h: 0.45,
    fontFace,
    fontSize: 10.5,
    color: "6b8096",
    margin: 0
  }, {
    group: "cover-footer"
  });

  canvas.addText("cover-index", "01", {
    x: 6.6,
    y: 4.62,
    w: 2.3,
    h: 0.62,
    fontFace,
    fontSize: 30,
    bold: true,
    color: "FFFFFF",
    margin: 0
  }, {
    group: "cover-side-panel"
  });

  canvas.addText("cover-side-label", "PDF deck", {
    x: 6.62,
    y: 5.02,
    w: 2.1,
    h: 0.25,
    fontFace,
    fontSize: 11,
    color: "d7e6f5",
    margin: 0
  }, {
    group: "cover-side-panel"
  });

  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
