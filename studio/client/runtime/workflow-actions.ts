import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
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
    beginAbortableRequest: typeof StudioClientState.beginAbortableRequest;
    clearAbortableRequest: typeof StudioClientState.clearAbortableRequest;
    clearTransientVariants: (slideId: string) => void;
    elements: StudioClientElements.Elements;
    getRequestedCandidateCount: () => Promise<number>;
    isAbortError: (error: unknown) => boolean;
    isCurrentAbortableRequest: typeof StudioClientState.isCurrentAbortableRequest;
    openVariantGenerationControls: () => void;
    postJson: (url: string, body: unknown, options?: RequestInit) => Promise<{
      deckStructureCandidates?: StudioClientState.JsonRecord[];
      previews?: StudioClientState.State["previews"];
      runtime?: StudioClientState.State["runtime"];
      summary?: string;
      transientVariants?: StudioClientState.VariantRecord[];
      variants?: StudioClientState.VariantRecord[];
    }>;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
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
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<WorkflowWorkbench>({
      create: async () => {
        const { StudioClientWorkflowWorkbench } = await import("./workflow-workbench.ts");
        return StudioClientWorkflowWorkbench.createWorkflowWorkbench(options);
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
