const fs = require("fs");
const path = require("path");
const { stateDir } = require("./paths");
const {
  defaultDesignConstraints,
  normalizeDesignConstraints
} = require("./design-constraints");
const {
  defaultValidationSettings,
  normalizeValidationSettings
} = require("./validation-settings");
const {
  deckMeta,
  defaultDeckLanguage,
  normalizeVisualTheme,
  theme: defaultVisualTheme
} = require("./deck-theme");
const {
  ensureAllowedDir,
  writeAllowedJson
} = require("./write-boundary");

const deckContextFile = path.join(stateDir, "deck-context.json");
const variantsFile = path.join(stateDir, "variants.json");

const defaultDeckContext = {
  deck: {
    author: deckMeta.author,
    company: deckMeta.company,
    subject: deckMeta.subject,
    title: "slideotter",
    lang: defaultDeckLanguage,
    audience: "",
    objective: "",
    tone: "",
    constraints: "",
    designConstraints: { ...defaultDesignConstraints },
    validationSettings: { ...defaultValidationSettings, rules: { ...defaultValidationSettings.rules } },
    visualTheme: { ...defaultVisualTheme },
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

function pickEditableVisualTheme(theme = {}) {
  return {
    accent: theme.accent,
    bg: theme.bg,
    fontFamily: theme.fontFamily,
    light: theme.light,
    muted: theme.muted,
    panel: theme.panel,
    primary: theme.primary,
    progressFill: theme.progressFill,
    progressTrack: theme.progressTrack,
    secondary: theme.secondary,
    surface: theme.surface
  };
}

function ensureDir(dir) {
  ensureAllowedDir(dir);
}

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  writeAllowedJson(fileName, value);
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
      designConstraints: normalizeDesignConstraints(deck.designConstraints),
      validationSettings: normalizeValidationSettings(deck.validationSettings),
      visualTheme: normalizeVisualTheme(pickEditableVisualTheme(deck.visualTheme))
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
        : current.deck.designConstraints,
      validationSettings: fields && fields.validationSettings
        ? normalizeValidationSettings({
            ...current.deck.validationSettings,
            ...fields.validationSettings,
            rules: {
              ...(current.deck.validationSettings && current.deck.validationSettings.rules ? current.deck.validationSettings.rules : {}),
              ...(fields.validationSettings.rules || {})
            }
          })
        : current.deck.validationSettings,
      visualTheme: fields && fields.visualTheme
        ? normalizeVisualTheme({
            ...pickEditableVisualTheme(current.deck.visualTheme),
            ...fields.visualTheme
          })
        : current.deck.visualTheme
    }
  };

  return saveDeckContext(next);
}

function applyDeckStructurePlan(candidate) {
  const current = getDeckContext();
  const plan = Array.isArray(candidate && candidate.slides) ? candidate.slides : [];
  const deckPatch = candidate && candidate.deckPatch && typeof candidate.deckPatch === "object"
    ? candidate.deckPatch
    : {};
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
      ...deckPatch,
      outline: typeof candidate.outline === "string" ? candidate.outline : current.deck.outline,
      structureLabel: candidate && candidate.label ? candidate.label : "",
      structurePlan: plan,
      structureSummary: candidate && candidate.summary ? candidate.summary : "",
      designConstraints: deckPatch.designConstraints
        ? normalizeDesignConstraints({
            ...current.deck.designConstraints,
            ...deckPatch.designConstraints
          })
        : current.deck.designConstraints,
      validationSettings: deckPatch.validationSettings
        ? normalizeValidationSettings({
            ...current.deck.validationSettings,
            ...deckPatch.validationSettings,
            rules: {
              ...(current.deck.validationSettings && current.deck.validationSettings.rules ? current.deck.validationSettings.rules : {}),
              ...(deckPatch.validationSettings.rules || {})
            }
          })
        : current.deck.validationSettings,
      visualTheme: deckPatch.visualTheme
        ? normalizeVisualTheme({
            ...pickEditableVisualTheme(current.deck.visualTheme),
            ...deckPatch.visualTheme
          })
        : current.deck.visualTheme
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
