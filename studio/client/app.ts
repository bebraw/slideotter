// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// preview/slide-dom.ts and persistent writes go through server APIs.
import { StudioClientApiExplorerState } from "./api/api-explorer-state.ts";
import { StudioClientAppTheme } from "./shell/app-theme.ts";
import { StudioClientCommandControls } from "./shell/command-controls.ts";
import { StudioClientCore } from "./core/core.ts";
import { StudioClientDeckContextActions } from "./planning/deck-context-actions.ts";
import { StudioClientDomPreviewWorkbench } from "./preview/dom-preview-workbench.ts";
import { StudioClientElements } from "./core/elements.ts";
import { StudioClientExportMenu } from "./shell/export-menu.ts";
import { StudioClientGlobalEvents } from "./shell/global-events.ts";
import { StudioClientLazyWorkbench } from "./core/lazy-workbench.ts";
import { StudioClientLlmStatus } from "./runtime/llm-status.ts";
import { StudioClientNavigationShell } from "./shell/navigation-shell.ts";
import { StudioClientPresentationCreationActions } from "./creation/presentation-creation-actions.ts";
import { StudioClientPresentationCreationWorkbench } from "./creation/presentation-creation-workbench.ts";
import { StudioClientPreferences } from "./shell/preferences.ts";
import { StudioClientPreviewWorkbench } from "./preview/preview-workbench.ts";
import { StudioClientRuntimeStatusWorkbench } from "./runtime/runtime-status-workbench.ts";
import { StudioClientSlideEditorWorkbench } from "./editor/slide-editor-workbench.ts";
import { StudioClientSlideSelectionActions } from "./editor/slide-selection-actions.ts";
import { StudioClientState } from "./core/state.ts";
import { StudioClientThemeActions } from "./creation/theme-actions.ts";
import { StudioClientVariantActions } from "./variants/variant-actions.ts";
import type { StudioClientBuildValidationWorkbench } from "./runtime/build-validation-workbench.ts";
import type { StudioClientWorkspaceRefreshWorkbench } from "./shell/workspace-refresh-workbench.ts";
import type { StudioClientThemeFieldState } from "./creation/theme-field-state.ts";

type ApiExplorerOpenOptions = {
  pushHistory?: boolean;
};

type ApiExplorerState = StudioClientApiExplorerState.ApiExplorerState;

type ApiExplorerWorkbench = {
  getState: () => ApiExplorerState;
  mount: () => void;
  openResource: (href: string | null | undefined, options?: ApiExplorerOpenOptions) => Promise<void>;
  render: () => void;
};

type ValidationReportWorkbench = {
  render: () => void;
};

type SlideLoadWorkbench = {
  loadSlide: (slideId: string) => Promise<void>;
};

type WorkspaceRefreshWorkbench = StudioClientWorkspaceRefreshWorkbench.WorkspaceRefreshWorkbench;

type BuildValidationWorkbench = {
  buildDeck: () => Promise<BuildPayload>;
  saveValidationSettings: () => Promise<void>;
  validate: (includeRender: boolean) => Promise<void>;
};

type ExportWorkbench = {
  exportPdf: () => Promise<void>;
  exportPptx: () => Promise<void>;
};

type WorkflowWorkbench = {
  ideateDeckStructure: () => Promise<void>;
  ideateSlide: () => Promise<void>;
  ideateStructure: () => Promise<void>;
  ideateTheme: () => Promise<void>;
  redoLayout: () => Promise<void>;
};

type PresentationLibraryWorkbench = {
  render: () => void;
  resetSelection: () => void;
};

type PresentationModeWorkbench = {
  openPresentationMode: () => void;
};

type DeckPlanningWorkbench = {
  mount: () => void;
  renderDeckLengthPlan: () => void;
  renderDeckStructureCandidates: () => void;
  renderOutlinePlans: () => void;
  renderSources: () => void;
  setDeckStructureCandidates: (candidates: unknown) => void;
};

type AssistantWorkbench = {
  mount: () => void;
  render: () => void;
  renderSelection: () => void;
};

type ThemeWorkbench = {
  getSelectedVariant: () => ReturnType<StudioClientThemeActions.ThemeActions["getSelectedCreationThemeVariant"]>;
  mount: () => void;
  renderSavedThemes: () => void;
  renderStage: () => void;
  resetCandidates: () => void;
};

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

