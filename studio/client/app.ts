// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// preview/slide-dom.ts and persistent writes go through server APIs.
import { StudioClientApiExplorerActions } from "./api/api-explorer-actions.ts";
import { StudioClientAppTheme } from "./shell/app-theme.ts";
import { StudioClientCommandControls } from "./shell/command-controls.ts";
import { StudioClientCore } from "./core/core.ts";
import { StudioClientDeckContextActions } from "./planning/deck-context-actions.ts";
import { StudioClientDeckPlanningActions } from "./planning/deck-planning-actions.ts";
import { StudioClientDomPreviewWorkbench } from "./preview/dom-preview-workbench.ts";
import { StudioClientElements } from "./core/elements.ts";
import { StudioClientExportActions } from "./exports/export-actions.ts";
import { StudioClientExportMenu } from "./shell/export-menu.ts";
import { StudioClientFileReaderActions } from "./core/file-reader-actions.ts";
import { StudioClientGlobalEvents } from "./shell/global-events.ts";
import { StudioClientLazyWorkbench } from "./core/lazy-workbench.ts";
import { StudioClientBuildValidationActions } from "./runtime/build-validation-actions.ts";
import { StudioClientLlmStatus } from "./runtime/llm-status.ts";
import { StudioClientNavigationShell } from "./shell/navigation-shell.ts";
import { StudioClientAssistantActions } from "./creation/assistant-actions.ts";
import { StudioClientCustomLayoutActions } from "./creation/custom-layout-actions.ts";
import { StudioClientPresentationCreationActions } from "./creation/presentation-creation-actions.ts";
import { StudioClientPresentationCreationWorkbench } from "./creation/presentation-creation-workbench.ts";
import { StudioClientPresentationLibraryActions } from "./creation/presentation-library-actions.ts";
import { StudioClientPresentationModeActions } from "./shell/presentation-mode-actions.ts";
import { StudioClientPreferences } from "./shell/preferences.ts";
import { StudioClientPreviewWorkbench } from "./preview/preview-workbench.ts";
import { StudioClientRuntimeStatusWorkbench } from "./runtime/runtime-status-workbench.ts";
import { StudioClientWorkspaceRefreshActions } from "./shell/workspace-refresh-actions.ts";
import { StudioClientValidationReportActions } from "./runtime/validation-report-actions.ts";
import { StudioClientWorkflowActions } from "./runtime/workflow-actions.ts";
import { StudioClientSlideLoadActions } from "./editor/slide-load-actions.ts";
import { StudioClientSlideEditorWorkbench } from "./editor/slide-editor-workbench.ts";
import { StudioClientSlideSelectionActions } from "./editor/slide-selection-actions.ts";
import { StudioClientState } from "./core/state.ts";
import { StudioClientThemeActions } from "./creation/theme-actions.ts";
import { StudioClientThemePanelActions } from "./creation/theme-panel-actions.ts";
import { StudioClientVariantActions } from "./variants/variant-actions.ts";
import { StudioClientVariantReviewActions } from "./variants/variant-review-actions.ts";
import type { StudioClientThemeFieldState } from "./creation/theme-field-state.ts";

type VariantReviewWorkbench = {
  clearTransientVariants: (slideId: string) => void;
  getSelectedVariant: () => VariantRecord | null;
  mount: () => void;
  openGenerationControls: () => void;
  render: () => void;
  renderComparison: () => void;
  renderFlow: () => void;
  replacePersistedVariantsForSlide: (slideId: string, variants: unknown) => void;
};

type CustomLayoutWorkbench = {
  getLivePreviewSlideSpec: (slide: StudioClientState.StudioSlide | undefined, slideSpec: JsonRecord | null) => JsonRecord | null;
  isSupported: () => boolean;
  mount: () => void;
  renderEditor: () => void;
  renderLayoutStudio: () => void;
  renderLibrary: () => void;
};

