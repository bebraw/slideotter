const state = {
  context: null,
  previews: { pages: [] },
  runtime: null,
  selectedSlideId: null,
  selectedSlideIndex: 1,
  selectedSlideSource: "",
  selectedVariantId: null,
  slides: [],
  validation: null,
  variants: []
};

const elements = {
  activePreview: document.getElementById("active-preview"),
  buildButton: document.getElementById("build-button"),
  buildStatus: document.getElementById("build-status"),
  captureVariantButton: document.getElementById("capture-variant-button"),
  compareApplyButton: document.getElementById("compare-apply-button"),
  compareApplyValidateButton: document.getElementById("compare-apply-validate-button"),
  compareCurrentLabel: document.getElementById("compare-current-label"),
  compareCurrentPreview: document.getElementById("compare-current-preview"),
  compareEmpty: document.getElementById("compare-empty"),
  compareGrid: document.getElementById("compare-grid"),
  compareHighlights: document.getElementById("compare-highlights"),
  compareStats: document.getElementById("compare-stats"),
  compareSummary: document.getElementById("compare-summary"),
  compareVariantLabel: document.getElementById("compare-variant-label"),
  compareVariantMeta: document.getElementById("compare-variant-meta"),
  compareVariantPreview: document.getElementById("compare-variant-preview"),
  ideateSlideButton: document.getElementById("ideate-slide-button"),
  deckAudience: document.getElementById("deck-audience"),
  deckConstraints: document.getElementById("deck-constraints"),
  deckObjective: document.getElementById("deck-objective"),
  deckOutline: document.getElementById("deck-outline"),
  deckThemeBrief: document.getElementById("deck-theme-brief"),
  deckTitle: document.getElementById("deck-title"),
  deckTone: document.getElementById("deck-tone"),
  operationStatus: document.getElementById("operation-status"),
  previewEmpty: document.getElementById("preview-empty"),
  previewCount: document.getElementById("preview-count"),
  reportBox: document.getElementById("report-box"),
  saveDeckContextButton: document.getElementById("save-deck-context-button"),
  saveSlideContextButton: document.getElementById("save-slide-context-button"),
  saveSourceButton: document.getElementById("save-source-button"),
  selectionStatus: document.getElementById("selection-status"),
  selectedSlideLabel: document.getElementById("selected-slide-label"),
  slideIntent: document.getElementById("slide-intent"),
  slideLayoutHint: document.getElementById("slide-layout-hint"),
  slideMustInclude: document.getElementById("slide-must-include"),
  slideNotes: document.getElementById("slide-notes"),
  slideTitle: document.getElementById("slide-title"),
  sourceEditor: document.getElementById("source-editor"),
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStatus() {
  const build = state.runtime && state.runtime.build;
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
  elements.selectedSlideLabel.textContent = selected
    ? `${selected.index}. ${selected.title}`
    : "Slide not selected";
  elements.previewCount.textContent = `${state.previews.pages.length} page${state.previews.pages.length === 1 ? "" : "s"}`;
}

function getSlideVariants() {
  return state.variants.filter((variant) => variant.slideId === state.selectedSlideId);
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

function renderDeckFields() {
  const deck = state.context.deck || {};
  elements.deckTitle.value = deck.title || "";
  elements.deckAudience.value = deck.audience || "";
  elements.deckObjective.value = deck.objective || "";
  elements.deckTone.value = deck.tone || "";
  elements.deckConstraints.value = deck.constraints || "";
  elements.deckThemeBrief.value = deck.themeBrief || "";
  elements.deckOutline.value = deck.outline || "";
}

function renderSlideFields() {
  const slideContext = state.context.slides[state.selectedSlideId] || {};
  elements.slideTitle.value = slideContext.title || "";
  elements.slideIntent.value = slideContext.intent || "";
  elements.slideMustInclude.value = slideContext.mustInclude || "";
  elements.slideNotes.value = slideContext.notes || "";
  elements.slideLayoutHint.value = slideContext.layoutHint || "";
  elements.sourceEditor.value = state.selectedSlideSource || "";
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
    elements.variantList.innerHTML = "<div class=\"variant-card\"><strong>No variants yet</strong><span>Run Ideate Slide to generate comparable options, or capture the current source as a manual snapshot.</span></div>";
    renderVariantComparison();
    return;
  }

  variants.forEach((variant) => {
    const card = document.createElement("div");
    card.className = `variant-card${variant.id === state.selectedVariantId ? " active" : ""}`;
    const kindLabel = variant.kind === "generated"
      ? "Ideate Slide"
      : "Snapshot";
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
  const diff = summarizeDiff(state.selectedSlideSource || "", variant.source || "");

  elements.compareEmpty.hidden = true;
  elements.compareGrid.hidden = false;
  elements.compareSummary.hidden = false;
  elements.compareCurrentLabel.textContent = slide ? `${slide.index}. ${slide.title}` : "Current slide";
  elements.compareCurrentPreview.src = activePage ? `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}` : "";
  elements.compareVariantLabel.textContent = variant.label;
  elements.compareVariantMeta.textContent = variant.promptSummary || variant.notes || "No notes";
  elements.compareVariantPreview.src = variant.previewImage ? variant.previewImage.url : "";
  elements.compareStats.innerHTML = [
    `<span class="compare-stat"><strong>${diff.changed}</strong> changed lines</span>`,
    `<span class="compare-stat"><strong>${diff.added}</strong> added lines</span>`,
    `<span class="compare-stat"><strong>${diff.removed}</strong> removed lines</span>`
  ].join("");
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

async function loadSlide(slideId) {
  const payload = await request(`/api/slides/${slideId}`);
  state.selectedSlideId = slideId;
  state.selectedSlideIndex = payload.slide.index;
  state.selectedSlideSource = payload.source;
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
  state.context = payload.context;
  state.previews = payload.previews;
  state.runtime = payload.runtime;
  state.slides = payload.slides;
  state.variants = payload.variants;

  if (!state.selectedSlideId && state.slides.length) {
    state.selectedSlideId = state.slides[0].id;
    state.selectedSlideIndex = state.slides[0].index;
  }

  renderDeckFields();
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
  renderDeckFields();
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

async function validate(includeRender) {
  const button = includeRender ? elements.validateRenderButton : elements.validateButton;
  const done = setBusy(button, includeRender ? "Running render gate..." : "Validating...");
  try {
    const payload = await request("/api/validate", {
      body: JSON.stringify({ includeRender }),
      method: "POST"
    });
    state.previews = payload.previews;
    state.runtime.validation = {
      includeRender,
      ok: payload.ok,
      updatedAt: new Date().toISOString()
    };
    state.validation = payload;
    renderStatus();
    renderPreviews();
    renderVariantComparison();
    renderValidation();
  } finally {
    done();
  }
}

async function saveSource() {
  if (!state.selectedSlideId) {
    return;
  }

  const done = setBusy(elements.saveSourceButton, "Saving...");
  try {
    const payload = await request(`/api/slides/${state.selectedSlideId}/source`, {
      body: JSON.stringify({
        rebuild: true,
        source: elements.sourceEditor.value
      }),
      method: "POST"
    });
    state.selectedSlideSource = payload.source;
    state.previews = payload.previews;
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
    const payload = await request("/api/variants/capture", {
      body: JSON.stringify({
        label: elements.variantLabel.value,
        slideId: state.selectedSlideId,
        source: elements.sourceEditor.value
      }),
      method: "POST"
    });
    state.variants = [payload.variant, ...state.variants];
    state.selectedVariantId = payload.variant.id;
    elements.variantLabel.value = "";
    elements.operationStatus.textContent = `Captured ${payload.variant.label} for comparison.`;
    renderVariants();
  } finally {
    done();
  }
}

async function applyVariantById(variantId, options = {}) {
  const payload = await request("/api/variants/apply", {
    body: JSON.stringify({ variantId }),
    method: "POST"
  });
  state.previews = payload.previews;
  elements.operationStatus.textContent = `Applied ${options.label || "variant"} to ${payload.slideId}.`;
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
        slideId: state.selectedSlideId
      }),
      method: "POST"
    });
    state.previews = payload.previews;
    state.runtime = payload.runtime;
    state.variants = payload.variants;
    state.selectedVariantId = payload.variants.find((variant) => variant.slideId === state.selectedSlideId && variant.kind === "generated")?.id || null;
    elements.operationStatus.textContent = payload.summary;
    renderStatus();
    renderPreviews();
    renderVariants();
  } finally {
    done();
  }
}

elements.buildButton.addEventListener("click", () => buildDeck().catch((error) => window.alert(error.message)));
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
elements.ideateSlideButton.addEventListener("click", () => ideateSlide().catch((error) => window.alert(error.message)));
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
elements.saveSourceButton.addEventListener("click", () => saveSource().catch((error) => window.alert(error.message)));
elements.captureVariantButton.addEventListener("click", () => captureVariant().catch((error) => window.alert(error.message)));
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
