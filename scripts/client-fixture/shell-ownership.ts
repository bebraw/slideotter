import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const commandControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/command-controls.ts"), "utf8");
const drawerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/drawers.ts"), "utf8");
const globalEventsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/global-events.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const startupActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/startup-actions.ts"), "utf8");

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(navigationShellSource);
}

function startupModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(startupActionsSource);
}

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
      && clientModuleLoaded("shell/navigation-shell.ts")
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
      && startupModuleLazyLoaded("global-events.ts")
      && !clientModuleLoaded("shell/global-events.ts")
      && !/function mountGlobalEvents/.test(appSource)
      && !/window\.document\.addEventListener\("click"/.test(appSource),
    "Global document event bindings should live outside the main app orchestrator behind a split point"
  );
  assert(
    /namespace StudioClientCommandControls/.test(commandControlsSource)
      && /function mountCommandControls/.test(commandControlsSource)
      && /StudioClientCommandControls\.mountCommandControls/.test(startupActionsSource)
      && startupModuleLazyLoaded("command-controls.ts")
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
