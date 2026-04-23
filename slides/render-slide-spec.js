const {
  addAccentRule,
  addBulletItem,
  addCompactCard,
  addPageBadge,
  addPanel,
  addSectionTitle
} = require("../generator/helpers");
const {
  boxBelow,
  bulletItemHeight,
  centeredTextBlock,
  createFrame,
  createFrame: makeFrame,
  insetFrame,
  sectionContentFrame,
  splitColumns,
  stackInFrame
} = require("../generator/layout");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

function createCoverSlide(pres, theme, slideSpec, options = {}) {
  const canvas = createSlideCanvas(pres, slideSpec, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  const mainFrame = createFrame({
    x: 0.62,
    y: 0.46,
    w: 8.76,
    h: 4.72
  });
  const columns = splitColumns(mainFrame, {
    gap: 0.42,
    leftWidth: 5.28
  });
  const copyFrame = insetFrame(columns.left, {
    bottom: 0.24,
    right: 0.18,
    top: 0.06
  });
  const cardsFrame = insetFrame(columns.right, {
    bottom: 0.28,
    top: 0.22
  });

  addAccentRule(canvas, pres, theme, {
    force: true,
    group: "cover-header",
    id: "cover-rule",
    w: 2.18,
    x: copyFrame.x,
    y: copyFrame.y
  });

  canvas.addText("cover-eyebrow", slideSpec.eyebrow, {
    x: copyFrame.x,
    y: 0.82,
    w: 3.5,
    h: 0.24,
    allCaps: true,
    bold: true,
    charSpace: 1.1,
    color: theme.secondary,
    fontFace,
    fontSize: 11.2,
    margin: 0
  }, {
    group: "cover-header"
  });

  const titleBox = centeredTextBlock(createFrame({
    x: copyFrame.x,
    y: 1.16,
    w: 4.96,
    h: 0.96
  }), slideSpec.title, {
    bold: true,
    fontFace,
    fontSize: 26,
    minHeight: 0.74
  });

  canvas.addText("cover-title", slideSpec.title, {
    ...titleBox,
    color: theme.primary,
    fontFace,
    fontSize: 26,
    bold: true,
    margin: 0
  }, {
    group: "cover-header"
  });

  const summaryBox = boxBelow(titleBox, {
    gap: 0.34,
    h: 0.76,
    w: 4.7
  });

  canvas.addText("cover-summary", slideSpec.summary, {
    ...summaryBox,
    color: theme.muted,
    fontFace,
    fontSize: 12.3,
    margin: 0
  }, {
    group: "cover-summary"
  });

  canvas.addText("cover-footnote", slideSpec.note, {
    x: copyFrame.x,
    y: 4.28,
    w: 4.96,
    h: 0.42,
    color: theme.muted,
    fontFace,
    fontSize: 10.5,
    margin: 0
  }, {
    group: "cover-footer"
  });

  const cardLayout = stackInFrame(cardsFrame, slideSpec.cards.map((card) => ({
    ...card,
    height: 0.94
  })), {
    gap: 0.22,
    justify: "center"
  });

  cardLayout.forEach((card) => {
    addCompactCard(canvas, pres, theme, {
      body: card.body,
      bodyFontSize: 10,
      bodyH: 0.4,
      h: 0.94,
      id: card.id,
      title: card.title,
      titleFontSize: 12,
      w: card.w,
      x: card.x,
      y: card.y
    });
  });

  addPageBadge(canvas, pres, theme, slideSpec.index, {
    total: options.totalSlides
  });
  return canvas.finalize();
}

function createTocSlide(pres, theme, slideSpec, options = {}) {
  const canvas = createSlideCanvas(pres, slideSpec, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  addSectionTitle(
    canvas,
    theme,
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary
  );

  const contentFrame = sectionContentFrame({
    bottom: 4.94,
    hasBody: true,
    right: 9.34
  });
  const firstSplit = splitColumns(contentFrame, {
    gap: 0.3,
    leftWidth: 2.74
  });
  const secondSplit = splitColumns(firstSplit.right, {
    gap: 0.3,
    leftWidth: 2.74
  });
  const cardFrames = [
    createFrame({ ...firstSplit.left, y: 2.26, h: 1.84 }),
    createFrame({ ...secondSplit.left, y: 2.26, h: 1.84 }),
    createFrame({ ...secondSplit.right, y: 2.26, h: 1.84 })
  ];

  slideSpec.cards.forEach((card, index) => {
    const frame = cardFrames[index];
    addCompactCard(canvas, pres, theme, {
      body: card.body,
      bodyFontSize: 10.1,
      bodyH: 0.76,
      bodyY: 0.5,
      h: frame.h,
      id: card.id,
      title: card.title,
      titleFontSize: 12.8,
      w: frame.w,
      x: frame.x,
      y: frame.y
    });
  });

  canvas.addText("outline-note", slideSpec.note, {
    x: contentFrame.x,
    y: 4.4,
    w: contentFrame.w,
    h: 0.32,
    color: theme.muted,
    fontFace,
    fontSize: 10.4,
    margin: 0
  }, {
    group: "outline-note",
    skipOverlap: true
  });

  addPageBadge(canvas, pres, theme, slideSpec.index, {
    total: options.totalSlides
  });
  return canvas.finalize();
}

function addSignalBar(canvas, pres, theme, options = {}) {
  const { id, label, value, x, y, w } = options;
  const trackX = x + 1.12;
  const trackW = w - 1.76;

  canvas.addText(`${id}-label`, label, {
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

  canvas.addShape(`${id}-track`, pres.ShapeType.roundRect, {
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

  canvas.addShape(`${id}-fill`, pres.ShapeType.roundRect, {
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

  canvas.addText(`${id}-value`, `${Math.round(value * 100)}%`, {
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
  const { drawDivider = true, id, label, value, w, x, y } = options;

  canvas.addText(`${id}-value`, value, {
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

  canvas.addText(`${id}-label`, label, {
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
    canvas.addShape(`${id}-divider`, pres.ShapeType.line, {
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

function createContentSlide(pres, theme, slideSpec, options = {}) {
  const canvas = createSlideCanvas(pres, slideSpec, options);
  const { slide } = canvas;
  slide.background = { color: "ffffff" };

  addSectionTitle(
    canvas,
    theme,
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary
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

  canvas.addText("content-signals-title", slideSpec.signalsTitle, {
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

  const signalLayout = stackInFrame(makeFrame({
    x: columns.left.x + 0.28,
    y: columns.left.y + 0.76,
    w: columns.left.w - 0.56,
    h: 1.62
  }), slideSpec.signals.map((bar) => ({
    ...bar,
    height: 0.24
  })), {
    gap: 0.22,
    justify: "top"
  });

  signalLayout.forEach((bar) => {
    addSignalBar(canvas, pres, theme, {
      id: bar.id,
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

  canvas.addText("content-guardrails-title", slideSpec.guardrailsTitle, {
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

  const guardrailLayout = stackInFrame(makeFrame({
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.82,
    w: columns.right.w - 0.56,
    h: 1.78
  }), slideSpec.guardrails.map((item) => ({
    ...item,
    height: 0.6
  })), {
    gap: 0.08,
    justify: "top"
  });

  guardrailLayout.forEach((item, index) => {
    addGuardrailRow(canvas, pres, theme, {
      drawDivider: index < guardrailLayout.length - 1,
      id: item.id,
      label: item.label,
      value: item.value,
      w: item.w,
      x: item.x,
      y: item.y
    });
  });

  addPageBadge(canvas, pres, theme, slideSpec.index, {
    total: options.totalSlides
  });
  return canvas.finalize();
}

function createSummarySlide(pres, theme, slideSpec, options = {}) {
  const canvas = createSlideCanvas(pres, slideSpec, options);
  const { slide } = canvas;
  slide.background = { color: theme.bg };

  addSectionTitle(
    canvas,
    theme,
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary
  );

  const contentFrame = sectionContentFrame({
    bottom: 4.96,
    hasBody: true,
    right: 9.28
  });
  const columns = splitColumns(contentFrame, {
    gap: 0.4,
    leftWidth: 5.08
  });

  const bulletLayout = stackInFrame(makeFrame({
    x: columns.left.x,
    y: columns.left.y + 0.06,
    w: columns.left.w,
    h: columns.left.h - 0.12
  }), slideSpec.bullets.map((item) => ({
    ...item,
    height: bulletItemHeight({
      body: item.body,
      bodyH: 0.42
    })
  })), {
    gap: 0.26,
    justify: "center"
  });

  bulletLayout.forEach((item) => {
    addBulletItem(canvas, pres, theme, {
      body: item.body,
      bodyH: 0.42,
      bodyOffset: 0.28,
      id: item.id,
      title: item.title,
      titleFontSize: 12.6,
      w: item.w,
      x: item.x + 0.04,
      y: item.y
    });
  });

  addPanel(canvas, pres, theme, "summary-resources-panel", {
    fillColor: "FFFFFF",
    group: "summary-resources",
    h: columns.right.h,
    lineColor: theme.light,
    w: columns.right.w,
    x: columns.right.x,
    y: columns.right.y
  });

  canvas.addText("summary-resources-title", slideSpec.resourcesTitle, {
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.24,
    w: columns.right.w - 0.56,
    h: 0.24,
    allCaps: true,
    bold: true,
    charSpace: 1,
    color: theme.secondary,
    fontFace,
    fontSize: 11.2,
    margin: 0
  }, {
    group: "summary-resources"
  });

  const resourceLayout = stackInFrame(makeFrame({
    x: columns.right.x + 0.28,
    y: columns.right.y + 0.62,
    w: columns.right.w - 0.56,
    h: 1.92
  }), slideSpec.resources.map((card) => ({
    ...card,
    height: 0.94
  })), {
    gap: 0.24,
    justify: "top"
  });

  resourceLayout.forEach((card) => {
    addCompactCard(canvas, pres, theme, {
      body: card.body,
      bodyFontSize: card.bodyFontSize,
      bodyH: 0.48,
      fillColor: theme.panel,
      group: "summary-resources",
      h: 0.94,
      id: card.id,
      title: card.title,
      titleFontSize: 12,
      w: card.w,
      x: card.x,
      y: card.y
    });
  });

  addPageBadge(canvas, pres, theme, slideSpec.index, {
    total: options.totalSlides
  });
  return canvas.finalize();
}

function createSlideFromSpec(pres, theme, slideSpec, options = {}) {
  switch (slideSpec.type) {
    case "cover":
      return createCoverSlide(pres, theme, slideSpec, options);
    case "toc":
      return createTocSlide(pres, theme, slideSpec, options);
    case "content":
      return createContentSlide(pres, theme, slideSpec, options);
    case "summary":
      return createSummarySlide(pres, theme, slideSpec, options);
    default:
      throw new Error(`Unsupported slide spec type "${slideSpec.type}"`);
  }
}

module.exports = {
  createSlideFromSpec
};
