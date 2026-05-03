// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// preview/slide-dom.ts and persistent writes go through server APIs.
import { StudioClientApiExplorerActions } from "./api/api-explorer-actions.ts";
import { StudioClientAppCallbacks } from "./core/app-callbacks.ts";
import { StudioClientCore } from "./core/core.ts";
import { StudioClientDeckContextActions } from "./planning/deck-context-actions.ts";
import { StudioClientDeckPlanningActions } from "./planning/deck-planning-actions.ts";
import { StudioClientDomPreviewWorkbench } from "./preview/dom-preview-workbench.ts";
import { StudioClientElements } from "./core/elements.ts";
import { StudioClientBuildValidationActions } from "./runtime/build-validation-actions.ts";
import { StudioClientNavigationShell } from "./shell/navigation-shell.ts";
import { StudioClientAssistantActions } from "./creation/assistant-actions.ts";
import { StudioClientCustomLayoutActions } from "./creation/custom-layout-actions.ts";
import { StudioClientPresentationCreationActions } from "./creation/presentation-creation-actions.ts";
import { StudioClientPresentationCreationWorkbench } from "./creation/presentation-creation-workbench.ts";
import { StudioClientPresentationLibraryActions } from "./creation/presentation-library-actions.ts";
import { StudioClientPreviewActions } from "./preview/preview-actions.ts";
import { StudioClientRuntimeStatusActions } from "./runtime/runtime-status-actions.ts";
import { StudioClientStartupActions } from "./shell/startup-actions.ts";
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
  createDomElement,
  highlightJsonSource,
  request,
  setBusy
} = StudioClientCore;
const elements: StudioClientElements.Elements = StudioClientElements.createElements(StudioClientCore);
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
  elements,
  state,
  windowRef: window
});
let variantReviewActions: StudioClientVariantReviewActions.VariantReviewActions;
let slideLoadActions: StudioClientSlideLoadActions.SlideLoadActions;
let workspaceRefreshActions: StudioClientWorkspaceRefreshActions.WorkspaceRefreshActions;
let deckPlanningActions: StudioClientDeckPlanningActions.DeckPlanningActions;
let assistantActions: StudioClientAssistantActions.AssistantActions;
let themePanelActions: StudioClientThemePanelActions.ThemePanelActions;
let runtimeStatusActions: StudioClientRuntimeStatusActions.RuntimeStatusActions;
let navigationShell: ReturnType<typeof StudioClientNavigationShell.createNavigationShell>;
let previewActions: StudioClientPreviewActions.PreviewActions;
const callbacks = StudioClientAppCallbacks.createAppCallbacks({
  getAssistantActions: () => assistantActions,
  getDeckContextActions: () => deckContextActions,
  getDeckPlanningActions: () => deckPlanningActions,
  getNavigationShell: () => navigationShell,
  getPresentationCreationActions: () => presentationCreationActions,
  getPresentationCreationWorkbench: () => presentationCreationWorkbench,
  getPreviewActions: () => previewActions,
  getRuntimeStatusActions: () => runtimeStatusActions,
  getSlideLoadActions: () => slideLoadActions,
  getThemeActions: () => themeActions,
  getThemePanelActions: () => themePanelActions,
  getVariantReviewActions: () => variantReviewActions,
  getWorkspaceRefreshActions: () => workspaceRefreshActions
});
const {
  getPresentationState,
  isWorkflowRunning,
  loadSlide,
  refreshState,
  renderAssistantSelection,
  renderCreationDraft,
  renderCreationThemeStage,
  renderDeckFields,
  renderDeckLengthPlan,
  renderDeckStructureCandidates,
  renderPreviews,
  renderSavedThemes,
  renderStatus,
  renderVariantComparison,
  renderVariants,
  resetThemeCandidates,
  setAssistantDrawerOpen,
  setChecksPanelOpen,
  setCurrentPage,
  setDeckStructureCandidates,
  setThemeDrawerOpen
} = callbacks;
const slideSelectionActions = StudioClientSlideSelectionActions.createSlideSelectionActions({
  getPresentationLibrary: () => presentationLibraryActions.getWorkbench(),
  loadSlide,
  state,
  windowRef: window
});
const variantActions = StudioClientVariantActions.createVariantActions({
  elements,
  getVariantReviewWorkbench: () => variantReviewActions.getWorkbench(),
  state,
  windowRef: window
});
const validationReportActions = StudioClientValidationReportActions.createValidationReportActions({
  elements,
  loadSlide,
  openVariantGenerationControls: variantActions.openGenerationControls,
  renderPreviews,
  renderStatus,
  renderVariants,
  state
});
const buildValidationActions = StudioClientBuildValidationActions.createBuildValidationActions({
  documentRef: window.document,
  elements,
  renderDeckFields,
  renderPreviews,
  renderStatus,
  renderValidation: validationReportActions.render,
  renderVariantComparison,
  state
});
const presentationLibraryActions = StudioClientPresentationLibraryActions.createPresentationLibraryActions({
  elements,
  getPresentationState,
  refreshState,
  renderDomSlide,
  setCurrentPage,
  state,
  windowRef: window
});
const slideEditorWorkbench = StudioClientSlideEditorWorkbench.createSlideEditorWorkbench({
  createDomElement,
  elements,
  highlightJsonSource,
  loadSlide,
  patchDomSlideSpec,
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
  setUrlSlideParam: slideSelectionActions.setUrlSlideParam,
  state
});
assistantActions = StudioClientAssistantActions.createAssistantActions({
  elements,
  options: {
    clearAssistantSelection,
    clearTransientVariants: variantActions.clearTransientVariants,
    elements,
    getRequestedCandidateCount: variantActions.getRequestedCandidateCount,
    openVariantGenerationControls: variantActions.openGenerationControls,
    renderDeckFields,
    renderDeckStructureCandidates,
    renderPreviews,
    renderStatus,
    renderValidation: validationReportActions.render,
    renderVariants,
    setAssistantDrawerOpen,
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
    elements,
    openVariantGenerationControls: variantActions.openGenerationControls,
    renderDomSlide,
    renderPreviews,
    renderSlideFields,
    renderStatus,
    renderVariants,
    setDomPreviewState,
    state
  },
  state
});
const presentationCreationWorkbench = StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench({
  createDomElement,
  elements,
  getPresentationState,
  isWorkflowRunning,
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
    saveCreationDraft: presentationCreationWorkbench.saveCreationDraft,
    saveDeckTheme: themeActions.saveDeckTheme,
    savePresentationTheme: themeActions.savePresentationTheme,
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
  state,
  windowRef: window
});
const exportCommands = StudioClientStartupActions.createExportCommands({
  buildDeck: buildValidationActions.buildDeck,
  elements,
  renderStatus,
  state,
  windowRef: window
});
const workflowActions = StudioClientWorkflowActions.createWorkflowActions({
  clearTransientVariants: variantActions.clearTransientVariants,
  elements,
  getRequestedCandidateCount: variantActions.getRequestedCandidateCount,
  openVariantGenerationControls: variantActions.openGenerationControls,
  renderDeckStructureCandidates,
  renderPreviews,
  renderStatus,
  renderVariants,
  setDeckStructureCandidates,
  state
});
variantReviewActions = StudioClientVariantReviewActions.createVariantReviewActions({
  elements,
  getSelectedVariant: variantActions.getSelectedVariant,
  getSlideVariants: variantActions.getSlideVariants,
  options: {
    customLayoutWorkbench: customLayoutActions,
    elements,
    getSlideSpecPathValue: slideEditorWorkbench.getSlideSpecPathValue,
    getVariantVisualTheme,
    hashFieldValue,
    loadSlide,
    parseSlideSpecEditor,
    pathToString,
    renderPreviews,
    setDomPreviewState,
    state,
    validate: buildValidationActions.validate,
    windowRef: window
  },
  state
});
runtimeStatusActions = StudioClientRuntimeStatusActions.createRuntimeStatusActions({
  customLayoutWorkbench: customLayoutActions,
  elements,
  getPresentationState,
  isEmptyCreationDraft: presentationCreationActions.isEmptyCreationDraft,
  presentationCreationWorkbench,
  renderApiExplorer: apiExplorerActions.render,
  renderCreationDraft,
  renderMaterials: slideEditorWorkbench.renderMaterialsPanel,
  renderSources: deckPlanningActions.renderSources,
  renderThemeDrawer: () => navigationShell.renderThemeDrawer(),
  renderVariantFlow: variantReviewActions.renderFlow,
  resetPresentationCreationControl: presentationCreationActions.resetControl,
  resetThemeCandidates,
  refreshState,
  setCurrentPage,
  state,
  windowRef: window
});
navigationShell = StudioClientNavigationShell.createNavigationShell({
  customLayoutWorkbench: customLayoutActions,
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
  renderCreationThemeStage,
  renderPreviews,
  setLlmPopoverOpen: runtimeStatusActions.setLlmPopoverOpen,
  state,
  toggleLlmPopover: runtimeStatusActions.toggleLlmPopover,
  windowRef: window
});
previewActions = StudioClientPreviewActions.createPreviewActions({
  customLayoutWorkbench: customLayoutActions,
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
const startupActions = StudioClientStartupActions.createStartupActions({
  commandControls: {
    build: {
      validate: buildValidationActions.validate
    },
    commands: {
      checkLlmProvider: runtimeStatusActions.checkLlmProvider,
      exportPdf: exportCommands.exportPdf,
      exportPptx: exportCommands.exportPptx,
      ideateDeckStructure: workflowActions.ideateDeckStructure,
      ideateSlide: workflowActions.ideateSlide,
      ideateStructure: workflowActions.ideateStructure,
      ideateTheme: workflowActions.ideateTheme,
      openPresentationMode: StudioClientStartupActions.createPresentationModeCommand({
        getPresentationId: () => getPresentationState().activePresentationId,
        state,
        windowRef: window
      }),
      redoLayout: workflowActions.redoLayout,
      renderManualSlideForm,
      renderPresentationLibrary: presentationLibraryActions.render,
      saveDeckContext: deckContextActions.saveDeckContext,
      saveSlideContext,
      saveValidationSettings: buildValidationActions.saveValidationSettings,
    },
    presentationCreationWorkbench,
    runtimeStatusWorkbench: runtimeStatusActions,
    slideEditorWorkbench,
    variantReview: {
      ensureWorkbench: variantReviewActions.ensureWorkbench,
      isLoaded: variantReviewActions.isLoaded
    }
  },
  documentRef: document,
  elements,
  navigationShell,
  state,
  windowRef: window
});

StudioClientStartupActions.initializeStudioClient({
  assistantActions,
  buildDeck: buildValidationActions.buildDeck,
  deckPlanningActions,
  elements,
  navigationShell,
  presentationCreationWorkbench,
  refreshState,
  renderManualSlideForm,
  runtimeStatusActions,
  startupActions,
  state,
  windowRef: window
});
