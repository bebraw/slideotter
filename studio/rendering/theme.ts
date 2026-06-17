import { asRecord } from "./json.ts";
import {
  defaultThemeTokens,
  ensureContrast,
  normalizeColor,
  normalizeFontFamily,
  type ThemeTokens
} from "../shared/theme-normalization.ts";

export type Theme = ThemeTokens;

const baseTheme: Theme = defaultThemeTokens;

function withHash(color: unknown): string {
  return `#${String(color || "").replace(/^#/, "")}`;
}

export function normalizeTheme(input: unknown): Theme {
  const source = asRecord(input);
  const bg = normalizeColor(source.bg, baseTheme.bg);
  const requestedPrimary = normalizeColor(source.primary, baseTheme.primary);
  const requestedSecondary = normalizeColor(source.secondary, baseTheme.secondary);
  const requestedAccent = normalizeColor(source.accent, baseTheme.accent);
  const requestedMuted = normalizeColor(source.muted, baseTheme.muted);
  const primary = ensureContrast(requestedPrimary, bg, 4.5);
  const secondary = ensureContrast(requestedSecondary, bg, 4.5, [primary]);
  const accent = ensureContrast(requestedAccent, bg, 3, [secondary, primary]);
  const muted = ensureContrast(requestedMuted, bg, 4.5, [primary, secondary]);
  const progressTrack = normalizeColor(source.progressTrack || source.light, baseTheme.progressTrack);
  const progressFill = ensureContrast(
    normalizeColor(source.progressFill || secondary, baseTheme.progressFill),
    progressTrack,
    3,
    [primary, secondary]
  );

  return {
    accent,
    bg,
    fontFamily: normalizeFontFamily(source.fontFamily),
    light: normalizeColor(source.light, baseTheme.light),
    muted,
    panel: normalizeColor(source.panel, baseTheme.panel),
    primary,
    progressFill,
    progressTrack,
    secondary,
    surface: normalizeColor(source.surface, baseTheme.surface)
  };
}

export function renderThemeVars(theme: Theme): string {
  const onPanel = ensureContrast(theme.primary, theme.panel, 4.5);
  const onPanelMuted = ensureContrast(theme.muted, theme.panel, 4.5, [onPanel]);
  const onSurface = ensureContrast(theme.primary, theme.surface, 4.5);
  const onSurfaceMuted = ensureContrast(theme.muted, theme.surface, 4.5, [onSurface]);

  return [
    `--dom-accent:${withHash(theme.accent)}`,
    `--dom-bg:${withHash(theme.bg)}`,
    `--dom-font-family:${theme.fontFamily}`,
    `--dom-light:${withHash(theme.light)}`,
    `--dom-muted:${withHash(theme.muted)}`,
    `--dom-on-panel:${withHash(onPanel)}`,
    `--dom-on-panel-muted:${withHash(onPanelMuted)}`,
    `--dom-on-surface:${withHash(onSurface)}`,
    `--dom-on-surface-muted:${withHash(onSurfaceMuted)}`,
    `--dom-panel:${withHash(theme.panel)}`,
    `--dom-primary:${withHash(theme.primary)}`,
    `--dom-progress-fill:${withHash(theme.progressFill)}`,
    `--dom-progress-track:${withHash(theme.progressTrack)}`,
    `--dom-secondary:${withHash(theme.secondary)}`,
    `--dom-surface:${withHash(theme.surface)}`
  ].join(";");
}
