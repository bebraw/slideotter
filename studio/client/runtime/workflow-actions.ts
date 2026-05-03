import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientWorkflowActions {
  type WorkflowWorkbench = {
    ideateDeckStructure: () => Promise<void>;
    ideateSlide: () => Promise<void>;
    ideateStructure: () => Promise<void>;
    ideateTheme: () => Promise<void>;
    redoLayout: () => Promise<void>;
  };

  export type WorkflowActionsOptions = {
    clearTransientVariants: (slideId: string) => void;
    elements: StudioClientElements.Elements;
    getRequestedCandidateCount: () => Promise<number>;
    openVariantGenerationControls: () => void;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    setDeckStructureCandidates: (candidates: StudioClientState.JsonRecord[] | undefined) => void;
    state: StudioClientState.State;
  };

  export type WorkflowActions = {
    ideateDeckStructure: () => Promise<void>;
    ideateSlide: () => Promise<void>;
    ideateStructure: () => Promise<void>;
    ideateTheme: () => Promise<void>;
    redoLayout: () => Promise<void>;
  };

  export function createWorkflowActions(options: WorkflowActionsOptions): WorkflowActions {
    const workbenchOptions = {
      ...options,
      beginAbortableRequest: StudioClientState.beginAbortableRequest,
      clearAbortableRequest: StudioClientState.clearAbortableRequest,
      isAbortError: StudioClientCore.isAbortError,
      isCurrentAbortableRequest: StudioClientState.isCurrentAbortableRequest,
      postJson: StudioClientCore.postJson,
      setBusy: StudioClientCore.setBusy
    };
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<WorkflowWorkbench>({
      create: async () => {
        const { StudioClientWorkflowWorkbench } = await import("./workflow-workbench.ts");
        return StudioClientWorkflowWorkbench.createWorkflowWorkbench(workbenchOptions);
      }
    });

    return {
      ideateDeckStructure: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.ideateDeckStructure();
      },
      ideateSlide: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.ideateSlide();
      },
      ideateStructure: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.ideateStructure();
      },
      ideateTheme: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.ideateTheme();
      },
      redoLayout: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.redoLayout();
      }
    };
  }
}
