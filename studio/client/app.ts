// Studio client state and event binding for the authoring workspace. Keep this
// file focused on browser interaction orchestration; rendering details belong in
// slide-dom.ts and persistent writes go through server APIs.
declare const StudioClientCore: any;
declare const StudioClientApiExplorer: any;
declare const StudioClientAppTheme: any;
declare const StudioClientContentRunActions: any;
declare const StudioClientDrawers: any;
declare const StudioClientElements: any;
declare const StudioClientPreferences: any;
declare const StudioClientState: any;
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

const domSlideWidth = 960;
const domSlideResizeObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        syncDomSlideViewport(entry.target);
      });
    })
  : null;
let activeInlineTextEdit = null;
let creationDraftSaveTimer = null;
let slideSpecPreviewFrame = null;

function getValidationRuleSelects(): any[] {
  return Array.from(document.querySelectorAll("[data-validation-rule]"));
}

function updateSlideSpecHighlight() {
  const highlightCode = elements.slideSpecHighlight ? elements.slideSpecHighlight.querySelector("code") : null;
  if (!highlightCode) {
    return;
  }

  highlightCode.innerHTML = highlightJsonSource(elements.slideSpecEditor.value);
  elements.slideSpecHighlight.scrollTop = elements.slideSpecEditor.scrollTop;
  elements.slideSpecHighlight.scrollLeft = elements.slideSpecEditor.scrollLeft;
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

function syncDomSlideViewport(viewport) {
  if (!viewport) {
    return;
  }

  const width = viewport.clientWidth || 0;
  const scale = width > 0 ? width / domSlideWidth : 1;
  viewport.style.setProperty("--dom-slide-scale", String(scale));
}

function observeDomSlideViewport(viewport) {
  if (!viewport) {
    return;
  }

  if (domSlideResizeObserver) {
    domSlideResizeObserver.observe(viewport);
  }

  syncDomSlideViewport(viewport);
}

function renderImagePreview(viewport, url, alt) {
  if (!viewport) {
    return;
  }

  if (!url) {
    viewport.innerHTML = "";
    return;
  }

  viewport.innerHTML = `<img class="dom-slide-viewport__fallback-image" src="${escapeHtml(url)}" alt="${escapeHtml(alt || "Slide preview")}">`;
}

function renderDomSlide(viewport, slideSpec, options: any = {}) {
  if (!viewport) {
    return;
  }

  const renderer = getDomRenderer();
  if (!renderer || !slideSpec) {
    viewport.innerHTML = "";
    return;
  }

  viewport.innerHTML = `
    <div class="dom-slide-viewport">
      <div class="dom-slide-viewport__stage">
        ${renderer.renderSlideMarkup(slideSpec, {
          index: options.index,
          theme: options.theme || getDomTheme(),
          totalSlides: options.totalSlides
        })}
      </div>
    </div>
  `;
  observeDomSlideViewport(viewport.querySelector(".dom-slide-viewport"));
}

function enableDomSlideTextEditing(viewport) {
  const slideViewport = viewport ? viewport.querySelector(".dom-slide-viewport") : null;
  if (!slideViewport || !state.selectedSlideStructured || !state.selectedSlideSpec) {
    return;
  }

  slideViewport.classList.add("dom-slide-viewport--editable");
  slideViewport.querySelectorAll("[data-edit-path]").forEach((element) => {
    element.tabIndex = 0;
    element.title = `Double-click to edit ${element.dataset.editLabel || "text"}`;
  });
}

function pathToArray(path) {
  if (Array.isArray(path)) {
    return path.map((segment) => Number.isInteger(Number(segment)) && String(segment).trim() !== ""
      ? Number(segment)
      : String(segment));
  }

  return String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => Number.isInteger(Number(segment)) ? Number(segment) : segment);
}

