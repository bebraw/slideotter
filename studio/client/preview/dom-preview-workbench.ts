import { StudioClientCore } from "../platform/core.ts";
import { StudioClientState } from "../core/state.ts";
import { getSlideSpec, patchSlideSpec, setFromPayload } from "./dom-preview-slides.ts";
import { getWindowCurrentTheme, getWindowVariantVisualTheme } from "./dom-preview-theme.ts";
import { StudioClientSlidePreview } from "./slide-preview.ts";

export namespace StudioClientDomPreviewWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;

  type DomSlideRenderOptions = {
    index?: number;
    theme?: unknown;
    totalSlides?: number;
  };

  export type DomPreviewWorkbenchOptions = {
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type DomPreviewWorkbench = {
    getDomTheme: () => unknown;
    getDomSlideSpec: (slideId: string) => JsonRecord | null;
    getVariantVisualTheme: (variant: { visualTheme?: unknown } | null) => unknown;
    patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => void;
    renderDomSlide: (viewport: Element | null, slideSpec: unknown, options?: DomSlideRenderOptions) => void;
    renderImagePreview: (viewport: HTMLElement | null, url: string, alt: string) => void;
    setDomPreviewState: (payload: JsonRecord) => void;
  };

  export function createDomPreviewWorkbench({
    state,
    windowRef
  }: DomPreviewWorkbenchOptions): DomPreviewWorkbench {
    const getDomTheme = () => getWindowCurrentTheme(state, windowRef);
    const slidePreview = StudioClientSlidePreview.createSlidePreview({
      createDomElement: StudioClientCore.createDomElement,
      getTheme: getDomTheme,
      windowRef
    });

    return {
      getDomTheme,
      getDomSlideSpec: (slideId: string) => getSlideSpec(state, slideId),
      getVariantVisualTheme: (variant: { visualTheme?: unknown } | null) => {
        return getWindowVariantVisualTheme(state, windowRef, variant);
      },
      patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => {
        patchSlideSpec(state, slideId, slideSpec);
      },
      renderDomSlide: (viewport: Element | null, slideSpec: unknown, options: DomSlideRenderOptions = {}) => {
        slidePreview.renderDomSlide(viewport instanceof HTMLElement ? viewport : null, slideSpec, options);
      },
      renderImagePreview: (viewport: HTMLElement | null, url: string, alt: string) => {
        slidePreview.renderImagePreview(viewport, url, alt);
      },
      setDomPreviewState: (payload: JsonRecord) => {
        setFromPayload(state, payload);
      }
    };
  }
}
