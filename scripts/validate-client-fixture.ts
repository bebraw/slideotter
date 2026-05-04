import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { validateClientEndpointOwnership } from "./client-fixture/endpoint-ownership.ts";
import { validateClientExportPresentationModeOwnership } from "./client-fixture/export-presentation-mode-ownership.ts";
import { validateClientFileReaderOwnership } from "./client-fixture/file-reader-ownership.ts";
import { validateClientModuleBoundaries } from "./client-fixture/module-boundaries.ts";
import { validateClientPresentationCreationOwnership } from "./client-fixture/presentation-creation-ownership.ts";
import { validateClientPreviewOwnership } from "./client-fixture/preview-ownership.ts";
import { validateClientRenderingHygiene } from "./client-fixture/rendering-hygiene.ts";
import { validateClientRuntimeApiOwnership } from "./client-fixture/runtime-api-ownership.ts";
import { validateClientShellOwnership } from "./client-fixture/shell-ownership.ts";
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
const commandControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/command-controls.ts"), "utf8");
const contextPayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/context-payload-state.ts"), "utf8");
const contentRunActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/content-run-actions.ts"), "utf8");
const contentRunRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/content-run-rendering.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/platform/core.ts"), "utf8");
const customLayoutActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/custom-layout-actions.ts"), "utf8");
const customLayoutWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/custom-layout-workbench.ts"), "utf8");
const deckContextActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-actions.ts"), "utf8");
const deckContextFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-form.ts"), "utf8");
const deckContextWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-workbench.ts"), "utf8");
const deckStructurePreviewRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-structure-preview-rendering.ts"), "utf8");
const deckPlanningActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-planning-actions.ts"), "utf8");
const deckPlanningWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-planning-workbench.ts"), "utf8");
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
const slideLoadActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-actions.ts"), "utf8");
const slideLoadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-state.ts"), "utf8");
const slideLoadWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-workbench.ts"), "utf8");
const slideEditorActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-editor-actions.ts"), "utf8");
const slideEditorWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-editor-workbench.ts"), "utf8");
const inlineTextEditingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/inline-text-editing.ts"), "utf8");
const manualSlideFormRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/manual-slide-form-rendering.ts"), "utf8");
const materialPanelRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/material-panel-rendering.ts"), "utf8");
const slideSpecEditorActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-spec-editor-actions.ts"), "utf8");
const slideSpecPathSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-spec-path.ts"), "utf8");
const slideSelectionActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-selection-actions.ts"), "utf8");
const slideSelectionStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-selection-state.ts"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/state.ts"), "utf8");
const startupActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/startup-actions.ts"), "utf8");
const themeActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-actions.ts"), "utf8");
const urlStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/url-state.ts"), "utf8");
const validationSettingsFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-settings-form.ts"), "utf8");
const validationReportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report-workbench.ts"), "utf8");
const workspaceStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/workspace-state.ts"), "utf8");
const workflowActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/workflow-actions.ts"), "utf8");
const workflowWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/workflow-workbench.ts"), "utf8");
const workflowSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/workflows.ts"), "utf8");

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
validateClientEndpointOwnership();
validateClientExportPresentationModeOwnership();
validateClientFileReaderOwnership();
validateClientRenderingHygiene();
validateClientPresentationCreationOwnership();
validateClientPreviewOwnership();
validateClientRuntimeApiOwnership();
validateClientShellOwnership();
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
  /namespace StudioClientWorkflows/.test(workflowSource)
    && /function createWorkflowRunners/.test(workflowSource)
    && /function runSlideCandidate/.test(workflowSource)
    && /function runDeckStructure/.test(workflowSource)
    && /namespace StudioClientWorkflowWorkbench/.test(workflowWorkbenchSource)
    && /function createWorkflowWorkbench/.test(workflowWorkbenchSource)
    && /namespace StudioClientWorkflowActions/.test(workflowActionsSource)
    && /import\("\.\/workflow-workbench\.ts"\)/.test(workflowActionsSource)
    && !clientModuleLazyLoaded("runtime/workflow-workbench.ts")
    && /StudioClientWorkflows\.createWorkflowRunners/.test(workflowWorkbenchSource)
    && !/let workflowRunners: WorkflowRunners \| null = null/.test(appSource)
    && !/async function getWorkflowRunners/.test(appSource)
    && !/StudioClientWorkflows\.createWorkflowRunners/.test(appSource)
    && !clientModuleLazyLoaded("runtime/workflows.ts")
    && !clientModuleLoaded("runtime/workflows.ts"),
  "Shared candidate workflow runners and command wiring should live in a lazily loaded feature script"
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
  /ideateDeckStructure: workflowActions\.ideateDeckStructure/.test(appSource)
    && /ideateDeckStructure: \(\) => runners\.runDeckStructure\(\{/.test(workflowWorkbenchSource),
  "Deck-structure generation should use the shared deck workflow runner"
);
const deckStructureWorkflowFunction = workflowSource.match(/async function runDeckStructure\(\{ button, endpoint \}(?:: [^)]+)?\): Promise<void> \{[\s\S]*?\n    \}/);
assert(deckStructureWorkflowFunction, "Expected shared deck-structure workflow runner");
if (!deckStructureWorkflowFunction) {
  throw new Error("Expected shared deck-structure workflow runner");
}
assert(
  /candidateCount:\s*await getRequestedCandidateCount\(\)/.test(deckStructureWorkflowFunction[0]),
  "Deck-structure workflow should send the requested candidate count"
);
assert(
  /deckStructureAbortController/.test(workflowSource)
    && /deckStructureRequestSeq/.test(workflowSource)
    && /signal: abortController\.signal/.test(deckStructureWorkflowFunction[0]),
  "Deck-structure workflow should combine abort controllers with sequence guards"
);
assert(
  /function applyDeckStructurePayload\(payload(?:: [^)]+)?\)/.test(workflowSource)
    && /applyDeckStructurePayload\(payload\)/.test(deckStructureWorkflowFunction[0])
    && !/function applyDeckStructureWorkflowPayload\(payload\)/.test(appSource),
  "Deck-structure workflow payload application should live in the workflow runner module"
);
assert(
  /function runDeckStructure/.test(workflowSource)
    && /function runSlideCandidate/.test(workflowSource)
    && /postJson\(endpoint/.test(workflowSource),
  "Candidate workflow runners should use the shared JSON POST helper"
);
assert(
  /setDeckStructureCandidates: \(candidates: unknown\[\] \| undefined\)/.test(deckPlanningActionsSource)
    && !/state\.deckStructureCandidates = payload\.deckStructureCandidates/.test(appSource),
  "Deck-structure payload application should use the candidate selection helper"
);

["ideateSlide", "ideateTheme", "ideateStructure", "redoLayout"].forEach((functionName) => {
  const appPattern = new RegExp(`${functionName}: workflowActions\\.${functionName}`);
  const workbenchPattern = new RegExp(`${functionName}: \\(\\) => runners\\.runSlideCandidate\\(\\{`);
  assert(
    appPattern.test(appSource) && workbenchPattern.test(workflowWorkbenchSource),
    `${functionName} should use the shared slide candidate workflow runner`
  );
});

assert(
  /function applySlidePayload\(payload(?:: [^,]+)?, slideId(?:: [^)]+)?\)/.test(workflowSource)
    && /applySlidePayload\(payload, slideId\)/.test(workflowSource)
    && !/function applySlideWorkflowPayload\(payload, slideId\)/.test(appSource),
  "Slide workflow payload application should live in the workflow runner module"
);
assert(
  /slideLoadRequestSeq/.test(slideLoadWorkbenchSource)
    && /isCurrentAbortableRequest\(\s*state,\s*"slideLoadAbortController",\s*"slideLoadRequestSeq",\s*requestSeq,\s*abortController\s*\)/.test(slideLoadWorkbenchSource)
    && !/isCurrentAbortableRequest\(state, "slideLoadAbortController", "slideLoadRequestSeq", requestSeq, abortController\)/.test(appSource),
  "loadSlide should guard against stale slide responses"
);
assert(
  /namespace StudioClientUrlState/.test(urlStateSource)
    && /function getSlideParam/.test(urlStateSource)
    && /function setSlideParam/.test(urlStateSource)
    && /function getUrlSlideParam/.test(slideSelectionActionsSource)
    && /StudioClientUrlState\.getSlideParam\(windowRef\)/.test(slideSelectionActionsSource)
    && /StudioClientUrlState\.setSlideParam\(windowRef, slideId\)/.test(slideSelectionActionsSource)
    && !/function getUrlSlideParam/.test(appSource)
    && !/StudioClientUrlState\.getSlideParam\(window\)/.test(appSource)
    && !/StudioClientUrlState\.setSlideParam\(window, slideId\)/.test(appSource)
    && /namespace StudioClientSlideSelectionState/.test(slideSelectionStateSource)
    && /function resolveRequestedSlide/.test(slideSelectionStateSource)
    && /function getSlideByIndex/.test(slideSelectionStateSource)
    && /function syncSelectedSlideToActiveList/.test(slideSelectionStateSource)
    && /StudioClientSlideSelectionState\.getSlideByIndex\(state, index\)/.test(slideSelectionActionsSource)
    && /StudioClientSlideSelectionState\.syncSelectedSlideToActiveList\(state, getUrlSlideParam\(\)\)/.test(slideSelectionActionsSource)
    && !/StudioClientSlideSelectionState\.getSlideByIndex\(state, index\)/.test(appSource)
    && !/StudioClientSlideSelectionState\.syncSelectedSlideToActiveList\(state, getUrlSlideParam\(\)\)/.test(appSource),
  "Slide Studio should persist and restore the selected slide through the URL query"
);
assert(
  /slideLoadAbortController/.test(slideLoadWorkbenchSource)
    && /request(?:<[^>]+>)?\(`\/api\/v1\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(slideLoadWorkbenchSource)
    && /namespace StudioClientSlideLoadActions/.test(slideLoadActionsSource)
    && /import\("\.\/slide-load-workbench\.ts"\)/.test(slideLoadActionsSource)
    && !clientModuleLazyLoaded("editor/slide-load-workbench.ts")
    && !/request(?:<[^>]+>)?\(`\/api\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(appSource),
  "loadSlide should abort superseded slide requests"
);
assert(
  /namespace StudioClientSlideLoadState/.test(slideLoadStateSource)
    && /type SlidePayload/.test(slideLoadStateSource)
    && /function applySlidePayload/.test(slideLoadStateSource)
    && /StudioClientSlideLoadState\.applySlidePayload\(state, slideId, payload\)/.test(slideLoadWorkbenchSource)
    && !/StudioClientSlideLoadState\.applySlidePayload\(state, slideId, payload\)/.test(appSource)
    && !/state\.selectedSlideIndex = payload\.slide\.index/.test(appSource),
  "Loaded slide payload state updates should live outside the main app orchestrator"
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
  /slideWorkflowAbortController/.test(workflowSource)
    && /slideWorkflowRequestSeq/.test(workflowSource)
    && /signal: abortController\.signal/.test(workflowSource),
  "Slide candidate workflows should combine abort controllers with sequence guards"
);
assert(
  /isAbortError/.test(coreSource)
    && /StudioClientCore\.isAbortError/.test(workflowActionsSource)
    && !/isAbortError/.test(appSource),
  "Expected shared abort error helper to be wired in workflow actions"
);
assert(
  /function beginAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, requestSeqKey(?:: [^)]+)?\)/.test(stateSource)
    && /function isCurrentAbortableRequest\(\s*state(?:: [^,]+)?,\s*controllerKey(?:: [^,]+)?,\s*requestSeqKey(?:: [^,]+)?,\s*requestSeq(?:: [^,]+)?,\s*abortController(?:: [^)]+)?\s*\)/.test(stateSource)
    && /function clearAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, abortController(?:: [^)]+)?\)/.test(stateSource)
    && /beginAbortableRequest\(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq"\)/.test(workflowSource),
  "Abortable workflow guards should use shared request guard helpers"
);

