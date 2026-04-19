const { fontFace } = require("./theme");

function addPageBadge(slide, pres, theme, number) {
  slide.addShape(pres.ShapeType.ellipse, {
    x: 9.28,
    y: 5.03,
    w: 0.42,
    h: 0.42,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  });

  slide.addText(String(number).padStart(2, "0"), {
    x: 9.28,
    y: 5.03,
    w: 0.42,
    h: 0.42,
    fontFace,
    fontSize: 11,
    bold: true,
    color: "FFFFFF",
    align: "center",
    valign: "middle",
    margin: 0
  });
}

function addSectionTitle(slide, theme, eyebrow, title, body) {
  slide.addText(eyebrow, {
    x: 0.6,
    y: 0.45,
    w: 3.2,
    h: 0.3,
    fontFace,
    fontSize: 12,
    bold: true,
    color: theme.accent,
    charSpace: 1.2,
    allCaps: true,
    margin: 0
  });

  slide.addText(title, {
    x: 0.6,
    y: 0.8,
    w: 5.4,
    h: 0.7,
    fontFace,
    fontSize: 28,
    bold: true,
    color: theme.primary,
    margin: 0
  });

  if (body) {
    slide.addText(body, {
      x: 0.6,
      y: 1.55,
      w: 4.9,
      h: 0.6,
      fontFace,
      fontSize: 13,
      color: "47627f",
      breakLine: false,
      margin: 0
    });
  }
}

module.exports = {
  addPageBadge,
  addSectionTitle
};
