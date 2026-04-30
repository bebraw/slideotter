const fs = require("fs");
const path = require("path");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const apiExplorerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api-explorer.ts"), "utf8");
const appThemeSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-theme.ts"), "utf8");
const assistantWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/assistant-workbench.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core.ts"), "utf8");
const customLayoutWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/custom-layout-workbench.ts"), "utf8");
const deckPlanningWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/deck-planning-workbench.ts"), "utf8");
const drawerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/drawers.ts"), "utf8");
const elementsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/elements.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const llmStatusSource = fs.readFileSync(path.join(process.cwd(), "studio/client/llm-status.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/navigation-shell.ts"), "utf8");
const presentationCreationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/presentation-creation-workbench.ts"), "utf8");
const presentationLibrarySource = fs.readFileSync(path.join(process.cwd(), "studio/client/presentation-library.ts"), "utf8");
const preferencesSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preferences.ts"), "utf8");
const previewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview-workbench.ts"), "utf8");
const runtimeStatusWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime-status-workbench.ts"), "utf8");
const slidePreviewSource = fs.readFileSync(path.join(process.cwd(), "studio/client/slide-preview.ts"), "utf8");
const slideEditorWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/slide-editor-workbench.ts"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/state.ts"), "utf8");
const themeWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/theme-workbench.ts"), "utf8");
const validationReportSource = fs.readFileSync(path.join(process.cwd(), "studio/client/validation-report.ts"), "utf8");
const variantReviewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variant-review-workbench.ts"), "utf8");
const workflowSource = fs.readFileSync(path.join(process.cwd(), "studio/client/workflows.ts"), "utf8");

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(navigationShellSource);
}

assert(
  /<script type="module" src="\/main\.ts"><\/script>/.test(indexSource)
    && clientModuleLoaded("app.ts"),
  "Studio client should load through the Vite module entrypoint"
);

