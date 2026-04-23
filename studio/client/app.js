const state = {
  assistant: {
    session: null,
    suggestions: []
  },
  context: null,
  deckStructureCandidates: [],
  domPreview: {
    slides: [],
    theme: null
  },
  previews: { pages: [] },
  runtime: null,
  selectedDeckStructureId: null,
  selectedSlideId: null,
  selectedSlideIndex: 1,
  selectedSlideSpec: null,
  selectedSlideSpecError: null,
  selectedSlideStructured: false,
  selectedSlideSource: "",
  selectedVariantId: null,
  slides: [],
  transientVariants: [],
  ui: {
    assistantOpen: false,
    currentPage: "studio",
    structuredDraftOpen: false,
  },
  validation: null,
  workflowHistory: [],
  variantStorage: null,
  variants: []
};

const elements = {
  assistantDrawer: document.getElementById("assistant-drawer"),
  activePreview: document.getElementById("active-preview"),
  assistantInput: document.getElementById("assistant-input"),
  assistantLog: document.getElementById("assistant-log"),
  assistantSendButton: document.getElementById("assistant-send-button"),
  assistantSuggestions: document.getElementById("assistant-suggestions"),
  assistantToggle: document.getElementById("assistant-toggle"),
  captureVariantButton: document.getElementById("capture-variant-button"),
  checkLlmButton: document.getElementById("check-llm-button"),
  compareApplyButton: document.getElementById("compare-apply-button"),
  compareApplyValidateButton: document.getElementById("compare-apply-validate-button"),
  compareChangeSummary: document.getElementById("compare-change-summary"),
  compareCurrentLabel: document.getElementById("compare-current-label"),
  compareCurrentPreview: document.getElementById("compare-current-preview"),
  compareEmpty: document.getElementById("compare-empty"),
  compareGrid: document.getElementById("compare-grid"),
  compareHighlights: document.getElementById("compare-highlights"),
  compareSourceGrid: document.getElementById("compare-source-grid"),
  compareStats: document.getElementById("compare-stats"),
  compareSummary: document.getElementById("compare-summary"),
  compareVariantLabel: document.getElementById("compare-variant-label"),
  compareVariantMeta: document.getElementById("compare-variant-meta"),
  compareVariantPreview: document.getElementById("compare-variant-preview"),
  designMaxWords: document.getElementById("design-max-words"),
  designMinCaptionGap: document.getElementById("design-min-caption-gap"),
  designMinContentGap: document.getElementById("design-min-content-gap"),
  designMinFontSize: document.getElementById("design-min-font-size"),
  designMinPanelPadding: document.getElementById("design-min-panel-padding"),
  deckStructureList: document.getElementById("deck-structure-list"),
  deckStructureNote: document.getElementById("deck-structure-note"),
  ideateDryRun: document.getElementById("ideate-dry-run"),
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
  deckObjective: document.getElementById("deck-objective"),
  deckOutline: document.getElementById("deck-outline"),
  deckSubject: document.getElementById("deck-subject"),
  deckThemeBrief: document.getElementById("deck-theme-brief"),
  deckTitle: document.getElementById("deck-title"),
  deckTone: document.getElementById("deck-tone"),
  llmStatusNote: document.getElementById("llm-status-note"),
  operationStatus: document.getElementById("operation-status"),
  previewEmpty: document.getElementById("preview-empty"),
  previewCount: document.getElementById("preview-count"),
  reportBox: document.getElementById("report-box"),
  redoLayoutButton: document.getElementById("redo-layout-button"),
  saveDeckContextButton: document.getElementById("save-deck-context-button"),
  saveSlideContextButton: document.getElementById("save-slide-context-button"),
  saveSlideSpecButton: document.getElementById("save-slide-spec-button"),
  selectionStatus: document.getElementById("selection-status"),
  showPlanningPageButton: document.getElementById("show-planning-page"),
  showStudioPageButton: document.getElementById("show-studio-page"),
  slideSpecEditor: document.getElementById("slide-spec-editor"),
  slideSpecStatus: document.getElementById("slide-spec-status"),
  selectedSlideLabel: document.getElementById("selected-slide-label"),
  slideIntent: document.getElementById("slide-intent"),
  slideLayoutHint: document.getElementById("slide-layout-hint"),
  slideMustInclude: document.getElementById("slide-must-include"),
  slideNotes: document.getElementById("slide-notes"),
  slideTitle: document.getElementById("slide-title"),
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
  validationPage: document.getElementById("validation-page"),
  validateButton: document.getElementById("validate-button"),
  validateRenderButton: document.getElementById("validate-render-button"),
  validationStatus: document.getElementById("validation-status"),
  variantLabel: document.getElementById("variant-label"),
  variantList: document.getElementById("variant-list"),
  variantStorageNote: document.getElementById("variant-storage-note"),
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

async function request(url, options = {}) {
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

function getDomRenderer() {
  return window.SlideDomRenderer || null;
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

function renderDomSlide(viewport, slideSpec, options = {}) {
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
          theme: getDomTheme(),
          totalSlides: options.totalSlides
        })}
      </div>
    </div>
  `;
  observeDomSlideViewport(viewport.querySelector(".dom-slide-viewport"));
}

function toColorInputValue(value, fallback = "#000000") {
  const normalized = String(value || "").trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : fallback;
}

function renderStatus() {
  const llm = state.runtime && state.runtime.llm;
  const llmCheck = llm && llm.lastCheck;
  const validation = state.runtime && state.runtime.validation;
  const selected = state.slides.find((slide) => slide.id === state.selectedSlideId);

  elements.validationStatus.textContent = validation && validation.updatedAt
    ? `Validation ${validation.ok ? "passed" : "failed"}`
    : "Validation idle";
  elements.validationStatus.dataset.state = validation && validation.updatedAt
    ? (validation.ok ? "ok" : "warn")
    : "idle";

  elements.selectionStatus.textContent = selected
    ? `Selected ${selected.title}`
    : "No slide selected";
  elements.selectionStatus.dataset.state = selected ? "ok" : "idle";
  elements.ideateSlideButton.disabled = !selected;
  elements.ideateStructureButton.disabled = !selected;
  elements.ideateThemeButton.disabled = !selected;
  elements.redoLayoutButton.disabled = !selected;
  elements.captureVariantButton.disabled = !selected;
  elements.saveSlideSpecButton.disabled = !selected;
  elements.selectedSlideLabel.textContent = selected
    ? `${selected.index}. ${selected.title}`
    : "Slide not selected";
  elements.previewCount.textContent = `${state.slides.length} slide${state.slides.length === 1 ? "" : "s"}`;
  renderWorkflowHistory();

  if (!llm) {
    elements.llmStatusNote.textContent = "LLM provider status appears here after a verification check.";
    return;
  }

  const providerLine = llm.model
    ? `${llm.provider} using ${llm.model}`
    : `${llm.provider} provider`;
  const baseUrl = llm.baseUrl ? ` at ${llm.baseUrl}` : "";

  if (llmCheck && llmCheck.testedAt) {
    elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(providerLine)}</strong>${escapeHtml(baseUrl)}. ${escapeHtml(llmCheck.summary)}`;
    return;
  }

  if (llm.available) {
    elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(providerLine)}</strong>${escapeHtml(baseUrl)} is configured. Run a provider check to verify live connectivity.`;
    return;
  }

  elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(providerLine)}</strong>${escapeHtml(baseUrl)} is not ready. ${escapeHtml(llm.configuredReason || "Configure a provider or switch generation mode to local.")}`;
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
  if (hash === "planning") {
    return "planning";
  }
  if (hash === "validation") {
    return "validation";
  }
  if (hash === "studio") {
    return "studio";
  }

  try {
    const value = window.localStorage.getItem("studio.currentPage");
    return ["planning", "validation"].includes(value) ? value : "studio";
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

function renderPages() {
  const current = state.ui.currentPage;
  elements.studioPage.hidden = current !== "studio";
  elements.planningPage.hidden = current !== "planning";
  elements.validationPage.hidden = current !== "validation";
  elements.structuredDraftDrawer.hidden = current !== "studio";
  elements.showStudioPageButton.classList.toggle("active", current === "studio");
  elements.showPlanningPageButton.classList.toggle("active", current === "planning");
  elements.showValidationPageButton.classList.toggle("active", current === "validation");
  elements.showStudioPageButton.setAttribute("aria-pressed", current === "studio" ? "true" : "false");
  elements.showPlanningPageButton.setAttribute("aria-pressed", current === "planning" ? "true" : "false");
  elements.showValidationPageButton.setAttribute("aria-pressed", current === "validation" ? "true" : "false");
  renderStructuredDraftDrawer();
}

function setCurrentPage(page) {
  state.ui.currentPage = ["planning", "validation"].includes(page) ? page : "studio";
  const nextHash = `#${state.ui.currentPage}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
  persistCurrentPagePreference();
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
    retitle: "Retitle"
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
      currentSpec.signals.forEach((signal, index) => {
        const nextSignal = variantSpec.signals[index] || {};
        pushChange("signals", `Signal ${index + 1} label`, signal.label, nextSignal.label);
        pushChange("signals", `Signal ${index + 1} value`, signal.value, nextSignal.value);
      });
      pushChange("guardrails", "Guardrails title", currentSpec.guardrailsTitle, variantSpec.guardrailsTitle);
      currentSpec.guardrails.forEach((guardrail, index) => {
        const nextGuardrail = variantSpec.guardrails[index] || {};
        pushChange("guardrails", `Guardrail ${index + 1} label`, guardrail.label, nextGuardrail.label);
        pushChange("guardrails", `Guardrail ${index + 1} value`, guardrail.value, nextGuardrail.value);
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
    "validating-geometry-text": "Running validation...",
    "validating-render": "Running full render validation...",
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

let runtimeEventSource = null;

function applyRuntimeUpdate(runtime) {
  if (!runtime) {
    return;
  }

  state.runtime = runtime;
  state.workflowHistory = Array.isArray(runtime.workflowHistory) ? runtime.workflowHistory : state.workflowHistory;
  renderStatus();
  renderWorkflowHistory();

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
  elements.deckThemeBrief.value = deck.themeBrief || "";
  elements.deckOutline.value = deck.outline || "";
  elements.deckStructureNote.textContent = deck.structureLabel
    ? `Applied plan: ${deck.structureLabel}. ${deck.structureSummary || "Deck structure metadata is stored with the saved context."}`
    : "Generate dry-run deck plans from the saved brief and outline, then apply one back to the outline and live slide files when it reads right.";
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
    card.className = `variant-card${candidate.id === state.selectedDeckStructureId ? " active" : ""}`;
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
    const outlineDiff = diff.outline || {};
    const groupedPlan = groupDeckPlanSteps(plan);
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
        <span class="compare-stat"><strong>${planStats.retitled || 0}</strong> retitle</span>
      </div>
      <div class="compare-change-summary">
        ${(preview.overview ? [`<p class="compare-summary-item">${escapeHtml(preview.overview)}</p>`] : [])
          .concat(previewCues.map((cue) => `<p class="compare-summary-item">${escapeHtml(cue)}</p>`))
          .join("")}
      </div>
      <div class="compare-stats">
        <span class="compare-stat"><strong>${(diff.counts && diff.counts.beforeSlides) || currentSequence.length}</strong> slides before</span>
        <span class="compare-stat"><strong>${(diff.counts && diff.counts.afterSlides) || proposedSequence.length}</strong> slides after</span>
        <span class="compare-stat"><strong>${diffFiles.length}</strong> file target${diffFiles.length === 1 ? "" : "s"}</span>
      </div>
      ${beforeAfterStripMarkup}
      ${previewHintMarkup}
      <div class="deck-structure-outline">
        <div class="deck-structure-outline-line"><strong>Diff summary</strong><span>${escapeHtml(diff.summary || "No deck diff summary available")}</span></div>
        <div class="deck-structure-outline-line"><strong>Added to live deck</strong><span>${escapeHtml((outlineDiff.added || []).join(" / ") || "None")}</span></div>
        <div class="deck-structure-outline-line"><strong>Archived from live deck</strong><span>${escapeHtml((outlineDiff.archived || []).join(" / ") || "None")}</span></div>
        <div class="deck-structure-outline-line"><strong>Retitled beats</strong><span>${escapeHtml((outlineDiff.retitled || []).map((item) => `${item.before} -> ${item.after}`).join(" / ") || "None")}</span></div>
        <div class="deck-structure-outline-line"><strong>Moved beats</strong><span>${escapeHtml((outlineDiff.moved || []).map((item) => `${item.title} ${item.from}->${item.to}`).join(" / ") || "None")}</span></div>
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
      <div class="variant-actions">
        <button type="button" class="secondary" data-action="inspect">Inspect</button>
        <button type="button" data-action="apply">Apply plan + scaffolds + replacements + removals + titles + order</button>
      </div>
    `;

    card.querySelector("[data-action=\"inspect\"]").addEventListener("click", () => {
      state.selectedDeckStructureId = candidate.id;
      elements.operationStatus.textContent = `Inspecting deck plan candidate ${candidate.label}.`;
      renderDeckStructureCandidates();
    });

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
    elements.assistantLog.innerHTML = "<p class=\"section-note\">No assistant messages yet.</p>";
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("div");
    item.className = "assistant-message";
    item.dataset.role = message.role;
    item.innerHTML = `
      <span class="assistant-message-meta">${escapeHtml(message.role)}</span>
      <p class="assistant-message-body">${escapeHtml(message.content)}</p>
    `;
    elements.assistantLog.appendChild(item);
  });

  elements.assistantLog.scrollTop = elements.assistantLog.scrollHeight;
}