type PersistThemeOptions = StudioClientThemeActions.PersistThemeOptions;

type CheckLlmOptions = {
  silent?: boolean;
};

type JsonRecord = StudioClientState.JsonRecord;
type DeckThemeFields = StudioClientThemeFieldState.DeckThemeFields;
type VariantRecord = StudioClientState.VariantRecord;

type BuildPayload = StudioClientBuildValidationActions.BuildPayload;

const state: StudioClientState.State = StudioClientState.createInitialState();
const {
  beginAbortableRequest,
  clearAbortableRequest,
  isCurrentAbortableRequest
} = StudioClientState;

const {
  createDomElement,
  errorMessage,
  escapeHtml,
  formatSourceCode,
  highlightJsonSource,
  isAbortError,
  postJson,
  request,
  setBusy
} = StudioClientCore;
const elements: StudioClientElements.Elements = StudioClientElements.createElements(StudioClientCore);
const exportMenu = StudioClientExportMenu.createExportMenu(elements);
const fileReaderActions = StudioClientFileReaderActions.createFileReaderActions({
  windowRef: window
});
const domPreviewWorkbench = StudioClientDomPreviewWorkbench.createDomPreviewWorkbench({
  createDomElement,
  state,
  windowRef: window
});
const {
  getDomSlideSpec,
  getVariantVisualTheme,
  patchDomSlideSpec,
  renderDomSlide,
  renderImagePreview,
  setDomPreviewState
} = domPreviewWorkbench;
const apiExplorerActions = StudioClientApiExplorerActions.createApiExplorerActions({
  createDomElement,
  elements,
  request,
  state,
  windowRef: window
});
const validationReportActions = StudioClientValidationReportActions.createValidationReportActions({
  createDomElement,
  elements,
  loadSlide,
  openVariantGenerationControls,
  renderPreviews,
  renderStatus,
  renderVariants,
  request,
  state
});
const slideSelectionActions = StudioClientSlideSelectionActions.createSlideSelectionActions({
  getPresentationLibrary: () => presentationLibraryActions.getWorkbench(),
  loadSlide,
  state,
  windowRef: window
});
const buildValidationActions = StudioClientBuildValidationActions.createBuildValidationActions({
  documentRef: window.document,
  elements,
  renderDeckFields,
  renderPreviews,
  renderStatus,
  renderValidation,
  renderVariantComparison,
  request,
  setBusy,
  state
});
let slideLoadActions: StudioClientSlideLoadActions.SlideLoadActions;
let workspaceRefreshActions: StudioClientWorkspaceRefreshActions.WorkspaceRefreshActions;
const presentationLibraryActions = StudioClientPresentationLibraryActions.createPresentationLibraryActions({
  createDomElement,
  elements,
  getPresentationState,
  refreshState,
  renderDomSlide,
  request,
  setBusy,
  setCurrentPage,
  state,
  windowRef: window
});
const presentationModeActions = StudioClientPresentationModeActions.createPresentationModeActions({
  getPresentationId: () => getPresentationState().activePresentationId,
  state,
  windowRef: window
});
let deckPlanningActions: StudioClientDeckPlanningActions.DeckPlanningActions;
let assistantActions: StudioClientAssistantActions.AssistantActions;
const themePanelActions = StudioClientThemePanelActions.createThemePanelActions({
  elements,
  options: {
    applyCreationTheme,
    applyDeckThemeFields,
    applySavedTheme,
    applySavedThemeToDeck,
    createDomElement,
    elements,
    getBrief: () => getDeckThemeBriefValue().trim() || elements.deckTitle.value.trim(),
    getCurrentTheme: getDeckVisualThemeFromFields,
    getRequestContext: () => ({
      audience: elements.deckAudience.value,
      title: elements.deckTitle.value,
      tone: elements.deckTone.value
    }),
    persistSelectedThemeToDeck,
    render: renderCreationThemeStage,
    renderDomSlide,
    request,
    saveCreationDraft: (...args) => presentationCreationWorkbench.saveCreationDraft(...args),
    saveDeckTheme,
    savePresentationTheme,
    setBusy,
    setThemeDrawerOpen,
    state,
    syncDeckThemeBrief: setDeckThemeBriefValue
  },
  state
});
const appTheme = StudioClientAppTheme.createAppTheme({
  document,
  elements,
  preferences: StudioClientPreferences,
  state
});
const llmStatus = StudioClientLlmStatus.createLlmStatus({
  renderStatus,
  state
});
let runtimeStatusWorkbench: ReturnType<typeof StudioClientRuntimeStatusWorkbench.createRuntimeStatusWorkbench>;
let navigationShell: ReturnType<typeof StudioClientNavigationShell.createNavigationShell>;
let previewWorkbench: ReturnType<typeof StudioClientPreviewWorkbench.createPreviewWorkbench>;
const slideEditorWorkbench = StudioClientSlideEditorWorkbench.createSlideEditorWorkbench({
  clearTransientVariants,
  createDomElement,
  elements,
  highlightJsonSource,
  loadSlide,
  patchDomSlideSpec,
  readFileAsDataUrl: fileReaderActions.readFileAsDataUrl,
  renderAssistantSelection,
  renderDeckFields,
  renderDeckLengthPlan,
  renderDeckStructureCandidates,
  renderPreviews,
  renderStatus,
  renderVariantComparison,
  renderVariants,
  request,
  setBusy,
  setCurrentPage,
  setDomPreviewState,
  state,
  windowRef: window
});
const {
  applySlideSpecPayload,
  clearAssistantSelection,
  enableDomSlideTextEditing,
  hashFieldValue,
  parseSlideSpecEditor,
  pathToString,
  renderManualDeckEditOptions,
  renderManualSlideForm,
  renderSlideFields,
  saveSlideContext
} = slideEditorWorkbench;
slideLoadActions = StudioClientSlideLoadActions.createSlideLoadActions({
  clearAssistantSelection,
  clearTransientVariants,
  patchDomSlideSpec,
  renderPreviews,
  renderSlideFields,
  renderStatus,
  renderVariants,
  replacePersistedVariantsForSlide,
  request,
  setUrlSlideParam: slideSelectionActions.setUrlSlideParam,
  state
});
assistantActions = StudioClientAssistantActions.createAssistantActions({
  elements,
  options: {
    clearAssistantSelection,
    clearTransientVariants,
    createDomElement,
    elements,
    getRequestedCandidateCount,
    openVariantGenerationControls,
    postJson,
    renderDeckFields,
    renderDeckStructureCandidates,
    renderPreviews,
    renderStatus,
    renderValidation,
    renderVariants,
    setAssistantDrawerOpen,
    setBusy,
    setChecksPanelOpen,
    setDeckStructureCandidates,
    state,
    windowRef: window
  },
  state
});
const getSlideSpecPathValue = slideEditorWorkbench.getSlideSpecPathValue;
const presentationCreationWorkbench = StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench({
  createDomElement,
  elements,
  escapeHtml,
  getPresentationState,
  isWorkflowRunning,
  readFileAsDataUrl: fileReaderActions.readFileAsDataUrl,
  renderCreationThemeStage,
  renderDomSlide,
  renderSavedThemes,
  resetThemeCandidates,
  resetPresentationSelection,
  refreshState,
  request,
  setBusy,
  setCurrentPage,
  state,
  windowRef: window
});
deckPlanningActions = StudioClientDeckPlanningActions.createDeckPlanningActions({
  elements,
  options: {
    buildDeck: async () => {
      await buildDeck();
    },
    createDomElement,
    elements,
    loadSlide,
    presentationCreationWorkbench,
    presentationLibrary: {
      resetSelection: resetPresentationSelection
    },
    refreshState,
    renderCreationDraft,
    renderDeckFields,
    renderPreviews,
    renderStatus,
    renderVariants,
    request,
    setBusy,
    setCurrentPage,
    setDomPreviewState,
    state,
    syncSelectedSlideToActiveList,
    windowRef: window
  },
  state
});
workspaceRefreshActions = StudioClientWorkspaceRefreshActions.createWorkspaceRefreshActions({
  elements,
  loadSlide,
  presentationCreationWorkbench,
  renderAssistant,
  renderCreationDraft,
  renderCustomLayoutLibrary,
  renderDeckFields,
  renderDeckLengthPlan,
  renderDeckStructureCandidates,
  renderOutlinePlans,
  renderPresentationLibrary,
  renderPreviews,
  renderSavedThemes,
  renderSources,
  renderStatus,
  renderVariants,
  request,
  state,
  syncSelectedSlideToActiveList
});
const presentationCreationActions = StudioClientPresentationCreationActions.createPresentationCreationActions({
  elements,
  state,
  workbench: presentationCreationWorkbench
});
const themeActions = StudioClientThemeActions.createThemeActions({
  buildDeck,
  elements,
  getThemeWorkbench: () => themePanelActions.getWorkbench(),
  presentationCreationWorkbench,
  renderCreationThemeStage,
  renderPreviews,
  renderSavedThemes,
  request,
  setBusy,
  setThemeDrawerOpen,
  state,
  windowRef: window
});
const deckContextActions = StudioClientDeckContextActions.createDeckContextActions({
  buildDeck,
  elements,
  renderDeckLengthPlan,
  renderDeckStructureCandidates,
  renderManualDeckEditOptions,
  renderPreviews,
  renderVariants,
  request,
  setBusy,
  state,
  windowRef: window
});
const variantActions = StudioClientVariantActions.createVariantActions({
  elements,
  getVariantReviewWorkbench: () => variantReviewActions.getWorkbench(),
  state,
  windowRef: window
});
const exportActions = StudioClientExportActions.createExportActions({
  buildDeck,
  elements,
  renderStatus,
  request,
  setBusy,
  state,
  windowRef: window
});
const workflowActions = StudioClientWorkflowActions.createWorkflowActions({
  beginAbortableRequest,
  clearAbortableRequest,
  clearTransientVariants,
  elements,
  getRequestedCandidateCount,
  isAbortError,
  isCurrentAbortableRequest,
  openVariantGenerationControls,
  postJson,
  renderDeckStructureCandidates,
  renderPreviews,
  renderStatus,
  renderVariants,
  setBusy,
  setDeckStructureCandidates,
  state
});
const customLayoutActions = StudioClientCustomLayoutActions.createCustomLayoutActions({
  elements,
  options: {
    applySlideSpecPayload,
    clearTransientVariants,
    createDomElement,
    elements,
    openVariantGenerationControls,
    renderDomSlide,
    renderPreviews,
    renderSlideFields,
    renderStatus,
    renderVariants,
    request,
    setBusy,
    setDomPreviewState,
    state
  },
  state
});
const customLayoutWorkbenchProxy: CustomLayoutWorkbench = {
  getLivePreviewSlideSpec: (slide, slideSpec) => customLayoutActions.getWorkbench()?.getLivePreviewSlideSpec(slide, slideSpec) || null,
  isSupported: () => customLayoutActions.isSupported(),
  mount: () => customLayoutActions.load(),
  renderEditor: () => customLayoutActions.renderEditor(),
  renderLayoutStudio: () => customLayoutActions.renderLayoutStudio(),
  renderLibrary: renderCustomLayoutLibrary
};
const variantReviewLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<VariantReviewWorkbench>({
  create: async () => {
    const { StudioClientVariantReviewWorkbench } = await import("./variants/variant-review-workbench.ts");
    return StudioClientVariantReviewWorkbench.createVariantReviewWorkbench({
      createDomElement,
      customLayoutWorkbench: customLayoutWorkbenchProxy,
      elements,
      escapeHtml,
      formatSourceCode,
      getSlideSpecPathValue,
      getVariantVisualTheme,
      hashFieldValue,
      loadSlide,
      parseSlideSpecEditor,
      pathToString,
      renderPreviews,
      request,
      setBusy,
      setDomPreviewState,
      state,
      validate,
      windowRef: window,
      workflowRunners: {
        ideateSlide,
        ideateStructure,
        ideateTheme,
        redoLayout
      }
    });
  },
  mount: (workbench) => workbench.mount()
});
const variantReviewActions = StudioClientVariantReviewActions.createVariantReviewActions({
  elements,
  getSelectedVariant,
  getSlideVariants,
  lazyWorkbench: variantReviewLazyWorkbench,
  state
});
runtimeStatusWorkbench = StudioClientRuntimeStatusWorkbench.createRuntimeStatusWorkbench({
  createDomElement,
  customLayoutWorkbench: customLayoutWorkbenchProxy,
  elements,
  getPresentationState,
  isEmptyCreationDraft,
  llmStatus,
  presentationCreationWorkbench,
  renderApiExplorer,
  renderCreationDraft,
  renderMaterials,
  renderSources,
  renderThemeDrawer: () => navigationShell.renderThemeDrawer(),
  renderVariantFlow,
  request,
  resetPresentationCreationControl,
  resetThemeCandidates,
  refreshState,
  setBusy,
  setCurrentPage,
  state,
  windowRef: window
});
navigationShell = StudioClientNavigationShell.createNavigationShell({
  customLayoutWorkbench: customLayoutWorkbenchProxy,
  documentRef: document,
  elements,
  getApiExplorerState,
  onAssistantOpen: loadAssistantWorkbench,
  onPageChange: (page) => {
    if (page === "presentations") {
      renderPresentationLibrary();
    }
  },
  onOutlineOpen: loadDeckPlanningWorkbench,
  openApiExplorerResource,
  preferences: StudioClientPreferences,
  renderCreationThemeStage,
  renderPreviews,
  setLlmPopoverOpen: (open) => runtimeStatusWorkbench.setLlmPopoverOpen(open),
  state,
  toggleLlmPopover: () => runtimeStatusWorkbench.toggleLlmPopover(),
  windowRef: window
});
previewWorkbench = StudioClientPreviewWorkbench.createPreviewWorkbench({
  createDomElement,
  customLayoutWorkbench: customLayoutWorkbenchProxy,
  elements,
  enableDomSlideTextEditing,
  getDomSlideSpec,
  getSelectedVariant,
  getVariantVisualTheme,
  presentationCreationWorkbench,
  renderDomSlide,
  renderImagePreview,
  selectSlideByIndex,
  state
});

