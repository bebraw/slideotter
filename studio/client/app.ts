// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// slide-dom.ts and persistent writes go through server APIs.
declare const StudioClientCore: any;
declare const StudioClientApiExplorer: any;
declare const StudioClientAppTheme: any;
declare const StudioClientCustomLayoutWorkbench: any;
declare const StudioClientDeckPlanningWorkbench: any;
declare const StudioClientDrawers: any;
declare const StudioClientElements: any;
declare const StudioClientLlmStatus: any;
declare const StudioClientPresentationCreationWorkbench: any;
declare const StudioClientPresentationLibrary: any;
declare const StudioClientPreferences: any;
declare const StudioClientRuntimeStatusWorkbench: any;
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
let runtimeStatusWorkbench: any = null;
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
const deckPlanningWorkbench = StudioClientDeckPlanningWorkbench.createDeckPlanningWorkbench({
  buildDeck,
  elements,
  escapeHtml,
  loadSlide,
  presentationCreationWorkbench,
  presentationLibrary,
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
runtimeStatusWorkbench = StudioClientRuntimeStatusWorkbench.createRuntimeStatusWorkbench({
  customLayoutWorkbench,
  elements,
  escapeHtml,
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
  runtimeStatusWorkbench.renderStatus();
}

function setLlmPopoverOpen(open) {
  runtimeStatusWorkbench.setLlmPopoverOpen(open);
}

function toggleLlmPopover() {
  runtimeStatusWorkbench.toggleLlmPopover();
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


function renderDeckLengthPlan() {
  deckPlanningWorkbench.renderDeckLengthPlan();
}

function setDeckStructureCandidates(candidates) {
  deckPlanningWorkbench.setDeckStructureCandidates(candidates);
}

function renderDeckStructureCandidates() {
  deckPlanningWorkbench.renderDeckStructureCandidates();
}

function renderSources() {
  deckPlanningWorkbench.renderSources();
}

function renderOutlinePlans() {
  deckPlanningWorkbench.renderOutlinePlans();
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
slideEditorWorkbench.mount();
deckPlanningWorkbench.mount();
customLayoutWorkbench.mount();
variantReviewWorkbench.mount();
elements.layoutDrawerToggle.addEventListener("click", () => setLayoutDrawerOpen(!state.ui.layoutDrawerOpen));
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
