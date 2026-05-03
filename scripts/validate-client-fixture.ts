const fs = require("fs");
const path = require("path");
const { assert, readClientCss } = require("./fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const apiExplorerStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/api-explorer-state.ts"), "utf8");
const artifactDownloadSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/artifact-download.ts"), "utf8");
const exportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/export-workbench.ts"), "utf8");
const apiExplorerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/api-explorer.ts"), "utf8");
const appThemeSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/app-theme.ts"), "utf8");
const assistantWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/assistant-workbench.ts"), "utf8");
const buildValidationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/build-validation-workbench.ts"), "utf8");
const candidateCountSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/candidate-count.ts"), "utf8");
const checkRemediationStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/check-remediation-state.ts"), "utf8");
const commandControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/command-controls.ts"), "utf8");
const contextPayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/context-payload-state.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/core.ts"), "utf8");
const creationThemeStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/creation-theme-state.ts"), "utf8");
const customLayoutWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/custom-layout-workbench.ts"), "utf8");
const deckContextFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-form.ts"), "utf8");
const deckPlanningWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-planning-workbench.ts"), "utf8");
const domPreviewStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/dom-preview-state.ts"), "utf8");
const domPreviewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/dom-preview-workbench.ts"), "utf8");
const drawerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/drawers.ts"), "utf8");
const elementsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/elements.ts"), "utf8");
const exportMenuSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/export-menu.ts"), "utf8");
const fileReaderSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/file-reader.ts"), "utf8");
const globalEventsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/global-events.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const lazyWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/lazy-workbench.ts"), "utf8");
const llmStatusSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/llm-status.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const presentationCreationControlSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-control.ts"), "utf8");
const presentationCreationStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-state.ts"), "utf8");
const presentationCreationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-workbench.ts"), "utf8");
const presentationLibrarySource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-library.ts"), "utf8");
const presentationModeControlSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-control.ts"), "utf8");
const presentationModeStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-state.ts"), "utf8");
const presentationModeWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-workbench.ts"), "utf8");
const preferencesSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/preferences.ts"), "utf8");
const previewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/preview-workbench.ts"), "utf8");
const runtimeStatusWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/runtime-status-workbench.ts"), "utf8");
const runtimePayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/runtime-payload-state.ts"), "utf8");
const slideDomSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/slide-dom.ts"), "utf8");
const slideLoadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-state.ts"), "utf8");
const slideLoadWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-workbench.ts"), "utf8");
const slidePreviewSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/slide-preview.ts"), "utf8");
const slideEditorWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-editor-workbench.ts"), "utf8");
const slideSelectionStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-selection-state.ts"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/state.ts"), "utf8");
const themeCandidateStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-candidate-state.ts"), "utf8");
const themeActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-actions.ts"), "utf8");
const themeFieldStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-field-state.ts"), "utf8");
const themeWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-workbench.ts"), "utf8");
const urlStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/url-state.ts"), "utf8");
const validationReportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report-workbench.ts"), "utf8");
const validationReportSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report.ts"), "utf8");
const validationSettingsFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-settings-form.ts"), "utf8");
const variantGenerationControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-generation-controls.ts"), "utf8");
const variantReviewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-review-workbench.ts"), "utf8");
const variantStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-state.ts"), "utf8");
const workspaceStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/workspace-state.ts"), "utf8");
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

function appCreatesMountedLazyWorkbench(instanceName: string, typeName: string): boolean {
  const escapedInstanceName = instanceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTypeName = typeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `const ${escapedInstanceName} = StudioClientLazyWorkbench\\.createLazyWorkbench<${escapedTypeName}>\\(\\{[\\s\\S]*?mount: \\(workbench\\) => workbench\\.mount\\(\\)\\s*\\}\\);`
  ).test(appSource);
}

assert(
  /<script type="module" src="\/main\.ts"><\/script>/.test(indexSource)
    && clientModuleLoaded("app.ts"),
  "Studio client should load through the Vite module entrypoint"
);