function renderMaterials() {
  slideEditorWorkbench.renderMaterials();
  slideEditorWorkbench.renderCustomVisuals();
}

function renderStatus() {
  runtimeStatusWorkbench.renderStatus();
}

function setCurrentPage(page: string) {
  navigationShell.setCurrentPage(page);
  if (page === "presentations") {
    renderPresentationLibrary();
  }
}

function setChecksPanelOpen(open: boolean) {
  navigationShell.setChecksPanelOpen(open);
}

function setAssistantDrawerOpen(open: boolean) {
  navigationShell.setAssistantDrawerOpen(open);
}

function setThemeDrawerOpen(open: boolean) {
  navigationShell.setThemeDrawerOpen(open);
}

function renderCustomLayoutLibrary(): void {
  customLayoutActions.renderLibrary();
}

function getSlideVariants(): VariantRecord[] {
  return variantActions.getSlideVariants();
}

function loadVariantReviewWorkbench(): void {
  variantReviewActions.load();
}

function getSelectedVariant() {
  return variantActions.getSelectedVariant();
}

function clearTransientVariants(slideId: string) {
  variantActions.clearTransientVariants(slideId);
}

function openVariantGenerationControls() {
  variantActions.openGenerationControls();
}

function renderVariantFlow() {
  variantReviewActions.renderFlow();
}

