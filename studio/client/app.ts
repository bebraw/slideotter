// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// slide-dom.ts and persistent writes go through server APIs.
declare const StudioClientCore: any;
declare const StudioClientApiExplorer: any;
declare const StudioClientAppTheme: any;
declare const StudioClientCustomLayoutWorkbench: any;
declare const StudioClientDrawers: any;
declare const StudioClientElements: any;
declare const StudioClientLlmStatus: any;
declare const StudioClientPresentationCreationWorkbench: any;
declare const StudioClientPresentationLibrary: any;
declare const StudioClientPreferences: any;
declare const StudioClientSlidePreview: any;
declare const StudioClientSlideEditorWorkbench: any;
declare const StudioClientState: any;
declare const StudioClientThemeWorkbench: any;
declare const StudioClientValidationReport: any;
declare const StudioClientVariantReviewWorkbench: any;
declare const StudioClientWorkflows: any;

const state: any = StudioClientState.createInitialState();
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

const elements: Record<string, any> = StudioClientElements.createElements(StudioClientCore);
const apiExplorer = StudioClientApiExplorer.createApiExplorer({
  elements,
  escapeHtml,
  request,
  state,
  window
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
const slidePreview = StudioClientSlidePreview.createSlidePreview({
  escapeHtml,
  getTheme: getDomTheme,
  windowRef: window
});
const slideEditorWorkbench = StudioClientSlideEditorWorkbench.createSlideEditorWorkbench({
  clearTransientVariants,
  elements,
  escapeHtml,
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
const presentationLibrary = StudioClientPresentationLibrary.createPresentationLibrary({
  elements,
  escapeHtml,
  getPresentationState,
  refreshState,
  renderDomSlide,
  request,
  setBusy,
  setCurrentPage,
  state,
  windowRef: window
});
const presentationCreationWorkbench = StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench({
  elements,
  escapeHtml,
  getPresentationState,
  isWorkflowRunning,
  readFileAsDataUrl,
  renderCreationThemeStage,
  renderDomSlide,
  renderSavedThemes,
  resetThemeCandidates,
  resetPresentationSelection: presentationLibrary.resetSelection,
  refreshState,
  request,
  setBusy,
  setCurrentPage,
  state,
  windowRef: window
});
const themeWorkbench = StudioClientThemeWorkbench.createThemeWorkbench({
  applyCreationTheme,
  applyDeckThemeFields,
  applySavedTheme,
  applySavedThemeToDeck,
  elements,
  escapeHtml,
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
  state
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
const customLayoutWorkbench = StudioClientCustomLayoutWorkbench.createCustomLayoutWorkbench({
  applySlideSpecPayload,
  clearTransientVariants,
  elements,
  escapeHtml,
  openVariantGenerationControls,
  renderDomSlide,
  renderPreviews,
  renderSlideFields,
  renderStatus,
  renderVariants,
  request,
  setBusy,
  setCurrentPage,
  setDomPreviewState,
  setLayoutDrawerOpen,
  state
});
const variantReviewWorkbench = StudioClientVariantReviewWorkbench.createVariantReviewWorkbench({
  createDomElement,
  customLayoutWorkbench,
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

function getValidationRuleSelects(): any[] {
  return Array.from(document.querySelectorAll("[data-validation-rule]"));
}

function getDomRenderer() {
  return (window as any).SlideDomRenderer || null;
}

function getDomTheme() {
  const renderer = getDomRenderer();
  const theme = state.domPreview && state.domPreview.theme
    ? state.domPreview.theme
    : state.context && state.context.deck && state.context.deck.visualTheme;
  return renderer && typeof renderer.normalizeTheme === "function"
    ? renderer.normalizeTheme(theme || {})
    : (theme || {});
}

function getVariantVisualTheme(variant) {
  if (!variant || !variant.visualTheme || typeof variant.visualTheme !== "object" || Array.isArray(variant.visualTheme)) {
    return null;
  }

  const renderer = getDomRenderer();
  const theme = {
    ...getDomTheme(),
    ...variant.visualTheme
  };

  return renderer && typeof renderer.normalizeTheme === "function"
    ? renderer.normalizeTheme(theme)
    : theme;
}

function setDomPreviewState(payload) {
  const domPreview = payload && payload.domPreview && typeof payload.domPreview === "object"
    ? payload.domPreview
    : {};
  state.domPreview = {
    slides: Array.isArray(domPreview.slides) ? domPreview.slides : [],
    theme: domPreview.theme || (state.context && state.context.deck ? state.context.deck.visualTheme : null)
  };
}

function patchDomSlideSpec(slideId, slideSpec) {
  if (!slideId || !slideSpec) {
    return;
  }

  const nextSlides = Array.isArray(state.domPreview.slides) ? state.domPreview.slides.slice() : [];
  const existingIndex = nextSlides.findIndex((entry) => entry && entry.id === slideId);
  const currentSlide = state.slides.find((entry) => entry.id === slideId);
  const nextEntry = {
    id: slideId,
    index: currentSlide ? currentSlide.index : slideSpec.index,
    slideSpec,
    title: slideSpec.title || (currentSlide && currentSlide.title) || ""
  };

  if (existingIndex >= 0) {
    nextSlides[existingIndex] = {
      ...nextSlides[existingIndex],
      ...nextEntry
    };
  } else {
    nextSlides.push(nextEntry);
  }

  state.domPreview = {
    ...state.domPreview,
    slides: nextSlides
  };
}

function getDomSlideSpec(slideId) {
  const match = Array.isArray(state.domPreview.slides)
    ? state.domPreview.slides.find((entry) => entry && entry.id === slideId)
    : null;
  return match && match.slideSpec ? match.slideSpec : null;
}


function enableDomSlideTextEditing(viewport) {
  slideEditorWorkbench.enableDomSlideTextEditing(viewport);
}

function pathToString(path) {
  return slideEditorWorkbench.pathToString(path);
}

function hashFieldValue(value) {
  return slideEditorWorkbench.hashFieldValue(value);
}

function getSlideSpecPathValue(slideSpec, path) {
  return slideEditorWorkbench.getSlideSpecPathValue(slideSpec, path);
}

function applySlideSpecPayload(payload, fallbackSpec) {
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

function renderImagePreview(viewport, url, alt) {
  slidePreview.renderImagePreview(viewport, url, alt);
}

function renderDomSlide(viewport, slideSpec, options: any = {}) {
  slidePreview.renderDomSlide(viewport, slideSpec, options);
}

function toColorInputValue(value, fallback = "#000000") {
  const normalized = String(value || "").trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : fallback;
}

function toFontSelectValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["avenir", "editorial", "workshop", "mono"].includes(normalized)) {
    return normalized;
  }
  if (normalized.includes("georgia") || normalized.includes("times new roman")) {
    return "editorial";
  }
  if (normalized.includes("trebuchet") || normalized.includes("verdana")) {
    return "workshop";
  }
  if (normalized.includes("sfmono") || normalized.includes("consolas") || normalized.includes("liberation mono")) {
    return "mono";
  }
  return "avenir";
}

function renderStatus() {
  const llm = state.runtime && state.runtime.llm;
  const validation = state.runtime && state.runtime.validation;
  const workflow = state.runtime && state.runtime.workflow;
  const workflowRunning = workflow && workflow.status === "running";
  const selected = state.slides.find((slide) => slide.id === state.selectedSlideId);
  const llmView = llmStatus.getConnectionView(llm);

  elements.validationStatus.textContent = validation && validation.updatedAt
    ? `Checks ${validation.ok ? "passed" : "need review"}`
    : "Checks idle";
  elements.validationStatus.dataset.state = validation && validation.updatedAt
    ? (validation.ok ? "ok" : "warn")
    : "idle";
  elements.llmNavStatus.textContent = llmView.label;
  elements.llmNavStatus.dataset.state = llmView.state;
  elements.showLlmDiagnosticsButton.title = llmView.detail;
  elements.showLlmDiagnosticsButton.setAttribute("aria-label", `${llmView.label}. ${llmView.detail}`);
  elements.showLlmDiagnosticsButton.classList.toggle("active", state.ui.llmPopoverOpen);
  elements.showLlmDiagnosticsButton.setAttribute("aria-expanded", state.ui.llmPopoverOpen ? "true" : "false");
  elements.llmPopover.hidden = !state.ui.llmPopoverOpen;
  presentationCreationWorkbench.renderContentRunNavStatus();
  presentationCreationWorkbench.renderStudioContentRunPanel();

  elements.ideateSlideButton.disabled = !selected || workflowRunning;
  elements.ideateStructureButton.disabled = !selected || workflowRunning;
  elements.ideateThemeButton.disabled = !selected || workflowRunning;
  elements.redoLayoutButton.disabled = !selected || workflowRunning;
  elements.quickCustomLayoutButton.disabled = !selected || !customLayoutWorkbench.isSupported() || workflowRunning;
  elements.quickCustomLayoutProfile.disabled = !selected || !customLayoutWorkbench.isSupported() || workflowRunning;
  elements.captureVariantButton.disabled = !selected;
  elements.saveLayoutButton.disabled = !selected || !state.selectedSlideSpec;
  if (elements.customLayoutPreviewButton) {
    const customLayoutDisabled = !selected || !customLayoutWorkbench.isSupported() || workflowRunning;
    elements.customLayoutLoadButton.disabled = customLayoutDisabled;
    elements.customLayoutPreviewButton.disabled = customLayoutDisabled;
    elements.customLayoutDiscardButton.disabled = customLayoutDisabled;
  }
  elements.applyLayoutButton.disabled = !selected || !state.selectedSlideSpec || !elements.layoutLibrarySelect.value;
  const selectedLayoutValue = elements.layoutLibrarySelect.value || "";
  elements.favoriteLayoutButton.disabled = !selectedLayoutValue || selectedLayoutValue.startsWith("favorite:");
  elements.deleteFavoriteLayoutButton.disabled = !selectedLayoutValue.startsWith("favorite:");
  elements.materialDetachButton.disabled = !selected || !state.selectedSlideSpec || !state.selectedSlideSpec.media;
  elements.materialUploadButton.disabled = workflowRunning;
  elements.openPresentationModeButton.disabled = !getPresentationState().activePresentationId;
  elements.saveSlideSpecButton.disabled = !selected
    || !state.selectedSlideStructured
    || !state.selectedSlideSpec
    || Boolean(state.selectedSlideSpecDraftError);
  elements.selectedSlideLabel.textContent = selected
    ? `${selected.index}/${state.slides.length} ${selected.title}`
    : "Slide not selected";
  renderVariantFlow();
  renderCreationDraft();
  renderWorkflowHistory();
  renderMaterials();
  customLayoutWorkbench.renderLibrary();
  renderSources();
  renderSourceRetrieval();
  renderPromptBudget();
  renderApiExplorer();

  const llmDetail = llmView.detail.startsWith(llmView.providerLine)
    ? llmView.detail.slice(llmView.providerLine.length)
    : `. ${llmView.detail}`;
  elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(llmView.providerLine)}</strong>${escapeHtml(llmDetail)}`;
}

function setLlmPopoverOpen(open) {
  llmStatus.setPopoverOpen(open);
}

function toggleLlmPopover() {
  llmStatus.togglePopover();
}

function loadAssistantDrawerPreference() {
  return StudioClientPreferences.loadDrawerOpen("assistant");
}

function persistAssistantDrawerPreference() {
  StudioClientPreferences.persistDrawerOpen("assistant", state.ui.assistantOpen);
}

function loadStructuredDraftDrawerPreference() {
  return StudioClientPreferences.loadDrawerOpen("structuredDraft");
}

function loadContextDrawerPreference() {
  return StudioClientPreferences.loadDrawerOpen("context");
}

function persistStructuredDraftDrawerPreference() {
  StudioClientPreferences.persistDrawerOpen("structuredDraft", state.ui.structuredDraftOpen);
}

function persistContextDrawerPreference() {
  StudioClientPreferences.persistDrawerOpen("context", state.ui.contextDrawerOpen);
}

function loadCurrentPagePreference() {
  return StudioClientPreferences.loadCurrentPage();
}

function persistCurrentPagePreference() {
  StudioClientPreferences.persistCurrentPage(state.ui.currentPage);
}

function renderPages() {
  const current = state.ui.currentPage;
  elements.presentationsPage.hidden = current !== "presentations";
  elements.studioPage.hidden = current !== "studio";
  elements.layoutStudioPage.hidden = current !== "layout-studio";
  elements.planningPage.hidden = current !== "planning";
  elements.validationPage.hidden = !state.ui.checksOpen;
  elements.selectedSlideLabel.hidden = current !== "studio";
  elements.openPresentationModeButton.hidden = current !== "studio";
  elements.contextDrawer.hidden = current !== "studio";
  elements.debugDrawer.hidden = current !== "studio";
  elements.layoutDrawer.hidden = current !== "studio";
  elements.structuredDraftDrawer.hidden = current !== "studio";
  elements.themeDrawer.hidden = current !== "studio";
  elements.showPresentationsPageButton.classList.toggle("active", current === "presentations");
  elements.showStudioPageButton.classList.toggle("active", current === "studio");
  elements.showLayoutStudioPageButton.classList.toggle("active", current === "layout-studio");
  elements.showPlanningPageButton.classList.toggle("active", current === "planning");
  elements.showValidationPageButton.classList.toggle("active", state.ui.checksOpen);
  elements.showPresentationsPageButton.setAttribute("aria-pressed", current === "presentations" ? "true" : "false");
  elements.showStudioPageButton.setAttribute("aria-pressed", current === "studio" ? "true" : "false");
  elements.showLayoutStudioPageButton.setAttribute("aria-pressed", current === "layout-studio" ? "true" : "false");
  elements.showPlanningPageButton.setAttribute("aria-pressed", current === "planning" ? "true" : "false");
  elements.showValidationPageButton.setAttribute("aria-expanded", state.ui.checksOpen ? "true" : "false");
  renderAllDrawers();
  customLayoutWorkbench.renderLayoutStudio();
}

function setCurrentPage(page) {
  state.ui.currentPage = page === "planning" || page === "presentations" || page === "layout-studio" ? page : "studio";
  const nextHash = `#${state.ui.currentPage}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
  persistCurrentPagePreference();
  renderPages();
}

function setChecksPanelOpen(open) {
  state.ui.checksOpen = Boolean(open);
  renderPages();
}

const drawerConfigs = {
  assistant: {
    bodyClass: "assistant-open",
    drawer: () => elements.assistantDrawer,
    closedLabel: "Open workflow assistant",
    hideWhenUnavailable: true,
    openLabel: "Close workflow assistant",
    persist: persistAssistantDrawerPreference,
    stateKey: "assistantOpen",
    toggle: () => elements.assistantToggle
  },
  context: {
    bodyClass: "context-drawer-open",
    drawer: () => elements.contextDrawer,
    closedLabel: "Open slide context",
    openLabel: "Close slide context",
    persist: persistContextDrawerPreference,
    stateKey: "contextDrawerOpen",
    toggle: () => elements.contextDrawerToggle
  },
  debug: {
    bodyClass: "debug-drawer-open",
    drawer: () => elements.debugDrawer,
    closedLabel: "Open generation diagnostics",
    onOpen: () => {
      if (!getApiExplorerState().resource) {
        openApiExplorerResource(getApiExplorerState().url || "/api/v1", { pushHistory: false }).catch((error) => {
          elements.apiExplorerStatus.textContent = error.message;
        });
      }
    },
    openLabel: "Close generation diagnostics",
    stateKey: "debugDrawerOpen",
    toggle: () => elements.debugDrawerToggle
  },
  layout: {
    afterRender: customLayoutWorkbench.renderEditor,
    afterSet: renderPreviews,
    bodyClass: "layout-drawer-open",
    drawer: () => elements.layoutDrawer,
    closedLabel: "Open layout controls",
    onBeforeSet: () => {
      state.ui.customLayoutDefinitionPreviewActive = false;
      state.ui.customLayoutMainPreviewActive = false;
    },
    onOpen: () => {
      elements.customLayoutStatus.textContent = customLayoutWorkbench.isSupported() ? "Draft" : "Content and cover slides only";
    },
    openLabel: "Close layout controls",
    stateKey: "layoutDrawerOpen",
    toggle: () => elements.layoutDrawerToggle
  },
  structuredDraft: {
    bodyClass: "structured-draft-open",
    drawer: () => elements.structuredDraftDrawer,
    closedLabel: "Open structured draft editor",
    openLabel: "Close structured draft editor",
    persist: persistStructuredDraftDrawerPreference,
    stateKey: "structuredDraftOpen",
    toggle: () => elements.structuredDraftToggle
  },
  theme: {
    afterRender: renderCreationThemeStage,
    bodyClass: "theme-drawer-open",
    drawer: () => elements.themeDrawer,
    closedLabel: "Open theme control",
    hideWhenUnavailable: true,
    openLabel: "Close theme control",
    stateKey: "themeDrawerOpen",
    toggle: () => elements.themeDrawerToggle
  }
};
const drawerOrder = ["assistant", "context", "debug", "layout", "structuredDraft", "theme"];
const drawerController = StudioClientDrawers.createDrawerController({
  configs: drawerConfigs,
  documentBody: document.body,
  isAvailable: () => state.ui.currentPage === "studio",
  order: drawerOrder,
  state
});

function renderAllDrawers() {
  drawerController.renderAll();
}

function setAssistantDrawerOpen(open) {
  drawerController.setOpen("assistant", open);
}

function setStructuredDraftDrawerOpen(open) {
  drawerController.setOpen("structuredDraft", open);
}

function setContextDrawerOpen(open) {
  drawerController.setOpen("context", open);
}

function setDebugDrawerOpen(open) {
  drawerController.setOpen("debug", open);
}

function setLayoutDrawerOpen(open) {
  drawerController.setOpen("layout", open);
}

function renderThemeDrawer() {
  drawerController.render("theme");
}

function setThemeDrawerOpen(open) {
  drawerController.setOpen("theme", open);
}

function getSelectedVariant() {
  return variantReviewWorkbench.getSelectedVariant();
}

function clearTransientVariants(slideId) {
  variantReviewWorkbench.clearTransientVariants(slideId);
}

function openVariantGenerationControls() {
  variantReviewWorkbench.openGenerationControls();
}

function renderVariantFlow() {
  variantReviewWorkbench.renderFlow();
}

function renderVariants() {
  variantReviewWorkbench.render();
}

function renderVariantComparison() {
  variantReviewWorkbench.renderComparison();
}

function replacePersistedVariantsForSlide(slideId, variants) {
  variantReviewWorkbench.replacePersistedVariantsForSlide(slideId, variants);
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

function formatDeckActionLabel(action) {
  return ({
    insert: "Insert",
    keep: "Keep",
    move: "Move",
    remove: "Archive",
    replace: "Replace",
    "retitle-and-move": "Retitle + move",
    "retitle-and-replace": "Retitle + replace",
    retitle: "Retitle",
    shared: "Shared"
  })[action] || action;
}

function groupDeckPlanSteps(plan = []) {
  const grouped = new Map();

  plan.forEach((slide) => {
    const action = String(slide && slide.action ? slide.action : "keep");
    if (action === "keep") {
      return;
    }

    const label = formatDeckActionLabel(action);
    const current = grouped.get(action) || {
      action,
      items: [],
      label
    };
    current.items.push(slide);
    grouped.set(action, current);
  });

  return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function buildDeckDiffSupport(details) {
  const planStats = details.planStats || {};
  const diff = details.diff || {};
  const diffCounts = diff.counts || {};
  const diffFiles = Array.isArray(details.diffFiles) ? details.diffFiles : [];
  const deckChanges = Array.isArray(details.deckChanges) ? details.deckChanges : [];
  const plan = Array.isArray(details.plan) ? details.plan : [];
  const currentSequence = Array.isArray(details.currentSequence) ? details.currentSequence : [];
  const proposedSequence = Array.isArray(details.proposedSequence) ? details.proposedSequence : [];
  const changedSlides = [
    planStats.inserted || 0,
    planStats.replaced || 0,
    planStats.archived || 0,
    planStats.moved || 0,
    planStats.retitled || 0
  ].reduce((total, count) => total + count, 0);
  const sharedChanges = (planStats.shared || 0) || deckChanges.length || (diffCounts.shared || 0);
  const totalImpact = changedSlides + sharedChanges + diffFiles.length;
  const beforeSlides = (diffCounts.beforeSlides || currentSequence.length || 0);
  const afterSlides = (diffCounts.afterSlides || proposedSequence.length || 0);
  const scale = totalImpact >= 12 || changedSlides >= 8 || diffFiles.length >= 6
    ? "Large"
    : totalImpact >= 5 || changedSlides >= 3 || diffFiles.length >= 3
      ? "Medium"
      : "Small";
  const metrics = [
    { label: "slide actions", value: changedSlides },
    { label: "files", value: diffFiles.length },
    { label: "shared", value: sharedChanges },
    { label: "slide delta", signed: true, value: afterSlides - beforeSlides }
  ];
  const focusItems = [
    { action: "insert", count: planStats.inserted || 0 },
    { action: "replace", count: planStats.replaced || 0 },
    { action: "remove", count: planStats.archived || 0 },
    { action: "move", count: planStats.moved || 0 },
    { action: "retitle", count: planStats.retitled || 0 },
    { action: "shared", count: sharedChanges }
  ].filter((item) => item.count > 0);
  const cues = [];

  if (scale === "Large") {
    cues.push("Review the strip, affected previews, and file targets before applying.");
  } else if (scale === "Medium") {
    cues.push("Check the action map and changed file list before applying.");
  } else {
    cues.push("A focused preview pass should be enough for this candidate.");
  }

  if ((planStats.archived || 0) > 0) {
    cues.push("Archived slides are preserved by guardrails; confirm the narrative still has their claims.");
  }

  if (sharedChanges > 0) {
    cues.push("Shared deck settings change with this candidate unless you clear that apply option.");
  }

  if (diffFiles.length >= 4) {
    cues.push("Multiple slide files change; run checks after applying.");
  }

  const changedPlanSteps = plan.filter((slide) => slide && slide.action && slide.action !== "keep");
  const actionMap = changedPlanSteps
    .slice(0, 14)
    .map((slide) => ({
      action: slide.action,
      currentIndex: slide.currentIndex,
      proposedIndex: slide.proposedIndex,
      title: slide.proposedTitle || slide.currentTitle || "Untitled"
    }));
  const overflow = Math.max(0, changedPlanSteps.length - actionMap.length);

  return {
    actionMap,
    cues,
    focusItems,
    metrics,
    overflow,
    scale
  };
}

function renderDeckDiffSupport(support) {
  const formatMetricValue = (metric) => metric.signed && metric.value > 0
    ? `+${metric.value}`
    : String(metric.value);

  return `
    <section class="deck-diff-panel">
      <div class="compare-decision-head">
        <div>
          <p class="eyebrow">Diff impact</p>
          <strong>${escapeHtml(support.scale)} deck change</strong>
        </div>
        <div class="compare-decision-metrics">
          ${support.metrics.map((metric) => `
            <span><strong>${escapeHtml(formatMetricValue(metric))}</strong> ${escapeHtml(metric.label)}</span>
          `).join("")}
        </div>
      </div>
      ${support.focusItems.length ? `
        <div class="compare-decision-focus" aria-label="Deck diff focus">
          ${support.focusItems.map((item) => `
            <span class="compare-decision-chip">
              <strong>${escapeHtml(formatDeckActionLabel(item.action))}</strong>
              ${item.count}
            </span>
          `).join("")}
        </div>
      ` : ""}
      ${support.actionMap.length ? `
        <div class="deck-diff-map" aria-label="Deck action map">
          ${support.actionMap.map((item) => {
            const indexLabel = Number.isFinite(item.proposedIndex)
              ? item.proposedIndex
              : (Number.isFinite(item.currentIndex) ? item.currentIndex : "?");

            return `
              <span class="deck-diff-node" data-action="${escapeHtml(item.action)}" title="${escapeHtml(item.title)}">
                <strong>${escapeHtml(String(indexLabel))}</strong>
                ${escapeHtml(formatDeckActionLabel(item.action))}
              </span>
            `;
          }).join("")}
          ${support.overflow ? `<span class="deck-diff-node overflow"><strong>+${support.overflow}</strong> more</span>` : ""}
        </div>
      ` : ""}
      <div class="compare-decision-cues">
        ${support.cues.map((cue) => `<p>${escapeHtml(cue)}</p>`).join("")}
      </div>
    </section>
  `;
}

function describeWorkflowProgress(workflow) {
  if (!workflow) {
    return "";
  }

  if (workflow.message) {
    return workflow.message;
  }

  const fallback = ({
    "gathering-context": "Gathering context...",
    "generating-variants": "Generating variants...",
    "rendering-variants": "Rendering previews...",
    "rebuilding-previews": "Rebuilding previews...",
    "validating-geometry-text": "Running checks...",
    "validating-render": "Running full gate...",
    completed: "Workflow completed."
  })[workflow.stage];

  return fallback || "Working...";
}

function renderWorkflowHistory() {
  const events = Array.isArray(state.workflowHistory) ? state.workflowHistory.slice(-4).reverse() : [];

  if (!events.length) {
    elements.workflowHistory.innerHTML = "";
    return;
  }

  elements.workflowHistory.innerHTML = events.map((event) => {
    const labelParts = [
      event.operation || "workflow",
      event.slideId || "",
      event.stage || event.status || ""
    ].filter(Boolean);

    return `
      <div class="workflow-history-item">
        <strong>${escapeHtml(labelParts.join(" • "))}</strong>
        <span>${escapeHtml(event.message || describeWorkflowProgress(event))}</span>
      </div>
    `;
  }).join("");
}

function renderSourceRetrieval() {
  if (!elements.sourceRetrievalList) {
    return;
  }

  const retrieval = state.runtime && state.runtime.sourceRetrieval;
  const snippets = retrieval && Array.isArray(retrieval.snippets) ? retrieval.snippets : [];
  if (!snippets.length) {
    if (elements.sourceRetrievalSummary) {
      elements.sourceRetrievalSummary.textContent = "No source snippets were used by the last generation.";
    }
    elements.sourceRetrievalList.innerHTML = "<div class=\"source-retrieval-empty\">No source snippets were used by the last generation.</div>";
    return;
  }

  if (elements.sourceRetrievalSummary) {
    const budget = retrieval && retrieval.budget ? retrieval.budget : {};
    const sourceKeys = new Set(snippets.map((snippet) => snippet.sourceId || snippet.title || snippet.url || "").filter(Boolean));
    const sourceCount = Number.isFinite(Number(budget.sourceCount)) ? Number(budget.sourceCount) : sourceKeys.size || snippets.length;
    const promptChars = Number.isFinite(Number(budget.promptCharCount)) ? Number(budget.promptCharCount) : null;
    const omittedCount = Number.isFinite(Number(budget.omittedSnippetCount)) ? Number(budget.omittedSnippetCount) : 0;
    const budgetLabel = promptChars === null ? "" : `, ${promptChars} source chars`;
    const omittedLabel = omittedCount > 0 ? `, ${omittedCount} omitted by budget` : "";
    elements.sourceRetrievalSummary.textContent = `${snippets.length} source snippet${snippets.length === 1 ? "" : "s"} from ${sourceCount} source${sourceCount === 1 ? "" : "s"} informed the last generation${budgetLabel}${omittedLabel}.`;
  }

  elements.sourceRetrievalList.innerHTML = snippets.map((snippet, index) => {
    const meta = [
      snippet.url || "",
      Number.isFinite(Number(snippet.chunkIndex)) ? `chunk ${Number(snippet.chunkIndex) + 1}` : ""
    ].filter(Boolean).join(" · ");

    return `
      <article class="source-retrieval-card">
        <strong>${escapeHtml(snippet.title || `Source ${index + 1}`)}</strong>
        <span>${escapeHtml(meta || "Retrieved source")}</span>
        <p>${escapeHtml(snippet.text || "Snippet text is not stored in diagnostics.")}</p>
      </article>
    `;
  }).join("");
}

function formatCharCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function renderPromptBudget() {
  if (!elements.promptBudgetList) {
    return;
  }

  const budget = state.runtime && state.runtime.promptBudget;
  if (!budget) {
    if (elements.promptBudgetSummary) {
      elements.promptBudgetSummary.textContent = "No prompt budget has been recorded yet.";
    }
    elements.promptBudgetList.innerHTML = "<div class=\"source-retrieval-empty\">No prompt budget has been recorded yet.</div>";
    return;
  }

  const totalPrompt = Number(budget.totalPromptCharCount || 0);
  const responseChars = Number.isFinite(Number(budget.responseCharCount)) ? Number(budget.responseCharCount) : null;
  const retryLabel = Number(budget.retryCount || 0) > 0 ? `, ${budget.retryCount} retry` : "";
  if (elements.promptBudgetSummary) {
    elements.promptBudgetSummary.textContent = `${budget.workflowName || budget.schemaName || "LLM workflow"} used ${formatCharCount(totalPrompt)} prompt chars with a ${formatCharCount(budget.requestedMaxOutputTokens)} token output cap${retryLabel}.`;
  }

  const rows = [
    ["Developer prompt", budget.developerPromptCharCount],
    ["User prompt", budget.userPromptCharCount],
    ["Schema", budget.schemaCharCount],
    ["Source context", budget.sourcePromptCharCount],
    ["Material context", budget.materialPromptCharCount],
    ["Response", responseChars]
  ];

  elements.promptBudgetList.innerHTML = `
    <article class="source-retrieval-card">
      <strong>${escapeHtml(budget.provider || "LLM")} ${escapeHtml(budget.model || "")}</strong>
      <span>${escapeHtml(budget.schemaName || "structured response")}</span>
      <p>${rows.map(([label, value]) => `${escapeHtml(label)}: ${formatCharCount(value)}`).join(" · ")}</p>
    </article>
  `;
}

function getApiExplorerState() {
  return apiExplorer.getState();
}

function renderApiExplorer() {
  apiExplorer.render();
}

async function openApiExplorerResource(href, options: any = {}) {
  return apiExplorer.openResource(href, options);
}

let runtimeEventSource = null;

function applyRuntimeUpdate(runtime) {
  if (!runtime) {
    return;
  }

  state.runtime = runtime;
  state.workflowHistory = Array.isArray(runtime.workflowHistory) ? runtime.workflowHistory : state.workflowHistory;
  renderStatus();
  renderWorkflowHistory();
  renderSourceRetrieval();
  renderPromptBudget();
  renderApiExplorer();

  const workflow = runtime.workflow;
  if (workflow && workflow.status) {
    elements.operationStatus.textContent = describeWorkflowProgress(workflow);
  }
}

function applyWorkflowEvent(workflowEvent) {
  if (!workflowEvent || typeof workflowEvent !== "object") {
    return;
  }

  const history = Array.isArray(state.workflowHistory) ? state.workflowHistory : [];
  const previous = history[history.length - 1];
  if (previous && previous.id === workflowEvent.id) {
    return;
  }

  state.workflowHistory = [
    ...history.slice(-11),
    workflowEvent
  ];
  renderWorkflowHistory();
}

function applyCreationDraftUpdate(creationDraft) {
  if (!creationDraft) {
    return;
  }

  const previousDraft = state.creationDraft;
  const previousPresentationId = state.creationDraft && state.creationDraft.createdPresentationId;
  const previousRunId = state.creationDraft && state.creationDraft.contentRun && state.creationDraft.contentRun.id;
  const nextRunId = creationDraft.contentRun && creationDraft.contentRun.id;
  state.creationDraft = creationDraft;
  if (creationDraft.stage) {
    state.ui.creationStage = presentationCreationWorkbench.normalizeStage(creationDraft.stage || state.ui.creationStage);
  }
  if (nextRunId && nextRunId !== previousRunId) {
    state.ui.creationContentSlidePinned = false;
  }
  if (creationDraft.contentRun && creationDraft.contentRun.status === "running" && !state.ui.creationContentSlidePinned) {
    state.ui.creationContentSlideIndex = presentationCreationWorkbench.getAutoContentRunSlideIndex(creationDraft.contentRun);
  }
  if (isEmptyCreationDraft(creationDraft) && !isEmptyCreationDraft(previousDraft)) {
    resetPresentationCreationControl();
  }

  presentationCreationWorkbench.renderContentRunNavStatus();
  renderCreationDraft();

  const nextPresentationId = creationDraft.createdPresentationId;
  const shouldRefreshLiveStudio = nextPresentationId
    && nextPresentationId === getPresentationState().activePresentationId
    && creationDraft.contentRun
    && state.ui.currentPage === "studio";
  if (shouldRefreshLiveStudio && !state.ui.creationStudioRefreshPending) {
    state.ui.creationStudioRefreshPending = true;
    refreshState()
      .catch((error) => window.alert(error.message))
      .finally(() => {
        state.ui.creationStudioRefreshPending = false;
      });
  }
  if (nextPresentationId && nextPresentationId !== previousPresentationId && nextPresentationId !== state.ui.lastCreatedPresentationId) {
    state.ui.lastCreatedPresentationId = nextPresentationId;
    refreshState()
      .then(() => {
        setCurrentPage("studio");
        state.ui.themeDrawerOpen = false;
        resetThemeCandidates();
        renderThemeDrawer();
        elements.operationStatus.textContent = "Created deck. Review the slides, then open Theme when the surface needs tuning.";
      })
      .catch((error) => window.alert(error.message));
  }
}

function connectRuntimeStream() {
  if (runtimeEventSource) {
    runtimeEventSource.close();
  }

  runtimeEventSource = new window.EventSource("/api/runtime/stream");
  runtimeEventSource.addEventListener("runtime", (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyRuntimeUpdate(payload.runtime);
    } catch (error) {
      // Ignore malformed stream messages and keep the connection alive.
    }
  });
  runtimeEventSource.addEventListener("workflow", (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyWorkflowEvent(payload.workflowEvent);
    } catch (error) {
      // Ignore malformed stream messages and keep the connection alive.
    }
  });
  runtimeEventSource.addEventListener("creationDraft", (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyCreationDraftUpdate(payload.creationDraft);
    } catch (error) {
      // Ignore malformed stream messages and keep the connection alive.
    }
  });
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
  elements.designMinFontSize.value = designConstraints.minFontSizePt ?? "";
  elements.designMinContentGap.value = designConstraints.minContentGapIn ?? "";
  elements.designMinCaptionGap.value = designConstraints.minCaptionGapIn ?? "";
  elements.designMinPanelPadding.value = designConstraints.minPanelPaddingIn ?? "";
  elements.designMaxWords.value = designConstraints.maxWordsPerSlide ?? "";
  applyDeckThemeFields(visualTheme);
  elements.validationMediaMode.value = validationSettings.mediaValidationMode || "fast";
  getValidationRuleSelects().forEach((element) => {
    const rule = element.dataset.validationRule;
    element.value = validationRules[rule] || "warning";
  });
  setDeckThemeBriefValue(deck.themeBrief || "");
  elements.deckOutline.value = deck.outline || "";
  elements.deckStructureNote.textContent = deck.structureLabel
    ? `Applied plan: ${deck.structureLabel}. ${deck.structureSummary || "Deck structure metadata is stored with the saved context."}`
    : "Generate deck plans from the saved brief and outline, then apply one back to the outline and live slide files when it reads right.";
  renderManualDeckEditOptions();
}

function renderDeckLengthPlan() {
  const activeCount = state.slides.length;
  const skippedSlides = Array.isArray(state.skippedSlides) ? state.skippedSlides : [];
  const lengthProfile = state.context && state.context.deck ? state.context.deck.lengthProfile : null;
  const plan = state.deckLengthPlan;
  const actions = plan && Array.isArray(plan.actions) ? plan.actions : [];

  if (!elements.deckLengthTarget.value) {
    elements.deckLengthTarget.value = lengthProfile && lengthProfile.targetCount
      ? lengthProfile.targetCount
      : activeCount || 1;
  }

  elements.deckLengthApplyButton.disabled = !actions.length;
  elements.deckLengthSummary.innerHTML = `
    <div class="compare-stats">
      <span class="compare-stat"><strong>${activeCount}</strong> active</span>
      <span class="compare-stat"><strong>${skippedSlides.length}</strong> skipped</span>
      ${plan ? `<span class="compare-stat"><strong>${plan.targetCount}</strong> target</span>` : ""}
      ${plan ? `<span class="compare-stat"><strong>${plan.nextCount}</strong> after apply</span>` : ""}
    </div>
    <p class="section-note">${escapeHtml(plan ? plan.summary : "Set a target length and plan a reversible keep/skip/restore pass.")}</p>
  `;

  elements.deckLengthPlanList.innerHTML = "";
  if (!actions.length) {
    elements.deckLengthPlanList.innerHTML = "<div class=\"variant-card\"><strong>No length plan yet</strong><span>Plan a target length to review which slides would be skipped or restored.</span></div>";
  } else {
    actions.forEach((action) => {
      const card = document.createElement("div");
      card.className = "variant-card deck-length-card";
      const actionLabel = action.action === "restore" ? "Restore" : action.action === "insert" ? "Insert" : "Skip";
      const metaTarget = action.action === "insert"
        ? `new slide at ${action.targetIndex || "end"}`
        : action.slideId;
      card.innerHTML = `
        <p class="variant-kind">${escapeHtml(actionLabel)}</p>
        <strong>${escapeHtml(action.title || action.slideId)}</strong>
        <span class="variant-meta">${escapeHtml(action.confidence || "medium")} confidence · ${escapeHtml(metaTarget || "")}</span>
        <span>${escapeHtml(action.reason || "No reason recorded.")}</span>
      `;
      elements.deckLengthPlanList.appendChild(card);
    });
  }

  if (!skippedSlides.length) {
    elements.deckLengthRestoreList.innerHTML = "";
    return;
  }

  elements.deckLengthRestoreList.innerHTML = `
    <div class="workflow-variants-head">
      <div>
        <p class="eyebrow">Restore</p>
        <h3>Skipped slides</h3>
      </div>
      <button type="button" class="secondary" data-action="restore-all">Restore all</button>
    </div>
    <div class="variant-list workflow-variant-list">
      ${skippedSlides.map((slide) => `
        <div class="variant-card deck-length-card">
          <p class="variant-kind">Skipped</p>
          <strong>${escapeHtml(slide.title || slide.id)}</strong>
          <span>${escapeHtml(slide.skipReason || "Hidden by length scaling.")}</span>
          <div class="variant-actions">
            <button type="button" class="secondary" data-slide-id="${escapeHtml(slide.id)}">Restore</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  elements.deckLengthRestoreList.querySelector("[data-action=\"restore-all\"]").addEventListener("click", () => {
    restoreSkippedSlides({ all: true }).catch((error) => window.alert(error.message));
  });
  Array.from(elements.deckLengthRestoreList.querySelectorAll("[data-slide-id]")).forEach((button: any) => {
    button.addEventListener("click", () => {
      restoreSkippedSlides({ slideId: button.dataset.slideId }).catch((error) => window.alert(error.message));
    });
  });
}

function setDeckStructureCandidates(candidates) {
  state.deckStructureCandidates = Array.isArray(candidates) ? candidates : [];
  state.selectedDeckStructureId = state.deckStructureCandidates[0] ? state.deckStructureCandidates[0].id : null;
}

function renderDeckStructureCandidates() {
  const candidates = Array.isArray(state.deckStructureCandidates) ? state.deckStructureCandidates : [];
  elements.deckStructureList.innerHTML = "";

  if (!candidates.length) {
    elements.deckStructureList.innerHTML = "<div class=\"variant-card\"><strong>No deck plan candidates yet</strong><span>Use the deck-level workflow to generate structure or batch-authoring options from the saved brief and current slides.</span></div>";
    return;
  }

  candidates.forEach((candidate, index) => {
    const card = document.createElement("div");
    const isSelected = candidate.id === state.selectedDeckStructureId;
    card.className = `variant-card deck-plan-card${isSelected ? " active" : ""}`;
    const outlineLines = String(candidate.outline || "").split("\n").filter(Boolean);
    const planStats = candidate.planStats || {};
    const diff = candidate.diff || {};
    const preview = candidate.preview || {};
    const plan = Array.isArray(candidate.slides) ? candidate.slides : [];
    const previewCues = Array.isArray(preview.cues) ? preview.cues : [];
    const previewHints = Array.isArray(preview.previewHints) ? preview.previewHints : [];
    const currentSequence = Array.isArray(preview.currentSequence) ? preview.currentSequence : [];
    const proposedSequence = Array.isArray(preview.proposedSequence) ? preview.proposedSequence : [];
    const diffFiles = Array.isArray(diff.files) ? diff.files : [];
    const deckDiff = diff.deck || {};
    const deckChanges = Array.isArray(deckDiff.changes) ? deckDiff.changes : [];
    const applySharedSettings = state.ui.deckPlanApplySharedSettings[candidate.id] !== false;
    const outlineDiff = diff.outline || {};
    const groupedPlan = groupDeckPlanSteps(plan);
    const deckDiffSupport = buildDeckDiffSupport({
      currentSequence,
      deckChanges,
      diff,
      diffFiles,
      plan,
      planStats,
      proposedSequence
    });
    const beforeAfterStripMarkup = (preview.currentStrip && preview.currentStrip.url) || (preview.strip && preview.strip.url)
      ? `
      <div class="deck-structure-strip-compare">
        ${preview.currentStrip && preview.currentStrip.url ? `
          <div class="deck-structure-strip-card">
            <span class="deck-structure-strip-label">Before deck</span>
            <img src="${preview.currentStrip.url}" alt="${escapeHtml(candidate.label || "Deck plan")} current deck strip">
          </div>
        ` : ""}
        ${preview.strip && preview.strip.url ? `
          <div class="deck-structure-strip-card">
            <span class="deck-structure-strip-label">After deck</span>
            <img src="${preview.strip.url}" alt="${escapeHtml(candidate.label || "Deck plan")} proposed deck strip">
          </div>
        ` : ""}
      </div>
    `
      : "";
    const previewHintMarkup = previewHints.length
      ? `
      <div class="deck-structure-preview-hints">
        ${previewHints.map((hint) => {
          const currentPage = Number.isFinite(hint.currentIndex)
            ? state.previews.pages.find((entry) => entry.index === hint.currentIndex)
            : null;
          const currentMarkup = currentPage
            ? `<img src="${currentPage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}" alt="${escapeHtml(hint.currentTitle || "Current slide")}">`
            : `<div class="deck-structure-preview-placeholder">${escapeHtml(hint.action === "insert" ? (hint.type || "new slide") : "archived")}</div>`;
          const proposedMarkup = hint.proposedPreview && hint.proposedPreview.url
            ? `<img src="${hint.proposedPreview.url}" alt="${escapeHtml(hint.proposedTitle || "Proposed slide")}">`
            : `<div class="deck-structure-preview-placeholder">${escapeHtml(hint.action === "remove" ? "archived" : (hint.type || "pending"))}</div>`;

          return `
          <div class="deck-structure-preview-card">
            <div class="deck-structure-preview-pair">
              <div class="deck-structure-preview-slot">
                <span class="deck-structure-preview-label">Before</span>
                ${currentMarkup}
              </div>
              <div class="deck-structure-preview-slot">
                <span class="deck-structure-preview-label">After</span>
                ${proposedMarkup}
              </div>
            </div>
            <strong>${escapeHtml(hint.action || "keep")}</strong>
            <span>${escapeHtml(hint.cue || "")}</span>
          </div>
        `;
        }).join("")}
      </div>
    `
      : "";
    card.innerHTML = `
      <p class="variant-kind">${escapeHtml(candidate.kindLabel || "Deck plan")}</p>
      <strong>${escapeHtml(candidate.label || `Candidate ${index + 1}`)}</strong>
      <span class="variant-meta">${escapeHtml(candidate.summary || candidate.promptSummary || candidate.notes || "No summary")}</span>
      <div class="compare-stats">
        <span class="compare-stat"><strong>${planStats.total || plan.length}</strong> plan steps</span>
        <span class="compare-stat"><strong>${planStats.inserted || 0}</strong> insert</span>
        <span class="compare-stat"><strong>${planStats.replaced || 0}</strong> replace</span>
        <span class="compare-stat"><strong>${planStats.archived || 0}</strong> archive</span>
        <span class="compare-stat"><strong>${planStats.moved || 0}</strong> move</span>
        <span class="compare-stat"><strong>${planStats.shared || 0}</strong> shared</span>
        <span class="compare-stat"><strong>${planStats.retitled || 0}</strong> retitle</span>
      </div>
      <div class="compare-change-summary">
        ${(preview.overview ? [`<p class="compare-summary-item">${escapeHtml(preview.overview)}</p>`] : [])
          .concat(previewCues.map((cue) => `<p class="compare-summary-item">${escapeHtml(cue)}</p>`))
          .join("")}
      </div>
      ${isSelected ? `
        ${renderDeckDiffSupport(deckDiffSupport)}
        ${beforeAfterStripMarkup}
        ${previewHintMarkup}
        <div class="deck-structure-outline">
          <div class="deck-structure-outline-line"><strong>Diff summary</strong><span>${escapeHtml(diff.summary || "No deck diff summary available")}</span></div>
          <div class="deck-structure-outline-line"><strong>Shared deck changes</strong><span>${escapeHtml(deckDiff.summary || "No shared deck changes")}</span></div>
          <div class="deck-structure-outline-line"><strong>Added to live deck</strong><span>${escapeHtml((outlineDiff.added || []).join(" / ") || "None")}</span></div>
          <div class="deck-structure-outline-line"><strong>Archived from live deck</strong><span>${escapeHtml((outlineDiff.archived || []).join(" / ") || "None")}</span></div>
          <div class="deck-structure-outline-line"><strong>Retitled beats</strong><span>${escapeHtml((outlineDiff.retitled || []).map((item) => `${item.before} -> ${item.after}`).join(" / ") || "None")}</span></div>
          <div class="deck-structure-outline-line"><strong>Moved beats</strong><span>${escapeHtml((outlineDiff.moved || []).map((item) => `${item.title} ${item.from}->${item.to}`).join(" / ") || "None")}</span></div>
        </div>
        ${deckChanges.length ? `
        <label class="deck-structure-option">
          <input type="checkbox" data-action="toggle-shared-settings" ${applySharedSettings ? "checked" : ""}>
          <span>Apply shared deck settings with this candidate</span>
        </label>
        ` : ""}
        <details class="deck-plan-details">
          <summary>Plan details</summary>

          <div class="compare-stats">
            <span class="compare-stat"><strong>${(diff.counts && diff.counts.beforeSlides) || currentSequence.length}</strong> slides before</span>
            <span class="compare-stat"><strong>${(diff.counts && diff.counts.afterSlides) || proposedSequence.length}</strong> slides after</span>
            <span class="compare-stat"><strong>${diffFiles.length}</strong> file target${diffFiles.length === 1 ? "" : "s"}</span>
          </div>

          <div class="deck-structure-plan">
            ${deckChanges.map((change) => `
              <div class="deck-structure-step">
                <strong>${escapeHtml(change.label || "Shared deck change")}</strong>
                <span class="deck-structure-pill">${escapeHtml(change.scope || "deck")}</span>
                <span>Before: ${escapeHtml(change.before || "(empty)")}</span>
                <span>After: ${escapeHtml(change.after || "(empty)")}</span>
              </div>
            `).join("") || `<div class="deck-structure-step"><strong>No shared deck changes</strong><span>This candidate keeps shared deck settings untouched.</span></div>`}
          </div>
          <div class="deck-structure-plan">
            ${groupedPlan.map((group) => `
              <section class="deck-structure-group">
                <div class="deck-structure-group-head">
                  <strong>${escapeHtml(group.label)}</strong>
                  <span>${group.items.length} slide${group.items.length === 1 ? "" : "s"}</span>
                </div>
                <div class="deck-structure-group-items">
                  ${group.items.map((slide) => `
                    <div class="deck-structure-step">
                      <strong>${Number.isFinite(slide.proposedIndex) ? `${slide.proposedIndex}. ${escapeHtml(slide.proposedTitle || slide.currentTitle || "Untitled")}` : `Archive ${slide.currentIndex || "?"}. ${escapeHtml(slide.currentTitle || "Untitled")}`}</strong>
                      <span>Current: ${slide.currentIndex || "?"}. ${escapeHtml(slide.currentTitle || "Untitled")}</span>
                      <span>${escapeHtml(slide.summary || slide.rationale || "")}</span>
                    </div>
                  `).join("")}
                </div>
              </section>
            `).join("")}
          </div>
          <div class="deck-structure-plan">
            ${diffFiles.map((file) => `
              <div class="deck-structure-step">
                <strong>${escapeHtml(file.targetPath || "slides/(pending)")}</strong>
                <span class="deck-structure-pill">${escapeHtml((file.changeKinds || []).join(" + ") || "change")}</span>
                <span>Before: ${escapeHtml(file.before || "(none)")}</span>
                <span>After: ${escapeHtml(file.after || "(none)")}</span>
                <span>${escapeHtml(file.note || "")}</span>
              </div>
            `).join("") || `<div class="deck-structure-step"><strong>No file-level changes</strong><span>This candidate keeps the current file set untouched.</span></div>`}
          </div>
          <div class="deck-structure-outline">
            <div class="deck-structure-outline-line"><strong>Current live deck</strong><span>${escapeHtml(currentSequence.map((slide) => `${slide.index}. ${slide.title}`).join(" / ") || "No current sequence")}</span></div>
            <div class="deck-structure-outline-line"><strong>Proposed live deck</strong><span>${escapeHtml(proposedSequence.map((slide) => `${slide.index}. ${slide.title}`).join(" / ") || "No proposed sequence")}</span></div>
          </div>
          <div class="deck-structure-outline">
            ${outlineLines.map((line, lineIndex) => `<div class="deck-structure-outline-line"><strong>${lineIndex + 1}.</strong><span>${escapeHtml(line)}</span></div>`).join("")}
          </div>
          <div class="deck-structure-plan">
            ${plan.map((slide) => `
              <div class="deck-structure-step">
                <strong>${Number.isFinite(slide.proposedIndex) ? `${slide.proposedIndex}. ${escapeHtml(slide.proposedTitle || slide.currentTitle || "Untitled")}` : `Archive ${slide.currentIndex || "?"}. ${escapeHtml(slide.currentTitle || "Untitled")}`}</strong>
                <span class="deck-structure-pill">${escapeHtml(slide.action || "keep")}</span>
                <span>${escapeHtml(slide.role || "Role")}</span>
                <span>Current: ${slide.currentIndex || "?"}. ${escapeHtml(slide.currentTitle || "Untitled")}</span>
                <span>${escapeHtml(slide.summary || "")}</span>
                <span>${escapeHtml(slide.rationale || "")}</span>
              </div>
            `).join("")}
          </div>
        </details>
      ` : ""}
      <div class="variant-actions">
        <button type="button" class="secondary" data-action="inspect">${isSelected ? "Refresh view" : "Inspect"}</button>
        <button type="button" data-action="apply">Apply plan</button>
      </div>
    `;

    card.querySelector("[data-action=\"inspect\"]").addEventListener("click", () => {
      state.selectedDeckStructureId = candidate.id;
      elements.operationStatus.textContent = `Inspecting deck plan candidate ${candidate.label}.`;
      renderDeckStructureCandidates();
    });

    const sharedSettingsToggle = card.querySelector("[data-action=\"toggle-shared-settings\"]");
    if (sharedSettingsToggle) {
      sharedSettingsToggle.addEventListener("change", (event) => {
        state.ui.deckPlanApplySharedSettings[candidate.id] = Boolean((event.currentTarget as any).checked);
      });
    }

    const applyButton = card.querySelector("[data-action=\"apply\"]");
    applyButton.addEventListener("click", async () => {
      const done = setBusy(applyButton, "Applying...");
      try {
        await applyDeckStructureCandidate(candidate);
      } catch (error) {
        window.alert(error.message);
      } finally {
        done();
      }
    });

    elements.deckStructureList.appendChild(card);
  });
}

function renderAssistant() {
  const session = state.assistant.session;
  const suggestions = Array.isArray(state.assistant.suggestions) ? state.assistant.suggestions : [];

  elements.assistantSuggestions.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.className = "secondary assistant-suggestion";
    button.type = "button";
    button.textContent = suggestion.label;
    button.addEventListener("click", () => {
      setAssistantDrawerOpen(true);
      elements.assistantInput.value = suggestion.prompt;
      elements.assistantInput.focus();
    });
    elements.assistantSuggestions.appendChild(button);
  });

  elements.assistantLog.innerHTML = "";
  const messages = session && Array.isArray(session.messages) ? session.messages.slice(-8) : [];

  if (!messages.length) {
    elements.assistantLog.innerHTML = "<p class=\"assistant-empty\">No messages.</p>";
    renderAssistantSelection();
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("div");
    item.className = "assistant-message";
    item.dataset.role = message.role;
    const roleLabel = message.role === "assistant" ? "Studio" : "You";
    item.innerHTML = `
      <span class="assistant-message-meta">${escapeHtml(roleLabel)}</span>
      <p class="assistant-message-body">${escapeHtml(message.content)}</p>
      ${message.selection ? `
        <p class="assistant-message-selection">
          <strong>${escapeHtml(message.selection.scopeLabel || message.selection.label || (message.selection.kind === "selectionGroup" ? "Selected fields" : "Selection"))}</strong>
          ${escapeHtml(message.selection.text || message.selection.selectedText || "")}
        </p>
      ` : ""}
    `;
    elements.assistantLog.appendChild(item);
  });

  elements.assistantLog.scrollTop = elements.assistantLog.scrollHeight;
  renderAssistantSelection();
}

function renderAssistantSelection() {
  const selection = state.assistant.selection;
  if (!elements.assistantSelection) {
    return;
  }

  if (!selection || selection.slideId !== state.selectedSlideId) {
    elements.assistantSelection.hidden = true;
    elements.assistantSelection.innerHTML = "";
    return;
  }

  elements.assistantSelection.hidden = false;
  const selectionText = selection.kind === "selectionGroup"
    ? `${selection.selections.length} fields selected`
    : selection.text || selection.selectedText || "";
  elements.assistantSelection.innerHTML = `
    <div>
      <span>Using selection</span>
      <strong>${escapeHtml(selection.scopeLabel || selection.label || "Slide text")}</strong>
      <p>${escapeHtml(selectionText)}</p>
    </div>
    <button type="button" class="secondary" data-action="clear-selection">Clear</button>
  `;
  elements.assistantSelection.querySelector("[data-action=\"clear-selection\"]").addEventListener("click", clearAssistantSelection);
}

function renderSources() {
  if (!elements.sourceList) {
    return;
  }

  const sources = Array.isArray(state.sources) ? state.sources : [];
  if (!sources.length) {
    elements.sourceList.innerHTML = "<div class=\"source-empty\"><strong>No sources yet</strong><span>Add notes, excerpts, or URLs so generation can retrieve grounded material.</span></div>";
    return;
  }

  elements.sourceList.innerHTML = "";
  sources.forEach((source) => {
    const item = document.createElement("article");
    item.className = "source-card";
    item.innerHTML = `
      <div class="source-card-copy">
        <strong>${escapeHtml(source.title || "Source")}</strong>
        <span>${escapeHtml(source.url || `${source.wordCount || 0} words, ${source.chunkCount || 0} chunks`)}</span>
        <p>${escapeHtml(source.preview || "No preview available.")}</p>
      </div>
      <button class="secondary" type="button">Remove</button>
    `;

    const button = item.querySelector("button");
    button.addEventListener("click", () => deleteSource(source, button).catch((error) => window.alert(error.message)));
    elements.sourceList.appendChild(item);
  });
}

function countOutlinePlanSlides(plan) {
  return (Array.isArray(plan && plan.sections) ? plan.sections : [])
    .reduce((count, section) => count + (Array.isArray(section.slides) ? section.slides.length : 0), 0);
}

function renderOutlinePlanComparison(plan) {
  const currentSlides = Array.isArray(state.slides) ? state.slides : [];
  const sections = Array.isArray(plan && plan.sections) ? plan.sections : [];

  if (!sections.length) {
    return "<div class=\"outline-plan-compare-empty\">No sections saved in this plan.</div>";
  }

  const currentSequence = currentSlides
    .map((slide) => `${slide.index}. ${slide.title || slide.id}`)
    .join(" | ");
  const sectionMarkup = sections.map((section, sectionIndex) => {
    const slides = Array.isArray(section.slides) ? section.slides : [];
    return `
      <section class="outline-plan-compare-section">
        <div class="outline-plan-compare-section-head">
          <strong>${escapeHtml(section.title || `Section ${sectionIndex + 1}`)}</strong>
          <span>${escapeHtml(section.intent || "No section intent saved.")}</span>
        </div>
        <div class="outline-plan-compare-slides">
          ${slides.map((slide, slideIndex) => {
            const currentSlide = slide.sourceSlideId
              ? currentSlides.find((entry) => entry.id === slide.sourceSlideId)
              : currentSlides[slideIndex];
            const currentTitle = currentSlide
              ? `${currentSlide.index}. ${currentSlide.title}`
              : "New or unmatched";
            return `
              <details class="outline-plan-compare-slide">
                <summary>
                  <strong>${escapeHtml(slide.workingTitle || `Slide ${slideIndex + 1}`)}</strong>
                  <span>${escapeHtml(currentTitle)}</span>
                </summary>
                <div>
                  <p><strong>Intent</strong><span>${escapeHtml(slide.intent || "No slide intent saved.")}</span></p>
                  <p><strong>Must include</strong><span>${escapeHtml((slide.mustInclude || []).join(" / ") || "None")}</span></p>
                  <p><strong>Layout hint</strong><span>${escapeHtml(slide.layoutHint || "None")}</span></p>
                </div>
              </details>
            `;
          }).join("") || "<div class=\"outline-plan-compare-empty\">No slide intents in this section.</div>"}
        </div>
      </section>
    `;
  }).join("");

  return `
    <div class="outline-plan-compare">
      <div class="outline-plan-current-sequence">
        <strong>Current deck</strong>
        <span>${escapeHtml(currentSequence || "No active slides.")}</span>
      </div>
      ${sectionMarkup}
    </div>
  `;
}

function renderOutlinePlans() {
  if (!elements.outlinePlanList) {
    return;
  }

  const plans = Array.isArray(state.outlinePlans) ? state.outlinePlans : [];
  if (!plans.length) {
    elements.outlinePlanList.innerHTML = "<div class=\"source-empty\"><strong>No outline plans yet</strong><span>Generate one from the active deck when you want a reusable narrative plan.</span></div>";
    return;
  }

  elements.outlinePlanList.innerHTML = "";
  plans.forEach((plan) => {
    const sectionCount = Array.isArray(plan.sections) ? plan.sections.length : 0;
    const slideCount = countOutlinePlanSlides(plan);
    const item = document.createElement("article");
    item.className = "outline-plan-card";
    item.innerHTML = `
      <div class="outline-plan-card__header">
        <div>
          <strong>${escapeHtml(plan.name || "Outline plan")}</strong>
          <span>${escapeHtml([`${sectionCount} section${sectionCount === 1 ? "" : "s"}`, `${slideCount} slide intent${slideCount === 1 ? "" : "s"}`].join(" | "))}</span>
        </div>
        <div class="button-row compact">
          <button class="secondary outline-plan-derive-button" type="button">Derive deck</button>
          <button class="secondary outline-plan-stage-button" type="button">Live draft</button>
          <button class="secondary outline-plan-propose-button" type="button">Propose changes</button>
          <button class="secondary outline-plan-duplicate-button" type="button">Duplicate</button>
          <button class="secondary outline-plan-save-button" type="button">Save</button>
          <button class="secondary outline-plan-archive-button" type="button">Archive</button>
          <button class="secondary outline-plan-delete-button" type="button">Delete</button>
        </div>
      </div>
      <p>${escapeHtml(plan.purpose || plan.objective || "No purpose saved.")}</p>
      <details>
        <summary>Compare with current deck</summary>
        ${renderOutlinePlanComparison(plan)}
      </details>
      <details>
        <summary>Edit structured plan</summary>
        <textarea class="outline-plan-json" spellcheck="false">${escapeHtml(JSON.stringify(plan, null, 2))}</textarea>
      </details>
    `;

    const deriveButton = item.querySelector(".outline-plan-derive-button");
    const stageButton = item.querySelector(".outline-plan-stage-button");
    const proposeButton = item.querySelector(".outline-plan-propose-button");
    const duplicateButton = item.querySelector(".outline-plan-duplicate-button");
    const saveButton = item.querySelector(".outline-plan-save-button");
    const archiveButton = item.querySelector(".outline-plan-archive-button");
    const deleteButton = item.querySelector(".outline-plan-delete-button");
    const textarea = item.querySelector(".outline-plan-json") as HTMLTextAreaElement;
    deriveButton.addEventListener("click", () => deriveOutlinePlan(plan, deriveButton).catch((error) => window.alert(error.message)));
    stageButton.addEventListener("click", () => stageOutlinePlanCreation(plan, stageButton).catch((error) => window.alert(error.message)));
    proposeButton.addEventListener("click", () => proposeOutlinePlanChanges(plan, proposeButton).catch((error) => window.alert(error.message)));
    duplicateButton.addEventListener("click", () => duplicateOutlinePlan(plan, duplicateButton).catch((error) => window.alert(error.message)));
    saveButton.addEventListener("click", () => saveOutlinePlanJson(textarea, saveButton).catch((error) => window.alert(error.message)));
    archiveButton.addEventListener("click", () => archiveOutlinePlan(plan, archiveButton).catch((error) => window.alert(error.message)));
    deleteButton.addEventListener("click", () => deleteOutlinePlan(plan, deleteButton).catch((error) => window.alert(error.message)));
    elements.outlinePlanList.appendChild(item);
  });
}

async function generateOutlinePlan() {
  const done = setBusy(elements.generateOutlinePlanButton, "Generating...");
  try {
    const payload = await request("/api/outline-plans/generate", {
      method: "POST",
      body: JSON.stringify({
        name: `${elements.deckTitle.value || "Current deck"} outline plan`,
        purpose: elements.deckObjective.value,
        targetSlideCount: state.slides.length || undefined
      })
    });
    state.outlinePlans = payload.outlinePlans || state.outlinePlans;
    renderOutlinePlans();
    elements.operationStatus.textContent = `Generated outline plan "${payload.outlinePlan.name}".`;
  } finally {
    done();
  }
}

async function saveOutlinePlanJson(textarea, button = null) {
  let outlinePlan = null;
  try {
    outlinePlan = JSON.parse(textarea.value);
  } catch (error) {
    throw new Error("Outline plan JSON is invalid.");
  }

  const done = button ? setBusy(button, "Saving...") : null;
  try {
    const payload = await request("/api/outline-plans", {
      method: "POST",
      body: JSON.stringify({ outlinePlan })
    });
    state.outlinePlans = payload.outlinePlans || state.outlinePlans;
    renderOutlinePlans();
    elements.operationStatus.textContent = `Saved outline plan "${payload.outlinePlan.name}".`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function deriveOutlinePlan(plan, button = null) {
  const title = window.prompt("Derived presentation title", `${plan.name || "Outline plan"} deck`);
  if (!title) {
    return;
  }
  const copySources = window.confirm("Copy active source records into the derived deck?");
  const copyMaterials = window.confirm("Copy active image materials into the derived deck?");

  const done = button ? setBusy(button, "Deriving...") : null;
  try {
    const payload = await request("/api/outline-plans/derive", {
      method: "POST",
      body: JSON.stringify({
        copyDeckContext: true,
        copyMaterials,
        copySources,
        copyTheme: true,
        planId: plan.id,
        title
      })
    });
    state.outlinePlans = payload.outlinePlans || [];
    state.presentations = payload.presentations || state.presentations;
    state.context = payload.context || state.context;
    state.slides = payload.slides || state.slides;
    setDomPreviewState(payload);
    presentationLibrary.resetSelection();
    await refreshState();
    setCurrentPage("studio");
  } finally {
    if (done) {
      done();
    }
  }
}

async function stageOutlinePlanCreation(plan, button = null) {
  const title = window.prompt("Live-generated presentation title", `${plan.name || "Outline plan"} deck`);
  if (!title) {
    return;
  }
  const copySources = window.confirm("Use compact source text from the current deck during live generation?");

  const done = button ? setBusy(button, "Staging...") : null;
  try {
    const payload = await request("/api/outline-plans/stage-creation", {
      method: "POST",
      body: JSON.stringify({
        copyDeckContext: true,
        copySources,
        copyTheme: true,
        planId: plan.id,
        title
      })
    });
    state.creationDraft = payload.creationDraft || state.creationDraft;
    if (state.creationDraft && state.creationDraft.fields) {
      presentationCreationWorkbench.applyFields(state.creationDraft.fields);
      state.ui.creationStage = presentationCreationWorkbench.normalizeStage(state.creationDraft.stage || "content");
    }
    state.runtime = payload.runtime || state.runtime;
    setCurrentPage("presentations");
    renderCreationDraft();
    renderStatus();
    elements.presentationCreationStatus.textContent = `Staged "${plan.name}" for live slide generation.`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function proposeOutlinePlanChanges(plan, button = null) {
  const done = button ? setBusy(button, "Proposing...") : null;
  try {
    const payload = await request("/api/outline-plans/propose", {
      method: "POST",
      body: JSON.stringify({ planId: plan.id })
    });
    setDeckStructureCandidates(payload.deckStructureCandidates);
    state.runtime = payload.runtime || state.runtime;
    renderDeckStructureCandidates();
    renderStatus();
    elements.operationStatus.textContent = payload.summary || `Proposed current-deck changes from "${plan.name}".`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function duplicateOutlinePlan(plan, button = null) {
  const name = window.prompt("Duplicate outline plan name", `${plan.name || "Outline plan"} copy`);
  if (!name) {
    return;
  }

  const done = button ? setBusy(button, "Duplicating...") : null;
  try {
    const payload = await request("/api/outline-plans/duplicate", {
      method: "POST",
      body: JSON.stringify({
        name,
        planId: plan.id
      })
    });
    state.outlinePlans = payload.outlinePlans || state.outlinePlans;
    renderOutlinePlans();
    elements.operationStatus.textContent = `Duplicated outline plan "${payload.outlinePlan.name}".`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function archiveOutlinePlan(plan, button = null) {
  const confirmed = window.confirm(`Archive outline plan "${plan.name || plan.id}"?`);
  if (!confirmed) {
    return;
  }

  const done = button ? setBusy(button, "Archiving...") : null;
  try {
    const payload = await request("/api/outline-plans/archive", {
      method: "POST",
      body: JSON.stringify({ planId: plan.id })
    });
    state.outlinePlans = payload.outlinePlans || [];
    renderOutlinePlans();
    elements.operationStatus.textContent = `Archived outline plan "${plan.name || plan.id}".`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function deleteOutlinePlan(plan, button = null) {
  const confirmed = window.confirm(`Delete outline plan "${plan.name || plan.id}"?`);
  if (!confirmed) {
    return;
  }

  const done = button ? setBusy(button, "Deleting...") : null;
  try {
    const payload = await request("/api/outline-plans/delete", {
      method: "POST",
      body: JSON.stringify({ planId: plan.id })
    });
    state.outlinePlans = payload.outlinePlans || [];
    renderOutlinePlans();
    elements.operationStatus.textContent = `Deleted outline plan "${plan.name || plan.id}".`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function addSource() {
  const title = elements.sourceTitle.value.trim();
  const url = elements.sourceUrl.value.trim();
  const text = elements.sourceText.value.trim();

  if (!url && !text) {
    window.alert("Add source text or a URL.");
    elements.sourceText.focus();
    return;
  }

  const done = setBusy(elements.addSourceButton, "Adding...");
  try {
    const payload = await request("/api/sources", {
      body: JSON.stringify({
        text,
        title,
        url
      }),
      method: "POST"
    });

    state.runtime = payload.runtime || state.runtime;
    state.sources = payload.sources || state.sources;
    elements.sourceTitle.value = "";
    elements.sourceUrl.value = "";
    elements.sourceText.value = "";
    renderSources();
    renderStatus();
    elements.operationStatus.textContent = `Added source ${payload.source.title}.`;
  } finally {
    done();
  }
}

async function deleteSource(source, button = null) {
  if (!source || !source.id) {
    return;
  }

  const done = button ? setBusy(button, "Removing...") : null;
  try {
    const payload = await request("/api/sources/delete", {
      body: JSON.stringify({
        sourceId: source.id
      }),
      method: "POST"
    });

    state.runtime = payload.runtime || state.runtime;
    state.sources = payload.sources || [];
    renderSources();
    renderStatus();
    elements.operationStatus.textContent = `Removed source ${source.title || "Source"}.`;
  } finally {
    if (done) {
      done();
    }
  }
}

function renderPreviews() {
  const thumbRailScrollLeft = elements.thumbRail.scrollLeft;
  const thumbRailScrollTop = elements.thumbRail.scrollTop;
  elements.thumbRail.innerHTML = "";
  const liveRun = presentationCreationWorkbench.getLiveStudioContentRun();
  const liveRunSlides = liveRun && Array.isArray(liveRun.slides) ? liveRun.slides : [];

  if (!state.slides.length) {
    elements.activePreview.innerHTML = "";
    return;
  }

  const activeSlide = state.slides.find((entry) => entry.index === state.selectedSlideIndex) || state.slides[0];
  const activeSpec = activeSlide ? (state.selectedSlideId === activeSlide.id && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(activeSlide.id)) : null;
  const activePage = state.previews.pages.find((page) => activeSlide && page.index === activeSlide.index) || state.previews.pages[0] || null;
  const selectedVariant = getSelectedVariant();
  const selectedVariantTheme = getVariantVisualTheme(selectedVariant);
  const liveCustomLayoutSpec = customLayoutWorkbench.getLivePreviewSlideSpec(activeSlide, activeSpec);
  const previewSpec = liveCustomLayoutSpec
    ? liveCustomLayoutSpec
    : selectedVariant && selectedVariant.slideSpec
    ? selectedVariant.slideSpec
    : selectedVariant && selectedVariantTheme && activeSpec
      ? activeSpec
      : activeSpec;
  const previewTheme = selectedVariant && selectedVariant.slideSpec
    ? selectedVariantTheme || undefined
    : selectedVariant && selectedVariantTheme
      ? selectedVariantTheme
      : undefined;

  if (previewSpec) {
    renderDomSlide(elements.activePreview, previewSpec, {
      index: activeSlide.index,
      theme: previewTheme,
      totalSlides: state.slides.length
    });
    if (!selectedVariant) {
      enableDomSlideTextEditing(elements.activePreview);
    }
  } else if (selectedVariant && selectedVariant.previewImage) {
    renderImagePreview(elements.activePreview, selectedVariant.previewImage.url, `${selectedVariant.label} preview`);
  } else if (activePage) {
    renderImagePreview(elements.activePreview, `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${activeSlide ? activeSlide.title : "Slide"} preview`);
  } else {
    elements.activePreview.innerHTML = "";
  }

  state.slides.forEach((slide) => {
    const page = state.previews.pages.find((entry) => entry.index === slide.index) || null;
    const thumbSpec = slide.id === state.selectedSlideId && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(slide.id);
    const liveRunSlide = liveRunSlides[slide.index - 1] || null;
    const liveStatus = liveRunSlide && liveRunSlide.status ? liveRunSlide.status : "";
    const button = document.createElement("button");
    button.className = `thumb${slide.index === state.selectedSlideIndex ? " active" : ""}${liveStatus ? " thumb-live" : ""}`;
    button.type = "button";
    if (liveStatus) {
      button.dataset.status = liveStatus;
    }
    button.title = `${slide.index}. ${slide.title || slide.fileName || "Slide"}`;
    button.setAttribute("aria-label", `Select slide ${slide.index}: ${slide.title || slide.fileName || "Untitled slide"}`);
    button.innerHTML = `
      <div class="thumb-preview"></div>
      <span class="thumb-index">${slide.index}</span>
      <strong>${escapeHtml(slide.title || `Slide ${slide.index}`)}</strong>
      <span>${escapeHtml(liveStatus ? `${presentationCreationWorkbench.getStatusLabel(liveStatus)} generation` : slide.fileName || `slide ${slide.index}`)}</span>
    `;
    button.addEventListener("click", () => {
      selectSlideByIndex(slide.index);
    });
    const thumbPreview = button.querySelector(".thumb-preview");
    if (thumbSpec) {
      renderDomSlide(thumbPreview, thumbSpec, {
        index: slide.index,
        totalSlides: state.slides.length
      });
    } else if (page) {
      renderImagePreview(thumbPreview, `${page.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${slide.title || `Slide ${slide.index}`} thumbnail`);
    }
    elements.thumbRail.appendChild(button);
  });

  elements.thumbRail.scrollLeft = thumbRailScrollLeft;
  elements.thumbRail.scrollTop = thumbRailScrollTop;
}

function getPresentationState() {
  const presentationsState = state.presentations && typeof state.presentations === "object"
    ? state.presentations
    : {};

  return {
    activePresentationId: presentationsState.activePresentationId || null,
    presentations: Array.isArray(presentationsState.presentations) ? presentationsState.presentations : []
  };
}

function resetThemeCandidates() {
  themeWorkbench.resetCandidates();
}

function applyCreationTheme(theme) {
  applyDeckThemeFields(theme || {});
  renderCreationThemeStage();
}

function getSelectedCreationThemeVariant() {
  return themeWorkbench.getSelectedVariant();
}

function isWorkflowRunning() {
  const workflow = state.runtime && state.runtime.workflow;
  return Boolean(workflow && workflow.status === "running");
}

function isEmptyCreationDraft(draft) {
  if (!draft || typeof draft !== "object") {
    return true;
  }

  const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};
  const imageSearch = fields.imageSearch && typeof fields.imageSearch === "object" ? fields.imageSearch : {};
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
  setCreationStage("brief");
  if (elements.presentationCreateDetails) {
    elements.presentationCreateDetails.open = false;
  }
}

function renderSavedThemes() {
  themeWorkbench.renderSavedThemes();
}

function applySavedTheme(themeId) {
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
  return {
    accent: elements.themeAccent.value,
    bg: elements.themeBg.value,
    fontFamily: elements.themeFontFamily.value,
    light: elements.themeLight.value,
    muted: elements.themeMuted.value,
    panel: elements.themePanel.value,
    primary: elements.themePrimary.value,
    progressFill: elements.themeProgressFill.value,
    progressTrack: elements.themeProgressTrack.value,
    secondary: elements.themeSecondary.value,
    surface: elements.themeSurface.value
  };
}

function applyDeckThemeFields(theme: any = {}) {
  elements.themeFontFamily.value = toFontSelectValue(theme.fontFamily);
  elements.themePrimary.value = toColorInputValue(theme.primary, "#183153");
  elements.themeSecondary.value = toColorInputValue(theme.secondary, "#275d8c");
  elements.themeAccent.value = toColorInputValue(theme.accent, "#f28f3b");
  elements.themeMuted.value = toColorInputValue(theme.muted, "#56677c");
  elements.themeLight.value = toColorInputValue(theme.light, "#d7e6f5");
  elements.themeBg.value = toColorInputValue(theme.bg, "#f5f8fc");
  elements.themePanel.value = toColorInputValue(theme.panel, "#f8fbfe");
  elements.themeSurface.value = toColorInputValue(theme.surface, "#ffffff");
  elements.themeProgressTrack.value = toColorInputValue(theme.progressTrack, "#d7e6f5");
  elements.themeProgressFill.value = toColorInputValue(theme.progressFill, "#275d8c");
}

function setDeckThemeBriefValue(value) {
  const nextValue = String(value || "");
  elements.deckThemeBrief.value = nextValue;
  if (elements.themeBrief) {
    elements.themeBrief.value = nextValue;
  }
}

function getDeckThemeBriefValue() {
  return String(elements.themeBrief ? elements.themeBrief.value : elements.deckThemeBrief.value || "");
}

function applySavedThemeToDeck(themeId) {
  const savedTheme = state.savedThemes.find((theme) => theme.id === themeId);
  if (!savedTheme || !savedTheme.theme) {
    return;
  }

  applyDeckThemeFields(savedTheme.theme);
  resetThemeCandidates();
  renderCreationThemeStage();
}

function setCreationStage(stage) {
  presentationCreationWorkbench.setStage(stage);
}

function renderCreationThemeStage() {
  themeWorkbench.renderStage();
}

function renderCreationDraft() {
  presentationCreationWorkbench.renderDraft();
}

function renderValidation() {
  StudioClientValidationReport.renderValidationReport({
    elements,
    escapeHtml,
    state
  });
}

function syncSelectedSlideToActiveList() {
  const selected = state.slides.find((entry) => entry.id === state.selectedSlideId);

  if (selected) {
    state.selectedSlideIndex = selected.index;
    return selected;
  }

  const fallback = state.slides[0] || null;
  if (!fallback) {
    state.selectedSlideId = null;
    state.selectedSlideIndex = 1;
    state.selectedSlideSpec = null;
    state.selectedSlideSpecDraftError = null;
    state.selectedSlideSpecError = null;
    state.selectedSlideStructured = false;
    state.selectedSlideSource = "";
    state.selectedVariantId = null;
    return null;
  }

  state.selectedSlideId = fallback.id;
  state.selectedSlideIndex = fallback.index;
  return fallback;
}

async function loadSlide(slideId) {
  const { abortController, requestSeq } = beginAbortableRequest(state, "slideLoadAbortController", "slideLoadRequestSeq");
  const previousSlideId = state.selectedSlideId;
  if (previousSlideId && previousSlideId !== slideId) {
    clearTransientVariants(previousSlideId);
  }
  try {
    const payload = await request(`/api/slides/${slideId}`, { signal: abortController.signal });
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
    state.selectedSlideSource = payload.source;
    patchDomSlideSpec(slideId, payload.slideSpec || null);
    state.variantStorage = payload.variantStorage || state.variantStorage;
    replacePersistedVariantsForSlide(slideId, payload.variants || []);
    clearTransientVariants(slideId);
    state.selectedVariantId = null;
    state.ui.customLayoutDefinitionPreviewActive = false;
    state.ui.customLayoutMainPreviewActive = false;
    state.ui.variantReviewOpen = Boolean((payload.variants || []).length);
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

async function selectSlideByIndex(index) {
  const slide = state.slides.find((entry) => entry.index === index);
  if (!slide) {
    return;
  }

  await loadSlide(slide.id);
}

async function savePresentationTheme() {
  const name = elements.presentationThemeName.value.trim() || elements.presentationTitle.value.trim() || "Saved theme";
  const done = setBusy(elements.savePresentationThemeButton, "Saving...");
  try {
    const payload = await request("/api/themes/save", {
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

async function persistSelectedThemeToDeck(options: any = {}) {
  const theme = getSelectedCreationThemeVariant().theme;
  applyCreationTheme(theme);
  const payload = await request("/api/context", {
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
    const payload = await request("/api/themes/save", {
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
    request("/api/state"),
    request("/api/v1")
  ]);
  const activePresentation = apiRoot && apiRoot.links && apiRoot.links.activePresentation
    ? await request(apiRoot.links.activePresentation.href)
    : null;

  state.assistant = payload.assistant || { session: null, suggestions: [] };
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
  state.outlinePlans = payload.outlinePlans || [];
  setDomPreviewState(payload);
  state.presentations = payload.presentations || { activePresentationId: null, presentations: [] };
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  state.skippedSlides = payload.skippedSlides || [];
  state.savedThemes = payload.savedThemes || [];
  state.sources = payload.sources || [];
  state.workflowHistory = Array.isArray(payload.runtime && payload.runtime.workflowHistory) ? payload.runtime.workflowHistory : [];
  state.selectedDeckStructureId = null;
  state.deckLengthPlan = null;
  elements.deckLengthTarget.value = "";
  state.slides = payload.slides;
  state.transientVariants = [];
  state.variantStorage = payload.variantStorage || null;
  state.variants = payload.variants;

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
  presentationLibrary.render();
  renderAssistant();
  renderStatus();
  renderPreviews();
  customLayoutWorkbench.renderLibrary();
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
    const payload = await request("/api/context", {
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

function applyDeckLengthPayload(payload) {
  state.context = payload.context || state.context;
  if (payload.domPreview) {
    setDomPreviewState(payload);
  }
  state.previews = payload.previews || state.previews;
  state.runtime = payload.runtime || state.runtime;
  state.skippedSlides = payload.skippedSlides || [];
  state.slides = payload.slides || state.slides;
  state.deckLengthPlan = null;
  syncSelectedSlideToActiveList();
  renderDeckFields();
  renderDeckLengthPlan();
  renderStatus();
  renderPreviews();
  renderVariants();
}

async function planDeckLength() {
  const targetCount = Number.parseInt(elements.deckLengthTarget.value, 10);
  if (!Number.isFinite(targetCount) || targetCount < 1) {
    window.alert("Set a target slide count of at least 1.");
    elements.deckLengthTarget.focus();
    return;
  }

  const done = setBusy(elements.deckLengthPlanButton, "Planning...");
  try {
    const payload = await request("/api/deck/scale-length/plan", {
      body: JSON.stringify({
        includeSkippedForRestore: true,
        mode: elements.deckLengthMode.value,
        targetCount
      }),
      method: "POST"
    });

    state.deckLengthPlan = payload.plan;
    renderDeckLengthPlan();
    elements.operationStatus.textContent = payload.plan.summary;
  } finally {
    done();
  }
}

async function applyDeckLength() {
  if (!state.deckLengthPlan || !Array.isArray(state.deckLengthPlan.actions) || !state.deckLengthPlan.actions.length) {
    return;
  }

  const done = setBusy(elements.deckLengthApplyButton, "Applying...");
  try {
    const payload = await request("/api/deck/scale-length/apply", {
      body: JSON.stringify({
        actions: state.deckLengthPlan.actions,
        mode: state.deckLengthPlan.mode,
        targetCount: state.deckLengthPlan.targetCount
      }),
      method: "POST"
    });

    applyDeckLengthPayload(payload);
    elements.operationStatus.textContent = `Scaled deck to ${payload.lengthProfile.activeCount} active slide${payload.lengthProfile.activeCount === 1 ? "" : "s"}.`;
    if (state.selectedSlideId) {
      await loadSlide(state.selectedSlideId);
    }
  } finally {
    done();
  }
}

async function restoreSkippedSlides(options) {
  const done = setBusy(elements.deckLengthPlanButton, "Restoring...");
  try {
    const payload = await request("/api/slides/restore-skipped", {
      body: JSON.stringify(options || {}),
      method: "POST"
    });

    applyDeckLengthPayload(payload);
    elements.operationStatus.textContent = `Restored ${payload.restoredSlides || 0} skipped slide${payload.restoredSlides === 1 ? "" : "s"}.`;
    if (state.selectedSlideId) {
      await loadSlide(state.selectedSlideId);
    }
  } finally {
    done();
  }
}

async function saveValidationSettings() {
  const done = setBusy(elements.saveValidationSettingsButton, "Saving...");
  try {
    const payload = await request("/api/context", {
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read material file")));
    reader.readAsDataURL(file);
  });
}

async function buildDeck() {
  const payload = await request("/api/build", {
    body: JSON.stringify({}),
    method: "POST"
  });
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  renderStatus();
  renderPreviews();
  renderVariantComparison();
}

async function applyDeckStructureCandidate(candidate) {
  const applySharedSettings = state.ui.deckPlanApplySharedSettings[candidate.id] !== false;
  const payload = await request("/api/context/deck-structure/apply", {
    body: JSON.stringify({
      applyDeckPatch: applySharedSettings,
      deckPatch: applySharedSettings ? candidate.deckPatch : null,
      label: candidate.label,
      outline: candidate.outline,
      promoteInsertions: true,
      promoteIndices: true,
      promoteRemovals: true,
      promoteReplacements: true,
      promoteTitles: true,
      slides: candidate.slides,
      summary: candidate.summary
    }),
    method: "POST"
  });

  elements.operationStatus.textContent = `Applied deck plan candidate ${candidate.label} to the saved outline, slide plan, ${payload.insertedSlides || 0} inserted slide${payload.insertedSlides === 1 ? "" : "s"}, ${payload.replacedSlides || 0} replaced slide${payload.replacedSlides === 1 ? "" : "s"}, ${payload.removedSlides || 0} archived slide${payload.removedSlides === 1 ? "" : "s"}, ${payload.indexUpdates || 0} slide order change${payload.indexUpdates === 1 ? "" : "s"}, ${payload.titleUpdates || 0} slide title${payload.titleUpdates === 1 ? "" : "s"}${payload.sharedDeckUpdates ? `, and ${payload.sharedDeckUpdates} shared deck setting${payload.sharedDeckUpdates === 1 ? "" : "s"}` : ""}.`;
  await refreshState();
}

async function validate(includeRender) {
  const button = includeRender ? elements.validateRenderButton : elements.validateButton;
  const done = setBusy(button, includeRender ? "Running render gate..." : "Validating...");
  try {
    const payload = await request("/api/validate", {
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

async function checkLlmProvider(options: any = {}) {
  const done = options.silent ? null : setBusy(elements.checkLlmButton, "Checking...");
  state.ui.llmChecking = true;
  renderStatus();

  try {
    const payload = await request("/api/llm/check", {
      body: JSON.stringify({}),
      method: "POST"
    });
    state.runtime = payload.runtime;
    if (!options.silent) {
      elements.operationStatus.textContent = payload.result && payload.result.summary
        ? payload.result.summary
        : "LLM provider check completed.";
    }
    renderStatus();
  } catch (error) {
    if (!options.silent) {
      throw error;
    }
    elements.llmStatusNote.innerHTML = `<strong>LLM provider</strong> startup check failed. ${escapeHtml(error.message)}`;
  } finally {
    state.ui.llmChecking = false;
    renderStatus();
    if (done) {
      done();
    }
  }
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

async function runDeckStructureWorkflow({ button, endpoint }) {
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

async function runSlideCandidateWorkflow({ button, endpoint }) {
  return workflowRunners.runSlideCandidate({ button, endpoint });
}

async function sendAssistantMessage() {
  const message = elements.assistantInput.value.trim();
  if (!message) {
    return;
  }

  const selection = state.assistant.selection && state.assistant.selection.slideId === state.selectedSlideId
    ? state.assistant.selection
    : null;
  const done = setBusy(elements.assistantSendButton, "Sending...");
  try {
    setAssistantDrawerOpen(true);
    const payload = await postJson("/api/assistant/message", {
      candidateCount: getRequestedCandidateCount(),
      message,
      selection,
      sessionId: state.assistant.session && state.assistant.session.id ? state.assistant.session.id : "default",
      slideId: state.selectedSlideId
    });
    state.assistant = {
      session: payload.session,
      suggestions: payload.suggestions || state.assistant.suggestions
    };
    state.context = payload.context || state.context;
    state.previews = payload.previews;
    state.runtime = payload.runtime;
    if (payload.validation) {
      state.validation = payload.validation;
      setChecksPanelOpen(true);
    }
    if (payload.action && payload.action.type === "ideate-deck-structure") {
      setDeckStructureCandidates(payload.deckStructureCandidates);
    }
    clearTransientVariants(state.selectedSlideId);
    state.transientVariants = [
      ...(payload.transientVariants || []),
      ...state.transientVariants
    ];
    state.variants = payload.variants || state.variants;
    if ((payload.transientVariants || []).length || (payload.variants || []).length) {
      state.selectedVariantId = null;
      state.ui.variantReviewOpen = true;
    }
    if ((payload.transientVariants || []).length || (payload.variants || []).length) {
      openVariantGenerationControls();
    }
    elements.assistantInput.value = "";
    clearAssistantSelection();
    elements.operationStatus.textContent = payload.reply && payload.reply.content
      ? payload.reply.content
      : "Assistant action completed.";
    renderDeckFields();
    renderDeckStructureCandidates();
    renderAssistant();
    renderStatus();
    renderPreviews();
    renderVariants();
    renderValidation();
  } finally {
    done();
  }
}

function mountStudioCommandControls() {
elements.checkLlmButton.addEventListener("click", () => checkLlmProvider().catch((error) => window.alert(error.message)));
elements.ideateDeckStructureButton.addEventListener("click", () => ideateDeckStructure().catch((error) => window.alert(error.message)));
elements.deckLengthPlanButton.addEventListener("click", () => planDeckLength().catch((error) => window.alert(error.message)));
elements.deckLengthApplyButton.addEventListener("click", () => applyDeckLength().catch((error) => window.alert(error.message)));
slideEditorWorkbench.mount();
customLayoutWorkbench.mount();
variantReviewWorkbench.mount();
elements.layoutDrawerToggle.addEventListener("click", () => setLayoutDrawerOpen(!state.ui.layoutDrawerOpen));
elements.addSourceButton.addEventListener("click", () => addSource().catch((error) => window.alert(error.message)));
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
elements.assistantSendButton.addEventListener("click", () => sendAssistantMessage().catch((error) => window.alert(error.message)));
elements.assistantToggle.addEventListener("click", () => {
  setAssistantDrawerOpen(!state.ui.assistantOpen);
});
elements.showPresentationsPageButton.addEventListener("click", () => setCurrentPage("presentations"));
elements.showStudioPageButton.addEventListener("click", () => setCurrentPage("studio"));
elements.showLayoutStudioPageButton.addEventListener("click", () => setCurrentPage("layout-studio"));
elements.showPlanningPageButton.addEventListener("click", () => setCurrentPage("planning"));
appTheme.mount();
elements.showLlmDiagnosticsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleLlmPopover();
});
elements.llmPopover.addEventListener("click", (event) => event.stopPropagation());
elements.showValidationPageButton.addEventListener("click", () => setChecksPanelOpen(!state.ui.checksOpen));
elements.closeValidationPageButton.addEventListener("click", () => setChecksPanelOpen(false));
elements.contextDrawerToggle.addEventListener("click", () => {
  setContextDrawerOpen(!state.ui.contextDrawerOpen);
});
elements.debugDrawerToggle.addEventListener("click", () => {
  setDebugDrawerOpen(!state.ui.debugDrawerOpen);
});
apiExplorer.mount();
elements.structuredDraftToggle.addEventListener("click", () => {
  setStructuredDraftDrawerOpen(!state.ui.structuredDraftOpen);
});
themeWorkbench.mount();
elements.saveDeckContextButton.addEventListener("click", () => saveDeckContext().catch((error) => window.alert(error.message)));
elements.generateOutlinePlanButton.addEventListener("click", () => generateOutlinePlan().catch((error) => window.alert(error.message)));
elements.saveValidationSettingsButton.addEventListener("click", () => saveValidationSettings().catch((error) => window.alert(error.message)));
elements.saveSlideContextButton.addEventListener("click", () => saveSlideContext().catch((error) => window.alert(error.message)));
elements.generatePresentationOutlineButton.addEventListener("click", () => presentationCreationWorkbench.generatePresentationOutline().catch((error) => window.alert(error.message)));
elements.regeneratePresentationOutlineButton.addEventListener("click", () => presentationCreationWorkbench.generatePresentationOutline().catch((error) => window.alert(error.message)));
elements.regeneratePresentationOutlineWithSourcesButton.addEventListener("click", () => {
  elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
  presentationCreationWorkbench.generatePresentationOutline().catch((error) => window.alert(error.message));
});
elements.approvePresentationOutlineButton.addEventListener("click", () => presentationCreationWorkbench.approvePresentationOutline().catch((error) => window.alert(error.message)));
elements.backToPresentationOutlineButton.addEventListener("click", () => presentationCreationWorkbench.backToPresentationOutline().catch((error) => window.alert(error.message)));
elements.createPresentationButton.addEventListener("click", () => presentationCreationWorkbench.createPresentationFromForm().catch((error) => window.alert(error.message)));
if (elements.openCreatedPresentationButton) {
  elements.openCreatedPresentationButton.addEventListener("click", presentationCreationWorkbench.openCreatedPresentation);
}
elements.openPresentationModeButton.addEventListener("click", openPresentationMode);
if (elements.manualSystemType) {
  elements.manualSystemType.addEventListener("change", renderManualSlideForm);
}
elements.presentationSearch.addEventListener("input", presentationLibrary.render);
document.querySelectorAll("[data-creation-stage]").forEach((button: any) => {
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }

    const nextStage = presentationCreationWorkbench.normalizeStage(button.dataset.creationStage);
    setCreationStage(nextStage);
    presentationCreationWorkbench.saveCreationDraft(nextStage).catch((error) => window.alert(error.message));
  });
});

[elements.presentationOutlineList, elements.presentationOutlineTitle, elements.presentationOutlineSummary].filter(Boolean).forEach((element) => {
  element.addEventListener("input", (event) => {
    const target: any = event.target;
    if (target && (target.dataset.outlineField || target.dataset.outlineSlideField)) {
      presentationCreationWorkbench.markOutlineEditedLocally();
    }
  });
  element.addEventListener("change", (event) => {
    const target: any = event.target;
    if (target && (target.dataset.outlineField || target.dataset.outlineSlideField)) {
      presentationCreationWorkbench.saveEditableOutlineDraft({ render: false }).catch((error) => window.alert(error.message));
    }
  });
});
elements.presentationOutlineList.addEventListener("click", (event) => {
  const target: any = event.target;
  const lockButton = target.closest("[data-outline-lock-slide-index]");
  if (lockButton && elements.presentationOutlineList.contains(lockButton)) {
    const slideIndex = Number.parseInt(lockButton.dataset.outlineLockSlideIndex, 10);
    if (Number.isFinite(slideIndex)) {
      presentationCreationWorkbench.setOutlineSlideLocked(slideIndex, lockButton.getAttribute("aria-pressed") !== "true");
      presentationCreationWorkbench.saveEditableOutlineDraft().catch((error) => window.alert(error.message));
    }
    return;
  }

  const regenerateButton = target.closest("[data-outline-regenerate-slide-index]");
  if (regenerateButton && elements.presentationOutlineList.contains(regenerateButton)) {
    const slideIndex = Number.parseInt(regenerateButton.dataset.outlineRegenerateSlideIndex, 10);
    if (Number.isFinite(slideIndex)) {
      presentationCreationWorkbench.regeneratePresentationOutlineSlide(slideIndex).catch((error) => window.alert(error.message));
    }
  }
});

presentationCreationWorkbench.mountContentRunControls(renderCreationDraft);
}

function mountThemeInputs() {
[
  elements.deckThemeBrief,
  elements.themeBrief,
  elements.themeFontFamily,
  elements.themePrimary,
  elements.themeSecondary,
  elements.themeAccent,
  elements.themeMuted,
  elements.themeLight,
  elements.themeBg,
  elements.themePanel,
  elements.themeSurface,
  elements.themeProgressTrack,
  elements.themeProgressFill
].forEach((element) => {
  element.addEventListener("input", () => {
    if (element === elements.deckThemeBrief || element === elements.themeBrief) {
      setDeckThemeBriefValue(element.value);
    }
    resetThemeCandidates();
    renderCreationThemeStage();
  });
  element.addEventListener("change", () => {
    if (element === elements.deckThemeBrief || element === elements.themeBrief) {
      setDeckThemeBriefValue(element.value);
    }
    resetThemeCandidates();
    renderCreationThemeStage();
    persistSelectedThemeToDeck().catch((error) => window.alert(error.message));
  });
});
}

function mountGlobalEvents() {
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.ui.llmPopoverOpen) {
      setLlmPopoverOpen(false);
    }
    if (state.ui.checksOpen) {
      setChecksPanelOpen(false);
    }
    if (state.ui.assistantOpen) {
      setAssistantDrawerOpen(false);
    }
    if (state.ui.themeDrawerOpen) {
      setThemeDrawerOpen(false);
    }
    if (state.ui.contextDrawerOpen) {
      setContextDrawerOpen(false);
    }
    if (state.ui.debugDrawerOpen) {
      setDebugDrawerOpen(false);
    }
    if (state.ui.structuredDraftOpen) {
      setStructuredDraftDrawerOpen(false);
    }
  }
});

document.addEventListener("click", () => {
  if (state.ui.llmPopoverOpen) {
    setLlmPopoverOpen(false);
  }
});

window.addEventListener("hashchange", () => {
  const page = window.location.hash.replace(/^#/, "");
  if (page === "validation") {
    setCurrentPage("studio");
    setChecksPanelOpen(true);
    return;
  }

  setCurrentPage(page === "planning" || page === "presentations" || page === "layout-studio" ? page : "studio");
});
}

function initializeStudioClient() {
  mountStudioCommandControls();
  presentationCreationWorkbench.mountInputs();
  mountThemeInputs();
  mountGlobalEvents();

  state.ui.appTheme = appTheme.load();
  appTheme.apply(state.ui.appTheme);
  state.ui.currentPage = loadCurrentPagePreference();
  state.ui.checksOpen = window.location.hash.replace(/^#/, "") === "validation";
  state.ui.assistantOpen = loadAssistantDrawerPreference();
  state.ui.contextDrawerOpen = loadContextDrawerPreference();
  state.ui.structuredDraftOpen = loadStructuredDraftDrawerPreference();
  if (state.ui.contextDrawerOpen && state.ui.structuredDraftOpen) {
    state.ui.structuredDraftOpen = false;
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