function pathToString(path) {
  return (Array.isArray(path) ? path : pathToArray(path)).map(String).join(".");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashFieldValue(value) {
  let hash = 2166136261;
  const text = canonicalJson(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function getSlideSpecPathValue(slideSpec, path) {
  return pathToArray(path).reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return current[segment];
  }, slideSpec);
}

function cloneSlideSpecWithPath(slideSpec, path, value) {
  const nextSpec = JSON.parse(JSON.stringify(slideSpec));
  const segments = String(path || "").split(".");
  const field = segments.pop();
  const target = segments.reduce((current, segment) => {
    if (current === null || current === undefined) {
      throw new Error(`Cannot edit unknown slide field: ${path}`);
    }

    return current[Number.isInteger(Number(segment)) ? Number(segment) : segment];
  }, nextSpec);

  if (!target || field === undefined) {
    throw new Error(`Cannot edit unknown slide field: ${path}`);
  }

  target[Number.isInteger(Number(field)) ? Number(field) : field] = value;
  return nextSpec;
}

function normalizeInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function applySlideSpecPayload(payload, fallbackSpec) {
  const nextSpec = payload.slideSpec || fallbackSpec;
  state.selectedSlideSpec = nextSpec;
  state.selectedSlideSpecDraftError = null;
  state.selectedSlideSpecError = payload.slideSpecError || null;
  state.selectedSlideStructured = payload.structured === true;
  state.selectedSlideSource = payload.source;
  if (payload.slide) {
    state.slides = state.slides.map((slide) => slide.id === payload.slide.id ? payload.slide : slide);
    state.selectedSlideIndex = payload.slide.index;
  }
  patchDomSlideSpec(state.selectedSlideId, nextSpec);
  state.previews = payload.previews || state.previews;
}

function selectElementText(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function clearAssistantSelection() {
  state.assistant.selection = null;
  renderAssistantSelection();
}

function getSelectionEditElement(selection) {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer;
  const element = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
  const editElement = element ? element.closest("[data-edit-path]") : null;
  return editElement && elements.activePreview.contains(editElement) ? editElement : null;
}

function getSelectionEditElements(selection) {
  if (!selection || selection.rangeCount === 0 || !elements.activePreview) {
    return [];
  }

  const range = selection.getRangeAt(0);
  return Array.from(elements.activePreview.querySelectorAll("[data-edit-path]"))
    .filter((element) => {
      try {
        return range.intersectsNode(element);
      } catch (error) {
        return false;
      }
    });
}

function buildSelectionEntry(editElement, selectedText) {
  const fieldPath = pathToArray(editElement.dataset.editPath || "");
  const fieldValue = getSlideSpecPathValue(state.selectedSlideSpec, fieldPath);
  const text = normalizeInlineText(selectedText || editElement.textContent || fieldValue);
  if (!fieldPath.length || fieldValue === undefined || !text) {
    return null;
  }

  return {
    anchorText: text,
    fieldHash: hashFieldValue(fieldValue),
    fieldPath,
    label: editElement.dataset.editLabel || "Slide text",
    path: pathToString(fieldPath),
    selectedText: text,
    selectionRange: null,
    text
  };
}

function captureAssistantSelection() {
  if (activeInlineTextEdit) {
    return;
  }

  const selection = window.getSelection();
  const text = normalizeInlineText(selection ? selection.toString() : "");
  const editElement = getSelectionEditElement(selection);

  if (!text || !editElement) {
    return;
  }

  const editElements = getSelectionEditElements(selection);
  const uniqueElements = Array.from(new Map(editElements.map((element: any) => [element.dataset.editPath || "", element])).values());
  const selections = uniqueElements.length > 1
    ? uniqueElements.map((element) => buildSelectionEntry(element, "")).filter(Boolean)
    : [buildSelectionEntry(editElement, text.slice(0, 500))].filter(Boolean);

  if (!selections.length) {
    return;
  }

  state.assistant.selection = selections.length > 1
    ? {
        kind: "selectionGroup",
        label: `${selections.length} selected fields`,
        presentationId: state.presentations.activePresentationId,
        selections,
        slideId: state.selectedSlideId,
        slideIndex: state.selectedSlideIndex,
        text: text.slice(0, 500)
      }
    : {
        ...selections[0],
        kind: "selection",
        presentationId: state.presentations.activePresentationId,
        slideId: state.selectedSlideId,
        slideIndex: state.selectedSlideIndex
      };
  renderAssistantSelection();
}

function beginInlineTextEdit(element, path) {
  if (activeInlineTextEdit || !state.selectedSlideId || !state.selectedSlideSpec) {
    return;
  }

  const original = normalizeInlineText(getSlideSpecPathValue(state.selectedSlideSpec, path) ?? element.textContent);
  activeInlineTextEdit = { element, path };
  element.dataset.inlineEditing = "true";
  element.contentEditable = "plaintext-only";
  element.spellcheck = true;
  element.focus();
  selectElementText(element);

  const finish = async (mode) => {
    if (activeInlineTextEdit === null) {
      return;
    }

    activeInlineTextEdit = null;
    element.removeEventListener("blur", handleBlur);
    element.removeEventListener("keydown", handleKeydown);
    element.contentEditable = "false";

    if (mode === "cancel") {
      element.textContent = original;
      delete element.dataset.inlineEditing;
      elements.operationStatus.textContent = "Inline text edit canceled.";
      return;
    }

    const nextText = normalizeInlineText(element.textContent);
    if (!nextText) {
      element.textContent = original;
      delete element.dataset.inlineEditing;
      elements.operationStatus.textContent = "Inline text edit canceled because the field was empty.";
      return;
    }

    if (nextText === original) {
      element.textContent = original;
      delete element.dataset.inlineEditing;
      return;
    }

    const nextSpec = cloneSlideSpecWithPath(state.selectedSlideSpec, path, nextText);
    element.dataset.inlineSaving = "true";
    elements.operationStatus.textContent = `Saving ${element.dataset.editLabel || "slide text"}...`;

    try {
      const payload = await request(`/api/slides/${state.selectedSlideId}/slide-spec`, {
        body: JSON.stringify({
          rebuild: false,
          slideSpec: nextSpec
        }),
        method: "POST"
      });
      applySlideSpecPayload(payload, nextSpec);
      renderSlideFields();
      renderPreviews();
      renderVariantComparison();
      renderStatus();
      elements.operationStatus.textContent = `Saved ${element.dataset.editLabel || "slide text"}.`;
    } catch (error) {
      window.alert(error.message);
      renderPreviews();
    }
  };

  const handleBlur = () => {
    finish("save").catch((error) => window.alert(error.message));
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish("cancel").catch((error) => window.alert(error.message));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      element.blur();
    }
  };

  element.addEventListener("blur", handleBlur);
  element.addEventListener("keydown", handleKeydown);
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

function getLlmConnectionView(llm) {
  if (state.ui.llmChecking) {
    return {
      detail: "Checking LLM provider configuration and structured output support.",
      label: "LLM checking",
      providerLine: "LLM provider",
      state: "idle"
    };
  }

  if (!llm) {
    return {
      detail: "LLM provider state has not loaded yet.",
      label: "LLM status",
      providerLine: "LLM provider",
      state: "idle"
    };
  }

  const llmCheck = llm.lastCheck;
  const providerLine = llm.model
    ? `${llm.provider} using ${llm.model}`
    : `${llm.provider} provider`;
  const baseUrl = llm.baseUrl ? ` at ${llm.baseUrl}` : "";

  if (llmCheck && llmCheck.testedAt) {
    return {
      detail: `${providerLine}${baseUrl}. ${llmCheck.summary}`,
      label: llmCheck.ok ? "LLM ready" : "LLM issue",
      providerLine,
      state: llmCheck.ok ? "ok" : "warn"
    };
  }

  if (llm.available) {
    return {
      detail: `${providerLine}${baseUrl} is configured. Run a provider check to verify live connectivity.`,
      label: "LLM unverified",
      providerLine,
      state: "idle"
    };
  }

  return {
    detail: `${providerLine}${baseUrl} is not ready. ${llm.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating variants."}`,
    label: "LLM off",
    providerLine,
    state: "warn"
  };
}

function renderStatus() {
  const llm = state.runtime && state.runtime.llm;
  const validation = state.runtime && state.runtime.validation;
  const workflow = state.runtime && state.runtime.workflow;
  const workflowRunning = workflow && workflow.status === "running";
  const selected = state.slides.find((slide) => slide.id === state.selectedSlideId);
  const llmView = getLlmConnectionView(llm);

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
  renderContentRunNavStatus();
  renderStudioContentRunPanel();

  elements.ideateSlideButton.disabled = !selected || workflowRunning;
  elements.ideateStructureButton.disabled = !selected || workflowRunning;
  elements.ideateThemeButton.disabled = !selected || workflowRunning;
  elements.redoLayoutButton.disabled = !selected || workflowRunning;
  elements.quickCustomLayoutButton.disabled = !selected || !getCustomLayoutSupported() || workflowRunning;
  elements.quickCustomLayoutProfile.disabled = !selected || !getCustomLayoutSupported() || workflowRunning;
  elements.captureVariantButton.disabled = !selected;
  elements.saveLayoutButton.disabled = !selected || !state.selectedSlideSpec;
  if (elements.customLayoutPreviewButton) {
    const customLayoutDisabled = !selected || !getCustomLayoutSupported() || workflowRunning;
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
  renderLayoutLibrary();
  renderSources();
  renderSourceRetrieval();
  renderPromptBudget();
  renderApiExplorer();

  const llmDetail = llmView.detail.startsWith(llmView.providerLine)
    ? llmView.detail.slice(llmView.providerLine.length)
    : `. ${llmView.detail}`;
  elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(llmView.providerLine)}</strong>${escapeHtml(llmDetail)}`;
}

function renderContentRunNavStatus() {
  if (!elements.contentRunNavStatus) {
    return;
  }

  const draft = state.creationDraft || {};
  const deckPlan = draft.deckPlan;
  const run = draft.contentRun;
  const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
  const slideCount = run && Number.isFinite(Number(run.slideCount))
    ? Number(run.slideCount)
    : deckPlan && Array.isArray(deckPlan.slides)
      ? deckPlan.slides.length
      : 0;

  const shouldShow = run
    && slideCount
    && ["running", "failed", "stopped"].includes(run.status || "");
  if (!shouldShow) {
    elements.contentRunNavStatus.hidden = true;
    elements.contentRunNavStatus.textContent = "";
    elements.contentRunNavStatus.dataset.state = "idle";
    return;
  }

  elements.contentRunNavStatus.hidden = false;
  const summary = formatContentRunSummary(run, slideCount, runSlides);
  elements.contentRunNavStatus.textContent = summary;
  elements.contentRunNavStatus.title = summary;
  elements.contentRunNavStatus.dataset.state = run.status || "idle";
}

function getContentRunActionState() {
  const draft = state.creationDraft || {};
  const deckPlan = draft.deckPlan;
  const run = draft.contentRun && typeof draft.contentRun === "object" ? draft.contentRun : null;
  const planSlides = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
  const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
  if (!run || !planSlides.length) {
    return null;
  }

  const slideCount = Number.isFinite(Number(run.slideCount)) ? Number(run.slideCount) : planSlides.length;
  const failedIndex = runSlides.findIndex((slide) => slide && slide.status === "failed");
  const completedCount = Number.isFinite(Number(run.completed))
    ? Number(run.completed)
    : runSlides.filter((slide) => slide && slide.status === "complete").length;
  const incompleteCount = runSlides.filter((slide) => slide && slide.status !== "complete").length;

  return {
    completedCount,
    failedIndex,
    incompleteCount,
    run,
    runSlides,
    slideCount
  };
}

function renderStudioContentRunPanel() {
  if (!elements.studioContentRunPanel) {
    return;
  }

  const actionState = getContentRunActionState();
  const activeRun = getLiveStudioContentRun();
  if (!actionState || !activeRun || !["running", "failed", "stopped"].includes(actionState.run.status || "")) {
    elements.studioContentRunPanel.hidden = true;
    elements.studioContentRunPanel.innerHTML = "";
    return;
  }

  const { completedCount, failedIndex, incompleteCount, run, runSlides, slideCount } = actionState;
  const summary = formatContentRunSummary(run, slideCount, runSlides);
  const canRetry = run.status === "failed" && failedIndex >= 0 && !isWorkflowRunning();
  const canAcceptPartial = run.status !== "running" && completedCount > 0 && incompleteCount > 0;

  elements.studioContentRunPanel.hidden = false;
  elements.studioContentRunPanel.dataset.state = run.status || "idle";
  elements.studioContentRunPanel.innerHTML = `
    <div>
      <p class="eyebrow">Live generation</p>
      <strong>${escapeHtml(summary)}</strong>
    </div>
    <div class="button-row compact">
      ${run.status === "running" ? "<button class=\"secondary compact-button\" type=\"button\" data-studio-content-run-stop>Stop</button>" : ""}
      ${canRetry ? `<button class="secondary compact-button" type="button" data-studio-content-run-retry="${failedIndex + 1}">Retry slide ${failedIndex + 1}</button>` : ""}
      ${canAcceptPartial ? "<button class=\"secondary compact-button\" type=\"button\" data-studio-content-run-accept-partial>Accept completed</button>" : ""}
    </div>
  `;
}

function setLlmPopoverOpen(open) {
  state.ui.llmPopoverOpen = Boolean(open);
  renderStatus();
}

function toggleLlmPopover() {
  setLlmPopoverOpen(!state.ui.llmPopoverOpen);
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
  renderLayoutStudio();
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

function showGeneratedDeckInStudio(fields, deckPlan) {
  state.creationDraft = {
    approvedOutline: true,
    deckPlan,
    fields,
    outlineDirty: false,
    outlineLocks: {},
    stage: "content"
  };
  state.ui.creationStage = "content";
  state.ui.creationThemeVariantId = "current";
  state.ui.themeCandidateRefreshIndex = 0;
  state.ui.themeCandidatesGenerated = false;
  setCurrentPage("studio");
  renderCreationDraft();
  elements.operationStatus.textContent = "Created deck. Review the slides, then open Theme when the surface needs tuning.";
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
    afterRender: renderCustomLayoutEditor,
    afterSet: renderPreviews,
    bodyClass: "layout-drawer-open",
    drawer: () => elements.layoutDrawer,
    closedLabel: "Open layout controls",
    onBeforeSet: () => {
      state.ui.customLayoutDefinitionPreviewActive = false;
      state.ui.customLayoutMainPreviewActive = false;
    },
    onOpen: () => {
      elements.customLayoutStatus.textContent = getCustomLayoutSupported() ? "Draft" : "Content and cover slides only";
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

function renderAssistantDrawer() {
  drawerController.render("assistant");
}

function setAssistantDrawerOpen(open) {
  drawerController.setOpen("assistant", open);
}

function renderStructuredDraftDrawer() {
  drawerController.render("structuredDraft");
}

function setStructuredDraftDrawerOpen(open) {
  drawerController.setOpen("structuredDraft", open);
}

function renderContextDrawer() {
  drawerController.render("context");
}

function setContextDrawerOpen(open) {
  drawerController.setOpen("context", open);
}

function renderDebugDrawer() {
  drawerController.render("debug");
}

function setDebugDrawerOpen(open) {
  drawerController.setOpen("debug", open);
}

function renderLayoutDrawer() {
  drawerController.render("layout");
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

function getSlideVariants() {
  return [
    ...state.transientVariants.filter((variant) => variant.slideId === state.selectedSlideId),
    ...state.variants.filter((variant) => variant.slideId === state.selectedSlideId)
  ];
}

function getPreferredVariant(variants) {
  return variants.find((variant) => variant.kind === "generated") || variants[0] || null;
}

function getSelectedVariant() {
  const variants = getSlideVariants();
  if (!variants.length) {
    state.selectedVariantId = null;
    return null;
  }

  if (!variants.some((variant) => variant.id === state.selectedVariantId)) {
    state.selectedVariantId = null;
  }

  return variants.find((variant) => variant.id === state.selectedVariantId) || null;
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

function summarizeDiff(currentSource, variantSource) {
  const currentLines = currentSource.split("\n");
  const variantLines = variantSource.split("\n");
  const maxLines = Math.max(currentLines.length, variantLines.length);
  let added = 0;
  let changed = 0;
  const highlights = [];
  let removed = 0;

  for (let index = 0; index < maxLines; index += 1) {
    const before = currentLines[index];
    const after = variantLines[index];

    if (before === after) {
      continue;
    }

    if (before === undefined) {
      added += 1;
    } else if (after === undefined) {
      removed += 1;
    } else {
      changed += 1;
    }

    if (highlights.length < 4) {
      highlights.push({
        after: after ? after.trim() : "(removed)",
        before: before ? before.trim() : "(no line)",
        line: index + 1
      });
    }
  }

  return {
    added,
    changed,
    highlights,
    removed
  };
}

function normalizeCompareValue(value) {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}

function formatCompareValue(value) {
  const normalized = normalizeCompareValue(value);
  return normalized || "(empty)";
}

function formatStructuredGroupLabel(group) {
  return ({
    bullets: "Bullets",
    cards: "Cards",
    framing: "Framing",
    guardrails: "Guardrails",
    resources: "Resources",
    signals: "Signals"
  })[group] || group;
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

function buildStructuredComparison(currentSpec, variantSpec) {
  if (!currentSpec || !variantSpec) {
    return null;
  }

  const changes = [];
  const groups = new Set();

  const pushChange = (group, label, before, after) => {
    const normalizedBefore = normalizeCompareValue(before);
    const normalizedAfter = normalizeCompareValue(after);

    if (normalizedBefore === normalizedAfter) {
      return;
    }

    groups.add(group);
    changes.push({
      after: formatCompareValue(after),
      before: formatCompareValue(before),
      group,
      label
    });
  };

  if (currentSpec.type !== variantSpec.type) {
    pushChange("family", "Slide family", currentSpec.type, variantSpec.type);

    return {
      changes,
      groupDetails: [
        {
          changes,
          group: "family",
          label: "Slide family"
        }
      ],
      groups: ["family"],
      summaryLines: [
        `Changed slide family from ${currentSpec.type} to ${variantSpec.type}.`,
        "Review dropped or transformed fields in the JSON diff before applying."
      ],
      totalChanges: changes.length
    };
  }

  pushChange("framing", "Title", currentSpec.title, variantSpec.title);
  if (currentSpec.type !== "divider") {
    pushChange("framing", "Eyebrow", currentSpec.eyebrow, variantSpec.eyebrow);
    pushChange("framing", "Summary", currentSpec.summary, variantSpec.summary);
  }

  switch (currentSpec.type) {
    case "divider":
      break;
    case "cover":
    case "toc":
      pushChange("framing", "Note", currentSpec.note, variantSpec.note);
      currentSpec.cards.forEach((card, index) => {
        const nextCard = variantSpec.cards[index] || {};
        pushChange("cards", `Card ${index + 1} title`, card.title, nextCard.title);
        pushChange("cards", `Card ${index + 1} body`, card.body, nextCard.body);
      });
      break;
    case "content":
      pushChange("signals", "Signals title", currentSpec.signalsTitle, variantSpec.signalsTitle);
      (currentSpec.signals || []).forEach((signal, index) => {
        const nextSignal = (variantSpec.signals || [])[index] || {};
        pushChange("signals", `Signal ${index + 1} title`, signal.title || signal.label, nextSignal.title || nextSignal.label);
        pushChange("signals", `Signal ${index + 1} body`, signal.body || signal.value, nextSignal.body || nextSignal.value);
      });
      pushChange("guardrails", "Guardrails title", currentSpec.guardrailsTitle, variantSpec.guardrailsTitle);
      (currentSpec.guardrails || []).forEach((guardrail, index) => {
        const nextGuardrail = (variantSpec.guardrails || [])[index] || {};
        pushChange("guardrails", `Guardrail ${index + 1} title`, guardrail.title || guardrail.label, nextGuardrail.title || nextGuardrail.label);
        pushChange("guardrails", `Guardrail ${index + 1} body`, guardrail.body || guardrail.value, nextGuardrail.body || nextGuardrail.value);
      });
      break;
    case "summary":
      pushChange("resources", "Resources title", currentSpec.resourcesTitle, variantSpec.resourcesTitle);
      currentSpec.bullets.forEach((bullet, index) => {
        const nextBullet = variantSpec.bullets[index] || {};
        pushChange("bullets", `Bullet ${index + 1} title`, bullet.title, nextBullet.title);
        pushChange("bullets", `Bullet ${index + 1} body`, bullet.body, nextBullet.body);
      });
      currentSpec.resources.forEach((resource, index) => {
        const nextResource = variantSpec.resources[index] || {};
        pushChange("resources", `Resource ${index + 1} title`, resource.title, nextResource.title);
        pushChange("resources", `Resource ${index + 1} body`, resource.body, nextResource.body);
      });
      break;
    default:
      return null;
  }

  if (!changes.length) {
    return {
      changes: [],
      groups: [],
      summaryLines: ["No structured field changes detected."],
      totalChanges: 0
    };
  }

  const orderedGroups = Array.from(groups);
  const groupLabels = orderedGroups.map((group) => formatStructuredGroupLabel(group)).join(", ");
  const groupDetails = orderedGroups.map((group) => ({
    changes: changes.filter((change) => change.group === group),
    group,
    label: formatStructuredGroupLabel(group)
  }));

  return {
    changes,
    groupDetails,
    groups: orderedGroups,
    summaryLines: [
      `Changed ${changes.length} structured field${changes.length === 1 ? "" : "s"} across ${orderedGroups.length} content area${orderedGroups.length === 1 ? "" : "s"}.`,
      `Areas touched: ${groupLabels}.`
    ],
    totalChanges: changes.length
  };
}

function collectSlideTextParts(spec) {
  if (!spec || typeof spec !== "object") {
    return [];
  }

  const parts = [
    spec.eyebrow,
    spec.title,
    spec.summary,
    spec.note,
    spec.signalsTitle,
    spec.guardrailsTitle,
    spec.resourcesTitle
  ];

  ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
    if (!Array.isArray(spec[field])) {
      return;
    }

    spec[field].forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      parts.push(item.title, item.body, item.label, item.value);
    });
  });

  return parts
    .filter((part) => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);
}

function countSlideWords(spec) {
  const text = collectSlideTextParts(spec).join(" ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function buildVariantDecisionSupport(currentSpec, variantSpec, structuredComparison, diff) {
  const fieldChanges = structuredComparison
    ? structuredComparison.totalChanges
    : diff.changed + diff.added + diff.removed;
  const groupDetails = structuredComparison && Array.isArray(structuredComparison.groupDetails)
    ? structuredComparison.groupDetails
    : [];
  const contentAreas = groupDetails.length;
  const canCompareWords = Boolean(currentSpec && variantSpec);
  const currentWords = canCompareWords ? countSlideWords(currentSpec) : 0;
  const variantWords = canCompareWords ? countSlideWords(variantSpec) : 0;
  const wordDelta = canCompareWords ? variantWords - currentWords : null;
  const absoluteWordDelta = wordDelta === null ? 0 : Math.abs(wordDelta);
  const titleChanged = structuredComparison
    ? structuredComparison.changes.some((change) => change.label === "Title")
    : false;
  const scale = fieldChanges >= 12 || contentAreas >= 4 || absoluteWordDelta >= 24
    ? "Large"
    : fieldChanges >= 5 || contentAreas >= 2 || absoluteWordDelta >= 10
      ? "Medium"
      : "Small";
  const focusItems = groupDetails.length
    ? groupDetails.map((group) => ({
      label: group.label,
      value: `${group.changes.length} change${group.changes.length === 1 ? "" : "s"}`
    }))
    : diff.highlights.map((highlight) => ({
      label: `Line ${highlight.line}`,
      value: "source change"
    }));
  const cues = [];

  if (scale === "Large") {
    cues.push("Review the full preview and affected areas before applying.");
  } else if (scale === "Medium") {
    cues.push("Check changed areas and text fit before applying.");
  } else {
    cues.push("Preview check is likely enough for this small change.");
  }

  if (titleChanged) {
    cues.push("Headline changed; confirm it still matches the deck narrative.");
  }

  if (wordDelta !== null && wordDelta >= 10) {
    cues.push("Candidate adds visible text; check wrapping and slide density.");
  } else if (wordDelta !== null && wordDelta <= -10) {
    cues.push("Candidate removes visible text; check whether key claims remain.");
  }

  if (contentAreas >= 3) {
    cues.push("Several content areas move together; compare the visual hierarchy.");
  }

  if (structuredComparison && structuredComparison.groups.includes("family")) {
    cues.push("Slide family changes can drop incompatible fields; inspect the JSON diff before applying.");
  }

  return {
    contentAreas,
    cues,
    fieldChanges,
    focusItems,
    scale,
    wordDelta
  };
}

function renderVariantDecisionSupport(decisionSupport) {
  const formattedDelta = decisionSupport.wordDelta === null
    ? "n/a"
    : decisionSupport.wordDelta > 0
      ? `+${decisionSupport.wordDelta}`
      : String(decisionSupport.wordDelta);
  const focusItems = decisionSupport.focusItems.slice(0, 5);

  return `
    <section class="compare-decision-panel">
      <div class="compare-decision-head">
        <div>
          <p class="eyebrow">Decision support</p>
          <strong>${escapeHtml(decisionSupport.scale)} candidate change</strong>
        </div>
        <div class="compare-decision-metrics">
          <span><strong>${decisionSupport.fieldChanges}</strong> field${decisionSupport.fieldChanges === 1 ? "" : "s"}</span>
          <span><strong>${decisionSupport.contentAreas}</strong> area${decisionSupport.contentAreas === 1 ? "" : "s"}</span>
          <span><strong>${escapeHtml(formattedDelta)}</strong> words</span>
        </div>
      </div>
      ${focusItems.length ? `
        <div class="compare-decision-focus" aria-label="Review focus">
          ${focusItems.map((item) => `
            <span class="compare-decision-chip">
              <strong>${escapeHtml(item.label)}</strong>
              ${escapeHtml(item.value)}
            </span>
          `).join("")}
        </div>
      ` : ""}
      <div class="compare-decision-cues">
        ${decisionSupport.cues.map((cue) => `<p>${escapeHtml(cue)}</p>`).join("")}
      </div>
    </section>
  `;
}

function clearTransientVariants(slideId) {
  state.transientVariants = state.transientVariants.filter((variant) => variant.slideId !== slideId);
}

function exitVariantReview() {
  if (state.selectedSlideId) {
    clearTransientVariants(state.selectedSlideId);
  }
  state.selectedVariantId = null;
  state.ui.variantReviewOpen = false;
  elements.operationStatus.textContent = "Returned to the slide list. Generate variants to review alternatives again.";
  renderPreviews();
  renderVariants();
}

function openVariantGenerationControls() {
  const details = document.querySelector(".variant-generation-details") as HTMLDetailsElement | null;
  if (details) {
    details.open = true;
  }
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

function openPreviousApiExplorerResource() {
  return apiExplorer.openPrevious();
}

function renderVariantFlow() {
  if (!elements.variantFlow) {
    return;
  }

  const variants = getSlideVariants();
  const selectedVariant = variants.find((variant) => variant.id === state.selectedVariantId) || null;
  const workflow = state.runtime && state.runtime.workflow;
  const workflowRunning = workflow && workflow.status === "running";
  const currentStep = workflowRunning
    ? "generate"
    : !variants.length
      ? "generate"
      : selectedVariant
        ? "preview"
        : "select";
  const order = ["generate", "select", "preview", "apply"];
  const currentIndex = order.indexOf(currentStep);

  Array.from(elements.variantFlow.querySelectorAll("[data-step]")).forEach((step: any) => {
    const index = order.indexOf(step.dataset.step);
    const stepState = index < currentIndex
      ? "done"
      : index === currentIndex
        ? "current"
        : "pending";
    step.dataset.state = stepState;
  });
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
    state.ui.creationStage = normalizeCreationStage(creationDraft.stage || state.ui.creationStage);
  }
  if (nextRunId && nextRunId !== previousRunId) {
    state.ui.creationContentSlidePinned = false;
  }
  if (creationDraft.contentRun && creationDraft.contentRun.status === "running" && !state.ui.creationContentSlidePinned) {
    state.ui.creationContentSlideIndex = getAutoContentRunSlideIndex(creationDraft.contentRun);
  }
  if (isEmptyCreationDraft(creationDraft) && !isEmptyCreationDraft(previousDraft)) {
    resetPresentationCreationControl();
  }

  renderContentRunNavStatus();
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
        state.ui.themeCandidateRefreshIndex = 0;
        state.ui.themeCandidatesGenerated = false;
        renderThemeDrawer();
        elements.operationStatus.textContent = "Created deck. Review the slides, then open Theme when the surface needs tuning.";
      })
      .catch((error) => window.alert(error.message));
  }
}

function getAutoContentRunSlideIndex(run) {
  const slides = run && Array.isArray(run.slides) ? run.slides : [];
  const generatingIndex = slides.findIndex((slide) => slide && slide.status === "generating");
  if (generatingIndex >= 0) {
    return generatingIndex + 1;
  }

  for (let index = slides.length - 1; index >= 0; index -= 1) {
    if (slides[index] && slides[index].status === "complete") {
      return index + 1;
    }
  }

  const failedIndex = slides.findIndex((slide) => slide && slide.status === "failed");
  return failedIndex >= 0 ? failedIndex + 1 : 1;
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

function replacePersistedVariantsForSlide(slideId, variants) {
  state.variants = [
    ...state.variants.filter((variant) => variant.slideId !== slideId),
    ...(Array.isArray(variants) ? variants : [])
  ];
}

function buildSourceDiffRows(currentSource, variantSource) {
  const beforeLines = currentSource.split("\n");
  const afterLines = variantSource.split("\n");
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const rows = [];

  for (let index = 0; index < maxLines; index += 1) {
    const before = beforeLines[index];
    const after = afterLines[index];
    const changed = before !== after;

    rows.push({
      after: after === undefined ? "" : after,
      before: before === undefined ? "" : before,
      changed,
      line: index + 1
    });
  }

  return rows;
}

function serializeJsonValue(value) {
  return JSON.stringify(value, null, 2);
}

function getCurrentComparisonSource() {
  if (state.selectedSlideStructured && state.selectedSlideSpec) {
    return serializeJsonValue(state.selectedSlideSpec);
  }

  return state.selectedSlideSource || "";
}

function getVariantComparisonSource(variant) {
  if (variant && variant.slideSpec) {
    return serializeJsonValue(variant.slideSpec);
  }

  return variant && variant.source ? variant.source : "";
}

function synchronizeCompareSourceScroll() {
  const panes = Array.from(elements.compareSourceGrid.querySelectorAll(".source-lines"));
  if (panes.length !== 2) {
    return;
  }

  let syncing = false;

  const syncPane = (source, target) => {
    source.addEventListener("scroll", () => {
      if (syncing) {
        return;
      }

      syncing = true;
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
      syncing = false;
    });
  };

  syncPane(panes[0], panes[1]);
  syncPane(panes[1], panes[0]);
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

function renderManualDeckEditOptions() {
  const previousInsert = elements.manualSystemAfter.value;
  const previousDelete = elements.manualDeleteSlide.value;
  const selectedSlide = state.slides.find((slide) => slide.id === state.selectedSlideId);
  const slideOptions = state.slides
    .map((slide) => `<option value="${escapeHtml(slide.id)}">${slide.index}. ${escapeHtml(slide.title)}</option>`)
    .join("");

  elements.manualSystemAfter.innerHTML = [
    "<option value=\"\">At end</option>",
    ...state.slides.map((slide) => `<option value="${escapeHtml(slide.id)}">After ${slide.index}. ${escapeHtml(slide.title)}</option>`)
  ].join("");
  elements.manualDeleteSlide.innerHTML = slideOptions;
  elements.deleteSlideButton.disabled = state.slides.length <= 1;

  if (previousInsert && state.slides.some((slide) => slide.id === previousInsert)) {
    elements.manualSystemAfter.value = previousInsert;
  } else {
    elements.manualSystemAfter.value = selectedSlide ? selectedSlide.id : "";
  }

  if (previousDelete && state.slides.some((slide) => slide.id === previousDelete)) {
    elements.manualDeleteSlide.value = previousDelete;
  } else {
    elements.manualDeleteSlide.value = selectedSlide ? selectedSlide.id : (state.slides[0] ? state.slides[0].id : "");
  }
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

function renderSlideFields() {
  const slideContext = state.context.slides[state.selectedSlideId] || {};
  elements.slideTitle.value = slideContext.title || "";
  elements.slideIntent.value = slideContext.intent || "";
  elements.slideMustInclude.value = slideContext.mustInclude || "";
  elements.slideNotes.value = slideContext.notes || "";
  elements.slideLayoutHint.value = slideContext.layoutHint || "";

  if (state.selectedSlideStructured && state.selectedSlideSpec) {
    state.selectedSlideSpecDraftError = null;
    elements.slideSpecEditor.disabled = false;
    elements.saveSlideSpecButton.disabled = false;
    elements.captureVariantButton.disabled = false;
    elements.slideSpecEditor.value = JSON.stringify(state.selectedSlideSpec, null, 2);
    updateSlideSpecHighlight();
    elements.slideSpecStatus.textContent = "Ready. Valid JSON changes preview immediately; save persists without rebuilding.";
    return;
  }

  state.selectedSlideSpecDraftError = null;
  elements.slideSpecEditor.disabled = true;
  elements.saveSlideSpecButton.disabled = true;
  elements.captureVariantButton.disabled = false;
  elements.slideSpecEditor.value = "";
  updateSlideSpecHighlight();
  elements.slideSpecStatus.textContent = state.selectedSlideSpecError
    ? `Structured editing is unavailable for this slide: ${state.selectedSlideSpecError}`
    : "Structured editing is unavailable for this slide.";
}

function getSelectedSlideMaterialId() {
  return state.selectedSlideSpec && state.selectedSlideSpec.media
    ? state.selectedSlideSpec.media.id
    : "";
}

function renderMaterials() {
  if (!elements.materialList) {
    return;
  }

  const materials = Array.isArray(state.materials) ? state.materials : [];
  const selectedMaterialId = getSelectedSlideMaterialId();
  elements.materialDetachButton.disabled = !state.selectedSlideId || !selectedMaterialId;

  if (!materials.length) {
    elements.materialList.innerHTML = "<div class=\"material-empty\"><strong>No materials yet</strong><span>Upload an image to make it available to this presentation.</span></div>";
    renderManualSlideForm();
    return;
  }

  elements.materialList.innerHTML = "";
  materials.forEach((material) => {
    const attached = material.id === selectedMaterialId;
    const item = document.createElement("article");
    item.className = `material-card${attached ? " active" : ""}`;
    item.innerHTML = `
      <img src="${escapeHtml(material.url)}" alt="${escapeHtml(material.alt || material.title || "Material")}">
      <div class="material-card-copy">
        <strong>${escapeHtml(material.title || material.fileName || "Material")}</strong>
        <span>${escapeHtml(material.caption || material.alt || "No caption")}</span>
      </div>
      <button class="secondary" type="button">${attached ? "Attached" : "Attach"}</button>
    `;

    const button = item.querySelector("button");
    button.disabled = !state.selectedSlideId || attached;
    button.addEventListener("click", () => attachMaterialToSlide(material, button).catch((error) => window.alert(error.message)));
    elements.materialList.appendChild(item);
  });

  renderManualSlideForm();
}

function renderLayoutLibrary() {
  if (!elements.layoutLibrarySelect) {
    return;
  }

  const layouts = Array.isArray(state.layouts) ? state.layouts : [];
  const favoriteLayouts = Array.isArray(state.favoriteLayouts) ? state.favoriteLayouts : [];
  const selectedId = elements.layoutLibrarySelect.value;
  const options = [
    ...layouts.map((layout) => ({
      label: `${layout.name || layout.id} (${layout.treatment || "standard"})`,
      value: `deck:${layout.id}`
    })),
    ...favoriteLayouts.map((layout) => ({
      label: `Favorite: ${layout.name || layout.id} (${layout.treatment || "standard"})`,
      value: `favorite:${layout.id}`
    }))
  ];
  elements.layoutLibrarySelect.innerHTML = options.length
    ? options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")
    : "<option value=\"\">No saved layouts</option>";
  elements.layoutLibrarySelect.value = options.some((option) => option.value === selectedId)
    ? selectedId
    : (options[0] ? options[0].value : "");
  elements.layoutLibrarySelect.disabled = !options.length;
  if (elements.applyLayoutButton) {
    elements.applyLayoutButton.disabled = !state.selectedSlideId || !state.selectedSlideSpec || !elements.layoutLibrarySelect.value;
  }
  if (elements.favoriteLayoutButton) {
    elements.favoriteLayoutButton.disabled = !elements.layoutLibrarySelect.value || elements.layoutLibrarySelect.value.startsWith("favorite:");
  }
  if (elements.deleteFavoriteLayoutButton) {
    elements.deleteFavoriteLayoutButton.disabled = !elements.layoutLibrarySelect.value.startsWith("favorite:");
  }
  if (elements.copyLayoutJsonButton) {
    elements.copyLayoutJsonButton.disabled = !elements.layoutLibrarySelect.value;
  }
  if (elements.copyDeckLayoutPackButton) {
    elements.copyDeckLayoutPackButton.disabled = !layouts.length;
  }
  if (elements.copyFavoriteLayoutPackButton) {
    elements.copyFavoriteLayoutPackButton.disabled = !favoriteLayouts.length;
  }
  if (elements.importLayoutDeckButton) {
    elements.importLayoutDeckButton.disabled = !elements.layoutExchangeJson.value.trim();
  }
  if (elements.importLayoutFavoriteButton) {
    elements.importLayoutFavoriteButton.disabled = !elements.layoutExchangeJson.value.trim();
  }
  renderCustomLayoutEditor();
  renderLayoutStudio();
}

function getSelectedLibraryLayout() {
  const selectedValue = elements.layoutLibrarySelect ? elements.layoutLibrarySelect.value || "" : "";
  if (!selectedValue) {
    return null;
  }

  const [scope, layoutId] = selectedValue.split(":");
  const source = scope === "favorite" ? state.favoriteLayouts : state.layouts;
  return (Array.isArray(source) ? source : []).find((layout) => layout && layout.id === layoutId) || null;
}

function getCustomLayoutSupported() {
  return state.selectedSlideSpec && ["content", "cover"].includes(state.selectedSlideSpec.type);
}

function getCustomLayoutSlideType() {
  return state.selectedSlideSpec && state.selectedSlideSpec.type === "cover" ? "cover" : "content";
}

function getSelectedSlideLayoutTreatment() {
  return normalizeLayoutTreatment(state.selectedSlideSpec && state.selectedSlideSpec.layout);
}

function createCustomLayoutSlots(slideType = getCustomLayoutSlideType()) {
  if (slideType === "cover") {
    return [
      { id: "title", maxLines: 3, required: true, role: "title" },
      { id: "summary", maxLines: 3, required: true, role: "summary" },
      { id: "note", maxLines: 3, required: true, role: "caption" },
      { id: "cards", maxLines: 6, required: true, role: "body" }
    ];
  }

  return [
    { id: "title", maxLines: 3, required: true, role: "title" },
    { id: "summary", maxLines: 3, required: true, role: "summary" },
    { id: "signals", maxLines: 6, required: true, role: "signals" },
    { id: "guardrails", maxLines: 5, required: true, role: "guardrails" }
  ];
}

function createCoverLayoutRegions(profile, spacing) {
  if (profile === "lead-sidebar") {
    return [
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 4, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "note-region", row: 6, rowSpan: 2, slot: "note", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "cards-region", row: 1, rowSpan: 7, slot: "cards", spacing }
    ];
  }

  if (profile === "stacked-sequence") {
    return [
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "summary-region", row: 4, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "body", column: 1, columnSpan: 8, id: "cards-region", row: 5, rowSpan: 4, slot: "cards", spacing },
      { align: "stretch", area: "body", column: 9, columnSpan: 4, id: "note-region", row: 5, rowSpan: 4, slot: "note", spacing }
    ];
  }

  if (profile === "lead-support") {
    return [
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "title-region", row: 1, rowSpan: 4, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "summary-region", row: 5, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "support", column: 1, columnSpan: 8, id: "cards-region", row: 6, rowSpan: 3, slot: "cards", spacing },
      { align: "stretch", area: "support", column: 9, columnSpan: 4, id: "note-region", row: 6, rowSpan: 3, slot: "note", spacing }
    ];
  }

  return [
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 4, rowSpan: 2, slot: "summary", spacing },
    { align: "stretch", area: "support", column: 8, columnSpan: 5, id: "cards-region", row: 1, rowSpan: 7, slot: "cards", spacing },
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "note-region", row: 6, rowSpan: 2, slot: "note", spacing }
  ];
}

function createContentLayoutRegions(profile, spacing) {
  if (profile === "lead-sidebar") {
    return [
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "signals-region", row: 1, rowSpan: 4, slot: "signals", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
    ];
  }

  if (profile === "stacked-sequence") {
    return [
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "summary-region", row: 4, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "body", column: 1, columnSpan: 6, id: "signals-region", row: 5, rowSpan: 4, slot: "signals", spacing },
      { align: "stretch", area: "body", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 4, slot: "guardrails", spacing }
    ];
  }

  if (profile === "lead-support") {
    return [
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "summary-region", row: 3, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "support", column: 1, columnSpan: 6, id: "signals-region", row: 5, rowSpan: 3, slot: "signals", spacing },
      { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
    ];
  }

  return [
    { align: "stretch", area: "lead", column: 1, columnSpan: 6, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
    { align: "stretch", area: "lead", column: 1, columnSpan: 6, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
    { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "signals-region", row: 1, rowSpan: 4, slot: "signals", spacing },
    { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
  ];
}

function createCustomLayoutDefinitionFromControls() {
  const spacing = elements.customLayoutSpacing.value || "normal";
  const minFontSize = Number.parseInt(elements.customLayoutMinFont.value, 10);
  const slideType = getCustomLayoutSlideType();
  const slots = createCustomLayoutSlots(slideType);
  const regions = slideType === "cover"
    ? createCoverLayoutRegions(elements.customLayoutProfile.value || "balanced-grid", spacing)
    : createContentLayoutRegions(elements.customLayoutProfile.value || "balanced-grid", spacing);
  return {
    constraints: {
      captionAttached: true,
      maxLines: 6,
      minFontSize: Number.isFinite(minFontSize) ? minFontSize : 18,
      progressClearance: true
    },
    mediaTreatment: {
      fit: "contain",
      focalPoint: "center"
    },
    readingOrder: slots.map((slot) => slot.id),
    regions,
    slots,
    typography: slots.reduce((acc, slot) => {
      acc[slot.id] = slot.role === "title" ? "title" : slot.role === "caption" ? "caption" : "body";
      return acc;
    }, {}),
    type: "slotRegionLayout"
  };
}

function createLayoutStudioDefinitionFromControls() {
  const previousProfile = elements.customLayoutProfile.value;
  const previousSpacing = elements.customLayoutSpacing.value;
  const previousMinFont = elements.customLayoutMinFont.value;
  elements.customLayoutProfile.value = elements.layoutStudioProfile.value || "balanced-grid";
  elements.customLayoutSpacing.value = elements.layoutStudioSpacing.value || "normal";
  elements.customLayoutMinFont.value = elements.layoutStudioMinFont.value || "18";
  const definition = createCustomLayoutDefinitionFromControls();
  elements.customLayoutProfile.value = previousProfile;
  elements.customLayoutSpacing.value = previousSpacing;
  elements.customLayoutMinFont.value = previousMinFont;
  return definition;
}

function getAllLayoutStudioEntries() {
  const deckLayouts = (Array.isArray(state.layouts) ? state.layouts : []).map((layout) => ({
    layout,
    ref: `deck:${layout.id}`,
    source: "Deck"
  }));
  const favoriteLayouts = (Array.isArray(state.favoriteLayouts) ? state.favoriteLayouts : []).map((layout) => ({
    layout,
    ref: `favorite:${layout.id}`,
    source: "Favorite"
  }));
  return [...deckLayouts, ...favoriteLayouts];
}

function getLayoutByStudioRef(ref) {
  return getAllLayoutStudioEntries().find((entry) => entry.ref === ref) || null;
}

function renderLayoutMap(container, definition) {
  if (!container) {
    return;
  }

  const regions = definition && Array.isArray(definition.regions) ? definition.regions : [];
  container.innerHTML = regions.length
    ? regions.map((region) => `
      <div class="layout-studio-region" style="grid-column: ${Number(region.column) || 1} / span ${Number(region.columnSpan) || 1}; grid-row: ${Number(region.row) || 1} / span ${Number(region.rowSpan) || 1};">
        <strong>${escapeHtml(region.slot || "slot")}</strong>
        <span>${escapeHtml(region.area || "body")}</span>
      </div>
    `).join("")
    : "<p class=\"section-note\">No regions yet.</p>";
}

function renderLayoutStudioMap(definition) {
  renderLayoutMap(elements.layoutStudioMap, definition);
}

function renderLayoutStudio() {
  if (!elements.layoutStudioList || !elements.layoutStudioMap) {
    return;
  }

  const entries = getAllLayoutStudioEntries();
  if (state.layoutStudioSelectedRef && !entries.some((entry) => entry.ref === state.layoutStudioSelectedRef)) {
    state.layoutStudioSelectedRef = "";
  }
  const selectedEntry = state.layoutStudioSelectedRef ? getLayoutByStudioRef(state.layoutStudioSelectedRef) : null;
  const activeDefinition = selectedEntry && selectedEntry.layout.definition
    ? selectedEntry.layout.definition
    : createLayoutStudioDefinitionFromControls();

  elements.layoutStudioList.innerHTML = entries.length
    ? entries.map((entry) => `
      <button type="button" class="layout-studio-item${entry.ref === state.layoutStudioSelectedRef ? " active" : ""}" data-layout-studio-ref="${escapeHtml(entry.ref)}">
        <span>${escapeHtml(entry.source)}</span>
        <strong>${escapeHtml(entry.layout.name || entry.layout.id)}</strong>
        <small>${escapeHtml(entry.layout.definition ? entry.layout.definition.type : `${entry.layout.treatment || "standard"} treatment`)}</small>
      </button>
    `).join("")
    : "<p class=\"section-note\">No saved layouts yet. Design one on the right and preview it on a content or cover slide.</p>";

  Array.from(elements.layoutStudioList.querySelectorAll("[data-layout-studio-ref]")).forEach((button: any) => {
    button.addEventListener("click", () => {
      state.layoutStudioSelectedRef = button.dataset.layoutStudioRef || "";
      const entry = getLayoutByStudioRef(state.layoutStudioSelectedRef);
      if (entry && entry.layout.definition && entry.layout.definition.type === "slotRegionLayout") {
        loadLayoutStudioDefinition(entry.layout);
      }
      renderLayoutStudio();
    });
  });

  renderLayoutStudioMap(activeDefinition);
  const supported = getCustomLayoutSupported();
  elements.layoutStudioPreviewButton.disabled = !supported;
  elements.layoutStudioLoadSelectedButton.disabled = !selectedEntry || !selectedEntry.layout.definition;
  elements.layoutStudioOpenSlideButton.disabled = !state.selectedSlideId;
  elements.layoutStudioStatus.textContent = supported
    ? "Ready to preview on the selected slide."
    : "Select a content or cover slide in Slide Studio before previewing.";
}

function loadLayoutStudioDefinition(layout) {
  if (!layout || !layout.definition) {
    return;
  }
  const definition = layout.definition;
  elements.layoutStudioTreatment.value = normalizeLayoutTreatment(layout.treatment);
  const firstSupportRegion = Array.isArray(definition.regions)
    ? definition.regions.find((region) => region && region.area === "sidebar")
    : null;
  elements.layoutStudioProfile.value = firstSupportRegion ? "lead-sidebar" : "balanced-grid";
  elements.layoutStudioMinFont.value = definition.constraints && definition.constraints.minFontSize
    ? String(definition.constraints.minFontSize)
    : "18";
  elements.layoutStudioSpacing.value = definition.regions && definition.regions.some((region) => region.spacing === "tight")
    ? "tight"
    : "normal";
}

function setCustomLayoutJson(definition) {
  if (!elements.customLayoutJson) {
    return;
  }
  elements.customLayoutJson.value = `${JSON.stringify(definition, null, 2)}\n`;
}

function getCustomLayoutDefinitionForPreview() {
  if (elements.customLayoutJson && elements.customLayoutJson.value.trim()) {
    try {
      return JSON.parse(elements.customLayoutJson.value);
    } catch (error) {
      return createCustomLayoutDefinitionFromControls();
    }
  }
  return createCustomLayoutDefinitionFromControls();
}

function normalizeLayoutTreatment(value) {
  const treatment = String(value || "").trim().toLowerCase();
  return treatment === "default" || !treatment ? "standard" : treatment;
}

function getCustomLayoutPreviewSlideSpec(baseSpec = state.selectedSlideSpec, options: any = {}) {
  if (!baseSpec || !["content", "cover"].includes(baseSpec.type)) {
    return null;
  }

  const previewSpec = {
    ...baseSpec,
    layout: normalizeLayoutTreatment(elements.customLayoutTreatment.value || baseSpec.layout)
  };

  if (options.includeLayoutDefinition !== false) {
    previewSpec.layoutDefinition = getCustomLayoutDefinitionForPreview();
  }

  return previewSpec;
}

function shouldRenderCustomLayoutInActivePreview(activeSlide) {
  return Boolean(
    activeSlide
    && state.ui.layoutDrawerOpen
    && state.ui.customLayoutMainPreviewActive
    && getCustomLayoutSupported()
  );
}

function setCustomLayoutPreviewMode(mode) {
  state.ui.customLayoutPreviewMode = mode === "map" ? "map" : "slide";
  renderCustomLayoutEditor();
}

function setManualSlideDetailsOpen(kind) {
  const openSystem = kind === "system" && !elements.manualSystemDetails.open;
  const openDelete = kind === "delete" && !elements.manualDeleteDetails.open;
  elements.manualSystemDetails.open = openSystem;
  elements.manualDeleteDetails.open = openDelete;
  elements.openManualSystemButton.setAttribute("aria-expanded", openSystem ? "true" : "false");
  elements.openManualDeleteButton.setAttribute("aria-expanded", openDelete ? "true" : "false");
  if (openSystem) {
    elements.manualSystemTitle.focus();
  } else if (openDelete) {
    elements.manualDeleteSlide.focus();
  }
}

function refreshCustomLayoutDraftFromControls() {
  if (!getCustomLayoutSupported()) {
    state.ui.customLayoutDefinitionPreviewActive = false;
    state.ui.customLayoutMainPreviewActive = false;
    renderCustomLayoutEditor();
    renderPreviews();
    return;
  }

  setCustomLayoutJson(createCustomLayoutDefinitionFromControls());
  state.ui.customLayoutDraftSlideId = state.selectedSlideId || "";
  state.ui.customLayoutDraftSlideType = getCustomLayoutSlideType();
  state.ui.customLayoutDefinitionPreviewActive = true;
  state.ui.customLayoutMainPreviewActive = true;
  elements.customLayoutStatus.textContent = "Live preview";
  renderCustomLayoutEditor();
  renderPreviews();
}

function refreshCustomLayoutTreatmentFromControl() {
  if (!getCustomLayoutSupported()) {
    state.ui.customLayoutDefinitionPreviewActive = false;
    state.ui.customLayoutMainPreviewActive = false;
    renderCustomLayoutEditor();
    renderPreviews();
    return;
  }

  state.ui.customLayoutDraftSlideId = state.selectedSlideId || "";
  state.ui.customLayoutDraftSlideType = getCustomLayoutSlideType();
  state.ui.customLayoutMainPreviewActive = true;
  elements.customLayoutStatus.textContent = "Live preview";
  renderCustomLayoutEditor();
  renderPreviews();
}

function loadCustomLayoutDraftFromSelection() {
  if (!getCustomLayoutSupported()) {
    return;
  }

  const selectedLayout = getSelectedLibraryLayout();
  if (selectedLayout && selectedLayout.definition && selectedLayout.definition.type === "slotRegionLayout") {
    setCustomLayoutJson(selectedLayout.definition);
    elements.customLayoutTreatment.value = normalizeLayoutTreatment(selectedLayout.treatment);
  } else {
    setCustomLayoutJson(createCustomLayoutDefinitionFromControls());
  }
  state.ui.customLayoutDraftSlideId = state.selectedSlideId || "";
  state.ui.customLayoutDraftSlideType = getCustomLayoutSlideType();
  state.ui.customLayoutDefinitionPreviewActive = true;
  state.ui.customLayoutMainPreviewActive = true;
  elements.customLayoutStatus.textContent = "Live preview";
  renderCustomLayoutEditor();
  renderPreviews();
}

function renderCustomLayoutEditor() {
  if (!elements.customLayoutPreviewButton || !elements.customLayoutJson) {
    return;
  }

  const supported = getCustomLayoutSupported();
  [
    elements.customLayoutDiscardButton,
    elements.customLayoutJson,
    elements.customLayoutLoadButton,
    elements.customLayoutMinFont,
    elements.customLayoutMultiPreview,
    elements.customLayoutPreviewButton,
    elements.customLayoutProfile,
    elements.customLayoutSpacing,
    elements.customLayoutTreatment
  ].filter(Boolean).forEach((element: any) => {
    element.disabled = !supported;
  });
  if (!supported) {
    elements.customLayoutStatus.textContent = "Content and cover slides only";
    if (elements.customLayoutLivePreview) {
      elements.customLayoutLivePreview.innerHTML = "<p class=\"section-note\">Select a content or cover slide to preview a custom layout.</p>";
    }
    renderLayoutMap(elements.customLayoutLiveMap, null);
    return;
  }
  const slideType = getCustomLayoutSlideType();
  const slideId = state.selectedSlideId || "";
  if (
    !elements.customLayoutJson.value.trim()
    || state.ui.customLayoutDraftSlideType !== slideType
    || state.ui.customLayoutDraftSlideId !== slideId
  ) {
    elements.customLayoutTreatment.value = getSelectedSlideLayoutTreatment();
    setCustomLayoutJson(createCustomLayoutDefinitionFromControls());
    state.ui.customLayoutDraftSlideType = slideType;
    state.ui.customLayoutDraftSlideId = slideId;
  }
  const previewMode = state.ui.customLayoutPreviewMode === "map" ? "map" : "slide";
  if (elements.customLayoutPreviewSlideTab && elements.customLayoutPreviewMapTab) {
    elements.customLayoutPreviewSlideTab.classList.toggle("active", previewMode === "slide");
    elements.customLayoutPreviewSlideTab.classList.toggle("secondary", previewMode !== "slide");
    elements.customLayoutPreviewSlideTab.setAttribute("aria-selected", previewMode === "slide" ? "true" : "false");
    elements.customLayoutPreviewMapTab.classList.toggle("active", previewMode === "map");
    elements.customLayoutPreviewMapTab.classList.toggle("secondary", previewMode !== "map");
    elements.customLayoutPreviewMapTab.setAttribute("aria-selected", previewMode === "map" ? "true" : "false");
  }
  if (elements.customLayoutLivePreview) {
    elements.customLayoutLivePreview.hidden = previewMode !== "slide";
    const previewSpec = getCustomLayoutPreviewSlideSpec();
    if (previewSpec) {
      renderDomSlide(elements.customLayoutLivePreview, previewSpec, {
        index: state.selectedSlideIndex,
        totalSlides: state.slides.length
      });
    }
  }
  if (elements.customLayoutLiveMap) {
    elements.customLayoutLiveMap.hidden = previewMode !== "map";
    renderLayoutMap(elements.customLayoutLiveMap, getCustomLayoutDefinitionForPreview());
  }
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
    resetPresentationSelection();
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
      applyCreationFields(state.creationDraft.fields);
      state.ui.creationStage = normalizeCreationStage(state.creationDraft.stage || "content");
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
  const liveRun = getLiveStudioContentRun();
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
  const liveCustomLayoutSpec = shouldRenderCustomLayoutInActivePreview(activeSlide)
    ? getCustomLayoutPreviewSlideSpec(activeSpec, {
      includeLayoutDefinition: state.ui.customLayoutDefinitionPreviewActive
    })
    : null;
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
      <span>${escapeHtml(liveStatus ? `${getContentRunStatusLabel(liveStatus)} generation` : slide.fileName || `slide ${slide.index}`)}</span>
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

function getCreationFields() {
  const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);

  return {
    audience: elements.presentationAudience.value.trim(),
    constraints: elements.presentationConstraints.value.trim(),
    imageSearch: {
      count: 3,
      provider: elements.presentationImageSearchProvider.value,
      query: elements.presentationImageSearchQuery.value.trim(),
      restrictions: elements.presentationImageSearchRestrictions.value.trim()
    },
    objective: elements.presentationObjective.value.trim(),
    presentationSourceText: (elements.presentationSourceText.value || elements.presentationOutlineSourceText.value || "").trim(),
    sourcingStyle: elements.presentationSourcingStyle.value,
    targetSlideCount: Number.isFinite(targetSlideCount) ? targetSlideCount : null,
    themeBrief: elements.presentationThemeBrief.value.trim(),
    title: elements.presentationTitle.value.trim(),
    tone: elements.presentationTone.value.trim(),
    visualTheme: {
      accent: elements.presentationThemeAccent.value,
      bg: elements.presentationThemeBg.value,
      fontFamily: elements.presentationFontFamily.value,
      panel: elements.presentationThemePanel.value,
      primary: elements.presentationThemePrimary.value,
      progressFill: elements.presentationThemeSecondary.value,
      progressTrack: elements.presentationThemeBg.value,
      secondary: elements.presentationThemeSecondary.value
    }
  };
}

function getCreationTheme() {
  return getCreationFields().visualTheme;
}

function getCreationThemeVariants() {
  const current = getDeckVisualThemeFromFields();
  const baseFont = current.fontFamily || "avenir";
  const refreshIndex = Number.isFinite(Number(state.ui.themeCandidateRefreshIndex))
    ? Number(state.ui.themeCandidateRefreshIndex)
    : 0;
  const currentVariant = {
    id: "current",
    label: "Current",
    note: "Use the selected controls.",
    theme: current
  };

  if (!state.ui.themeCandidatesGenerated) {
    return [currentVariant];
  }

  const candidateSets = [
    [
      {
      id: "clean",
      label: "Clean",
      note: "Bright, direct, and neutral.",
      theme: {
        accent: "#d97a2b",
        bg: "#f7fafc",
        fontFamily: baseFont,
        light: "#dbe8f2",
        muted: "#526273",
        panel: "#ffffff",
        primary: "#102033",
        progressFill: "#2f6f9f",
        progressTrack: "#dbe8f2",
        secondary: "#2f6f9f",
        surface: "#ffffff"
      }
      },
      {
      id: "editorial",
      label: "Editorial",
      note: "Warmer and more authored.",
      theme: {
        accent: "#c64f2d",
        bg: "#fbf4ec",
        fontFamily: "editorial",
        light: "#f1d9c4",
        muted: "#655a66",
        panel: "#fffaf5",
        primary: "#2f2530",
        progressFill: "#c64f2d",
        progressTrack: "#f1d9c4",
        secondary: "#8f4e2b",
        surface: "#ffffff"
      }
      },
      {
      id: "dark",
      label: "Dark",
      note: "High contrast on black.",
      theme: {
        accent: "#09b5c4",
        bg: "#000000",
        fontFamily: baseFont,
        light: "#183b40",
        muted: "#dcefed",
        panel: "#101820",
        primary: "#f7fcfb",
        progressFill: "#b6fff8",
        progressTrack: "#183b40",
        secondary: "#b6fff8",
        surface: "#f7fcfb"
      }
      },
      {
      id: "workshop",
      label: "Workshop",
      note: "Practical and structured.",
      theme: {
        accent: "#b05f2a",
        bg: "#ffffff",
        fontFamily: "workshop",
        light: "#dcefed",
        muted: "#346065",
        panel: "#f7fcfb",
        primary: "#183b40",
        progressFill: "#09b5c4",
        progressTrack: "#dcefed",
        secondary: "#09b5c4",
        surface: "#ffffff"
      }
      }
    ],
    [
      {
        id: "calm",
        label: "Calm",
        note: "Quiet blue-gray focus.",
        theme: {
          accent: "#7a5cce",
          bg: "#f4f7fb",
          fontFamily: baseFont,
          light: "#dbe5f2",
          muted: "#5a6677",
          panel: "#ffffff",
          primary: "#172232",
          progressFill: "#466fa8",
          progressTrack: "#dbe5f2",
          secondary: "#466fa8",
          surface: "#ffffff"
        }
      },
      {
        id: "field",
        label: "Field",
        note: "Green, grounded, and open.",
        theme: {
          accent: "#b86b22",
          bg: "#f3f8f4",
          fontFamily: "workshop",
          light: "#d9eadb",
          muted: "#536b59",
          panel: "#fbfdfb",
          primary: "#183322",
          progressFill: "#2d7a4b",
          progressTrack: "#d9eadb",
          secondary: "#2d7a4b",
          surface: "#ffffff"
        }
      },
      {
        id: "ink",
        label: "Ink",
        note: "Dense contrast with warm signal.",
        theme: {
          accent: "#ffb454",
          bg: "#111315",
          fontFamily: baseFont,
          light: "#33383d",
          muted: "#d5dde5",
          panel: "#1b1f23",
          primary: "#f7fafc",
          progressFill: "#ffb454",
          progressTrack: "#33383d",
          secondary: "#9bd4ff",
          surface: "#f7fafc"
        }
      },
      {
        id: "studio",
        label: "Studio",
        note: "Crisp white with graphic accents.",
        theme: {
          accent: "#e0475b",
          bg: "#ffffff",
          fontFamily: "editorial",
          light: "#e8eef5",
          muted: "#5e6570",
          panel: "#f7f9fb",
          primary: "#111820",
          progressFill: "#1f7a8c",
          progressTrack: "#e8eef5",
          secondary: "#1f7a8c",
          surface: "#ffffff"
        }
      }
    ],
    [
      {
        id: "signal",
        label: "Signal",
        note: "Sharp contrast with cyan energy.",
        theme: {
          accent: "#00a6c8",
          bg: "#f6f8fb",
          fontFamily: baseFont,
          light: "#d8e7ef",
          muted: "#50606a",
          panel: "#ffffff",
          primary: "#111c24",
          progressFill: "#00a6c8",
          progressTrack: "#d8e7ef",
          secondary: "#325f74",
          surface: "#ffffff"
        }
      },
      {
        id: "paper",
        label: "Paper",
        note: "Soft editorial warmth.",
        theme: {
          accent: "#a8552d",
          bg: "#f9f5ef",
          fontFamily: "editorial",
          light: "#eadbc9",
          muted: "#665f59",
          panel: "#fffdf9",
          primary: "#2b2521",
          progressFill: "#a8552d",
          progressTrack: "#eadbc9",
          secondary: "#70563c",
          surface: "#ffffff"
        }
      },
      {
        id: "night",
        label: "Night",
        note: "Dark, blue, and restrained.",
        theme: {
          accent: "#7dd3fc",
          bg: "#050914",
          fontFamily: baseFont,
          light: "#1c2940",
          muted: "#d7e3f5",
          panel: "#101827",
          primary: "#f8fbff",
          progressFill: "#7dd3fc",
          progressTrack: "#1c2940",
          secondary: "#b7c7ff",
          surface: "#f8fbff"
        }
      },
      {
        id: "board",
        label: "Board",
        note: "Practical with high readability.",
        theme: {
          accent: "#d58a1f",
          bg: "#f7faf8",
          fontFamily: "workshop",
          light: "#dbe9df",
          muted: "#4f6257",
          panel: "#ffffff",
          primary: "#16241c",
          progressFill: "#38775b",
          progressTrack: "#dbe9df",
          secondary: "#38775b",
          surface: "#ffffff"
        }
      }
    ]
  ];

  return [
    currentVariant,
    ...candidateSets[((refreshIndex % candidateSets.length) + candidateSets.length) % candidateSets.length]
  ];
}

function applyCreationTheme(theme) {
  applyDeckThemeFields(theme || {});
  renderCreationThemeStage();
}

function getSelectedCreationThemeVariant() {
  const variants = getCreationThemeVariants();
  return variants.find((variant) => variant.id === state.ui.creationThemeVariantId) || variants[0];
}

function isWorkflowRunning() {
  const workflow = state.runtime && state.runtime.workflow;
  return Boolean(workflow && workflow.status === "running");
}

function getCreationInputElements() {
  return [
    elements.presentationTitle,
    elements.presentationAudience,
    elements.presentationTone,
    elements.presentationTargetSlides,
    elements.presentationObjective,
    elements.presentationConstraints,
    elements.presentationSourcingStyle,
    elements.presentationThemeBrief,
    elements.presentationSourceText,
    elements.presentationOutlineSourceText,
    elements.presentationMaterialFile,
    elements.presentationImageSearchQuery,
    elements.presentationImageSearchProvider,
    elements.presentationImageSearchRestrictions,
    elements.presentationSavedTheme,
    elements.presentationFontFamily,
    elements.presentationThemePrimary,
    elements.presentationThemeSecondary,
    elements.presentationThemeAccent,
    elements.presentationThemeBg,
    elements.presentationThemePanel,
    elements.presentationThemeName
  ].filter(Boolean);
}

function isOutlineRelevantInput(element) {
  return [
    elements.presentationTitle,
    elements.presentationAudience,
    elements.presentationTone,
    elements.presentationTargetSlides,
    elements.presentationObjective,
    elements.presentationConstraints,
    elements.presentationSourcingStyle,
    elements.presentationSourceText,
    elements.presentationOutlineSourceText,
    elements.presentationImageSearchQuery,
    elements.presentationImageSearchProvider,
    elements.presentationImageSearchRestrictions
  ].includes(element);
}

function applyCreationFields(fields: any = {}) {
  elements.presentationTitle.value = fields.title || "";
  elements.presentationAudience.value = fields.audience || "";
  elements.presentationTone.value = fields.tone || "";
  elements.presentationTargetSlides.value = fields.targetSlideCount ? String(fields.targetSlideCount) : "";
  elements.presentationObjective.value = fields.objective || "";
  elements.presentationConstraints.value = fields.constraints || "";
  elements.presentationSourcingStyle.value = fields.sourcingStyle || "";
  elements.presentationThemeBrief.value = fields.themeBrief || "";
  elements.presentationSourceText.value = fields.presentationSourceText || "";
  elements.presentationOutlineSourceText.value = fields.presentationSourceText || "";
  elements.presentationImageSearchQuery.value = fields.imageSearch && fields.imageSearch.query || "";
  elements.presentationImageSearchProvider.value = fields.imageSearch && fields.imageSearch.provider || "openverse";
  elements.presentationImageSearchRestrictions.value = fields.imageSearch && fields.imageSearch.restrictions || "";

  const theme = fields.visualTheme || {};
  elements.presentationFontFamily.value = theme.fontFamily || "avenir";
  elements.presentationThemePrimary.value = theme.primary || "#183153";
  elements.presentationThemeSecondary.value = theme.secondary || "#275d8c";
  elements.presentationThemeAccent.value = theme.accent || "#f28f3b";
  elements.presentationThemeBg.value = theme.bg || "#f5f8fc";
  elements.presentationThemePanel.value = theme.panel || "#f8fbfe";
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
  applyCreationFields({});
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
  const selectedId = elements.presentationSavedTheme.value;
  elements.presentationSavedTheme.innerHTML = "<option value=\"\">Current draft colors</option>";
  state.savedThemes.forEach((theme) => {
    const presentationOption = document.createElement("option");
    presentationOption.value = theme.id;
    presentationOption.textContent = theme.name;
    elements.presentationSavedTheme.appendChild(presentationOption);
  });
  elements.presentationSavedTheme.value = state.savedThemes.some((theme) => theme.id === selectedId) ? selectedId : "";
  renderThemeFavorites();
}

function renderThemeFavorites() {
  if (!elements.themeFavoriteList) {
    return;
  }

  if (!state.savedThemes.length) {
    elements.themeFavoriteList.innerHTML = "<p>No favorite themes yet.</p>";
    return;
  }

  elements.themeFavoriteList.innerHTML = state.savedThemes.map((theme) => {
    const visualTheme = theme.theme || {};
    return `
      <button class="theme-favorite-card" type="button" data-theme-favorite-id="${escapeHtml(theme.id)}">
        <span class="creation-theme-swatch" style="--swatch-bg:${escapeHtml(visualTheme.bg || "#ffffff")};--swatch-primary:${escapeHtml(visualTheme.primary || "#183153")};--swatch-accent:${escapeHtml(visualTheme.accent || "#f28f3b")}"></span>
        <strong>${escapeHtml(theme.name || "Saved theme")}</strong>
      </button>
    `;
  }).join("");
}

function renderManualSlideForm() {
  const slideType = elements.manualSystemType ? elements.manualSystemType.value : "content";
  const isDivider = slideType === "divider";
  const isQuote = slideType === "quote";
  const isPhoto = slideType === "photo";
  const isPhotoGrid = slideType === "photoGrid";
  const summaryField = document.querySelector(".manual-system-summary-field");
  const materialField = document.querySelector(".manual-system-material-field");

  if (elements.manualSystemTitle) {
    elements.manualSystemTitle.placeholder = isDivider
      ? "Section title"
      : isQuote
        ? "Quote slide title"
        : isPhoto
          ? "Photo slide title"
          : isPhotoGrid
            ? "Photo grid title"
      : "System name";
  }

  if (elements.manualSystemSummary) {
    elements.manualSystemSummary.placeholder = isDivider
      ? "Optional notes for yourself; divider slides stay title-only."
      : isQuote
        ? "Paste the quote or pull quote text. Attribution and source can be added in JSON."
        : isPhoto
          ? "Optional caption shown with the photo."
          : isPhotoGrid
            ? "Optional caption shown above the image grid."
      : "What boundary, signal, and guardrails should this system explain?";
    elements.manualSystemSummary.disabled = isDivider;
  }

  if (summaryField instanceof HTMLElement) {
    summaryField.hidden = isDivider;
    const label = summaryField.querySelector("span");
    if (label) {
      label.textContent = isQuote ? "Quote" : (isPhoto || isPhotoGrid) ? "Caption" : "Summary";
    }
  }

  if (materialField instanceof HTMLElement) {
    materialField.hidden = !(isPhoto || isPhotoGrid);
  }

  if (elements.manualSystemMaterial) {
    const selectedIds = Array.from(elements.manualSystemMaterial.selectedOptions || []).map((option: any) => option.value);
    const materials = Array.isArray(state.materials) ? state.materials : [];
    elements.manualSystemMaterial.innerHTML = materials.length
      ? materials.map((material) => `<option value="${escapeHtml(material.id)}">${escapeHtml(material.title || material.fileName || material.id)}</option>`).join("")
      : "<option value=\"\">Upload a material first</option>";
    const nextSelectedIds = selectedIds.filter((id) => materials.some((material) => material.id === id));
    if (!nextSelectedIds.length && materials.length) {
      nextSelectedIds.push(...materials.slice(0, isPhotoGrid ? 2 : 1).map((material) => material.id));
    }
    if (!isPhotoGrid) {
      nextSelectedIds.splice(1);
    }
    Array.from(elements.manualSystemMaterial.options).forEach((option: any) => {
      option.selected = nextSelectedIds.includes(option.value);
    });
    elements.manualSystemMaterial.disabled = !(isPhoto || isPhotoGrid) || !materials.length;
    elements.manualSystemMaterial.size = isPhotoGrid ? Math.min(4, Math.max(2, materials.length)) : 1;
    if ((isPhoto || isPhotoGrid) && materials.length) {
      const selectedMaterial = materials.find((material) => material.id === nextSelectedIds[0]) || materials[0];
      if (elements.manualSystemTitle && !elements.manualSystemTitle.value.trim()) {
        elements.manualSystemTitle.placeholder = selectedMaterial.title || (isPhotoGrid ? "Photo grid title" : "Photo slide title");
      }
    }
  }

  if (elements.createSystemSlideButton) {
    elements.createSystemSlideButton.textContent = isDivider
      ? "Create divider"
      : isQuote
        ? "Create quote slide"
        : isPhoto
          ? "Create photo slide"
          : isPhotoGrid
            ? "Create photo grid"
      : "Create system slide";
  }
}

function applySavedTheme(themeId) {
  const savedTheme = state.savedThemes.find((theme) => theme.id === themeId);
  if (!savedTheme || !savedTheme.theme) {
    return;
  }

  applyCreationFields({
    ...getCreationFields(),
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

function hashTextToIndex(text, length) {
  if (!length) {
    return 0;
  }

  let hash = 0;
  String(text || "").split("").forEach((character) => {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  });

  return Math.abs(hash) % length;
}

function generateThemeFromBriefText(brief) {
  const source = String(brief || "").trim().toLowerCase();
  const includesAny = (words) => words.some((word) => source.includes(word));
  const current = getDeckVisualThemeFromFields();
  const baseFont = current.fontFamily || "avenir";
  const themes = [
    {
      match: ["dark", "black", "night", "high contrast", "cyber"],
      theme: {
        accent: "#19c2d1",
        bg: "#050607",
        fontFamily: baseFont,
        light: "#1a3438",
        muted: "#d8edf0",
        panel: "#11181c",
        primary: "#f7fcfd",
        progressFill: "#19c2d1",
        progressTrack: "#1a3438",
        secondary: "#9ef3f8",
        surface: "#f7fcfd"
      }
    },
    {
      match: ["warm", "editorial", "human", "crafted", "premium", "story"],
      theme: {
        accent: "#b8582f",
        bg: "#fbf3ea",
        fontFamily: "editorial",
        light: "#efd8c3",
        muted: "#675a51",
        panel: "#fffaf5",
        primary: "#2d241e",
        progressFill: "#b8582f",
        progressTrack: "#efd8c3",
        secondary: "#8d5a37",
        surface: "#ffffff"
      }
    },
    {
      match: ["calm", "quiet", "minimal", "clean", "focused", "professional"],
      theme: {
        accent: "#6b5edb",
        bg: "#f6f8fb",
        fontFamily: baseFont,
        light: "#dce5f1",
        muted: "#5d6878",
        panel: "#ffffff",
        primary: "#142033",
        progressFill: "#496f9f",
        progressTrack: "#dce5f1",
        secondary: "#496f9f",
        surface: "#ffffff"
      }
    },
    {
      match: ["green", "nature", "organic", "sustainable", "field", "growth"],
      theme: {
        accent: "#b86b25",
        bg: "#f4f8f3",
        fontFamily: "workshop",
        light: "#dcebd8",
        muted: "#536a55",
        panel: "#fbfdf9",
        primary: "#17331f",
        progressFill: "#347a49",
        progressTrack: "#dcebd8",
        secondary: "#347a49",
        surface: "#ffffff"
      }
    },
    {
      match: ["bold", "energy", "startup", "launch", "bright", "playful"],
      theme: {
        accent: "#ef5a35",
        bg: "#fff8f2",
        fontFamily: baseFont,
        light: "#f6dccd",
        muted: "#665d66",
        panel: "#ffffff",
        primary: "#201a24",
        progressFill: "#ef5a35",
        progressTrack: "#f6dccd",
        secondary: "#246bb2",
        surface: "#ffffff"
      }
    }
  ];
  const fallbackThemes = themes.map((entry) => entry.theme);
  const matched = themes.find((entry) => includesAny(entry.match));
  return {
    ...(matched ? matched.theme : fallbackThemes[hashTextToIndex(source || elements.deckTitle.value, fallbackThemes.length)])
  };
}

async function generateThemeFromBrief() {
  const brief = getDeckThemeBriefValue().trim() || elements.deckTitle.value.trim() || "clean professional theme";
  const done = setBusy(elements.generateThemeFromBriefButton, "Generating...");
  try {
    let generated: any = null;
    try {
      generated = await request("/api/themes/generate", {
        body: JSON.stringify({
          audience: elements.deckAudience.value,
          currentTheme: getDeckVisualThemeFromFields(),
          themeBrief: brief,
          title: elements.deckTitle.value,
          tone: elements.deckTone.value
        }),
        method: "POST"
      });
    } catch (error) {
      generated = {
        name: "Generated theme",
        source: "fallback",
        theme: generateThemeFromBriefText(brief)
      };
    }

    applyDeckThemeFields(generated && generated.theme ? generated.theme : generateThemeFromBriefText(brief));
    state.ui.creationThemeVariantId = "current";
    renderCreationThemeStage();
    await persistSelectedThemeToDeck();
    elements.operationStatus.textContent = generated && generated.source === "llm"
      ? `Generated and applied "${generated.name || "theme"}" from the brief.`
      : "Generated and applied a fallback theme from the brief.";
  } finally {
    done();
  }
}

function applySavedThemeToDeck(themeId) {
  const savedTheme = state.savedThemes.find((theme) => theme.id === themeId);
  if (!savedTheme || !savedTheme.theme) {
    return;
  }

  applyDeckThemeFields(savedTheme.theme);
  state.ui.creationThemeVariantId = "current";
  renderCreationThemeStage();
}

function setCreationStage(stage) {
  state.ui.creationStage = normalizeCreationStage(stage);
  renderCreationDraft();
}

function normalizeCreationStage(stage) {
  if (stage === "sources") {
    return "structure";
  }

  return ["brief", "structure", "content"].includes(stage) ? stage : "brief";
}

function getCreationStageAccess(stage, draft, context: any = {}) {
  const hasOutline = context.hasOutline === true;
  const outlineDirty = context.outlineDirty === true;
  const approved = context.approved === true;

  if (stage === "brief") {
    return {
      enabled: true,
      state: hasOutline && !outlineDirty ? "complete" : "active"
    };
  }

  if (stage === "structure") {
    return {
      enabled: hasOutline,
      state: !hasOutline ? "locked" : approved && !outlineDirty ? "complete" : "active"
    };
  }

  if (stage === "content") {
    return {
      enabled: approved && hasOutline && !outlineDirty,
      state: approved && hasOutline && !outlineDirty ? "available" : "locked"
    };
  }

  return {
    enabled: false,
    state: "locked"
  };
}

function buildEditableDeckPlanOutline(slides) {
  return slides
    .map((slide, index) => {
      const title = slide.title || `Slide ${index + 1}`;
      const message = slide.keyMessage || slide.intent || "";
      return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
    })
    .join("\n");
}

function cloneDeckPlan(deckPlan) {
  if (!deckPlan || typeof deckPlan !== "object") {
    return null;
  }

  return {
    ...deckPlan,
    slides: Array.isArray(deckPlan.slides)
      ? deckPlan.slides.map((slide) => ({ ...slide }))
      : []
  };
}

function getOutlineLocks() {
  const locks = state.creationDraft && state.creationDraft.outlineLocks && typeof state.creationDraft.outlineLocks === "object"
    ? state.creationDraft.outlineLocks
    : {};
  return Object.fromEntries(Object.entries(locks).filter(([key, value]) => /^\d+$/.test(key) && value === true));
}

function isOutlineSlideLocked(index) {
  return getOutlineLocks()[String(index)] === true;
}

function setOutlineSlideLocked(index, locked) {
  const locks = getOutlineLocks();
  if (locked) {
    locks[String(index)] = true;
  } else {
    delete locks[String(index)];
  }

  state.creationDraft = {
    ...(state.creationDraft || {}),
    outlineLocks: locks
  };
  return locks;
}

function countUnlockedOutlineSlides(deckPlan = null) {
  const plan = deckPlan || state.creationDraft && state.creationDraft.deckPlan;
  const slides = plan && Array.isArray(plan.slides) ? plan.slides : [];
  const locks = getOutlineLocks();
  return slides.filter((_slide, index) => locks[String(index)] !== true).length;
}

function readOutlineEditorValue(selector, fallback = "") {
  const element: any = document.querySelector(selector);
  const value = element && typeof element.value === "string" ? element.value.trim() : "";
  return value || fallback || "";
}

function getEditableDeckPlan() {
  const currentPlan = state.creationDraft && state.creationDraft.deckPlan;
  const deckPlan = cloneDeckPlan(currentPlan);
  if (!deckPlan || !deckPlan.slides.length) {
    return currentPlan || null;
  }

  deckPlan.thesis = readOutlineEditorValue("[data-outline-field=\"thesis\"]", deckPlan.thesis);
  deckPlan.narrativeArc = readOutlineEditorValue("[data-outline-field=\"narrativeArc\"]", deckPlan.narrativeArc);
  deckPlan.slides = deckPlan.slides.map((slide, index) => {
    const title = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="title"]`, slide.title || `Slide ${index + 1}`);
    const intent = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="intent"]`, slide.intent || title);
    const keyMessage = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="keyMessage"]`, slide.keyMessage || intent);
    const sourceNeed = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="sourceNeed"]`, slide.sourceNeed || "Use supplied context when relevant.");
    const sourceNotes = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="sourceNotes"]`, slide.sourceNotes || slide.sourceText || "");
    const visualNeed = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="visualNeed"]`, slide.visualNeed || "Use fitting supplied imagery when relevant.");

    return {
      ...slide,
      intent,
      keyMessage,
      sourceNeed,
      sourceNotes,
      title,
      visualNeed
    };
  });
  deckPlan.outline = buildEditableDeckPlanOutline(deckPlan.slides);
  return deckPlan;
}

function formatSourceOutlineText(slide) {
  const sourceNotes = slide && (slide.sourceNotes || slide.sourceText);
  if (sourceNotes) {
    return sourceNotes;
  }

  return slide && slide.sourceNeed || "No source guidance yet.";
}

function renderQuickSourceOutline(deckPlan = null) {
  const plan = deckPlan || state.creationDraft && state.creationDraft.deckPlan;
  const slides = plan && Array.isArray(plan.slides) ? plan.slides : [];
  if (!elements.presentationSourceOutline) {
    return;
  }

  elements.presentationSourceOutline.innerHTML = slides.length
    ? `
      <strong>Quick source outline</strong>
      <div class="creation-source-outline-list">
        ${slides.map((slide, index) => `
          <article class="creation-source-outline-item">
            <span>${index + 1}</span>
            <div>
              <b>${escapeHtml(slide.title || `Slide ${index + 1}`)}</b>
              <small>${escapeHtml(formatSourceOutlineText(slide))}</small>
            </div>
          </article>
        `).join("")}
      </div>
    `
    : "<strong>Quick source outline</strong><p>No outline source guidance yet.</p>";
}

function markOutlineEditedLocally() {
  const deckPlan = getEditableDeckPlan();
  if (!deckPlan || !state.creationDraft) {
    return;
  }

  state.creationDraft = {
    ...state.creationDraft,
    approvedOutline: false,
    deckPlan,
    outlineDirty: false
  };
  elements.createPresentationButton.disabled = true;
  elements.presentationCreationStatus.textContent = "Outline changed. Approve the outline before creating slides.";
  renderQuickSourceOutline(deckPlan);
}

async function saveEditableOutlineDraft(options: any = {}) {
  const deckPlan = getEditableDeckPlan();
  if (!deckPlan || !state.creationDraft || isWorkflowRunning()) {
    return null;
  }

  state.creationDraft = {
    ...state.creationDraft,
    approvedOutline: false,
    deckPlan,
    outlineDirty: false
  };

  const payload = await request("/api/presentations/draft", {
    body: JSON.stringify({
      approvedOutline: false,
      deckPlan,
      fields: getCreationFields(),
      outlineLocks: getOutlineLocks(),
      outlineDirty: false,
      retrieval: state.creationDraft.retrieval,
      stage: options.stage || state.ui.creationStage || "structure"
    }),
    method: "POST"
  });
  state.creationDraft = payload.creationDraft || state.creationDraft;
  state.savedThemes = payload.savedThemes || state.savedThemes;
  renderSavedThemes();
  if (options.render !== false) {
    renderCreationDraft();
  }
  return payload;
}

function renderCreationOutline(draft) {
  const deckPlan = draft && draft.deckPlan;
  const slides = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
  const workflowRunning = isWorkflowRunning();
  const outlineLocks = draft && draft.outlineLocks && typeof draft.outlineLocks === "object" ? draft.outlineLocks : {};
  elements.presentationOutlineTitle.value = deckPlan && deckPlan.thesis ? deckPlan.thesis : "";
  elements.presentationOutlineTitle.dataset.outlineField = "thesis";
  elements.presentationOutlineTitle.disabled = workflowRunning || !slides.length;
  elements.presentationOutlineSummary.value = deckPlan && deckPlan.narrativeArc ? deckPlan.narrativeArc : "";
  elements.presentationOutlineSummary.dataset.outlineField = "narrativeArc";
  elements.presentationOutlineSummary.disabled = workflowRunning || !slides.length;
  elements.presentationOutlineList.innerHTML = slides.length
    ? slides.map((slide, index) => `
        <article class="creation-outline-item${outlineLocks[String(index)] === true ? " creation-outline-item-locked" : ""}">
          <div class="creation-outline-item-rail">
            <span>${index + 1}</span>
            <button
              class="outline-lock-button"
              type="button"
              data-outline-lock-slide-index="${index}"
              aria-pressed="${outlineLocks[String(index)] === true ? "true" : "false"}"
              aria-label="${outlineLocks[String(index)] === true ? "Unlock slide" : "Lock slide"}"
              title="${outlineLocks[String(index)] === true ? "Unlock slide" : "Lock slide"}"
              ${workflowRunning ? " disabled" : ""}
            ><span class="outline-lock-icon" aria-hidden="true"></span></button>
          </div>
          <div class="creation-outline-slide-fields">
            <div class="creation-outline-slide-toolbar">
              <strong>${escapeHtml(slide.title || `Slide ${index + 1}`)}</strong>
              <button
                class="secondary compact-button outline-regenerate-button"
                type="button"
                data-outline-regenerate-slide-index="${index}"
                ${workflowRunning ? " disabled" : ""}
              >Regenerate slide</button>
            </div>
            <label class="field creation-outline-title-field">
              <span>Slide title</span>
              <input data-outline-slide-index="${index}" data-outline-slide-field="title" type="text" value="${escapeHtml(slide.title || `Slide ${index + 1}`)}"${workflowRunning ? " disabled" : ""}>
            </label>
            <label class="field">
              <span>Intent</span>
              <textarea data-outline-slide-index="${index}" data-outline-slide-field="intent"${workflowRunning ? " disabled" : ""}>${escapeHtml(slide.intent || "")}</textarea>
            </label>
            <label class="field">
              <span>Key message</span>
              <textarea data-outline-slide-index="${index}" data-outline-slide-field="keyMessage"${workflowRunning ? " disabled" : ""}>${escapeHtml(slide.keyMessage || slide.intent || "")}</textarea>
            </label>
            <label class="field">
              <span>Source need</span>
              <textarea data-outline-slide-index="${index}" data-outline-slide-field="sourceNeed"${workflowRunning ? " disabled" : ""}>${escapeHtml(slide.sourceNeed || "No specific source need.")}</textarea>
            </label>
            <label class="field">
              <span>Source notes</span>
              <textarea data-outline-slide-index="${index}" data-outline-slide-field="sourceNotes" placeholder="Paste excerpts, URLs, or reference notes for this outline beat."${workflowRunning ? " disabled" : ""}>${escapeHtml(slide.sourceNotes || slide.sourceText || "")}</textarea>
            </label>
            <label class="field">
              <span>Visual need</span>
              <textarea data-outline-slide-index="${index}" data-outline-slide-field="visualNeed"${workflowRunning ? " disabled" : ""}>${escapeHtml(slide.visualNeed || "Use fitting supplied imagery when relevant.")}</textarea>
            </label>
          </div>
        </article>
      `).join("")
    : "<div class=\"presentation-empty\"><strong>No outline generated</strong><span>Use the brief stage to generate a draft outline.</span></div>";

  const snippets = draft && draft.retrieval && Array.isArray(draft.retrieval.snippets) ? draft.retrieval.snippets : [];
  elements.presentationSourceEvidence.innerHTML = snippets.length
    ? `
      <details class="creation-source-snippets">
        <summary>${snippets.length} source snippet${snippets.length === 1 ? "" : "s"} used</summary>
        ${snippets.slice(0, 3).map((snippet, index) => `
          <article class="creation-source-item">
            <strong>${index + 1}. ${escapeHtml(snippet.title || "Source")}</strong>
            <p>${escapeHtml(snippet.text || "")}</p>
          </article>
        `).join("")}
      </details>
    `
    : "<p class=\"creation-source-note\">No source snippets used.</p>";
  renderQuickSourceOutline(deckPlan);
}

function getCreationThemePreviewEntry() {
  const selected = Array.isArray(state.domPreview.slides)
    ? state.domPreview.slides.find((entry) => entry && entry.id === state.selectedSlideId)
    : null;
  return selected || (Array.isArray(state.domPreview.slides) ? state.domPreview.slides[0] : null);
}

function getCreationThemePreviewEntries() {
  const slides = Array.isArray(state.domPreview.slides) ? state.domPreview.slides.filter(Boolean) : [];
  if (!slides.length) {
    return [];
  }

  const result = [];
  const seen = new Set();

  const pushEntry = (entry) => {
    if (!entry || !entry.id || seen.has(entry.id)) {
      return;
    }

    seen.add(entry.id);
    result.push(entry);
  };

  pushEntry(slides.find((entry) => entry && entry.slideSpec && entry.slideSpec.type === "cover"));
  pushEntry(slides.find((entry) => entry && entry.slideSpec && ["content", "summary", "toc"].includes(entry.slideSpec.type)));
  pushEntry(slides.find((entry) => entry && entry.slideSpec && ["divider", "quote", "photo", "photoGrid"].includes(entry.slideSpec.type)));

  if (result.length < 3) {
    slides.forEach((entry) => {
      if (result.length >= 3) {
        return;
      }
      pushEntry(entry);
    });
  }

  return result.slice(0, 3);
}

function getThemeTokenSummary(theme) {
  const source = theme && typeof theme === "object" ? theme : {};
  return [
    { label: "Font", value: source.fontFamily || "avenir", tone: "neutral" },
    { label: "Primary", value: source.primary || "#183153", tone: "color" },
    { label: "Secondary", value: source.secondary || "#275d8c", tone: "color" },
    { label: "Accent", value: source.accent || "#f28f3b", tone: "color" },
    { label: "Background", value: source.bg || "#f5f8fc", tone: "color" },
    { label: "Panel", value: source.panel || "#f8fbfe", tone: "color" }
  ];
}

function renderCreationThemeReview(selectedVariant) {
  if (!elements.presentationThemeReview) {
    return;
  }

  const activeSlideCount = Array.isArray(state.slides) ? state.slides.length : 0;
  const previewEntries = getCreationThemePreviewEntries();
  const tokens = getThemeTokenSummary(selectedVariant.theme);
  const variantLabel = selectedVariant && selectedVariant.label ? selectedVariant.label : "Current";
  const variantNote = selectedVariant && selectedVariant.note ? selectedVariant.note : "Use the selected controls.";

  elements.presentationThemeReview.innerHTML = `
    <div class="creation-theme-review__head">
      <div>
        <p class="eyebrow">Theme impact</p>
        <strong>${escapeHtml(variantLabel)} theme</strong>
        <p>${escapeHtml(variantNote)}</p>
      </div>
      <div class="creation-theme-review__stats" aria-label="Theme impact">
        <span><strong>${activeSlideCount}</strong> active slide${activeSlideCount === 1 ? "" : "s"}</span>
        <span><strong>${previewEntries.length}</strong> sample preview${previewEntries.length === 1 ? "" : "s"}</span>
      </div>
    </div>
    <div class="creation-theme-review__tokens" aria-label="Theme tokens">
      ${tokens.map((token) => `
        <span class="creation-theme-review__token${token.tone === "color" ? " is-color" : ""}"${token.tone === "color" ? ` style="--theme-token:${escapeHtml(token.value)}"` : ""}>
          <strong>${escapeHtml(token.label)}</strong>
          <small>${escapeHtml(token.value)}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function renderCreationThemeStage() {
  if (!elements.presentationThemeVariantList || !elements.presentationThemePreview) {
    return;
  }

  const variants = getCreationThemeVariants();
  if (!variants.some((variant) => variant.id === state.ui.creationThemeVariantId)) {
    state.ui.creationThemeVariantId = "current";
  }
  const selectedVariant = getSelectedCreationThemeVariant();
  renderCreationThemeReview(selectedVariant);
  if (elements.generateThemeCandidatesButton) {
    elements.generateThemeCandidatesButton.textContent = state.ui.themeCandidatesGenerated
      ? "Refresh candidates"
      : "Generate candidates";
  }
  elements.presentationThemeVariantList.innerHTML = variants.map((variant) => `
    <button
      class="creation-theme-variant${variant.id === selectedVariant.id ? " active" : ""}"
      type="button"
      data-creation-theme-variant="${escapeHtml(variant.id)}"
      aria-pressed="${variant.id === selectedVariant.id ? "true" : "false"}"
    >
      <span class="creation-theme-swatch" style="--swatch-bg:${escapeHtml(variant.theme.bg || "#ffffff")};--swatch-primary:${escapeHtml(variant.theme.primary || "#183153")};--swatch-accent:${escapeHtml(variant.theme.accent || "#f28f3b")}"></span>
      <strong>${escapeHtml(variant.label)}</strong>
      <small>${escapeHtml(variant.note)}</small>
    </button>
  `).join("");

  const previewEntries = getCreationThemePreviewEntries();
  if (previewEntries.length) {
    elements.presentationThemePreview.innerHTML = `
      <div class="creation-theme-preview-grid">
        ${previewEntries.map((entry, index) => `
          <section class="creation-theme-preview-card${entry.id === state.selectedSlideId ? " is-current" : ""}" data-theme-preview-slide-id="${escapeHtml(entry.id)}">
            <header class="creation-theme-preview-card__meta">
              <span>Slide ${escapeHtml(String(entry.index || index + 1))}</span>
              <small>${escapeHtml(entry.slideSpec && entry.slideSpec.type ? entry.slideSpec.type : "slide")}</small>
            </header>
            <div class="creation-theme-preview-card__viewport"></div>
          </section>
        `).join("")}
      </div>
    `;
    elements.presentationThemePreview.querySelectorAll("[data-theme-preview-slide-id]").forEach((card: any) => {
      const entry = previewEntries.find((candidate) => candidate.id === card.dataset.themePreviewSlideId);
      const viewport = card.querySelector(".creation-theme-preview-card__viewport");
      if (!entry || !entry.slideSpec || !viewport) {
        return;
      }

      renderDomSlide(viewport, entry.slideSpec, {
        index: entry.index || 1,
        theme: selectedVariant.theme,
        totalSlides: state.slides.length || state.domPreview.slides.length || 1
      });
    });
  } else {
    elements.presentationThemePreview.innerHTML = `
      <div class="presentation-empty">
        <strong>No slide preview yet</strong>
        <span>Select a presentation to preview themes.</span>
      </div>
    `;
  }
}

function renderCreationContentRun(draft) {
  if (!elements.contentRunRail || !elements.contentRunPreview || !elements.contentRunPreviewTitle || !elements.contentRunPreviewEyebrow || !elements.contentRunPreviewActions || !elements.contentRunSummary) {
    return;
  }

  const deckPlan = draft && draft.deckPlan;
  const planSlides = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
  const run = draft && draft.contentRun;
  const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
  const slideCount = planSlides.length;

  if (!slideCount) {
    elements.contentRunRail.innerHTML = "";
    elements.contentRunPreviewActions.innerHTML = "";
    elements.contentRunSummary.textContent = "No slides generated yet.";
    elements.contentRunPreviewEyebrow.textContent = "Preview";
    elements.contentRunPreviewTitle.textContent = "No outline yet";
    elements.contentRunPreview.innerHTML = `
      <div class="creation-content-placeholder">
        <h4>Generate an outline first</h4>
        <p>Draft slides are available after the outline is approved.</p>
      </div>
    `;
    return;
  }

  const selected = Number.isFinite(Number(state.ui.creationContentSlideIndex))
    ? Math.max(1, Math.min(slideCount, Number(state.ui.creationContentSlideIndex)))
    : 1;
  state.ui.creationContentSlideIndex = selected;

  const statusLabel = (status) => {
    switch (status) {
      case "generating":
        return "Generating";
      case "complete":
        return "Complete";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  elements.contentRunSummary.textContent = formatContentRunSummary(run, slideCount, runSlides);

  elements.contentRunRail.innerHTML = planSlides.map((slide, index) => {
    const runSlide = runSlides[index] || null;
    const status = runSlide && runSlide.status ? runSlide.status : "pending";
    const active = selected === index + 1;
    const displayTitle = status === "complete" && runSlide && runSlide.slideSpec && runSlide.slideSpec.title
      ? runSlide.slideSpec.title
      : slide.title || `Slide ${index + 1}`;
    const role = slide.role || "slide";
    return `
      <button
        class="creation-content-rail-item${active ? " is-active" : ""}"
        type="button"
        data-content-run-slide="${index + 1}"
        data-status="${escapeHtml(status)}"
        aria-pressed="${active ? "true" : "false"}"
      >
        <span class="creation-content-rail-index" aria-hidden="true">${index + 1}</span>
        <span class="creation-content-rail-meta">
          <strong>${escapeHtml(displayTitle)}</strong>
          <small>${escapeHtml(`${role} - ${statusLabel(status)}`)}</small>
        </span>
      </button>
    `;
  }).join("");

  const index = selected - 1;
  const planSlide = planSlides[index] || {};
  const runSlide = runSlides[index] || null;
  const status = runSlide && runSlide.status ? runSlide.status : "pending";
  const completedCount = run && Number.isFinite(Number(run.completed))
    ? Number(run.completed)
    : runSlides.filter((slide) => slide && slide.status === "complete").length;
  const incompleteCount = runSlides.filter((slide) => slide && slide.status !== "complete").length;

  elements.contentRunPreviewActions.innerHTML = "";
  elements.contentRunPreviewEyebrow.textContent = statusLabel(status);
  elements.contentRunPreviewTitle.textContent = `${selected}. ${planSlide.title || `Slide ${selected}`}`;

  if (run && run.status === "running") {
    elements.contentRunPreviewActions.innerHTML = `
      <button class="secondary compact-button" type="button" data-content-run-stop>Stop generation</button>
    `;
  }
  if (run && run.status !== "running" && completedCount > 0 && incompleteCount > 0) {
    elements.contentRunPreviewActions.insertAdjacentHTML("beforeend", `
      <button class="secondary compact-button" type="button" data-content-run-accept-partial>Accept completed</button>
    `);
  }

  if (status === "complete" && runSlide && runSlide.slideSpec) {
    elements.contentRunPreview.innerHTML = "";
    renderDomSlide(elements.contentRunPreview, runSlide.slideSpec, {
      index: selected,
      totalSlides: slideCount
    });
    return;
  }

  if (status === "failed") {
    const retryDisabled = isWorkflowRunning();
    elements.contentRunPreviewActions.insertAdjacentHTML("beforeend", `
      <button class="secondary compact-button" type="button" data-content-run-retry-slide="${selected}"${retryDisabled ? " disabled" : ""}>Retry slide</button>
    `);
  }

  const describe = (label, value, fallback) => {
    const body = String(value || "").trim() || fallback;
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(body)}</dd>
      </div>
    `;
  };

  elements.contentRunPreview.innerHTML = `
    <div class="creation-content-placeholder">
      <h4>${escapeHtml(planSlide.title || `Slide ${selected}`)}</h4>
      ${status === "failed" ? `<p>${escapeHtml(String(runSlide && runSlide.error ? runSlide.error : "Slide generation failed."))}</p>` : ""}
      ${status === "failed" && runSlide && runSlide.errorLogPath ? `<p>Full error log: <code>${escapeHtml(runSlide.errorLogPath)}</code></p>` : ""}
      ${status === "generating" ? "<p>Drafting this slide now…</p>" : status === "pending" ? "<p>Waiting for generation.</p>" : ""}
      <dl>
        ${describe("Intent", planSlide.intent, "No intent provided.")}
        ${describe("Key message", planSlide.keyMessage || planSlide.intent, "No key message provided.")}
        ${describe("Source need", planSlide.sourceNeed, "No specific source need.")}
        ${describe("Visual need", planSlide.visualNeed, "No specific visual need.")}
      </dl>
    </div>
  `;
}