function renderVariants() {
  variantReviewActions.render();
}

function renderVariantComparison() {
  variantReviewActions.renderComparison();
}

function replacePersistedVariantsForSlide(slideId: string, variants: VariantRecord[]) {
  variantActions.replacePersistedVariantsForSlide(slideId, variants);
}

async function getRequestedCandidateCount() {
  return variantActions.getRequestedCandidateCount();
}

function loadDeckPlanningWorkbench(): void {
  deckPlanningActions.load();
}

function renderDeckLengthPlan() {
  deckPlanningActions.renderDeckLengthPlan();
}

function setDeckStructureCandidates(candidates: unknown[] | undefined) {
  deckPlanningActions.setDeckStructureCandidates(candidates);
}

function renderDeckStructureCandidates() {
  deckPlanningActions.renderDeckStructureCandidates();
}

function renderSources() {
  deckPlanningActions.renderSources();
}

function renderOutlinePlans() {
  deckPlanningActions.renderOutlinePlans();
}

function getApiExplorerState() {
  return apiExplorerActions.getState();
}

function renderApiExplorer() {
  apiExplorerActions.render();
}

async function openApiExplorerResource(href: string, options: Parameters<StudioClientApiExplorerActions.ApiExplorerActions["openResource"]>[1] = {}) {
  return apiExplorerActions.openResource(href, options);
}

