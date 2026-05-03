import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientPresentationCreationControl } from "./presentation-creation-control.ts";
import { StudioClientPresentationCreationState } from "./presentation-creation-state.ts";
import { StudioClientPresentationCreationWorkbench } from "./presentation-creation-workbench.ts";

export namespace StudioClientPresentationCreationActions {
  type PresentationCreationWorkbench = ReturnType<typeof StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench>;
  type PresentationCreationWorkbenchDependencies = Omit<
    StudioClientPresentationCreationWorkbench.PresentationCreationWorkbenchDependencies,
    "createDomElement" | "request" | "setBusy"
  >;

  export type PresentationCreationActionsOptions = {
    elements: StudioClientElements.Elements;
    state: StudioClientState.State;
    workbench: PresentationCreationWorkbench;
  };

  export type PresentationCreationActions = {
    getPresentationState: () => StudioClientPresentationCreationState.PresentationState;
    isEmptyCreationDraft: (draft: StudioClientState.CreationDraft | null) => boolean;
    isWorkflowRunning: () => boolean;
    resetControl: () => void;
  };

  export function createPresentationCreationWorkbench(
    options: PresentationCreationWorkbenchDependencies
  ): PresentationCreationWorkbench {
    return StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench({
      ...options,
      createDomElement: StudioClientCore.createDomElement,
      request: StudioClientCore.request,
      setBusy: StudioClientCore.setBusy
    });
  }

  export function createPresentationCreationActions({
    elements,
    state,
    workbench
  }: PresentationCreationActionsOptions): PresentationCreationActions {
    return {
      getPresentationState: () => StudioClientPresentationCreationState.getPresentationState(state),
      isEmptyCreationDraft: (draft) => StudioClientPresentationCreationState.isEmptyCreationDraft(draft),
      isWorkflowRunning: () => StudioClientPresentationCreationState.isWorkflowRunning(state),
      resetControl: () => {
        StudioClientPresentationCreationControl.resetControl({
          elements,
          state,
          workbench
        });
      }
    };
  }
}
