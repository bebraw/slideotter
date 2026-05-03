import { StudioClientCore } from "../platform/core.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientSlideLoadState } from "./slide-load-state.ts";

export namespace StudioClientSlideLoadWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;
  type VariantRecord = StudioClientState.VariantRecord;

  export type SlideLoadWorkbenchOptions = {
    clearAssistantSelection: () => void;
    clearTransientVariants: (slideId: string) => void;
    patchDomSlideSpec: (slideId: string, slideSpec: JsonRecord | null) => void;
    renderPreviews: () => void;
    renderSlideFields: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    replacePersistedVariantsForSlide: (slideId: string, variants: VariantRecord[]) => void;
    request: <T>(url: string, options?: StudioClientCore.JsonRequestOptions) => Promise<T>;
    setUrlSlideParam: (slideId: string | null) => void;
    state: StudioClientState.State;
  };

  export type SlideLoadWorkbench = {
    loadSlide: (slideId: string) => Promise<void>;
  };

  export function createSlideLoadWorkbench({
    clearAssistantSelection,
    clearTransientVariants,
    patchDomSlideSpec,
    renderPreviews,
    renderSlideFields,
    renderStatus,
    renderVariants,
    replacePersistedVariantsForSlide,
    request,
    setUrlSlideParam,
    state
  }: SlideLoadWorkbenchOptions): SlideLoadWorkbench {
    return {
      loadSlide: async (slideId: string) => {
        const { abortController, requestSeq } = StudioClientState.beginAbortableRequest(
          state,
          "slideLoadAbortController",
          "slideLoadRequestSeq"
        );
        const previousSlideId = state.selectedSlideId;
        if (previousSlideId && previousSlideId !== slideId) {
          clearTransientVariants(previousSlideId);
        }
        try {
          const payload = await request<StudioClientSlideLoadState.SlidePayload>(`/api/slides/${slideId}`, {
            signal: abortController.signal
          });
          if (!StudioClientState.isCurrentAbortableRequest(
            state,
            "slideLoadAbortController",
            "slideLoadRequestSeq",
            requestSeq,
            abortController
          )) {
            return;
          }
          if (state.selectedSlideId !== slideId) {
            clearAssistantSelection();
          }
          StudioClientSlideLoadState.applySlidePayload(state, slideId, payload);
          patchDomSlideSpec(slideId, payload.slideSpec || null);
          replacePersistedVariantsForSlide(slideId, payload.variants || []);
          clearTransientVariants(slideId);
          setUrlSlideParam(slideId);
          renderStatus();
          renderSlideFields();
          renderPreviews();
          renderVariants();
        } catch (error) {
          if (StudioClientCore.isAbortError(error)) {
            return;
          }
          throw error;
        } finally {
          StudioClientState.clearAbortableRequest(state, "slideLoadAbortController", abortController);
        }
      }
    };
  }
}
