// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// slide-dom.ts and persistent writes go through server APIs.
import { StudioClientApiExplorer } from "./api-explorer.ts";
import { StudioClientAppTheme } from "./app-theme.ts";
import { StudioClientAssistantWorkbench } from "./assistant-workbench.ts";
import { StudioClientCore } from "./core.ts";
import { StudioClientCustomLayoutWorkbench } from "./custom-layout-workbench.ts";
import { StudioClientDeckPlanningWorkbench } from "./deck-planning-workbench.ts";
import { StudioClientElements } from "./elements.ts";
import { StudioClientLlmStatus } from "./llm-status.ts";
import { StudioClientNavigationShell } from "./navigation-shell.ts";
import { StudioClientPresentationCreationWorkbench } from "./presentation-creation-workbench.ts";
import { StudioClientPresentationLibrary } from "./presentation-library.ts";
import { StudioClientPreferences } from "./preferences.ts";
import { StudioClientPreviewWorkbench } from "./preview-workbench.ts";
import { StudioClientRuntimeStatusWorkbench } from "./runtime-status-workbench.ts";
import { StudioClientSlideEditorWorkbench } from "./slide-editor-workbench.ts";
import { StudioClientSlidePreview } from "./slide-preview.ts";
import { StudioClientState } from "./state.ts";
import { StudioClientThemeWorkbench } from "./theme-workbench.ts";
import { StudioClientValidationReport } from "./validation-report.ts";
import { StudioClientVariantReviewWorkbench } from "./variant-review-workbench.ts";
import { StudioClientWorkflows } from "./workflows.ts";

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

const elements: StudioClientElements.Elements = StudioClientElements.createElements(StudioClientCore);
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
let navigationShell: any = null;
let previewWorkbench: any = null;
let assistantWorkbench: any = null;
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
navigationShell = StudioClientNavigationShell.createNavigationShell({
  customLayoutWorkbench,
  documentRef: document,
  elements,
  getApiExplorerState,
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
  customLayoutWorkbench,
  documentRef: document,
  elements,
  enableDomSlideTextEditing,
  escapeHtml,
  getDomSlideSpec,
  getSelectedVariant,
  getVariantVisualTheme,
  presentationCreationWorkbench,
  renderDomSlide,
  renderImagePreview,
  selectSlideByIndex,
  state
});
assistantWorkbench = StudioClientAssistantWorkbench.createAssistantWorkbench({
  clearAssistantSelection,
  clearTransientVariants,
  elements,
  escapeHtml,
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

function renderPages() {
  navigationShell.renderPages();
}

function setCurrentPage(page) {
  navigationShell.setCurrentPage(page);
}

function setChecksPanelOpen(open) {
  navigationShell.setChecksPanelOpen(open);
}

function renderAllDrawers() {
  navigationShell.renderAllDrawers();
}

function setAssistantDrawerOpen(open) {
  navigationShell.setAssistantDrawerOpen(open);
}

function setLayoutDrawerOpen(open) {
  navigationShell.setLayoutDrawerOpen(open);
}

function renderThemeDrawer() {
  navigationShell.renderThemeDrawer();
}

function setThemeDrawerOpen(open) {
  navigationShell.setThemeDrawerOpen(open);
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
  assistantWorkbench.render();
}

function renderAssistantSelection() {
  assistantWorkbench.renderSelection();
}

function renderPreviews() {
  previewWorkbench.render();
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

function mountStudioCommandControls() {
elements.checkLlmButton.addEventListener("click", () => checkLlmProvider().catch((error) => window.alert(error.message)));
elements.ideateDeckStructureButton.addEventListener("click", () => ideateDeckStructure().catch((error) => window.alert(error.message)));
slideEditorWorkbench.mount();
deckPlanningWorkbench.mount();
customLayoutWorkbench.mount();
variantReviewWorkbench.mount();
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
appTheme.mount();
apiExplorer.mount();
navigationShell.mount();
assistantWorkbench.mount();
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
  navigationShell.mountGlobalEvents();
}

function initializeStudioClient() {
  mountStudioCommandControls();
  presentationCreationWorkbench.mountInputs();
  mountThemeInputs();
  mountGlobalEvents();

  state.ui.appTheme = appTheme.load();
  appTheme.apply(state.ui.appTheme);
  navigationShell.initializeState();
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
