const fs = require("fs");
const path = require("path");

const deckContextFile = path.join(__dirname, "..", "state", "deck-context.json");

const theme = {
  primary: "183153",
  secondary: "275d8c",
  accent: "f28f3b",
  fontFamily: "\"Avenir Next\", \"Helvetica Neue\", \"Segoe UI\", sans-serif",
  muted: "56677c",
  light: "d7e6f5",
  bg: "f5f8fc",
  panel: "f8fbfe",
  surface: "ffffff",
  slideCount: 4,
  progressTrack: "d7e6f5",
  progressFill: "275d8c"
};

const deckMeta = {
  title: "slideotter Demo",
  subtitle: "A small runnable deck built around the DOM-first studio",
  author: "OpenAI Codex",
  company: "slideotter",
  subject: "Demonstration presentation"
};
const defaultDeckLanguage = "en-US";

const displayFont = "Avenir Next";
const bodyFont = "Avenir Next";
const fontFace = bodyFont;

function normalizeColor(value, fallback) {
  const raw = String(value || "").trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) {
    return raw;
  }

  return fallback;
}

function normalizeFontFamily(value, fallback = theme.fontFamily) {
  const key = String(value || "").trim().toLowerCase();
  const allowed = {
    avenir: theme.fontFamily,
    editorial: "Georgia, \"Times New Roman\", serif",
    mono: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
    workshop: "\"Trebuchet MS\", Verdana, sans-serif"
  };

  return allowed[key] || Object.values(allowed).find((stack) => stack.toLowerCase() === key) || fallback;
}

function normalizeVisualTheme(input: any = {}) {
  const primary = normalizeColor(input.primary, theme.primary);
  const secondary = normalizeColor(input.secondary, theme.secondary);
  const accent = normalizeColor(input.accent, theme.accent);
  const muted = normalizeColor(input.muted, theme.muted);
  const light = normalizeColor(input.light, theme.light);
  const bg = normalizeColor(input.bg, theme.bg);
  const panel = normalizeColor(input.panel, theme.panel);
  const surface = normalizeColor(input.surface, theme.surface);
  const progressTrack = normalizeColor(input.progressTrack || light, theme.progressTrack);
  const progressFill = normalizeColor(input.progressFill || secondary, theme.progressFill);
  const fontFamily = normalizeFontFamily(input.fontFamily);

  return {
    ...theme,
    accent,
    bg,
    fontFamily,
    light,
    muted,
    panel,
    primary,
    progressFill,
    progressTrack,
    secondary,
    surface
  };
}

function readDeckVisualTheme() {
  try {
    const raw = JSON.parse(fs.readFileSync(deckContextFile, "utf8"));
    return normalizeVisualTheme(raw && raw.deck && raw.deck.visualTheme);
  } catch (error) {
    return { ...theme };
  }
}

function resolveTheme(overrides: any = {}) {
  return normalizeVisualTheme({
    ...readDeckVisualTheme(),
    ...overrides
  });
}

module.exports = {
  bodyFont,
  deckMeta,
  defaultDeckLanguage,
  displayFont,
  fontFace,
  normalizeVisualTheme,
  resolveTheme,
  theme
};
