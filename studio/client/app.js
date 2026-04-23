const state = {
  assistant: {
    session: null,
    suggestions: []
  },
  context: null,
  deckStructureCandidates: [],
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
  validation: null,
  variants: []
};

const elements = {
  activePreview: document.getElementById("active-preview"),
  assistantInput: document.getElementById("assistant-input"),
  assistantLog: document.getElementById("assistant-log"),
  assistantSendButton: document.getElementById("assistant-send-button"),
  assistantSuggestions: document.getElementById("assistant-suggestions"),
  buildButton: document.getElementById("build-button"),
  buildStatus: document.getElementById("build-status"),
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
  deckStructureList: document.getElementById("deck-structure-list"),
  deckStructureNote: document.getElementById("deck-structure-note"),
  ideateDryRun: document.getElementById("ideate-dry-run"),
  ideateDeckStructureButton: document.getElementById("ideate-deck-structure-button"),
  ideateGenerationMode: document.getElementById("ideate-generation-mode"),
  ideateSlideButton: document.getElementById("ideate-slide-button"),
  ideateStructureButton: document.getElementById("ideate-structure-button"),
  ideateThemeButton: document.getElementById("ideate-theme-button"),
  deckAudience: document.getElementById("deck-audience"),
  deckConstraints: document.getElementById("deck-constraints"),
  deckObjective: document.getElementById("deck-objective"),
  deckOutline: document.getElementById("deck-outline"),
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
  slideSpecEditor: document.getElementById("slide-spec-editor"),
  slideSpecStatus: document.getElementById("slide-spec-status"),
  selectedSlideLabel: document.getElementById("selected-slide-label"),
  slideIntent: document.getElementById("slide-intent"),
  slideLayoutHint: document.getElementById("slide-layout-hint"),
  slideMustInclude: document.getElementById("slide-must-include"),
  slideNotes: document.getElementById("slide-notes"),
  slideTitle: document.getElementById("slide-title"),
  thumbRail: document.getElementById("thumb-rail"),
  validateButton: document.getElementById("validate-button"),
  validateRenderButton: document.getElementById("validate-render-button"),
  validationStatus: document.getElementById("validation-status"),
  variantLabel: document.getElementById("variant-label"),
  variantList: document.getElementById("variant-list")
};

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

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStatus() {
  const build = state.runtime && state.runtime.build;
  const llm = state.runtime && state.runtime.llm;
  const llmCheck = llm && llm.lastCheck;
  const validation = state.runtime && state.runtime.validation;
  const selected = state.slides.find((slide) => slide.id === state.selectedSlideId);

  elements.buildStatus.textContent = build && build.updatedAt
    ? `Build ${build.ok ? "ready" : "failed"}`
    : "Build idle";
  elements.buildStatus.dataset.state = build && build.updatedAt
    ? (build.ok ? "ok" : "warn")
    : "idle";

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
  elements.previewCount.textContent = `${state.previews.pages.length} page${state.previews.pages.length === 1 ? "" : "s"}`;

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

function startRuntimePolling() {
  let cancelled = false;

  const loop = (async () => {
    while (!cancelled) {
      try {
        const payload = await request("/api/runtime");
        state.runtime = payload.runtime;
        renderStatus();

        const workflow = payload.runtime && payload.runtime.workflow;
        if (workflow && workflow.status === "running") {
          elements.operationStatus.textContent = describeWorkflowProgress(workflow);
        }
      } catch (error) {
        // Ignore polling errors while the primary request is in flight.
      }

      await delay(700);
    }
  })();

  return async () => {
    cancelled = true;
    await loop.catch(() => {});
  };
}

async function runWithRuntimePolling(task) {
  const stopPolling = startRuntimePolling();

  try {
    return await task();
  } finally {
    await stopPolling();
  }
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

function renderDeckFields() {
  const deck = state.context.deck || {};
  elements.deckTitle.value = deck.title || "";
  elements.deckAudience.value = deck.audience || "";
  elements.deckObjective.value = deck.objective || "";
  elements.deckTone.value = deck.tone || "";
  elements.deckConstraints.value = deck.constraints || "";
  elements.deckThemeBrief.value = deck.themeBrief || "";
  elements.deckOutline.value = deck.outline || "";
  elements.deckStructureNote.textContent = deck.structureLabel
    ? `Applied plan: ${deck.structureLabel}. ${deck.structureSummary || "Deck structure metadata is stored with the saved context."}`
    : "Generate dry-run presentation structures from the saved deck brief and outline, then apply one back to the outline when it reads right.";
}

function renderDeckStructureCandidates() {
  const candidates = Array.isArray(state.deckStructureCandidates) ? state.deckStructureCandidates : [];
  elements.deckStructureList.innerHTML = "";

  if (!candidates.length) {
    elements.deckStructureList.innerHTML = "<div class=\"variant-card\"><strong>No deck structure candidates yet</strong><span>Use the deck-level workflow to generate 2-3 outline options from the saved brief and current slides.</span></div>";
    return;
  }

  candidates.forEach((candidate, index) => {
    const card = document.createElement("div");
    card.className = `variant-card${candidate.id === state.selectedDeckStructureId ? " active" : ""}`;
    const outlineLines = String(candidate.outline || "").split("\n").filter(Boolean);
    const planStats = candidate.planStats || {};
    const preview = candidate.preview || {};
    const plan = Array.isArray(candidate.slides) ? candidate.slides : [];
    const previewCues = Array.isArray(preview.cues) ? preview.cues : [];
    const previewHints = Array.isArray(preview.previewHints) ? preview.previewHints : [];
    const currentSequence = Array.isArray(preview.currentSequence) ? preview.currentSequence : [];
    const proposedSequence = Array.isArray(preview.proposedSequence) ? preview.proposedSequence : [];
    const stripMarkup = preview.strip && preview.strip.url
      ? `
      <div class="deck-structure-strip">
        <img src="${preview.strip.url}" alt="${escapeHtml(candidate.label || "Deck structure")} preview strip">
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
      <p class="variant-kind">Deck structure</p>
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
      ${stripMarkup}
      ${previewHintMarkup}
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
      elements.operationStatus.textContent = `Inspecting deck structure candidate ${candidate.label}.`;
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
      elements.assistantInput.value = suggestion.prompt;
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

  if (!state.previews.pages.length) {
    elements.activePreview.removeAttribute("src");
    elements.previewEmpty.hidden = false;
    return;
  }

  elements.previewEmpty.hidden = true;
  const activePage = state.previews.pages.find((page) => page.index === state.selectedSlideIndex) || state.previews.pages[0];
  elements.activePreview.src = `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`;

  state.previews.pages.forEach((page) => {
    const slide = state.slides.find((entry) => entry.index === page.index);
    const button = document.createElement("button");
    button.className = `thumb${page.index === state.selectedSlideIndex ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <img src="${page.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}" alt="Slide ${page.index}">
      <strong>${slide ? slide.title : `Slide ${page.index}`}</strong>
      <span>${slide ? slide.fileName : `page ${page.index}`}</span>
    `;
    button.addEventListener("click", () => {
      selectSlideByIndex(page.index);
    });
    elements.thumbRail.appendChild(button);
  });
}

function renderVariants() {
  const variants = getSlideVariants();
  elements.variantList.innerHTML = "";

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
      ${variant.previewImage ? `<img class="variant-preview" src="${variant.previewImage.url}" alt="${escapeHtml(variant.label)} preview">` : ""}
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

  elements.compareEmpty.hidden = true;
  elements.compareGrid.hidden = false;
  elements.compareSummary.hidden = false;
  elements.compareCurrentLabel.textContent = slide ? `${slide.index}. ${slide.title}` : "Current slide";
  elements.compareCurrentPreview.src = activePage ? `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}` : "";
  elements.compareVariantLabel.textContent = variant.label;
  elements.compareVariantMeta.textContent = variant.promptSummary || variant.notes || "No notes";
  elements.compareVariantPreview.src = variant.previewImage ? variant.previewImage.url : "";
  elements.compareStats.innerHTML = [
    `<span class="compare-stat"><strong>${variant.persisted === false ? "dry run" : "saved"}</strong> variant mode</span>`,
    `<span class="compare-stat"><strong>${escapeHtml(variant.generator || "manual")}</strong> generator</span>`,
    `<span class="compare-stat"><strong>${diff.changed}</strong> changed lines</span>`,
    `<span class="compare-stat"><strong>${diff.added}</strong> added lines</span>`,
    `<span class="compare-stat"><strong>${diff.removed}</strong> removed lines</span>`
  ].join("");
  elements.compareChangeSummary.innerHTML = Array.isArray(variant.changeSummary) && variant.changeSummary.length
    ? variant.changeSummary.map((item) => `<p class="compare-summary-item">${escapeHtml(item)}</p>`).join("")
    : `<p class="compare-summary-item">${escapeHtml(variant.promptSummary || variant.notes || "No change summary available.")}</p>`;
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
  elements.compareHighlights.innerHTML = diff.highlights.length
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
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  state.selectedDeckStructureId = null;
  state.slides = payload.slides;
  state.transientVariants = [];
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
  const payload = await request("/api/context", {
    body: JSON.stringify({
      deck: {
        audience: elements.deckAudience.value,
        constraints: elements.deckConstraints.value,
        objective: elements.deckObjective.value,
        outline: elements.deckOutline.value,
        themeBrief: elements.deckThemeBrief.value,
        title: elements.deckTitle.value,
        tone: elements.deckTone.value
      }
    }),
    method: "POST"
  });

  state.context = payload.context;
  state.deckStructureCandidates = [];
  state.selectedDeckStructureId = null;
  renderDeckFields();
  renderDeckStructureCandidates();
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
  const done = setBusy(elements.buildButton, "Building...");
  try {
    const payload = await request("/api/build", {
      body: JSON.stringify({}),
      method: "POST"
    });
    state.previews = payload.previews;
    state.runtime = payload.runtime;
    renderStatus();
    renderPreviews();
    renderVariantComparison();
  } finally {
    done();
  }
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

  state.context = payload.context;
  state.previews = payload.previews || state.previews;
  state.runtime = payload.runtime || state.runtime;
  state.slides = payload.slides || state.slides;
  state.selectedDeckStructureId = candidate.id;
  const activeSlide = syncSelectedSlideToActiveList();
  elements.operationStatus.textContent = `Applied deck structure candidate ${candidate.label} to the saved outline, slide plan, ${payload.insertedSlides || 0} inserted slide${payload.insertedSlides === 1 ? "" : "s"}, ${payload.replacedSlides || 0} replaced slide${payload.replacedSlides === 1 ? "" : "s"}, ${payload.removedSlides || 0} archived slide${payload.removedSlides === 1 ? "" : "s"}, ${payload.indexUpdates || 0} slide order change${payload.indexUpdates === 1 ? "" : "s"}, and ${payload.titleUpdates || 0} slide title${payload.titleUpdates === 1 ? "" : "s"}.`;
  renderDeckFields();
  renderDeckStructureCandidates();
  renderPreviews();
  renderStatus();
  renderVariants();
  if (activeSlide) {
    await loadSlide(activeSlide.id);
  }
}

async function validate(includeRender) {
  const button = includeRender ? elements.validateRenderButton : elements.validateButton;
  const done = setBusy(button, includeRender ? "Running render gate..." : "Validating...");
  try {
    const payload = await runWithRuntimePolling(() => request("/api/validate", {
      body: JSON.stringify({ includeRender }),
      method: "POST"
    }));
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
    const payload = await runWithRuntimePolling(() => request("/api/operations/ideate-slide", {
      body: JSON.stringify({
        dryRun: elements.ideateDryRun.checked,
        generationMode: elements.ideateGenerationMode.value,
        slideId: state.selectedSlideId
      }),
      method: "POST"
    }));
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
    const payload = await runWithRuntimePolling(() => request("/api/operations/ideate-theme", {
      body: JSON.stringify({
        dryRun: elements.ideateDryRun.checked,
        generationMode: elements.ideateGenerationMode.value,
        slideId: state.selectedSlideId
      }),
      method: "POST"
    }));
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
    const payload = await runWithRuntimePolling(() => request("/api/operations/ideate-deck-structure", {
      body: JSON.stringify({
        dryRun: true
      }),
      method: "POST"
    }));
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
    const payload = await runWithRuntimePolling(() => request("/api/operations/ideate-structure", {
      body: JSON.stringify({
        dryRun: elements.ideateDryRun.checked,
        generationMode: elements.ideateGenerationMode.value,
        slideId: state.selectedSlideId
      }),
      method: "POST"
    }));
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
    const payload = await runWithRuntimePolling(() => request("/api/operations/redo-layout", {
      body: JSON.stringify({
        dryRun: elements.ideateDryRun.checked,
        generationMode: elements.ideateGenerationMode.value,
        slideId: state.selectedSlideId
      }),
      method: "POST"
    }));
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
    const payload = await runWithRuntimePolling(() => request("/api/assistant/message", {
      body: JSON.stringify({
        dryRun: elements.ideateDryRun.checked,
        generationMode: elements.ideateGenerationMode.value,
        message,
        sessionId: state.assistant.session && state.assistant.session.id ? state.assistant.session.id : "default",
        slideId: state.selectedSlideId
      }),
      method: "POST"
    }));
    state.assistant = {
      session: payload.session,
      suggestions: payload.suggestions || state.assistant.suggestions
    };
    state.context = payload.context || state.context;
    state.previews = payload.previews;
    state.runtime = payload.runtime;
    if (payload.validation) {
      state.validation = payload.validation;
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

elements.buildButton.addEventListener("click", () => buildDeck().catch((error) => window.alert(error.message)));
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
elements.saveDeckContextButton.addEventListener("click", () => saveDeckContext().catch((error) => window.alert(error.message)));
elements.saveSlideContextButton.addEventListener("click", () => saveSlideContext().catch((error) => window.alert(error.message)));

refreshState()
  .then(async () => {
    if (!state.previews.pages.length) {
      await buildDeck();
    }
  })
  .catch((error) => {
    window.alert(error.message);
  });
