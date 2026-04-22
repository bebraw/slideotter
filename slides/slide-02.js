const { addPageBadge, addSectionTitle } = require("../generator/helpers");
const { fontFace } = require("../generator/theme");
const { createSlideCanvas } = require("../generator/validation");

const slideConfig = {
  type: "toc",
  index: 2,
  title: "Demo outline"
};

function createAgendaCard(canvas, pres, theme, x, title, text, index, group) {
  canvas.addShape(`${group}-card`, pres.ShapeType.roundRect, {
    x,
    y: 2.05,
    w: 2.65,
    h: 1.86,
    rectRadius: 0.08,
    line: { color: theme.light, pt: 1.2 },
    fill: { color: "FFFFFF" },
    shadow: {
      type: "outer",
      color: "9bb4cb",
      blur: 1,
      angle: 45,
      distance: 1,
      opacity: 0.12
    }
  }, {
    group
  });

  canvas.addShape(`${group}-badge`, pres.ShapeType.ellipse, {
    x: x + 0.22,
    y: 2.22,
    w: 0.44,
    h: 0.44,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  }, {
    group
  });

  canvas.addText(`${group}-index`, String(index).padStart(2, "0"), {
    x: x + 0.22,
    y: 2.22,
    w: 0.44,
    h: 0.44,
    fontFace,
    fontSize: 11,
    bold: true,
    color: theme.primary,
    align: "center",
    valign: "middle",
    margin: 0
  }, {
    group
  });

  canvas.addText(`${group}-title`, title, {
    x: x + 0.22,
    y: 2.82,
    w: 2.05,
    h: 0.28,
    fontFace,
    fontSize: 14,
    bold: true,
    color: theme.primary,
    margin: 0
  }, {
    group
  });

  canvas.addText(`${group}-body`, text, {
    x: x + 0.22,
    y: 3.2,
    w: 2.08,
    h: 0.62,
    fontFace,
    fontSize: 10.5,
    color: "5f7690",
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
    "Contents",
    slideConfig.title,
    "Content stays in slides/. Build and validation stay in generator/."
  );

  createAgendaCard(canvas, pres, theme, 0.6, "Structure", "Each slide exports createSlide.", 1, "agenda-structure");
  createAgendaCard(canvas, pres, theme, 3.35, "Theme", "One shared theme drives rendering and validation.", 2, "agenda-theme");
  createAgendaCard(canvas, pres, theme, 6.1, "Output", "Build writes the PDF to slides/output/.", 3, "agenda-output");

  addPageBadge(canvas, pres, theme, slideConfig.index);
  return canvas.finalize();
}

module.exports = { createSlide, slideConfig };
