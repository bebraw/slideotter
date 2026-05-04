import type { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientWorkflows } from "./workflows.ts";

export namespace StudioClientWorkflowWorkbench {
  type Dependencies = {
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

  export type Workbench = {
    ideateDeckStructure: () => Promise<void>;
    ideateSlide: () => Promise<void>;
    ideateStructure: () => Promise<void>;
    ideateTheme: () => Promise<void>;
    redoLayout: () => Promise<void>;
  };

  export function createWorkflowWorkbench(dependencies: Dependencies): Workbench {
    const { elements } = dependencies;
    const runners = StudioClientWorkflows.createWorkflowRunners(dependencies);

    return {
      ideateDeckStructure: () => runners.runDeckStructure({
        button: elements.ideateDeckStructureButton,
        endpoint: "/api/v1/operations/ideate-deck-structure"
      }),
      ideateSlide: () => runners.runSlideCandidate({
        button: elements.ideateSlideButton,
        endpoint: "/api/v1/operations/ideate-slide"
      }),
      ideateStructure: () => runners.runSlideCandidate({
        button: elements.ideateStructureButton,
        endpoint: "/api/v1/operations/ideate-structure"
      }),
      ideateTheme: () => runners.runSlideCandidate({
        button: elements.ideateThemeButton,
        endpoint: "/api/v1/operations/ideate-theme"
      }),
      redoLayout: () => runners.runSlideCandidate({
        button: elements.redoLayoutButton,
        endpoint: "/api/v1/operations/redo-layout"
      })
    };
  }
}