assert(/function createDomElement\(tagName/.test(coreSource), "Expected small DOM element builder helper");
assert(
  /namespace StudioClientSlideEditorWorkbench/.test(slideEditorWorkbenchSource)
    && /function createSlideEditorWorkbench/.test(slideEditorWorkbenchSource)
    && /function renderSlideFields/.test(slideEditorWorkbenchSource)
    && /function beginInlineTextEdit/.test(inlineTextEditingSource)
    && /function parseSlideSpecEditor/.test(slideSpecEditorActionsSource)
    && /function renderMaterials/.test(materialPanelRenderingSource)
    && /async function createSystemSlide/.test(slideEditorWorkbenchSource)
    && /async function deleteSlideFromDeck/.test(slideEditorWorkbenchSource)
    && /function mount\(\)/.test(slideEditorWorkbenchSource)
    && /from "\.\/slide-editor-workbench\.ts"/.test(slideEditorActionsSource)
    && /StudioClientSlideEditorActions\.createSlideEditorWorkbench/.test(appSource)
    && /StudioClientSlideEditorWorkbench\.createSlideEditorWorkbench/.test(slideEditorActionsSource)
    && /StudioClientCore\.formatSourceCodeNodes/.test(slideEditorActionsSource)
    && /slideEditorWorkbench\.mount\(\);/.test(commandControlsSource)
    && !/function beginInlineTextEdit/.test(appSource)
    && !/async function saveSlideSpec/.test(appSource)
    && !/async function createSystemSlide/.test(appSource)
    && !/async function attachMaterialToSlide/.test(appSource)
    && !/function getSelectedSlideMaterialId/.test(appSource),
  "Current-slide editing, inline edit, JSON editor, manual slide, and material actions should live in the slide editor workbench"
);
assert(
  /function updateStructuredDraftFromInlineEdit/.test(inlineTextEditingSource)
    && /element\.addEventListener\("input", handleInput\)/.test(inlineTextEditingSource)
    && /Previewing inline text edits/.test(inlineTextEditingSource),
  "Inline slide text editing should keep the structured draft JSON synchronized before save"
);
assert(
  /namespace StudioClientSlideSpecPath/.test(slideSpecPathSource)
    && /function pathToArray/.test(slideSpecPathSource)
    && /function getPathValue/.test(slideSpecPathSource)
    && /function cloneWithPath/.test(slideSpecPathSource)
    && /StudioClientSlideSpecPath\.getPathValue/.test(slideEditorWorkbenchSource)
    && /StudioClientSlideSpecPath\.cloneWithPath/.test(inlineTextEditingSource),
  "Slide spec path parsing and cloning should live in pure editor helpers"
);
assert(
  /Add after current slide/.test(indexSource)
    && /Add as subslide in vertical stack/.test(indexSource)
    && /Create subslide/.test(manualSlideFormRenderingSource),
  "Slide Studio should expose subslide creation through the manual slide form"
);
assert(
  /namespace StudioClientDeckPlanningWorkbench/.test(deckPlanningWorkbenchSource)
    && /function createDeckPlanningWorkbench/.test(deckPlanningWorkbenchSource)
    && /function renderDeckStructureCandidates/.test(deckPlanningWorkbenchSource)
    && /function renderDeckLengthPlan/.test(deckPlanningWorkbenchSource)
    && /function renderOutlinePlans/.test(deckPlanningWorkbenchSource)
    && /function renderSources/.test(deckPlanningWorkbenchSource)
    && /async function applyDeckStructureCandidate/.test(deckPlanningWorkbenchSource)
    && /async function generateOutlinePlan/.test(deckPlanningWorkbenchSource)
    && /async function addSource/.test(deckPlanningWorkbenchSource)
    && /function mount\(\)/.test(deckPlanningWorkbenchSource)
    && /import\("\.\/deck-planning-workbench\.ts"\)/.test(deckPlanningActionsSource)
    && !clientModuleLazyLoaded("planning/deck-planning-workbench.ts")
    && /async function getWorkbench/.test(deckPlanningActionsSource)
    && !/async function getDeckPlanningWorkbench/.test(appSource)
    && /onOutlineOpen: deckPlanningActions\.load/.test(appSource)
    && /mount: \(workbench\) => workbench\.mount\(\)/.test(deckPlanningActionsSource)
    && !clientModuleLoaded("planning/deck-planning-workbench.ts")
    && !/function buildDeckDiffSupport/.test(appSource)
    && !/function renderOutlinePlanComparison/.test(appSource)
    && !/async function applyDeckStructureCandidate/.test(appSource)
    && !/async function addSource/.test(appSource),
  "Deck planning, outline plans, deck length, and source-library actions should live in the deck planning workbench"
);
assert(
  /function renderDeckStructureStripCompare/.test(deckStructurePreviewRenderingSource)
    && /function renderDeckStructurePreviewHints/.test(deckStructurePreviewRenderingSource)
    && /renderDeckStructureStripCompare/.test(deckPlanningWorkbenchSource)
    && /renderDeckStructurePreviewHints/.test(deckPlanningWorkbenchSource)
    && !/deck-structure-preview-card/.test(deckPlanningWorkbenchSource),
  "Deck structure preview rendering should stay in a focused planning helper"
);
console.log("Client fixture validation passed.");