function renderDeckFields() {
  deckContextActions.renderDeckFields();
}

function loadAssistantWorkbench(): void {
  assistantActions.load();
}

function renderAssistant() {
  assistantActions.render();
}

function renderAssistantSelection() {
  assistantActions.renderSelection();
}

function renderPreviews() {
  previewWorkbench.render();
}

function getPresentationState() {
  return presentationCreationActions.getPresentationState();
}

function loadThemeWorkbench(): void {
  themePanelActions.load();
}

function resetPresentationSelection(): void {
  slideSelectionActions.resetPresentationSelection();
}

function renderPresentationLibrary(): void {
  presentationLibraryActions.render();
}

function resetThemeCandidates() {
  themeActions.resetThemeCandidates();
}

function applyCreationTheme(theme: DeckThemeFields | undefined) {
  themeActions.applyCreationTheme(theme);
}

function getSelectedCreationThemeVariant() {
  return themeActions.getSelectedCreationThemeVariant();
}

function isWorkflowRunning() {
  return presentationCreationActions.isWorkflowRunning();
}

function isEmptyCreationDraft(draft: StudioClientState.CreationDraft | null) {
  return presentationCreationActions.isEmptyCreationDraft(draft);
}

function resetPresentationCreationControl() {
  presentationCreationActions.resetControl();
}