function getContentRunStatusLabel(status) {
  switch (status) {
    case "running":
      return "Generating";
    case "failed":
      return "Failed";
    case "stopped":
      return "Stopped";
    case "completed":
      return "Complete";
    default:
      return "Ready";
  }
}

function truncateStatusText(value, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function getContentRunFailureDetail(runSlides) {
  const failedIndex = runSlides.findIndex((slide) => slide && slide.status === "failed");
  if (failedIndex < 0) {
    return "";
  }

  const failedSlide = runSlides[failedIndex] || {};
  const error = truncateStatusText(failedSlide.error || "Slide generation failed.");
  return ` Slide ${failedIndex + 1} failed: ${error}`;
}

function getLiveStudioContentRun() {
  const draft = state.creationDraft || {};
  const run = draft.contentRun && typeof draft.contentRun === "object" ? draft.contentRun : null;
  if (!run || !draft.createdPresentationId) {
    return null;
  }

  const presentationState = getPresentationState();
  return draft.createdPresentationId === presentationState.activePresentationId ? run : null;
}

function formatContentRunSummary(run, slideCount, runSlides) {
  const completedCount = run && Number.isFinite(Number(run.completed))
    ? Number(run.completed)
    : runSlides.filter((slide) => slide && slide.status === "complete").length;
  const runStatus = run && run.status ? run.status : "ready";
  const failedCount = runSlides.filter((slide) => slide && slide.status === "failed").length;
  const generatingIndex = runSlides.findIndex((slide) => slide && slide.status === "generating");
  const activePart = generatingIndex >= 0 ? ` Slide ${generatingIndex + 1} is generating.` : "";
  const failurePart = failedCount ? ` ${failedCount} failed.${getContentRunFailureDetail(runSlides)}` : "";

  return `${completedCount}/${slideCount} slides complete. ${getContentRunStatusLabel(runStatus)}.${activePart}${failurePart}`;
}

function renderCreationDraft() {
  const draft = state.creationDraft || {};
  const hasOutline = Boolean(draft.deckPlan && Array.isArray(draft.deckPlan.slides) && draft.deckPlan.slides.length);
  const approved = draft.approvedOutline === true;
  const outlineDirty = draft.outlineDirty === true;
  const workflowRunning = isWorkflowRunning();
  const unlockedOutlineCount = hasOutline ? countUnlockedOutlineSlides(draft.deckPlan) : 0;
  const stageContext = { approved, hasOutline, outlineDirty };
  let stage = normalizeCreationStage(state.ui.creationStage || draft.stage || "brief");
  if (!getCreationStageAccess(stage, draft, stageContext).enabled) {
    stage = hasOutline ? "structure" : "brief";
  }
  state.ui.creationStage = stage;

  [
    ["brief", elements.creationStageBrief],
    ["structure", elements.creationStageStructure],
    ["content", elements.creationStageContent],
  ].forEach(([name, element]) => {
    if (element) {
      element.hidden = name !== stage;
    }
  });

  document.querySelectorAll("[data-creation-stage]").forEach((button: any) => {
    const active = button.dataset.creationStage === stage;
    const access = getCreationStageAccess(button.dataset.creationStage, draft, stageContext);
    button.classList.toggle("active", active);
    button.dataset.state = active ? "active" : access.state;
    button.setAttribute("aria-current", active ? "step" : "false");
    button.disabled = workflowRunning || !access.enabled;
  });

  getCreationInputElements().forEach((element: any) => {
    element.disabled = workflowRunning;
  });

  elements.generatePresentationOutlineButton.disabled = workflowRunning || !elements.presentationTitle.value.trim();
  elements.approvePresentationOutlineButton.disabled = workflowRunning || !hasOutline || outlineDirty;
  elements.regeneratePresentationOutlineButton.disabled = workflowRunning || !elements.presentationTitle.value.trim() || (hasOutline && unlockedOutlineCount === 0);
  elements.regeneratePresentationOutlineWithSourcesButton.disabled = workflowRunning || !elements.presentationTitle.value.trim() || (hasOutline && unlockedOutlineCount === 0);
  elements.backToPresentationOutlineButton.disabled = workflowRunning;
  elements.createPresentationButton.disabled = workflowRunning || !approved || !hasOutline || outlineDirty;
  if (elements.savePresentationThemeButton) {
    elements.savePresentationThemeButton.disabled = workflowRunning;
  }
  renderContentRunNavStatus();
  const contentRun = draft.contentRun && typeof draft.contentRun === "object" ? draft.contentRun : null;
  const failedSlideNumber = contentRun && Number.isFinite(Number(contentRun.failedSlideIndex))
    ? Number(contentRun.failedSlideIndex) + 1
    : null;
  const failedSlide = failedSlideNumber && Array.isArray(contentRun.slides)
    ? contentRun.slides[failedSlideNumber - 1]
    : null;
  const failedError = failedSlide && failedSlide.error
    ? truncateStatusText(failedSlide.error, 180)
    : "Slide generation failed.";
  elements.presentationCreationStatus.textContent = workflowRunning
    ? "Generation is running from a locked snapshot. Wait for it to finish before changing the draft."
    : contentRun && contentRun.status === "failed"
      ? `Slide generation failed${failedSlideNumber ? ` on slide ${failedSlideNumber}` : ""}. ${failedError} Retry from the failed slide in Studio or inspect the saved error log.`
      : contentRun && contentRun.status === "stopped"
        ? "Slide generation stopped. Completed slides remain available in Slide Studio."
    : outlineDirty
      ? "Brief changed. Regenerate the outline before approving it."
      : hasOutline && unlockedOutlineCount === 0
        ? "All outline slides are kept. Unlock a slide before regenerating the outline."
      : approved
    ? "Outline approved. Slide Studio will show generated slides as they validate."
    : hasOutline
      ? "Review the outline, then approve it to create slides."
      : "Draft is saved locally as ignored runtime state.";
  renderCreationOutline(draft);
  renderCreationContentRun(draft);
  renderCreationThemeStage();
}

function formatPresentationDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short"
    }).format(date);
  } catch (error) {
    return date.toISOString().slice(0, 10);
  }
}

