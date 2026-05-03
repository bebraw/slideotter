import type { StudioClientElements } from "./elements";
import type { StudioClientState } from "./state";

export namespace StudioClientPresentationCreationControl {
  type ResetWorkbench = {
    applyFields: (fields?: Record<string, never>) => void;
    setStage: (stage: "brief") => void;
  };

  type ResetElements = Pick<
    StudioClientElements.Elements,
    "presentationCreateDetails" | "presentationMaterialFile" | "presentationSavedTheme" | "presentationThemeName"
  >;

  type ResetState = Pick<StudioClientState.State, "ui">;

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
}