function renderSavedThemes() {
  themePanelActions.renderSavedThemes();
}

function applySavedTheme(themeId: string) {
  themeActions.applySavedTheme(themeId);
}

function getDeckVisualThemeFromFields() {
  return themeActions.getDeckVisualThemeFromFields();
}

function applyDeckThemeFields(theme: DeckThemeFields = {}) {
  themeActions.applyDeckThemeFields(theme);
}

function setDeckThemeBriefValue(value: unknown) {
  themeActions.setDeckThemeBriefValue(value);
}

function getDeckThemeBriefValue() {
  return themeActions.getDeckThemeBriefValue();
}

function applySavedThemeToDeck(themeId: string | undefined) {
  themeActions.applySavedThemeToDeck(themeId);
}

function renderCreationThemeStage() {
  themePanelActions.renderStage();
}

function renderCreationDraft() {
  presentationCreationWorkbench.renderDraft();
}

function renderValidation() {
  validationReportActions.render();
}

function syncSelectedSlideToActiveList() {
  return slideSelectionActions.syncSelectedSlideToActiveList();
}

async function loadSlide(slideId: string) {
  await slideLoadActions.loadSlide(slideId);
}

async function selectSlideByIndex(index: number) {
  await slideSelectionActions.selectSlideByIndex(index);
}

