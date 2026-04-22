const {
  addPageBadge,
  addPanel,
  addSectionTitle
} = require("../generator/helpers");
const {
  createFrame,
  sectionContentFrame,
  splitColumns,
  stackInFrame
} = require("../generator/layout");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "content",
  index: 3,
  title: "Why this setup works"
};

const signalBars = [
  { id: "signal-slides", label: "Slides", value: 0.94 },
  { id: "signal-runtime", label: "Runtime", value: 0.89 },
  { id: "signal-layout", label: "Layout", value: 0.91 },
  { id: "signal-validation", label: "Validation", value: 0.87 }
];

const guardrails = [
  {
    id: "guardrail-modules",
    label: "slide modules",
    value: "4"
  },
  {
    id: "guardrail-build",
    label: "PDF build path",
    value: "1"
  },
  {
    id: "guardrail-pptx",
    label: "PPTX outputs",
    value: "0"
  }
];

function addSignalBar(canvas, pres, theme, options = {}) {
  const {
    label,
    value,
    x,
    y,
    w
  } = options;
  const trackX = x + 1.12;
  const trackW = w - 1.76;

  canvas.addText(`${label}-label`, label, {
    x,
    y,
    w: 1,
    h: 0.24,
    color: theme.primary,
    fontFace,
    fontSize: 10.6,
    margin: 0
  }, {
    group: "content-signals"
  });

  canvas.addShape(`${label}-track`, pres.ShapeType.roundRect, {
    x: trackX,
    y: y + 0.05,
    w: trackW,
    h: 0.13,
    rectRadius: 0.04,
    line: { color: theme.light, transparency: 100 },
    fill: { color: theme.light }
  }, {
    group: "content-signals"
  });

  canvas.addShape(`${label}-fill`, pres.ShapeType.roundRect, {
    x: trackX,
    y: y + 0.05,
    w: trackW * value,
    h: 0.13,
    rectRadius: 0.04,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  }, {
    group: "content-signals"
  });

  canvas.addText(`${label}-value`, `${Math.round(value * 100)}%`, {
    x: x + w - 0.5,
    y: y - 0.01,
    w: 0.5,
    h: 0.24,
    align: "right",
    color: theme.muted,
    fontFace,
    fontSize: 10.2,
    margin: 0
  }, {
    group: "content-signals"
  });
}

function addGuardrailRow(canvas, pres, theme, options = {}) {
  const {
    drawDivider = true,
    label,
    value,
    w,
    x,
    y
  } = options;

  canvas.addText(`${label}-value`, value, {
    x,
    y,
    w: 0.5,
    h: 0.36,
    color: theme.primary,
    fontFace,
    fontSize: 19.2,
    bold: true,
    margin: 0
  }, {
    group: "content-guardrails"
  });

  canvas.addText(`${label}-label`, label, {
    x: x + 0.64,
    y: y + 0.08,
    w: w - 0.64,
    h: 0.24,
    color: theme.primary,
    fontFace,
    fontSize: 11.8,
    bold: true,
    margin: 0
  }, {
    group: "content-guardrails"
  });

  if (drawDivider) {
    canvas.addShape(`${label}-divider`, pres.ShapeType.line, {
      x,
      y: y + 0.58,
      w,
      h: 0,
      line: { color: theme.light, pt: 1 }
    }, {
      group: "content-guardrails"
    });
  }
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

  const contentFrame = sectionContentFrame({
    bottom: 5.08,
    right: 9.28,
    top: 2.06
  });
  const columns = splitColumns(contentFrame, {
    gap: 0.36,
    leftWidth: 4.58
  });

  addPanel(canvas, pres, theme, "content-signals-panel", {
    fillColor: theme.panel,
    group: "content-signals",
    h: columns.left.h,
    lineColor: theme.light,
    w: columns.left.w,
    x: columns.left.x,
    y: columns.left.y
  });

  canvas.addText("content-signals-title", "Migration signals", {
    x: columns.left.x + 0.28,
    y: columns.left.y + 0.24,
    w: 2.6,
    h: 0.26,
    color: theme.primary,
    fontFace,
    fontSize: 12.2,
    bold: true,
    margin: 0
  }, {
    group: "content-signals"
  });

  const signalLayout = stackInFrame(createFrame({
    x: columns.left.x + 0.28,
    y: columns.left.y + 0.76,
    w: columns.left.w - 0.56,
    h: 1.62
  }), signalBars.map((bar) => ({
    ...bar,
    height: 0.24
  })), {
    gap: 0.22,
    justify: "top"
  });

  signalLayout.forEach((bar) => {
    addSignalBar(canvas, pres, theme, {
      label: bar.label,
      value: bar.value,
      w: bar.w,
      x: bar.x,
      y: bar.y
    });
  });

  addPanel(canvas, pres, theme, "content-guardrails-panel", {
    fillColor: theme.panel,
    group: "content-guardrails",
    h: columns.right.h,
    lineColor: theme.light,
    w: columns.right.w,
    x: columns.right.x,
    y: columns.right.y
  });

  canvas.addText("content-guardrails-title", "Operational guardrails", {
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.24,
    w: columns.right.w - 0.56,
    h: 0.26,
    color: theme.primary,
    fontFace,
    fontSize: 12.2,
    bold: true,
    margin: 0
  }, {
    group: "content-guardrails"
  });

  const guardrailLayout = stackInFrame(createFrame({
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.82,
    w: columns.right.w - 0.56,
    h: 1.78
  }), guardrails.map((item) => ({
    ...item,
    height: 0.6
  })), {
    gap: 0.08,
    justify: "top"
  });

  guardrailLayout.forEach((item, index) => {
    addGuardrailRow(canvas, pres, theme, {
      drawDivider: index < guardrailLayout.length - 1,
      label: item.label,
      value: item.value,
      w: item.w,
      x: item.x,
      y: item.y
    });
  });

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