function buildPresentationFacts(presentation) {
  const facts = [
    `${presentation.slideCount || 0} slide${presentation.slideCount === 1 ? "" : "s"}`
  ];
  if (presentation.targetSlideCount) {
    facts.push(`${presentation.targetSlideCount} target`);
  }
  const updated = formatPresentationDate(presentation.updatedAt);
  if (updated) {
    facts.push(`Updated ${updated}`);
  }
  if (presentation.audience) {
    facts.push(presentation.audience);
  }
  if (presentation.tone) {
    facts.push(presentation.tone);
  }

  return facts.slice(0, 4);
}

function getPresentationSearchText(presentation) {
  return [
    presentation.title,
    presentation.description,
    presentation.audience,
    presentation.objective,
    presentation.subject,
    presentation.tone,
    presentation.targetSlideCount ? `${presentation.targetSlideCount} target` : ""
  ].map((value) => String(value || "").toLowerCase()).join(" ");
}

function comparePresentationUpdatedAt(left, right) {
  const leftTime = Date.parse(left.updatedAt || "") || 0;
  const rightTime = Date.parse(right.updatedAt || "") || 0;
  return rightTime - leftTime;
}

function renderPresentations() {
  const presentationState = getPresentationState();
  const query = String(elements.presentationSearch.value || "").trim().toLowerCase();
  const presentations = presentationState.presentations
    .slice()
    .sort((left, right) => {
      if (left.id === presentationState.activePresentationId) {
        return -1;
      }
      if (right.id === presentationState.activePresentationId) {
        return 1;
      }

      return comparePresentationUpdatedAt(left, right);
    })
    .filter((presentation) => !query || getPresentationSearchText(presentation).includes(query));
  elements.presentationList.innerHTML = "";
  elements.presentationResultCount.textContent = `${presentations.length} of ${presentationState.presentations.length} presentation${presentationState.presentations.length === 1 ? "" : "s"}`;

  if (!presentations.length) {
    elements.presentationList.innerHTML = `
      <div class="presentation-empty">
        <strong>${query ? "No matching presentations" : "No presentations found"}</strong>
        <span>${query ? "Clear the filter or search for a different title, audience, tone, or objective." : "Create one from constraints and an initial generated deck."}</span>
      </div>
    `;
    return;
  }

  presentations.forEach((presentation) => {
    const active = presentation.id === presentationState.activePresentationId;
    const facts = buildPresentationFacts(presentation);
    const card = document.createElement("article");
    card.className = `presentation-card${active ? " active" : ""}`;
    card.dataset.presentationId = presentation.id;
    card.innerHTML = `
      <div class="presentation-card-preview" aria-hidden="true"></div>
      <div class="presentation-card-body">
        <div class="presentation-card-title-row">
          <h3>${escapeHtml(presentation.title || presentation.id)}</h3>
          ${active ? "<span class=\"presentation-active-pill\">Active</span>" : ""}
        </div>
        <p>${escapeHtml(presentation.description || "No brief saved yet.")}</p>
        <div class="presentation-card-facts" aria-label="Presentation metadata">
          ${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}
        </div>
      </div>
      <div class="presentation-card-actions">
        <button class="secondary presentation-select-button" type="button">${active ? "Open" : "Select"}</button>
        <button class="secondary presentation-regenerate-button" type="button">Regenerate</button>
        <button class="secondary presentation-duplicate-button" type="button">Duplicate</button>
        <button class="secondary presentation-delete-button" type="button"${presentations.length <= 1 ? " disabled" : ""}>Delete</button>
      </div>
    `;

    const preview = card.querySelector(".presentation-card-preview");
    if (presentation.firstSlideSpec) {
      renderDomSlide(preview, presentation.firstSlideSpec, {
        index: 1,
        theme: presentation.theme,
        totalSlides: presentation.slideCount || 1
      });
    }

    const selectButton = card.querySelector(".presentation-select-button");
    const regenerateButton = card.querySelector(".presentation-regenerate-button");
    const duplicateButton = card.querySelector(".presentation-duplicate-button");
    const deleteButton = card.querySelector(".presentation-delete-button");

    selectButton.addEventListener("click", () => {
      selectPresentation(presentation.id, selectButton).catch((error) => window.alert(error.message));
    });
    duplicateButton.addEventListener("click", () => {
      duplicatePresentation(presentation, duplicateButton).catch((error) => window.alert(error.message));
    });
    regenerateButton.addEventListener("click", () => {
      regeneratePresentation(presentation, regenerateButton).catch((error) => window.alert(error.message));
    });
    deleteButton.addEventListener("click", () => {
      deletePresentation(presentation, deleteButton).catch((error) => window.alert(error.message));
    });
    card.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (target && target.closest("button")) {
        return;
      }

      selectPresentation(presentation.id, selectButton).catch((error) => window.alert(error.message));
    });

    elements.presentationList.appendChild(card);
  });
}

