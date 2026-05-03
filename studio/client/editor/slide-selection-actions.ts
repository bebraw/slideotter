import { StudioClientState } from "../core/state.ts";
import { StudioClientUrlState } from "../core/url-state.ts";
import { StudioClientSlideSelectionState } from "./slide-selection-state.ts";

export namespace StudioClientSlideSelectionActions {
  type PresentationLibrary = {
    resetSelection: () => void;
  };

  export type SlideSelectionActionsOptions = {
    getPresentationLibrary: () => PresentationLibrary | null;
    loadSlide: (slideId: string) => Promise<void>;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type SlideSelectionActions = {
    resetPresentationSelection: () => void;
    selectSlideByIndex: (index: number) => Promise<void>;
    setUrlSlideParam: (slideId: string | null) => void;
    syncSelectedSlideToActiveList: () => StudioClientState.StudioSlide | null;
  };

  export function createSlideSelectionActions({
    getPresentationLibrary,
    loadSlide,
    state,
    windowRef
  }: SlideSelectionActionsOptions): SlideSelectionActions {
    function getUrlSlideParam(): string {
      return StudioClientUrlState.getSlideParam(windowRef);
    }

    function setUrlSlideParam(slideId: string | null): void {
      StudioClientUrlState.setSlideParam(windowRef, slideId);
    }

    return {
      resetPresentationSelection: () => {
        StudioClientSlideSelectionState.resetPresentationSelection(state);
        getPresentationLibrary()?.resetSelection();
      },
      selectSlideByIndex: async (index: number) => {
        const slide = StudioClientSlideSelectionState.getSlideByIndex(state, index);
        if (!slide) {
          return;
        }

        await loadSlide(slide.id);
      },
      setUrlSlideParam,
      syncSelectedSlideToActiveList: () => {
        const result = StudioClientSlideSelectionState.syncSelectedSlideToActiveList(state, getUrlSlideParam());
        if (result.clearSlideUrl) {
          setUrlSlideParam(null);
        }
        return result.slide;
      }
    };
  }
}
