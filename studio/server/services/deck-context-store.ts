import * as fs from "fs";
import { getActivePresentationPaths } from "./active-presentation.ts";
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
import { readJson, writeJson } from "./json-io.ts";
import { ensureAllowedDir } from "./ensure-allowed-dir.ts";

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

function ensureDeckContextState() {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);

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
  ensureDeckContextState();
  return normalizeDeckContext(readJson(getActivePresentationPaths().deckContextFile, defaultDeckContext));
}

export {
  getDeckContext,
  type DeckContext,
  type DeckFields
};
