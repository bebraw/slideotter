const state: any = {
  assistant: {
    selection: null,
    session: null,
    suggestions: []
  },
  context: null,
  deckLengthPlan: null,
  deckStructureCandidates: [],
  domPreview: {
    slides: [],
    theme: null
  },
  materials: [],
  presentations: {
    activePresentationId: null,
    presentations: []
  },
  previews: { pages: [] },
  runtime: null,
  selectedDeckStructureId: null,
  selectedSlideId: null,
  selectedSlideIndex: 1,
  selectedSlideSpec: null,
  selectedSlideSpecDraftError: null,
  selectedSlideSpecError: null,
  selectedSlideStructured: false,
  selectedSlideSource: "",
  selectedVariantId: null,
  skippedSlides: [],
  slides: [],
  sources: [],
  transientVariants: [],
  ui: {
    appTheme: "light",
    assistantOpen: false,
    checksOpen: false,
    deckPlanApplySharedSettings: {},
    currentPage: "studio",
    llmChecking: false,
    llmPopoverOpen: false,
    structuredDraftOpen: false,
  },
  validation: null,
  workflowHistory: [],
  variantStorage: null,
  variants: []
};

const elements: Record<string, any> = {
  assistantDrawer: document.getElementById("assistant-drawer"),
  activePreview: document.getElementById("active-preview"),
  assistantInput: document.getElementById("assistant-input"),
  assistantLog: document.getElementById("assistant-log"),
  assistantSendButton: document.getElementById("assistant-send-button"),
  assistantSelection: document.getElementById("assistant-selection"),
  assistantSuggestions: document.getElementById("assistant-suggestions"),
  assistantToggle: document.getElementById("assistant-toggle"),
  captureVariantButton: document.getElementById("capture-variant-button"),
  checkLlmButton: document.getElementById("check-llm-button"),
  closeValidationPageButton: document.getElementById("close-validation-page"),
  compareApplyButton: document.getElementById("compare-apply-button"),
  compareApplyValidateButton: document.getElementById("compare-apply-validate-button"),
  compareChangeSummary: document.getElementById("compare-change-summary"),
  compareCurrentLabel: document.getElementById("compare-current-label"),
  compareCurrentPreview: document.getElementById("compare-current-preview"),
  compareDecisionSupport: document.getElementById("compare-decision-support"),
  compareEmpty: document.getElementById("compare-empty"),
  compareGrid: document.getElementById("compare-grid"),
  compareHighlights: document.getElementById("compare-highlights"),
  compareSourceGrid: document.getElementById("compare-source-grid"),
  compareStats: document.getElementById("compare-stats"),
  compareSummary: document.getElementById("compare-summary"),
  compareVariantLabel: document.getElementById("compare-variant-label"),
  compareVariantMeta: document.getElementById("compare-variant-meta"),
  compareVariantPreview: document.getElementById("compare-variant-preview"),
  createPresentationButton: document.getElementById("create-presentation-button"),
  createSystemSlideButton: document.getElementById("create-system-slide-button"),
  designMaxWords: document.getElementById("design-max-words"),
  designMinCaptionGap: document.getElementById("design-min-caption-gap"),
  designMinContentGap: document.getElementById("design-min-content-gap"),
  designMinFontSize: document.getElementById("design-min-font-size"),
  designMinPanelPadding: document.getElementById("design-min-panel-padding"),
  deckStructureList: document.getElementById("deck-structure-list"),
  deckStructureNote: document.getElementById("deck-structure-note"),
  deleteSlideButton: document.getElementById("delete-slide-button"),
  ideateCandidateCount: document.getElementById("ideate-candidate-count"),
  ideateDeckStructureButton: document.getElementById("ideate-deck-structure-button"),
  ideateGenerationMode: document.getElementById("ideate-generation-mode"),
  ideateSlideButton: document.getElementById("ideate-slide-button"),
  ideateStructureButton: document.getElementById("ideate-structure-button"),
  ideateThemeButton: document.getElementById("ideate-theme-button"),
  deckAudience: document.getElementById("deck-audience"),
  deckAuthor: document.getElementById("deck-author"),
  deckCompany: document.getElementById("deck-company"),
  deckConstraints: document.getElementById("deck-constraints"),
  deckLang: document.getElementById("deck-lang"),
  deckLengthApplyButton: document.getElementById("deck-length-apply-button"),
  deckLengthMode: document.getElementById("deck-length-mode"),
  deckLengthPlanButton: document.getElementById("deck-length-plan-button"),
  deckLengthPlanList: document.getElementById("deck-length-plan-list"),
  deckLengthRestoreList: document.getElementById("deck-length-restore-list"),
  deckLengthSummary: document.getElementById("deck-length-summary"),
  deckLengthTarget: document.getElementById("deck-length-target"),
  deckObjective: document.getElementById("deck-objective"),
  deckOutline: document.getElementById("deck-outline"),
  deckSubject: document.getElementById("deck-subject"),
  deckThemeBrief: document.getElementById("deck-theme-brief"),
  deckTitle: document.getElementById("deck-title"),
  deckTone: document.getElementById("deck-tone"),
  llmStatusNote: document.getElementById("llm-status-note"),
  llmNavStatus: document.getElementById("llm-nav-status"),
  llmPopover: document.getElementById("llm-status-popover"),
  manualSystemAfter: document.getElementById("manual-system-after"),
  manualDeleteSlide: document.getElementById("manual-delete-slide"),
  materialAlt: document.getElementById("material-alt"),
  materialCaption: document.getElementById("material-caption"),
  materialDetachButton: document.getElementById("detach-material-button"),
  materialFile: document.getElementById("material-file"),
  materialList: document.getElementById("material-list"),
  materialUploadButton: document.getElementById("upload-material-button"),
  manualSystemSummary: document.getElementById("manual-system-summary"),
  manualSystemTitle: document.getElementById("manual-system-title"),
  operationStatus: document.getElementById("operation-status"),
  presentationAudience: document.getElementById("presentation-audience"),
  presentationConstraints: document.getElementById("presentation-constraints"),
  presentationFontFamily: document.getElementById("presentation-font-family"),
  presentationGenerationMode: document.getElementById("presentation-generation-mode"),
  presentationList: document.getElementById("presentation-list"),
  presentationObjective: document.getElementById("presentation-objective"),
  presentationResultCount: document.getElementById("presentation-result-count"),
  presentationSearch: document.getElementById("presentation-search"),
  presentationTargetSlides: document.getElementById("presentation-target-slides"),
  presentationThemeAccent: document.getElementById("presentation-theme-accent"),
  presentationThemeBg: document.getElementById("presentation-theme-bg"),
  presentationThemeBrief: document.getElementById("presentation-theme-brief"),
  presentationThemePanel: document.getElementById("presentation-theme-panel"),
  presentationThemePrimary: document.getElementById("presentation-theme-primary"),
  presentationThemeSecondary: document.getElementById("presentation-theme-secondary"),
  presentationTitle: document.getElementById("presentation-title"),
  presentationTone: document.getElementById("presentation-tone"),
  presentationsPage: document.getElementById("presentations-page"),
  reportBox: document.getElementById("report-box"),
  redoLayoutButton: document.getElementById("redo-layout-button"),
  saveDeckContextButton: document.getElementById("save-deck-context-button"),
  saveValidationSettingsButton: document.getElementById("save-validation-settings-button"),
  saveSlideContextButton: document.getElementById("save-slide-context-button"),
  saveSlideSpecButton: document.getElementById("save-slide-spec-button"),
  showPlanningPageButton: document.getElementById("show-planning-page"),
  showPresentationsPageButton: document.getElementById("show-presentations-page"),
  showStudioPageButton: document.getElementById("show-studio-page"),
  showLlmDiagnosticsButton: document.getElementById("show-llm-diagnostics"),
  sourceList: document.getElementById("source-list"),
  sourceRetrievalList: document.getElementById("source-retrieval-list"),
  sourceText: document.getElementById("source-text"),
  sourceTitle: document.getElementById("source-title"),
  sourceUrl: document.getElementById("source-url"),
  addSourceButton: document.getElementById("add-source-button"),
  themeToggle: document.getElementById("theme-toggle"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
  slideSpecEditor: document.getElementById("slide-spec-editor"),
  slideSpecStatus: document.getElementById("slide-spec-status"),
  selectedSlideLabel: document.getElementById("selected-slide-label"),
  slideIntent: document.getElementById("slide-intent"),
  slideLayoutHint: document.getElementById("slide-layout-hint"),
  slideMustInclude: document.getElementById("slide-must-include"),
  slideNotes: document.getElementById("slide-notes"),
  slideTitle: document.getElementById("slide-title"),
  slideSpecHighlight: document.getElementById("slide-spec-highlight"),
  planningPage: document.getElementById("planning-page"),
  showValidationPageButton: document.getElementById("show-validation-page"),
  studioPage: document.getElementById("studio-page"),
  structuredDraftDrawer: document.getElementById("structured-draft-drawer"),
  structuredDraftToggle: document.getElementById("structured-draft-toggle"),
  thumbRail: document.getElementById("thumb-rail"),
  themeAccent: document.getElementById("theme-accent"),
  themeBg: document.getElementById("theme-bg"),
  themeLight: document.getElementById("theme-light"),
  themeMuted: document.getElementById("theme-muted"),
  themePanel: document.getElementById("theme-panel"),
  themePrimary: document.getElementById("theme-primary"),
  themeProgressFill: document.getElementById("theme-progress-fill"),
  themeProgressTrack: document.getElementById("theme-progress-track"),
  themeSecondary: document.getElementById("theme-secondary"),
  themeSurface: document.getElementById("theme-surface"),
  validationMediaMode: document.getElementById("validation-media-mode"),
  validationPage: document.getElementById("validation-page"),
  validationSummary: document.getElementById("validation-summary"),
  validateButton: document.getElementById("validate-button"),
  validateRenderButton: document.getElementById("validate-render-button"),
  validationStatus: document.getElementById("validation-status"),
  variantCountPill: document.getElementById("variant-count-pill"),
  variantFlow: document.getElementById("variant-flow"),
  variantLabel: document.getElementById("variant-label"),
  variantList: document.getElementById("variant-list"),
  variantReviewWorkspace: document.getElementById("variant-review-workspace"),
  variantStorageNote: document.getElementById("variant-storage-note"),
  workflowCompare: document.getElementById("workflow-compare"),
  workflowHistory: document.getElementById("workflow-history")
};

const domSlideWidth = 960;
const domSlideResizeObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        syncDomSlideViewport(entry.target);
      });
    })
  : null;
