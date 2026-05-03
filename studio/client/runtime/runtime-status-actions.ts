import { StudioClientCore } from "../platform/core.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import type { StudioClientRuntimeStatusWorkbench } from "./runtime-status-workbench.ts";

export namespace StudioClientRuntimeStatusActions {
  type RuntimeStatusWorkbench = ReturnType<typeof StudioClientRuntimeStatusWorkbench.createRuntimeStatusWorkbench>;
  type RuntimeStatusActionsOptions = Omit<
    StudioClientRuntimeStatusWorkbench.RuntimeStatusDependencies,
    "createDomElement" | "llmStatus" | "request" | "setBusy"
  >;
  type CheckLlmOptions = {
    silent?: boolean;
  };

  export type RuntimeStatusActions = {
    checkLlmProvider: (options?: CheckLlmOptions) => Promise<void>;
    connectRuntimeStream: () => void;
    mountLlmModelControls: () => void;
    renderStatus: () => void;
    setLlmPopoverOpen: (open: boolean) => void;
    toggleLlmPopover: () => void;
  };

  export function createRuntimeStatusActions(
    options: RuntimeStatusActionsOptions
  ): RuntimeStatusActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: async () => ({
        ...(await import("./runtime-status-workbench.ts")),
        ...(await import("./llm-status.ts"))
      }),
      create: ({ StudioClientLlmStatus, StudioClientRuntimeStatusWorkbench }): RuntimeStatusWorkbench => (
        StudioClientRuntimeStatusWorkbench.createRuntimeStatusWorkbench({
          ...options,
          createDomElement: StudioClientCore.createDomElement,
          llmStatus: StudioClientLlmStatus.createLlmStatus({
            renderStatus,
            state: options.state
          }),
          request: StudioClientCore.request,
          setBusy: StudioClientCore.setBusy
        })
      )
    });

    function reportError(error: unknown): void {
      options.elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
    }

    function renderStatus(): void {
      const workbench = lazyWorkbench.get();
      if (workbench) {
        workbench.renderStatus();
        return;
      }
      lazyWorkbench.load().then((loadedWorkbench) => loadedWorkbench.renderStatus()).catch(reportError);
    }

    return {
      checkLlmProvider: async (checkOptions = {}) => {
        const workbench = await lazyWorkbench.load();
        await workbench.checkLlmProvider(checkOptions);
      },
      connectRuntimeStream: () => {
        lazyWorkbench.load().then((workbench) => workbench.connectRuntimeStream()).catch(reportError);
      },
      mountLlmModelControls: () => {
        lazyWorkbench.load().then((workbench) => workbench.mountLlmModelControls()).catch(reportError);
      },
      renderStatus,
      setLlmPopoverOpen: (open) => {
        lazyWorkbench.load().then((workbench) => workbench.setLlmPopoverOpen(open)).catch(reportError);
      },
      toggleLlmPopover: () => {
        lazyWorkbench.load().then((workbench) => workbench.toggleLlmPopover()).catch(reportError);
      }
    };
  }
}
