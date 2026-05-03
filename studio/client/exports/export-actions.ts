import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import type { StudioClientBuildValidationWorkbench } from "../runtime/build-validation-workbench.ts";

export namespace StudioClientExportActions {
  type ExportWorkbench = {
    exportPdf: () => Promise<void>;
    exportPptx: () => Promise<void>;
  };

  export type ExportActionsOptions = {
    buildDeck: () => Promise<StudioClientBuildValidationWorkbench.BuildPayload>;
    elements: StudioClientElements.Elements;
    renderStatus: () => void;
    request: <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type ExportActions = {
    exportPdf: () => Promise<void>;
    exportPptx: () => Promise<void>;
  };

  export function createExportActions({
    buildDeck,
    elements,
    renderStatus,
    request,
    setBusy,
    state,
    windowRef
  }: ExportActionsOptions): ExportActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ExportWorkbench>({
      create: async () => {
        const { StudioClientExportWorkbench } = await import("./export-workbench.ts");
        return StudioClientExportWorkbench.createExportWorkbench({
          buildDeck,
          elements,
          renderStatus,
          request,
          setBusy,
          state,
          window: windowRef
        });
      }
    });

    return {
      exportPdf: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.exportPdf();
      },
      exportPptx: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.exportPptx();
      }
    };
  }
}