assert(
  /namespace StudioClientCore/.test(coreSource) && clientModuleLoaded("core.ts"),
  "Studio client core helpers should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientState/.test(stateSource)
    && /function createInitialState\(\)/.test(stateSource)
    && /const state: StudioClientState\.State = StudioClientState\.createInitialState\(\);/.test(appSource)
    && clientModuleLoaded("state.ts"),
  "Initial studio state should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientPreferences/.test(preferencesSource)
    && /function loadDrawerOpen\(key(?:: [^)]+)?\)/.test(preferencesSource)
    && /function loadAppTheme\(\)/.test(preferencesSource)
    && clientModuleLoaded("preferences.ts")
    && /preferences\.loadCurrentPage\(\)/.test(navigationShellSource),
  "Local preference helpers should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientApiExplorer/.test(apiExplorerSource)
    && /function createApiExplorer/.test(apiExplorerSource)
    && /function mount\(\)/.test(apiExplorerSource)
    && clientModuleLoaded("api-explorer.ts")
    && /const apiExplorer = StudioClientApiExplorer\.createApiExplorer/.test(appSource)
    && /apiExplorer\.mount\(\);/.test(appSource),
  "API Explorer behavior should live in a feature script with its own mount"
);
assert(
  /namespace StudioClientAppTheme/.test(appThemeSource)
    && /function createAppTheme/.test(appThemeSource)
    && /function mount\(\)/.test(appThemeSource)
    && clientModuleLoaded("app-theme.ts")
    && /const appTheme = StudioClientAppTheme\.createAppTheme/.test(appSource)
    && /appTheme\.mount\(\);/.test(appSource),
  "App theme behavior should live in a feature script with its own mount"
);
assert(
  /function mountContentRunControls/.test(presentationCreationWorkbenchSource)
    && /function renderContentRun/.test(presentationCreationWorkbenchSource)
    && /function renderStudioContentRunPanel/.test(presentationCreationWorkbenchSource)
    && /data-content-run-retry-slide/.test(presentationCreationWorkbenchSource)
    && /data-studio-content-run-retry/.test(presentationCreationWorkbenchSource)
    && !clientModuleLoaded("content-run-actions.ts")
    && !/StudioClientContentRunActions/.test(appSource),
  "Live content-run rendering and action handling should live in the presentation creation workbench"
);
assert(
  /namespace StudioClientLlmStatus/.test(llmStatusSource)
    && /function createLlmStatus/.test(llmStatusSource)
    && /function getConnectionView/.test(llmStatusSource)
    && /function togglePopover/.test(llmStatusSource)
    && clientModuleLoaded("llm-status.ts")
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
    && clientModuleLoaded("runtime-status-workbench.ts")
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
    && /validation-summary-card/.test(validationReportSource)
    && clientModuleLoaded("validation-report.ts")
    && /StudioClientValidationReport\.renderValidationReport/.test(appSource),
  "Validation report rendering should live in a feature script"
);
assert(
  /namespace StudioClientSlidePreview/.test(slidePreviewSource)
    && /function createSlidePreview/.test(slidePreviewSource)
    && /function renderDomSlide/.test(slidePreviewSource)
    && /function renderImagePreview/.test(slidePreviewSource)
    && clientModuleLoaded("slide-preview.ts")
    && /const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(appSource),
  "Shared slide preview rendering should live in a feature script"
);
assert(
  /namespace StudioClientPreviewWorkbench/.test(previewWorkbenchSource)
    && /function createPreviewWorkbench/.test(previewWorkbenchSource)
    && /function render\(\)/.test(previewWorkbenchSource)
    && /getLiveStudioContentRun/.test(previewWorkbenchSource)
    && /getLivePreviewSlideSpec/.test(previewWorkbenchSource)
    && /selectSlideByIndex\(slide\.index\)/.test(previewWorkbenchSource)
    && clientModuleLoaded("preview-workbench.ts")
    && /previewWorkbench = StudioClientPreviewWorkbench\.createPreviewWorkbench/.test(appSource)
    && /function renderPreviews\(\) \{\s*previewWorkbench\.render\(\);\s*\}/.test(appSource)
    && !/const thumbRailScrollLeft = elements\.thumbRail\.scrollLeft/.test(appSource),
  "Active preview and thumbnail rail rendering should live in the preview workbench"
);
assert(
  /namespace StudioClientAssistantWorkbench/.test(assistantWorkbenchSource)
    && /function createAssistantWorkbench/.test(assistantWorkbenchSource)
    && /function render\(\)/.test(assistantWorkbenchSource)
    && /function renderSelection\(\)/.test(assistantWorkbenchSource)
    && /async function sendMessage\(\)/.test(assistantWorkbenchSource)
    && /postJson\("\/api\/assistant\/message"/.test(assistantWorkbenchSource)
    && /function mount\(\)/.test(assistantWorkbenchSource)
    && clientModuleLoaded("assistant-workbench.ts")
    && /assistantWorkbench = StudioClientAssistantWorkbench\.createAssistantWorkbench/.test(appSource)
    && /assistantWorkbench\.mount\(\);/.test(appSource)
    && /function renderAssistant\(\) \{\s*assistantWorkbench\.render\(\);\s*\}/.test(appSource)
    && /function renderAssistantSelection\(\) \{\s*assistantWorkbench\.renderSelection\(\);\s*\}/.test(appSource)
    && !/postJson\("\/api\/assistant\/message"/.test(appSource)
    && !/const session = state\.assistant\.session/.test(appSource),
  "Assistant rendering and message application should live in the assistant workbench"
);
assert(
  /namespace StudioClientThemeWorkbench/.test(themeWorkbenchSource)
    && /function createThemeWorkbench/.test(themeWorkbenchSource)
    && /function renderSavedThemes/.test(themeWorkbenchSource)
    && /function renderFavorites/.test(themeWorkbenchSource)
    && /function renderStage/.test(themeWorkbenchSource)
    && /function renderReview/.test(themeWorkbenchSource)
    && /function getPreviewEntries/.test(themeWorkbenchSource)
    && /function mount\(\)/.test(themeWorkbenchSource)
    && /async function generateFromBrief/.test(themeWorkbenchSource)
    && /request\("\/api\/themes\/generate"/.test(themeWorkbenchSource)
    && /request\("\/api\/themes\/candidates"/.test(themeWorkbenchSource)
    && /themeCandidates: \[\]/.test(stateSource)
    && clientModuleLoaded("theme-workbench.ts")
    && /const themeWorkbench = StudioClientThemeWorkbench\.createThemeWorkbench/.test(appSource)
    && /themeWorkbench\.mount\(\)/.test(appSource)
    && /themeWorkbench\.renderStage\(\)/.test(appSource)
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
  /namespace StudioClientPresentationLibrary/.test(presentationLibrarySource)
    && /function createPresentationLibrary/.test(presentationLibrarySource)
    && /function render/.test(presentationLibrarySource)
    && /function resetSelection/.test(presentationLibrarySource)
    && /async function selectPresentation/.test(presentationLibrarySource)
    && /async function duplicatePresentation/.test(presentationLibrarySource)
    && /async function regeneratePresentation/.test(presentationLibrarySource)
    && /async function deletePresentation/.test(presentationLibrarySource)
    && clientModuleLoaded("presentation-library.ts")
    && /const presentationLibrary = StudioClientPresentationLibrary\.createPresentationLibrary/.test(appSource)
    && /presentationLibrary\.render\(\);/.test(appSource)
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
    && clientModuleLoaded("presentation-creation-workbench.ts")
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
    && clientModuleLoaded("custom-layout-workbench.ts")
    && /const customLayoutWorkbench = StudioClientCustomLayoutWorkbench\.createCustomLayoutWorkbench/.test(appSource)
    && /customLayoutWorkbench\.mount\(\);/.test(appSource)
    && !/function renderCustomLayoutEditor/.test(appSource)
    && !/function renderLayoutLibrary/.test(appSource)
    && !/function renderLayoutStudio/.test(appSource)
    && !/async function previewCustomLayout/.test(appSource)
    && !/async function quickCustomLayout/.test(appSource)
    && !/async function previewLayoutStudioDesign/.test(appSource)
    && !/async function applySavedLayout/.test(appSource)
    && !/async function importLayoutJson/.test(appSource),
  "Custom layout editor, Layout Studio rendering, layout library actions, and custom preview actions should live in the workbench script"
);
assert(
  /namespace StudioClientWorkflows/.test(workflowSource)
    && /function createWorkflowRunners/.test(workflowSource)
    && /function runSlideCandidate/.test(workflowSource)
    && /function runDeckStructure/.test(workflowSource)
    && clientModuleLoaded("workflows.ts")
    && /const workflowRunners = StudioClientWorkflows\.createWorkflowRunners/.test(appSource),
  "Shared candidate workflow runners should live in a separate module"
);
assert(
  /function requiredElement\(id: string\): HTMLElement \{[\s\S]*?document\.getElementById\(id\)/.test(coreSource),
  "requiredElement should be the single fail-fast DOM id lookup helper"
);
assert(
  /namespace StudioClientElements/.test(elementsSource)
    && /function createElements\(core: ElementCore\)/.test(elementsSource)
    && /const elements: StudioClientElements\.Elements = StudioClientElements\.createElements\(StudioClientCore\);/.test(appSource)
    && clientModuleLoaded("elements.ts"),
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
  /runDeckStructureWorkflow\(/.test(deckStructureFunction[0]),
  "Deck-structure generation should use the shared deck workflow runner"
);
const deckStructureWorkflowFunction = workflowSource.match(/async function runDeckStructure\(\{ button, endpoint \}(?:: [^)]+)?\): Promise<void> \{[\s\S]*?\n    \}/);
assert(deckStructureWorkflowFunction, "Expected shared deck-structure workflow runner");
assert(
  /candidateCount:\s*getRequestedCandidateCount\(\)/.test(deckStructureWorkflowFunction[0]),
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
  const pattern = new RegExp(`async function ${functionName}\\(\\) \\{[\\s\\S]*?runSlideCandidateWorkflow\\(`);
  assert(
    pattern.test(appSource),
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
  /slideLoadRequestSeq/.test(appSource)
    && /isCurrentAbortableRequest\(state, "slideLoadAbortController", "slideLoadRequestSeq", requestSeq, abortController\)/.test(appSource),
  "loadSlide should guard against stale slide responses"
);
assert(
  /slideLoadAbortController/.test(appSource)
    && /request(?:<[^>]+>)?\(`\/api\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(appSource),
  "loadSlide should abort superseded slide requests"
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
    && clientModuleLoaded("drawers.ts"),
  "Drawer controller behavior should live in a separate module loaded through main.ts before app.ts"
);
assert(
  /namespace StudioClientNavigationShell/.test(navigationShellSource)
    && /function createNavigationShell/.test(navigationShellSource)
    && /const drawerConfigs = \{/.test(navigationShellSource)
    && /function renderPages\(\)/.test(navigationShellSource)
    && /function setCurrentPage\(page(?:: [^)]+)?\)/.test(navigationShellSource)
    && /function mountGlobalEvents\(\)/.test(navigationShellSource)
    && clientModuleLoaded("navigation-shell.ts")
    && /navigationShell = StudioClientNavigationShell\.createNavigationShell/.test(appSource)
    && /navigationShell\.mount\(\);/.test(appSource)
    && /navigationShell\.mountGlobalEvents\(\);/.test(appSource)
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
const renderVariantsFunction = variantReviewWorkbenchSource.match(/function render\(\) \{[\s\S]*?\n    function renderComparison/);
assert(renderVariantsFunction, "Expected variant rendering in variant review workbench");
assert(/function createDomElement\(tagName/.test(coreSource), "Expected small DOM element builder helper");
assert(
  /createDomElement\("button"[\s\S]*data-action/.test(renderVariantsFunction[0])
    && !/card\.innerHTML\s*=/.test(renderVariantsFunction[0]),
  "Variant cards should use DOM builders instead of dynamic innerHTML"
);
assert(
  /namespace StudioClientVariantReviewWorkbench/.test(variantReviewWorkbenchSource)
    && /function createVariantReviewWorkbench/.test(variantReviewWorkbenchSource)
    && /function renderComparison/.test(variantReviewWorkbenchSource)
    && /async function captureVariant/.test(variantReviewWorkbenchSource)
    && /async function applyVariantById/.test(variantReviewWorkbenchSource)
    && /function mount\(\)/.test(variantReviewWorkbenchSource)
    && clientModuleLoaded("variant-review-workbench.ts")
    && /const variantReviewWorkbench = StudioClientVariantReviewWorkbench\.createVariantReviewWorkbench/.test(appSource)
    && /variantReviewWorkbench\.mount\(\);/.test(appSource)
    && !/async function captureVariant/.test(appSource)
    && !/async function applyVariantById/.test(appSource)
    && !/function canSaveVariantLayout/.test(appSource)
    && !/function describeVariantKind/.test(appSource),
  "Variant review rendering, comparison, and actions should live in the variant review workbench"
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
    && clientModuleLoaded("slide-editor-workbench.ts")
    && /const slideEditorWorkbench = StudioClientSlideEditorWorkbench\.createSlideEditorWorkbench/.test(appSource)
    && /slideEditorWorkbench\.mount\(\);/.test(appSource)
    && !/function beginInlineTextEdit/.test(appSource)
    && !/async function saveSlideSpec/.test(appSource)
    && !/async function createSystemSlide/.test(appSource)
    && !/async function attachMaterialToSlide/.test(appSource)
    && !/function getSelectedSlideMaterialId/.test(appSource),
  "Current-slide editing, inline edit, JSON editor, manual slide, and material actions should live in the slide editor workbench"
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
    && clientModuleLoaded("deck-planning-workbench.ts")
    && /const deckPlanningWorkbench = StudioClientDeckPlanningWorkbench\.createDeckPlanningWorkbench/.test(appSource)
    && /deckPlanningWorkbench\.mount\(\);/.test(appSource)
    && !/function buildDeckDiffSupport/.test(appSource)
    && !/function renderOutlinePlanComparison/.test(appSource)
    && !/async function applyDeckStructureCandidate/.test(appSource)
    && !/async function addSource/.test(appSource),
  "Deck planning, outline plans, deck length, and source-library actions should live in the deck planning workbench"
);
[
  "mountStudioCommandControls",
  "mountThemeInputs",
  "mountGlobalEvents"
].forEach((functionName) => {
  assert(
    new RegExp(`function ${functionName}\\(\\)`).test(appSource) && new RegExp(`${functionName}\\(\\);`).test(appSource),
    `${functionName} should own one event-binding group and be mounted explicitly`
  );
});
assert(
  /function initializeStudioClient\(\)/.test(appSource) && /initializeStudioClient\(\);/.test(appSource),
  "Studio client startup should flow through an explicit initializer"
);

console.log("Client fixture validation passed.");
