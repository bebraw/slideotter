import type { StudioClientElements } from "../elements";
import type { StudioClientPresentationCreationWorkbench } from "./presentation-creation-workbench.ts";
import type { StudioClientState } from "../state";

export namespace StudioClientPresentationCreationControl {
  type CreationFields = StudioClientPresentationCreationWorkbench.CreationFields;

  type ResetWorkbench = {
    applyFields: (fields?: CreationFields) => void;
    setStage: (stage: "brief") => void;
  };

  type DraftWorkbench = {
    applyFields: (fields: CreationFields) => void;
    normalizeStage: (stage: unknown) => StudioClientState.State["ui"]["creationStage"];
  };

  type ResetElements = Pick<
    StudioClientElements.Elements,
    "presentationCreateDetails" | "presentationMaterialFile" | "presentationSavedTheme" | "presentationThemeName"
  >;

  type ResetState = Pick<StudioClientState.State, "ui">;

  type DraftState = Pick<StudioClientState.State, "creationDraft" | "ui">;

  export function resetControl(deps: {
    elements: ResetElements;
    state: ResetState;
    workbench: ResetWorkbench;
  }): void {
    const { elements, state, workbench } = deps;
    workbench.applyFields({});
    elements.presentationMaterialFile.value = "";
    elements.presentationThemeName.value = "";
    elements.presentationSavedTheme.value = "";
    state.ui.creationContentSlideIndex = 1;
    state.ui.creationContentSlidePinned = false;
    workbench.setStage("brief");
    if (elements.presentationCreateDetails) {
      elements.presentationCreateDetails.open = false;
    }
  }

  export function hydrateDraftFields(deps: {
    state: DraftState;
    workbench: DraftWorkbench;
  }): void {
    const { state, workbench } = deps;
    if (!state.creationDraft || !state.creationDraft.fields) {
      return;
    }

    workbench.applyFields(state.creationDraft.fields);
    state.ui.creationStage = workbench.normalizeStage(state.creationDraft.stage || state.ui.creationStage);
  }
}
