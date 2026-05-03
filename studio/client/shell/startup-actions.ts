import { StudioClientCore } from "../core/core.ts";
import type { StudioClientElements } from "../core/elements.ts";
import type { StudioClientState } from "../core/state.ts";
import type { StudioClientBuildValidationWorkbench } from "../runtime/build-validation-workbench.ts";
import type { StudioClientAppTheme } from "./app-theme.ts";
import type { StudioClientCommandControls } from "./command-controls.ts";
import { StudioClientExportMenu } from "./export-menu.ts";
import type { StudioClientGlobalEvents } from "./global-events.ts";
import { StudioClientPreferences } from "./preferences.ts";

export namespace StudioClientStartupActions {
  type AppTheme = ReturnType<typeof StudioClientAppTheme.createAppTheme>;
  type CommandControlDeps = StudioClientCommandControls.CommandControlDeps;
  type GlobalEventDeps = StudioClientGlobalEvents.GlobalEventDeps;
  type StartupCommandControls = Omit<CommandControlDeps, "appTheme" | "commands" | "elements" | "navigationShell" | "windowRef"> & {
    commands: Omit<CommandControlDeps["commands"], "closeExportMenu" | "toggleExportMenu">;
  };

  export type StartupNavigationShell = CommandControlDeps["navigationShell"]
    & GlobalEventDeps["navigationShell"];

  export type StartupActionsOptions = {
    commandControls: StartupCommandControls;
    documentRef: Document;
    elements: StudioClientElements.Elements;
    navigationShell: StartupNavigationShell;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type StartupActions = {
    initializeTheme: () => Promise<void>;
    mountCommandControls: () => Promise<void>;
    mountGlobalEvents: () => Promise<void>;
  };

  export type StudioClientStartupOptions = {
    assistantActions: {
      load: () => void;
    };
    buildDeck: () => Promise<unknown>;
    deckPlanningActions: {
      load: () => void;
    };
    elements: StudioClientElements.Elements;
    navigationShell: StartupNavigationShell & {
      initializeState: () => void;
      renderAllDrawers: () => void;
      renderPages: () => void;
    };
    presentationCreationWorkbench: {
      mountInputs: () => void;
    };
    refreshState: () => Promise<void>;
    renderManualSlideForm: () => void;
    runtimeStatusActions: {
      checkLlmProvider: (options?: { silent?: boolean }) => Promise<void>;
      connectRuntimeStream: () => void;
    };
    startupActions: StartupActions;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type PresentationModeCommandOptions = {
    getPresentationId: () => string | null | undefined;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type ExportCommandsOptions = {
    buildDeck: () => Promise<StudioClientBuildValidationWorkbench.BuildPayload>;
    elements: StudioClientElements.Elements;
    renderStatus: () => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type ExportCommands = {
    exportPdf: () => Promise<void>;
    exportPptx: () => Promise<void>;
  };

  export function createStartupActions({
    commandControls,
    documentRef,
    elements,
    navigationShell,
    state,
    windowRef
  }: StartupActionsOptions): StartupActions {
    const exportMenu = StudioClientExportMenu.createExportMenu(elements);
    let appThemePromise: Promise<AppTheme> | null = null;

    function loadAppTheme(): Promise<AppTheme> {
      appThemePromise ||= import("./app-theme.ts").then(({ StudioClientAppTheme }) => {
        return StudioClientAppTheme.createAppTheme({
          document: documentRef,
          elements,
          preferences: StudioClientPreferences,
          state
        });
      });
      return appThemePromise;
    }

    return {
      initializeTheme: async () => {
        const appTheme = await loadAppTheme();
        state.ui.appTheme = appTheme.load();
        appTheme.apply(state.ui.appTheme);
      },
      mountCommandControls: async () => {
        const [appTheme, { StudioClientCommandControls }] = await Promise.all([
          loadAppTheme(),
          import("./command-controls.ts")
        ]);
        StudioClientCommandControls.mountCommandControls({
          ...commandControls,
          appTheme,
          commands: {
            ...commandControls.commands,
            closeExportMenu: () => exportMenu.close(),
            toggleExportMenu: () => exportMenu.toggle()
          },
          elements,
          navigationShell,
          windowRef
        });
      },
      mountGlobalEvents: async () => {
        const { StudioClientGlobalEvents } = await import("./global-events.ts");
        StudioClientGlobalEvents.mountGlobalEvents({
          documentRef,
          exportMenu,
          navigationShell
        });
      }
    };
  }

  export function createPresentationModeCommand({
    getPresentationId,
    state,
    windowRef
  }: PresentationModeCommandOptions): () => void {
    return () => {
      void import("./presentation-mode-actions.ts")
        .then(({ StudioClientPresentationModeActions }) => {
          StudioClientPresentationModeActions.createPresentationModeActions({
            getPresentationId,
            state,
            windowRef
          }).open();
        });
    };
  }

  export function createExportCommands(options: ExportCommandsOptions): ExportCommands {
    let exportActionsPromise: Promise<ExportCommands> | null = null;

    function loadExportActions(): Promise<ExportCommands> {
      exportActionsPromise ||= import("../exports/export-actions.ts")
        .then(({ StudioClientExportActions }) => StudioClientExportActions.createExportActions({
          ...options,
          request: StudioClientCore.request,
          setBusy: StudioClientCore.setBusy
        }));
      return exportActionsPromise;
    }

    return {
      exportPdf: async () => {
        const exportActions = await loadExportActions();
        await exportActions.exportPdf();
      },
      exportPptx: async () => {
        const exportActions = await loadExportActions();
        await exportActions.exportPptx();
      }
    };
  }

  function reportStartupError(elements: StudioClientElements.Elements, error: unknown): void {
    elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
  }

  export function initializeStudioClient({
    assistantActions,
    buildDeck,
    deckPlanningActions,
    elements,
    navigationShell,
    presentationCreationWorkbench,
    refreshState,
    renderManualSlideForm,
    runtimeStatusActions,
    startupActions,
    state,
    windowRef
  }: StudioClientStartupOptions): void {
    startupActions.mountCommandControls().catch((error: unknown) => reportStartupError(elements, error));
    presentationCreationWorkbench.mountInputs();
    startupActions.mountGlobalEvents().catch((error: unknown) => reportStartupError(elements, error));
    startupActions.initializeTheme().catch((error: unknown) => reportStartupError(elements, error));

    navigationShell.initializeState();
    if (state.ui.assistantOpen) {
      assistantActions.load();
    }
    if (state.ui.outlineDrawerOpen) {
      deckPlanningActions.load();
    }
    navigationShell.renderPages();
    navigationShell.renderAllDrawers();
    renderManualSlideForm();
    runtimeStatusActions.connectRuntimeStream();

    refreshState()
      .then(async () => {
        runtimeStatusActions.checkLlmProvider({ silent: true }).catch(() => {
          // Startup verification is best-effort; the popover keeps manual retry available.
        });

        if (!state.previews.pages.length) {
          await buildDeck();
        }
      })
      .catch((error: unknown) => {
        windowRef.alert(error instanceof Error ? error.message : String(error));
      });
  }
}