function renderSlideFields() {
  const slideContext = state.context.slides[state.selectedSlideId] || {};
  elements.slideTitle.value = slideContext.title || "";
  elements.slideIntent.value = slideContext.intent || "";
  elements.slideMustInclude.value = slideContext.mustInclude || "";
  elements.slideNotes.value = slideContext.notes || "";
  elements.slideLayoutHint.value = slideContext.layoutHint || "";

  if (state.selectedSlideStructured && state.selectedSlideSpec) {
    elements.slideSpecEditor.disabled = false;
    elements.saveSlideSpecButton.disabled = false;
    elements.captureVariantButton.disabled = false;
    elements.slideSpecEditor.value = JSON.stringify(state.selectedSlideSpec, null, 2);
    elements.slideSpecStatus.textContent = "Editing the structured slide spec. The server will materialize it into source during save.";
    return;
  }

  elements.slideSpecEditor.disabled = true;
  elements.saveSlideSpecButton.disabled = true;
  elements.captureVariantButton.disabled = false;
  elements.slideSpecEditor.value = "";
  elements.slideSpecStatus.textContent = state.selectedSlideSpecError
    ? `Structured editing is unavailable for this slide: ${state.selectedSlideSpecError}`
    : "Structured editing is unavailable for this slide.";
}

