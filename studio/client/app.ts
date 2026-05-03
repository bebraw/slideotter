// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// preview/slide-dom.ts and persistent writes go through server APIs.
import { StudioClientApiExplorerState } from "./api/api-explorer-state.ts";
import { StudioClientAppTheme } from "./shell/app-theme.ts";
import { StudioClientCandidateCount } from "./variants/candidate-count.ts";
import { StudioClientCommandControls } from "./shell/command-controls.ts";
import { StudioClientContextPayloadState } from "./api/context-payload-state.ts";
import { StudioClientCore } from "./core/core.ts";
import { StudioClientCreationThemeState } from "./creation/creation-theme-state.ts";
import { StudioClientDeckContextForm } from "./planning/deck-context-form.ts";
import { StudioClientDomPreviewState } from "./preview/dom-preview-state.ts";
import { StudioClientElements } from "./core/elements.ts";
import { StudioClientExportMenu } from "./shell/export-menu.ts";
import { StudioClientFileReader } from "./core/file-reader.ts";
import { StudioClientGlobalEvents } from "./shell/global-events.ts";
import { StudioClientLazyWorkbench } from "./core/lazy-workbench.ts";
import { StudioClientLlmStatus } from "./runtime/llm-status.ts";
import { StudioClientNavigationShell } from "./shell/navigation-shell.ts";
import { StudioClientPresentationCreationControl } from "./creation/presentation-creation-control.ts";
import { StudioClientPresentationCreationState } from "./creation/presentation-creation-state.ts";
import { StudioClientPresentationCreationWorkbench } from "./creation/presentation-creation-workbench.ts";
import { StudioClientPresentationModeControl } from "./shell/presentation-mode-control.ts";
import { StudioClientPresentationModeState } from "./shell/presentation-mode-state.ts";
import { StudioClientPreferences } from "./shell/preferences.ts";
import { StudioClientPreviewWorkbench } from "./preview/preview-workbench.ts";
import { StudioClientRuntimeStatusWorkbench } from "./runtime/runtime-status-workbench.ts";
import { StudioClientRuntimePayloadState } from "./runtime/runtime-payload-state.ts";
import { StudioClientSlideEditorWorkbench } from "./editor/slide-editor-workbench.ts";
import { StudioClientSlideLoadState } from "./editor/slide-load-state.ts";
import { StudioClientSlidePreview } from "./preview/slide-preview.ts";
import { StudioClientSlideSelectionState } from "./editor/slide-selection-state.ts";
import { StudioClientState } from "./core/state.ts";
import { StudioClientThemeCandidateState } from "./creation/theme-candidate-state.ts";
import { StudioClientThemeFieldState } from "./creation/theme-field-state.ts";
import { StudioClientUrlState } from "./core/url-state.ts";
import { StudioClientValidationSettingsForm } from "./runtime/validation-settings-form.ts";
import { StudioClientVariantGenerationControls } from "./variants/variant-generation-controls.ts";
import { StudioClientVariantState } from "./variants/variant-state.ts";
import type { StudioClientWorkflows } from "./runtime/workflows.ts";
import { StudioClientWorkspaceState } from "./api/workspace-state.ts";

type DomSlideRenderOptions = {
  index?: number;
  theme?: unknown;
  totalSlides?: number;
};

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

type ExportWorkbench = {
  exportPdf: () => Promise<void>;
  exportPptx: () => Promise<void>;
};

