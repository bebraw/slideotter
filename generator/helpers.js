const { bodyFont, displayFont } = require("./theme");

const liveDemoUrl = "https://french-cheese-shop-demo.survivejs.workers.dev";

function addAccentRule(canvas, pres, theme, options = {}) {
  const {
    id = "accent-rule",
    x = 0.62,
    y = 0.42,
    w = 2.2,
    h = 0.08,
    force = false,
    group = id
  } = options;

  if (!force) {
    return;
  }

  canvas.addShape(id, pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.03,
    line: { color: theme.secondary, transparency: 100 },
    fill: { color: theme.secondary }
  }, {
    group
  });
}

function addPanel(canvas, pres, theme, id, options = {}) {
  const {
    x,
    y,
    w,
    h,
    rectRadius = 0.08,
    lineColor = theme.light,
    linePt = 1,
    fillColor = theme.surface,
    group = id
  } = options;

  canvas.addShape(id, pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius,
    line: { color: lineColor, pt: linePt },
    fill: { color: fillColor }
  }, {
    group,
    role: "panel"
  });
}

function addCompactCard(canvas, pres, theme, options = {}) {
  const {
    id,
    x,
    y,
    w = 2.5,
    h = 0.82,
    title,
    body,
    titleY = 0.11,
    titleH = 0.24,
    bodyY,
    bodyH,
    titleFontSize = 11.6,
    bodyFontSize = 10.2,
    lineColor = theme.light,
    fillColor = theme.surface,
    titleColor = theme.primary,
    bodyColor = theme.muted,
    group = id
  } = options;

  addPanel(canvas, pres, theme, `${id}-panel`, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    lineColor,
    fillColor,
    group
  });

  canvas.addText(`${id}-title`, title, {
    x: x + 0.18,
    y: y + titleY,
    w: w - 0.34,
    h: titleH,
    fontFace: bodyFont,
    fontSize: titleFontSize,
    bold: true,
    color: titleColor,
    margin: 0
  }, {
    group
  });

  if (body) {
    const resolvedBodyY = typeof bodyY === "number" ? bodyY : titleY + titleH;
    const resolvedBodyH = typeof bodyH === "number" ? bodyH : h - resolvedBodyY - 0.1;

    canvas.addText(`${id}-body`, body, {
      x: x + 0.18,
      y: y + resolvedBodyY,
      w: w - 0.34,
      h: resolvedBodyH,
      fontFace: bodyFont,
      fontSize: bodyFontSize,
      color: bodyColor,
      margin: 0
    }, {
      group
    });
  }
}

function addBulletItem(canvas, pres, theme, options = {}) {
  const {
    id,
    x,
    y,
    title,
    body,
    w = 4,
    titleH = 0.28,
    bodyOffset = 0.26,
    bodyH = 0.38,
    titleFontSize = 11.2,
    bodyFontSize = 10.2,
    bulletLineColor = theme.primary,
    bulletFillColor = theme.surface,
    bulletCenterColor = theme.primary,
    titleColor = theme.primary,
    bodyColor = theme.muted,
    group = id
  } = options;

  canvas.addShape(`${id}-bullet`, pres.ShapeType.ellipse, {
    x,
    y: y + 0.04,
    w: 0.16,
    h: 0.16,
    line: { color: bulletLineColor, pt: 1 },
    fill: { color: bulletFillColor }
  }, {
    group
  });

  canvas.addShape(`${id}-bullet-center`, pres.ShapeType.ellipse, {
    x: x + 0.05,
    y: y + 0.09,
    w: 0.06,
    h: 0.06,
    line: { color: bulletCenterColor, transparency: 100 },
    fill: { color: bulletCenterColor }
  }, {
    group
  });

  canvas.addText(`${id}-title`, title, {
    x: x + 0.26,
    y,
    w: w - 0.26,
    h: titleH,
    fontFace: bodyFont,
    fontSize: titleFontSize,
    bold: true,
    color: titleColor,
    margin: 0
  }, {
    group
  });

  if (body) {
    canvas.addText(`${id}-body`, body, {
      x: x + 0.26,
      y: y + bodyOffset,
      w: w - 0.26,
      h: bodyH,
      fontFace: bodyFont,
      fontSize: bodyFontSize,
      color: bodyColor,
      margin: 0
    }, {
      group
    });
  }
}

