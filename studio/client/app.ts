// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// slide-dom.ts and persistent writes go through server APIs.
import { StudioClientAppTheme } from "./app-theme.ts";
import { StudioClientArtifactDownload } from "./artifact-download.ts";
import { StudioClientCheckRemediationState } from "./check-remediation-state.ts";
import { StudioClientCore } from "./core.ts";
import { StudioClientDomPreviewState } from "./dom-preview-state.ts";
import { StudioClientElements } from "./elements.ts";
import { StudioClientFileReader } from "./file-reader.ts";
import { StudioClientLazyWorkbench } from "./lazy-workbench.ts";
import { StudioClientLlmStatus } from "./llm-status.ts";
import { StudioClientNavigationShell } from "./navigation-shell.ts";
import { StudioClientPresentationCreationWorkbench } from "./presentation-creation-workbench.ts";
import { StudioClientPreferences } from "./preferences.ts";
import { StudioClientPreviewWorkbench } from "./preview-workbench.ts";
import { StudioClientRuntimeStatusWorkbench } from "./runtime-status-workbench.ts";
import { StudioClientSlideEditorWorkbench } from "./slide-editor-workbench.ts";
import { StudioClientSlidePreview } from "./slide-preview.ts";
import { StudioClientSlideSelectionState } from "./slide-selection-state.ts";
import { StudioClientState } from "./state.ts";
import { StudioClientThemeFieldState } from "./theme-field-state.ts";
import { StudioClientUrlState } from "./url-state.ts";
import { StudioClientVariantState } from "./variant-state.ts";
import { StudioClientWorkflows } from "./workflows.ts";

type DomRenderer = {
  normalizeTheme?: (theme: unknown) => unknown;
};

type SlideDomWindow = Window & {
  SlideDomRenderer?: DomRenderer;
};

type DomSlideRenderOptions = {
  index?: number;
  theme?: unknown;
  totalSlides?: number;
};

type ApiExplorerOpenOptions = {
  pushHistory?: boolean;
};

type ApiExplorerState = {
  history: string[];
  resource: unknown | null;
  url: string;
};

type ApiExplorerWorkbench = {
  getState: () => ApiExplorerState;
  mount: () => void;
  openResource: (href: string | null | undefined, options?: ApiExplorerOpenOptions) => Promise<void>;
  render: () => void;
};

type ValidationIssue = {
  level?: string;
  message?: string;
  rule?: string;
  slide?: string | number;
};

