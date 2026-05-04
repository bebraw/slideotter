import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { validateClientDeckPlanningOwnership } from "./client-fixture/deck-planning-ownership.ts";
import { validateClientEndpointOwnership } from "./client-fixture/endpoint-ownership.ts";
import { validateClientExportPresentationModeOwnership } from "./client-fixture/export-presentation-mode-ownership.ts";
import { validateClientFileReaderOwnership } from "./client-fixture/file-reader-ownership.ts";
import { validateClientModuleBoundaries } from "./client-fixture/module-boundaries.ts";
import { validateClientPresentationCreationOwnership } from "./client-fixture/presentation-creation-ownership.ts";
import { validateClientPreviewOwnership } from "./client-fixture/preview-ownership.ts";
import { validateClientRenderingHygiene } from "./client-fixture/rendering-hygiene.ts";
import { validateClientRuntimeApiOwnership } from "./client-fixture/runtime-api-ownership.ts";
import { validateClientShellOwnership } from "./client-fixture/shell-ownership.ts";
import { validateClientSlideEditorOwnership } from "./client-fixture/slide-editor-ownership.ts";
import { validateClientThemeOwnership } from "./client-fixture/theme-ownership.ts";
import { validateClientVariantOwnership } from "./client-fixture/variant-ownership.ts";
const require = createRequire(import.meta.url);

