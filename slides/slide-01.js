const { fontFace } = require("./theme");

const slideConfig = {
  type: "cover",
  index: 1,
  title: "Presentation Template Demo"
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: "f4f8fc" };

  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    line: { color: theme.bg, transparency: 100 },
    fill: {
      color: theme.bg,
      transparency: 0
    }
  });

  slide.addShape(pres.ShapeType.rect, {
    x: 6.45,
    y: 0,
    w: 3.55,
    h: 5.625,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  });

  slide.addShape(pres.ShapeType.rect, {
    x: 5.95,
    y: 0.4,
    w: 3.55,
    h: 4.85,
    line: { color: theme.primary, transparency: 100 },
    fill: { color: theme.primary, transparency: 6 }
  });

  slide.addShape(pres.ShapeType.arc, {
    x: 6.15,
    y: 1.2,
    w: 2.6,
    h: 2.6,
    line: { color: theme.accent, pt: 2.5 },
    fill: { color: theme.accent, transparency: 100 },
    adjustPoint: 0.21
  });

  slide.addText("pptx-generator skill", {
    x: 0.7,
    y: 0.7,
    w: 2.8,
    h: 0.3,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.accent,
    charSpace: 1.4,
    allCaps: true,
    margin: 0
  });

  slide.addText(slideConfig.title, {
    x: 0.7,
    y: 1.15,
    w: 4.9,
    h: 1.45,
    fontFace,
    fontSize: 27,
    bold: true,
    color: theme.primary,
    fit: "shrink",
    margin: 0
  });

  slide.addText("A four-slide example deck that shows the skill workflow, theme contract, and output structure in a form you can compile locally.", {
    x: 0.72,
    y: 2.8,
    w: 4.5,
    h: 0.85,
    fontFace,
    fontSize: 14,
    color: "4d657d",
    valign: "mid",
    margin: 0
  });

  slide.addText("Slides are authored as CommonJS modules and assembled by slides/compile.js into a final PPTX.", {
    x: 0.72,
    y: 4.55,
    w: 4.9,
    h: 0.45,
    fontFace,
    fontSize: 10.5,
    color: "6b8096",
    margin: 0
  });

  slide.addText("01", {
    x: 6.6,
    y: 4.62,
    w: 2.3,
    h: 0.46,
    fontFace,
    fontSize: 30,
    bold: true,
    color: "FFFFFF",
    margin: 0
  });

  slide.addText("Demo deck", {
    x: 6.62,
    y: 5.02,
    w: 2.1,
    h: 0.25,
    fontFace,
    fontSize: 11,
    color: "d7e6f5",
    margin: 0
  });

  return slide;
}

module.exports = { createSlide, slideConfig };

