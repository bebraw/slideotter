import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";
import type { StudioClientDeckPlanningWorkbench } from "./deck-planning-workbench.ts";

export namespace StudioClientDeckPlanningActions {
  type DeckPlanningWorkbench = {
    mount: () => void;
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    renderOutlinePlans: () => void;
    renderSources: () => void;
    setDeckStructureCandidates: (candidates: unknown) => void;
  };

  export type DeckPlanningActionsOptions = {
    elements: StudioClientElements.Elements;
    options: StudioClientDeckPlanningWorkbench.DeckPlanningWorkbenchOptions;
    state: StudioClientState.State;
  };

  export type DeckPlanningActions = {
    load: () => void;
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    renderOutlinePlans: () => void;
    renderSources: () => void;
    setDeckStructureCandidates: (candidates: unknown[] | undefined) => void;
  };

  export function createDeckPlanningActions({
    elements,
    options,
    state
  }: DeckPlanningActionsOptions): DeckPlanningActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<DeckPlanningWorkbench>({
      create: async () => {
        const { StudioClientDeckPlanningWorkbench } = await import("./deck-planning-workbench.ts");
        return StudioClientDeckPlanningWorkbench.createDeckPlanningWorkbench(options);
      },
      mount: (workbench) => workbench.mount()
    });
    let workbench: DeckPlanningWorkbench | null = null;
    let pendingDeckStructureCandidates: unknown = undefined;

    async function getWorkbench(): Promise<DeckPlanningWorkbench> {
      workbench = await lazyWorkbench.load();
      if (pendingDeckStructureCandidates !== undefined) {
        workbench.setDeckStructureCandidates(pendingDeckStructureCandidates);
        pendingDeckStructureCandidates = undefined;
      }
      return workbench;
    }

    function load(): void {
      getWorkbench()
        .then((loadedWorkbench) => {
          loadedWorkbench.renderDeckLengthPlan();
          loadedWorkbench.renderDeckStructureCandidates();
          loadedWorkbench.renderOutlinePlans();
          loadedWorkbench.renderSources();
        })
        .catch((error: unknown) => {
          elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    return {
      load,
      renderDeckLengthPlan: () => {
        workbench?.renderDeckLengthPlan();
      },
      renderDeckStructureCandidates: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderDeckStructureCandidates(),
          shouldLoad: () => state.ui.outlineDrawerOpen || pendingDeckStructureCandidates !== undefined,
          workbench
        });
      },
      renderOutlinePlans: () => {
        workbench?.renderOutlinePlans();
      },
      renderSources: () => {
        workbench?.renderSources();
      },
      setDeckStructureCandidates: (candidates: unknown[] | undefined) => {
        pendingDeckStructureCandidates = candidates;
        if (workbench) {
          workbench.setDeckStructureCandidates(candidates);
          pendingDeckStructureCandidates = undefined;
        }
      }
    };
  }
}
