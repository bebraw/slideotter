import { StudioClientState } from "../state.ts";

export namespace StudioClientSlideSelectionState {
  export type SyncResult = {
    clearSlideUrl: boolean;
    slide: StudioClientState.StudioSlide | null;
  };

  export function clearSelectedSlide(state: StudioClientState.State): void {
    state.selectedSlideId = null;
    state.selectedSlideIndex = 1;
    state.selectedSlideSpec = null;
    state.selectedSlideSpecDraftError = null;
    state.selectedSlideSpecError = null;
    state.selectedSlideStructured = false;
    state.selectedSlideSource = "";
    state.selectedVariantId = null;
  }

  export function resetPresentationSelection(state: StudioClientState.State): void {
    clearSelectedSlide(state);
    state.transientVariants = [];
  }

  export function resolveRequestedSlide(
    state: StudioClientState.State,
    requestedSlideId: string
  ): StudioClientState.StudioSlide | null {
    if (!requestedSlideId) {
      return null;
    }
    return state.slides.find((slide) => slide.id === requestedSlideId) || null;
  }

  export function getSlideByIndex(
    state: StudioClientState.State,
    index: number
  ): StudioClientState.StudioSlide | null {
    return state.slides.find((entry) => entry.index === index) || null;
  }

  export function syncSelectedSlideToActiveList(
    state: StudioClientState.State,
    requestedSlideId: string
  ): SyncResult {
    const selected = state.slides.find((entry) => entry.id === state.selectedSlideId);

    if (selected) {
      state.selectedSlideIndex = selected.index;
      return {
        clearSlideUrl: false,
        slide: selected
      };
    }

    const fallback = state.slides[0] || null;
    if (!fallback) {
      clearSelectedSlide(state);
      return {
        clearSlideUrl: true,
        slide: null
      };
    }

    const requestedSlide = resolveRequestedSlide(state, requestedSlideId);
    const nextSlide = requestedSlide || fallback;
    state.selectedSlideId = nextSlide.id;
    state.selectedSlideIndex = nextSlide.index;
    return {
      clearSlideUrl: false,
      slide: nextSlide
    };
  }
}
