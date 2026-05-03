import { StudioClientCore } from "../core/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientPresentationLibraryActions {
  type PresentationLibraryWorkbench = {
    render: () => void;
    resetSelection: () => void;
  };

  type PresentationState = {
    activePresentationId?: string | null;
    presentations: Array<{
      id: string;
    }>;
  };

  export type PresentationLibraryActionsOptions = {
    createDomElement: typeof StudioClientCore.createDomElement;
    elements: StudioClientElements.Elements;
    getPresentationState: () => PresentationState;
    refreshState: () => Promise<void>;
    renderDomSlide: (viewport: Element | null, slideSpec: unknown, options?: { index?: number; theme?: unknown; totalSlides?: number }) => void;
    request: <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;
    setBusy: (button: HTMLElement & { disabled: boolean }, label: string) => () => void;
    setCurrentPage: (page: string) => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type PresentationLibraryActions = {
    getWorkbench: () => PresentationLibraryWorkbench | null;
    render: () => void;
  };

  export function createPresentationLibraryActions({
    createDomElement,
    elements,
    getPresentationState,
    refreshState,
    renderDomSlide,
    request,
    setBusy,
    setCurrentPage,
    state,
    windowRef
  }: PresentationLibraryActionsOptions): PresentationLibraryActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<PresentationLibraryWorkbench>({
      create: async () => {
        const { StudioClientPresentationLibrary } = await import("./presentation-library.ts");
        return StudioClientPresentationLibrary.createPresentationLibrary({
          createDomElement,
          elements,
          getPresentationState,
          refreshState,
          renderDomSlide,
          request,
          setBusy,
          setCurrentPage,
          state,
          windowRef
        });
      }
    });
    let workbench: PresentationLibraryWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<PresentationLibraryWorkbench> {
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
