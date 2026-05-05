import { StudioClientDomPreviewWorkbench } from "./preview/dom-preview-workbench.ts";
import { StudioClientElements } from "./core/elements.ts";
import { StudioClientState } from "./core/state.ts";
import { mountOutlineDrawerShell } from "./shell/outline-drawer-shell.ts";

export function createStudioClientFoundation(documentRef: Document, windowRef: Window) {
  mountOutlineDrawerShell(documentRef);

  const state: StudioClientState.State = StudioClientState.createInitialState();
  const elements: StudioClientElements.Elements = StudioClientElements.createElements();
  const domPreviewWorkbench = StudioClientDomPreviewWorkbench.createDomPreviewWorkbench({
    state,
    windowRef
  });

  return {
    domPreviewWorkbench,
    elements,
    state
  };
}