type BuildPayload = StudioClientBuildValidationWorkbench.BuildPayload;

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
let apiExplorer: ApiExplorerWorkbench | null = null;
let presentationLibrary: PresentationLibraryWorkbench | null = null;
let deckPlanningWorkbench: DeckPlanningWorkbench | null = null;
let pendingDeckStructureCandidates: unknown = undefined;
let assistantWorkbench: AssistantWorkbench | null = null;
let themeWorkbench: ThemeWorkbench | null = null;
let variantReviewWorkbench: VariantReviewWorkbench | null = null;
let customLayoutWorkbench: CustomLayoutWorkbench | null = null;
const apiExplorerWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ApiExplorerWorkbench>({
  create: async () => {
    const { StudioClientApiExplorer } = await import("./api/api-explorer.ts");
    return StudioClientApiExplorer.createApiExplorer({
      createDomElement,
      elements,
      request,
      state,
      window
    });
  },
  mount: (workbench) => workbench.mount()
});
const validationReportWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ValidationReportWorkbench>({
  create: async () => {
    const { StudioClientValidationReportWorkbench } = await import("./runtime/validation-report-workbench.ts");
    return StudioClientValidationReportWorkbench.createValidationReportWorkbench({
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
  }
});
const slideSelectionActions = StudioClientSlideSelectionActions.createSlideSelectionActions({
  getPresentationLibrary: () => presentationLibrary,
  loadSlide,
  state,
  windowRef: window
});
const buildValidationWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<BuildValidationWorkbench>({
  create: async () => {
    const { StudioClientBuildValidationWorkbench } = await import("./runtime/build-validation-workbench.ts");
    return StudioClientBuildValidationWorkbench.createBuildValidationWorkbench({
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
  }
});
const slideLoadWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<SlideLoadWorkbench>({
  create: async () => {
    const { StudioClientSlideLoadWorkbench } = await import("./editor/slide-load-workbench.ts");
    return StudioClientSlideLoadWorkbench.createSlideLoadWorkbench({
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
  }
});
const workspaceRefreshWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<WorkspaceRefreshWorkbench>({
  create: async () => {
    const { StudioClientWorkspaceRefreshWorkbench } = await import("./shell/workspace-refresh-workbench.ts");
    return StudioClientWorkspaceRefreshWorkbench.createWorkspaceRefreshWorkbench({
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
  }
});
const presentationLibraryWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<PresentationLibraryWorkbench>({
  create: async () => {
    const { StudioClientPresentationLibrary } = await import("./creation/presentation-library.ts");
    return StudioClientPresentationLibrary.createPresentationLibrary({
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
  }
});
const presentationModeLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<PresentationModeWorkbench>({
  create: async () => {
    const { StudioClientPresentationModeWorkbench } = await import("./shell/presentation-mode-workbench.ts");
    return StudioClientPresentationModeWorkbench.createPresentationModeWorkbench({
      getPresentationId: () => getPresentationState().activePresentationId,
      state,
      windowRef: window
    });
  }
});
const deckPlanningLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<DeckPlanningWorkbench>({
  create: async () => {
    const { StudioClientDeckPlanningWorkbench } = await import("./planning/deck-planning-workbench.ts");
    return StudioClientDeckPlanningWorkbench.createDeckPlanningWorkbench({
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
    });
  },
  mount: (workbench) => workbench.mount()
});
const assistantLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<AssistantWorkbench>({
  create: async () => {
    const { StudioClientAssistantWorkbench } = await import("./creation/assistant-workbench.ts");
    return StudioClientAssistantWorkbench.createAssistantWorkbench({
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
    });
  },
  mount: (workbench) => workbench.mount()
});
const themeLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ThemeWorkbench>({
  create: async () => {
    const { StudioClientThemeWorkbench } = await import("./creation/theme-workbench.ts");
    return StudioClientThemeWorkbench.createThemeWorkbench({
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
    });
  },
  mount: (workbench) => workbench.mount()
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
  readFileAsDataUrl,
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
const presentationCreationWorkbench = StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench({
  createDomElement,
  elements,
  escapeHtml,
  getPresentationState,
  isWorkflowRunning,
  readFileAsDataUrl,
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
const presentationCreationActions = StudioClientPresentationCreationActions.createPresentationCreationActions({
  elements,
  state,
  workbench: presentationCreationWorkbench
});
const themeActions = StudioClientThemeActions.createThemeActions({
  buildDeck,
  elements,
  getThemeWorkbench: () => themeWorkbench,
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
  getVariantReviewWorkbench: () => variantReviewWorkbench,
  state
});
const exportWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ExportWorkbench>({
  create: async () => {
    const { StudioClientExportWorkbench } = await import("./exports/export-workbench.ts");
    return StudioClientExportWorkbench.createExportWorkbench({
      buildDeck,
      elements,
      renderStatus,
      request,
      setBusy,
      state,
      window
    });
  }
});
const workflowWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<WorkflowWorkbench>({
  create: async () => {
    const { StudioClientWorkflowWorkbench } = await import("./runtime/workflow-workbench.ts");
    return StudioClientWorkflowWorkbench.createWorkflowWorkbench({
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
  }
});
const customLayoutLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<CustomLayoutWorkbench>({
  create: async () => {
    const { StudioClientCustomLayoutWorkbench } = await import("./creation/custom-layout-workbench.ts");
    return StudioClientCustomLayoutWorkbench.createCustomLayoutWorkbench({
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
    });
  },
  mount: (workbench) => workbench.mount()
});
const customLayoutWorkbenchProxy: CustomLayoutWorkbench = {
  getLivePreviewSlideSpec: (slide, slideSpec) => customLayoutWorkbench?.getLivePreviewSlideSpec(slide, slideSpec) || null,
  isSupported: () => customLayoutWorkbench ? customLayoutWorkbench.isSupported() : isCustomLayoutSupported(),
  mount: loadCustomLayoutWorkbench,
  renderEditor: renderCustomLayoutEditor,
  renderLayoutStudio: renderCustomLayoutStudio,
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

function pathToString(path: Array<string | number>) {
  return slideEditorWorkbench.pathToString(path);
}

function hashFieldValue(value: unknown) {
  return slideEditorWorkbench.hashFieldValue(value);
}

function getSlideSpecPathValue(slideSpec: unknown, path: Array<string | number>) {
  return slideEditorWorkbench.getSlideSpecPathValue(slideSpec, path);
}

function applySlideSpecPayload(payload: unknown, fallbackSpec: unknown) {
  slideEditorWorkbench.applySlideSpecPayload(payload, fallbackSpec);
}

async function readFileAsDataUrl(file: Blob) {
  const { StudioClientFileReader } = await import("./core/file-reader.ts");
  return StudioClientFileReader.readAsDataUrl(window, file);
}

function clearAssistantSelection() {
  slideEditorWorkbench.clearAssistantSelection();
}

function renderManualDeckEditOptions() {
  slideEditorWorkbench.renderManualDeckEditOptions();
}

function renderSlideFields() {
  slideEditorWorkbench.renderSlideFields();
}

function renderMaterials() {
  slideEditorWorkbench.renderMaterials();
  slideEditorWorkbench.renderCustomVisuals();
}

function renderManualSlideForm() {
  slideEditorWorkbench.renderManualSlideForm();
}

function parseSlideSpecEditor() {
  return slideEditorWorkbench.parseSlideSpecEditor();
}

function saveSlideContext() {
  return slideEditorWorkbench.saveSlideContext();
}

function enableDomSlideTextEditing(viewport: HTMLElement) {
  slideEditorWorkbench.enableDomSlideTextEditing(viewport);
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

function isCustomLayoutSupported(): boolean {
  return Boolean(state.selectedSlideSpec && ["content", "cover"].includes(String(state.selectedSlideSpec.type || "")));
}

async function getCustomLayoutWorkbench(): Promise<CustomLayoutWorkbench> {
  customLayoutWorkbench = await customLayoutLazyWorkbench.load();
  return customLayoutWorkbench;
}

function loadCustomLayoutWorkbench(): void {
  getCustomLayoutWorkbench()
    .then((workbench) => {
      workbench.renderLibrary();
      workbench.renderEditor();
      workbench.renderLayoutStudio();
    })
    .catch((error: unknown) => {
      elements.customLayoutStatus.textContent = errorMessage(error);
    });
}

function renderCustomLayoutEditor(): void {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadCustomLayoutWorkbench,
    render: (workbench) => workbench.renderEditor(),
    shouldLoad: () => state.ui.layoutDrawerOpen,
    workbench: customLayoutWorkbench
  });
}

function renderCustomLayoutStudio(): void {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadCustomLayoutWorkbench,
    render: (workbench) => workbench.renderLayoutStudio(),
    shouldLoad: () => state.ui.layoutDrawerOpen,
    workbench: customLayoutWorkbench
  });
}

function renderCustomLayoutLibrary(): void {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadCustomLayoutWorkbench,
    render: (workbench) => workbench.renderLibrary(),
    shouldLoad: () => state.ui.layoutDrawerOpen,
    workbench: customLayoutWorkbench
  });
}

function getSlideVariants(): VariantRecord[] {
  return variantActions.getSlideVariants();
}

async function getVariantReviewWorkbench(): Promise<VariantReviewWorkbench> {
  variantReviewWorkbench = await variantReviewLazyWorkbench.load();
  return variantReviewWorkbench;
}

function loadVariantReviewWorkbench(): void {
  getVariantReviewWorkbench()
    .then((workbench) => {
      workbench.renderFlow();
      workbench.render();
      workbench.renderComparison();
    })
    .catch((error: unknown) => {
      elements.operationStatus.textContent = errorMessage(error);
    });
}

function getSelectedVariant() {
  return variantActions.getSelectedVariant();
}

function clearTransientVariants(slideId: string) {
  variantActions.clearTransientVariants(slideId);
}

function openVariantGenerationControls() {
  void import("./variants/variant-generation-controls.ts")
    .then(({ StudioClientVariantGenerationControls }) => {
      StudioClientVariantGenerationControls.open(window.document);
    });
  variantReviewWorkbench?.openGenerationControls();
}

function renderVariantFlow() {
  if (variantReviewWorkbench) {
    variantReviewWorkbench.renderFlow();
  }
}

function renderVariants() {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadVariantReviewWorkbench,
    render: (workbench) => workbench.render(),
    shouldLoad: () => state.ui.variantReviewOpen || getSlideVariants().length > 0,
    workbench: variantReviewWorkbench
  });
}

function renderVariantComparison() {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadVariantReviewWorkbench,
    render: (workbench) => workbench.renderComparison(),
    shouldLoad: () => Boolean(getSelectedVariant()),
    workbench: variantReviewWorkbench
  });
}

function replacePersistedVariantsForSlide(slideId: string, variants: VariantRecord[]) {
  variantActions.replacePersistedVariantsForSlide(slideId, variants);
}

async function getRequestedCandidateCount() {
  const { StudioClientCandidateCount } = await import("./variants/candidate-count.ts");
  return StudioClientCandidateCount.readNormalized(elements.ideateCandidateCount);
}

async function getDeckPlanningWorkbench(): Promise<DeckPlanningWorkbench> {
  deckPlanningWorkbench = await deckPlanningLazyWorkbench.load();
  if (pendingDeckStructureCandidates !== undefined) {
    deckPlanningWorkbench.setDeckStructureCandidates(pendingDeckStructureCandidates);
    pendingDeckStructureCandidates = undefined;
  }
  return deckPlanningWorkbench;
}

function loadDeckPlanningWorkbench(): void {
  getDeckPlanningWorkbench()
    .then((workbench) => {
      workbench.renderDeckLengthPlan();
      workbench.renderDeckStructureCandidates();
      workbench.renderOutlinePlans();
      workbench.renderSources();
    })
    .catch((error: unknown) => {
      elements.operationStatus.textContent = errorMessage(error);
    });
}

function renderDeckLengthPlan() {
  deckPlanningWorkbench?.renderDeckLengthPlan();
}

function setDeckStructureCandidates(candidates: unknown[] | undefined) {
  pendingDeckStructureCandidates = candidates;
  if (deckPlanningWorkbench) {
    deckPlanningWorkbench.setDeckStructureCandidates(candidates);
    pendingDeckStructureCandidates = undefined;
  }
}

function renderDeckStructureCandidates() {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadDeckPlanningWorkbench,
    render: (workbench) => workbench.renderDeckStructureCandidates(),
    shouldLoad: () => state.ui.outlineDrawerOpen || pendingDeckStructureCandidates !== undefined,
    workbench: deckPlanningWorkbench
  });
}

function renderSources() {
  deckPlanningWorkbench?.renderSources();
}

function renderOutlinePlans() {
  deckPlanningWorkbench?.renderOutlinePlans();
}

function getApiExplorerStateValue(): ApiExplorerState {
  return StudioClientApiExplorerState.getExplorerState(state);
}

async function getApiExplorer(): Promise<ApiExplorerWorkbench> {
  apiExplorer = await apiExplorerWorkbench.load();
  return apiExplorer;
}

function getApiExplorerState() {
  return apiExplorer ? apiExplorer.getState() : getApiExplorerStateValue();
}

function renderApiExplorer() {
  if (apiExplorer) {
    apiExplorer.render();
  }
}

async function openApiExplorerResource(href: string, options: ApiExplorerOpenOptions = {}) {
  const workbench = await getApiExplorer();
  return workbench.openResource(href, options);
}

function renderDeckFields() {
  deckContextActions.renderDeckFields();
}

async function getAssistantWorkbench(): Promise<AssistantWorkbench> {
  assistantWorkbench = await assistantLazyWorkbench.load();
  return assistantWorkbench;
}

function loadAssistantWorkbench(): void {
  getAssistantWorkbench()
    .then((workbench) => {
      workbench.render();
      workbench.renderSelection();
    })
    .catch((error: unknown) => {
      elements.assistantLog.textContent = errorMessage(error);
    });
}

function renderAssistant() {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadAssistantWorkbench,
    render: (workbench) => workbench.render(),
    shouldLoad: () => state.ui.assistantOpen,
    workbench: assistantWorkbench
  });
}

function renderAssistantSelection() {
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadAssistantWorkbench,
    render: (workbench) => workbench.renderSelection(),
    shouldLoad: () => state.ui.assistantOpen,
    workbench: assistantWorkbench
  });
}

function renderPreviews() {
  previewWorkbench.render();
}

function getPresentationState() {
  return presentationCreationActions.getPresentationState();
}

async function getThemeWorkbench(): Promise<ThemeWorkbench> {
  themeWorkbench = await themeLazyWorkbench.load();
  return themeWorkbench;
}

function loadThemeWorkbench(): void {
  getThemeWorkbench()
    .then((workbench) => {
      workbench.renderSavedThemes();
      workbench.renderStage();
    })
    .catch((error: unknown) => {
      elements.operationStatus.textContent = errorMessage(error);
    });
}

function resetPresentationSelection(): void {
  slideSelectionActions.resetPresentationSelection();
}

async function getPresentationLibrary(): Promise<PresentationLibraryWorkbench> {
  presentationLibrary = await presentationLibraryWorkbench.load();
  return presentationLibrary;
}

function renderPresentationLibrary(): void {
  if (state.ui.currentPage !== "presentations" && !presentationLibrary) {
    return;
  }

  getPresentationLibrary()
    .then((workbench) => workbench.render())
    .catch((error: unknown) => {
      elements.presentationResultCount.textContent = errorMessage(error);
    });
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
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadThemeWorkbench,
    render: (workbench) => workbench.renderSavedThemes(),
    shouldLoad: () => state.ui.themeDrawerOpen || state.ui.currentPage === "presentations",
    workbench: themeWorkbench
  });
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
  StudioClientLazyWorkbench.renderLoadedOrLoad({
    load: loadThemeWorkbench,
    render: (workbench) => workbench.renderStage(),
    shouldLoad: () => state.ui.themeDrawerOpen || state.ui.currentPage === "presentations",
    workbench: themeWorkbench
  });
}

