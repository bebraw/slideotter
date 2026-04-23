const state = {
  context: null,
  previews: { pages: [] },
  runtime: null,
  selectedSlideId: null,
  selectedSlideIndex: 1,
  selectedSlideSource: "",
  slides: [],
  validation: null,
  variants: []
};

const elements = {
  activePreview: document.getElementById("active-preview"),
  buildButton: document.getElementById("build-button"),
  buildStatus: document.getElementById("build-status"),
  captureVariantButton: document.getElementById("capture-variant-button"),
  deckAudience: document.getElementById("deck-audience"),
  deckConstraints: document.getElementById("deck-constraints"),
  deckObjective: document.getElementById("deck-objective"),
  deckOutline: document.getElementById("deck-outline"),
  deckThemeBrief: document.getElementById("deck-theme-brief"),
  deckTitle: document.getElementById("deck-title"),
  deckTone: document.getElementById("deck-tone"),
  previewEmpty: document.getElementById("preview-empty"),
  reportBox: document.getElementById("report-box"),
  saveDeckContextButton: document.getElementById("save-deck-context-button"),
  saveSlideContextButton: document.getElementById("save-slide-context-button"),
  saveSourceButton: document.getElementById("save-source-button"),
  selectionStatus: document.getElementById("selection-status"),
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

function renderStatus() {
  const build = state.runtime && state.runtime.build;
  const validation = state.runtime && state.runtime.validation;
  const selected = state.slides.find((slide) => slide.id === state.selectedSlideId);

  elements.buildStatus.textContent = build && build.updatedAt
    ? `Build ${build.ok ? "ready" : "failed"}`
    : "Build idle";

  elements.validationStatus.textContent = validation && validation.updatedAt
    ? `Validation ${validation.ok ? "passed" : "failed"}`
    : "Validation idle";

  elements.selectionStatus.textContent = selected
    ? `Selected ${selected.title}`
    : "No slide selected";
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
  const variants = state.variants.filter((variant) => variant.slideId === state.selectedSlideId);
  elements.variantList.innerHTML = "";

  if (!variants.length) {
    elements.variantList.innerHTML = "<div class=\"variant-card\"><strong>No variants yet</strong><span>Capture the current slide source before trying a risky rewrite.</span></div>";
    return;
  }

  variants.forEach((variant) => {
    const card = document.createElement("div");
    card.className = "variant-card";
    card.innerHTML = `
      <strong>${variant.label}</strong>
      <span>${variant.notes || "No notes"}<br>${new Date(variant.createdAt).toLocaleString()}</span>
      <button type="button">Apply variant</button>
    `;

    card.querySelector("button").addEventListener("click", async () => {
      const done = setBusy(card.querySelector("button"), "Applying...");
      try {
        const payload = await request("/api/variants/apply", {
          body: JSON.stringify({ variantId: variant.id }),
          method: "POST"
        });
        state.previews = payload.previews;
        await loadSlide(payload.slideId);
      } catch (error) {
        window.alert(error.message);
      } finally {
        done();
      }
    });

    elements.variantList.appendChild(card);
  });
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
    elements.variantLabel.value = "";
    renderVariants();
  } finally {
    done();
  }
}

elements.buildButton.addEventListener("click", () => buildDeck().catch((error) => window.alert(error.message)));
elements.validateButton.addEventListener("click", () => validate(false).catch((error) => window.alert(error.message)));
elements.validateRenderButton.addEventListener("click", () => validate(true).catch((error) => window.alert(error.message)));
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