function renderVariants() {
  const variants = getSlideVariants();
  const savedCount = variants.filter((variant) => variant.persisted !== false).length;
  const sessionCount = variants.length - savedCount;
  const reviewOpen = Boolean(state.ui.variantReviewOpen && variants.length);
  elements.variantList.innerHTML = "";
  elements.variantStorageNote.textContent = savedCount > 0
    ? `${sessionCount} session-only candidate${sessionCount === 1 ? "" : "s"} and ${savedCount} saved snapshot${savedCount === 1 ? "" : "s"} are available for this slide.`
    : variants.length
      ? `${variants.length} session-only candidate${variants.length === 1 ? "" : "s"} available for this slide.`
      : "Generated candidates stay in the current session until one is applied.";

  if (!reviewOpen) {
    elements.variantReviewWorkspace.classList.add("is-empty");
    elements.workflowCompare.hidden = true;
    elements.variantList.innerHTML = "<div class=\"variant-card variant-empty-state\"><strong>No candidates yet</strong><span>Choose a count, then run a variant action to create session-only options.</span></div>";
    renderVariantFlow();
    renderVariantComparison();
    return;
  }

  elements.variantReviewWorkspace.classList.remove("is-empty");
  elements.workflowCompare.hidden = false;

  const selectVariantForComparison = (variant) => {
    state.selectedVariantId = variant ? variant.id : null;
    elements.operationStatus.textContent = variant
      ? `Previewing ${variant.label} in the main slide area.`
      : "Previewing the original slide.";
    renderPreviews();
    renderVariants();
  };

  const renderOriginalCard = () => {
    const selectedTitle = state.selectedSlideSpec && state.selectedSlideSpec.title || "Current slide";
    const selected = !getSelectedVariant();
    const previewButton = createDomElement("button", {
      className: "secondary",
      dataset: { action: "preview" },
      text: selected ? "Previewing" : "Preview",
      attributes: { type: "button" }
    });
    const card = createDomElement("div", {
      className: `variant-card variant-original-card${selected ? " active" : ""}`,
      attributes: {
        "aria-current": selected ? "true" : "false",
        "aria-label": "Preview original slide"
      }
    }, [
      createDomElement("div", { className: "variant-select-line" }, [
        createDomElement("span", {
          className: "variant-select-mark",
          attributes: { "aria-hidden": "true" }
        }),
        createDomElement("p", { className: "variant-kind", text: "Original" })
      ]),
      createDomElement("strong", { text: selectedTitle }),
      createDomElement("span", { className: "variant-meta", text: "Saved slide" }),
      createDomElement("span", { text: "The current saved slide before applying any candidate." }),
      createDomElement("div", { className: "variant-actions" }, [previewButton])
    ]);
    card.tabIndex = 0;
    const previewOriginal = () => selectVariantForComparison(null);
    card.addEventListener("click", (event) => {
      if ((event.target as any).closest("button")) {
        return;
      }
      previewOriginal();
    });
    card.addEventListener("keydown", (event) => {
      if ((event.target as any).closest("button")) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        previewOriginal();
      }
    });
    previewButton.addEventListener("click", previewOriginal);
    elements.variantList.appendChild(card);
  };

  renderOriginalCard();

  variants.forEach((variant) => {
    const selected = variant.id === state.selectedVariantId;
    const kindLabel = describeVariantKind(variant);
    const summary = variant.promptSummary || variant.notes || "No notes";
    const actions = [
      createDomElement("button", {
        className: "secondary",
        dataset: { action: "compare" },
        text: selected ? "Previewing" : "Preview",
        attributes: { type: "button" }
      })
    ];
    if (canSaveVariantLayout(variant)) {
      actions.push(createDomElement("button", {
        className: "secondary",
        dataset: { action: "save-layout" },
        text: "Save layout",
        attributes: { type: "button" }
      }));
      const canSaveFavorite = canSaveVariantLayoutAsFavorite(variant);
      const favoriteAttributes: any = { type: "button" };
      if (!canSaveFavorite) {
        favoriteAttributes.title = "Run a favorite-ready preview first";
      }
      actions.push(createDomElement("button", {
        className: "secondary",
        dataset: { action: "save-favorite-layout" },
        disabled: !canSaveFavorite,
        text: "Save favorite",
        attributes: favoriteAttributes
      }));
    }
    actions.push(createDomElement("button", {
      dataset: { action: "apply" },
      text: "Apply variant",
      attributes: { type: "button" }
    }));

    const card = createDomElement("div", {
      className: `variant-card${selected ? " active" : ""}`,
      attributes: {
        "aria-current": selected ? "true" : "false",
        "aria-label": `Preview ${variant.label}`
      }
    }, [
      createDomElement("div", { className: "variant-select-line" }, [
        createDomElement("span", {
          className: "variant-select-mark",
          attributes: { "aria-hidden": "true" }
        }),
        createDomElement("p", { className: "variant-kind", text: kindLabel })
      ]),
      createDomElement("strong", { text: variant.label }),
      createDomElement("span", { className: "variant-meta", text: new Date(variant.createdAt).toLocaleString() }),
      createDomElement("span", { text: summary }),
      createDomElement("div", { className: "variant-actions" }, actions)
    ]);
    card.tabIndex = 0;

    card.addEventListener("click", (event) => {
      if ((event.target as any).closest("button")) {
        return;
      }

      selectVariantForComparison(variant);
    });

    card.addEventListener("keydown", (event) => {
      if ((event.target as any).closest("button")) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectVariantForComparison(variant);
      }
    });

    card.querySelector("[data-action=\"compare\"]").addEventListener("click", () => {
      selectVariantForComparison(variant);
    });

    const saveLayoutButton = card.querySelector("[data-action=\"save-layout\"]");
    if (saveLayoutButton) {
      saveLayoutButton.addEventListener("click", () => saveVariantLayout(variant, false, saveLayoutButton).catch((error) => window.alert(error.message)));
    }

    const saveFavoriteLayoutButton = card.querySelector("[data-action=\"save-favorite-layout\"]");
    if (saveFavoriteLayoutButton) {
      saveFavoriteLayoutButton.addEventListener("click", () => saveVariantLayout(variant, true, saveFavoriteLayoutButton).catch((error) => window.alert(error.message)));
    }

    const applyButton = card.querySelector("[data-action=\"apply\"]");
    applyButton.addEventListener("click", async () => {
      const done = setBusy(applyButton, "Applying...");
      try {
        await applyVariantById(variant.id, {
          label: variant.label,
          validateAfter: false
        });
      } catch (error) {
        window.alert(error.message);
      } finally {
        done();
      }
    });

    elements.variantList.appendChild(card);
  });

  renderVariantFlow();
  renderVariantComparison();
}

