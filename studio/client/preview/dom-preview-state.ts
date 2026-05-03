import { StudioClientState } from "../core/state.ts";

export namespace StudioClientDomPreviewState {
  type JsonRecord = StudioClientState.JsonRecord;
  type ThemeNormalizer = (theme: unknown) => unknown;
  type DomRenderer = {
    normalizeTheme?: (theme: unknown) => unknown;
  };
  type SlideDomWindow = Window & {
    SlideDomRenderer?: DomRenderer;
  };

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

  export function getRenderer(windowRef: Window): DomRenderer | null {
    return (windowRef as SlideDomWindow).SlideDomRenderer || null;
  }

  export function getThemeNormalizer(renderer: DomRenderer | null): ThemeNormalizer | undefined {
    return renderer && typeof renderer.normalizeTheme === "function"
      ? (theme: unknown) => renderer.normalizeTheme ? renderer.normalizeTheme(theme) : theme
      : undefined;
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

  export function patchSlideSpec(state: StudioClientState.State, slideId: string, slideSpec: JsonRecord | null): void {
    if (!slideId || !slideSpec) {
      return;
    }

    const nextSlides = Array.isArray(state.domPreview.slides) ? state.domPreview.slides.slice() : [];
    const existingIndex = nextSlides.findIndex((entry) => entry && entry.id === slideId);
    const currentSlide = state.slides.find((entry) => entry.id === slideId);
    const nextEntry = {
      id: slideId,
      index: currentSlide ? currentSlide.index : Number(slideSpec.index || 1),
      slideSpec,
      title: String(slideSpec.title || (currentSlide && currentSlide.title) || "")
    };

    if (existingIndex >= 0) {
      nextSlides[existingIndex] = {
        ...nextSlides[existingIndex],
        ...nextEntry
      };
    } else {
      nextSlides.push(nextEntry);
    }

    state.domPreview = {
      ...state.domPreview,
      slides: nextSlides
    };
  }

  export function getSlideSpec(state: StudioClientState.State, slideId: string): JsonRecord | null {
    const match = Array.isArray(state.domPreview.slides)
      ? state.domPreview.slides.find((entry) => entry && entry.id === slideId)
      : null;
    return match && match.slideSpec ? match.slideSpec : null;
  }
}