async function savePresentationTheme() {
  await themeActions.savePresentationTheme();
}

async function persistSelectedThemeToDeck(options: PersistThemeOptions = {}) {
  await themeActions.persistSelectedThemeToDeck(options);
}

function openPresentationMode() {
  presentationModeActions.open();
}

async function saveDeckTheme() {
  await themeActions.saveDeckTheme();
}

async function refreshState() {
  await workspaceRefreshActions.refreshState();
}

async function saveDeckContext() {
  await deckContextActions.saveDeckContext();
}

async function saveValidationSettings() {
  await buildValidationActions.saveValidationSettings();
}

async function buildDeck(): Promise<BuildPayload> {
  return buildValidationActions.buildDeck();
}

async function validate(includeRender: boolean) {
  await buildValidationActions.validate(includeRender);
}

async function exportPdf() {
  await exportActions.exportPdf();
}

async function exportPptx() {
  await exportActions.exportPptx();
}

async function checkLlmProvider(options: CheckLlmOptions = {}) {
  return runtimeStatusWorkbench.checkLlmProvider(options);
}

async function ideateSlide() {
  return workflowActions.ideateSlide();
}

async function ideateTheme() {
  return workflowActions.ideateTheme();
}

async function ideateDeckStructure() {
  return workflowActions.ideateDeckStructure();
}

async function ideateStructure() {
  return workflowActions.ideateStructure();
}

async function redoLayout() {
  return workflowActions.redoLayout();
}

function mountStudioCommandControls() {
  StudioClientCommandControls.mountCommandControls({
    appTheme,
    build: {
      validate
    },
    commands: {
      checkLlmProvider,
      closeExportMenu: () => exportMenu.close(),
      exportPdf,
      exportPptx,
      ideateDeckStructure,
      ideateSlide,
      ideateStructure,
      ideateTheme,
      openPresentationMode,
      redoLayout,
      renderManualSlideForm,
      renderPresentationLibrary,
      saveDeckContext,
      saveSlideContext,
      saveValidationSettings,
      toggleExportMenu: () => exportMenu.toggle()
    },
    elements,
    navigationShell,
    presentationCreationWorkbench,
    runtimeStatusWorkbench,
    slideEditorWorkbench,
    variantReview: {
      ensureWorkbench: variantReviewActions.ensureWorkbench,
      isLoaded: variantReviewActions.isLoaded
    },
    windowRef: window
  });
}

function mountGlobalEvents() {
  StudioClientGlobalEvents.mountGlobalEvents({
    documentRef: window.document,
    exportMenu,
    navigationShell
  });
}

function initializeStudioClient() {
  mountStudioCommandControls();
  presentationCreationWorkbench.mountInputs();
  mountGlobalEvents();

  state.ui.appTheme = appTheme.load();
  appTheme.apply(state.ui.appTheme);
  navigationShell.initializeState();
  if (state.ui.assistantOpen) {
    loadAssistantWorkbench();
  }
  if (state.ui.outlineDrawerOpen) {
    loadDeckPlanningWorkbench();
  }
  navigationShell.renderPages();
  navigationShell.renderAllDrawers();
  renderManualSlideForm();
  runtimeStatusWorkbench.connectRuntimeStream();

  refreshState()
    .then(async () => {
      checkLlmProvider({ silent: true }).catch(() => {
        // Startup verification is best-effort; the popover keeps manual retry available.
      });

      if (!state.previews.pages.length) {
        await buildDeck();
      }
    })
    .catch((error) => {
      window.alert(error.message);
    });
}

initializeStudioClient();
