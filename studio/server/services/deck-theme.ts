const { readActiveDeckContext } = require("./active-deck-context.ts");

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

function hexToRgb(hex) {
  const normalized = normalizeColor(hex, "000000");
  return {
    b: parseInt(normalized.slice(4, 6), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    r: parseInt(normalized.slice(0, 2), 16)
  };
}

function luminanceChannel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * luminanceChannel(r)) +
    (0.7152 * luminanceChannel(g)) +
    (0.0722 * luminanceChannel(b));
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(color, background, minRatio, candidates = []) {
  const normalized = normalizeColor(color, theme.primary);
  if (contrastRatio(normalized, background) >= minRatio) {
    return normalized;
  }

  return [...candidates, "101820", "ffffff", "f7fcfb"]
    .map((candidate) => normalizeColor(candidate, theme.primary))
    .sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0];
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
  const requestedPrimary = normalizeColor(input.primary, theme.primary);
  const requestedSecondary = normalizeColor(input.secondary, theme.secondary);
  const requestedAccent = normalizeColor(input.accent, theme.accent);
  const requestedMuted = normalizeColor(input.muted, theme.muted);
  const light = normalizeColor(input.light, theme.light);
  const bg = normalizeColor(input.bg, theme.bg);
  const panel = normalizeColor(input.panel, theme.panel);
  const surface = normalizeColor(input.surface, theme.surface);
  const primary = ensureContrast(requestedPrimary, bg, 4.5);
  const secondary = ensureContrast(requestedSecondary, bg, 4.5, [primary]);
  const accent = ensureContrast(requestedAccent, bg, 3, [secondary, primary]);
  const muted = ensureContrast(requestedMuted, bg, 4.5, [primary, secondary]);
  const progressTrack = normalizeColor(input.progressTrack || light, theme.progressTrack);
  const requestedProgressFill = normalizeColor(input.progressFill || secondary, theme.progressFill);
  const progressFill = ensureContrast(requestedProgressFill, progressTrack, 3, [primary, secondary]);
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
  const raw = readActiveDeckContext(null);
  return normalizeVisualTheme(raw && raw.deck && raw.deck.visualTheme);
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
