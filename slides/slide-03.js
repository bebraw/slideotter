const { addPageBadge, addSectionTitle } = require("../generator/helpers");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "content",
  index: 3,
  title: "Why this setup works"
};

function addMetric(canvas, theme, x, y, value, label, id) {
  canvas.addText(`${id}-value`, value, {
    x,
    y,
    w: 1.2,
    h: 0.4,
    fontFace,
    fontSize: 20,
    bold: true,
    color: "FFFFFF",
    margin: 0
  }, {
    group: "content-stats-panel"
  });

  canvas.addText(`${id}-label`, label, {
    x,
    y: y + 0.42,
    w: 1.6,
    h: 0.3,
    fontFace,
    fontSize: 10.5,
    color: theme.light,
    margin: 0
  }, {
    group: "content-stats-panel"
  });
}

function addSignalBar(canvas, pres, theme, x, y, width, label, value, group) {
  canvas.addText(`${group}-label`, label, {
    x,
    y,
    w: 1.3,
    h: 0.22,
    fontFace,
    fontSize: 10,
    color: theme.primary,
    margin: 0
  }, {
    group: "content-chart-panel"
  });

  canvas.addShape(`${group}-track`, pres.ShapeType.roundRect, {
    x: x + 1.38,
    y: y + 0.03,
    w: width,
    h: 0.14,
    rectRadius: 0.04,
    line: { color: "dbe7f1", transparency: 100 },
    fill: { color: "dbe7f1" }
  }, {
    group: "content-chart-panel"
  });

  canvas.addShape(`${group}-fill`, pres.ShapeType.roundRect, {
    x: x + 1.38,
    y: y + 0.03,
    w: width * value,
    h: 0.14,
    rectRadius: 0.04,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  }, {
    group: "content-chart-panel"
  });

  canvas.addText(`${group}-value`, `${Math.round(value * 100)}%`, {
    x: x + 3.62,
    y: y - 0.02,
    w: 0.52,
    h: 0.24,
    fontFace,
    fontSize: 10,
    color: "5d7591",
    align: "right",
    margin: 0
  }, {
    group: "content-chart-panel"
  });
}

function createSlide(pres, theme, options = {}) {
  const canvas = createSlideCanvas(pres, slideConfig, options);
  const { slide } = canvas;
  slide.background = { color: "ffffff" };

  addSectionTitle(
    canvas,
    theme,
    "Signals",
    slideConfig.title,
    "Repeatability comes from native PDF rendering, explicit slide modules, and a render-based gate."
  );

  canvas.addShape("content-chart-panel", pres.ShapeType.roundRect, {
    x: 0.6,
    y: 2,
    w: 4.65,
    h: 2.45,
    rectRadius: 0.08,
    line: { color: "dbe7f1", pt: 1 },
    fill: { color: "f8fbfe" }
  }, {
    group: "content-chart-panel"
  });

  canvas.addText("content-chart-title", "Migration signals", {
    x: 0.88,
    y: 2.26,
    w: 2.2,
    h: 0.24,
    fontFace,
    fontSize: 12,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group: "content-chart-panel"
  });

  addSignalBar(canvas, pres, theme, 0.88, 2.74, 2.1, "Skill", 0.96, "signal-skill");
  addSignalBar(canvas, pres, theme, 0.88, 3.16, 2.1, "Runtime", 0.88, "signal-runtime");
  addSignalBar(canvas, pres, theme, 0.88, 3.58, 2.1, "Slides", 0.92, "signal-slides");
  addSignalBar(canvas, pres, theme, 0.88, 4, 2.1, "Docs", 0.85, "signal-docs");

  canvas.addShape("content-stats-panel", pres.ShapeType.roundRect, {
    x: 5.65,
    y: 2,
    w: 3.75,
    h: 2.45,
    rectRadius: 0.08,
    line: { color: theme.primary, transparency: 100 },
    fill: { color: theme.primary }
  }, {
    group: "content-stats-panel"
  });

  canvas.addText("content-stats-title", "Key properties", {
    x: 5.95,
    y: 2.24,
    w: 2,
    h: 0.3,
    fontFace,
    fontSize: 15,
    bold: true,
    color: "FFFFFF",
    margin: 0
  }, {
    group: "content-stats-panel"
  });

  addMetric(canvas, theme, 5.95, 2.9, "4", "Slide modules", "metric-modules");
  addMetric(canvas, theme, 7.35, 2.9, "1", "PDF build path", "metric-compile");
  addMetric(canvas, theme, 5.95, 3.72, "0", "PPTX outputs", "metric-theme");
  addMetric(canvas, theme, 7.35, 3.72, "1", "Quality gate", "metric-readme");

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
