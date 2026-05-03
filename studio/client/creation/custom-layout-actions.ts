import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientCustomLayoutActions {
  type JsonRecord = StudioClientState.JsonRecord;

  type CustomLayoutWorkbench = {
    getLivePreviewSlideSpec: (slide: StudioClientState.StudioSlide | undefined, slideSpec: JsonRecord | null) => JsonRecord | null;
    isSupported: () => boolean;
    renderEditor: () => void;
    renderLayoutStudio: () => void;
    renderLibrary: () => void;
  };

  export type CustomLayoutActionsOptions<TWorkbench extends CustomLayoutWorkbench> = {
    elements: StudioClientElements.Elements;
    lazyWorkbench: StudioClientLazyWorkbench.LazyWorkbench<TWorkbench>;
    state: StudioClientState.State;
  };

  export type CustomLayoutActions<TWorkbench extends CustomLayoutWorkbench> = {
    getWorkbench: () => TWorkbench | null;
    isSupported: () => boolean;
    load: () => void;
    renderEditor: () => void;
    renderLayoutStudio: () => void;
    renderLibrary: () => void;
  };

  export function createCustomLayoutActions<TWorkbench extends CustomLayoutWorkbench>({
    elements,
    lazyWorkbench,
    state
  }: CustomLayoutActionsOptions<TWorkbench>): CustomLayoutActions<TWorkbench> {
    let workbench: TWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<TWorkbench> {
      workbench = await lazyWorkbench.load();
      return workbench;
    }

    function load(): void {
      getLoadedWorkbench()
        .then((loadedWorkbench) => {
          loadedWorkbench.renderLibrary();
          loadedWorkbench.renderEditor();
          loadedWorkbench.renderLayoutStudio();
        })
        .catch((error: unknown) => {
          elements.customLayoutStatus.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    return {
      getWorkbench: () => workbench,
      isSupported: () => {
        if (workbench) {
          return workbench.isSupported();
        }
        return Boolean(state.selectedSlideSpec && ["content", "cover"].includes(String(state.selectedSlideSpec.type || "")));
      },
      load,
      renderEditor: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderEditor(),
          shouldLoad: () => state.ui.layoutDrawerOpen,
          workbench
        });
      },
      renderLayoutStudio: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderLayoutStudio(),
          shouldLoad: () => state.ui.layoutDrawerOpen,
          workbench
        });
      },
      renderLibrary: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderLibrary(),
          shouldLoad: () => state.ui.layoutDrawerOpen,
          workbench
        });
      }
    };
  }
}