function canSaveVariantLayout(variant) {
  return variant
    && (variant.operation === "redo-layout" || variant.operation === "custom-layout")
    && variant.slideSpec
    && variant.slideSpec.type
    && (variant.slideSpec.layout || variant.layoutDefinition);
}

function canSaveVariantLayoutAsFavorite(variant) {
  return canSaveVariantLayout(variant)
    && (variant.operation !== "custom-layout" || (variant.layoutPreview && variant.layoutPreview.mode === "multi-slide"));
}

function describeVariantKind(variant) {
  if (variant.operationScope && variant.operationScope.scopeLabel) {
    return `${variant.persisted === false ? "Session " : ""}${variant.operationScope.scopeLabel}`;
  }

  if (variant.kind !== "generated") {
    return "Snapshot";
  }

  const prefix = variant.persisted === false ? "Session " : "";

  if (variant.operation === "drill-wording") {
    return `${prefix}wording pass`;
  }

  if (variant.operation === "ideate-theme") {
    return `${prefix}theme pass`;
  }

  if (variant.operation === "ideate-structure") {
    return `${prefix}content rewrite`;
  }

  if (variant.operation === "redo-layout") {
    return `${prefix}layout pass`;
  }

  if (variant.operation === "custom-layout") {
    return `${prefix}custom layout`;
  }

  if (variant.generator === "llm") {
    return `${prefix}LLM ideate`;
  }

  return `${prefix}local ideate`;
}

function getVariantSelectionEntries(variant) {
  const scope = variant && variant.operationScope;
  if (!scope) {
    return [];
  }

  return scope.kind === "selectionGroup" && Array.isArray(scope.selections)
    ? scope.selections
    : [scope];
}

function getVariantSelectionStaleReason(variant) {
  const entries = getVariantSelectionEntries(variant);
  if (!entries.length || !state.selectedSlideSpec) {
    return "";
  }

  const stale = entries.find((entry) => {
    const currentValue = getSlideSpecPathValue(state.selectedSlideSpec, entry.fieldPath || entry.path);
    return currentValue === undefined || (entry.fieldHash && hashFieldValue(currentValue) !== entry.fieldHash);
  });

  return stale
    ? `Selection target changed: ${pathToString(stale.fieldPath || stale.path)}. Regenerate or rebase before applying.`
    : "";
}