type ValidationReportRenderer = {
  renderValidationReport: (dependencies: {
    createDomElement: typeof createDomElement;
    elements: StudioClientElements.Elements;
    onSuggestRemediation: (issue: ValidationIssue, blockName: string, issueIndex: number, button: HTMLButtonElement) => void;
    state: Pick<StudioClientState.State, "validation">;
  }) => void;
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

type ThemeVariant = {
  id: string;
  label: string;
  note?: string;
  theme: DeckThemeFields;
};

type ThemeWorkbench = {
  getSelectedVariant: () => ThemeVariant;
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

type SlidePayload = JsonRecord & {
  slide: StudioClientState.StudioSlide;
  slideSpec?: JsonRecord | null;
  slideSpecError?: unknown;
  source?: string;
  structured?: boolean;
  variants?: VariantRecord[];
  variantStorage?: unknown;
};

type ThemeSavePayload = JsonRecord & {
  savedTheme?: StudioClientState.SavedTheme;
  savedThemes?: StudioClientState.SavedTheme[];
};

type ContextPayload = JsonRecord & {
  context: StudioClientState.DeckContext;
};

type BuildPayload = JsonRecord & {
  pdf?: {
    path?: string;
    url?: string;
  };
  previews: StudioClientState.State["previews"];
  runtime: StudioClientState.State["runtime"];
};

type ValidationPayload = BuildPayload & {
  ok?: boolean;
};

type PptxExportPayload = JsonRecord & {
  diagnostics?: {
    imageResolution?: string;
    imageScale?: number;
    slideCount?: number;
    warnings?: string[];
  };
  pptx?: {
    path?: string;
    url?: string;
  };
  runtime?: StudioClientState.State["runtime"];
};

type CheckRemediationPayload = BuildPayload & {
  slideId?: string;
  summary?: string;
  transientVariants?: VariantRecord[];
  variants?: VariantRecord[];
};

function getUrlSlideParam(): string {
  return StudioClientUrlState.getSlideParam(window);
}

function setUrlSlideParam(slideId: string | null): void {
  StudioClientUrlState.setSlideParam(window, slideId);
}

type WorkspacePayload = JsonRecord & {
  assistant?: StudioClientState.State["assistant"];
  context: StudioClientState.DeckContext;
  creationDraft?: StudioClientState.CreationDraft | null;
  favoriteLayouts?: StudioClientState.SavedLayout[];
  layouts?: StudioClientState.SavedLayout[];
  materials?: JsonRecord[];
  customVisuals?: JsonRecord[];
  outlinePlans?: StudioClientState.OutlinePlan[];
  presentations?: StudioClientState.State["presentations"];
  previews: StudioClientState.State["previews"];
  runtime: StudioClientState.State["runtime"];
  savedThemes?: StudioClientState.SavedTheme[];
  skippedSlides?: StudioClientState.StudioSlide[];
  slides: StudioClientState.StudioSlide[];
  sources?: StudioClientState.SourceRecord[];
  variants?: VariantRecord[];
  variantStorage?: unknown;
};

const state: StudioClientState.State = StudioClientState.createInitialState();
const {
  beginAbortableRequest,
  clearAbortableRequest,
  isCurrentAbortableRequest
} = StudioClientState;

const {
  createDomElement,
  escapeHtml,
  formatSourceCode,
  highlightJsonSource,
  isAbortError,
  postJson,
  request,
  setBusy
} = StudioClientCore;
const {
  isJsonRecord
} = StudioClientDomPreviewState;

const elements: StudioClientElements.Elements = StudioClientElements.createElements(StudioClientCore);
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
    const { StudioClientApiExplorer } = await import("./api-explorer.ts");
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
const validationReportWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ValidationReportRenderer>({
  create: async () => {
    const { StudioClientValidationReport } = await import("./validation-report.ts");
    return StudioClientValidationReport;
  }
});
const presentationLibraryWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<PresentationLibraryWorkbench>({
  create: async () => {
    const { StudioClientPresentationLibrary } = await import("./presentation-library.ts");
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
    const { StudioClientDeckPlanningWorkbench } = await import("./deck-planning-workbench.ts");
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
    const { StudioClientAssistantWorkbench } = await import("./assistant-workbench.ts");
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
    const { StudioClientThemeWorkbench } = await import("./theme-workbench.ts");
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
const workflowRunners = StudioClientWorkflows.createWorkflowRunners({
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
const customLayoutLazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<CustomLayoutWorkbench>({
  create: async () => {
    const { StudioClientCustomLayoutWorkbench } = await import("./custom-layout-workbench.ts");
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
    const { StudioClientVariantReviewWorkbench } = await import("./variant-review-workbench.ts");
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
  renderThemeDrawer,
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
  setLlmPopoverOpen,
  state,
  toggleLlmPopover,
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
function getValidationRuleSelects(): HTMLSelectElement[] {
  return Array.from(document.querySelectorAll<HTMLSelectElement>("[data-validation-rule]"));
}

function getDomRenderer(): DomRenderer | null {
  return (window as SlideDomWindow).SlideDomRenderer || null;
}

function getDomThemeNormalizer(renderer: DomRenderer | null) {
  return renderer && typeof renderer.normalizeTheme === "function"
    ? (theme: unknown) => renderer.normalizeTheme ? renderer.normalizeTheme(theme) : theme
    : undefined;
}

function getDomTheme() {
  const renderer = getDomRenderer();
  return StudioClientDomPreviewState.getCurrentTheme(
    state,
    getDomThemeNormalizer(renderer)
  );
}

function getVariantVisualTheme(variant: { visualTheme?: unknown } | null) {
  const renderer = getDomRenderer();
  return StudioClientDomPreviewState.getVariantVisualTheme(
    state,
    variant,
    getDomThemeNormalizer(renderer)
  );
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

function setLlmPopoverOpen(open: boolean) {
  runtimeStatusWorkbench.setLlmPopoverOpen(open);
}

function toggleLlmPopover() {
  runtimeStatusWorkbench.toggleLlmPopover();
}

function renderPages() {
  navigationShell.renderPages();
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

function renderAllDrawers() {
  navigationShell.renderAllDrawers();
}

function setAssistantDrawerOpen(open: boolean) {
  navigationShell.setAssistantDrawerOpen(open);
}

function renderThemeDrawer() {
  navigationShell.renderThemeDrawer();
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
      elements.customLayoutStatus.textContent = error instanceof Error ? error.message : String(error);
    });
}

function renderCustomLayoutEditor(): void {
  if (customLayoutWorkbench) {
    customLayoutWorkbench.renderEditor();
    return;
  }
  if (state.ui.layoutDrawerOpen) {
    loadCustomLayoutWorkbench();
  }
}

function renderCustomLayoutStudio(): void {
  if (customLayoutWorkbench) {
    customLayoutWorkbench.renderLayoutStudio();
    return;
  }
  if (state.ui.layoutDrawerOpen) {
    loadCustomLayoutWorkbench();
  }
}

function renderCustomLayoutLibrary(): void {
  if (customLayoutWorkbench) {
    customLayoutWorkbench.renderLibrary();
    return;
  }
  if (state.ui.layoutDrawerOpen) {
    loadCustomLayoutWorkbench();
  }
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
      elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
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
  const details = window.document.querySelector(".variant-generation-details") as HTMLDetailsElement | null;
  if (details) {
    details.open = true;
  }
  variantReviewWorkbench?.openGenerationControls();
}

function renderVariantFlow() {
  if (variantReviewWorkbench) {
    variantReviewWorkbench.renderFlow();
  }
}

function renderVariants() {
  if (variantReviewWorkbench) {
    variantReviewWorkbench.render();
    return;
  }
  if (state.ui.variantReviewOpen || getSlideVariants().length) {
    loadVariantReviewWorkbench();
  }
}

function renderVariantComparison() {
  if (variantReviewWorkbench) {
    variantReviewWorkbench.renderComparison();
    return;
  }
  if (getSelectedVariant()) {
    loadVariantReviewWorkbench();
  }
}

function getSlideIdForValidationIssue(issue: ValidationIssue): string {
  return StudioClientCheckRemediationState.getSlideIdForIssue(state, issue);
}

function applyRemediationPayload(payload: CheckRemediationPayload, slideId: string): void {
  elements.operationStatus.textContent = StudioClientCheckRemediationState.applyPayload(state, payload, slideId);
  openVariantGenerationControls();
  renderStatus();
  renderPreviews();
  renderVariants();
}

async function suggestValidationRemediation(
  issue: ValidationIssue,
  blockName: string,
  issueIndex: number,
  button: HTMLButtonElement
): Promise<void> {
  const slideId = getSlideIdForValidationIssue(issue);
  if (!slideId) {
    elements.operationStatus.textContent = "Select a slide before suggesting remediation.";
    return;
  }

  const originalText = button.textContent || "Suggest fixes";
  button.disabled = true;
  button.textContent = "Suggesting...";
  try {
    const payload = await request<CheckRemediationPayload>("/api/checks/remediate", {
      body: JSON.stringify({
        blockName,
        issue,
        issueIndex,
        slideId
      }),
      method: "POST"
    });
    if (state.selectedSlideId !== slideId) {
      await loadSlide(slideId);
    }
    applyRemediationPayload(payload, slideId);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function replacePersistedVariantsForSlide(slideId: string, variants: VariantRecord[]) {
  StudioClientVariantState.replacePersistedVariantsForSlide(state, slideId, variants);
  variantReviewWorkbench?.replacePersistedVariantsForSlide(slideId, variants);
}

function getRequestedCandidateCount() {
  const parsed = Number.parseInt(elements.ideateCandidateCount.value, 10);
  if (!Number.isFinite(parsed)) {
    elements.ideateCandidateCount.value = "5";
    return 5;
  }

  const normalized = Math.min(8, Math.max(1, parsed));
  elements.ideateCandidateCount.value = String(normalized);
  return normalized;
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
      elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
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
  if (deckPlanningWorkbench) {
    deckPlanningWorkbench.renderDeckStructureCandidates();
    return;
  }
  if (state.ui.outlineDrawerOpen || pendingDeckStructureCandidates !== undefined) {
    loadDeckPlanningWorkbench();
  }
}

function renderSources() {
  deckPlanningWorkbench?.renderSources();
}

function renderOutlinePlans() {
  deckPlanningWorkbench?.renderOutlinePlans();
}

function getApiExplorerStateValue(): ApiExplorerState {
  if (!state.hypermedia) {
    state.hypermedia = { activePresentation: null, explorer: { history: [], resource: null, url: "/api/v1" }, root: null };
  }
  if (!state.hypermedia.explorer) {
    state.hypermedia.explorer = { history: [], resource: null, url: "/api/v1" };
  }
  return state.hypermedia.explorer as ApiExplorerState;
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

function connectRuntimeStream() {
  runtimeStatusWorkbench.connectRuntimeStream();
}

function renderDeckFields() {
  const deck = state.context.deck || {};
  const designConstraints = deck.designConstraints || {};
  const validationSettings = deck.validationSettings || {};
  const validationRules = validationSettings.rules || {};
  const visualTheme = deck.visualTheme || {};
  elements.deckTitle.value = deck.title || "";
  elements.deckAudience.value = deck.audience || "";
  elements.deckAuthor.value = deck.author || "";
  elements.deckCompany.value = deck.company || "";
  elements.deckObjective.value = deck.objective || "";
  elements.deckLang.value = deck.lang || "";
  elements.deckSubject.value = deck.subject || "";
  elements.deckTone.value = deck.tone || "";
  elements.deckConstraints.value = deck.constraints || "";
  elements.designMinFontSize.value = String(designConstraints.minFontSizePt ?? "");
  elements.designMinContentGap.value = String(designConstraints.minContentGapIn ?? "");
  elements.designMinCaptionGap.value = String(designConstraints.minCaptionGapIn ?? "");
  elements.designMinPanelPadding.value = String(designConstraints.minPanelPaddingIn ?? "");
  elements.designMaxWords.value = String(designConstraints.maxWordsPerSlide ?? "");
  applyDeckThemeFields(visualTheme);
  elements.validationMediaMode.value = validationSettings.mediaValidationMode || "fast";
  getValidationRuleSelects().forEach((element) => {
    const rule = element.dataset.validationRule;
    element.value = rule ? String(validationRules[rule] || "warning") : "warning";
  });
  setDeckThemeBriefValue(deck.themeBrief || "");
  elements.deckOutline.value = deck.outline || "";
  elements.deckStructureNote.textContent = deck.structureLabel
    ? `Applied plan: ${deck.structureLabel}. ${deck.structureSummary || "Deck structure metadata is stored with the saved context."}`
    : "Generate deck plans from the saved brief and outline, then apply one back to the outline and live slide files when it reads right.";
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
      elements.assistantLog.textContent = error instanceof Error ? error.message : String(error);
    });
}

function renderAssistant() {
  if (assistantWorkbench) {
    assistantWorkbench.render();
    return;
  }
  if (state.ui.assistantOpen) {
    loadAssistantWorkbench();
  }
}

function renderAssistantSelection() {
  if (assistantWorkbench) {
    assistantWorkbench.renderSelection();
    return;
  }
  if (state.ui.assistantOpen) {
    loadAssistantWorkbench();
  }
}

function renderPreviews() {
  previewWorkbench.render();
}

function getPresentationState() {
  return {
    activePresentationId: state.presentations.activePresentationId || null,
    presentations: Array.isArray(state.presentations.presentations) ? state.presentations.presentations : []
  };
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
      elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
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
      elements.presentationResultCount.textContent = error instanceof Error ? error.message : String(error);
    });
}

function resetThemeCandidates() {
  state.themeCandidates = [];
  state.ui.creationThemeVariantId = "current";
  state.ui.themeCandidateRefreshIndex = 0;
  state.ui.themeCandidatesGenerated = false;
  themeWorkbench?.resetCandidates();
}

function applyCreationTheme(theme: DeckThemeFields | undefined) {
  applyDeckThemeFields(theme || {});
  renderCreationThemeStage();
}

function getSelectedCreationThemeVariant() {
  return themeWorkbench
    ? themeWorkbench.getSelectedVariant()
    : {
        id: "current",
        label: "Current",
        note: "Use the selected controls.",
        theme: getDeckVisualThemeFromFields()
      };
}

function isWorkflowRunning() {
  const workflow = state.runtime && state.runtime.workflow;
  return Boolean(workflow && workflow.status === "running");
}

function isEmptyCreationDraft(draft: StudioClientState.CreationDraft | null) {
  if (!draft || typeof draft !== "object") {
    return true;
  }

  const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};
  const imageSearch = isJsonRecord(fields.imageSearch) ? fields.imageSearch : {};
  return !draft.contentRun
    && !draft.createdPresentationId
    && !draft.deckPlan
    && !String(fields.title || "").trim()
    && !String(fields.audience || "").trim()
    && !String(fields.tone || "").trim()
    && !String(fields.objective || "").trim()
    && !String(fields.constraints || "").trim()
    && !String(fields.presentationSourceText || "").trim()
    && !String(fields.themeBrief || "").trim()
    && !String(imageSearch.query || "").trim()
    && !String(imageSearch.restrictions || "").trim();
}

function resetPresentationCreationControl() {
  presentationCreationWorkbench.applyFields({});
  elements.presentationMaterialFile.value = "";
  elements.presentationThemeName.value = "";
  elements.presentationSavedTheme.value = "";
  state.ui.creationContentSlideIndex = 1;
  state.ui.creationContentSlidePinned = false;
  presentationCreationWorkbench.setStage("brief");
  if (elements.presentationCreateDetails) {
    elements.presentationCreateDetails.open = false;
  }
}

function renderSavedThemes() {
  if (themeWorkbench) {
    themeWorkbench.renderSavedThemes();
    return;
  }
  if (state.ui.themeDrawerOpen || state.ui.currentPage === "presentations") {
    loadThemeWorkbench();
  }
}

function applySavedTheme(themeId: string) {
  const savedTheme = state.savedThemes.find((theme) => theme.id === themeId);
  if (!savedTheme || !savedTheme.theme) {
    return;
  }

  presentationCreationWorkbench.applyFields({
    ...presentationCreationWorkbench.getFields(),
    visualTheme: savedTheme.theme
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
  const savedTheme = state.savedThemes.find((theme) => theme.id === themeId);
  if (!savedTheme || !savedTheme.theme) {
    return;
  }

  applyDeckThemeFields(savedTheme.theme);
  resetThemeCandidates();
  renderCreationThemeStage();
}

function renderCreationThemeStage() {
  if (themeWorkbench) {
    themeWorkbench.renderStage();
    return;
  }
  if (state.ui.themeDrawerOpen || state.ui.currentPage === "presentations") {
    loadThemeWorkbench();
  }
}

function renderCreationDraft() {
  presentationCreationWorkbench.renderDraft();
}

async function getValidationReportRenderer(): Promise<ValidationReportRenderer> {
  return validationReportWorkbench.load();
}

function renderValidation() {
  if (!state.validation && !validationReportWorkbench.get()) {
    elements.validationSummary.replaceChildren();
    elements.reportBox.textContent = "No checks run yet.";
    return;
  }

  getValidationReportRenderer().then((renderer) => renderer.renderValidationReport({
    createDomElement,
    elements,
    onSuggestRemediation: suggestValidationRemediation,
    state
  })).catch((error: unknown) => {
    elements.reportBox.textContent = error instanceof Error ? error.message : String(error);
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
    state.selectedSlideId = slideId;
    state.selectedSlideIndex = payload.slide.index;
    state.selectedSlideSpec = payload.slideSpec || null;
    state.selectedSlideSpecDraftError = null;
    state.selectedSlideSpecError = payload.slideSpecError || null;
    state.selectedSlideStructured = payload.structured === true;
    state.selectedSlideSource = payload.source || "";
    patchDomSlideSpec(slideId, payload.slideSpec || null);
    state.variantStorage = payload.variantStorage || state.variantStorage;
    replacePersistedVariantsForSlide(slideId, payload.variants || []);
    clearTransientVariants(slideId);
    state.selectedVariantId = null;
    state.ui.customLayoutDefinitionPreviewActive = false;
    state.ui.customLayoutMainPreviewActive = false;
    state.ui.variantReviewOpen = Boolean((payload.variants || []).length);
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
  const slide = state.slides.find((entry) => entry.index === index);
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
    state.savedThemes = payload.savedThemes || state.savedThemes;
    renderSavedThemes();
    elements.presentationSavedTheme.value = payload.savedTheme ? payload.savedTheme.id : "";
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
      deck: {
        audience: elements.deckAudience.value,
        author: elements.deckAuthor.value,
        company: elements.deckCompany.value,
        constraints: elements.deckConstraints.value,
        objective: elements.deckObjective.value,
        outline: elements.deckOutline.value,
        subject: elements.deckSubject.value,
        themeBrief: getDeckThemeBriefValue(),
        lang: elements.deckLang.value,
        visualTheme: getDeckVisualThemeFromFields(),
        title: elements.deckTitle.value,
        tone: elements.deckTone.value
      }
    }),
    method: "POST"
  });
  state.context = payload.context;
  state.domPreview = {
    ...state.domPreview,
    theme: payload.context && payload.context.deck ? payload.context.deck.visualTheme : state.domPreview.theme
  };
  renderCreationThemeStage();
  renderPreviews();
  await buildDeck();
  if (options.closeDrawer) {
    setThemeDrawerOpen(false);
  }
  elements.operationStatus.textContent = "Theme applied to the active deck.";
}

function openPresentationMode() {
  const presentationId = getPresentationState().activePresentationId;
  if (!presentationId) {
    window.alert("Select a presentation before opening presentation mode.");
    return;
  }

  const slideIndex = Number.isFinite(Number(state.selectedSlideIndex)) && Number(state.selectedSlideIndex) > 0
    ? Number(state.selectedSlideIndex)
    : 1;
  const presentHref = state.hypermedia
    && state.hypermedia.activePresentation
    && state.hypermedia.activePresentation.links
    && state.hypermedia.activePresentation.links.present
    && state.hypermedia.activePresentation.links.present.href
      ? state.hypermedia.activePresentation.links.present.href
      : `/present/${encodeURIComponent(presentationId)}`;
  const url = `${presentHref}#x=${slideIndex}`;
  const popup = window.open(url, "_blank");
  if (!popup) {
    window.location.href = url;
  }
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
    state.savedThemes = payload.savedThemes || state.savedThemes;
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

  state.assistant = payload.assistant || { selection: null, session: null, suggestions: [] };
  state.context = payload.context;
  state.creationDraft = payload.creationDraft || null;
  state.deckStructureCandidates = [];
  state.favoriteLayouts = payload.favoriteLayouts || [];
  state.hypermedia = {
    ...(state.hypermedia || {}),
    activePresentation,
    root: apiRoot
  };
  state.layouts = payload.layouts || [];
  state.materials = payload.materials || [];
  state.customVisuals = payload.customVisuals || [];
  state.outlinePlans = payload.outlinePlans || [];
  setDomPreviewState(payload);
  state.presentations = payload.presentations || { activePresentationId: null, presentations: [] };
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  state.skippedSlides = payload.skippedSlides || [];
  state.savedThemes = payload.savedThemes || [];
  state.sources = payload.sources || [];
  const runtimeHistory = payload.runtime && Array.isArray(payload.runtime.workflowHistory)
    ? payload.runtime.workflowHistory
    : [];
  state.workflowHistory = runtimeHistory.filter((entry: unknown): entry is StudioClientState.WorkflowState => isJsonRecord(entry));
  state.selectedDeckStructureId = null;
  state.deckLengthPlan = null;
  elements.deckLengthTarget.value = "";
  state.slides = payload.slides;
  state.transientVariants = [];
  state.variantStorage = payload.variantStorage || null;
  state.variants = payload.variants || [];

  syncSelectedSlideToActiveList();
  if (state.creationDraft && state.creationDraft.fields) {
    presentationCreationWorkbench.applyFields(state.creationDraft.fields);
    state.ui.creationStage = presentationCreationWorkbench.normalizeStage(state.creationDraft.stage || state.ui.creationStage);
  }

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
        deck: {
          audience: elements.deckAudience.value,
          author: elements.deckAuthor.value,
          company: elements.deckCompany.value,
          constraints: elements.deckConstraints.value,
          designConstraints: {
            maxWordsPerSlide: elements.designMaxWords.value,
            minCaptionGapIn: elements.designMinCaptionGap.value,
            minContentGapIn: elements.designMinContentGap.value,
            minFontSizePt: elements.designMinFontSize.value,
            minPanelPaddingIn: elements.designMinPanelPadding.value
          },
          objective: elements.deckObjective.value,
          outline: elements.deckOutline.value,
          subject: elements.deckSubject.value,
          themeBrief: getDeckThemeBriefValue(),
          lang: elements.deckLang.value,
          validationSettings: {
            mediaValidationMode: elements.validationMediaMode.value,
            rules: Object.fromEntries(
              getValidationRuleSelects().map((element) => [
                element.dataset.validationRule,
                element.value
              ])
            )
          },
          visualTheme: getDeckVisualThemeFromFields(),
          title: elements.deckTitle.value,
          tone: elements.deckTone.value
        }
      }),
      method: "POST"
    });

    state.context = payload.context;
    state.domPreview = {
      ...state.domPreview,
      theme: payload.context && payload.context.deck ? payload.context.deck.visualTheme : state.domPreview.theme
    };
    state.deckStructureCandidates = [];
    state.selectedDeckStructureId = null;
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
          validationSettings: {
            mediaValidationMode: elements.validationMediaMode.value,
            rules: Object.fromEntries(
              getValidationRuleSelects().map((element) => [
                element.dataset.validationRule,
                element.value
              ])
            )
          }
        }
      }),
      method: "POST"
    });

    state.context = payload.context;
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
  state.previews = payload.previews;
  state.runtime = payload.runtime;
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
    state.previews = payload.previews;
    state.runtime = payload.runtime || state.runtime;
    state.validation = payload;
    renderStatus();
    renderPreviews();
    renderVariantComparison();
    renderValidation();
  } finally {
    done();
  }
}

