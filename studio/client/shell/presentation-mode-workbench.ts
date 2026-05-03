import { StudioClientState } from "../core/state.ts";
import { StudioClientPresentationModeControl } from "./presentation-mode-control.ts";
import { StudioClientPresentationModeState } from "./presentation-mode-state.ts";

export namespace StudioClientPresentationModeWorkbench {
  export type PresentationModeWorkbenchOptions = {
    getPresentationId: () => string | null | undefined;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type PresentationModeWorkbench = {
    openPresentationMode: () => void;
  };

  export function createPresentationModeWorkbench({
    getPresentationId,
    state,
    windowRef
  }: PresentationModeWorkbenchOptions): PresentationModeWorkbench {
    return {
      openPresentationMode: () => {
        StudioClientPresentationModeControl.openPresentationMode({
          missingPresentationMessage: "Select a presentation before opening presentation mode.",
          presentationId: getPresentationId(),
          urlForPresentation: (presentationId) => StudioClientPresentationModeState.getPresentationModeUrl(state, presentationId),
          windowRef
        });
      }
    };
  }
}
