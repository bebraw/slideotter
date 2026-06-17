import { readActiveDeckContext } from "./active-deck-context.ts";
import {
  defaultThemeTokens,
  ensureContrast,
  normalizeColor,
  normalizeFontFamily
} from "../../shared/theme-normalization.ts";

const theme = {
  ...defaultThemeTokens,
  slideCount: 4,
};

const deckMeta = {
  title: "slideotter Demo",
  subtitle: "A small runnable deck built around the DOM-first studio",
  author: "OpenAI Codex",
  company: "slideotter",
  subject: "Demonstration presentation"
};
const defaultDeckLanguage = "en-US";

type VisualThemeInput = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  const primary = ensureContrast(requestedPrimary, bg, 4.5, [], theme.primary);
  const secondary = ensureContrast(requestedSecondary, bg, 4.5, [primary], theme.primary);
  const accent = ensureContrast(requestedAccent, bg, 3, [secondary, primary], theme.primary);
  const muted = ensureContrast(requestedMuted, bg, 4.5, [primary, secondary], theme.primary);
  const progressTrack = normalizeColor(themeInput.progressTrack || light, theme.progressTrack);
  const requestedProgressFill = normalizeColor(themeInput.progressFill || secondary, theme.progressFill);
  const progressFill = ensureContrast(requestedProgressFill, progressTrack, 3, [primary, secondary], theme.primary);
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

export {
  deckMeta,
  defaultDeckLanguage,
  normalizeVisualTheme,
  resolveTheme,
  theme
};
