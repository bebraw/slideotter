import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const commandControlsSource = readClientSource("shell/command-controls.ts");
const drawerSource = readClientSource("shell/drawers.ts");
const globalEventsSource = readClientSource("shell/global-events.ts");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const startupActionsSource = readClientSource("shell/startup-actions.ts");
const eagerLoadSources = [mainSource, appSource, navigationShellSource];

function validateClientShellOwnership(): void {
  assert(
    /namespace StudioClientDrawers/.test(drawerSource)
      && /createDrawerController/.test(drawerSource)
      && /from "\.\/drawers\.ts"/.test(navigationShellSource),
    "Drawer controller behavior should live in the shell slice and load through navigation shell"
  );
  assert(
    /namespace StudioClientNavigationShell/.test(navigationShellSource)
      && /function createNavigationShell/.test(navigationShellSource)
      && /const drawerConfigs = \{/.test(navigationShellSource)
      && /function renderPages\(\)/.test(navigationShellSource)
      && /function setCurrentPage\(page(?:: [^)]+)?\)/.test(navigationShellSource)
      && /function mountGlobalEvents\(\)/.test(navigationShellSource)
      && clientModuleLoaded("shell/navigation-shell.ts", eagerLoadSources)
      && /navigationShell = StudioClientNavigationShell\.createNavigationShell/.test(appSource)
      && /navigationShell\.mount\(\);/.test(commandControlsSource)
      && /navigationShell\.mountGlobalEvents\(\);/.test(globalEventsSource)
      && /navigationShell\.initializeState\(\);/.test(startupActionsSource)
      && !/const drawerConfigs = \{/.test(appSource)
      && !/StudioClientDrawers\.createDrawerController/.test(appSource)
      && !/StudioClientPreferences\.loadCurrentPage\(\)/.test(appSource)
      && !/showPresentationsPageButton\.addEventListener\("click"/.test(appSource),
    "Page routing, drawer registry, drawer toggles, and global shell events should live in the navigation shell"
  );
  ["assistant", "context", "debug", "layout", "structuredDraft", "theme"].forEach((drawerKey) => {
    assert(
      new RegExp(`\\n      ${drawerKey}: \\{`).test(navigationShellSource),
      `Drawer registry should define ${drawerKey}`
    );
  });
  assert(
    /drawerController\.setOpen\("assistant", open\)/.test(navigationShellSource)
      && /drawerController\.renderAll\(\)/.test(navigationShellSource)
      && !/function renderAssistantDrawer/.test(appSource),
    "Drawer behavior should flow through shared bulk render and setter helpers"
  );
  assert(
    /function closePeers\(openKey(?:: [^)]+)?\)/.test(drawerSource) && /function persistPreference\(key(?:: [^)]+)?\)/.test(drawerSource),
    "Drawer registry should centralize mutual exclusion and preference persistence"
  );
  assert(
    /namespace StudioClientGlobalEvents/.test(globalEventsSource)
      && /function mountGlobalEvents/.test(globalEventsSource)
      && /documentRef\.addEventListener\("click"/.test(globalEventsSource)
      && /StudioClientGlobalEvents\.mountGlobalEvents/.test(startupActionsSource)
      && clientModuleLazyLoaded("global-events.ts", startupActionsSource)
      && !clientModuleLoaded("shell/global-events.ts", eagerLoadSources)
      && !/function mountGlobalEvents/.test(appSource)
      && !/window\.document\.addEventListener\("click"/.test(appSource),
    "Global document event bindings should live outside the main app orchestrator behind a split point"
  );
  assert(
    /namespace StudioClientCommandControls/.test(commandControlsSource)
      && /function mountCommandControls/.test(commandControlsSource)
      && /StudioClientCommandControls\.mountCommandControls/.test(startupActionsSource)
      && clientModuleLazyLoaded("command-controls.ts", startupActionsSource)
      && /elements\.ideateSlideButton\.addEventListener/.test(commandControlsSource)
      && !/elements\.ideateSlideButton\.addEventListener/.test(appSource),
    "Studio command control event bindings should live outside the main app orchestrator"
  );
  assert(
    /export function initializeStudioClient/.test(startupActionsSource)
      && /StudioClientStartupActions\.initializeStudioClient/.test(appSource)
      && /startupActions\.mountCommandControls\(\)/.test(startupActionsSource)
      && /runtimeStatusActions\.connectRuntimeStream\(\)/.test(startupActionsSource),
    "Studio client startup should flow through an explicit shell initializer"
  );
}

export { validateClientShellOwnership };
