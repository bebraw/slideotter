import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientPresentationLibraryActions {
  type PresentationLibraryWorkbench = {
    render: () => void;
    resetSelection: () => void;
  };

  export type PresentationLibraryActionsOptions<TWorkbench extends PresentationLibraryWorkbench> = {
    elements: StudioClientElements.Elements;
    lazyWorkbench: StudioClientLazyWorkbench.LazyWorkbench<TWorkbench>;
    state: StudioClientState.State;
  };

  export type PresentationLibraryActions<TWorkbench extends PresentationLibraryWorkbench> = {
    getWorkbench: () => TWorkbench | null;
    render: () => void;
  };

  export function createPresentationLibraryActions<TWorkbench extends PresentationLibraryWorkbench>({
    elements,
    lazyWorkbench,
    state
  }: PresentationLibraryActionsOptions<TWorkbench>): PresentationLibraryActions<TWorkbench> {
    let workbench: TWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<TWorkbench> {
      workbench = await lazyWorkbench.load();
      return workbench;
    }

    return {
      getWorkbench: () => workbench,
      render: () => {
        if (state.ui.currentPage !== "presentations" && !workbench) {
          return;
        }

        getLoadedWorkbench()
          .then((loadedWorkbench) => loadedWorkbench.render())
          .catch((error: unknown) => {
            elements.presentationResultCount.textContent = error instanceof Error ? error.message : String(error);
          });
      }
    };
  }
}
