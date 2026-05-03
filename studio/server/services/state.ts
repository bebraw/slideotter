import * as fs from "fs";
import { getActivePresentationPaths } from "./presentations.ts";
import {
  defaultDesignConstraints,
  normalizeDesignConstraints
} from "./design-constraints.ts";
import {
  defaultValidationSettings,
  normalizeValidationSettings
} from "./validation-settings.ts";
import {
  deckMeta,
  defaultDeckLanguage,
  normalizeVisualTheme,
  theme as defaultVisualTheme
} from "./deck-theme.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";

type JsonRecord = Record<string, unknown>;

type DeckFields = JsonRecord & {
  designConstraints?: unknown;
  validationSettings?: unknown;
  visualTheme?: unknown;
};

type DeckContext = {
  deck: DeckFields;
  slides: Record<string, JsonRecord>;
};

type VariantsStore = {
  variants: unknown[];
};

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

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function pickEditableVisualTheme(theme: unknown = {}) {
  const fields = asRecord(theme);
  return {
    accent: fields.accent,
    bg: fields.bg,
    fontFamily: fields.fontFamily,
    light: fields.light,
    muted: fields.muted,
    panel: fields.panel,
    primary: fields.primary,
    progressFill: fields.progressFill,
    progressTrack: fields.progressTrack,
    secondary: fields.secondary,
    surface: fields.surface
  };
}

function readRules(settings: unknown): JsonRecord {
  return asRecord(asRecord(settings).rules);
}

function ensureDir(dir: string) {
  ensureAllowedDir(dir);
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown) {
  writeAllowedJson(fileName, value);
}

function ensureState() {
  const paths = getActivePresentationPaths();
  ensureDir(paths.stateDir);

  if (!fs.existsSync(paths.deckContextFile)) {
    writeJson(paths.deckContextFile, defaultDeckContext);
  }

  if (!fs.existsSync(paths.variantsFile)) {
    writeJson(paths.variantsFile, defaultVariants);
  }
}

function normalizeDeckContext(context: unknown): DeckContext {
  const source = asRecord(context);
  const deck = asRecord(source.deck);
  const slides = asRecord(source.slides);
  const normalizedSlides = Object.fromEntries(
    Object.entries(slides).map(([slideId, slideContext]) => [slideId, asRecord(slideContext)])
  );

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
    slides: normalizedSlides
  };
}

function getDeckContext(): DeckContext {
  ensureState();
  return normalizeDeckContext(readJson(getActivePresentationPaths().deckContextFile, defaultDeckContext));
}

function saveDeckContext(nextContext: unknown): DeckContext {
  ensureState();
  const normalized = normalizeDeckContext(nextContext);
  writeJson(getActivePresentationPaths().deckContextFile, normalized);
  return normalized;
}

function updateDeckFields(fields: DeckFields) {
  const current = getDeckContext();
  const validationSettings = asRecord(fields.validationSettings);
  const next = {
    ...current,
    deck: {
      ...current.deck,
      ...fields,
      designConstraints: fields && fields.designConstraints
        ? normalizeDesignConstraints({
            ...asRecord(current.deck.designConstraints),
            ...asRecord(fields.designConstraints)
          })
        : current.deck.designConstraints,
      validationSettings: fields && fields.validationSettings
        ? normalizeValidationSettings({
            ...asRecord(current.deck.validationSettings),
            ...validationSettings,
            rules: {
              ...readRules(current.deck.validationSettings),
              ...readRules(validationSettings)
            }
          })
        : current.deck.validationSettings,
      visualTheme: fields && fields.visualTheme
        ? normalizeVisualTheme({
            ...pickEditableVisualTheme(current.deck.visualTheme),
            ...asRecord(fields.visualTheme)
          })
        : current.deck.visualTheme
    }
  };

  return saveDeckContext(next);
}

function applyDeckStructurePlan(candidate: unknown) {
  const current = getDeckContext();
  const candidateRecord = asRecord(candidate);
  const plan = Array.isArray(candidateRecord.slides) ? candidateRecord.slides : [];
  const deckPatch = asRecord(candidateRecord.deckPatch);
  const nextSlides = {
    ...current.slides
  };

  plan.forEach((rawEntry) => {
    const entry = asRecord(rawEntry);
    const slideId = typeof entry.slideId === "string" ? entry.slideId : "";
    if (!slideId) {
      return;
    }
    const currentSlide = asRecord(current.slides[slideId]);
    const proposedTitle = typeof entry.proposedTitle === "string" ? entry.proposedTitle : "";

    nextSlides[slideId] = {
      intent: "",
      mustInclude: "",
      notes: "",
      layoutHint: "",
      ...currentSlide,
      structureAction: typeof entry.action === "string" ? entry.action : "",
      structureRationale: typeof entry.rationale === "string" ? entry.rationale : "",
      structureRole: typeof entry.role === "string" ? entry.role : "",
      structureSummary: typeof entry.summary === "string" ? entry.summary : "",
      proposedIndex: Number.isFinite(entry.proposedIndex) ? entry.proposedIndex : null,
      proposedTitle,
      title: proposedTitle || (typeof currentSlide.title === "string" ? currentSlide.title : "")
    };
  });
  const label = typeof candidateRecord.label === "string" ? candidateRecord.label : "";
  const summary = typeof candidateRecord.summary === "string" ? candidateRecord.summary : "";
  const outline = typeof candidateRecord.outline === "string" ? candidateRecord.outline : current.deck.outline;
  const deckPatchValidationSettings = asRecord(deckPatch.validationSettings);

  return saveDeckContext({
    ...current,
    deck: {
      ...current.deck,
      ...deckPatch,
      outline,
      structureLabel: label,
      structurePlan: plan,
      structureSummary: summary,
      designConstraints: deckPatch.designConstraints
        ? normalizeDesignConstraints({
            ...asRecord(current.deck.designConstraints),
            ...asRecord(deckPatch.designConstraints)
          })
        : current.deck.designConstraints,
      validationSettings: deckPatch.validationSettings
        ? normalizeValidationSettings({
            ...asRecord(current.deck.validationSettings),
            ...deckPatchValidationSettings,
            rules: {
              ...readRules(current.deck.validationSettings),
              ...readRules(deckPatchValidationSettings)
            }
          })
        : current.deck.validationSettings,
      visualTheme: deckPatch.visualTheme
        ? normalizeVisualTheme({
            ...pickEditableVisualTheme(current.deck.visualTheme),
            ...asRecord(deckPatch.visualTheme)
          })
        : current.deck.visualTheme
    },
    slides: nextSlides
  });
}

function updateSlideContext(slideId: string, fields: JsonRecord) {
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
        ...asRecord(current.slides[slideId]),
        ...fields
      }
    }
  };

  return saveDeckContext(next);
}

function getVariants(): VariantsStore {
  ensureState();
  return readJson(getActivePresentationPaths().variantsFile, defaultVariants);
}

function saveVariants(nextVariants: VariantsStore): VariantsStore {
  ensureState();
  writeJson(getActivePresentationPaths().variantsFile, nextVariants);
  return nextVariants;
}

export {
  ensureState,
  applyDeckStructurePlan,
  getDeckContext,
  getVariants,
  saveDeckContext,
  saveVariants,
  updateDeckFields,
  updateSlideContext
};