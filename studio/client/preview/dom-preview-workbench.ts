import { StudioClientCore } from "../core/core.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientDomPreviewState } from "./dom-preview-state.ts";
import { StudioClientSlidePreview } from "./slide-preview.ts";

export namespace StudioClientDomPreviewWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;

  type DomSlideRenderOptions = {
    index?: number;
    theme?: unknown;
    totalSlides?: number;
  };

  export type DomPreviewWorkbenchOptions = {
    createDomElement: typeof StudioClientCore.createDomElement;
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
    createDomElement,
    state,
    windowRef
  }: DomPreviewWorkbenchOptions): DomPreviewWorkbench {
    const getDomTheme = () => StudioClientDomPreviewState.getWindowCurrentTheme(state, windowRef);
    const slidePreview = StudioClientSlidePreview.createSlidePreview({
      createDomElement,
      getTheme: getDomTheme,
      windowRef
    });

    return {
      getDomTheme,
      getDomSlideSpec: (slideId: string) => StudioClientDomPreviewState.getSlideSpec(state, slideId),
      getVariantVisualTheme: (variant: { visualTheme?: unknown } | null) => {
        return StudioClientDomPreviewState.getWindowVariantVisualTheme(state, windowRef, variant);
      },
      patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => {
        StudioClientDomPreviewState.patchSlideSpec(state, slideId, slideSpec);
      },
      renderDomSlide: (viewport: Element | null, slideSpec: unknown, options: DomSlideRenderOptions = {}) => {
        slidePreview.renderDomSlide(viewport instanceof HTMLElement ? viewport : null, slideSpec, options);
      },
      renderImagePreview: (viewport: HTMLElement | null, url: string, alt: string) => {
        slidePreview.renderImagePreview(viewport, url, alt);
      },
      setDomPreviewState: (payload: JsonRecord) => {
        StudioClientDomPreviewState.setFromPayload(state, payload);
      }
    };
  }
}
