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
      applySlideSpecPayload,
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

    function renderLibrary() {
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
      renderEditor();
      renderLayoutStudio();
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
        renderLibrary();
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
        renderLibrary();
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
        renderLibrary();
        elements.operationStatus.textContent = "Deleted favorite layout.";
      } finally {
        done();
      }
    }

    function parseLayoutExchangeJson() {
      return parseJson(
        elements.layoutExchangeJson.value,
        "Paste layout JSON before importing.",
        "Layout JSON must be valid JSON."
      );
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
        renderLibrary();
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
        renderLibrary();
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
        renderLibrary();
        if (payload.layout && elements.layoutLibrarySelect) {
          elements.layoutLibrarySelect.value = `${scope === "favorite" ? "favorite" : "deck"}:${payload.layout.id}`;
          renderLibrary();
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
        renderLibrary();
        renderSlideFields();
        renderPreviews();
        renderVariants();
        elements.operationStatus.textContent = "Applied saved layout to the selected slide.";
      } finally {
        done();
      }
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
      elements.saveLayoutButton.addEventListener("click", () => saveCurrentLayout().catch((error) => window.alert(error.message)));
      elements.applyLayoutButton.addEventListener("click", () => applySavedLayout().catch((error) => window.alert(error.message)));
      elements.favoriteLayoutButton.addEventListener("click", () => saveSelectedLayoutAsFavorite().catch((error) => window.alert(error.message)));
      elements.deleteFavoriteLayoutButton.addEventListener("click", () => deleteSelectedFavoriteLayout().catch((error) => window.alert(error.message)));
      elements.layoutLibrarySelect.addEventListener("change", renderLibrary);
      elements.copyLayoutJsonButton.addEventListener("click", () => copySelectedLayoutJson().catch((error) => window.alert(error.message)));
      elements.copyDeckLayoutPackButton.addEventListener("click", () => copyLayoutPackJson("deck").catch((error) => window.alert(error.message)));
      elements.copyFavoriteLayoutPackButton.addEventListener("click", () => copyLayoutPackJson("favorite").catch((error) => window.alert(error.message)));
      elements.importLayoutDeckButton.addEventListener("click", () => importLayoutJson("deck").catch((error) => window.alert(error.message)));
      elements.importLayoutFavoriteButton.addEventListener("click", () => importLayoutJson("favorite").catch((error) => window.alert(error.message)));
      elements.layoutExchangeJson.addEventListener("input", renderLibrary);
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
        renderLibrary();
      });
    }

    return {
      getLivePreviewSlideSpec,
      isSupported,
      mount,
      renderEditor,
      renderLibrary,
      renderLayoutStudio
    };
  }
}
