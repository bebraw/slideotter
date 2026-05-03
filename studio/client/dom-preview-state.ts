import { StudioClientState } from "./state.ts";

export namespace StudioClientDomPreviewState {
  type JsonRecord = StudioClientState.JsonRecord;
  type ThemeNormalizer = (theme: unknown) => unknown;

  export function isJsonRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  export function getCurrentTheme(state: StudioClientState.State, normalizeTheme?: ThemeNormalizer): unknown {
    const theme = state.domPreview && state.domPreview.theme
      ? state.domPreview.theme
      : state.context && state.context.deck && state.context.deck.visualTheme;
    return normalizeTheme ? normalizeTheme(theme || {}) : (theme || {});
  }

  export function getVariantVisualTheme(
    state: StudioClientState.State,
    variant: { visualTheme?: unknown } | null,
    normalizeTheme?: ThemeNormalizer
  ): unknown | null {
    if (!variant || !isJsonRecord(variant.visualTheme)) {
      return null;
    }

    const baseTheme = getCurrentTheme(state, normalizeTheme);
    const theme = {
      ...(isJsonRecord(baseTheme) ? baseTheme : {}),
      ...variant.visualTheme
    };

    return normalizeTheme ? normalizeTheme(theme) : theme;
  }

  export function setFromPayload(state: StudioClientState.State, payload: JsonRecord): void {
    const domPreview = isJsonRecord(payload.domPreview)
      ? payload.domPreview
      : {};
    state.domPreview = {
      slides: Array.isArray(domPreview.slides)
        ? domPreview.slides.filter((slide): slide is StudioClientState.StudioSlide => (
            isJsonRecord(slide)
            && typeof slide.id === "string"
            && typeof slide.index === "number"
          ))
        : [],
      theme: domPreview.theme || (state.context && state.context.deck ? state.context.deck.visualTheme : null)
    };
  }
}
