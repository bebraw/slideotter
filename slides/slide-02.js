const { addPageBadge, addSectionTitle } = require("./helpers");
const { fontFace } = require("./theme");

const slideConfig = {
  type: "toc",
  index: 2,
  title: "Demo outline"
};

function createAgendaCard(slide, pres, theme, x, title, text, index) {
  slide.addShape(pres.ShapeType.roundRect, {
    x,
    y: 2.1,
    w: 2.65,
    h: 2.15,
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
  });

  slide.addShape(pres.ShapeType.ellipse, {
    x: x + 0.22,
    y: 2.32,
    w: 0.44,
    h: 0.44,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  });

  slide.addText(String(index).padStart(2, "0"), {
    x: x + 0.22,
    y: 2.32,
    w: 0.44,
    h: 0.44,
    fontFace,
    fontSize: 11,
    bold: true,
    color: "FFFFFF",
    align: "center",
    valign: "middle",
    margin: 0
  });

  slide.addText(title, {
    x: x + 0.22,
    y: 2.95,
    w: 2.05,
    h: 0.38,
    fontFace,
    fontSize: 16,
    bold: true,
    color: theme.primary,
    margin: 0
  });

  slide.addText(text, {
    x: x + 0.22,
    y: 3.42,
    w: 2.08,
    h: 0.55,
    fontFace,
    fontSize: 11.5,
    color: "5f7690",
    margin: 0
  });
}

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  addSectionTitle(
    slide,
    theme,
    "Contents",
    slideConfig.title,
    "This sample keeps the structure close to the imported skill: a cover slide, a plan slide, one data slide, and a closing summary."
  );

  createAgendaCard(slide, pres, theme, 0.6, "Structure", "Each slide lives in its own module and exports createSlide(pres, theme).", 1);
  createAgendaCard(slide, pres, theme, 3.35, "Theme", "Shared colors and typography come from slides/theme.js.", 2);
  createAgendaCard(slide, pres, theme, 6.1, "Output", "A compile script assembles the modules into one PPTX file.", 3);

  addPageBadge(slide, pres, theme, slideConfig.index);
  return slide;
}

module.exports = { createSlide, slideConfig };