let activeInlineTextEdit = null;
let slideSpecPreviewFrame = null;

function getValidationRuleSelects(): any[] {
  return Array.from(document.querySelectorAll("[data-validation-rule]"));
}

async function request(url, options: any = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

function setBusy(button, label) {
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = label;

  return () => {
    button.disabled = false;
    button.textContent = previous;
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightJsonSource(source) {
  const text = String(source || "");
  const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let cursor = 0;
  let markup = "";

  text.replace(tokenPattern, (token, quoted, keySuffix, offset) => {
    markup += escapeHtml(text.slice(cursor, offset));

    if (quoted) {
      const tokenClass = keySuffix ? "json-token-key" : "json-token-string";
      markup += `<span class="${tokenClass}">${escapeHtml(quoted)}</span>${escapeHtml(keySuffix || "")}`;
    } else if (/^-?\d/.test(token)) {
      markup += `<span class="json-token-number">${escapeHtml(token)}</span>`;
    } else {
      markup += `<span class="json-token-literal">${escapeHtml(token)}</span>`;
    }

    cursor = offset + token.length;
    return token;
  });

  markup += escapeHtml(text.slice(cursor));
  return markup || " ";
}

function formatSourceCode(source, format = "plain") {
  return format === "json" ? highlightJsonSource(source) : escapeHtml(source);
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

function getSlideSpecPathValue(slideSpec, path) {
  return String(path || "").split(".").reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return current[Number.isInteger(Number(segment)) ? Number(segment) : segment];
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

  state.assistant.selection = {
    label: editElement.dataset.editLabel || "Slide text",
    path: editElement.dataset.editPath || "",
    slideId: state.selectedSlideId,
    slideIndex: state.selectedSlideIndex,
    text: text.slice(0, 500)
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
    detail: `${providerLine}${baseUrl} is not ready. ${llm.configuredReason || "Configure a provider or switch generation mode to local."}`,
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

  elements.ideateSlideButton.disabled = !selected || workflowRunning;
  elements.ideateStructureButton.disabled = !selected || workflowRunning;
  elements.ideateThemeButton.disabled = !selected || workflowRunning;
  elements.redoLayoutButton.disabled = !selected || workflowRunning;
  elements.captureVariantButton.disabled = !selected;
  elements.materialDetachButton.disabled = !selected || !state.selectedSlideSpec || !state.selectedSlideSpec.media;
  elements.materialUploadButton.disabled = workflowRunning;
  elements.saveSlideSpecButton.disabled = !selected
    || !state.selectedSlideStructured
    || !state.selectedSlideSpec
    || Boolean(state.selectedSlideSpecDraftError);
  elements.selectedSlideLabel.textContent = selected
    ? `${selected.index}/${state.slides.length} ${selected.title}`
    : "Slide not selected";
  renderVariantFlow();
  renderWorkflowHistory();
  renderMaterials();
  renderSources();
  renderSourceRetrieval();

  const llmDetail = llmView.detail.startsWith(llmView.providerLine)
    ? llmView.detail.slice(llmView.providerLine.length)
    : `. ${llmView.detail}`;
  elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(llmView.providerLine)}</strong>${escapeHtml(llmDetail)}`;
}

function setLlmPopoverOpen(open) {
  state.ui.llmPopoverOpen = Boolean(open);
  renderStatus();
}

function toggleLlmPopover() {
  setLlmPopoverOpen(!state.ui.llmPopoverOpen);
}

function loadAssistantDrawerPreference() {
  try {
    return window.localStorage.getItem("studio.assistantDrawerOpen") === "true";
  } catch (error) {
    return false;
  }
}

function persistAssistantDrawerPreference() {
  try {
    window.localStorage.setItem("studio.assistantDrawerOpen", String(state.ui.assistantOpen));
  } catch (error) {
    // Ignore unavailable localStorage in restricted environments.
  }
}

function loadStructuredDraftDrawerPreference() {
  try {
    return window.localStorage.getItem("studio.structuredDraftDrawerOpen") === "true";
  } catch (error) {
    return false;
  }
}

function persistStructuredDraftDrawerPreference() {
  try {
    window.localStorage.setItem("studio.structuredDraftDrawerOpen", String(state.ui.structuredDraftOpen));
  } catch (error) {
    // Ignore unavailable localStorage in restricted environments.
  }
}

function loadCurrentPagePreference() {
  const hash = typeof window.location.hash === "string" ? window.location.hash.replace(/^#/, "") : "";
  if (hash === "presentations") {
    return "presentations";
  }
  if (hash === "planning") {
    return "planning";
  }
  if (hash === "studio") {
    return "studio";
  }

  try {
    const value = window.localStorage.getItem("studio.currentPage");
    return value === "planning" || value === "presentations" ? value : "studio";
  } catch (error) {
    return "studio";
  }
}

function persistCurrentPagePreference() {
  try {
    window.localStorage.setItem("studio.currentPage", state.ui.currentPage);
  } catch (error) {
    // Ignore unavailable localStorage in restricted environments.
  }
}

function loadAppThemePreference() {
  try {
    const value = window.localStorage.getItem("studio.appTheme");
    if (value === "dark" || value === "light") {
      return value;
    }
  } catch (error) {
    // Ignore unavailable localStorage in restricted environments.
  }

  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function persistAppThemePreference() {
  try {
    window.localStorage.setItem("studio.appTheme", state.ui.appTheme);
  } catch (error) {
    // Ignore unavailable localStorage in restricted environments.
  }
}

function applyAppTheme(theme, options: any = {}) {
  state.ui.appTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.appTheme = state.ui.appTheme;
  document.documentElement.style.colorScheme = state.ui.appTheme;

  const isDark = state.ui.appTheme === "dark";
  elements.themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
  elements.themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  elements.themeToggleLabel.textContent = isDark ? "Dark" : "Light";

  if (options.persist) {
    persistAppThemePreference();
  }
}

function toggleAppTheme() {
  applyAppTheme(state.ui.appTheme === "dark" ? "light" : "dark", { persist: true });
}

function renderPages() {
  const current = state.ui.currentPage;
  elements.presentationsPage.hidden = current !== "presentations";
  elements.studioPage.hidden = current !== "studio";
  elements.planningPage.hidden = current !== "planning";
  elements.validationPage.hidden = !state.ui.checksOpen;
  elements.structuredDraftDrawer.hidden = current !== "studio";
  elements.showPresentationsPageButton.classList.toggle("active", current === "presentations");
  elements.showStudioPageButton.classList.toggle("active", current === "studio");
  elements.showPlanningPageButton.classList.toggle("active", current === "planning");
  elements.showValidationPageButton.classList.toggle("active", state.ui.checksOpen);
  elements.showPresentationsPageButton.setAttribute("aria-pressed", current === "presentations" ? "true" : "false");
  elements.showStudioPageButton.setAttribute("aria-pressed", current === "studio" ? "true" : "false");
  elements.showPlanningPageButton.setAttribute("aria-pressed", current === "planning" ? "true" : "false");
  elements.showValidationPageButton.setAttribute("aria-expanded", state.ui.checksOpen ? "true" : "false");
  renderStructuredDraftDrawer();
}

function setCurrentPage(page) {
  state.ui.currentPage = page === "planning" || page === "presentations" ? page : "studio";
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

function renderAssistantDrawer() {
  document.body.classList.toggle("assistant-open", state.ui.assistantOpen);
  elements.assistantDrawer.dataset.open = state.ui.assistantOpen ? "true" : "false";
  elements.assistantToggle.setAttribute("aria-expanded", state.ui.assistantOpen ? "true" : "false");
  elements.assistantToggle.setAttribute(
    "aria-label",
    state.ui.assistantOpen ? "Close workflow assistant" : "Open workflow assistant"
  );
}

function setAssistantDrawerOpen(open) {
  state.ui.assistantOpen = Boolean(open);
  persistAssistantDrawerPreference();
  renderAssistantDrawer();
}

function renderStructuredDraftDrawer() {
  const available = state.ui.currentPage === "studio";
  document.body.classList.toggle("structured-draft-open", available && state.ui.structuredDraftOpen);
  elements.structuredDraftDrawer.dataset.open = state.ui.structuredDraftOpen ? "true" : "false";
  elements.structuredDraftToggle.setAttribute("aria-expanded", state.ui.structuredDraftOpen ? "true" : "false");
  elements.structuredDraftToggle.setAttribute(
    "aria-label",
    state.ui.structuredDraftOpen ? "Close structured draft editor" : "Open structured draft editor"
  );
}

function setStructuredDraftDrawerOpen(open) {
  state.ui.structuredDraftOpen = Boolean(open);
  persistStructuredDraftDrawerPreference();
  renderStructuredDraftDrawer();
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
    const preferred = getPreferredVariant(variants);
    state.selectedVariantId = preferred ? preferred.id : null;
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
  if (!currentSpec || !variantSpec || currentSpec.type !== variantSpec.type) {
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

  pushChange("framing", "Title", currentSpec.title, variantSpec.title);
  pushChange("framing", "Eyebrow", currentSpec.eyebrow, variantSpec.eyebrow);
  pushChange("framing", "Summary", currentSpec.summary, variantSpec.summary);

  switch (currentSpec.type) {
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
    elements.sourceRetrievalList.innerHTML = "<div class=\"source-retrieval-empty\">No source snippets were used by the last generation.</div>";
    return;
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
        ? "compare"
        : "select";
  const order = ["generate", "select", "compare", "apply"];
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
  elements.themePrimary.value = toColorInputValue(visualTheme.primary, "#183153");
  elements.themeSecondary.value = toColorInputValue(visualTheme.secondary, "#275d8c");
  elements.themeAccent.value = toColorInputValue(visualTheme.accent, "#f28f3b");
  elements.themeMuted.value = toColorInputValue(visualTheme.muted, "#56677c");
  elements.themeLight.value = toColorInputValue(visualTheme.light, "#d7e6f5");
  elements.themeBg.value = toColorInputValue(visualTheme.bg, "#f5f8fc");
  elements.themePanel.value = toColorInputValue(visualTheme.panel, "#f8fbfe");
  elements.themeSurface.value = toColorInputValue(visualTheme.surface, "#ffffff");
  elements.themeProgressTrack.value = toColorInputValue(visualTheme.progressTrack, "#d7e6f5");
  elements.themeProgressFill.value = toColorInputValue(visualTheme.progressFill, "#275d8c");
  elements.validationMediaMode.value = validationSettings.mediaValidationMode || "fast";
  getValidationRuleSelects().forEach((element) => {
    const rule = element.dataset.validationRule;
    element.value = validationRules[rule] || "warning";
  });
  elements.deckThemeBrief.value = deck.themeBrief || "";
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
      card.innerHTML = `
        <p class="variant-kind">${escapeHtml(action.action === "restore" ? "Restore" : "Skip")}</p>
        <strong>${escapeHtml(action.title || action.slideId)}</strong>
        <span class="variant-meta">${escapeHtml(action.confidence || "medium")} confidence · ${escapeHtml(action.slideId)}</span>
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
          <strong>${escapeHtml(message.selection.label || "Selection")}</strong>
          ${escapeHtml(message.selection.text || "")}
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
  elements.assistantSelection.innerHTML = `
    <div>
      <span>Using selection</span>
      <strong>${escapeHtml(selection.label || "Slide text")}</strong>
      <p>${escapeHtml(selection.text)}</p>
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
  elements.thumbRail.innerHTML = "";

  if (!state.slides.length) {
    elements.activePreview.innerHTML = "";
    return;
  }

  const activeSlide = state.slides.find((entry) => entry.index === state.selectedSlideIndex) || state.slides[0];
  const activeSpec = activeSlide ? (state.selectedSlideId === activeSlide.id && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(activeSlide.id)) : null;
  const activePage = state.previews.pages.find((page) => activeSlide && page.index === activeSlide.index) || state.previews.pages[0] || null;

  if (activeSpec) {
    renderDomSlide(elements.activePreview, activeSpec, {
      index: activeSlide.index,
      totalSlides: state.slides.length
    });
    enableDomSlideTextEditing(elements.activePreview);
  } else if (activePage) {
    renderImagePreview(elements.activePreview, `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${activeSlide ? activeSlide.title : "Slide"} preview`);
  } else {
    elements.activePreview.innerHTML = "";
  }

  state.slides.forEach((slide) => {
    const page = state.previews.pages.find((entry) => entry.index === slide.index) || null;
    const thumbSpec = slide.id === state.selectedSlideId && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(slide.id);
    const button = document.createElement("button");
    button.className = `thumb${slide.index === state.selectedSlideIndex ? " active" : ""}`;
    button.type = "button";
    button.title = `${slide.index}. ${slide.title || slide.fileName || "Slide"}`;
    button.setAttribute("aria-label", `Select slide ${slide.index}: ${slide.title || slide.fileName || "Untitled slide"}`);
    button.innerHTML = `
      <div class="thumb-preview"></div>
      <span class="thumb-index">${slide.index}</span>
      <strong>${escapeHtml(slide.title || `Slide ${slide.index}`)}</strong>
      <span>${escapeHtml(slide.fileName || `slide ${slide.index}`)}</span>
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
  elements.variantList.innerHTML = "";
  elements.variantCountPill.textContent = variants.length
    ? `${variants.length} candidate${variants.length === 1 ? "" : "s"}${sessionCount ? `, ${sessionCount} session-only` : ""}`
    : "0 candidates";
  elements.variantStorageNote.textContent = savedCount > 0
    ? `${sessionCount} session-only candidate${sessionCount === 1 ? "" : "s"} and ${savedCount} saved snapshot${savedCount === 1 ? "" : "s"} are available for this slide.`
    : "Generated candidates stay in the current session until one is applied.";

  if (!variants.length) {
    elements.variantReviewWorkspace.classList.add("is-empty");
    elements.workflowCompare.hidden = true;
    elements.variantList.innerHTML = "<div class=\"variant-card variant-empty-state\"><strong>No candidates yet</strong><span>Choose a count, then run a generation mode to create session-only options.</span></div>";
    renderVariantFlow();
    renderVariantComparison();
    return;
  }

  elements.variantReviewWorkspace.classList.remove("is-empty");
  elements.workflowCompare.hidden = false;

  const selectVariantForComparison = (variant) => {
    state.selectedVariantId = variant.id;
    elements.operationStatus.textContent = `Comparing ${variant.label} against the current slide.`;
    renderVariants();
  };

  variants.forEach((variant) => {
    const card = document.createElement("div");
    const selected = variant.id === state.selectedVariantId;
    card.className = `variant-card${selected ? " active" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("aria-label", `Compare ${variant.label}`);
    card.setAttribute("aria-current", selected ? "true" : "false");
    const kindLabel = describeVariantKind(variant);
    const summary = variant.promptSummary || variant.notes || "No notes";
    card.innerHTML = `
      <div class="variant-select-line">
        <span class="variant-select-mark" aria-hidden="true"></span>
        <p class="variant-kind">${escapeHtml(kindLabel)}</p>
      </div>
      <strong>${escapeHtml(variant.label)}</strong>
      <span class="variant-meta">${escapeHtml(new Date(variant.createdAt).toLocaleString())}</span>
      <span>${escapeHtml(summary)}</span>
      <div class="variant-actions">
        <button type="button" class="secondary" data-action="compare">${selected ? "Comparing" : "Compare"}</button>
        <button type="button" data-action="apply">Apply variant</button>
      </div>
    `;

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

function describeVariantKind(variant) {
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
    return `${prefix}structure pass`;
  }

  if (variant.operation === "redo-layout") {
    return `${prefix}layout pass`;
  }

  if (variant.generator === "llm") {
    return `${prefix}LLM ideate`;
  }

  return `${prefix}local ideate`;
}

function renderVariantComparison() {
  const variant = getSelectedVariant();
  if (!variant) {
    elements.compareEmpty.hidden = false;
    elements.compareGrid.hidden = true;
    elements.compareSummary.hidden = true;
    elements.compareApplyButton.disabled = true;
    elements.compareApplyValidateButton.disabled = true;
    return;
  }

  const activePage = state.previews.pages.find((page) => page.index === state.selectedSlideIndex) || state.previews.pages[0];
  const slide = state.slides.find((entry) => entry.id === state.selectedSlideId);
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

  if (structuredComparison && structuredComparison.summaryLines.length) {
    compareSummaryItems.push(...structuredComparison.summaryLines);
  }

  elements.compareEmpty.hidden = true;
  elements.compareGrid.hidden = false;
  elements.compareSummary.hidden = false;
  elements.compareCurrentLabel.textContent = slide ? `${slide.index}. ${slide.title}` : "Current slide";
  elements.compareVariantLabel.textContent = variant.label;
  elements.compareVariantMeta.textContent = variant.promptSummary || variant.notes || "No notes";

  if (state.selectedSlideSpec) {
    renderDomSlide(elements.compareCurrentPreview, state.selectedSlideSpec, {
      index: state.selectedSlideIndex,
      totalSlides: state.slides.length
    });
  } else if (activePage) {
    renderImagePreview(elements.compareCurrentPreview, `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${slide ? slide.title : "Current slide"} preview`);
  } else {
    elements.compareCurrentPreview.innerHTML = "";
  }

  if (variant.slideSpec) {
    renderDomSlide(elements.compareVariantPreview, variant.slideSpec, {
      index: state.selectedSlideIndex,
      theme: variantVisualTheme || undefined,
      totalSlides: state.slides.length
    });
  } else if (variant.previewImage) {
    renderImagePreview(elements.compareVariantPreview, variant.previewImage.url, `${variant.label} preview`);
  } else {
    elements.compareVariantPreview.innerHTML = "";
  }

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
  elements.compareApplyButton.disabled = false;
  elements.compareApplyValidateButton.disabled = false;
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
  const payload = await request(`/api/slides/${slideId}`);
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
  const preferred = getPreferredVariant(payload.variants || []);
  state.selectedVariantId = preferred ? preferred.id : null;
  renderStatus();
  renderSlideFields();
  renderPreviews();
  renderVariants();
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
  elements.presentationTargetSlides.value = "5";
  elements.presentationGenerationMode.value = "auto";
  elements.presentationObjective.value = "";
  elements.presentationConstraints.value = "";
  elements.presentationThemeBrief.value = "";
  elements.presentationFontFamily.value = "avenir";
  elements.presentationThemePrimary.value = "#183153";
  elements.presentationThemeSecondary.value = "#275d8c";
  elements.presentationThemeAccent.value = "#f28f3b";
  elements.presentationThemeBg.value = "#f5f8fc";
  elements.presentationThemePanel.value = "#f8fbfe";
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

async function createPresentationFromForm() {
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

  const done = setBusy(elements.createPresentationButton, "Creating...");
  try {
    await request("/api/presentations", {
      body: JSON.stringify({
        audience: elements.presentationAudience.value.trim(),
        constraints: elements.presentationConstraints.value.trim(),
        generationMode: elements.presentationGenerationMode.value,
        objective: elements.presentationObjective.value.trim(),
        targetSlideCount: Number.isFinite(targetSlideCount) ? targetSlideCount : null,
        themeBrief: elements.presentationThemeBrief.value.trim(),
        title,
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
      }),
      method: "POST"
    });
    clearPresentationForm();
    resetPresentationSelection();
    await refreshState();
    setCurrentPage("studio");
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
        generationMode: "auto",
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
  const payload = await request("/api/state");
  state.assistant = payload.assistant || { session: null, suggestions: [] };
  state.context = payload.context;
  state.deckStructureCandidates = [];
  state.materials = payload.materials || [];
  setDomPreviewState(payload);
  state.presentations = payload.presentations || { activePresentationId: null, presentations: [] };
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  state.skippedSlides = payload.skippedSlides || [];
  state.sources = payload.sources || [];
  state.workflowHistory = Array.isArray(payload.runtime && payload.runtime.workflowHistory) ? payload.runtime.workflowHistory : [];
  state.selectedDeckStructureId = null;
  state.deckLengthPlan = null;
  elements.deckLengthTarget.value = "";
  state.slides = payload.slides;
  state.transientVariants = [];
  state.variantStorage = payload.variantStorage || null;
  state.variants = payload.variants;

  if (state.runtime && state.runtime.llm && state.runtime.llm.defaultGenerationMode) {
    elements.ideateGenerationMode.value = state.runtime.llm.defaultGenerationMode;
  }

  syncSelectedSlideToActiveList();

  renderDeckFields();
  renderDeckLengthPlan();
  renderDeckStructureCandidates();
  renderPresentations();
  renderAssistant();
  renderStatus();
  renderPreviews();
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
          themeBrief: elements.deckThemeBrief.value,
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
          visualTheme: {
            accent: elements.themeAccent.value,
            bg: elements.themeBg.value,
            light: elements.themeLight.value,
            muted: elements.themeMuted.value,
            panel: elements.themePanel.value,
            primary: elements.themePrimary.value,
            progressFill: elements.themeProgressFill.value,
            progressTrack: elements.themeProgressTrack.value,
            secondary: elements.themeSecondary.value,
            surface: elements.themeSurface.value
          },
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
  const summary = elements.manualSystemSummary.value.trim();
  if (!title) {
    window.alert("Add a title for the system slide.");
    elements.manualSystemTitle.focus();
    return;
  }

  const done = setBusy(elements.createSystemSlideButton, "Creating...");
  try {
    const payload = await request("/api/slides/system", {
      body: JSON.stringify({
        afterSlideId: elements.manualSystemAfter.value,
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
    renderDeckFields();
    renderDeckLengthPlan();
    renderDeckStructureCandidates();
    renderStatus();
    renderPreviews();
    renderVariants();
    setCurrentPage("studio");
    await loadSlide(state.selectedSlideId);
    elements.operationStatus.textContent = `Created system slide ${title}.`;
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
    elements.variantLabel.value = "";
    elements.operationStatus.textContent = `Captured ${payload.variant.label} for comparison.`;
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

  if (options.validateAfter) {
    await validate(false);
    elements.operationStatus.textContent = `Applied ${options.label || "variant"} and ran checks.`;
  }
}

async function ideateSlide() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.ideateSlideButton, "Generating...");
  try {
    const payload = await request("/api/operations/ideate-slide", {
      body: JSON.stringify({
        candidateCount: getRequestedCandidateCount(),
        generationMode: elements.ideateGenerationMode.value,
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
    const preferred = getPreferredVariant(getSlideVariants());
    state.selectedVariantId = preferred ? preferred.id : null;
    elements.operationStatus.textContent = payload.summary;
    renderStatus();
    renderPreviews();
    renderVariants();
  } finally {
    done();
  }
}

async function ideateTheme() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.ideateThemeButton, "Generating...");
  try {
    const payload = await request("/api/operations/ideate-theme", {
      body: JSON.stringify({
        candidateCount: getRequestedCandidateCount(),
        generationMode: elements.ideateGenerationMode.value,
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
    const preferred = getPreferredVariant(getSlideVariants());
    state.selectedVariantId = preferred ? preferred.id : null;
    elements.operationStatus.textContent = payload.summary;
    renderStatus();
    renderPreviews();
    renderVariants();
  } finally {
    done();
  }
}

async function ideateDeckStructure() {
  const done = setBusy(elements.ideateDeckStructureButton, "Generating...");
  try {
    const payload = await request("/api/operations/ideate-deck-structure", {
      body: JSON.stringify({
        dryRun: true
      }),
      method: "POST"
    });
    state.deckStructureCandidates = payload.deckStructureCandidates || [];
    state.runtime = payload.runtime;
    state.selectedDeckStructureId = state.deckStructureCandidates[0] ? state.deckStructureCandidates[0].id : null;
    elements.operationStatus.textContent = payload.summary;
    renderDeckStructureCandidates();
    renderStatus();
  } finally {
    done();
  }
}

async function ideateStructure() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.ideateStructureButton, "Generating...");
  try {
    const payload = await request("/api/operations/ideate-structure", {
      body: JSON.stringify({
        candidateCount: getRequestedCandidateCount(),
        generationMode: elements.ideateGenerationMode.value,
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
    const preferred = getPreferredVariant(getSlideVariants());
    state.selectedVariantId = preferred ? preferred.id : null;
    elements.operationStatus.textContent = payload.summary;
    renderStatus();
    renderPreviews();
    renderVariants();
  } finally {
    done();
  }
}

async function redoLayout() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.redoLayoutButton, "Generating...");
  try {
    const payload = await request("/api/operations/redo-layout", {
      body: JSON.stringify({
        candidateCount: getRequestedCandidateCount(),
        generationMode: elements.ideateGenerationMode.value,
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
    const preferred = getPreferredVariant(getSlideVariants());
    state.selectedVariantId = preferred ? preferred.id : null;
    elements.operationStatus.textContent = payload.summary;
    renderStatus();
    renderPreviews();
    renderVariants();
  } finally {
    done();
  }
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
    const payload = await request("/api/assistant/message", {
      body: JSON.stringify({
        candidateCount: getRequestedCandidateCount(),
        generationMode: elements.ideateGenerationMode.value,
        message,
        selection,
        sessionId: state.assistant.session && state.assistant.session.id ? state.assistant.session.id : "default",
        slideId: state.selectedSlideId
      }),
      method: "POST"
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
      state.deckStructureCandidates = payload.deckStructureCandidates || [];
      state.selectedDeckStructureId = state.deckStructureCandidates[0] ? state.deckStructureCandidates[0].id : null;
    }
    clearTransientVariants(state.selectedSlideId);
    state.transientVariants = [
      ...(payload.transientVariants || []),
      ...state.transientVariants
    ];
    state.variants = payload.variants || state.variants;
    const preferred = getPreferredVariant(getSlideVariants());
    state.selectedVariantId = preferred ? preferred.id : state.selectedVariantId;
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

elements.checkLlmButton.addEventListener("click", () => checkLlmProvider().catch((error) => window.alert(error.message)));
elements.ideateDeckStructureButton.addEventListener("click", () => ideateDeckStructure().catch((error) => window.alert(error.message)));
elements.deckLengthPlanButton.addEventListener("click", () => planDeckLength().catch((error) => window.alert(error.message)));
elements.deckLengthApplyButton.addEventListener("click", () => applyDeckLength().catch((error) => window.alert(error.message)));
elements.createSystemSlideButton.addEventListener("click", () => createSystemSlide().catch((error) => window.alert(error.message)));
elements.deleteSlideButton.addEventListener("click", () => deleteSlideFromDeck().catch((error) => window.alert(error.message)));
elements.materialUploadButton.addEventListener("click", () => uploadMaterial().catch((error) => window.alert(error.message)));
elements.materialDetachButton.addEventListener("click", () => detachMaterialFromSlide().catch((error) => window.alert(error.message)));
elements.addSourceButton.addEventListener("click", () => addSource().catch((error) => window.alert(error.message)));
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
elements.ideateSlideButton.addEventListener("click", () => ideateSlide().catch((error) => window.alert(error.message)));
elements.ideateStructureButton.addEventListener("click", () => ideateStructure().catch((error) => window.alert(error.message)));
elements.ideateThemeButton.addEventListener("click", () => ideateTheme().catch((error) => window.alert(error.message)));
elements.redoLayoutButton.addEventListener("click", () => redoLayout().catch((error) => window.alert(error.message)));
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
elements.showPlanningPageButton.addEventListener("click", () => setCurrentPage("planning"));
elements.themeToggle.addEventListener("click", toggleAppTheme);
elements.showLlmDiagnosticsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleLlmPopover();
});
elements.llmPopover.addEventListener("click", (event) => event.stopPropagation());
elements.showValidationPageButton.addEventListener("click", () => setChecksPanelOpen(!state.ui.checksOpen));
elements.closeValidationPageButton.addEventListener("click", () => setChecksPanelOpen(false));
elements.structuredDraftToggle.addEventListener("click", () => {
  setStructuredDraftDrawerOpen(!state.ui.structuredDraftOpen);
});
elements.saveDeckContextButton.addEventListener("click", () => saveDeckContext().catch((error) => window.alert(error.message)));
elements.saveValidationSettingsButton.addEventListener("click", () => saveValidationSettings().catch((error) => window.alert(error.message)));
elements.saveSlideContextButton.addEventListener("click", () => saveSlideContext().catch((error) => window.alert(error.message)));
elements.createPresentationButton.addEventListener("click", () => createPresentationFromForm().catch((error) => window.alert(error.message)));
elements.presentationSearch.addEventListener("input", renderPresentations);

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

  setCurrentPage(page === "planning" || page === "presentations" ? page : "studio");
});

state.ui.appTheme = loadAppThemePreference();
applyAppTheme(state.ui.appTheme);
state.ui.currentPage = loadCurrentPagePreference();
state.ui.checksOpen = window.location.hash.replace(/^#/, "") === "validation";
state.ui.assistantOpen = loadAssistantDrawerPreference();
state.ui.structuredDraftOpen = loadStructuredDraftDrawerPreference();
renderPages();
renderAssistantDrawer();
renderStructuredDraftDrawer();
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
