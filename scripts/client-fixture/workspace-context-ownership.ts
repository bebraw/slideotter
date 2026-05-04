import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const contextPayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/context-payload-state.ts"), "utf8");
const deckContextActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-actions.ts"), "utf8");
const deckContextFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-form.ts"), "utf8");
const deckContextWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-workbench.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const themeActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-actions.ts"), "utf8");
const workspaceRefreshActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/workspace-refresh-actions.ts"), "utf8");
const workspaceRefreshWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/workspace-refresh-workbench.ts"), "utf8");
const workspaceStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/workspace-state.ts"), "utf8");

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(navigationShellSource);
}

function clientModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

function validateClientWorkspaceContextOwnership(): void {
  assert(
    /namespace StudioClientDeckContextForm/.test(deckContextFormSource)
      && /function read/.test(deckContextFormSource)
      && /function apply/.test(deckContextFormSource)
      && /namespace StudioClientDeckContextWorkbench/.test(deckContextWorkbenchSource)
      && /StudioClientDeckContextForm\.apply\(windowRef\.document, elements, deck\)/.test(deckContextWorkbenchSource)
      && /StudioClientDeckContextForm\.read\(windowRef\.document, elements\)/.test(deckContextWorkbenchSource)
      && /import\("\.\/deck-context-workbench\.ts"\)/.test(deckContextActionsSource)
      && /import\("\.\.\/planning\/deck-context-form\.ts"\)/.test(themeActionsSource)
      && /const lazyWorkbench = StudioClientLazyWorkbench\.createLazyWorkbench/.test(deckContextActionsSource)
      && !clientModuleLoaded("planning/deck-context-workbench.ts")
      && !clientModuleLoaded("planning/deck-context-form.ts")
      && !/StudioClientDeckContextForm\.apply\(window\.document, elements, deck\)/.test(appSource)
      && !/StudioClientDeckContextForm\.read\(window\.document, elements\)/.test(appSource)
      && !/elements\.deckAudience\.value,\n\s+author: elements\.deckAuthor\.value/.test(appSource),
    "Deck context form mapping should live behind the deck context action split point"
  );
  assert(
    /namespace StudioClientWorkspaceState/.test(workspaceStateSource)
      && /type WorkspacePayload/.test(workspaceStateSource)
      && /function applyWorkspacePayload/.test(workspaceStateSource)
      && /StudioClientWorkspaceState\.applyWorkspacePayload\(state, payload, apiRoot, activePresentation\)/.test(workspaceRefreshWorkbenchSource)
      && /namespace StudioClientWorkspaceRefreshActions/.test(workspaceRefreshActionsSource)
      && /import\("\.\/workspace-refresh-workbench\.ts"\)/.test(workspaceRefreshActionsSource)
      && !clientModuleLazyLoaded("shell/workspace-refresh-workbench.ts")
      && !/StudioClientWorkspaceState\.applyWorkspacePayload\(state, payload, apiRoot, activePresentation\)/.test(appSource)
      && !/state\.assistant = payload\.assistant/.test(appSource)
      && !/state\.workflowHistory = runtimeHistory/.test(appSource),
    "Workspace payload application should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientContextPayloadState/.test(contextPayloadStateSource)
      && /function applyContextPayload/.test(contextPayloadStateSource)
      && /StudioClientContextPayloadState\.applyContextPayload\(state, payload\)/.test(themeActionsSource)
      && /StudioClientContextPayloadState\.applyContextPayload\(state, payload, \{ resetDeckStructure: true \}\)/.test(deckContextWorkbenchSource)
      && !/StudioClientContextPayloadState\.applyContextPayload\(state, payload, \{ resetDeckStructure: true \}\)/.test(appSource)
      && !/state\.context = payload\.context/.test(appSource),
    "Context response state updates should live outside the main app orchestrator"
  );
}

export { validateClientWorkspaceContextOwnership };
