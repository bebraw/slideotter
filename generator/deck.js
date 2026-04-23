const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { createSlideFromSpec } = require("../slides/render-slide-spec");
const { bodyFont, deckMeta, displayFont, theme } = require("./theme");

const slidesDir = path.join(__dirname, "..", "slides");
const deckContextFile = path.join(__dirname, "..", "studio", "state", "deck-context.json");

function compareNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function readSlideSpec(fileName) {
  return JSON.parse(fs.readFileSync(fileName, "utf8"));
}

function readDeckContext() {
  try {
    return JSON.parse(fs.readFileSync(deckContextFile, "utf8"));
  } catch (error) {
    return null;
  }
}

function getJsonSlideSpecs() {
  return fs.readdirSync(slidesDir)
    .filter((fileName) => /^slide-\d+\.json$/.test(fileName))
    .map((fileName) => ({
      fileName,
      slideSpec: readSlideSpec(path.join(slidesDir, fileName))
    }))
    .filter((entry) => entry.slideSpec && entry.slideSpec.archived !== true)
    .sort((left, right) => {
      const leftIndex = Number(left.slideSpec && left.slideSpec.index);
      const rightIndex = Number(right.slideSpec && right.slideSpec.index);
      const normalizedLeft = Number.isFinite(leftIndex) ? leftIndex : Number.MAX_SAFE_INTEGER;
      const normalizedRight = Number.isFinite(rightIndex) ? rightIndex : Number.MAX_SAFE_INTEGER;

      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }

      return compareNames(left.fileName, right.fileName);
    })
    .map((entry) => entry.slideSpec);
}

function resolveDeckMeta() {
  const context = readDeckContext();
  const deck = context && context.deck && typeof context.deck === "object" ? context.deck : {};
  const title = typeof deck.title === "string" ? deck.title.trim() : "";
  const objective = typeof deck.objective === "string" ? deck.objective.trim() : "";

  return {
    ...deckMeta,
    subject: objective || deckMeta.subject,
    title: title || deckMeta.title
  };
}

function populatePresentation(pres, theme, options = {}) {
  const slideSpecs = Array.isArray(options.slideSpecs) ? options.slideSpecs : getJsonSlideSpecs();
  const resolvedTheme = {
    ...theme,
    slideCount: slideSpecs.length || theme.slideCount
  };
  const reports = [];

  for (const slideSpec of slideSpecs) {
    const result = createSlideFromSpec(pres, resolvedTheme, slideSpec, {
      ...options,
      totalSlides: resolvedTheme.slideCount
    });
    if (result && result.report) {
      reports.push(result.report);
    }
    if (result && Array.isArray(result.reports)) {
      reports.push(...result.reports);
    }
  }

  return { pres, reports };
}

function createPresentation(options = {}) {
  const slideSpecs = Array.isArray(options.slideSpecs) ? options.slideSpecs : getJsonSlideSpecs();
  const resolvedDeckMeta = resolveDeckMeta();
  const resolvedTheme = {
    ...theme,
    slideCount: slideSpecs.length || theme.slideCount
  };
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author = resolvedDeckMeta.author;
  pres.company = resolvedDeckMeta.company;
  pres.subject = resolvedDeckMeta.subject;
  pres.title = resolvedDeckMeta.title;
  pres.lang = "en-US";
  pres.theme = {
    headFontFace: displayFont,
    bodyFontFace: bodyFont,
    lang: "en-US"
  };

  return populatePresentation(pres, resolvedTheme, {
    ...options,
    slideSpecs,
    totalSlides: resolvedTheme.slideCount
  });
}

module.exports = {
  createPresentation,
  populatePresentation,
  resolveDeckMeta
};