type PresentationLibraryWorkbench = {
  render: () => void;
  resetSelection: () => void;
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
  getSelectedVariant: () => StudioClientCreationThemeState.ThemeVariant;
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

type PersistThemeOptions = {
  closeDrawer?: boolean;
};

type CheckLlmOptions = {
  silent?: boolean;
};

type JsonRecord = StudioClientState.JsonRecord;
type DeckThemeFields = StudioClientThemeFieldState.DeckThemeFields;
type VariantRecord = StudioClientState.VariantRecord;

type WorkflowRunOptions = {
  button: StudioClientElements.StudioElement;
  endpoint: string;
};
type WorkflowRunners = ReturnType<typeof StudioClientWorkflows.createWorkflowRunners>;

type SlidePayload = StudioClientSlideLoadState.SlidePayload;

type ThemeSavePayload = JsonRecord & StudioClientCreationThemeState.ThemeSavePayload;

type ContextPayload = JsonRecord & StudioClientContextPayloadState.ContextPayload;

type BuildPayload = JsonRecord & {
  pdf?: {
    path?: string;
    url?: string;
  };
  previews: StudioClientState.State["previews"];
  runtime: StudioClientState.State["runtime"];
};

type ValidationPayload = BuildPayload & StudioClientRuntimePayloadState.ValidationPayload;

function getUrlSlideParam(): string {
  return StudioClientUrlState.getSlideParam(window);
}

function setUrlSlideParam(slideId: string | null): void {
  StudioClientUrlState.setSlideParam(window, slideId);
}

type WorkspacePayload = StudioClientWorkspaceState.WorkspacePayload;

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
const slidePreview = StudioClientSlidePreview.createSlidePreview({
  createDomElement,
  getTheme: getDomTheme,
  windowRef: window
});
const slideEditorWorkbench = StudioClientSlideEditorWorkbench.createSlideEditorWorkbench({
  clearTransientVariants,
  createDomElement,
  elements,
  highlightJsonSource,
  loadSlide,
  patchDomSlideSpec,
  readFileAsDataUrl: (file) => StudioClientFileReader.readAsDataUrl(window, file),
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
  readFileAsDataUrl: (file) => StudioClientFileReader.readAsDataUrl(window, file),
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
let workflowRunners: WorkflowRunners | null = null;
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
function getDomTheme() {
  return StudioClientDomPreviewState.getWindowCurrentTheme(state, window);
}

function getVariantVisualTheme(variant: { visualTheme?: unknown } | null) {
  return StudioClientDomPreviewState.getWindowVariantVisualTheme(state, window, variant);
}

function setDomPreviewState(payload: JsonRecord) {
  StudioClientDomPreviewState.setFromPayload(state, payload);
}

function patchDomSlideSpec(slideId: string, slideSpec: JsonRecord | null) {
  StudioClientDomPreviewState.patchSlideSpec(state, slideId, slideSpec);
}

function getDomSlideSpec(slideId: string): JsonRecord | null {
  return StudioClientDomPreviewState.getSlideSpec(state, slideId);
}


function enableDomSlideTextEditing(viewport: HTMLElement) {
  slideEditorWorkbench.enableDomSlideTextEditing(viewport);
}

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

function renderImagePreview(viewport: HTMLElement | null, url: string, alt: string) {
  slidePreview.renderImagePreview(viewport, url, alt);
}

function renderDomSlide(viewport: Element | null, slideSpec: unknown, options: DomSlideRenderOptions = {}) {
  slidePreview.renderDomSlide(viewport instanceof HTMLElement ? viewport : null, slideSpec, options);
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
  return StudioClientVariantState.getSlideVariants(state);
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
  if (variantReviewWorkbench) {
    return variantReviewWorkbench.getSelectedVariant();
  }
  return StudioClientVariantState.getSelectedVariant(state);
}

function clearTransientVariants(slideId: string) {
  StudioClientVariantState.clearTransientVariants(state, slideId);
  variantReviewWorkbench?.clearTransientVariants(slideId);
}

function openVariantGenerationControls() {
  StudioClientVariantGenerationControls.open(window.document);
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
  StudioClientVariantState.replacePersistedVariantsForSlide(state, slideId, variants);
  variantReviewWorkbench?.replacePersistedVariantsForSlide(slideId, variants);
}

function getRequestedCandidateCount() {
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
  const deck = state.context.deck || {};
  StudioClientDeckContextForm.apply(window.document, elements, deck);
  renderManualDeckEditOptions();
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
  return StudioClientPresentationCreationState.getPresentationState(state);
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
  StudioClientSlideSelectionState.resetPresentationSelection(state);
  presentationLibrary?.resetSelection();
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
  StudioClientThemeCandidateState.resetCandidates(state);
  themeWorkbench?.resetCandidates();
}

function applyCreationTheme(theme: DeckThemeFields | undefined) {
  applyDeckThemeFields(theme || {});
  renderCreationThemeStage();
}

function getSelectedCreationThemeVariant() {
  return StudioClientCreationThemeState.getSelectedThemeVariant(
    themeWorkbench?.getSelectedVariant(),
    getDeckVisualThemeFromFields()
  );
}

function isWorkflowRunning() {
  return StudioClientPresentationCreationState.isWorkflowRunning(state);
}

function isEmptyCreationDraft(draft: StudioClientState.CreationDraft | null) {
  return StudioClientPresentationCreationState.isEmptyCreationDraft(draft);
}

function resetPresentationCreationControl() {
  StudioClientPresentationCreationControl.resetControl({
    elements,
    state,
    workbench: presentationCreationWorkbench
  });
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
  const theme = StudioClientCreationThemeState.getSavedThemeFields(state.savedThemes, themeId);
  if (!theme) {
    return;
  }

  presentationCreationWorkbench.applyFields({
    ...presentationCreationWorkbench.getFields(),
    visualTheme: theme
  });
}

function getDeckVisualThemeFromFields() {
  return StudioClientThemeFieldState.read(elements);
}

function applyDeckThemeFields(theme: DeckThemeFields = {}) {
  StudioClientThemeFieldState.apply(window.document, elements, theme);
}

function setDeckThemeBriefValue(value: unknown) {
  StudioClientThemeFieldState.setBrief(elements, value);
}

function getDeckThemeBriefValue() {
  return StudioClientThemeFieldState.getBrief(elements);
}

function applySavedThemeToDeck(themeId: string | undefined) {
  const theme = StudioClientCreationThemeState.getSavedThemeFields(state.savedThemes, themeId);
  if (!theme) {
    return;
  }

  applyDeckThemeFields(theme);
  resetThemeCandidates();
  renderCreationThemeStage();
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
  const result = StudioClientSlideSelectionState.syncSelectedSlideToActiveList(state, getUrlSlideParam());
  if (result.clearSlideUrl) {
    setUrlSlideParam(null);
  }
  return result.slide;
}

async function loadSlide(slideId: string) {
  const { abortController, requestSeq } = beginAbortableRequest(state, "slideLoadAbortController", "slideLoadRequestSeq");
  const previousSlideId = state.selectedSlideId;
  if (previousSlideId && previousSlideId !== slideId) {
    clearTransientVariants(previousSlideId);
  }
  try {
    const payload = await request<SlidePayload>(`/api/slides/${slideId}`, { signal: abortController.signal });
    if (!isCurrentAbortableRequest(state, "slideLoadAbortController", "slideLoadRequestSeq", requestSeq, abortController)) {
      return;
    }
    if (state.selectedSlideId !== slideId) {
      clearAssistantSelection();
    }
    StudioClientSlideLoadState.applySlidePayload(state, slideId, payload);
    patchDomSlideSpec(slideId, payload.slideSpec || null);
    replacePersistedVariantsForSlide(slideId, payload.variants || []);
    clearTransientVariants(slideId);
    setUrlSlideParam(slideId);
    renderStatus();
    renderSlideFields();
    renderPreviews();
    renderVariants();
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    throw error;
  } finally {
    clearAbortableRequest(state, "slideLoadAbortController", abortController);
  }
}

async function selectSlideByIndex(index: number) {
  const slide = StudioClientSlideSelectionState.getSlideByIndex(state, index);
  if (!slide) {
    return;
  }

  await loadSlide(slide.id);
}

async function savePresentationTheme() {
  const name = elements.presentationThemeName.value.trim() || elements.presentationTitle.value.trim() || "Saved theme";
  const done = elements.savePresentationThemeButton ? setBusy(elements.savePresentationThemeButton, "Saving...") : () => {};
  try {
    const payload = await request<ThemeSavePayload>("/api/themes/save", {
      body: JSON.stringify({
        name,
        theme: presentationCreationWorkbench.getFields().visualTheme
      }),
      method: "POST"
    });
    const savedTheme = StudioClientCreationThemeState.applyThemeSavePayload(state, payload);
    renderSavedThemes();
    elements.presentationSavedTheme.value = savedTheme ? savedTheme.id : "";
    elements.presentationCreationStatus.textContent = `Saved theme "${name}" for reuse.`;
  } finally {
    done();
  }
}

async function persistSelectedThemeToDeck(options: PersistThemeOptions = {}) {
  const theme = getSelectedCreationThemeVariant().theme;
  applyCreationTheme(theme);
  const payload = await request<ContextPayload>("/api/context", {
    body: JSON.stringify({
      deck: StudioClientDeckContextForm.read(window.document, elements)
    }),
    method: "POST"
  });
  StudioClientContextPayloadState.applyContextPayload(state, payload);
  renderCreationThemeStage();
  renderPreviews();
  await buildDeck();
  if (options.closeDrawer) {
    setThemeDrawerOpen(false);
  }
  elements.operationStatus.textContent = "Theme applied to the active deck.";
}

function openPresentationMode() {
  StudioClientPresentationModeControl.openPresentationMode({
    missingPresentationMessage: "Select a presentation before opening presentation mode.",
    presentationId: getPresentationState().activePresentationId,
    urlForPresentation: (presentationId) => StudioClientPresentationModeState.getPresentationModeUrl(state, presentationId),
    windowRef: window
  });
}

async function saveDeckTheme() {
  const selectedVariant = getSelectedCreationThemeVariant();
  const name = selectedVariant && selectedVariant.label && selectedVariant.id !== "current"
    ? selectedVariant.label
    : elements.deckTitle.value.trim() || "Current theme";
  const done = setBusy(elements.saveDeckThemeButton, "Saving...");
  try {
    const payload = await request<ThemeSavePayload>("/api/themes/save", {
      body: JSON.stringify({
        name,
        theme: getDeckVisualThemeFromFields()
      }),
      method: "POST"
    });
    StudioClientCreationThemeState.applyThemeSavePayload(state, payload);
    renderSavedThemes();
    elements.operationStatus.textContent = `Saved theme "${name}" for reuse.`;
  } finally {
    done();
  }
}

async function refreshState() {
  const [payload, apiRoot] = await Promise.all([
    request<WorkspacePayload>("/api/state"),
    request<StudioClientState.HypermediaResource>("/api/v1")
  ]);
  const activePresentation = apiRoot && apiRoot.links && apiRoot.links.activePresentation && apiRoot.links.activePresentation.href
    ? await request<StudioClientState.HypermediaResource>(apiRoot.links.activePresentation.href)
    : null;

  StudioClientWorkspaceState.applyWorkspacePayload(state, payload, apiRoot, activePresentation);
  elements.deckLengthTarget.value = "";

  syncSelectedSlideToActiveList();
  StudioClientPresentationCreationControl.hydrateDraftFields({
    state,
    workbench: presentationCreationWorkbench
  });

  renderDeckFields();
  renderDeckLengthPlan();
  renderDeckStructureCandidates();
  renderSavedThemes();
  renderCreationDraft();
  renderPresentationLibrary();
  renderAssistant();
  renderStatus();
  renderPreviews();
  renderCustomLayoutLibrary();
  renderOutlinePlans();
  renderSources();
  renderVariants();

  if (state.selectedSlideId) {
    await loadSlide(state.selectedSlideId);
  }
}

async function saveDeckContext() {
  const done = setBusy(elements.saveDeckContextButton, "Saving...");
  try {
    const payload = await request<ContextPayload>("/api/context", {
      body: JSON.stringify({
        deck: StudioClientDeckContextForm.read(window.document, elements)
      }),
      method: "POST"
    });

    StudioClientContextPayloadState.applyContextPayload(state, payload, { resetDeckStructure: true });
    renderDeckFields();
    renderDeckLengthPlan();
    renderDeckStructureCandidates();
    renderPreviews();
    renderVariants();
    await buildDeck();
    elements.operationStatus.textContent = "Saved deck context and rebuilt the live deck.";
  } finally {
    done();
  }
}

async function saveValidationSettings() {
  const done = setBusy(elements.saveValidationSettingsButton, "Saving...");
  try {
    const payload = await request<ContextPayload>("/api/context", {
      body: JSON.stringify({
        deck: {
          validationSettings: StudioClientValidationSettingsForm.read(window.document, elements)
        }
      }),
      method: "POST"
    });

    StudioClientContextPayloadState.applyContextPayload(state, payload);
    renderDeckFields();
    await buildDeck();
    elements.operationStatus.textContent = "Saved check settings and rebuilt the live deck.";
  } finally {
    done();
  }
}

async function buildDeck(): Promise<BuildPayload> {
  const payload = await request<BuildPayload>("/api/build", {
    body: JSON.stringify({}),
    method: "POST"
  });
  StudioClientRuntimePayloadState.applyBuildPayload(state, payload);
  renderStatus();
  renderPreviews();
  renderVariantComparison();
  return payload;
}

async function validate(includeRender: boolean) {
  const button = includeRender ? elements.validateRenderButton : elements.validateButton;
  const done = setBusy(button, includeRender ? "Running render gate..." : "Validating...");
  try {
    const payload = await request<ValidationPayload>("/api/validate", {
      body: JSON.stringify({ includeRender }),
      method: "POST"
    });
    StudioClientRuntimePayloadState.applyValidationPayload(state, payload);
    renderStatus();
    renderPreviews();
    renderVariantComparison();
    renderValidation();
  } finally {
    done();
  }
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
  return runSlideCandidateWorkflow({
    button: elements.ideateSlideButton,
    endpoint: "/api/operations/ideate-slide"
  });
}

async function ideateTheme() {
  return runSlideCandidateWorkflow({
    button: elements.ideateThemeButton,
    endpoint: "/api/operations/ideate-theme"
  });
}

async function ideateDeckStructure() {
  return runDeckStructureWorkflow({
    button: elements.ideateDeckStructureButton,
    endpoint: "/api/operations/ideate-deck-structure"
  });
}

async function runDeckStructureWorkflow({ button, endpoint }: WorkflowRunOptions) {
  const runners = await getWorkflowRunners();
  return runners.runDeckStructure({ button, endpoint });
}

async function ideateStructure() {
  return runSlideCandidateWorkflow({
    button: elements.ideateStructureButton,
    endpoint: "/api/operations/ideate-structure"
  });
}

async function redoLayout() {
  return runSlideCandidateWorkflow({
    button: elements.redoLayoutButton,
    endpoint: "/api/operations/redo-layout"
  });
}

async function runSlideCandidateWorkflow({ button, endpoint }: WorkflowRunOptions) {
  const runners = await getWorkflowRunners();
  return runners.runSlideCandidate({ button, endpoint });
}

async function getWorkflowRunners(): Promise<WorkflowRunners> {
  if (workflowRunners) {
    return workflowRunners;
  }

  const { StudioClientWorkflows } = await import("./runtime/workflows.ts");
  workflowRunners = StudioClientWorkflows.createWorkflowRunners({
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
  return workflowRunners;
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
