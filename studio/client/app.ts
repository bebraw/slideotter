// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// preview/slide-dom.ts and persistent writes go through server APIs.
import { StudioClientApiExplorerActions } from "./api/api-explorer-actions.ts";
import { StudioClientAppTheme } from "./shell/app-theme.ts";
import { StudioClientCore } from "./core/core.ts";
import { StudioClientDeckContextActions } from "./planning/deck-context-actions.ts";
import { StudioClientDeckPlanningActions } from "./planning/deck-planning-actions.ts";
import { StudioClientDomPreviewWorkbench } from "./preview/dom-preview-workbench.ts";
import { StudioClientElements } from "./core/elements.ts";
import { StudioClientExportActions } from "./exports/export-actions.ts";
import { StudioClientExportMenu } from "./shell/export-menu.ts";
import { StudioClientFileReaderActions } from "./core/file-reader-actions.ts";
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
let themePanelActions: StudioClientThemePanelActions.ThemePanelActions;
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
let variantReviewActions: StudioClientVariantReviewActions.VariantReviewActions;
let validationReportActions: StudioClientValidationReportActions.ValidationReportActions;
const variantActions = StudioClientVariantActions.createVariantActions({
  elements,
  getVariantReviewWorkbench: () => variantReviewActions.getWorkbench(),
  state,
  windowRef: window
});
validationReportActions = StudioClientValidationReportActions.createValidationReportActions({
  createDomElement,
  elements,
  loadSlide,
  openVariantGenerationControls: variantActions.openGenerationControls,
  renderPreviews,
  renderStatus,
  renderVariants,
  request,
  state
});
const slideEditorWorkbench = StudioClientSlideEditorWorkbench.createSlideEditorWorkbench({
  clearTransientVariants: variantActions.clearTransientVariants,
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
  clearTransientVariants: variantActions.clearTransientVariants,
  patchDomSlideSpec,
  renderPreviews,
  renderSlideFields,
  renderStatus,
  renderVariants,
  replacePersistedVariantsForSlide: variantActions.replacePersistedVariantsForSlide,
  request,
  setUrlSlideParam: slideSelectionActions.setUrlSlideParam,
  state
});
assistantActions = StudioClientAssistantActions.createAssistantActions({
  elements,
  options: {
    clearAssistantSelection,
    clearTransientVariants: variantActions.clearTransientVariants,
    createDomElement,
    elements,
    getRequestedCandidateCount: variantActions.getRequestedCandidateCount,
    openVariantGenerationControls: variantActions.openGenerationControls,
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
const customLayoutActions = StudioClientCustomLayoutActions.createCustomLayoutActions({
  elements,
  options: {
    applySlideSpecPayload,
    clearTransientVariants: variantActions.clearTransientVariants,
    createDomElement,
    elements,
    openVariantGenerationControls: variantActions.openGenerationControls,
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
const customLayoutWorkbenchProxy: StudioClientCustomLayoutActions.CustomLayoutWorkbench = {
  getLivePreviewSlideSpec: (slide, slideSpec) => customLayoutActions.getWorkbench()?.getLivePreviewSlideSpec(slide, slideSpec) || null,
  isSupported: () => customLayoutActions.isSupported(),
  mount: () => customLayoutActions.load(),
  renderEditor: () => customLayoutActions.renderEditor(),
  renderLayoutStudio: () => customLayoutActions.renderLayoutStudio(),
  renderLibrary: () => customLayoutActions.renderLibrary()
};
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
  resetPresentationSelection: slideSelectionActions.resetPresentationSelection,
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
      await buildValidationActions.buildDeck();
    },
    createDomElement,
    elements,
    loadSlide,
    presentationCreationWorkbench,
    presentationLibrary: {
      resetSelection: slideSelectionActions.resetPresentationSelection
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
    syncSelectedSlideToActiveList: slideSelectionActions.syncSelectedSlideToActiveList,
    windowRef: window
  },
  state
});
workspaceRefreshActions = StudioClientWorkspaceRefreshActions.createWorkspaceRefreshActions({
  elements,
  loadSlide,
  presentationCreationWorkbench,
  renderAssistant: assistantActions.render,
  renderCreationDraft,
  renderCustomLayoutLibrary: customLayoutActions.renderLibrary,
  renderDeckFields,
  renderDeckLengthPlan,
  renderDeckStructureCandidates,
  renderOutlinePlans: deckPlanningActions.renderOutlinePlans,
  renderPresentationLibrary: presentationLibraryActions.render,
  renderPreviews,
  renderSavedThemes,
  renderSources: deckPlanningActions.renderSources,
  renderStatus,
  renderVariants,
  request,
  state,
  syncSelectedSlideToActiveList: slideSelectionActions.syncSelectedSlideToActiveList
});
const presentationCreationActions = StudioClientPresentationCreationActions.createPresentationCreationActions({
  elements,
  state,
  workbench: presentationCreationWorkbench
});
const themeActions = StudioClientThemeActions.createThemeActions({
  buildDeck: buildValidationActions.buildDeck,
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
themePanelActions = StudioClientThemePanelActions.createThemePanelActions({
  elements,
  options: {
    applyCreationTheme: themeActions.applyCreationTheme,
    applyDeckThemeFields: themeActions.applyDeckThemeFields,
    applySavedTheme: themeActions.applySavedTheme,
    applySavedThemeToDeck: themeActions.applySavedThemeToDeck,
    createDomElement,
    elements,
    getBrief: () => themeActions.getDeckThemeBriefValue().trim() || elements.deckTitle.value.trim(),
    getCurrentTheme: themeActions.getDeckVisualThemeFromFields,
    getRequestContext: () => ({
      audience: elements.deckAudience.value,
      title: elements.deckTitle.value,
      tone: elements.deckTone.value
    }),
    persistSelectedThemeToDeck: themeActions.persistSelectedThemeToDeck,
    render: renderCreationThemeStage,
    renderDomSlide,
    request,
    saveCreationDraft: (...args) => presentationCreationWorkbench.saveCreationDraft(...args),
    saveDeckTheme: themeActions.saveDeckTheme,
    savePresentationTheme: themeActions.savePresentationTheme,
    setBusy,
    setThemeDrawerOpen,
    state,
    syncDeckThemeBrief: themeActions.setDeckThemeBriefValue
  },
  state
});
const deckContextActions = StudioClientDeckContextActions.createDeckContextActions({
  buildDeck: buildValidationActions.buildDeck,
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
const exportActions = StudioClientExportActions.createExportActions({
  buildDeck: buildValidationActions.buildDeck,
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
  clearTransientVariants: variantActions.clearTransientVariants,
  elements,
  getRequestedCandidateCount: variantActions.getRequestedCandidateCount,
  isAbortError,
  isCurrentAbortableRequest,
  openVariantGenerationControls: variantActions.openGenerationControls,
  postJson,
  renderDeckStructureCandidates,
  renderPreviews,
  renderStatus,
  renderVariants,
  setBusy,
  setDeckStructureCandidates,
  state
});
variantReviewActions = StudioClientVariantReviewActions.createVariantReviewActions({
  elements,
  getSelectedVariant: variantActions.getSelectedVariant,
  getSlideVariants: variantActions.getSlideVariants,
  options: {
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
    validate: buildValidationActions.validate,
    windowRef: window,
    workflowRunners: {
      ideateSlide: workflowActions.ideateSlide,
      ideateStructure: workflowActions.ideateStructure,
      ideateTheme: workflowActions.ideateTheme,
      redoLayout: workflowActions.redoLayout
    }
  },
  state
});
runtimeStatusWorkbench = StudioClientRuntimeStatusWorkbench.createRuntimeStatusWorkbench({
  createDomElement,
  customLayoutWorkbench: customLayoutWorkbenchProxy,
  elements,
  getPresentationState,
  isEmptyCreationDraft: presentationCreationActions.isEmptyCreationDraft,
  llmStatus,
  presentationCreationWorkbench,
  renderApiExplorer: apiExplorerActions.render,
  renderCreationDraft,
  renderMaterials: slideEditorWorkbench.renderMaterialsPanel,
  renderSources: deckPlanningActions.renderSources,
  renderThemeDrawer: () => navigationShell.renderThemeDrawer(),
  renderVariantFlow: variantReviewActions.renderFlow,
  request,
  resetPresentationCreationControl: presentationCreationActions.resetControl,
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
  getApiExplorerState: apiExplorerActions.getState,
  onAssistantOpen: assistantActions.load,
  onPageChange: (page) => {
    if (page === "presentations") {
      presentationLibraryActions.render();
    }
  },
  onOutlineOpen: deckPlanningActions.load,
  openApiExplorerResource: apiExplorerActions.openResource,
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
  getSelectedVariant: variantActions.getSelectedVariant,
  getVariantVisualTheme,
  presentationCreationWorkbench,
  renderDomSlide,
  renderImagePreview,
  selectSlideByIndex: slideSelectionActions.selectSlideByIndex,
  state
});

function renderStatus() {
  runtimeStatusWorkbench.renderStatus();
}

function setCurrentPage(page: string) {
  navigationShell.setCurrentPage(page);
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

function renderVariants() {
  variantReviewActions.render();
}

function renderVariantComparison() {
  variantReviewActions.renderComparison();
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

function renderDeckFields() {
  deckContextActions.renderDeckFields();
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

function resetThemeCandidates() {
  themeActions.resetThemeCandidates();
}

function isWorkflowRunning() {
  return presentationCreationActions.isWorkflowRunning();
}

function renderSavedThemes() {
  themePanelActions.renderSavedThemes();
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

async function loadSlide(slideId: string) {
  await slideLoadActions.loadSlide(slideId);
}

async function refreshState() {
  await workspaceRefreshActions.refreshState();
}

async function mountStudioCommandControls() {
  const { StudioClientCommandControls } = await import("./shell/command-controls.ts");
  StudioClientCommandControls.mountCommandControls({
    appTheme,
    build: {
      validate: buildValidationActions.validate
    },
    commands: {
      checkLlmProvider: runtimeStatusWorkbench.checkLlmProvider,
      closeExportMenu: () => exportMenu.close(),
      exportPdf: exportActions.exportPdf,
      exportPptx: exportActions.exportPptx,
      ideateDeckStructure: workflowActions.ideateDeckStructure,
      ideateSlide: workflowActions.ideateSlide,
      ideateStructure: workflowActions.ideateStructure,
      ideateTheme: workflowActions.ideateTheme,
      openPresentationMode: presentationModeActions.open,
      redoLayout: workflowActions.redoLayout,
      renderManualSlideForm,
      renderPresentationLibrary: presentationLibraryActions.render,
      saveDeckContext: deckContextActions.saveDeckContext,
      saveSlideContext,
      saveValidationSettings: buildValidationActions.saveValidationSettings,
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

function initializeStudioClient() {
  mountStudioCommandControls().catch((error: unknown) => {
    elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
  });
  presentationCreationWorkbench.mountInputs();
  import("./shell/global-events.ts")
    .then(({ StudioClientGlobalEvents }) => {
      StudioClientGlobalEvents.mountGlobalEvents({
        documentRef: window.document,
        exportMenu,
        navigationShell
      });
    })
    .catch((error: unknown) => {
      elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
    });

  state.ui.appTheme = appTheme.load();
  appTheme.apply(state.ui.appTheme);
  navigationShell.initializeState();
  if (state.ui.assistantOpen) {
    assistantActions.load();
  }
  if (state.ui.outlineDrawerOpen) {
    deckPlanningActions.load();
  }
  navigationShell.renderPages();
  navigationShell.renderAllDrawers();
  renderManualSlideForm();
  runtimeStatusWorkbench.connectRuntimeStream();

  refreshState()
    .then(async () => {
      runtimeStatusWorkbench.checkLlmProvider({ silent: true }).catch(() => {
        // Startup verification is best-effort; the popover keeps manual retry available.
      });

      if (!state.previews.pages.length) {
        await buildValidationActions.buildDeck();
      }
    })
    .catch((error) => {
      window.alert(error.message);
    });
}

initializeStudioClient();
