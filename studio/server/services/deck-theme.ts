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

type VisualThemeInput = Record<string, unknown>;

type RgbColor = {
  b: number;
  g: number;
  r: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeColor(value: unknown, fallback: string): string {
  const raw = String(value || "").trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) {
    return raw;
  }

  return fallback;
}

function hexToRgb(hex: unknown): RgbColor {
  const normalized = normalizeColor(hex, "000000");
  return {
    b: parseInt(normalized.slice(4, 6), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    r: parseInt(normalized.slice(0, 2), 16)
  };
}

function luminanceChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: unknown): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * luminanceChannel(r)) +
    (0.7152 * luminanceChannel(g)) +
    (0.0722 * luminanceChannel(b));
}

function contrastRatio(foreground: unknown, background: unknown): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(color: unknown, background: string, minRatio: number, candidates: string[] = []): string {
  const normalized = normalizeColor(color, theme.primary);
  if (contrastRatio(normalized, background) >= minRatio) {
    return normalized;
  }

  return [...candidates, "101820", "ffffff", "f7fcfb"]
    .map((candidate) => normalizeColor(candidate, theme.primary))
    .sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0] || theme.primary;
}

function normalizeFontFamily(value: unknown, fallback = theme.fontFamily): string {
  const key = String(value || "").trim().toLowerCase();
  const allowed: Record<string, string> = {
    avenir: theme.fontFamily,
    editorial: "Georgia, \"Times New Roman\", serif",
    mono: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
    workshop: "\"Trebuchet MS\", Verdana, sans-serif"
  };

  const customFont = sanitizeFontFamily(value);
  return allowed[key] || Object.values(allowed).find((stack) => stack.toLowerCase() === key) || customFont || fallback;
}

function sanitizeFontFamily(value: unknown): string | null {
  const source = String(value || "").trim();
  if (
    !source
    || source.length > 180
    || /[;{}]/u.test(source)
    || /\b(?:expression|import|url|var)\s*\(/iu.test(source)
  ) {
    return null;
  }

  const allowedGenerics = new Set(["cursive", "fantasy", "monospace", "sans-serif", "serif", "system-ui"]);
  const families = source.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!families.length) {
    return null;
  }

  const sanitized = families.map((family) => {
    const unquoted = family.replace(/^["']|["']$/g, "").trim();
    const normalized = unquoted.toLowerCase();
    if (allowedGenerics.has(normalized)) {
      return normalized;
    }
    if (!/^[a-z0-9][a-z0-9 ._-]{0,48}$/iu.test(unquoted)) {
      return null;
    }
    return /\s/u.test(unquoted) ? `"${unquoted.replace(/"/gu, "")}"` : unquoted;
  });

  return sanitized.every(Boolean) ? sanitized.join(", ") : null;
}

function normalizeVisualTheme(input: unknown = {}) {
  const themeInput = asRecord(input);
  const requestedPrimary = normalizeColor(themeInput.primary, theme.primary);
  const requestedSecondary = normalizeColor(themeInput.secondary, theme.secondary);
  const requestedAccent = normalizeColor(themeInput.accent, theme.accent);
  const requestedMuted = normalizeColor(themeInput.muted, theme.muted);
  const light = normalizeColor(themeInput.light, theme.light);
  const bg = normalizeColor(themeInput.bg, theme.bg);
  const panel = normalizeColor(themeInput.panel, theme.panel);
  const surface = normalizeColor(themeInput.surface, theme.surface);
  const primary = ensureContrast(requestedPrimary, bg, 4.5);
  const secondary = ensureContrast(requestedSecondary, bg, 4.5, [primary]);
  const accent = ensureContrast(requestedAccent, bg, 3, [secondary, primary]);
  const muted = ensureContrast(requestedMuted, bg, 4.5, [primary, secondary]);
  const progressTrack = normalizeColor(themeInput.progressTrack || light, theme.progressTrack);
  const requestedProgressFill = normalizeColor(themeInput.progressFill || secondary, theme.progressFill);
  const progressFill = ensureContrast(requestedProgressFill, progressTrack, 3, [primary, secondary]);
  const fontFamily = normalizeFontFamily(themeInput.fontFamily);

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
  return normalizeVisualTheme(asRecord(asRecord(raw).deck).visualTheme ? asRecord(asRecord(raw).deck).visualTheme : {});
}

function resolveTheme(overrides: VisualThemeInput = {}) {
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