async function exportPdf() {
  const done = setBusy(elements.exportMenuButton, "Exporting...");
  try {
    const payload = await buildDeck();
    StudioClientArtifactDownload.download(
      window,
      payload.pdf?.url,
      StudioClientArtifactDownload.getFileName(payload.pdf?.path, "deck.pdf")
    );
    elements.operationStatus.textContent = payload.pdf?.path
      ? `Exported PDF to ${payload.pdf.path}.`
      : "Exported PDF.";
  } finally {
    done();
  }
}

async function exportPptx() {
  const done = setBusy(elements.exportMenuButton, "Exporting...");
  try {
    const payload = await request<PptxExportPayload>("/api/exports/pptx", {
      body: JSON.stringify({}),
      method: "POST"
    });
    state.runtime = payload.runtime || state.runtime;
    renderStatus();
    const slideCount = payload.diagnostics?.slideCount || 0;
    const resolution = payload.diagnostics?.imageResolution || "2x";
    StudioClientArtifactDownload.download(
      window,
      payload.pptx?.url,
      StudioClientArtifactDownload.getFileName(payload.pptx?.path, "deck.pptx")
    );
    elements.operationStatus.textContent = payload.pptx?.path
      ? `Exported PPTX (${slideCount} slide${slideCount === 1 ? "" : "s"}, ${resolution}) to ${payload.pptx.path}.`
      : "Exported PPTX.";
  } finally {
    done();
  }
}

