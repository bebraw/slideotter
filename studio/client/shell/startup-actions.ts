import type { StudioClientElements } from "../core/elements.ts";
import type { StudioClientState } from "../core/state.ts";
import type { StudioClientAppTheme } from "./app-theme.ts";
import type { StudioClientCommandControls } from "./command-controls.ts";
import type { StudioClientGlobalEvents } from "./global-events.ts";
import type { StudioClientPreferences } from "./preferences.ts";

export namespace StudioClientStartupActions {
  type AppTheme = ReturnType<typeof StudioClientAppTheme.createAppTheme>;
  type CommandControlDeps = StudioClientCommandControls.CommandControlDeps;
  type GlobalEventDeps = StudioClientGlobalEvents.GlobalEventDeps;

  export type StartupNavigationShell = CommandControlDeps["navigationShell"]
    & GlobalEventDeps["navigationShell"];

  export type StartupActionsOptions = {
    commandControls: Omit<CommandControlDeps, "appTheme" | "elements" | "navigationShell" | "windowRef">;
    documentRef: Document;
    elements: StudioClientElements.Elements;
    exportMenu: GlobalEventDeps["exportMenu"];
    navigationShell: StartupNavigationShell;
    preferences: typeof StudioClientPreferences;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type StartupActions = {
    initializeTheme: () => Promise<void>;
    mountCommandControls: () => Promise<void>;
    mountGlobalEvents: () => Promise<void>;
  };

  export function createStartupActions({
    commandControls,
    documentRef,
    elements,
    exportMenu,
    navigationShell,
    preferences,
    state,
    windowRef
  }: StartupActionsOptions): StartupActions {
    let appThemePromise: Promise<AppTheme> | null = null;

    function loadAppTheme(): Promise<AppTheme> {
      appThemePromise ||= import("./app-theme.ts").then(({ StudioClientAppTheme }) => {
        return StudioClientAppTheme.createAppTheme({
          document: documentRef,
          elements,
          preferences,
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
}
