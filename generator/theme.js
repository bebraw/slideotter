const fs = require("fs");
const path = require("path");

const deckContextFile = path.join(__dirname, "..", "studio", "state", "deck-context.json");

const theme = {
  primary: "183153",
  secondary: "275d8c",
  accent: "f28f3b",
  muted: "56677c",
  light: "d7e6f5",
  bg: "f5f8fc",
  panel: "f8fbfe",
  slideCount: 4,
  progressTrack: "d7e6f5",
  progressFill: "275d8c"
};

const deckMeta = {
  title: "Presentation Template Demo",
  subtitle: "A small runnable deck built around the pdf-slide-generator skill",
  author: "OpenAI Codex",
  company: "presentation-template",
  subject: "Demonstration presentation"
};

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

function normalizeVisualTheme(input = {}) {
  const primary = normalizeColor(input.primary, theme.primary);
  const secondary = normalizeColor(input.secondary, theme.secondary);
  const accent = normalizeColor(input.accent, theme.accent);
  const muted = normalizeColor(input.muted, theme.muted);
  const light = normalizeColor(input.light, theme.light);
  const bg = normalizeColor(input.bg, theme.bg);
  const panel = normalizeColor(input.panel, theme.panel);
  const progressTrack = normalizeColor(input.progressTrack || light, theme.progressTrack);
  const progressFill = normalizeColor(input.progressFill || secondary, theme.progressFill);

  return {
    ...theme,
    accent,
    bg,
    light,
    muted,
    panel,
    primary,
    progressFill,
    progressTrack,
    secondary
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

function resolveTheme(overrides = {}) {
  return normalizeVisualTheme({
    ...readDeckVisualTheme(),
    ...overrides
  });
}

module.exports = {
  bodyFont,
  deckMeta,
  displayFont,
  fontFace,
  normalizeVisualTheme,
  resolveTheme,
  theme
};