function renderVariantComparison() {
  const variant = getSelectedVariant();
  if (!variant) {
    elements.compareEmpty.hidden = false;
    elements.compareSummary.hidden = true;
    elements.compareApplyButton.disabled = true;
    elements.compareApplyValidateButton.disabled = true;
    return;
  }

  const currentComparisonSource = getCurrentComparisonSource();
  const variantComparisonSource = getVariantComparisonSource(variant);
  const variantVisualTheme = getVariantVisualTheme(variant);
  const diff = summarizeDiff(currentComparisonSource, variantComparisonSource);
  const sourceRows = buildSourceDiffRows(currentComparisonSource, variantComparisonSource);
  const structuredComparison = state.selectedSlideStructured && variant.slideSpec
    ? buildStructuredComparison(state.selectedSlideSpec, variant.slideSpec)
    : null;
  const decisionSupport = buildVariantDecisionSupport(
    state.selectedSlideSpec,
    variant.slideSpec,
    structuredComparison,
    diff
  );
  const beforeSourceFormat = state.selectedSlideStructured ? "json" : "plain";
  const afterSourceFormat = variant.slideSpec ? "json" : "plain";
  const compareSummaryItems = Array.isArray(variant.changeSummary) && variant.changeSummary.length
    ? variant.changeSummary.slice()
    : [variant.promptSummary || variant.notes || "No change summary available."];
  const staleSelectionReason = getVariantSelectionStaleReason(variant);

  if (staleSelectionReason) {
    compareSummaryItems.unshift(staleSelectionReason);
  }

  if (structuredComparison && structuredComparison.summaryLines.length) {
    compareSummaryItems.push(...structuredComparison.summaryLines);
  }

  if (variant.layoutDefinition) {
    const slots = Array.isArray(variant.layoutDefinition.slots) ? variant.layoutDefinition.slots.length : 0;
    const regions = Array.isArray(variant.layoutDefinition.regions) ? variant.layoutDefinition.regions.length : 0;
    compareSummaryItems.push(`Layout definition: ${variant.layoutDefinition.type || "generated"}${slots || regions ? ` with ${slots} slots and ${regions} regions` : ""}.`);
  }
  if (variant.layoutPreview && variant.layoutPreview.mode) {
    compareSummaryItems.push(`Preview state: ${variant.layoutPreview.mode === "multi-slide" ? "favorite-ready multi-slide" : "current slide"}.`);
  }

  elements.compareEmpty.hidden = true;
  elements.compareSummary.hidden = false;

  elements.compareStats.innerHTML = [
    `<span class="compare-stat"><strong>${variant.persisted === false ? "session-only" : "saved"}</strong> variant mode</span>`,
    `<span class="compare-stat"><strong>${escapeHtml(variant.generator || "manual")}</strong> generator</span>`,
    structuredComparison
      ? `<span class="compare-stat"><strong>${structuredComparison.totalChanges}</strong> structured changes</span>`
      : "",
    structuredComparison
      ? `<span class="compare-stat"><strong>${structuredComparison.groups.length}</strong> content areas</span>`
      : "",
    variantVisualTheme
      ? `<span class="compare-stat"><strong>visual</strong> theme</span>`
      : "",
    variant.layoutDefinition
      ? `<span class="compare-stat"><strong>${escapeHtml(variant.layoutDefinition.type || "layout")}</strong> definition</span>`
      : "",
    variant.layoutPreview && variant.layoutPreview.state
      ? `<span class="compare-stat"><strong>${escapeHtml(variant.layoutPreview.state)}</strong> preview</span>`
      : "",
    variant.operationScope && variant.operationScope.scopeLabel
      ? `<span class="compare-stat"><strong>${escapeHtml(variant.operationScope.scopeLabel)}</strong> scope</span>`
      : "",
    variant.operationScope && variant.operationScope.allowFamilyChange
      ? `<span class="compare-stat"><strong>family</strong> change</span>`
      : "",
    `<span class="compare-stat"><strong>${diff.changed}</strong> changed lines</span>`,
    `<span class="compare-stat"><strong>${diff.added}</strong> added lines</span>`,
    `<span class="compare-stat"><strong>${diff.removed}</strong> removed lines</span>`
  ].filter(Boolean).join("");
  elements.compareChangeSummary.innerHTML = compareSummaryItems
    .map((item) => `<p class="compare-summary-item">${escapeHtml(item)}</p>`)
    .join("");
  elements.compareDecisionSupport.innerHTML = renderVariantDecisionSupport(decisionSupport);
  elements.compareSourceGrid.innerHTML = `
    <div class="source-pane">
      <p class="eyebrow">${state.selectedSlideStructured ? "Current JSON" : "Before"}</p>
      <div class="source-lines">
        ${sourceRows.map((row) => `
          <div class="source-line${row.changed ? " changed" : ""}">
            <span class="source-line-no">${row.line}</span>
            <code>${formatSourceCode(row.before, beforeSourceFormat)}</code>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="source-pane">
      <p class="eyebrow">${variant.slideSpec ? "Candidate JSON" : "After"}</p>
      <div class="source-lines">
        ${sourceRows.map((row) => `
          <div class="source-line${row.changed ? " changed" : ""}">
            <span class="source-line-no">${row.line}</span>
            <code>${formatSourceCode(row.after, afterSourceFormat)}</code>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  synchronizeCompareSourceScroll();
  elements.compareHighlights.innerHTML = structuredComparison && Array.isArray(structuredComparison.groupDetails) && structuredComparison.groupDetails.length
    ? structuredComparison.groupDetails.map((group) => `
      <section class="compare-group">
        <div class="compare-group-head">
          <strong>${escapeHtml(group.label)}</strong>
          <span>${group.changes.length} change${group.changes.length === 1 ? "" : "s"}</span>
        </div>
        <div class="compare-group-items">
          ${group.changes.map((highlight) => `
            <div class="compare-highlight">
              <strong>${escapeHtml(highlight.label)}</strong>
              <span>Before: ${escapeHtml(highlight.before)}</span>
              <span>After: ${escapeHtml(highlight.after)}</span>
            </div>
          `).join("")}
        </div>
      </section>
    `).join("")
    : diff.highlights.length
      ? diff.highlights.map((highlight) => `
      <div class="compare-highlight">
        <strong>Line ${highlight.line}</strong>
        <span>${escapeHtml(highlight.before)}</span>
        <span>${escapeHtml(highlight.after)}</span>
      </div>
    `).join("")
    : "<p class=\"compare-empty-copy\">No source changes detected.</p>";
  elements.compareApplyButton.disabled = Boolean(staleSelectionReason);
  elements.compareApplyValidateButton.disabled = Boolean(staleSelectionReason);
  renderVariantFlow();
}

function renderValidation() {
  if (!state.validation) {
    elements.validationSummary.innerHTML = "";
    elements.reportBox.textContent = "No checks run yet.";
    return;
  }

  const issueLines = [];
  const skippedChecks = [];
  const summaryBlocks = [];
  [["geometry", state.validation.geometry], ["text", state.validation.text], ["render", state.validation.render]].forEach(([label, block]) => {
    if (!block) {
      return;
    }

    const issues = block.issues && block.issues.length ? block.issues : (block.errors || []);
    const status = block.skipped ? "skipped" : (block.ok ? "passed" : "failed");
    summaryBlocks.push({
      count: issues.length,
      label,
      status
    });

    if (block.skipped) {
      skippedChecks.push(label);
      return;
    }

    if (!issues.length) {
      return;
    }

    issues.forEach((issue) => {
      const slideLabel = issue.slide ? `slide ${issue.slide}` : label;
      const ruleLabel = issue.rule ? `${issue.rule}: ` : "";
      issueLines.push(`${slideLabel}: ${ruleLabel}${issue.message || "Check issue"}`);
    });
  });

  elements.validationSummary.innerHTML = summaryBlocks.map((block) => `
    <div class="validation-summary-card" data-status="${escapeHtml(block.status)}">
      <strong>${escapeHtml(block.label)}</strong>
      <span>${escapeHtml(block.status)}</span>
      <span>${block.count} issue${block.count === 1 ? "" : "s"}</span>
    </div>
  `).join("");
  elements.reportBox.textContent = issueLines.length
    ? issueLines.join("\n")
    : skippedChecks.length
      ? `No issues found. Skipped ${skippedChecks.join(", ")}.`
      : "No issues found.";
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

function clearPresentationForm() {
  elements.presentationTitle.value = "";
  elements.presentationAudience.value = "";
  elements.presentationTone.value = "";
  elements.presentationTargetSlides.value = "";
  elements.presentationObjective.value = "";
  elements.presentationConstraints.value = "";
  elements.presentationSourcingStyle.value = "";
  elements.presentationThemeBrief.value = "";
  elements.presentationSourceText.value = "";
  elements.presentationOutlineSourceText.value = "";
  elements.presentationMaterialFile.value = "";
  elements.presentationImageSearchQuery.value = "";
  elements.presentationImageSearchProvider.value = "openverse";
  elements.presentationImageSearchRestrictions.value = "";
  elements.presentationFontFamily.value = "avenir";
  elements.presentationThemePrimary.value = "#183153";
  elements.presentationThemeSecondary.value = "#275d8c";
  elements.presentationThemeAccent.value = "#f28f3b";
  elements.presentationThemeBg.value = "#f5f8fc";
  elements.presentationThemePanel.value = "#f8fbfe";
  elements.presentationThemeName.value = "";
  elements.presentationSavedTheme.value = "";
  state.creationDraft = null;
  setCreationStage("brief");
}

function resetPresentationSelection() {
  state.selectedSlideId = null;
  state.selectedSlideIndex = 1;
  state.selectedSlideSpec = null;
  state.selectedSlideSpecDraftError = null;
  state.selectedSlideSpecError = null;
  state.selectedSlideStructured = false;
  state.selectedSlideSource = "";
  state.selectedVariantId = null;
  state.transientVariants = [];
}

async function selectPresentation(presentationId, button = null) {
  const presentationState = getPresentationState();
  if (presentationId === presentationState.activePresentationId) {
    setCurrentPage("studio");
    return;
  }

  const done = button ? setBusy(button, "Selecting...") : null;
  try {
    await request("/api/presentations/select", {
      body: JSON.stringify({ presentationId }),
      method: "POST"
    });
    resetPresentationSelection();
    await refreshState();
    setCurrentPage("studio");
  } finally {
    if (done) {
      done();
    }
  }
}

async function createPresentationFromForm(options: any = {}) {
  const title = elements.presentationTitle.value.trim();
  const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);
  if (!title) {
    elements.presentationTitle.focus();
    return;
  }
  if (elements.presentationTargetSlides.value && (!Number.isFinite(targetSlideCount) || targetSlideCount < 1)) {
    elements.presentationTargetSlides.focus();
    return;
  }

  const busyButton = Object.prototype.hasOwnProperty.call(options, "button")
    ? options.button
    : elements.createPresentationButton;
  const done = busyButton ? setBusy(busyButton, options.busyLabel || "Creating...") : null;
  getCreationInputElements().forEach((element: any) => {
    element.disabled = true;
  });
  try {
    const deckPlan = options.deckPlan || getEditableDeckPlan();
    const creationFields = getCreationFields();
    const starterMaterialFile = elements.presentationMaterialFile.files && elements.presentationMaterialFile.files[0];
    const presentationMaterials = starterMaterialFile
      ? [{
          alt: starterMaterialFile.name,
          dataUrl: await readFileAsDataUrl(starterMaterialFile),
          fileName: starterMaterialFile.name,
          title: starterMaterialFile.name
        }]
      : [];
    const payload = await request("/api/presentations/draft/create", {
      body: JSON.stringify({
        approvedOutline: options.approvedOutline === true || state.creationDraft && state.creationDraft.approvedOutline === true,
        deckPlan: deckPlan || state.creationDraft && state.creationDraft.deckPlan,
        fields: creationFields,
        presentationMaterials,
        targetSlideCount: Number.isFinite(targetSlideCount) ? targetSlideCount : null
      }),
      method: "POST"
    });
    if (payload && payload.creationDraft) {
      state.creationDraft = payload.creationDraft;
      state.ui.creationStage = normalizeCreationStage(payload.creationDraft.stage || state.ui.creationStage);
      state.ui.creationContentSlideIndex = 1;
      state.ui.creationContentSlidePinned = false;
    }
    if (options.openStudio !== false) {
      resetPresentationSelection();
      await refreshState();
      setCurrentPage("studio");
      elements.operationStatus.textContent = "Generating slides from the approved outline. Completed slides replace placeholders as they validate.";
    } else {
      setCurrentPage("presentations");
      renderCreationDraft();
    }
  } finally {
    if (done) {
      done();
    }
    renderCreationDraft();
  }
}

async function saveCreationDraft(stage = state.ui.creationStage, options: any = {}) {
  const editableDeckPlan = getEditableDeckPlan();
  const shouldDirtyOutline = options.invalidateOutline
    && state.creationDraft
    && state.creationDraft.deckPlan;
  if (shouldDirtyOutline) {
    state.creationDraft = {
      ...state.creationDraft,
      approvedOutline: false,
      outlineDirty: true
    };
    renderCreationDraft();
  }

  const payload = await request("/api/presentations/draft", {
    body: JSON.stringify({
      approvedOutline: shouldDirtyOutline ? false : undefined,
      deckPlan: editableDeckPlan || undefined,
      fields: getCreationFields(),
      outlineLocks: getOutlineLocks(),
      outlineDirty: shouldDirtyOutline ? true : undefined,
      stage
    }),
    method: "POST"
  });
  state.creationDraft = payload.creationDraft || state.creationDraft;
  state.savedThemes = payload.savedThemes || state.savedThemes;
  renderSavedThemes();
  renderCreationDraft();
  return payload;
}

function scheduleCreationDraftSave(element) {
  if (isWorkflowRunning()) {
    return;
  }

  if (creationDraftSaveTimer) {
    window.clearTimeout(creationDraftSaveTimer);
  }

  creationDraftSaveTimer = window.setTimeout(() => {
    creationDraftSaveTimer = null;
    saveCreationDraft(state.ui.creationStage, {
      invalidateOutline: isOutlineRelevantInput(element)
    }).catch((error) => window.alert(error.message));
  }, 350);
}

async function generatePresentationOutline() {
  const title = elements.presentationTitle.value.trim();
  const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);
  if (!title) {
    elements.presentationTitle.focus();
    return;
  }
  if (elements.presentationTargetSlides.value && (!Number.isFinite(targetSlideCount) || targetSlideCount < 1)) {
    elements.presentationTargetSlides.focus();
    return;
  }

  const done = setBusy(elements.generatePresentationOutlineButton, "Generating...");
  getCreationInputElements().forEach((element: any) => {
    element.disabled = true;
  });
  try {
    const deckPlan = getEditableDeckPlan();
    const payload = await request("/api/presentations/draft/outline", {
      body: JSON.stringify({
        deckPlan: deckPlan || undefined,
        fields: getCreationFields(),
        outlineLocks: getOutlineLocks()
      }),
      method: "POST"
    });
    state.creationDraft = payload.creationDraft;
    setCreationStage("structure");
  } finally {
    done();
    renderCreationDraft();
  }
}

async function regeneratePresentationOutlineSlide(slideIndex) {
  const deckPlan = getEditableDeckPlan();
  if (!deckPlan || !Array.isArray(deckPlan.slides) || !deckPlan.slides[slideIndex]) {
    return;
  }

  const button: any = document.querySelector(`[data-outline-regenerate-slide-index="${slideIndex}"]`);
  const done = button ? setBusy(button, "Regenerating...") : null;
  getCreationInputElements().forEach((element: any) => {
    element.disabled = true;
  });
  try {
    const payload = await request("/api/presentations/draft/outline/slide", {
      body: JSON.stringify({
        deckPlan,
        fields: getCreationFields(),
        outlineLocks: getOutlineLocks(),
        slideIndex
      }),
      method: "POST"
    });
    state.creationDraft = payload.creationDraft;
    setCreationStage("structure");
  } finally {
    if (done) {
      done();
    }
    renderCreationDraft();
  }
}

async function approvePresentationOutline() {
  const deckPlan = getEditableDeckPlan();
  const approvedDeckPlan = deckPlan || state.creationDraft && state.creationDraft.deckPlan;
  if (!approvedDeckPlan) {
    return;
  }

  const done = setBusy(elements.approvePresentationOutlineButton, "Creating slides...");
  getCreationInputElements().forEach((element: any) => {
    element.disabled = true;
  });
  elements.regeneratePresentationOutlineButton.disabled = true;
  elements.regeneratePresentationOutlineWithSourcesButton.disabled = true;
  try {
    const payload = await request("/api/presentations/draft/approve", {
      body: JSON.stringify({
        deckPlan: approvedDeckPlan,
        outlineLocks: getOutlineLocks()
      }),
      method: "POST"
    });
    state.creationDraft = payload.creationDraft;
    elements.presentationCreationStatus.textContent = "Outline approved. Creating slides from the locked outline...";
    await createPresentationFromForm({
      approvedOutline: true,
      busyLabel: "Creating slides...",
      button: null,
      deckPlan: approvedDeckPlan,
      openStudio: true
    });
  } finally {
    done();
    renderCreationDraft();
  }
}

async function backToPresentationOutline() {
  const deckPlan = getEditableDeckPlan();
  const payload = await request("/api/presentations/draft", {
    body: JSON.stringify({
      approvedOutline: false,
      deckPlan: deckPlan || state.creationDraft && state.creationDraft.deckPlan,
      fields: getCreationFields(),
      outlineLocks: getOutlineLocks(),
      retrieval: state.creationDraft && state.creationDraft.retrieval,
      stage: "structure"
    }),
    method: "POST"
  });
  state.creationDraft = {
    ...(payload.creationDraft || state.creationDraft),
    approvedOutline: false
  };
  setCreationStage("structure");
}

async function savePresentationTheme() {
  const name = elements.presentationThemeName.value.trim() || elements.presentationTitle.value.trim() || "Saved theme";
  const done = setBusy(elements.savePresentationThemeButton, "Saving...");
  try {
    const payload = await request("/api/themes/save", {
      body: JSON.stringify({
        name,
        theme: getCreationFields().visualTheme
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

function openCreatedPresentation() {
  clearPresentationForm();
  setCurrentPage("studio");
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

async function duplicatePresentation(presentation, button = null) {
  const title = `${presentation.title || presentation.id} copy`;
  const done = button ? setBusy(button, "Duplicating...") : null;
  try {
    await request("/api/presentations/duplicate", {
      body: JSON.stringify({
        presentationId: presentation.id,
        title
      }),
      method: "POST"
    });
    resetPresentationSelection();
    await refreshState();
    setCurrentPage("studio");
  } finally {
    if (done) {
      done();
    }
  }
}

async function regeneratePresentation(presentation, button = null) {
  const confirmed = window.confirm(`Regenerate "${presentation.title || presentation.id}" from its saved context? This replaces the current slide files.`);
  if (!confirmed) {
    return;
  }

  const done = button ? setBusy(button, "Regenerating...") : null;
  try {
    await request("/api/presentations/regenerate", {
      body: JSON.stringify({
        presentationId: presentation.id
      }),
      method: "POST"
    });
    resetPresentationSelection();
    await refreshState();
    setCurrentPage("studio");
  } finally {
    if (done) {
      done();
    }
  }
}

async function deletePresentation(presentation, button = null) {
  const confirmed = window.confirm(`Delete "${presentation.title || presentation.id}"? This removes the presentation folder from this workspace.`);
  if (!confirmed) {
    return;
  }

  const done = button ? setBusy(button, "Deleting...") : null;
  try {
    await request("/api/presentations/delete", {
      body: JSON.stringify({ presentationId: presentation.id }),
      method: "POST"
    });
    resetPresentationSelection();
    await refreshState();
  } finally {
    if (done) {
      done();
    }
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
    applyCreationFields(state.creationDraft.fields);
    state.ui.creationStage = normalizeCreationStage(state.creationDraft.stage || state.ui.creationStage);
  }

  renderDeckFields();
  renderDeckLengthPlan();
  renderDeckStructureCandidates();
  renderSavedThemes();
  renderCreationDraft();
  renderPresentations();
  renderAssistant();
  renderStatus();
  renderPreviews();
  renderLayoutLibrary();
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

async function createSystemSlide() {
  const title = elements.manualSystemTitle.value.trim();
  const slideType = elements.manualSystemType ? elements.manualSystemType.value : "content";
  const summary = slideType === "divider" ? "" : elements.manualSystemSummary.value.trim();
  const selectedMaterialIds = elements.manualSystemMaterial
    ? Array.from(elements.manualSystemMaterial.selectedOptions || []).map((option: any) => option.value).filter(Boolean)
    : [];
  if (!title) {
    window.alert(slideType === "divider"
      ? "Add a title for the divider slide."
      : slideType === "quote"
        ? "Add a title for the quote slide."
        : slideType === "photo"
          ? "Add a title for the photo slide."
          : slideType === "photoGrid"
            ? "Add a title for the photo grid slide."
      : "Add a title for the system slide.");
    elements.manualSystemTitle.focus();
    return;
  }
  if (slideType === "quote" && !summary) {
    window.alert("Add the quote text.");
    elements.manualSystemSummary.focus();
    return;
  }
  if (slideType === "photo" && (!elements.manualSystemMaterial || !elements.manualSystemMaterial.value)) {
    window.alert("Choose a material for the photo slide.");
    if (elements.manualSystemMaterial) {
      elements.manualSystemMaterial.focus();
    }
    return;
  }
  if (slideType === "photoGrid" && selectedMaterialIds.length < 2) {
    window.alert("Choose at least two materials for the photo grid slide.");
    if (elements.manualSystemMaterial) {
      elements.manualSystemMaterial.focus();
    }
    return;
  }

  const done = setBusy(elements.createSystemSlideButton, "Creating...");
  try {
    const payload = await request("/api/slides/system", {
      body: JSON.stringify({
        afterSlideId: elements.manualSystemAfter.value,
        materialId: selectedMaterialIds[0] || "",
        materialIds: selectedMaterialIds,
        slideType,
        summary,
        title
      }),
      method: "POST"
    });
    state.context = payload.context || state.context;
    if (payload.domPreview) {
      setDomPreviewState(payload);
    }
    state.previews = payload.previews || state.previews;
    state.runtime = payload.runtime || state.runtime;
    state.slides = payload.slides || state.slides;
    state.deckStructureCandidates = [];
    state.selectedDeckStructureId = null;
    state.selectedSlideId = payload.insertedSlideId || state.selectedSlideId;
    state.selectedVariantId = null;
    elements.manualSystemTitle.value = "";
    elements.manualSystemSummary.value = "";
    if (elements.manualSystemType) {
      elements.manualSystemType.value = "content";
    }
    elements.manualSystemDetails.open = false;
    elements.openManualSystemButton.setAttribute("aria-expanded", "false");
    renderManualSlideForm();
    renderDeckFields();
    renderDeckLengthPlan();
    renderDeckStructureCandidates();
    renderStatus();
    renderPreviews();
    renderVariants();
    setCurrentPage("studio");
    await loadSlide(state.selectedSlideId);
    elements.operationStatus.textContent = slideType === "divider"
      ? `Created divider slide ${title}.`
      : slideType === "quote"
        ? `Created quote slide ${title}.`
        : slideType === "photo"
          ? `Created photo slide ${title}.`
          : slideType === "photoGrid"
            ? `Created photo grid slide ${title}.`
      : `Created system slide ${title}.`;
  } finally {
    done();
  }
}

async function deleteSlideFromDeck() {
  const slideId = elements.manualDeleteSlide.value;
  const slide = state.slides.find((entry) => entry.id === slideId);
  if (!slide) {
    window.alert("Choose a slide to remove.");
    return;
  }

  const confirmed = window.confirm(`Remove "${slide.title}" from the active deck? The slide file will be archived, not deleted.`);
  if (!confirmed) {
    return;
  }

  const done = setBusy(elements.deleteSlideButton, "Removing...");
  try {
    const payload = await request("/api/slides/delete", {
      body: JSON.stringify({ slideId }),
      method: "POST"
    });
    state.context = payload.context || state.context;
    if (payload.domPreview) {
      setDomPreviewState(payload);
    }
    state.previews = payload.previews || state.previews;
    state.runtime = payload.runtime || state.runtime;
    state.slides = payload.slides || state.slides;
    state.deckStructureCandidates = [];
    state.selectedDeckStructureId = null;
    state.selectedSlideId = payload.selectedSlideId || (state.slides[0] ? state.slides[0].id : null);
    state.selectedVariantId = null;
    renderDeckFields();
    renderDeckLengthPlan();
    renderDeckStructureCandidates();
    renderStatus();
    renderPreviews();
    renderVariants();
    setCurrentPage("studio");
    if (state.selectedSlideId) {
      await loadSlide(state.selectedSlideId);
    }
    elements.manualDeleteDetails.open = false;
    elements.openManualDeleteButton.setAttribute("aria-expanded", "false");
    elements.operationStatus.textContent = `Removed ${slide.title} from the deck.`;
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

async function saveSlideContext() {
  const payload = await request(`/api/slides/${state.selectedSlideId}/context`, {
    body: JSON.stringify({
      intent: elements.slideIntent.value,
      layoutHint: elements.slideLayoutHint.value,
      mustInclude: elements.slideMustInclude.value,
      notes: elements.slideNotes.value,
      title: elements.slideTitle.value
    }),
    method: "POST"
  });

  state.context = payload.context;
  renderSlideFields();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read material file")));
    reader.readAsDataURL(file);
  });
}

async function uploadMaterial() {
  const file = elements.materialFile.files && elements.materialFile.files[0];
  if (!file) {
    window.alert("Choose an image to upload.");
    elements.materialFile.focus();
    return;
  }

  const done = setBusy(elements.materialUploadButton, "Uploading...");
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const payload = await request("/api/materials", {
      body: JSON.stringify({
        alt: elements.materialAlt.value.trim(),
        caption: elements.materialCaption.value.trim(),
        dataUrl,
        fileName: file.name,
        title: file.name
      }),
      method: "POST"
    });

    state.materials = payload.materials || state.materials;
    elements.materialFile.value = "";
    if (!elements.materialAlt.value.trim()) {
      elements.materialAlt.value = payload.material && payload.material.alt ? payload.material.alt : "";
    }
    renderMaterials();
    elements.operationStatus.textContent = `Uploaded material ${payload.material.title}.`;
  } finally {
    done();
  }
}

function applySlideMaterialPayload(payload, fallbackSpec) {
  applySlideSpecPayload(payload, fallbackSpec);
  if (payload.domPreview) {
    setDomPreviewState(payload);
  }
  state.materials = payload.materials || state.materials;
  renderSlideFields();
  renderPreviews();
  renderVariantComparison();
  renderStatus();
}

async function attachMaterialToSlide(material, button = null) {
  if (!state.selectedSlideId) {
    return;
  }

  const done = button ? setBusy(button, "Attaching...") : null;
  try {
    const payload = await request(`/api/slides/${state.selectedSlideId}/material`, {
      body: JSON.stringify({
        alt: elements.materialAlt.value.trim() || material.alt || material.title,
        caption: elements.materialCaption.value.trim() || material.caption || "",
        materialId: material.id
      }),
      method: "POST"
    });
    applySlideMaterialPayload(payload, payload.slideSpec);
    elements.operationStatus.textContent = `Attached ${material.title} to the selected slide.`;
  } finally {
    if (done) {
      done();
    }
  }
}

async function detachMaterialFromSlide() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.materialDetachButton, "Detaching...");
  try {
    const payload = await request(`/api/slides/${state.selectedSlideId}/material`, {
      body: JSON.stringify({ materialId: "" }),
      method: "POST"
    });
    applySlideMaterialPayload(payload, payload.slideSpec);
    elements.operationStatus.textContent = "Detached material from the selected slide.";
  } finally {
    done();
  }
}

async function saveCurrentLayout() {
  if (!state.selectedSlideId || !state.selectedSlideSpec) {
    return;
  }

  const fallbackName = `${state.selectedSlideSpec.layout || "standard"} ${state.selectedSlideSpec.type || "slide"}`;
  const done = setBusy(elements.saveLayoutButton, "Saving...");
  try {
    const payload = await request("/api/layouts/save", {
      body: JSON.stringify({
        name: elements.layoutSaveName.value.trim() || fallbackName,
        slideId: state.selectedSlideId
      }),
      method: "POST"
    });
    state.layouts = payload.layouts || state.layouts;
    elements.layoutSaveName.value = "";
    renderLayoutLibrary();
    if (payload.layout && elements.layoutLibrarySelect) {
      elements.layoutLibrarySelect.value = `deck:${payload.layout.id}`;
    }
    elements.operationStatus.textContent = `Saved layout ${payload.layout.name}.`;
  } finally {
    done();
  }
}

async function saveSelectedLayoutAsFavorite() {
  const selectedValue = elements.layoutLibrarySelect.value || "";
  if (!selectedValue || selectedValue.startsWith("favorite:")) {
    return;
  }

  const done = setBusy(elements.favoriteLayoutButton, "Saving...");
  try {
    const payload = await request("/api/layouts/favorites/save", {
      body: JSON.stringify({
        layoutId: selectedValue.replace(/^deck:/, "")
      }),
      method: "POST"
    });
    state.favoriteLayouts = payload.favoriteLayouts || state.favoriteLayouts;
    renderLayoutLibrary();
    if (payload.favoriteLayout && elements.layoutLibrarySelect) {
      elements.layoutLibrarySelect.value = `favorite:${payload.favoriteLayout.id}`;
    }
    elements.operationStatus.textContent = `Saved favorite layout ${payload.favoriteLayout.name}.`;
  } finally {
    done();
  }
}

async function deleteSelectedFavoriteLayout() {
  const selectedValue = elements.layoutLibrarySelect.value || "";
  if (!selectedValue.startsWith("favorite:")) {
    return;
  }

  const done = setBusy(elements.deleteFavoriteLayoutButton, "Deleting...");
  try {
    const payload = await request("/api/layouts/favorites/delete", {
      body: JSON.stringify({
        layoutId: selectedValue.slice("favorite:".length)
      }),
      method: "POST"
    });
    state.favoriteLayouts = payload.favoriteLayouts || [];
    renderLayoutLibrary();
    elements.operationStatus.textContent = "Deleted favorite layout.";
  } finally {
    done();
  }
}

async function saveVariantLayout(variant, favorite = false, button = null) {
  if (!canSaveVariantLayout(variant)) {
    return;
  }

  const label = variant.label || `${variant.slideSpec.layout} layout`;
  const layoutName = label
    .replace(/^Use (deck|favorite) layout:\s*/i, "")
    .replace(/\s+candidate$/i, "");
  const done = button ? setBusy(button, favorite ? "Saving favorite..." : "Saving...") : () => {};
  try {
    const payload = await request("/api/layouts/candidates/save", {
      body: JSON.stringify({
        description: variant.notes || variant.promptSummary || "",
        favorite,
        layoutDefinition: variant.layoutDefinition || null,
        layoutPreview: variant.layoutPreview || null,
        name: layoutName,
        operation: variant.operation || null,
        slideSpec: variant.slideSpec
      }),
      method: "POST"
    });
    state.layouts = payload.layouts || state.layouts;
    state.favoriteLayouts = payload.favoriteLayouts || state.favoriteLayouts;
    renderLayoutLibrary();
    elements.operationStatus.textContent = favorite
      ? `Saved favorite layout ${payload.favoriteLayout.name}.`
      : `Saved layout ${payload.layout.name}.`;
  } finally {
    done();
  }
}

function parseCustomLayoutDefinitionJson() {
  const source = elements.customLayoutJson.value.trim();
  if (!source) {
    throw new Error("Create a custom layout draft before preview.");
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error("Custom layout JSON must be valid JSON.");
  }
}

async function previewCustomLayout() {
  if (!state.selectedSlideId || !getCustomLayoutSupported()) {
    window.alert("Custom layout authoring starts with a content or cover slide.");
    return;
  }

  const done = setBusy(elements.customLayoutPreviewButton, "Previewing...");
  try {
    const layoutDefinition = parseCustomLayoutDefinitionJson();
    state.ui.customLayoutDefinitionPreviewActive = true;
    state.ui.customLayoutMainPreviewActive = true;
    elements.customLayoutStatus.textContent = "Live preview";
    renderPreviews();
    const payload = await request("/api/layouts/custom/preview", {
      body: JSON.stringify({
        label: elements.layoutSaveName.value.trim() || "Custom content layout",
        layoutDefinition,
        layoutTreatment: normalizeLayoutTreatment(elements.customLayoutTreatment.value),
        multiSlidePreview: elements.customLayoutMultiPreview.checked,
        notes: elements.customLayoutMultiPreview.checked
          ? "Favorite-ready custom layout preview."
          : "Deck-local custom layout preview.",
        slideId: state.selectedSlideId
      }),
      method: "POST"
    });
    state.previews = payload.previews;
    state.runtime = payload.runtime;
    clearTransientVariants(state.selectedSlideId);
    state.transientVariants = [
      ...(payload.transientVariants || []),
      ...state.transientVariants
    ];
    state.variants = payload.variants;
    state.selectedVariantId = null;
    state.ui.variantReviewOpen = true;
    elements.customLayoutStatus.textContent = elements.customLayoutMultiPreview.checked ? "Applicable: favorite-ready" : "Previewable";
    elements.operationStatus.textContent = payload.summary;
    openVariantGenerationControls();
    renderStatus();
    renderPreviews();
    renderVariants();
  } finally {
    done();
  }
}

async function quickCustomLayout() {
  if (!state.selectedSlideId || !getCustomLayoutSupported()) {
    window.alert("Custom layout authoring starts with a content or cover slide.");
    return;
  }

  elements.customLayoutProfile.value = elements.quickCustomLayoutProfile.value || "balanced-grid";
  setCustomLayoutJson(createCustomLayoutDefinitionFromControls());
  elements.customLayoutMultiPreview.checked = false;
  await previewCustomLayout();
}

async function previewLayoutStudioDesign() {
  if (!state.selectedSlideId || !getCustomLayoutSupported()) {
    window.alert("Select a content or cover slide before previewing a layout design.");
    return;
  }

  const definition = createLayoutStudioDefinitionFromControls();
  setCustomLayoutJson(definition);
  elements.customLayoutTreatment.value = normalizeLayoutTreatment(elements.layoutStudioTreatment.value);
  elements.customLayoutMultiPreview.checked = elements.layoutStudioMultiPreview.checked;
  await previewCustomLayout();
  elements.layoutStudioStatus.textContent = elements.layoutStudioMultiPreview.checked
    ? "Favorite-ready preview created."
    : "Current-slide preview created.";
}

function parseLayoutExchangeJson() {
  const source = elements.layoutExchangeJson.value.trim();
  if (!source) {
    throw new Error("Paste layout JSON before importing.");
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error("Layout JSON must be valid JSON.");
  }
}

async function copySelectedLayoutJson() {
  const selectedValue = elements.layoutLibrarySelect.value || "";
  if (!selectedValue) {
    return;
  }

  const scope = selectedValue.startsWith("favorite:") ? "favorite" : "deck";
  const layoutId = selectedValue.replace(/^(deck|favorite):/, "");
  const done = setBusy(elements.copyLayoutJsonButton, "Copying...");
  try {
    const payload = await request("/api/layouts/export", {
      body: JSON.stringify({ layoutId, scope }),
      method: "POST"
    });
    const formatted = JSON.stringify(payload.document, null, 2);
    elements.layoutExchangeJson.value = formatted;
    elements.layoutExchangeJson.focus();
    elements.layoutExchangeJson.select();
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(formatted);
        elements.operationStatus.textContent = "Copied selected layout JSON.";
      } catch (error) {
        elements.operationStatus.textContent = "Exported selected layout JSON.";
      }
    } else {
      elements.operationStatus.textContent = "Exported selected layout JSON.";
    }
    renderLayoutLibrary();
  } finally {
    done();
  }
}

async function copyLayoutPackJson(scope) {
  const button = scope === "favorite" ? elements.copyFavoriteLayoutPackButton : elements.copyDeckLayoutPackButton;
  const done = setBusy(button, "Copying...");
  try {
    const payload = await request("/api/layouts/export", {
      body: JSON.stringify({ pack: true, scope }),
      method: "POST"
    });
    const formatted = JSON.stringify(payload.document, null, 2);
    elements.layoutExchangeJson.value = formatted;
    elements.layoutExchangeJson.focus();
    elements.layoutExchangeJson.select();
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(formatted);
        elements.operationStatus.textContent = `Copied ${scope === "favorite" ? "favorite" : "deck"} layout pack JSON.`;
      } catch (error) {
        elements.operationStatus.textContent = `Exported ${scope === "favorite" ? "favorite" : "deck"} layout pack JSON.`;
      }
    } else {
      elements.operationStatus.textContent = `Exported ${scope === "favorite" ? "favorite" : "deck"} layout pack JSON.`;
    }
    renderLayoutLibrary();
  } finally {
    done();
  }
}

async function importLayoutJson(scope) {
  const document = parseLayoutExchangeJson();
  const button = scope === "favorite" ? elements.importLayoutFavoriteButton : elements.importLayoutDeckButton;
  const done = setBusy(button, "Importing...");
  try {
    const payload = await request("/api/layouts/import", {
      body: JSON.stringify({ document, scope }),
      method: "POST"
    });
    state.layouts = payload.layouts || state.layouts;
    state.favoriteLayouts = payload.favoriteLayouts || state.favoriteLayouts;
    renderLayoutLibrary();
    if (payload.layout && elements.layoutLibrarySelect) {
      elements.layoutLibrarySelect.value = `${scope === "favorite" ? "favorite" : "deck"}:${payload.layout.id}`;
      renderLayoutLibrary();
    }
    const importedLayouts = Array.isArray(payload.importedLayouts)
      ? payload.importedLayouts
      : payload.layout
        ? [payload.layout]
        : [];
    elements.operationStatus.textContent = importedLayouts.length === 1 && payload.layout
      ? `Imported layout ${payload.layout.name}.`
      : `Imported ${importedLayouts.length} layouts.`;
  } finally {
    done();
  }
}

async function applySavedLayout() {
  if (!state.selectedSlideId || !elements.layoutLibrarySelect.value) {
    return;
  }

  const done = setBusy(elements.applyLayoutButton, "Applying...");
  try {
    const payload = await request("/api/layouts/apply", {
      body: JSON.stringify({
        layoutId: elements.layoutLibrarySelect.value,
        slideId: state.selectedSlideId
      }),
      method: "POST"
    });
    state.layouts = payload.layouts || state.layouts;
    state.favoriteLayouts = payload.favoriteLayouts || state.favoriteLayouts;
    applySlideSpecPayload(payload, payload.slideSpec);
    if (payload.domPreview) {
      setDomPreviewState(payload);
    }
    renderLayoutLibrary();
    renderSlideFields();
    renderPreviews();
    renderVariants();
    elements.operationStatus.textContent = "Applied saved layout to the selected slide.";
  } finally {
    done();
  }
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

function parseSlideSpecEditor() {
  if (!state.selectedSlideStructured) {
    throw new Error("Structured editing is not available for this slide.");
  }

  try {
    const slideSpec = JSON.parse(elements.slideSpecEditor.value);
    if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
      throw new Error("Slide spec JSON must be an object.");
    }
    return slideSpec;
  } catch (error) {
    throw new Error(`Slide spec JSON is invalid: ${error.message}`);
  }
}

function previewSlideSpecEditorDraft() {
  if (!state.selectedSlideStructured || !state.selectedSlideId) {
    return;
  }

  let slideSpec;
  try {
    slideSpec = JSON.parse(elements.slideSpecEditor.value);
    if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
      throw new Error("Slide spec JSON must be an object.");
    }
  } catch (error) {
    state.selectedSlideSpecDraftError = error.message;
    elements.saveSlideSpecButton.disabled = true;
    elements.slideSpecStatus.textContent = `Slide spec JSON is invalid: ${error.message}`;
    return;
  }

  state.selectedSlideSpec = slideSpec;
  state.selectedSlideSpecDraftError = null;
  patchDomSlideSpec(state.selectedSlideId, slideSpec);
  elements.saveSlideSpecButton.disabled = false;
  elements.slideSpecStatus.textContent = "Previewing unsaved JSON edits. Save persists without rebuilding.";
  renderPreviews();
  renderVariantComparison();
}

function scheduleSlideSpecEditorPreview() {
  updateSlideSpecHighlight();

  if (slideSpecPreviewFrame !== null && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(slideSpecPreviewFrame);
  }

  const preview = () => {
    slideSpecPreviewFrame = null;
    previewSlideSpecEditorDraft();
  };

  if (typeof window.requestAnimationFrame === "function") {
    slideSpecPreviewFrame = window.requestAnimationFrame(preview);
    return;
  }

  preview();
}

async function saveSlideSpec() {
  if (!state.selectedSlideId) {
    return;
  }

  const slideSpec = parseSlideSpecEditor();
  const done = setBusy(elements.saveSlideSpecButton, "Saving...");
  try {
    const payload = await request(`/api/slides/${state.selectedSlideId}/slide-spec`, {
      body: JSON.stringify({
        rebuild: false,
        slideSpec
      }),
      method: "POST"
    });
    applySlideSpecPayload(payload, slideSpec);
    renderSlideFields();
    renderPreviews();
    renderVariantComparison();
    renderStatus();
    elements.operationStatus.textContent = "Saved slide spec.";
  } finally {
    done();
  }
}

async function captureVariant() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.captureVariantButton, "Capturing...");
  try {
    const payloadBody: any = {
      label: elements.variantLabel.value,
      slideId: state.selectedSlideId
    };

    if (state.selectedSlideStructured) {
      payloadBody.slideSpec = parseSlideSpecEditor();
    }

    const payload = await request("/api/variants/capture", {
      body: JSON.stringify(payloadBody),
      method: "POST"
    });
    state.variantStorage = payload.variantStorage || state.variantStorage;
    replacePersistedVariantsForSlide(state.selectedSlideId, payload.variants || [payload.variant]);
    clearTransientVariants(state.selectedSlideId);
    state.selectedVariantId = payload.variant.id;
    state.ui.variantReviewOpen = true;
    elements.variantLabel.value = "";
    elements.operationStatus.textContent = `Captured ${payload.variant.label} for comparison.`;
    openVariantGenerationControls();
    renderVariants();
  } finally {
    done();
  }
}

async function applyVariantById(variantId, options: any = {}) {
  const variant = getSlideVariants().find((entry) => entry.id === variantId);
  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  let payload;
  if (variant.persisted === false) {
    if (variant.slideSpec) {
      payload = await request(`/api/slides/${variant.slideId}/slide-spec`, {
        body: JSON.stringify({
          rebuild: true,
          preserveSlidePosition: true,
          selectionScope: variant.operationScope || null,
          slideSpec: variant.slideSpec,
          visualTheme: variant.visualTheme || null
        }),
        method: "POST"
      });
    } else {
      payload = await request(`/api/slides/${variant.slideId}/source`, {
        body: JSON.stringify({
          rebuild: true,
          source: variant.source,
          visualTheme: variant.visualTheme || null
        }),
        method: "POST"
      });
    }
    payload.slideId = variant.slideId;
  } else {
    payload = await request("/api/variants/apply", {
      body: JSON.stringify({ variantId }),
      method: "POST"
    });
  }
  state.previews = payload.previews;
  state.context = payload.context || state.context;
  if (payload.domPreview) {
    setDomPreviewState(payload);
  }
  state.variantStorage = payload.variantStorage || state.variantStorage;
  elements.operationStatus.textContent = `Applied ${options.label || "variant"} to ${payload.slideId}.`;
  clearTransientVariants(payload.slideId);
  await loadSlide(payload.slideId);
  state.ui.variantReviewOpen = false;
  renderVariants();

  if (options.validateAfter) {
    await validate(false);
    elements.operationStatus.textContent = `Applied ${options.label || "variant"} and ran checks.`;
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

function applyDeckStructureWorkflowPayload(payload) {
  workflowRunners.applyDeckStructurePayload(payload);
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

function applySlideWorkflowPayload(payload, slideId) {
  workflowRunners.applySlidePayload(payload, slideId);
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

function mountContentRunControls() {
  StudioClientContentRunActions.mountContentRunControls({
    elements,
    refreshState,
    renderCreationDraft,
    request,
    setBusy,
    state
  });
}

function mountStudioCommandControls() {
elements.checkLlmButton.addEventListener("click", () => checkLlmProvider().catch((error) => window.alert(error.message)));
elements.ideateDeckStructureButton.addEventListener("click", () => ideateDeckStructure().catch((error) => window.alert(error.message)));
elements.deckLengthPlanButton.addEventListener("click", () => planDeckLength().catch((error) => window.alert(error.message)));
elements.deckLengthApplyButton.addEventListener("click", () => applyDeckLength().catch((error) => window.alert(error.message)));
elements.openManualSystemButton.addEventListener("click", () => setManualSlideDetailsOpen("system"));
elements.openManualDeleteButton.addEventListener("click", () => setManualSlideDetailsOpen("delete"));
elements.createSystemSlideButton.addEventListener("click", () => createSystemSlide().catch((error) => window.alert(error.message)));
elements.deleteSlideButton.addEventListener("click", () => deleteSlideFromDeck().catch((error) => window.alert(error.message)));
elements.materialUploadButton.addEventListener("click", () => uploadMaterial().catch((error) => window.alert(error.message)));
elements.materialDetachButton.addEventListener("click", () => detachMaterialFromSlide().catch((error) => window.alert(error.message)));
elements.saveLayoutButton.addEventListener("click", () => saveCurrentLayout().catch((error) => window.alert(error.message)));
elements.applyLayoutButton.addEventListener("click", () => applySavedLayout().catch((error) => window.alert(error.message)));
elements.favoriteLayoutButton.addEventListener("click", () => saveSelectedLayoutAsFavorite().catch((error) => window.alert(error.message)));
elements.deleteFavoriteLayoutButton.addEventListener("click", () => deleteSelectedFavoriteLayout().catch((error) => window.alert(error.message)));
elements.layoutLibrarySelect.addEventListener("change", renderLayoutLibrary);
elements.copyLayoutJsonButton.addEventListener("click", () => copySelectedLayoutJson().catch((error) => window.alert(error.message)));
elements.copyDeckLayoutPackButton.addEventListener("click", () => copyLayoutPackJson("deck").catch((error) => window.alert(error.message)));
elements.copyFavoriteLayoutPackButton.addEventListener("click", () => copyLayoutPackJson("favorite").catch((error) => window.alert(error.message)));
elements.importLayoutDeckButton.addEventListener("click", () => importLayoutJson("deck").catch((error) => window.alert(error.message)));
elements.importLayoutFavoriteButton.addEventListener("click", () => importLayoutJson("favorite").catch((error) => window.alert(error.message)));
elements.layoutExchangeJson.addEventListener("input", renderLayoutLibrary);
elements.customLayoutLoadButton.addEventListener("click", () => loadCustomLayoutDraftFromSelection());
elements.customLayoutPreviewButton.addEventListener("click", () => previewCustomLayout().catch((error) => {
  elements.customLayoutStatus.textContent = "Draft needs review";
  window.alert(error.message);
}));
elements.customLayoutDiscardButton.addEventListener("click", () => {
  elements.customLayoutJson.value = "";
  state.ui.customLayoutDraftSlideId = "";
  state.ui.customLayoutDraftSlideType = "";
  state.ui.customLayoutDefinitionPreviewActive = false;
  state.ui.customLayoutMainPreviewActive = false;
  renderCustomLayoutEditor();
  renderPreviews();
  elements.customLayoutStatus.textContent = "Draft";
});
[elements.customLayoutProfile, elements.customLayoutSpacing, elements.customLayoutMinFont].forEach((element) => {
  element.addEventListener("change", refreshCustomLayoutDraftFromControls);
});
elements.customLayoutTreatment.addEventListener("change", refreshCustomLayoutTreatmentFromControl);
elements.customLayoutJson.addEventListener("input", () => {
  state.ui.customLayoutDefinitionPreviewActive = false;
  state.ui.customLayoutMainPreviewActive = false;
  elements.customLayoutStatus.textContent = "Draft";
  renderCustomLayoutEditor();
  renderPreviews();
});
elements.customLayoutPreviewSlideTab.addEventListener("click", () => setCustomLayoutPreviewMode("slide"));
elements.customLayoutPreviewMapTab.addEventListener("click", () => setCustomLayoutPreviewMode("map"));
elements.layoutLibraryDetails.addEventListener("toggle", () => {
  renderLayoutLibrary();
});
elements.layoutDrawerToggle.addEventListener("click", () => setLayoutDrawerOpen(!state.ui.layoutDrawerOpen));
elements.addSourceButton.addEventListener("click", () => addSource().catch((error) => window.alert(error.message)));
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
elements.ideateSlideButton.addEventListener("click", () => ideateSlide().catch((error) => window.alert(error.message)));
elements.ideateStructureButton.addEventListener("click", () => ideateStructure().catch((error) => window.alert(error.message)));
elements.ideateThemeButton.addEventListener("click", () => ideateTheme().catch((error) => window.alert(error.message)));
elements.redoLayoutButton.addEventListener("click", () => redoLayout().catch((error) => window.alert(error.message)));
elements.quickCustomLayoutButton.addEventListener("click", () => quickCustomLayout().catch((error) => window.alert(error.message)));
elements.layoutStudioPreviewButton.addEventListener("click", () => previewLayoutStudioDesign().catch((error) => window.alert(error.message)));
elements.layoutStudioLoadSelectedButton.addEventListener("click", () => {
  const entry = getLayoutByStudioRef(state.layoutStudioSelectedRef);
  if (entry) {
    loadLayoutStudioDefinition(entry.layout);
    renderLayoutStudio();
  }
});
elements.layoutStudioOpenSlideButton.addEventListener("click", () => {
  setCurrentPage("studio");
  setLayoutDrawerOpen(true);
});
[elements.layoutStudioProfile, elements.layoutStudioSpacing, elements.layoutStudioMinFont, elements.layoutStudioTreatment].forEach((element) => {
  element.addEventListener("change", renderLayoutStudio);
});
elements.compareApplyButton.addEventListener("click", () => {
  const variant = getSelectedVariant();
  if (!variant) {
    return;
  }

  applyVariantById(variant.id, {
    label: variant.label,
    validateAfter: false
  }).catch((error) => window.alert(error.message));
});
elements.compareApplyValidateButton.addEventListener("click", () => {
  const variant = getSelectedVariant();
  if (!variant) {
    return;
  }

  applyVariantById(variant.id, {
    label: variant.label,
    validateAfter: true
  }).catch((error) => window.alert(error.message));
});
elements.saveSlideSpecButton.addEventListener("click", () => saveSlideSpec().catch((error) => window.alert(error.message)));
elements.slideSpecEditor.addEventListener("input", scheduleSlideSpecEditorPreview);
elements.slideSpecEditor.addEventListener("scroll", updateSlideSpecHighlight);
elements.activePreview.addEventListener("dblclick", (event) => {
  const target = event.target.closest("[data-edit-path]");
  if (!target || !elements.activePreview.contains(target)) {
    return;
  }

  event.preventDefault();
  beginInlineTextEdit(target, target.dataset.editPath);
});
elements.activePreview.addEventListener("mouseup", captureAssistantSelection);
elements.activePreview.addEventListener("keyup", captureAssistantSelection);
elements.captureVariantButton.addEventListener("click", () => captureVariant().catch((error) => window.alert(error.message)));
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
elements.exitVariantReviewButton.addEventListener("click", exitVariantReview);
elements.structuredDraftToggle.addEventListener("click", () => {
  setStructuredDraftDrawerOpen(!state.ui.structuredDraftOpen);
});
elements.themeDrawerToggle.addEventListener("click", () => {
  setThemeDrawerOpen(!state.ui.themeDrawerOpen);
});
elements.generateThemeFromBriefButton.addEventListener("click", () => {
  generateThemeFromBrief().catch((error) => window.alert(error.message));
});
elements.generateThemeCandidatesButton.addEventListener("click", () => {
  if (state.ui.themeCandidatesGenerated) {
    state.ui.themeCandidateRefreshIndex += 1;
  } else {
    state.ui.themeCandidateRefreshIndex = 0;
  }
  state.ui.themeCandidatesGenerated = true;
  state.ui.creationThemeVariantId = "current";
  renderCreationThemeStage();
});
elements.saveDeckContextButton.addEventListener("click", () => saveDeckContext().catch((error) => window.alert(error.message)));
elements.generateOutlinePlanButton.addEventListener("click", () => generateOutlinePlan().catch((error) => window.alert(error.message)));
elements.saveDeckThemeButton.addEventListener("click", () => saveDeckTheme().catch((error) => window.alert(error.message)));
elements.saveValidationSettingsButton.addEventListener("click", () => saveValidationSettings().catch((error) => window.alert(error.message)));
elements.saveSlideContextButton.addEventListener("click", () => saveSlideContext().catch((error) => window.alert(error.message)));
elements.generatePresentationOutlineButton.addEventListener("click", () => generatePresentationOutline().catch((error) => window.alert(error.message)));
elements.regeneratePresentationOutlineButton.addEventListener("click", () => generatePresentationOutline().catch((error) => window.alert(error.message)));
elements.regeneratePresentationOutlineWithSourcesButton.addEventListener("click", () => {
  elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
  generatePresentationOutline().catch((error) => window.alert(error.message));
});
elements.approvePresentationOutlineButton.addEventListener("click", () => approvePresentationOutline().catch((error) => window.alert(error.message)));
elements.backToPresentationOutlineButton.addEventListener("click", () => backToPresentationOutline().catch((error) => window.alert(error.message)));
elements.createPresentationButton.addEventListener("click", () => createPresentationFromForm().catch((error) => window.alert(error.message)));
if (elements.savePresentationThemeButton) {
  elements.savePresentationThemeButton.addEventListener("click", () => savePresentationTheme().catch((error) => window.alert(error.message)));
}
if (elements.openCreatedPresentationButton) {
  elements.openCreatedPresentationButton.addEventListener("click", openCreatedPresentation);
}
elements.openPresentationModeButton.addEventListener("click", openPresentationMode);
elements.presentationSavedTheme.addEventListener("change", () => {
  applySavedTheme(elements.presentationSavedTheme.value);
  state.ui.creationThemeVariantId = "current";
  renderCreationThemeStage();
  saveCreationDraft("theme").catch((error) => window.alert(error.message));
});
if (elements.manualSystemType) {
  elements.manualSystemType.addEventListener("change", renderManualSlideForm);
}
elements.presentationThemeVariantList.addEventListener("click", (event) => {
  const target: any = event.target;
  const button = target.closest("[data-creation-theme-variant]");
  if (!button || !elements.presentationThemeVariantList.contains(button)) {
    return;
  }

  state.ui.creationThemeVariantId = button.dataset.creationThemeVariant || "current";
  const variant = getSelectedCreationThemeVariant();
  if (variant.id !== "current") {
    applyCreationTheme(variant.theme);
  } else {
    renderCreationThemeStage();
  }
  persistSelectedThemeToDeck().catch((error) => window.alert(error.message));
});
elements.themeFavoriteList.addEventListener("click", (event) => {
  const target: any = event.target;
  const button = target.closest("[data-theme-favorite-id]");
  if (!button || !elements.themeFavoriteList.contains(button)) {
    return;
  }

  applySavedThemeToDeck(button.dataset.themeFavoriteId);
  persistSelectedThemeToDeck().catch((error) => window.alert(error.message));
});
elements.presentationSearch.addEventListener("input", renderPresentations);
document.querySelectorAll("[data-creation-stage]").forEach((button: any) => {
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }

    const nextStage = normalizeCreationStage(button.dataset.creationStage);
    setCreationStage(nextStage);
    saveCreationDraft(nextStage).catch((error) => window.alert(error.message));
  });
});

[elements.presentationOutlineList, elements.presentationOutlineTitle, elements.presentationOutlineSummary].filter(Boolean).forEach((element) => {
  element.addEventListener("input", (event) => {
    const target: any = event.target;
    if (target && (target.dataset.outlineField || target.dataset.outlineSlideField)) {
      markOutlineEditedLocally();
    }
  });
  element.addEventListener("change", (event) => {
    const target: any = event.target;
    if (target && (target.dataset.outlineField || target.dataset.outlineSlideField)) {
      saveEditableOutlineDraft({ render: false }).catch((error) => window.alert(error.message));
    }
  });
});
elements.presentationOutlineList.addEventListener("click", (event) => {
  const target: any = event.target;
  const lockButton = target.closest("[data-outline-lock-slide-index]");
  if (lockButton && elements.presentationOutlineList.contains(lockButton)) {
    const slideIndex = Number.parseInt(lockButton.dataset.outlineLockSlideIndex, 10);
    if (Number.isFinite(slideIndex)) {
      setOutlineSlideLocked(slideIndex, lockButton.getAttribute("aria-pressed") !== "true");
      saveEditableOutlineDraft().catch((error) => window.alert(error.message));
    }
    return;
  }

  const regenerateButton = target.closest("[data-outline-regenerate-slide-index]");
  if (regenerateButton && elements.presentationOutlineList.contains(regenerateButton)) {
    const slideIndex = Number.parseInt(regenerateButton.dataset.outlineRegenerateSlideIndex, 10);
    if (Number.isFinite(slideIndex)) {
      regeneratePresentationOutlineSlide(slideIndex).catch((error) => window.alert(error.message));
    }
  }
});

mountContentRunControls();
}

function mountPresentationCreateInputs() {
[
  elements.presentationTitle,
  elements.presentationAudience,
  elements.presentationTone,
  elements.presentationTargetSlides,
  elements.presentationObjective,
  elements.presentationConstraints,
  elements.presentationSourcingStyle,
  elements.presentationThemeBrief,
  elements.presentationSourceText,
  elements.presentationOutlineSourceText,
  elements.presentationImageSearchQuery,
  elements.presentationImageSearchProvider,
  elements.presentationImageSearchRestrictions,
  elements.presentationFontFamily,
  elements.presentationThemePrimary,
  elements.presentationThemeSecondary,
  elements.presentationThemeAccent,
  elements.presentationThemeBg,
  elements.presentationThemePanel
].forEach((element) => {
  element.addEventListener("input", () => {
    if (element === elements.presentationOutlineSourceText) {
      elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
    }
    if (element === elements.presentationSourceText) {
      elements.presentationOutlineSourceText.value = elements.presentationSourceText.value;
    }
    if ([
      elements.presentationFontFamily,
      elements.presentationThemePrimary,
      elements.presentationThemeSecondary,
      elements.presentationThemeAccent,
      elements.presentationThemeBg,
      elements.presentationThemePanel
    ].includes(element)) {
      state.ui.creationThemeVariantId = "current";
      renderCreationThemeStage();
    }
    scheduleCreationDraftSave(element);
  });
  element.addEventListener("change", () => {
    if (creationDraftSaveTimer) {
      window.clearTimeout(creationDraftSaveTimer);
      creationDraftSaveTimer = null;
    }
    if (element === elements.presentationOutlineSourceText) {
      elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
    }
    if (element === elements.presentationSourceText) {
      elements.presentationOutlineSourceText.value = elements.presentationSourceText.value;
    }
    if ([
      elements.presentationFontFamily,
      elements.presentationThemePrimary,
      elements.presentationThemeSecondary,
      elements.presentationThemeAccent,
      elements.presentationThemeBg,
      elements.presentationThemePanel
    ].includes(element)) {
      state.ui.creationThemeVariantId = "current";
      renderCreationThemeStage();
    }
    saveCreationDraft(state.ui.creationStage, {
      invalidateOutline: isOutlineRelevantInput(element)
    }).catch((error) => window.alert(error.message));
  });
});
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
    state.ui.creationThemeVariantId = "current";
    renderCreationThemeStage();
  });
  element.addEventListener("change", () => {
    if (element === elements.deckThemeBrief || element === elements.themeBrief) {
      setDeckThemeBriefValue(element.value);
    }
    state.ui.creationThemeVariantId = "current";
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
  mountPresentationCreateInputs();
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
