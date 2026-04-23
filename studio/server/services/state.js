const fs = require("fs");
const path = require("path");
const { stateDir } = require("./paths");
const {
  defaultDesignConstraints,
  normalizeDesignConstraints
} = require("../../../generator/design-constraints");

const deckContextFile = path.join(stateDir, "deck-context.json");
const variantsFile = path.join(stateDir, "variants.json");

const defaultDeckContext = {
  deck: {
    title: "Presentation Studio",
    audience: "",
    objective: "",
    tone: "",
    constraints: "",
    designConstraints: { ...defaultDesignConstraints },
    themeBrief: "",
    outline: "",
    structureLabel: "",
    structureSummary: "",
    structurePlan: []
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

function normalizeDeckContext(context) {
  const source = context && typeof context === "object" ? context : {};
  const deck = source.deck && typeof source.deck === "object" ? source.deck : {};
  const slides = source.slides && typeof source.slides === "object" ? source.slides : {};

  return {
    ...defaultDeckContext,
    ...source,
    deck: {
      ...defaultDeckContext.deck,
      ...deck,
      designConstraints: normalizeDesignConstraints(deck.designConstraints)
    },
    slides
  };
}

function getDeckContext() {
  ensureState();
  return normalizeDeckContext(readJson(deckContextFile, defaultDeckContext));
}

function saveDeckContext(nextContext) {
  ensureState();
  const normalized = normalizeDeckContext(nextContext);
  writeJson(deckContextFile, normalized);
  return normalized;
}

function updateDeckFields(fields) {
  const current = getDeckContext();
  const next = {
    ...current,
    deck: {
      ...current.deck,
      ...fields,
      designConstraints: fields && fields.designConstraints
        ? normalizeDesignConstraints({
            ...current.deck.designConstraints,
            ...fields.designConstraints
          })
        : current.deck.designConstraints
    }
  };

  return saveDeckContext(next);
}

function applyDeckStructurePlan(candidate) {
  const current = getDeckContext();
  const plan = Array.isArray(candidate && candidate.slides) ? candidate.slides : [];
  const nextSlides = {
    ...current.slides
  };

  plan.forEach((entry) => {
    if (!entry || typeof entry.slideId !== "string" || !entry.slideId) {
      return;
    }

    nextSlides[entry.slideId] = {
      title: "",
      intent: "",
      mustInclude: "",
      notes: "",
      layoutHint: "",
      ...current.slides[entry.slideId],
      structureAction: entry.action || "",
      structureRationale: entry.rationale || "",
      structureRole: entry.role || "",
      structureSummary: entry.summary || "",
      proposedIndex: Number.isFinite(entry.proposedIndex) ? entry.proposedIndex : null,
      proposedTitle: entry.proposedTitle || "",
      title: entry.proposedTitle || current.slides[entry.slideId]?.title || ""
    };
  });

  return saveDeckContext({
    ...current,
    deck: {
      ...current.deck,
      outline: typeof candidate.outline === "string" ? candidate.outline : current.deck.outline,
      structureLabel: candidate && candidate.label ? candidate.label : "",
      structurePlan: plan,
      structureSummary: candidate && candidate.summary ? candidate.summary : ""
    },
    slides: nextSlides
  });
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
  applyDeckStructurePlan,
  getDeckContext,
  getVariants,
  saveDeckContext,
  saveVariants,
  updateDeckFields,
  updateSlideContext,
  variantsFile
};
