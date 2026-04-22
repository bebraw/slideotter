const { addPageBadge, addSectionTitle } = require("../generator/helpers");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "summary",
  index: 4,
  title: "Next steps"
};

function createChecklistItem(canvas, pres, theme, y, title, text, group) {
  canvas.addShape(`${group}-bullet`, pres.ShapeType.ellipse, {
    x: 0.72,
    y,
    w: 0.28,
    h: 0.28,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  }, {
    group
  });

  canvas.addText(`${group}-title`, title, {
    x: 1.08,
    y: y - 0.01,
    w: 3.2,
    h: 0.28,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group
  });

  canvas.addText(`${group}-body`, text, {
    x: 1.08,
    y: y + 0.28,
    w: 4.2,
    h: 0.5,
    fontFace,
    fontSize: 11,
    color: "5e7691",
    margin: 0
  }, {
    group
  });
}

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  addSectionTitle(
    canvas,
    theme,
    "Summary",
    slideConfig.title,
    "Starter path: install dependencies, build the deck, and validate visual changes."
  );

  createChecklistItem(canvas, pres, theme, 2, "Install dependencies", "Run npm install once for pdfkit, qrcode, and pptxgenjs.", "checklist-install");
  createChecklistItem(canvas, pres, theme, 2.9, "Build the deck", "Run npm run build to emit the demo presentation as a PDF.", "checklist-build");
  createChecklistItem(canvas, pres, theme, 3.8, "Validate visual changes", "Run npm run quality:gate after design edits.", "checklist-extend");

  canvas.addShape("summary-output-panel", pres.ShapeType.roundRect, {
    x: 6.15,
    y: 2,
    w: 3.05,
    h: 2.6,
    rectRadius: 0.08,
    line: { color: theme.light, pt: 1.2 },
    fill: { color: "ffffff" }
  }, {
    group: "summary-output-panel"
  });

  canvas.addText("summary-output-title", "Output", {
    x: 6.45,
    y: 2.28,
    w: 1.2,
    h: 0.28,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.secondary,
    allCaps: true,
    margin: 0
  }, {
    group: "summary-output-panel"
  });

  canvas.addText("summary-output-path", "slides/output/\ndemo-presentation.pdf", {
    x: 6.45,
    y: 2.66,
    w: 2.25,
    h: 0.55,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.primary,
    breakLine: false,
    margin: 0
  }, {
    group: "summary-output-panel"
  });

  canvas.addText("summary-output-body", "Output stays local. Approved render snapshots live in generator/render-baseline/.", {
    x: 6.45,
    y: 3.48,
    w: 2.25,
    h: 0.72,
    fontFace,
    fontSize: 10.5,
    color: "607894",
    margin: 0
  }, {
    group: "summary-output-panel"
  });

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
