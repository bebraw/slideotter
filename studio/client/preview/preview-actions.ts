import { StudioClientCore } from "../platform/core.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import type { StudioClientPreviewWorkbench } from "./preview-workbench.ts";

export namespace StudioClientPreviewActions {
  type PreviewWorkbench = ReturnType<typeof StudioClientPreviewWorkbench.createPreviewWorkbench>;
  type PreviewWorkbenchDependencies = Omit<StudioClientPreviewWorkbench.PreviewWorkbenchDependencies, "createDomElement">;

  export type PreviewActions = {
    render: () => void;
  };

  export function createPreviewActions(
    options: PreviewWorkbenchDependencies
  ): PreviewActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: () => import("./preview-workbench.ts"),
      create: ({ StudioClientPreviewWorkbench }): PreviewWorkbench => (
        StudioClientPreviewWorkbench.createPreviewWorkbench({
          ...options,
          createDomElement: StudioClientCore.createDomElement
        })
      )
    });

    function reportError(error: unknown): void {
      options.elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
    }

    return {
      render: () => {
        lazyWorkbench.load().then((workbench) => workbench.render()).catch(reportError);
      }
    };
  }
}