assert(
  /namespace StudioClientCore/.test(coreSource)
    && /function errorMessage/.test(coreSource)
    && clientModuleLoaded("core/core.ts"),
  "Studio client core helpers should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientLazyWorkbench/.test(lazyWorkbenchSource)
    && /function createLazyWorkbench/.test(lazyWorkbenchSource)
    && /function renderLoadedOrLoad/.test(lazyWorkbenchSource)
    && /loadPromise/.test(lazyWorkbenchSource)
    && /mounted/.test(lazyWorkbenchSource)
    && /StudioClientLazyWorkbench\.createLazyWorkbench/.test(appSource)
    && /StudioClientLazyWorkbench\.renderLoadedOrLoad/.test(appSource)
    && clientModuleLoaded("core/lazy-workbench.ts"),
  "Lazy workbench loading and render-gateway behavior should live in the shared lazy workbench helper"
);
assert(
  /namespace StudioClientState/.test(stateSource)
    && /function createInitialState\(\)/.test(stateSource)
    && /const state: StudioClientState\.State = StudioClientState\.createInitialState\(\);/.test(appSource)
    && clientModuleLoaded("core/state.ts"),
  "Initial studio state should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientDomPreviewState/.test(domPreviewStateSource)
    && /function getCurrentTheme/.test(domPreviewStateSource)
    && /function getVariantVisualTheme/.test(domPreviewStateSource)
    && /function getWindowCurrentTheme/.test(domPreviewStateSource)
    && /function getWindowVariantVisualTheme/.test(domPreviewStateSource)
    && /function setFromPayload/.test(domPreviewStateSource)
    && /function patchSlideSpec/.test(domPreviewStateSource)
    && /function getSlideSpec/.test(domPreviewStateSource)
    && clientModuleLoaded("preview/dom-preview-workbench.ts")
    && /from "\.\/dom-preview-state\.ts"/.test(domPreviewWorkbenchSource)
    && /StudioClientDomPreviewState\.getWindowCurrentTheme\(state, windowRef\)/.test(domPreviewWorkbenchSource)
    && /StudioClientDomPreviewState\.getWindowVariantVisualTheme\(state, windowRef, variant\)/.test(domPreviewWorkbenchSource)
    && !/StudioClientDomPreviewState\.getWindowCurrentTheme\(state, window\)/.test(appSource)
    && !/StudioClientDomPreviewState\.getWindowVariantVisualTheme\(state, window, variant\)/.test(appSource)
    && !/type SlideDomWindow/.test(appSource)
    && !/const domPreview = isJsonRecord\(payload\.domPreview\)/.test(appSource),
  "DOM preview payload and theme shaping should live outside the main app orchestrator"
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
  /id="export-pdf-button"/.test(indexSource)
    && /id="export-pptx-button"/.test(indexSource)
    && /namespace StudioClientExportMenu/.test(exportMenuSource)
    && /function createExportMenu/.test(exportMenuSource)
    && /const exportMenu = StudioClientExportMenu\.createExportMenu\(elements\)/.test(appSource)
    && /namespace StudioClientArtifactDownload/.test(artifactDownloadSource)
    && /function getFileName/.test(artifactDownloadSource)
    && /function download/.test(artifactDownloadSource)
    && /function getPdfExportStatus/.test(artifactDownloadSource)
    && /function getPptxExportStatus/.test(artifactDownloadSource)
    && /namespace StudioClientExportWorkbench/.test(exportWorkbenchSource)
    && /async function exportPdf/.test(appSource)
    && clientModuleLazyLoaded("exports/export-workbench.ts")
    && /StudioClientArtifactDownload\.download/.test(exportWorkbenchSource)
    && /StudioClientArtifactDownload\.getPdfExportStatus/.test(exportWorkbenchSource)
    && /StudioClientArtifactDownload\.getPptxExportStatus/.test(exportWorkbenchSource)
    && /elements\.exportPdfButton\.addEventListener/.test(commandControlsSource)
    && !/Exported PPTX \(\$\{slideCount\} slide/.test(appSource)
    && !/function getArtifactFileName/.test(appSource)
    && !/function setExportMenuOpen/.test(appSource)
    && !/StudioClientArtifactDownload\.download/.test(appSource)
    && !clientModuleLoaded("exports/artifact-download.ts")
    && !clientModuleLazyLoaded("exports/artifact-download.ts")
    && /pdf:\s*\{/.test(fs.readFileSync(path.join(process.cwd(), "studio/server/index.ts"), "utf8")),
  "PDF and PPTX exports should be discoverable from the main Studio header"
);
assert(
  /namespace StudioClientPreferences/.test(preferencesSource)
    && /function loadDrawerOpen\(key(?:: [^)]+)?\)/.test(preferencesSource)
    && /function loadAppTheme\(\)/.test(preferencesSource)
    && clientModuleLoaded("shell/preferences.ts")
    && /preferences\.loadCurrentPage\(\)/.test(navigationShellSource),
  "Local preference helpers should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientApiExplorer/.test(apiExplorerSource)
    && /function createApiExplorer/.test(apiExplorerSource)
    && /function mount\(\)/.test(apiExplorerSource)
    && clientModuleLazyLoaded("api/api-explorer.ts")
    && /async function getApiExplorer/.test(appSource)
    && appCreatesMountedLazyWorkbench("apiExplorerWorkbench", "ApiExplorerWorkbench")
    && !clientModuleLoaded("api/api-explorer.ts"),
  "API Explorer behavior should live in a lazily loaded feature script with its own mount"
);
assert(
  /namespace StudioClientApiExplorerState/.test(apiExplorerStateSource)
    && /function getExplorerState/.test(apiExplorerStateSource)
    && /StudioClientApiExplorerState\.getExplorerState\(state\)/.test(appSource)
    && !/state\.hypermedia = \{ activePresentation: null/.test(appSource),
  "API Explorer state initialization should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientAppTheme/.test(appThemeSource)
    && /function createAppTheme/.test(appThemeSource)
    && /function mount\(\)/.test(appThemeSource)
    && clientModuleLoaded("shell/app-theme.ts")
    && /const appTheme = StudioClientAppTheme\.createAppTheme/.test(appSource)
    && /appTheme\.mount\(\);/.test(commandControlsSource),
  "App theme behavior should live in a feature script with its own mount"
);
assert(
  /function mountContentRunControls/.test(presentationCreationWorkbenchSource)
    && /function renderContentRun/.test(presentationCreationWorkbenchSource)
    && /function renderStudioContentRunPanel/.test(presentationCreationWorkbenchSource)
    && /data-content-run-retry-slide/.test(presentationCreationWorkbenchSource)
    && /data-studio-content-run-retry/.test(presentationCreationWorkbenchSource)
    && !/id="content-run-rail"/.test(indexSource)
    && !/data-content-run-slide/.test(presentationCreationWorkbenchSource)
    && !clientModuleLoaded("content-run-actions.ts")
    && !/StudioClientContentRunActions/.test(appSource),
  "Live content-run rendering and action handling should avoid a duplicate static slide rail"
);
assert(
  /namespace StudioClientLlmStatus/.test(llmStatusSource)
    && /function createLlmStatus/.test(llmStatusSource)
    && /function getConnectionView/.test(llmStatusSource)
    && /function togglePopover/.test(llmStatusSource)
    && clientModuleLoaded("runtime/llm-status.ts")
    && /const llmStatus = StudioClientLlmStatus\.createLlmStatus/.test(appSource)
    && /llmStatus\.getConnectionView\(llm\)/.test(runtimeStatusWorkbenchSource),
  "LLM status view and popover state should live in a feature script"
);
assert(
  /namespace StudioClientRuntimeStatusWorkbench/.test(runtimeStatusWorkbenchSource)
    && /function createRuntimeStatusWorkbench/.test(runtimeStatusWorkbenchSource)
    && /function renderStatus\(\)/.test(runtimeStatusWorkbenchSource)
    && /function renderWorkflowHistory\(\)/.test(runtimeStatusWorkbenchSource)
    && /function renderSourceRetrieval\(\)/.test(runtimeStatusWorkbenchSource)
    && /function renderPromptBudget\(\)/.test(runtimeStatusWorkbenchSource)
    && /function connectRuntimeStream\(\)/.test(runtimeStatusWorkbenchSource)
    && /async function checkLlmProvider/.test(runtimeStatusWorkbenchSource)
    && clientModuleLoaded("runtime/runtime-status-workbench.ts")
    && /runtimeStatusWorkbench = StudioClientRuntimeStatusWorkbench\.createRuntimeStatusWorkbench/.test(appSource)
    && /runtimeStatusWorkbench\.renderStatus\(\)/.test(appSource)
    && !/const llmView = llmStatus\.getConnectionView\(llm\)/.test(appSource)
    && !/let runtimeEventSource/.test(appSource)
    && !/new window\.EventSource\("\/api\/runtime\/stream"\)/.test(appSource)
    && !/function formatCharCount\(value\)/.test(appSource),
  "Runtime status, diagnostics rendering, LLM checking, and runtime stream lifecycle should live in the runtime status workbench"
);
assert(
  /namespace StudioClientValidationReport/.test(validationReportSource)
    && /function renderValidationReport/.test(validationReportSource)
    && /namespace StudioClientValidationReportWorkbench/.test(validationReportWorkbenchSource)
    && /function createValidationReportWorkbench/.test(validationReportWorkbenchSource)
    && /function suggestValidationRemediation/.test(validationReportWorkbenchSource)
    && /validation-summary-card/.test(validationReportSource)
    && /No checks run yet/.test(validationReportSource)
    && clientModuleLazyLoaded("runtime/validation-report-workbench.ts")
    && /validationReportWorkbench\.load\(\)\.then/.test(appSource)
    && !/async function getValidationReportRenderer/.test(appSource)
    && !/function suggestValidationRemediation/.test(appSource)
    && !clientModuleLoaded("validation-report-control.ts")
    && !/elements\.validationSummary\.replaceChildren\(\)/.test(appSource)
    && !clientModuleLazyLoaded("runtime/validation-report.ts")
    && !clientModuleLoaded("runtime/validation-report.ts"),
  "Validation report rendering and remediation control flow should live in a lazily loaded feature script"
);
assert(
  /namespace StudioClientSlidePreview/.test(slidePreviewSource)
    && /function createSlidePreview/.test(slidePreviewSource)
    && /function renderDomSlide/.test(slidePreviewSource)
    && /function renderImagePreview/.test(slidePreviewSource)
    && clientModuleLoaded("preview/dom-preview-workbench.ts")
    && /from "\.\/slide-preview\.ts"/.test(domPreviewWorkbenchSource)
    && /const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(domPreviewWorkbenchSource)
    && !/const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(appSource),
  "Shared slide preview rendering should live in a feature script"
);
assert(
  /namespace StudioClientPreviewWorkbench/.test(previewWorkbenchSource)
    && /function createPreviewWorkbench/.test(previewWorkbenchSource)
    && /function getThumbnailStacks\(\)/.test(previewWorkbenchSource)
    && /thumb-stack/.test(previewWorkbenchSource)
    && /thumb-detour/.test(stylesSource)
    && /function render\(\)/.test(previewWorkbenchSource)
    && /getLiveStudioContentRun/.test(previewWorkbenchSource)
    && /getLivePreviewSlideSpec/.test(previewWorkbenchSource)
    && /selectSlideByIndex\(slide\.index\)/.test(previewWorkbenchSource)
    && clientModuleLoaded("preview/preview-workbench.ts")
    && /previewWorkbench = StudioClientPreviewWorkbench\.createPreviewWorkbench/.test(appSource)
    && /function renderPreviews\(\) \{\s*previewWorkbench\.render\(\);\s*\}/.test(appSource)
    && !/const thumbRailScrollLeft = elements\.thumbRail\.scrollLeft/.test(appSource),
  "Active preview and thumbnail rail rendering should live in the preview workbench"
);
assert(
  /\(\(coordinate\.x - 1 \+ delta \+ maxX\) % maxX\) \+ 1/.test(slideDomSource),
  "Presentation mode horizontal keyboard navigation should wrap from first to last slide and back"
);
assert(
  /presentationDetourUp/.test(slideDomSource)
    && /presentationDetourDown/.test(slideDomSource)
    && /clamp\(coordinate\.y \+ delta, 0, maxYForX\(coordinate\.x\)\)/.test(slideDomSource)
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
    && /postJson\("\/api\/assistant\/message"/.test(assistantWorkbenchSource)
    && /function mount\(\)/.test(assistantWorkbenchSource)
    && clientModuleLazyLoaded("creation/assistant-workbench.ts")
    && /async function getAssistantWorkbench/.test(appSource)
    && /onAssistantOpen: loadAssistantWorkbench/.test(appSource)
    && appCreatesMountedLazyWorkbench("assistantLazyWorkbench", "AssistantWorkbench")
    && !clientModuleLoaded("creation/assistant-workbench.ts")
    && !/postJson\("\/api\/assistant\/message"/.test(appSource)
    && !/const session = state\.assistant\.session/.test(appSource),
  "Assistant rendering and message application should live in the lazily loaded assistant workbench"
);
assert(
  /namespace StudioClientThemeWorkbench/.test(themeWorkbenchSource)
    && /function createThemeWorkbench/.test(themeWorkbenchSource)
    && /function renderSavedThemes/.test(themeWorkbenchSource)
    && /function renderFavorites/.test(themeWorkbenchSource)
    && /function renderStage/.test(themeWorkbenchSource)
    && /function renderReview/.test(themeWorkbenchSource)
    && /function getSelectedPreviewEntry/.test(themeWorkbenchSource)
    && /creation-theme-preview-current/.test(themeWorkbenchSource)
    && !/creation-theme-preview-card/.test(themeWorkbenchSource)
    && /function mount\(\)/.test(themeWorkbenchSource)
    && /async function generateFromBrief/.test(themeWorkbenchSource)
    && /request(?:<[^>]+>)?\("\/api\/themes\/generate"/.test(themeWorkbenchSource)
    && /request(?:<[^>]+>)?\("\/api\/themes\/candidates"/.test(themeWorkbenchSource)
    && /themeCandidates: \[\]/.test(stateSource)
    && clientModuleLazyLoaded("creation/theme-workbench.ts")
    && /async function getThemeWorkbench/.test(appSource)
    && /function loadThemeWorkbench/.test(appSource)
    && appCreatesMountedLazyWorkbench("themeLazyWorkbench", "ThemeWorkbench")
    && !clientModuleLoaded("creation/theme-workbench.ts")
    && !/request\("\/api\/themes\/generate"/.test(appSource)
    && !/function generateThemeFromBriefText/.test(appSource)
    && !/async function generateThemeFromBrief/.test(appSource)
    && !/async function generateThemeCandidates/.test(appSource)
    && !/function hashTextToIndex/.test(appSource)
    && !/function renderCreationThemeReview/.test(appSource)
    && !/function getThemeTokenSummary/.test(appSource)
    && !/const candidateSets/.test(appSource)
    && !/const candidateSets/.test(themeWorkbenchSource),
  "Theme generation and candidate construction should rely on server endpoints instead of browser-side fallback tokens"
);
assert(
  /namespace StudioClientThemeFieldState/.test(themeFieldStateSource)
    && /function read/.test(themeFieldStateSource)
    && /function apply/.test(themeFieldStateSource)
    && /function setBrief/.test(themeFieldStateSource)
    && /function getBrief/.test(themeFieldStateSource)
    && /StudioClientThemeFieldState\.read\(elements\)/.test(themeActionsSource)
    && /StudioClientThemeFieldState\.apply\(windowRef\.document, elements, theme\)/.test(themeActionsSource)
    && !/StudioClientThemeFieldState\.read\(elements\)/.test(appSource)
    && !/StudioClientThemeFieldState\.apply\(window\.document, elements, theme\)/.test(appSource)
    && !/function toColorInputValue/.test(appSource)
    && !/function toFontSelectValue/.test(appSource),
  "Theme field normalization and DOM field mapping should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientThemeCandidateState/.test(themeCandidateStateSource)
    && /function resetCandidates/.test(themeCandidateStateSource)
    && /StudioClientThemeCandidateState\.resetCandidates\(state\)/.test(themeActionsSource)
    && /StudioClientThemeCandidateState\.resetCandidates\(state\)/.test(themeWorkbenchSource)
    && !/StudioClientThemeCandidateState\.resetCandidates\(state\)/.test(appSource)
    && !/state\.ui\.themeCandidateRefreshIndex = 0;/.test(appSource),
  "Theme candidate reset rules should be shared across app and theme workbench"
);
assert(
  /namespace StudioClientCreationThemeState/.test(creationThemeStateSource)
    && /function getSavedThemeFields/.test(creationThemeStateSource)
    && /function getSelectedThemeVariant/.test(creationThemeStateSource)
    && /function applyThemeSavePayload/.test(creationThemeStateSource)
    && /StudioClientCreationThemeState\.getSavedThemeFields\(state\.savedThemes, themeId\)/.test(themeActionsSource)
    && /StudioClientCreationThemeState\.getSelectedThemeVariant/.test(themeActionsSource)
    && /StudioClientCreationThemeState\.applyThemeSavePayload\(state, payload\)/.test(themeActionsSource)
    && !/StudioClientCreationThemeState\.getSavedThemeFields\(state\.savedThemes, themeId\)/.test(appSource)
    && !/StudioClientCreationThemeState\.getSelectedThemeVariant/.test(appSource)
    && !/StudioClientCreationThemeState\.applyThemeSavePayload\(state, payload\)/.test(appSource)
    && !/state\.savedThemes\.find\(\(theme\) => theme\.id === themeId\)/.test(appSource),
  "Creation theme saved-theme lookup, save payload merging, and fallback variant shaping should live outside the main app orchestrator"
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
    && clientModuleLazyLoaded("creation/presentation-library.ts")
    && /async function getPresentationLibrary/.test(appSource)
    && /function renderPresentationLibrary/.test(appSource)
    && !clientModuleLoaded("creation/presentation-library.ts")
    && !/function renderPresentations/.test(appSource)
    && !/async function selectPresentation/.test(appSource)
    && !/async function duplicatePresentation/.test(appSource)
    && !/async function regeneratePresentation/.test(appSource)
    && !/async function deletePresentation/.test(appSource),
  "Presentation list rendering and library actions should live in the presentation library script"
);
assert(
  /namespace StudioClientPresentationCreationWorkbench/.test(presentationCreationWorkbenchSource)
    && /function createPresentationCreationWorkbench/.test(presentationCreationWorkbenchSource)
    && /function getFields/.test(presentationCreationWorkbenchSource)
    && /function applyFields/.test(presentationCreationWorkbenchSource)
    && /function mountInputs/.test(presentationCreationWorkbenchSource)
    && /function normalizeStage/.test(presentationCreationWorkbenchSource)
    && /function getStageAccess/.test(presentationCreationWorkbenchSource)
    && /function getEditableDeckPlan/.test(presentationCreationWorkbenchSource)
    && /function renderDraft/.test(presentationCreationWorkbenchSource)
    && /function renderCreationOutline/.test(presentationCreationWorkbenchSource)
    && /function saveEditableOutlineDraft/.test(presentationCreationWorkbenchSource)
    && /async function saveCreationDraft/.test(presentationCreationWorkbenchSource)
    && /async function generatePresentationOutline/.test(presentationCreationWorkbenchSource)
    && /async function approvePresentationOutline/.test(presentationCreationWorkbenchSource)
    && /async function createPresentationFromForm/.test(presentationCreationWorkbenchSource)
    && /function openCreatedPresentation/.test(presentationCreationWorkbenchSource)
    && clientModuleLoaded("creation/presentation-creation-workbench.ts")
    && /const presentationCreationWorkbench = StudioClientPresentationCreationWorkbench\.createPresentationCreationWorkbench/.test(appSource)
    && /presentationCreationWorkbench\.mountInputs\(\);/.test(appSource)
    && !/function getCreationFields/.test(appSource)
    && !/function applyCreationFields/.test(appSource)
    && !/function normalizeCreationStage/.test(appSource)
    && !/function getCreationStageAccess/.test(appSource)
    && !/function getEditableDeckPlan/.test(appSource)
    && /function renderCreationDraft\(\) \{\s*presentationCreationWorkbench\.renderDraft\(\);\s*\}/.test(appSource)
    && !/function renderCreationOutline/.test(appSource)
    && !/function saveEditableOutlineDraft/.test(appSource)
    && !/async function saveCreationDraft/.test(appSource)
    && !/async function generatePresentationOutline/.test(appSource)
    && !/async function approvePresentationOutline/.test(appSource)
    && !/async function createPresentationFromForm/.test(appSource)
    && !/function openCreatedPresentation/.test(appSource)
    && !/function clearPresentationForm/.test(appSource)
    && !/function mountPresentationCreateInputs/.test(appSource)
    && !/creationDraftSaveTimer/.test(appSource),
  "Presentation creation field mapping, stage rules, outline rendering, staged actions, and input mounting should live in the creation workbench script"
);
assert(
  /namespace StudioClientPresentationCreationState/.test(presentationCreationStateSource)
    && /function getPresentationState/.test(presentationCreationStateSource)
    && /function isWorkflowRunning/.test(presentationCreationStateSource)
    && /function isEmptyCreationDraft/.test(presentationCreationStateSource)
    && /StudioClientPresentationCreationState\.getPresentationState\(state\)/.test(appSource)
    && /StudioClientPresentationCreationState\.isWorkflowRunning\(state\)/.test(appSource)
    && /StudioClientPresentationCreationState\.isEmptyCreationDraft\(draft\)/.test(appSource)
    && !/const imageSearch = isJsonRecord\(fields\.imageSearch\)/.test(appSource),
  "Presentation creation state projection and draft checks should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientPresentationCreationControl/.test(presentationCreationControlSource)
    && /function resetControl/.test(presentationCreationControlSource)
    && /function hydrateDraftFields/.test(presentationCreationControlSource)
    && /state\.ui\.creationContentSlideIndex = 1/.test(presentationCreationControlSource)
    && /state\.ui\.creationStage = workbench\.normalizeStage/.test(presentationCreationControlSource)
    && /StudioClientPresentationCreationControl\.resetControl/.test(appSource)
    && /StudioClientPresentationCreationControl\.hydrateDraftFields/.test(appSource)
    && !/elements\.presentationMaterialFile\.value = ""/.test(appSource)
    && !/presentationCreationWorkbench\.applyFields\(state\.creationDraft\.fields\)/.test(appSource)
    && !/state\.ui\.creationContentSlidePinned = false/.test(appSource),
  "Presentation creation reset and draft hydration wiring should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientPresentationModeControl/.test(presentationModeControlSource)
    && /function openPresentationMode/.test(presentationModeControlSource)
    && /windowRef\.open\(url, "_blank"\)/.test(presentationModeControlSource)
    && /StudioClientPresentationModeControl\.openPresentationMode/.test(presentationModeWorkbenchSource)
    && clientModuleLazyLoaded("shell/presentation-mode-workbench.ts")
    && !/StudioClientPresentationModeControl\.openPresentationMode/.test(appSource)
    && !/window\.open\(url, "_blank"\)/.test(appSource),
  "Presentation mode window launch behavior should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientPresentationModeState/.test(presentationModeStateSource)
    && /function getPresentationModeUrl/.test(presentationModeStateSource)
    && /function getPresentHref/.test(presentationModeStateSource)
    && /StudioClientPresentationModeState\.getPresentationModeUrl\(state, presentationId\)/.test(presentationModeWorkbenchSource)
    && !/StudioClientPresentationModeState\.getPresentationModeUrl\(state, presentationId\)/.test(appSource)
    && !/const presentHref = state\.hypermedia/.test(appSource),
  "Presentation mode URL construction should live outside the main app orchestrator"
);
assert(
  /Starter image material/.test(indexSource)
    && /Find image material/.test(indexSource)
    && /Regenerate with sources\/materials/.test(indexSource)
    && /namespace StudioClientFileReader/.test(fileReaderSource)
    && /function readAsDataUrl/.test(fileReaderSource)
    && /StudioClientFileReader\.readAsDataUrl\(window, file\)/.test(appSource)
    && clientModuleLazyLoaded("core/file-reader.ts")
    && !/import \{ StudioClientFileReader \} from "\.\/core\/file-reader\.ts";/.test(appSource)
    && /Image guidance/.test(presentationCreationWorkbenchSource)
    && /Use supplied image materials only where they help this slide/.test(presentationCreationWorkbenchSource),
  "Staged creation should make the image-material to per-slide guidance path visible"
);
assert(
  /request\("\/api\/layouts\/custom\/draft"/.test(customLayoutWorkbenchSource)
    && !/function createCustomLayoutSlots/.test(appSource)
    && !/function createCoverLayoutRegions/.test(appSource)
    && !/function createContentLayoutRegions/.test(appSource)
    && !/function createCustomLayoutDefinitionFromControls/.test(appSource)
    && !/function createLayoutStudioDefinitionFromControls/.test(appSource),
  "Custom layout draft slot and region construction should be server-owned"
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
    && clientModuleLazyLoaded("creation/custom-layout-workbench.ts")
    && /async function getCustomLayoutWorkbench/.test(appSource)
    && /const customLayoutWorkbenchProxy/.test(appSource)
    && appCreatesMountedLazyWorkbench("customLayoutLazyWorkbench", "CustomLayoutWorkbench")
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
    && clientModuleLazyLoaded("runtime/workflow-workbench.ts")
    && /StudioClientWorkflows\.createWorkflowRunners/.test(workflowWorkbenchSource)
    && !/let workflowRunners: WorkflowRunners \| null = null/.test(appSource)
    && !/async function getWorkflowRunners/.test(appSource)
    && !/StudioClientWorkflows\.createWorkflowRunners/.test(appSource)
    && !clientModuleLazyLoaded("runtime/workflows.ts")
    && !clientModuleLoaded("runtime/workflows.ts"),
  "Shared candidate workflow runners and command wiring should live in a lazily loaded feature script"
);
assert(
  /namespace StudioClientCandidateCount/.test(candidateCountSource)
    && /function readNormalized/.test(candidateCountSource)
    && /StudioClientCandidateCount\.readNormalized\(elements\.ideateCandidateCount\)/.test(appSource)
    && clientModuleLazyLoaded("variants/candidate-count.ts")
    && !/import \{ StudioClientCandidateCount \} from "\.\/variants\/candidate-count\.ts";/.test(appSource)
    && !/Number\.parseInt\(elements\.ideateCandidateCount\.value/.test(appSource),
  "Candidate count normalization should live outside the main app orchestrator"
);
assert(
  /function requiredElement\(id: string\): HTMLElement \{[\s\S]*?document\.getElementById\(id\)/.test(coreSource),
  "requiredElement should be the single fail-fast DOM id lookup helper"
);
assert(
  /namespace StudioClientElements/.test(elementsSource)
    && /function createElements\(core: ElementCore\)/.test(elementsSource)
    && /const elements: StudioClientElements\.Elements = StudioClientElements\.createElements\(StudioClientCore\);/.test(appSource)
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

const deckStructureFunction = appSource.match(/async function ideateDeckStructure\(\) \{[\s\S]*?\n\}/);
assert(deckStructureFunction, "Expected ideateDeckStructure function in studio client");
assert(
  /workflowWorkbench\.load\(\)/.test(deckStructureFunction[0])
    && /ideateDeckStructure: \(\) => runners\.runDeckStructure\(\{/.test(workflowWorkbenchSource),
  "Deck-structure generation should use the shared deck workflow runner"
);
const deckStructureWorkflowFunction = workflowSource.match(/async function runDeckStructure\(\{ button, endpoint \}(?:: [^)]+)?\): Promise<void> \{[\s\S]*?\n    \}/);
assert(deckStructureWorkflowFunction, "Expected shared deck-structure workflow runner");
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
  /function setDeckStructureCandidates\(candidates(?:: [^)]+)?\)/.test(appSource)
    && !/state\.deckStructureCandidates = payload\.deckStructureCandidates/.test(appSource),
  "Deck-structure payload application should use the candidate selection helper"
);

["ideateSlide", "ideateTheme", "ideateStructure", "redoLayout"].forEach((functionName) => {
  const appPattern = new RegExp(`async function ${functionName}\\(\\) \\{[\\s\\S]*?workflowWorkbench\\.load\\(\\)`);
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
    && /function getUrlSlideParam/.test(appSource)
    && /StudioClientUrlState\.getSlideParam\(window\)/.test(appSource)
    && /StudioClientUrlState\.setSlideParam\(window, slideId\)/.test(appSource)
    && /namespace StudioClientSlideSelectionState/.test(slideSelectionStateSource)
    && /function resolveRequestedSlide/.test(slideSelectionStateSource)
    && /function getSlideByIndex/.test(slideSelectionStateSource)
    && /function syncSelectedSlideToActiveList/.test(slideSelectionStateSource)
    && /StudioClientSlideSelectionState\.getSlideByIndex\(state, index\)/.test(appSource)
    && /StudioClientSlideSelectionState\.syncSelectedSlideToActiveList\(state, getUrlSlideParam\(\)\)/.test(appSource),
  "Slide Studio should persist and restore the selected slide through the URL query"
);
assert(
  /slideLoadAbortController/.test(slideLoadWorkbenchSource)
    && /request(?:<[^>]+>)?\(`\/api\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(slideLoadWorkbenchSource)
    && clientModuleLazyLoaded("editor/slide-load-workbench.ts")
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
  /namespace StudioClientVariantGenerationControls/.test(variantGenerationControlsSource)
    && /function open/.test(variantGenerationControlsSource)
    && /StudioClientVariantGenerationControls\.open\(window\.document\)/.test(appSource)
    && /StudioClientVariantGenerationControls\.open\(windowRef\.document\)/.test(variantReviewWorkbenchSource)
    && clientModuleLazyLoaded("variants/variant-generation-controls.ts")
    && !/import \{ StudioClientVariantGenerationControls \} from "\.\/variants\/variant-generation-controls\.ts";/.test(appSource)
    && !/querySelector\("\.variant-generation-details"\)/.test(appSource)
    && !/querySelector\("\.variant-generation-details"\)/.test(variantReviewWorkbenchSource),
  "Variant generation details disclosure DOM handling should live in a shared helper"
);
assert(
  /namespace StudioClientValidationSettingsForm/.test(validationSettingsFormSource)
    && /function apply/.test(validationSettingsFormSource)
    && /function read/.test(validationSettingsFormSource)
    && /StudioClientValidationSettingsForm\.apply\(documentRef, elements, deck\.validationSettings \|\| \{\}\)/.test(deckContextFormSource)
    && /StudioClientValidationSettingsForm\.read\(documentRef, elements\)/.test(buildValidationWorkbenchSource)
    && clientModuleLazyLoaded("runtime/build-validation-workbench.ts")
    && !/StudioClientValidationSettingsForm\.read\(window\.document, elements\)/.test(appSource)
    && !/function getValidationRuleSelects/.test(appSource),
  "Validation settings form state should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientDeckContextForm/.test(deckContextFormSource)
    && /function read/.test(deckContextFormSource)
    && /function apply/.test(deckContextFormSource)
    && /StudioClientDeckContextForm\.apply\(window\.document, elements, deck\)/.test(appSource)
    && /StudioClientDeckContextForm\.read\(window\.document, elements\)/.test(appSource)
    && !/elements\.deckAudience\.value,\n\s+author: elements\.deckAuthor\.value/.test(appSource),
  "Deck context form mapping should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientWorkspaceState/.test(workspaceStateSource)
    && /type WorkspacePayload/.test(workspaceStateSource)
    && /function applyWorkspacePayload/.test(workspaceStateSource)
    && /StudioClientWorkspaceState\.applyWorkspacePayload\(state, payload, apiRoot, activePresentation\)/.test(appSource)
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
    && /StudioClientContextPayloadState\.applyContextPayload\(state, payload, \{ resetDeckStructure: true \}\)/.test(appSource)
    && !/state\.context = payload\.context/.test(appSource),
  "Context response state updates should live outside the main app orchestrator"
);
assert(
  /slideWorkflowAbortController/.test(workflowSource)
    && /slideWorkflowRequestSeq/.test(workflowSource)
    && /signal: abortController\.signal/.test(workflowSource),
  "Slide candidate workflows should combine abort controllers with sequence guards"
);
assert(/isAbortError/.test(coreSource) && /isAbortError/.test(appSource), "Expected shared abort error helper");
assert(
  /function beginAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, requestSeqKey(?:: [^)]+)?\)/.test(stateSource)
    && /function isCurrentAbortableRequest\(\s*state(?:: [^,]+)?,\s*controllerKey(?:: [^,]+)?,\s*requestSeqKey(?:: [^,]+)?,\s*requestSeq(?:: [^,]+)?,\s*abortController(?:: [^)]+)?\s*\)/.test(stateSource)
    && /function clearAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, abortController(?:: [^)]+)?\)/.test(stateSource)
    && /beginAbortableRequest\(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq"\)/.test(workflowSource),
  "Abortable workflow guards should use shared request guard helpers"
);

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
    && /navigationShell\.initializeState\(\);/.test(appSource)
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
const renderVariantsFunction = variantReviewWorkbenchSource.match(/function render\(\)(?:: [^{]+)? \{[\s\S]*?\n    function renderComparison/);
assert(renderVariantsFunction, "Expected variant rendering in variant review workbench");
assert(/function createDomElement\(tagName/.test(coreSource), "Expected small DOM element builder helper");
assert(
  /createDomElement\("button"[\s\S]*data-action/.test(renderVariantsFunction[0])
    && !/card\.innerHTML\s*=/.test(renderVariantsFunction[0]),
  "Variant cards should use DOM builders instead of dynamic innerHTML"
);
assert(
  /previousVariantListScrollTop = elements\.variantList\.scrollTop/.test(renderVariantsFunction[0])
    && /elements\.variantList\.scrollTop = previousVariantListScrollTop/.test(renderVariantsFunction[0]),
  "Variant selection should preserve the candidate rail scroll position while rerendering"
);
assert(
  /Generating \$\{candidateCount\} slide variant/.test(workflowSource)
    && /state\.ui\.variantReviewOpen = true/.test(workflowSource)
    && /renderVariants\(\);/.test(workflowSource)
    && /Generating candidates/.test(variantReviewWorkbenchSource)
    && /state\.slideWorkflowAbortController/.test(variantReviewWorkbenchSource),
  "Slide variant generation should show immediate progress while the LLM request is in flight"
);
assert(
  /namespace StudioClientVariantReviewWorkbench/.test(variantReviewWorkbenchSource)
    && /function createVariantReviewWorkbench/.test(variantReviewWorkbenchSource)
    && /function renderComparison/.test(variantReviewWorkbenchSource)
    && /async function captureVariant/.test(variantReviewWorkbenchSource)
    && /async function applyVariantById/.test(variantReviewWorkbenchSource)
    && /function mount\(\)/.test(variantReviewWorkbenchSource)
    && clientModuleLazyLoaded("variants/variant-review-workbench.ts")
    && /async function getVariantReviewWorkbench/.test(appSource)
    && /function loadVariantReviewWorkbench/.test(appSource)
    && appCreatesMountedLazyWorkbench("variantReviewLazyWorkbench", "VariantReviewWorkbench")
    && !clientModuleLoaded("variants/variant-review-workbench.ts")
    && !/async function captureVariant/.test(appSource)
    && !/async function applyVariantById/.test(appSource)
    && !/function canSaveVariantLayout/.test(appSource)
    && !/function describeVariantKind/.test(appSource),
  "Variant review rendering, comparison, and actions should live in the variant review workbench"
);
assert(
  /namespace StudioClientVariantState/.test(variantStateSource)
    && /function getSlideVariants/.test(variantStateSource)
    && /function getSelectedVariant/.test(variantStateSource)
    && /function clearTransientVariants/.test(variantStateSource)
    && /function replacePersistedVariantsForSlide/.test(variantStateSource)
    && /StudioClientVariantState\.getSlideVariants\(state\)/.test(appSource)
    && /StudioClientVariantState\.getSlideVariants\(state\)/.test(variantReviewWorkbenchSource),
  "Slide variant state selection and replacement rules should be shared across app and variant review workbench"
);
assert(
  /namespace StudioClientSlideEditorWorkbench/.test(slideEditorWorkbenchSource)
    && /function createSlideEditorWorkbench/.test(slideEditorWorkbenchSource)
    && /function renderSlideFields/.test(slideEditorWorkbenchSource)
    && /function beginInlineTextEdit/.test(slideEditorWorkbenchSource)
    && /function parseSlideSpecEditor/.test(slideEditorWorkbenchSource)
    && /function renderMaterials/.test(slideEditorWorkbenchSource)
    && /async function createSystemSlide/.test(slideEditorWorkbenchSource)
    && /async function deleteSlideFromDeck/.test(slideEditorWorkbenchSource)
    && /function mount\(\)/.test(slideEditorWorkbenchSource)
    && clientModuleLoaded("editor/slide-editor-workbench.ts")
    && /const slideEditorWorkbench = StudioClientSlideEditorWorkbench\.createSlideEditorWorkbench/.test(appSource)
    && /slideEditorWorkbench\.mount\(\);/.test(commandControlsSource)
    && !/function beginInlineTextEdit/.test(appSource)
    && !/async function saveSlideSpec/.test(appSource)
    && !/async function createSystemSlide/.test(appSource)
    && !/async function attachMaterialToSlide/.test(appSource)
    && !/function getSelectedSlideMaterialId/.test(appSource),
  "Current-slide editing, inline edit, JSON editor, manual slide, and material actions should live in the slide editor workbench"
);
assert(
  /function updateStructuredDraftFromInlineEdit/.test(slideEditorWorkbenchSource)
    && /element\.addEventListener\("input", handleInput\)/.test(slideEditorWorkbenchSource)
    && /Previewing inline text edits/.test(slideEditorWorkbenchSource),
  "Inline slide text editing should keep the structured draft JSON synchronized before save"
);
assert(
  /Add after current slide/.test(indexSource)
    && /Add as subslide in vertical stack/.test(indexSource)
    && /Create subslide/.test(slideEditorWorkbenchSource),
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
    && clientModuleLazyLoaded("planning/deck-planning-workbench.ts")
    && /async function getDeckPlanningWorkbench/.test(appSource)
    && /onOutlineOpen: loadDeckPlanningWorkbench/.test(appSource)
    && appCreatesMountedLazyWorkbench("deckPlanningLazyWorkbench", "DeckPlanningWorkbench")
    && !clientModuleLoaded("planning/deck-planning-workbench.ts")
    && !/function buildDeckDiffSupport/.test(appSource)
    && !/function renderOutlinePlanComparison/.test(appSource)
    && !/async function applyDeckStructureCandidate/.test(appSource)
    && !/async function addSource/.test(appSource),
  "Deck planning, outline plans, deck length, and source-library actions should live in the deck planning workbench"
);
[
  "mountGlobalEvents"
].forEach((functionName) => {
  assert(
    new RegExp(`function ${functionName}\\(\\)`).test(appSource) && new RegExp(`${functionName}\\(\\);`).test(appSource),
    `${functionName} should own one event-binding group and be mounted explicitly`
  );
});
assert(
  /namespace StudioClientGlobalEvents/.test(globalEventsSource)
    && /function mountGlobalEvents/.test(globalEventsSource)
    && /documentRef\.addEventListener\("click"/.test(globalEventsSource)
    && /StudioClientGlobalEvents\.mountGlobalEvents/.test(appSource)
    && !/window\.document\.addEventListener\("click"/.test(appSource),
  "Global document event bindings should live outside the main app orchestrator"
);
assert(
  /namespace StudioClientCommandControls/.test(commandControlsSource)
    && /function mountCommandControls/.test(commandControlsSource)
    && /StudioClientCommandControls\.mountCommandControls/.test(appSource)
    && /elements\.ideateSlideButton\.addEventListener/.test(commandControlsSource)
    && !/elements\.ideateSlideButton\.addEventListener/.test(appSource),
  "Studio command control event bindings should live outside the main app orchestrator"
);
assert(
  /function mountThemeInputs\(\)/.test(themeWorkbenchSource)
    && /mountThemeInputs\(\);/.test(themeWorkbenchSource)
    && !/function mountThemeInputs\(\)/.test(appSource),
  "Theme field event bindings should live in the theme workbench"
);
assert(
  /function initializeStudioClient\(\)/.test(appSource) && /initializeStudioClient\(\);/.test(appSource),
  "Studio client startup should flow through an explicit initializer"
);

console.log("Client fixture validation passed.");
