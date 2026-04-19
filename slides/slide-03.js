const { addPageBadge, addSectionTitle } = require("./helpers");
const { fontFace } = require("./theme");

const slideConfig = {
  type: "content",
  index: 3,
  title: "Why this setup works"
};

function addMetric(slide, theme, x, y, value, label) {
  slide.addText(value, {
    x,
    y,
    w: 1.2,
    h: 0.4,
    fontFace,
    fontSize: 20,
    bold: true,
    color: theme.primary,
    margin: 0
  });

  slide.addText(label, {
    x,
    y: y + 0.42,
    w: 1.6,
    h: 0.3,
    fontFace,
    fontSize: 10.5,
    color: "5d7591",
    margin: 0
  });
}

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: "ffffff" };

  addSectionTitle(
    slide,
    theme,
    "Signals",
    slideConfig.title,
    "The demo emphasizes repeatability over decoration: local dependencies, explicit slide modules, and a compile command that can be wired into CI."
  );

  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.6,
    y: 2.15,
    w: 4.65,
    h: 2.65,
    rectRadius: 0.08,
    line: { color: "dbe7f1", pt: 1 },
    fill: { color: "f8fbfe" }
  });

  slide.addChart(pres.ChartType.bar, [
    {
      name: "Deck setup",
      labels: ["Skill import", "Theme", "Slides", "Docs"],
      values: [75, 82, 94, 88]
    }
  ], {
    x: 0.88,
    y: 2.48,
    w: 3.95,
    h: 1.8,
    catAxisLabelFontFace: fontFace,
    catAxisLabelFontSize: 10,
    valAxisLabelFontFace: fontFace,
    valAxisLabelFontSize: 9,
    valAxisMinVal: 0,
    valAxisMaxVal: 100,
    valGridLine: { color: "d7e6f5", pt: 1 },
    chartColors: [theme.secondary],
    showLegend: false,
    showTitle: false,
    showValue: true,
    dataLabelColor: theme.primary,
    dataLabelPosition: "outEnd",
    showCatName: false,
    showValAxisTitle: false,
    showCatAxisTitle: false
  });

  slide.addShape(pres.ShapeType.roundRect, {
    x: 5.65,
    y: 2.15,
    w: 3.75,
    h: 2.65,
    rectRadius: 0.08,
    line: { color: theme.primary, transparency: 100 },
    fill: { color: theme.primary }
  });

  slide.addText("Key properties", {
    x: 5.95,
    y: 2.45,
    w: 2,
    h: 0.3,
    fontFace,
    fontSize: 15,
    bold: true,
    color: "FFFFFF",
    margin: 0
  });

  addMetric(slide, theme, 5.95, 3.08, "4", "Slide modules");
  addMetric(slide, theme, 7.4, 3.08, "1", "Compile script");
  addMetric(slide, theme, 5.95, 4.02, "5", "Theme keys");
  addMetric(slide, theme, 7.4, 4.02, "1", "README guide");

  addPageBadge(slide, pres, theme, slideConfig.index);
  return slide;
}

module.exports = { createSlide, slideConfig };