function renderCreationDraft() {
  presentationCreationWorkbench.renderDraft();
}

function renderValidation() {
  validationReportWorkbench.load().then((workbench) => workbench.render()).catch((error: unknown) => {
    elements.reportBox.textContent = errorMessage(error);
  });
}

function syncSelectedSlideToActiveList() {
  return slideSelectionActions.syncSelectedSlideToActiveList();
}

async function loadSlide(slideId: string) {
  const workbench = await slideLoadWorkbench.load();
  await workbench.loadSlide(slideId);
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
  void presentationModeLazyWorkbench.load().then((workbench) => workbench.openPresentationMode());
}

async function saveDeckTheme() {
  await themeActions.saveDeckTheme();
}

async function refreshState() {
  const workbench = await workspaceRefreshWorkbench.load();
  await workbench.refreshState();
}

async function saveDeckContext() {
  await deckContextActions.saveDeckContext();
}

async function saveValidationSettings() {
  const workbench = await buildValidationWorkbench.load();
  await workbench.saveValidationSettings();
}

async function buildDeck(): Promise<BuildPayload> {
  const workbench = await buildValidationWorkbench.load();
  return workbench.buildDeck();
}

async function validate(includeRender: boolean) {
  const workbench = await buildValidationWorkbench.load();
  await workbench.validate(includeRender);
}

async function exportPdf() {
  const workbench = await exportWorkbench.load();
  await workbench.exportPdf();
}

async function exportPptx() {
  const workbench = await exportWorkbench.load();
  await workbench.exportPptx();
}

async function checkLlmProvider(options: CheckLlmOptions = {}) {
  return runtimeStatusWorkbench.checkLlmProvider(options);
}

async function ideateSlide() {
  const workbench = await workflowWorkbench.load();
  return workbench.ideateSlide();
}

async function ideateTheme() {
  const workbench = await workflowWorkbench.load();
  return workbench.ideateTheme();
}

async function ideateDeckStructure() {
  const workbench = await workflowWorkbench.load();
  return workbench.ideateDeckStructure();
}

async function ideateStructure() {
  const workbench = await workflowWorkbench.load();
  return workbench.ideateStructure();
}

async function redoLayout() {
  const workbench = await workflowWorkbench.load();
  return workbench.redoLayout();
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
      ensureWorkbench: getVariantReviewWorkbench,
      isLoaded: () => Boolean(variantReviewWorkbench)
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