function renderPreviews() {
  elements.thumbRail.innerHTML = "";

  if (!state.slides.length) {
    elements.activePreview.innerHTML = "";
    elements.previewEmpty.textContent = "No slide preview available.";
    elements.previewEmpty.hidden = false;
    return;
  }

  elements.previewEmpty.hidden = true;
  const activeSlide = state.slides.find((entry) => entry.index === state.selectedSlideIndex) || state.slides[0];
  const activeSpec = activeSlide ? (state.selectedSlideId === activeSlide.id && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(activeSlide.id)) : null;
  const activePage = state.previews.pages.find((page) => activeSlide && page.index === activeSlide.index) || state.previews.pages[0] || null;

  if (activeSpec) {
    renderDomSlide(elements.activePreview, activeSpec, {
      index: activeSlide.index,
      totalSlides: state.slides.length
    });
  } else if (activePage) {
    renderImagePreview(elements.activePreview, `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${activeSlide ? activeSlide.title : "Slide"} preview`);
  } else {
    elements.activePreview.innerHTML = "";
    elements.previewEmpty.textContent = "Preview unavailable for this slide.";
    elements.previewEmpty.hidden = false;
  }

  state.slides.forEach((slide) => {
    const page = state.previews.pages.find((entry) => entry.index === slide.index) || null;
    const thumbSpec = slide.id === state.selectedSlideId && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(slide.id);
    const button = document.createElement("button");
    button.className = `thumb${slide.index === state.selectedSlideIndex ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <div class="thumb-preview"></div>
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
}

function renderVariants() {
  const variants = getSlideVariants();
  const storage = state.variantStorage || {};
  elements.variantList.innerHTML = "";
  elements.variantStorageNote.textContent = storage.legacyStructured > 0
    ? `${storage.legacyStructured} structured legacy variant${storage.legacyStructured === 1 ? "" : "s"} still live in studio state; ${storage.blockedStructured > 0 ? `${storage.blockedStructured} need manual cleanup.` : "the rest are ready for slide-local storage."}`
    : storage.legacyUnstructured > 0
      ? `${storage.legacyUnstructured} legacy variant${storage.legacyUnstructured === 1 ? "" : "s"} remain in studio state for non-structured or unknown slides.`
      : storage.slideLocalStructured > 0
        ? `Structured-slide variants are stored with the slide JSON. ${storage.slideLocalStructured} saved variant${storage.slideLocalStructured === 1 ? "" : "s"} currently live in slide documents.`
        : "Structured-slide variants are stored with each slide document.";

  if (!variants.length) {
    elements.variantList.innerHTML = "<div class=\"variant-card\"><strong>No variants yet</strong><span>Run Ideate Slide, Ideate Structure, Ideate Theme, or Redo Layout to generate comparable options, or capture the current structured draft as a manual snapshot.</span></div>";
    renderVariantComparison();
    return;
  }

  variants.forEach((variant) => {
    const card = document.createElement("div");
    card.className = `variant-card${variant.id === state.selectedVariantId ? " active" : ""}`;
    const kindLabel = describeVariantKind(variant);
    const summary = variant.promptSummary || variant.notes || "No notes";
    card.innerHTML = `
      <p class="variant-kind">${escapeHtml(kindLabel)}</p>
      <strong>${escapeHtml(variant.label)}</strong>
      <span class="variant-meta">${escapeHtml(new Date(variant.createdAt).toLocaleString())}</span>
      <div class="variant-preview"></div>
      <span>${escapeHtml(summary)}</span>
      <div class="variant-actions">
        <button type="button" class="secondary" data-action="compare">Compare</button>
        <button type="button" data-action="apply">Apply variant</button>
      </div>
    `;

    card.querySelector("[data-action=\"compare\"]").addEventListener("click", () => {
      state.selectedVariantId = variant.id;
      elements.operationStatus.textContent = `Comparing ${variant.label} against the current slide.`;
      renderVariants();
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

    const variantPreview = card.querySelector(".variant-preview");
    if (variant.slideSpec) {
      renderDomSlide(variantPreview, variant.slideSpec, {
        index: state.selectedSlideIndex,
        totalSlides: state.slides.length
      });
    } else if (variant.previewImage) {
      renderImagePreview(variantPreview, variant.previewImage.url, `${variant.label} preview`);
    } else {
      variantPreview.remove();
    }

    elements.variantList.appendChild(card);
  });

  renderVariantComparison();
}

function describeVariantKind(variant) {
  if (variant.kind !== "generated") {
    return "Snapshot";
  }

  const prefix = variant.persisted === false ? "Dry-run " : "";

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
  const diff = summarizeDiff(currentComparisonSource, variantComparisonSource);
  const sourceRows = buildSourceDiffRows(currentComparisonSource, variantComparisonSource);
  const structuredComparison = state.selectedSlideStructured && variant.slideSpec
    ? buildStructuredComparison(state.selectedSlideSpec, variant.slideSpec)
    : null;
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
      totalSlides: state.slides.length
    });
  } else if (variant.previewImage) {
    renderImagePreview(elements.compareVariantPreview, variant.previewImage.url, `${variant.label} preview`);
  } else {
    elements.compareVariantPreview.innerHTML = "";
  }

  elements.compareStats.innerHTML = [
    `<span class="compare-stat"><strong>${variant.persisted === false ? "dry run" : "saved"}</strong> variant mode</span>`,
    `<span class="compare-stat"><strong>${escapeHtml(variant.generator || "manual")}</strong> generator</span>`,
    structuredComparison
      ? `<span class="compare-stat"><strong>${structuredComparison.totalChanges}</strong> structured changes</span>`
      : "",
    structuredComparison
      ? `<span class="compare-stat"><strong>${structuredComparison.groups.length}</strong> content areas</span>`
      : "",
    `<span class="compare-stat"><strong>${diff.changed}</strong> changed lines</span>`,
    `<span class="compare-stat"><strong>${diff.added}</strong> added lines</span>`,
    `<span class="compare-stat"><strong>${diff.removed}</strong> removed lines</span>`
  ].filter(Boolean).join("");
  elements.compareChangeSummary.innerHTML = compareSummaryItems
    .map((item) => `<p class="compare-summary-item">${escapeHtml(item)}</p>`)
    .join("");
  elements.compareSourceGrid.innerHTML = `
    <div class="source-pane">
      <p class="eyebrow">${state.selectedSlideStructured ? "Current JSON" : "Before"}</p>
      <div class="source-lines">
        ${sourceRows.map((row) => `
          <div class="source-line${row.changed ? " changed" : ""}">
            <span class="source-line-no">${row.line}</span>
            <code>${escapeHtml(row.before)}</code>
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
            <code>${escapeHtml(row.after)}</code>
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
}

function renderValidation() {
  if (!state.validation) {
    elements.reportBox.textContent = "No validation run yet.";
    return;
  }

  const lines = [];
  [["geometry", state.validation.geometry], ["text", state.validation.text], ["render", state.validation.render]].forEach(([label, block]) => {
    if (!block) {
      return;
    }

    lines.push(`${label.toUpperCase()}: ${block.ok ? "ok" : "errors"}`);
    if (block.skipped) {
      lines.push("  skipped");
      return;
    }

    const issues = block.issues && block.issues.length ? block.issues : (block.errors || []);
    if (!issues.length) {
      lines.push("  no issues");
      return;
    }

    issues.forEach((issue) => {
      lines.push(`  slide ${issue.slide}: ${issue.rule}: ${issue.message}`);
    });
  });

  elements.reportBox.textContent = lines.join("\n");
  setCurrentPage("validation");
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
  state.selectedSlideId = slideId;
  state.selectedSlideIndex = payload.slide.index;
  state.selectedSlideSpec = payload.slideSpec || null;
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

async function refreshState() {
  const payload = await request("/api/state");
  state.assistant = payload.assistant || { session: null, suggestions: [] };
  state.context = payload.context;
  state.deckStructureCandidates = [];
  setDomPreviewState(payload);
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  state.workflowHistory = Array.isArray(payload.runtime && payload.runtime.workflowHistory) ? payload.runtime.workflowHistory : [];
  state.selectedDeckStructureId = null;
  state.slides = payload.slides;
  state.transientVariants = [];
  state.variantStorage = payload.variantStorage || null;
  state.variants = payload.variants;

  if (state.runtime && state.runtime.llm && state.runtime.llm.defaultGenerationMode) {
    elements.ideateGenerationMode.value = state.runtime.llm.defaultGenerationMode;
  }

  syncSelectedSlideToActiveList();

  renderDeckFields();
  renderDeckStructureCandidates();
  renderAssistant();
  renderStatus();
  renderPreviews();
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
    renderDeckStructureCandidates();
    renderPreviews();
    renderVariants();
    await buildDeck();
    elements.operationStatus.textContent = "Saved deck context and rebuilt the live deck.";
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
  const payload = await request("/api/context/deck-structure/apply", {
    body: JSON.stringify({
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

  elements.operationStatus.textContent = `Applied deck plan candidate ${candidate.label} to the saved outline, slide plan, ${payload.insertedSlides || 0} inserted slide${payload.insertedSlides === 1 ? "" : "s"}, ${payload.replacedSlides || 0} replaced slide${payload.replacedSlides === 1 ? "" : "s"}, ${payload.removedSlides || 0} archived slide${payload.removedSlides === 1 ? "" : "s"}, ${payload.indexUpdates || 0} slide order change${payload.indexUpdates === 1 ? "" : "s"}, and ${payload.titleUpdates || 0} slide title${payload.titleUpdates === 1 ? "" : "s"}.`;
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

async function checkLlmProvider() {
  const done = setBusy(elements.checkLlmButton, "Checking...");
  try {
    const payload = await request("/api/llm/check", {
      body: JSON.stringify({}),
      method: "POST"
    });
    state.runtime = payload.runtime;
    elements.operationStatus.textContent = payload.result && payload.result.summary
      ? payload.result.summary
      : "LLM provider check completed.";
    renderStatus();
  } finally {
    done();
  }
}

function parseSlideSpecEditor() {
  if (!state.selectedSlideStructured) {
    throw new Error("Structured editing is not available for this slide.");
  }

  try {
    return JSON.parse(elements.slideSpecEditor.value);
  } catch (error) {
    throw new Error(`Slide spec JSON is invalid: ${error.message}`);
  }
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
        rebuild: true,
        slideSpec
      }),
      method: "POST"
    });
    state.selectedSlideSpec = payload.slideSpec || slideSpec;
    state.selectedSlideSpecError = payload.slideSpecError || null;
    state.selectedSlideStructured = payload.structured === true;
    state.selectedSlideSource = payload.source;
    patchDomSlideSpec(state.selectedSlideId, payload.slideSpec || slideSpec);
    state.previews = payload.previews;
    renderSlideFields();
    renderPreviews();
    renderVariantComparison();
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
    const payloadBody = {
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

async function applyVariantById(variantId, options = {}) {
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
          slideSpec: variant.slideSpec
        }),
        method: "POST"
      });
    } else {
      payload = await request(`/api/slides/${variant.slideId}/source`, {
        body: JSON.stringify({
          rebuild: true,
          source: variant.source
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
  state.variantStorage = payload.variantStorage || state.variantStorage;
  elements.operationStatus.textContent = `Applied ${options.label || "variant"} to ${payload.slideId}.`;
  clearTransientVariants(payload.slideId);
  await loadSlide(payload.slideId);

  if (options.validateAfter) {
    await validate(false);
    elements.operationStatus.textContent = `Applied ${options.label || "variant"} and ran validation.`;
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
        dryRun: elements.ideateDryRun.checked,
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
        dryRun: elements.ideateDryRun.checked,
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
        dryRun: elements.ideateDryRun.checked,
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
        dryRun: elements.ideateDryRun.checked,
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

  const done = setBusy(elements.assistantSendButton, "Sending...");
  try {
    setAssistantDrawerOpen(true);
    const payload = await request("/api/assistant/message", {
      body: JSON.stringify({
        dryRun: elements.ideateDryRun.checked,
        generationMode: elements.ideateGenerationMode.value,
        message,
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
      setCurrentPage("validation");
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
elements.captureVariantButton.addEventListener("click", () => captureVariant().catch((error) => window.alert(error.message)));
elements.assistantSendButton.addEventListener("click", () => sendAssistantMessage().catch((error) => window.alert(error.message)));
elements.assistantToggle.addEventListener("click", () => {
  setAssistantDrawerOpen(!state.ui.assistantOpen);
});
elements.showStudioPageButton.addEventListener("click", () => setCurrentPage("studio"));
elements.showPlanningPageButton.addEventListener("click", () => setCurrentPage("planning"));
elements.showValidationPageButton.addEventListener("click", () => setCurrentPage("validation"));
elements.structuredDraftToggle.addEventListener("click", () => {
  setStructuredDraftDrawerOpen(!state.ui.structuredDraftOpen);
});
elements.saveDeckContextButton.addEventListener("click", () => saveDeckContext().catch((error) => window.alert(error.message)));
elements.saveSlideContextButton.addEventListener("click", () => saveSlideContext().catch((error) => window.alert(error.message)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.ui.assistantOpen) {
      setAssistantDrawerOpen(false);
    }
    if (state.ui.structuredDraftOpen) {
      setStructuredDraftDrawerOpen(false);
    }
  }
});

window.addEventListener("hashchange", () => {
  const page = window.location.hash.replace(/^#/, "");
  setCurrentPage(page === "planning" || page === "validation" ? page : "studio");
});

state.ui.currentPage = loadCurrentPagePreference();
state.ui.assistantOpen = loadAssistantDrawerPreference();
state.ui.structuredDraftOpen = loadStructuredDraftDrawerPreference();
renderPages();
renderAssistantDrawer();
renderStructuredDraftDrawer();
connectRuntimeStream();

refreshState()
  .then(async () => {
    if (!state.previews.pages.length) {
      await buildDeck();
    }
  })
  .catch((error) => {
    window.alert(error.message);
  });