function setExportMenuOpen(open: boolean) {
  elements.exportMenuPopover.hidden = !open;
  elements.exportMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
}

function isExportMenuOpen() {
  return elements.exportMenuPopover.hidden === false;
}

function closeExportMenu() {
  setExportMenuOpen(false);
}

function toggleExportMenu() {
  setExportMenuOpen(!isExportMenuOpen());
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
  return workflowRunners.runDeckStructure({ button, endpoint });
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
  return workflowRunners.runSlideCandidate({ button, endpoint });
}

function mountStudioCommandControls() {
elements.checkLlmButton.addEventListener("click", () => checkLlmProvider().catch((error) => window.alert(error.message)));
runtimeStatusWorkbench.mountLlmModelControls();
elements.ideateSlideButton.addEventListener("click", () => ideateSlide().catch((error) => window.alert(error.message)));
elements.ideateStructureButton.addEventListener("click", () => ideateStructure().catch((error) => window.alert(error.message)));
elements.ideateThemeButton.addEventListener("click", () => ideateTheme().catch((error) => window.alert(error.message)));
elements.ideateDeckStructureButton.addEventListener("click", () => ideateDeckStructure().catch((error) => window.alert(error.message)));
elements.redoLayoutButton.addEventListener("click", () => redoLayout().catch((error) => window.alert(error.message)));
elements.captureVariantButton.addEventListener("click", () => {
  if (variantReviewWorkbench) {
    return;
  }
  getVariantReviewWorkbench()
    .then(() => elements.captureVariantButton.click())
    .catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
});
slideEditorWorkbench.mount();
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
elements.exportMenuButton.addEventListener("click", () => toggleExportMenu());
elements.exportPdfButton.addEventListener("click", () => {
  closeExportMenu();
  exportPdf().catch((error) => window.alert(error.message));
});
elements.exportPptxButton.addEventListener("click", () => {
  closeExportMenu();
  exportPptx().catch((error) => window.alert(error.message));
});
appTheme.mount();
navigationShell.mount();
elements.saveDeckContextButton.addEventListener("click", () => saveDeckContext().catch((error) => window.alert(error.message)));
elements.saveValidationSettingsButton.addEventListener("click", () => saveValidationSettings().catch((error) => window.alert(error.message)));
elements.saveSlideContextButton.addEventListener("click", () => saveSlideContext().catch((error) => window.alert(error.message)));
presentationCreationWorkbench.mountCommandControls();
elements.openPresentationModeButton.addEventListener("click", openPresentationMode);
if (elements.manualSystemType) {
  elements.manualSystemType.addEventListener("change", renderManualSlideForm);
}
elements.presentationSearch.addEventListener("input", renderPresentationLibrary);
}

function mountGlobalEvents() {
  navigationShell.mountGlobalEvents();
  window.document.addEventListener("click", (event) => {
    const target = event.target;
    if (!isExportMenuOpen() || !(target instanceof Node) || elements.exportMenu.contains(target)) {
      return;
    }
    closeExportMenu();
  });
  window.document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeExportMenu();
    }
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
  renderPages();
  renderAllDrawers();
  renderManualSlideForm();
  connectRuntimeStream();

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
