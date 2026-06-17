import type { StudioClientState } from "../core/state.ts";
import { isJsonRecord } from "./dom-preview-record.ts";

type ThemeNormalizer = (theme: unknown) => unknown;
type DomRenderer = {
  normalizeTheme?: (theme: unknown) => unknown;
};
type SlideDomWindow = Window & {
  SlideDomRenderer?: DomRenderer;
};

function fallbackTheme(state: StudioClientState.State): unknown {
  return state.context && state.context.deck ? state.context.deck.visualTheme : {};
}

function domPreviewTheme(state: StudioClientState.State): unknown {
  return state.domPreview && state.domPreview.theme ? state.domPreview.theme : fallbackTheme(state);
}

function normalizeThemeValue(theme: unknown, normalizeTheme?: ThemeNormalizer): unknown {
  return normalizeTheme ? normalizeTheme(theme || {}) : theme || {};
}

export function getCurrentTheme(state: StudioClientState.State, normalizeTheme?: ThemeNormalizer): unknown {
  return normalizeThemeValue(domPreviewTheme(state), normalizeTheme);
}

function variantThemeRecord(variant: { visualTheme?: unknown } | null): StudioClientState.JsonRecord | null {
  const variantTheme = variant ? variant.visualTheme : null;
  return isJsonRecord(variantTheme) ? variantTheme : null;
}

export function getVariantVisualTheme(
  state: StudioClientState.State,
  variant: { visualTheme?: unknown } | null,
  normalizeTheme?: ThemeNormalizer
): unknown | null {
  const variantTheme = variantThemeRecord(variant);
  if (variantTheme === null) {
    return null;
  }

  const baseTheme = getCurrentTheme(state, normalizeTheme);
  const theme = {
    ...(isJsonRecord(baseTheme) ? baseTheme : {}),
    ...variantTheme
  };

  return normalizeTheme ? normalizeTheme(theme) : theme;
}

export function getRenderer(windowRef: Window): DomRenderer | null {
  return (windowRef as SlideDomWindow).SlideDomRenderer || null;
}

export function getThemeNormalizer(renderer: DomRenderer | null): ThemeNormalizer | undefined {
  if (!renderer || typeof renderer.normalizeTheme !== "function") {
    return undefined;
  }

  return (theme: unknown) => renderer.normalizeTheme ? renderer.normalizeTheme(theme) : theme;
}

export function getWindowCurrentTheme(state: StudioClientState.State, windowRef: Window): unknown {
  return getCurrentTheme(state, getThemeNormalizer(getRenderer(windowRef)));
}

export function getWindowVariantVisualTheme(
  state: StudioClientState.State,
  windowRef: Window,
  variant: { visualTheme?: unknown } | null
): unknown | null {
  return getVariantVisualTheme(state, variant, getThemeNormalizer(getRenderer(windowRef)));
}
