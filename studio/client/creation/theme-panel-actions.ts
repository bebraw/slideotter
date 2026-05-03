import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientCreationThemeState } from "./creation-theme-state.ts";
import type { StudioClientThemeWorkbench } from "./theme-workbench.ts";

export namespace StudioClientThemePanelActions {
  type ThemeWorkbench = {
    getSelectedVariant: () => StudioClientCreationThemeState.ThemeVariant;
    mount: () => void;
    renderSavedThemes: () => void;
    renderStage: () => void;
    resetCandidates: () => void;
  };

  export type ThemePanelActionsOptions = {
    elements: StudioClientElements.Elements;
    options: StudioClientThemeWorkbench.ThemeWorkbenchDependencies;
    state: StudioClientState.State;
  };

  export type ThemePanelActions = {
    getWorkbench: () => ThemeWorkbench | null;
    load: () => void;
    renderSavedThemes: () => void;
    renderStage: () => void;
    resetCandidates: () => void;
  };

  export function createThemePanelActions({
    elements,
    options,
    state
  }: ThemePanelActionsOptions): ThemePanelActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ThemeWorkbench>({
      create: async () => {
        const { StudioClientThemeWorkbench } = await import("./theme-workbench.ts");
        return StudioClientThemeWorkbench.createThemeWorkbench(options);
      },
      mount: (workbench) => workbench.mount()
    });
    let workbench: ThemeWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<ThemeWorkbench> {
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