const { assert, readClientCss } = require("./fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const exportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/export-workbench.ts"), "utf8");
const assistantActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/assistant-actions.ts"), "utf8");
const assistantWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/assistant-workbench.ts"), "utf8");
const buildValidationActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/build-validation-actions.ts"), "utf8");
const buildValidationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/build-validation-workbench.ts"), "utf8");
const checkRemediationStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/check-remediation-state.ts"), "utf8");
const contextPayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/context-payload-state.ts"), "utf8");
const contentRunActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/content-run-actions.ts"), "utf8");
const contentRunRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/content-run-rendering.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/platform/core.ts"), "utf8");
const customLayoutActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/custom-layout-actions.ts"), "utf8");
const customLayoutWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/custom-layout-workbench.ts"), "utf8");
const deckContextActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-actions.ts"), "utf8");
const deckContextFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-form.ts"), "utf8");
const deckContextWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-workbench.ts"), "utf8");
const elementsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/elements.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const presentationCreationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-workbench.ts"), "utf8");
const presentationLibraryActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-library-actions.ts"), "utf8");
const presentationLibrarySource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-library.ts"), "utf8");
const preferencesSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/preferences.ts"), "utf8");
const runtimePayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/runtime-payload-state.ts"), "utf8");
const workspaceRefreshActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/workspace-refresh-actions.ts"), "utf8");
const workspaceRefreshWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/workspace-refresh-workbench.ts"), "utf8");
const presentationScriptSource = fs.readFileSync(path.join(process.cwd(), "studio/rendering/presentation-script.ts"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/state.ts"), "utf8");
const startupActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/startup-actions.ts"), "utf8");
const themeActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-actions.ts"), "utf8");
const validationSettingsFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-settings-form.ts"), "utf8");
const validationReportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report-workbench.ts"), "utf8");
const workspaceStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/workspace-state.ts"), "utf8");
const stylesSource = readClientCss();

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

validateClientModuleBoundaries();
validateClientDeckPlanningOwnership();
validateClientEndpointOwnership();
validateClientExportPresentationModeOwnership();
validateClientFileReaderOwnership();
validateClientRenderingHygiene();
validateClientPresentationCreationOwnership();
validateClientPreviewOwnership();
validateClientRuntimeApiOwnership();
validateClientShellOwnership();
validateClientSlideEditorOwnership();
validateClientThemeOwnership();
validateClientVariantOwnership();


assert(
  /namespace StudioClientCore/.test(coreSource)
    && /function errorMessage/.test(coreSource)
    && /import \{ StudioClientCore \} from "\.\.\/platform\/core\.ts";/.test(elementsSource)
    && !/import \{ StudioClientCore \}/.test(appSource),
  "Studio client core helpers should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientState/.test(stateSource)
    && /function createInitialState\(\)/.test(stateSource)
    && /const state: StudioClientState\.State = StudioClientState\.createInitialState\(\);/.test(appSource)
    && clientModuleLoaded("core/state.ts"),
  "Initial studio state should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /data-drawer-label="Theme"/.test(indexSource)
    && /data-drawer-label="Context"/.test(indexSource)
    && /data-drawer-label="Layout"/.test(indexSource)
    && /data-drawer-label="Diagnostics"/.test(indexSource)
    && /data-drawer-label="Structured Draft"/.test(indexSource)
    && /data-drawer-label="Assistant"/.test(indexSource)
    && /content: attr\(data-drawer-label\)/.test(stylesSource)
    && /\.structured-draft-drawer:not\(\[data-open="true"\]\) \.structured-draft-toggle:hover::after/.test(stylesSource)
    && /transition: opacity 150ms ease, transform 180ms ease/.test(stylesSource),
  "Drawer rail icons should expose stable animated hover labels"
);
assert(
  /namespace StudioClientPreferences/.test(preferencesSource)
    && /function loadDrawerOpen\(key(?:: [^)]+)?\)/.test(preferencesSource)
    && /function loadAppTheme\(\)/.test(preferencesSource)
    && /from "\.\/preferences\.ts"/.test(navigationShellSource)
    && /from "\.\/preferences\.ts"/.test(startupActionsSource)
    && !clientModuleLoaded("shell/preferences.ts")
    && /preferences\.loadCurrentPage\(\)/.test(navigationShellSource),
  "Local preference helpers should live in shell modules instead of the main app orchestrator"
);
assert(
  /function mountContentRunControls/.test(contentRunActionsSource)
    && /function renderContentRun/.test(contentRunRenderingSource)
    && /function renderStudioContentRunPanel/.test(contentRunRenderingSource)
    && /data-content-run-retry-slide/.test(contentRunActionsSource)
    && /data-studio-content-run-retry/.test(contentRunActionsSource)
    && /contentRunRetrySlide/.test(contentRunRenderingSource)
    && /studioContentRunRetry/.test(contentRunRenderingSource)
    && !/id="content-run-rail"/.test(indexSource)
    && !/data-content-run-slide/.test(presentationCreationWorkbenchSource)
    && !clientModuleLoaded("content-run-actions.ts")
    && !/StudioClientContentRunActions/.test(appSource),
  "Live content-run rendering and action handling should avoid a duplicate static slide rail"
);
assert(
  /\(\(coordinate\.x - 1 \+ delta \+ maxX\) % maxX\) \+ 1/.test(presentationScriptSource),
  "Presentation mode horizontal keyboard navigation should wrap from first to last slide and back"
);
assert(
  /presentationDetourUp/.test(presentationScriptSource)
    && /presentationDetourDown/.test(presentationScriptSource)
    && /clamp\(coordinate\.y \+ delta, 0, maxYForX\(coordinate\.x\)\)/.test(presentationScriptSource)
    && /data-presentation-detour-up="true"/.test(stylesSource)
    && /data-presentation-detour-down="true"/.test(stylesSource),
  "Presentation mode should expose vertical detour affordances and clamp vertical keyboard movement for 2D decks"
);
assert(
  /namespace StudioClientAssistantWorkbench/.test(assistantWorkbenchSource)
    && /function createAssistantWorkbench/.test(assistantWorkbenchSource)
    && /function render\(\)/.test(assistantWorkbenchSource)
    && /function renderSelection\(\)/.test(assistantWorkbenchSource)
    && /async function sendMessage\(\)/.test(assistantWorkbenchSource)
    && /postJson\("\/api\/v1\/assistant\/message"/.test(assistantWorkbenchSource)
    && /function mount\(\)/.test(assistantWorkbenchSource)
    && /import\("\.\/assistant-workbench\.ts"\)/.test(assistantActionsSource)
    && !clientModuleLazyLoaded("creation/assistant-workbench.ts")
    && /async function getWorkbench/.test(assistantActionsSource)
    && !/async function getAssistantWorkbench/.test(appSource)
    && /onAssistantOpen: assistantActions\.load/.test(appSource)
    && /mount: \(workbench\) => workbench\.mount\(\)/.test(assistantActionsSource)
    && !clientModuleLoaded("creation/assistant-workbench.ts")
    && !/postJson\("\/api\/assistant\/message"/.test(appSource)
    && !/const session = state\.assistant\.session/.test(appSource),
  "Assistant rendering and message application should live in the lazily loaded assistant workbench"
);
assert(
  /namespace StudioClientPresentationLibrary/.test(presentationLibrarySource)
    && /function createPresentationLibrary/.test(presentationLibrarySource)
    && /function render/.test(presentationLibrarySource)
    && /function resetSelection/.test(presentationLibrarySource)
    && /async function selectPresentation/.test(presentationLibrarySource)
    && /openStudio\?: boolean/.test(presentationLibrarySource)
    && /const shouldOpenStudio = options\.openStudio === true/.test(presentationLibrarySource)
    && /setCurrentPage\("studio"\)/.test(presentationLibrarySource)
    && /event\.detail > 1/.test(presentationLibrarySource)
    && !/comparePresentationUpdatedAt/.test(presentationLibrarySource)
    && !/\.sort\([\s\S]*activePresentationId/.test(presentationLibrarySource)
    && /async function duplicatePresentation/.test(presentationLibrarySource)
    && /async function regeneratePresentation/.test(presentationLibrarySource)
    && /async function deletePresentation/.test(presentationLibrarySource)
    && /import\("\.\/presentation-library\.ts"\)/.test(presentationLibraryActionsSource)
    && !clientModuleLazyLoaded("creation/presentation-library.ts")
    && /async function getLoadedWorkbench/.test(presentationLibraryActionsSource)
    && !/async function getPresentationLibrary/.test(appSource)
    && !/function renderPresentationLibrary/.test(appSource)
    && !clientModuleLoaded("creation/presentation-library.ts")
    && !/function renderPresentations/.test(appSource)
    && !/async function selectPresentation/.test(appSource)
    && !/async function duplicatePresentation/.test(appSource)
    && !/async function regeneratePresentation/.test(appSource)
    && !/async function deletePresentation/.test(appSource),
  "Presentation list rendering and library actions should live in the presentation library script"
);
assert(
  /namespace StudioClientCustomLayoutWorkbench/.test(customLayoutWorkbenchSource)
    && /function createCustomLayoutWorkbench/.test(customLayoutWorkbenchSource)
    && /function renderEditor/.test(customLayoutWorkbenchSource)
    && /function renderLibrary/.test(customLayoutWorkbenchSource)
    && /function renderLayoutStudio/.test(customLayoutWorkbenchSource)
    && /async function previewCustomLayout/.test(customLayoutWorkbenchSource)
    && /async function applySavedLayout/.test(customLayoutWorkbenchSource)
    && /class="layout-studio-details"/.test(indexSource)
    && !/id="show-layout-studio-page"/.test(indexSource)
    && !/id="layout-studio-page"/.test(indexSource)
    && /import\("\.\/custom-layout-workbench\.ts"\)/.test(customLayoutActionsSource)
    && !clientModuleLazyLoaded("creation/custom-layout-workbench.ts")
    && /async function getLoadedWorkbench/.test(customLayoutActionsSource)
    && /function getLivePreviewSlideSpec/.test(customLayoutActionsSource)
    && /mount: load/.test(customLayoutActionsSource)
    && !/async function getCustomLayoutWorkbench/.test(appSource)
    && !/const customLayoutWorkbenchProxy/.test(appSource)
    && /mount: \(workbench\) => workbench\.mount\(\)/.test(customLayoutActionsSource)
    && !clientModuleLoaded("creation/custom-layout-workbench.ts")
    && !/function renderLayoutLibrary/.test(appSource)
    && !/function renderLayoutStudio/.test(appSource)
    && !/async function previewCustomLayout/.test(appSource)
    && !/async function quickCustomLayout/.test(appSource)
    && !/async function previewLayoutStudioDesign/.test(appSource)
    && !/async function applySavedLayout/.test(appSource)
    && !/async function importLayoutJson/.test(appSource),
  "Custom layout editor, integrated layout library rendering, layout actions, and custom preview actions should live in the workbench script"
);
assert(
  /function requiredElement\(id: string\): HTMLElement \{[\s\S]*?document\.getElementById\(id\)/.test(coreSource),
  "requiredElement should be the single fail-fast DOM id lookup helper"
);
assert(
  /namespace StudioClientElements/.test(elementsSource)
    && /createElements\(core: ElementCore = StudioClientCore\)/.test(elementsSource)
    && /const elements: StudioClientElements\.Elements = StudioClientElements\.createElements\(\);/.test(appSource)
    && clientModuleLoaded("core/elements.ts"),
  "Studio element registry should live in a separate module loaded through main.ts before app.ts"
);
assert(/function postJson<TBody = unknown, TResponse = unknown>\(url: string, body: TBody, options/.test(coreSource), "Expected shared JSON POST request helper");
assert(
  /function highlightJsonSource\(source: unknown\)/.test(coreSource)
    && /function formatSourceCode\(source: unknown, format = "plain"\)/.test(coreSource)
    && !/function highlightJsonSource\(source\)/.test(appSource),
  "Shared source formatting helpers should live in the core module"
);
assert(
  /function optionalElement\(id: string\): HTMLElement \| null \{[\s\S]*?document\.getElementById\(id\)/.test(coreSource),
  "optionalElement should be the nullable DOM id lookup helper"
);
assert(
  !/:\s*document\.getElementById\("/.test(appSource)
    && !/:\s*document\.getElementById\("/.test(elementsSource),
  "Central element registry should use requiredElement or optionalElement"
);

assert(
  /namespace StudioClientCheckRemediationState/.test(checkRemediationStateSource)
    && /function getSlideIdForIssue/.test(checkRemediationStateSource)
    && /function applyPayload/.test(checkRemediationStateSource)
    && /StudioClientCheckRemediationState\.getSlideIdForIssue\(state, issue\)/.test(validationReportWorkbenchSource)
    && /StudioClientCheckRemediationState\.applyPayload\(state, payload, slideId\)/.test(validationReportWorkbenchSource)
    && !/StudioClientCheckRemediationState\.getSlideIdForIssue\(state, issue\)/.test(appSource)
    && !/StudioClientCheckRemediationState\.applyPayload\(state, payload, slideId\)/.test(appSource),
  "Check remediation state updates should live inside the lazy validation report workbench"
);
assert(
  /namespace StudioClientValidationSettingsForm/.test(validationSettingsFormSource)
    && /function apply/.test(validationSettingsFormSource)
    && /function read/.test(validationSettingsFormSource)
    && /StudioClientValidationSettingsForm\.apply\(documentRef, elements, deck\.validationSettings \|\| \{\}\)/.test(deckContextFormSource)
    && /StudioClientValidationSettingsForm\.read\(documentRef, elements\)/.test(buildValidationWorkbenchSource)
    && /namespace StudioClientBuildValidationActions/.test(buildValidationActionsSource)
    && /import\("\.\/build-validation-workbench\.ts"\)/.test(buildValidationActionsSource)
    && !clientModuleLazyLoaded("runtime/build-validation-workbench.ts")
    && !/StudioClientValidationSettingsForm\.read\(window\.document, elements\)/.test(appSource)
    && !/function getValidationRuleSelects/.test(appSource),
  "Validation settings form state should live outside the main app orchestrator"
);
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
  /namespace StudioClientRuntimePayloadState/.test(runtimePayloadStateSource)
    && /function applyBuildPayload/.test(runtimePayloadStateSource)
    && /function applyValidationPayload/.test(runtimePayloadStateSource)
    && /function applyRuntimePayload/.test(runtimePayloadStateSource)
    && /StudioClientRuntimePayloadState\.applyBuildPayload\(state, payload\)/.test(buildValidationWorkbenchSource)
    && /StudioClientRuntimePayloadState\.applyValidationPayload\(state, payload\)/.test(buildValidationWorkbenchSource)
    && /StudioClientRuntimePayloadState\.applyRuntimePayload\(state, payload\)/.test(exportWorkbenchSource)
    && !/StudioClientRuntimePayloadState\.applyBuildPayload\(state, payload\)/.test(appSource)
    && !/StudioClientRuntimePayloadState\.applyValidationPayload\(state, payload\)/.test(appSource)
    && !/state\.previews = payload\.previews/.test(appSource),
  "Runtime/build/validation response state updates should live outside the main app orchestrator"
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
assert(
  /function beginAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, requestSeqKey(?:: [^)]+)?\)/.test(stateSource)
    && /function isCurrentAbortableRequest\(\s*state(?:: [^,]+)?,\s*controllerKey(?:: [^,]+)?,\s*requestSeqKey(?:: [^,]+)?,\s*requestSeq(?:: [^,]+)?,\s*abortController(?:: [^)]+)?\s*\)/.test(stateSource)
    && /function clearAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, abortController(?:: [^)]+)?\)/.test(stateSource),
  "Abortable workflow guards should use shared request guard helpers"
);

assert(/function createDomElement\(tagName/.test(coreSource), "Expected small DOM element builder helper");
console.log("Client fixture validation passed.");
