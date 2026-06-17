import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const contextPayloadStateSource = readClientSource("api/context-payload-state.ts");
const deckContextActionsSource = readClientSource("planning/deck-context-actions.ts");
const deckContextFormSource = readClientSource("planning/deck-context-form.ts");
const deckContextWorkbenchSource = readClientSource("planning/deck-context-workbench.ts");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const themeActionsSource = readClientSource("creation/theme-actions.ts");
const workspaceRefreshActionsSource = readClientSource("shell/workspace-refresh-actions.ts");
const workspaceRefreshWorkbenchSource = readClientSource("shell/workspace-refresh-workbench.ts");
const workspaceStateSource = readClientSource("api/workspace-state.ts");
const eagerLoadSources = [mainSource, appSource, navigationShellSource];

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
      && !clientModuleLoaded("planning/deck-context-workbench.ts", eagerLoadSources)
      && !clientModuleLoaded("planning/deck-context-form.ts", eagerLoadSources)
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
      && !clientModuleLazyLoaded("shell/workspace-refresh-workbench.ts", appSource)
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
