const { addPageBadge, addSectionTitle } = require("./helpers");
const { fontFace } = require("./theme");

const slideConfig = {
  type: "summary",
  index: 4,
  title: "Next steps"
};

function createChecklistItem(slide, pres, theme, y, title, text) {
  slide.addShape(pres.ShapeType.ellipse, {
    x: 0.72,
    y,
    w: 0.28,
    h: 0.28,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  });

  slide.addText(title, {
    x: 1.08,
    y: y - 0.01,
    w: 2.8,
    h: 0.24,
    fontFace,
    fontSize: 14,
    bold: true,
    color: theme.primary,
    margin: 0
  });

  slide.addText(text, {
    x: 1.08,
    y: y + 0.28,
    w: 3.6,
    h: 0.4,
    fontFace,
    fontSize: 11,
    color: "5e7691",
    margin: 0
  });
}

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  addSectionTitle(
    slide,
    theme,
    "Summary",
    slideConfig.title,
    "The repository now contains a complete starter path: imported skill guidance, a runnable demo deck, and project-level documentation."
  );

  createChecklistItem(slide, pres, theme, 2.15, "Install dependencies", "Run npm install once to pull in pptxgenjs locally.");
  createChecklistItem(slide, pres, theme, 3.05, "Build the deck", "Run npm run build to emit slides/output/demo-presentation.pptx.");
  createChecklistItem(slide, pres, theme, 3.95, "Extend slide modules", "Duplicate the demo pattern for real covers, content pages, and summaries.");

  slide.addShape(pres.ShapeType.roundRect, {
    x: 6.25,
    y: 2.05,
    w: 2.95,
    h: 2.85,
    rectRadius: 0.08,
    line: { color: theme.light, pt: 1.2 },
    fill: { color: "ffffff" }
  });

  slide.addText("Output", {
    x: 6.55,
    y: 2.35,
    w: 1.2,
    h: 0.25,
    fontFace,
    fontSize: 13,
    bold: true,
    color: theme.accent,
    allCaps: true,
    margin: 0
  });

  slide.addText("slides/output/demo-presentation.pptx", {
    x: 6.55,
    y: 2.78,
    w: 2.1,
    h: 0.62,
    fontFace,
    fontSize: 15,
    bold: true,
    color: theme.primary,
    fit: "shrink",
    margin: 0
  });

  slide.addText("The output directory is ignored by git so the generated binary stays local.", {
    x: 6.55,
    y: 3.7,
    w: 2.15,
    h: 0.55,
    fontFace,
    fontSize: 10.5,
    color: "607894",
    margin: 0
  });

  addPageBadge(slide, pres, theme, slideConfig.index);
  return slide;
}

module.exports = { createSlide, slideConfig };