function addStatChip(canvas, pres, theme, options = {}) {
  const {
    id,
    x,
    y,
    w = 1.8,
    value,
    label,
    valueFontSize = 14.5,
    labelFontSize = 9.2,
    group = id
  } = options;

  addPanel(canvas, pres, theme, `${id}-panel`, {
    x,
    y,
    w,
    h: 0.68,
    rectRadius: 0.06,
    lineColor: theme.secondary,
    linePt: 1,
    fillColor: theme.panel,
    group
  });

  canvas.addText(`${id}-value`, value, {
    x: x + 0.14,
    y: y + 0.08,
    w: w - 0.28,
    h: 0.28,
    fontFace: displayFont,
    fontSize: valueFontSize,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group
  });

  canvas.addText(`${id}-label`, label, {
    x: x + 0.14,
    y: y + 0.34,
    w: w - 0.28,
    h: 0.18,
    fontFace: bodyFont,
    fontSize: labelFontSize,
    color: theme.muted,
    margin: 0
  }, {
    group
  });
}

function addPageBadge(canvas, pres, theme, number, options = {}) {
  const {
    x = 0,
    y = 5.54,
    w = 10,
    h = 0.085,
    trackColor = theme.progressTrack,
    fillColor = theme.progressFill,
    total = theme.slideCount || number
  } = options;
  const safeTotal = Math.max(total, number, 1);
  const progressWidth = Math.max((number / safeTotal) * w, h);

  canvas.addShape("slide-progress-track", pres.ShapeType.rect, {
    x,
    y,
    w,
    h,
    line: { color: trackColor, transparency: 100 },
    fill: { color: trackColor }
  }, {
    group: "slide-progress",
    skipOverlap: true
  });

  canvas.addShape("slide-progress-fill", pres.ShapeType.rect, {
    x,
    y,
    w: progressWidth,
    h,
    line: { color: fillColor, transparency: 100 },
    fill: { color: fillColor }
  }, {
    group: "slide-progress",
    skipOverlap: true
  });
}

function addSectionTitle(canvas, theme, eyebrow, title, body) {
  if (eyebrow) {
    canvas.addText("section-eyebrow", eyebrow, {
      x: 0.62,
      y: 0.44,
      w: 3.8,
      h: 0.24,
      fontFace: bodyFont,
      fontSize: 11.2,
      bold: true,
      color: theme.secondary,
      charSpace: 1.1,
      allCaps: true,
      margin: 0
    }, {
      group: "section-header"
    });
  }

  canvas.addText("section-title", title, {
    x: 0.62,
    y: 0.74,
    w: 7.6,
    h: 0.5,
    fontFace: displayFont,
    fontSize: 23,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group: "section-header"
  });

  if (body) {
    canvas.addText("section-body", body, {
      x: 0.64,
      y: 1.28,
      w: 7.6,
      h: 0.36,
      fontFace: bodyFont,
      fontSize: 11.2,
      color: theme.muted,
      margin: 0
    }, {
      group: "section-header"
    });
  }
}

function addReferenceNote(canvas, theme, text, options = {}) {
  const {
    x = 0.72,
    y = 5.06,
    w = 4.9,
    h = 0.18,
    align = "left",
    group = "reference-note"
  } = options;

  canvas.addText(`${group}-text`, text, {
    x,
    y,
    w,
    h,
    fontFace: bodyFont,
    fontSize: 10,
    color: theme.muted,
    align,
    margin: 0
  }, {
    group,
    skipOverlap: true
  });
}

module.exports = {
  addAccentRule,
  addBulletItem,
  addCompactCard,
  addPageBadge,
  addPanel,
  addReferenceNote,
  addSectionTitle,
  addStatChip,
  liveDemoUrl
};
