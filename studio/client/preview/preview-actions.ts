import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import type { StudioClientPreviewWorkbench } from "./preview-workbench.ts";

export namespace StudioClientPreviewActions {
  type PreviewWorkbench = ReturnType<typeof StudioClientPreviewWorkbench.createPreviewWorkbench>;

  export type PreviewActions = {
    render: () => void;
  };

  export function createPreviewActions(
    options: StudioClientPreviewWorkbench.PreviewWorkbenchDependencies
  ): PreviewActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<PreviewWorkbench>({
      create: async () => {
        const { StudioClientPreviewWorkbench } = await import("./preview-workbench.ts");
        return StudioClientPreviewWorkbench.createPreviewWorkbench(options);
      }
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
