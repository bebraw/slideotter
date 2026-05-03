import { StudioClientCore } from "../platform/core.ts";
import { StudioClientSlideEditorWorkbench } from "./slide-editor-workbench.ts";

export namespace StudioClientSlideEditorActions {
  type SlideEditorWorkbenchDependencies = Omit<
    StudioClientSlideEditorWorkbench.SlideEditorWorkbenchDependencies,
    "createDomElement" | "highlightJsonSource" | "request" | "setBusy"
  >;

  export type SlideEditorWorkbench = ReturnType<typeof StudioClientSlideEditorWorkbench.createSlideEditorWorkbench>;

  export function createSlideEditorWorkbench(
    options: SlideEditorWorkbenchDependencies
  ): SlideEditorWorkbench {
    return StudioClientSlideEditorWorkbench.createSlideEditorWorkbench({
      ...options,
      createDomElement: StudioClientCore.createDomElement,
      highlightJsonSource: StudioClientCore.highlightJsonSource,
      request: StudioClientCore.request,
      setBusy: StudioClientCore.setBusy
    });
  }
}
