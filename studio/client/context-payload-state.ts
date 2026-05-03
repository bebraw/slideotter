import { StudioClientState } from "./state.ts";

export namespace StudioClientContextPayloadState {
  export type ContextPayload = {
    context: StudioClientState.DeckContext;
  };

  export type ApplyOptions = {
    resetDeckStructure?: boolean;
  };

  export function applyContextPayload(
    state: StudioClientState.State,
    payload: ContextPayload,
    options: ApplyOptions = {}
  ): void {
    state.context = payload.context;
    state.domPreview = {
      ...state.domPreview,
      theme: payload.context && payload.context.deck ? payload.context.deck.visualTheme : state.domPreview.theme
    };
    if (options.resetDeckStructure) {
      state.deckStructureCandidates = [];
      state.selectedDeckStructureId = null;
    }
  }
}
