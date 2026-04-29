namespace StudioClientCustomLayoutWorkbench {
  function normalizeLayoutTreatment(value) {
    const treatment = String(value || "").trim().toLowerCase();
    return treatment === "default" || !treatment ? "standard" : treatment;
  }

  function parseJson(source, emptyMessage, invalidMessage) {
    const trimmed = String(source || "").trim();
    if (!trimmed) {
      throw new Error(emptyMessage);
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(invalidMessage);
    }
  }

  export function createCustomLayoutWorkbench(deps) {
    const {
      clearTransientVariants,
      elements,
      escapeHtml,
      openVariantGenerationControls,
      renderDomSlide,
      renderLayoutLibrary,
      renderPreviews,
      renderStatus,
      renderVariants,
      request,
      setBusy,
      setCurrentPage,
      setLayoutDrawerOpen,
      state
    } = deps;

    function isSupported() {
      return state.selectedSlideSpec && ["content", "cover"].includes(state.selectedSlideSpec.type);
    }

    function getSlideType() {
      return state.selectedSlideSpec && state.selectedSlideSpec.type === "cover" ? "cover" : "content";
    }

    function getSelectedSlideLayoutTreatment() {
      return normalizeLayoutTreatment(state.selectedSlideSpec && state.selectedSlideSpec.layout);
    }

    function getDraftControls(source = "custom") {
      const isLayoutStudio = source === "layout-studio";
      const minFontSize = Number.parseInt(isLayoutStudio ? elements.layoutStudioMinFont.value : elements.customLayoutMinFont.value, 10);
      return {
        minFontSize: Number.isFinite(minFontSize) ? minFontSize : 18,
        profile: isLayoutStudio
          ? elements.layoutStudioProfile.value || "balanced-grid"
          : elements.customLayoutProfile.value || "balanced-grid",
        slideType: getSlideType(),
        spacing: isLayoutStudio
          ? elements.layoutStudioSpacing.value || "normal"
          : elements.customLayoutSpacing.value || "normal"
      };
    }

    async function requestDraftDefinition(source = "custom") {
      const payload = await request("/api/layouts/custom/draft", {
        body: JSON.stringify(getDraftControls(source)),
        method: "POST"
      });
      return payload.layoutDefinition;
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

    function getSelectedLibraryLayout() {
      const selectedValue = elements.layoutLibrarySelect ? elements.layoutLibrarySelect.value || "" : "";
      if (!selectedValue) {
        return null;
      }

      const [scope, layoutId] = selectedValue.split(":");
      const source = scope === "favorite" ? state.favoriteLayouts : state.layouts;
      return (Array.isArray(source) ? source : []).find((layout) => layout && layout.id === layoutId) || null;
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

    function setJson(definition) {
      if (!elements.customLayoutJson) {
        return;
      }
      elements.customLayoutJson.value = `${JSON.stringify(definition, null, 2)}\n`;
    }

    function getDefinitionForPreview() {
      if (elements.customLayoutJson && elements.customLayoutJson.value.trim()) {
        try {
          return JSON.parse(elements.customLayoutJson.value);
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    function getPreviewSlideSpec(baseSpec = state.selectedSlideSpec, options: any = {}) {
      if (!baseSpec || !["content", "cover"].includes(baseSpec.type)) {
        return null;
      }

      const previewSpec = {
        ...baseSpec,
        layout: normalizeLayoutTreatment(elements.customLayoutTreatment.value || baseSpec.layout)
      };

      if (options.includeLayoutDefinition !== false) {
        previewSpec.layoutDefinition = getDefinitionForPreview();
      }

      return previewSpec;
    }

    function getLivePreviewSlideSpec(activeSlide, activeSpec) {
      if (!activeSlide || !state.ui.layoutDrawerOpen || !state.ui.customLayoutMainPreviewActive || !isSupported()) {
        return null;
      }

      return getPreviewSlideSpec(activeSpec, {
        includeLayoutDefinition: state.ui.customLayoutDefinitionPreviewActive
      });
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
        : getDefinitionForPreview();

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

      renderLayoutMap(elements.layoutStudioMap, activeDefinition);
      const supported = isSupported();
      elements.layoutStudioPreviewButton.disabled = !supported;
      elements.layoutStudioLoadSelectedButton.disabled = !selectedEntry || !selectedEntry.layout.definition;
      elements.layoutStudioOpenSlideButton.disabled = !state.selectedSlideId;
      elements.layoutStudioStatus.textContent = supported
        ? "Ready to preview on the selected slide."
        : "Select a content or cover slide in Slide Studio before previewing.";
    }

    async function refreshDraftJson(source = "custom", options: any = {}) {
      if (!isSupported()) {
        return null;
      }

      const requestSeq = (state.ui.customLayoutDraftRequestSeq || 0) + 1;
      state.ui.customLayoutDraftRequestSeq = requestSeq;
      elements.customLayoutStatus.textContent = "Drafting layout...";
      const definition = await requestDraftDefinition(source);
      if (state.ui.customLayoutDraftRequestSeq !== requestSeq) {
        return null;
      }

      setJson(definition);
      state.ui.customLayoutDraftSlideId = state.selectedSlideId || "";
      state.ui.customLayoutDraftSlideType = getSlideType();
      if (options.activate !== false) {
        state.ui.customLayoutDefinitionPreviewActive = true;
        state.ui.customLayoutMainPreviewActive = true;
        elements.customLayoutStatus.textContent = "Live preview";
      } else {
        elements.customLayoutStatus.textContent = "Draft";
      }
      renderEditor();
      renderPreviews();
      return definition;
    }

    function refreshDraftFromControls() {
      if (!isSupported()) {
        state.ui.customLayoutDefinitionPreviewActive = false;
        state.ui.customLayoutMainPreviewActive = false;
        renderEditor();
        renderPreviews();
        return;
      }

      refreshDraftJson("custom").catch((error) => window.alert(error.message));
    }

    function refreshTreatmentFromControl() {
      if (!isSupported()) {
        state.ui.customLayoutDefinitionPreviewActive = false;
        state.ui.customLayoutMainPreviewActive = false;
        renderEditor();
        renderPreviews();
        return;
      }

      state.ui.customLayoutDraftSlideId = state.selectedSlideId || "";
      state.ui.customLayoutDraftSlideType = getSlideType();
      state.ui.customLayoutMainPreviewActive = true;
      elements.customLayoutStatus.textContent = "Live preview";
      renderEditor();
      renderPreviews();
    }

    function loadDraftFromSelection() {
      if (!isSupported()) {
        return;
      }

      const selectedLayout = getSelectedLibraryLayout();
      if (selectedLayout && selectedLayout.definition && selectedLayout.definition.type === "slotRegionLayout") {
        setJson(selectedLayout.definition);
        elements.customLayoutTreatment.value = normalizeLayoutTreatment(selectedLayout.treatment);
      } else {
        refreshDraftJson("custom").catch((error) => window.alert(error.message));
        return;
      }
      state.ui.customLayoutDraftSlideId = state.selectedSlideId || "";
      state.ui.customLayoutDraftSlideType = getSlideType();
      state.ui.customLayoutDefinitionPreviewActive = true;
      state.ui.customLayoutMainPreviewActive = true;
      elements.customLayoutStatus.textContent = "Live preview";
      renderEditor();
      renderPreviews();
    }

    function renderEditor() {
      if (!elements.customLayoutPreviewButton || !elements.customLayoutJson) {
        return;
      }

      const supported = isSupported();
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
      const slideType = getSlideType();
      const slideId = state.selectedSlideId || "";
      if (
        !elements.customLayoutJson.value.trim()
        || state.ui.customLayoutDraftSlideType !== slideType
        || state.ui.customLayoutDraftSlideId !== slideId
      ) {
        elements.customLayoutTreatment.value = getSelectedSlideLayoutTreatment();
        refreshDraftJson("custom", { activate: false }).catch((error) => window.alert(error.message));
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
        const previewSpec = getPreviewSlideSpec();
        if (previewSpec) {
          renderDomSlide(elements.customLayoutLivePreview, previewSpec, {
            index: state.selectedSlideIndex,
            totalSlides: state.slides.length
          });
        }
      }
      if (elements.customLayoutLiveMap) {
        elements.customLayoutLiveMap.hidden = previewMode !== "map";
        renderLayoutMap(elements.customLayoutLiveMap, getDefinitionForPreview());
      }
    }

    function setPreviewMode(mode) {
      state.ui.customLayoutPreviewMode = mode === "map" ? "map" : "slide";
      renderEditor();
    }

    function parseDefinitionJson() {
      return parseJson(
        elements.customLayoutJson.value,
        "Create a custom layout draft before preview.",
        "Custom layout JSON must be valid JSON."
      );
    }

    async function previewCustomLayout() {
      if (!state.selectedSlideId || !isSupported()) {
        window.alert("Custom layout authoring starts with a content or cover slide.");
        return;
      }

      const done = setBusy(elements.customLayoutPreviewButton, "Previewing...");
      try {
        const layoutDefinition = parseDefinitionJson();
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
      if (!state.selectedSlideId || !isSupported()) {
        window.alert("Custom layout authoring starts with a content or cover slide.");
        return;
      }

      elements.customLayoutProfile.value = elements.quickCustomLayoutProfile.value || "balanced-grid";
      elements.customLayoutMultiPreview.checked = false;
      await refreshDraftJson("custom");
      await previewCustomLayout();
    }

    async function previewLayoutStudioDesign() {
      if (!state.selectedSlideId || !isSupported()) {
        window.alert("Select a content or cover slide before previewing a layout design.");
        return;
      }

      const definition = await refreshDraftJson("layout-studio");
      if (!definition) {
        return;
      }
      setJson(definition);
      elements.customLayoutTreatment.value = normalizeLayoutTreatment(elements.layoutStudioTreatment.value);
      elements.customLayoutMultiPreview.checked = elements.layoutStudioMultiPreview.checked;
      await previewCustomLayout();
      elements.layoutStudioStatus.textContent = elements.layoutStudioMultiPreview.checked
        ? "Favorite-ready preview created."
        : "Current-slide preview created.";
    }

    function discardDraft() {
      elements.customLayoutJson.value = "";
      state.ui.customLayoutDraftSlideId = "";
      state.ui.customLayoutDraftSlideType = "";
      state.ui.customLayoutDefinitionPreviewActive = false;
      state.ui.customLayoutMainPreviewActive = false;
      renderEditor();
      renderPreviews();
      elements.customLayoutStatus.textContent = "Draft";
    }

    function markDraftEdited() {
      state.ui.customLayoutDefinitionPreviewActive = false;
      state.ui.customLayoutMainPreviewActive = false;
      elements.customLayoutStatus.textContent = "Draft";
      renderEditor();
      renderPreviews();
    }

    function loadSelectedLayoutStudioDefinition() {
      const entry = getLayoutByStudioRef(state.layoutStudioSelectedRef);
      if (entry) {
        loadLayoutStudioDefinition(entry.layout);
        renderLayoutStudio();
      }
    }

    function mount() {
      elements.customLayoutLoadButton.addEventListener("click", () => loadDraftFromSelection());
      elements.customLayoutPreviewButton.addEventListener("click", () => previewCustomLayout().catch((error) => {
        elements.customLayoutStatus.textContent = "Draft needs review";
        window.alert(error.message);
      }));
      elements.customLayoutDiscardButton.addEventListener("click", discardDraft);
      [elements.customLayoutProfile, elements.customLayoutSpacing, elements.customLayoutMinFont].forEach((element) => {
        element.addEventListener("change", refreshDraftFromControls);
      });
      elements.customLayoutTreatment.addEventListener("change", refreshTreatmentFromControl);
      elements.customLayoutJson.addEventListener("input", markDraftEdited);
      elements.customLayoutPreviewSlideTab.addEventListener("click", () => setPreviewMode("slide"));
      elements.customLayoutPreviewMapTab.addEventListener("click", () => setPreviewMode("map"));
      elements.quickCustomLayoutButton.addEventListener("click", () => quickCustomLayout().catch((error) => window.alert(error.message)));
      elements.layoutStudioPreviewButton.addEventListener("click", () => previewLayoutStudioDesign().catch((error) => window.alert(error.message)));
      elements.layoutStudioLoadSelectedButton.addEventListener("click", loadSelectedLayoutStudioDefinition);
      elements.layoutStudioOpenSlideButton.addEventListener("click", () => {
        setCurrentPage("studio");
        setLayoutDrawerOpen(true);
      });
      [elements.layoutStudioProfile, elements.layoutStudioSpacing, elements.layoutStudioMinFont, elements.layoutStudioTreatment].forEach((element) => {
        element.addEventListener("change", renderLayoutStudio);
      });
      elements.layoutLibraryDetails.addEventListener("toggle", () => {
        renderLayoutLibrary();
      });
    }

    return {
      getLivePreviewSlideSpec,
      isSupported,
      mount,
      renderEditor,
      renderLayoutStudio
    };
  }
}
