import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientThemePanelActions {
  type ThemeWorkbench = {
    renderSavedThemes: () => void;
    renderStage: () => void;
    resetCandidates: () => void;
  };

  export type ThemePanelActionsOptions<TWorkbench extends ThemeWorkbench> = {
    elements: StudioClientElements.Elements;
    lazyWorkbench: StudioClientLazyWorkbench.LazyWorkbench<TWorkbench>;
    state: StudioClientState.State;
  };

  export type ThemePanelActions<TWorkbench extends ThemeWorkbench> = {
    getWorkbench: () => TWorkbench | null;
    load: () => void;
    renderSavedThemes: () => void;
    renderStage: () => void;
    resetCandidates: () => void;
  };

  export function createThemePanelActions<TWorkbench extends ThemeWorkbench>({
    elements,
    lazyWorkbench,
    state
  }: ThemePanelActionsOptions<TWorkbench>): ThemePanelActions<TWorkbench> {
    let workbench: TWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<TWorkbench> {
      workbench = await lazyWorkbench.load();
      return workbench;
    }

    function load(): void {
      getLoadedWorkbench()
        .then((loadedWorkbench) => {
          loadedWorkbench.renderSavedThemes();
          loadedWorkbench.renderStage();
        })
        .catch((error: unknown) => {
          elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    return {
      getWorkbench: () => workbench,
      load,
      renderSavedThemes: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderSavedThemes(),
          shouldLoad: () => state.ui.themeDrawerOpen || state.ui.currentPage === "presentations",
          workbench
        });
      },
      renderStage: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderStage(),
          shouldLoad: () => state.ui.themeDrawerOpen || state.ui.currentPage === "presentations",
          workbench
        });
      },
      resetCandidates: () => {
        workbench?.resetCandidates();
      }
    };
  }
}
