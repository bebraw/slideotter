const fs = require("fs");
const path = require("path");
const { stateDir } = require("./paths");

const deckContextFile = path.join(stateDir, "deck-context.json");
const variantsFile = path.join(stateDir, "variants.json");

const defaultDeckContext = {
  deck: {
    title: "Presentation Studio",
    audience: "",
    objective: "",
    tone: "",
    constraints: "",
    themeBrief: "",
    outline: ""
  },
  slides: {}
};

const defaultVariants = {
  variants: []
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  ensureDir(path.dirname(fileName));
  fs.writeFileSync(fileName, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureState() {
  ensureDir(stateDir);

  if (!fs.existsSync(deckContextFile)) {
    writeJson(deckContextFile, defaultDeckContext);
  }

  if (!fs.existsSync(variantsFile)) {
    writeJson(variantsFile, defaultVariants);
  }
}

function getDeckContext() {
  ensureState();
  return readJson(deckContextFile, defaultDeckContext);
}

function saveDeckContext(nextContext) {
  ensureState();
  writeJson(deckContextFile, nextContext);
  return nextContext;
}

function updateDeckFields(fields) {
  const current = getDeckContext();
  const next = {
    ...current,
    deck: {
      ...current.deck,
      ...fields
    }
  };

  return saveDeckContext(next);
}

function updateSlideContext(slideId, fields) {
  const current = getDeckContext();
  const next = {
    ...current,
    slides: {
      ...current.slides,
      [slideId]: {
        title: "",
        intent: "",
        mustInclude: "",
        notes: "",
        layoutHint: "",
        ...current.slides[slideId],
        ...fields
      }
    }
  };

  return saveDeckContext(next);
}

function getVariants() {
  ensureState();
  return readJson(variantsFile, defaultVariants);
}

function saveVariants(nextVariants) {
  ensureState();
  writeJson(variantsFile, nextVariants);
  return nextVariants;
}

module.exports = {
  deckContextFile,
  ensureState,
  getDeckContext,
  getVariants,
  saveDeckContext,
  saveVariants,
  updateDeckFields,
  updateSlideContext,
  variantsFile
};
