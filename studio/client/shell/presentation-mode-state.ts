import { StudioClientState } from "../core/state.ts";

export namespace StudioClientPresentationModeState {
  export function getSlideIndex(state: StudioClientState.State): number {
    return Number.isFinite(Number(state.selectedSlideIndex)) && Number(state.selectedSlideIndex) > 0
      ? Number(state.selectedSlideIndex)
      : 1;
  }

  export function getPresentHref(state: StudioClientState.State, presentationId: string): string {
    return state.hypermedia
      && state.hypermedia.activePresentation
      && state.hypermedia.activePresentation.links
      && state.hypermedia.activePresentation.links.present
      && state.hypermedia.activePresentation.links.present.href
        ? state.hypermedia.activePresentation.links.present.href
        : `/present/${encodeURIComponent(presentationId)}`;
  }

  export function getPresentationModeUrl(state: StudioClientState.State, presentationId: string): string {
    return `${getPresentHref(state, presentationId)}#x=${getSlideIndex(state)}`;
  }
}
