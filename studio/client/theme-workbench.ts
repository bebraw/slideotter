export namespace StudioClientThemeWorkbench {
  export function createThemeWorkbench({
    applyCreationTheme,
    applyDeckThemeFields,
    applySavedTheme,
    applySavedThemeToDeck,
    elements,
    escapeHtml,
    getBrief,
    getCurrentTheme,
    getRequestContext,
    persistSelectedThemeToDeck,
    render,
    renderDomSlide,
    request,
    saveCreationDraft,
    saveDeckTheme,
    savePresentationTheme,
    setBusy,
    setThemeDrawerOpen,
    state
  }) {
    function reportError(error) {
      window.alert(error && error.message ? error.message : String(error));
    }

    function runAction(action) {
      Promise.resolve()
        .then(action)
        .catch(reportError);
    }

    function resetCandidates() {
      state.themeCandidates = [];
      state.ui.creationThemeVariantId = "current";
      state.ui.themeCandidateRefreshIndex = 0;
      state.ui.themeCandidatesGenerated = false;
    }

    function getVariants() {
      const currentVariant = {
        id: "current",
        label: "Current",
        note: "Use the selected controls.",
        theme: getCurrentTheme()
      };

      if (!state.ui.themeCandidatesGenerated) {
        return [currentVariant];
      }

      return [
        currentVariant,
        ...(Array.isArray(state.themeCandidates)
          ? state.themeCandidates.filter((variant) => variant && variant.id !== "current")
          : [])
      ];
    }

    function getSelectedVariant() {
      const variants = getVariants();
      return variants.find((variant) => variant.id === state.ui.creationThemeVariantId) || variants[0];
    }

    function getPreviewEntries() {
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

    function getTokenSummary(theme) {
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

    function renderReview(selectedVariant) {
      if (!elements.presentationThemeReview) {
        return;
      }

      const activeSlideCount = Array.isArray(state.slides) ? state.slides.length : 0;
      const previewEntries = getPreviewEntries();
      const tokens = getTokenSummary(selectedVariant.theme);
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

    function renderStage() {
      if (!elements.presentationThemeVariantList || !elements.presentationThemePreview) {
        return;
      }

      const variants = getVariants();
      if (!variants.some((variant) => variant.id === state.ui.creationThemeVariantId)) {
        state.ui.creationThemeVariantId = "current";
      }
      const selectedVariant = getSelectedVariant();
      renderReview(selectedVariant);
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

      const previewEntries = getPreviewEntries();
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

    async function generateCandidates() {
      const done = setBusy(elements.generateThemeCandidatesButton, "Generating...");
      try {
        state.ui.themeCandidateRefreshIndex = state.ui.themeCandidatesGenerated
          ? state.ui.themeCandidateRefreshIndex + 1
          : 0;
        const context = getRequestContext();
        const payload = await request("/api/themes/candidates", {
          body: JSON.stringify({
            ...context,
            currentTheme: getCurrentTheme(),
            refreshIndex: state.ui.themeCandidateRefreshIndex,
            themeBrief: getBrief()
          }),
          method: "POST"
        });
        state.themeCandidates = Array.isArray(payload.candidates)
          ? payload.candidates.filter((candidate) => candidate && candidate.id !== "current")
          : [];
        state.ui.themeCandidatesGenerated = true;
        state.ui.creationThemeVariantId = "current";
        render();
      } finally {
        done();
      }
    }

    async function generateFromBrief() {
      const brief = getBrief().trim() || "clean professional theme";
      const done = setBusy(elements.generateThemeFromBriefButton, "Generating...");
      try {
        const generated = await request("/api/themes/generate", {
          body: JSON.stringify({
            ...getRequestContext(),
            currentTheme: getCurrentTheme(),
            themeBrief: brief
          }),
          method: "POST"
        });

        applyDeckThemeFields(generated.theme);
        resetCandidates();
        render();
        await persistSelectedThemeToDeck();
        elements.operationStatus.textContent = generated && generated.source === "llm"
          ? `Generated and applied "${generated.name || "theme"}" from the brief.`
          : "Generated and applied a fallback theme from the brief.";
      } finally {
        done();
      }
    }

    function renderFavorites() {
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
      renderFavorites();
    }

    function mount() {
      elements.themeDrawerToggle.addEventListener("click", () => {
        setThemeDrawerOpen(!state.ui.themeDrawerOpen);
      });
      elements.generateThemeFromBriefButton.addEventListener("click", () => {
        runAction(generateFromBrief);
      });
      elements.generateThemeCandidatesButton.addEventListener("click", () => {
        runAction(generateCandidates);
      });
      elements.saveDeckThemeButton.addEventListener("click", () => {
        runAction(saveDeckTheme);
      });
      if (elements.savePresentationThemeButton && savePresentationTheme) {
        elements.savePresentationThemeButton.addEventListener("click", () => {
          runAction(savePresentationTheme);
        });
      }
      elements.presentationSavedTheme.addEventListener("change", () => {
        applySavedTheme(elements.presentationSavedTheme.value);
        state.ui.creationThemeVariantId = "current";
        render();
        runAction(() => saveCreationDraft("theme"));
      });
      elements.presentationThemeVariantList.addEventListener("click", (event) => {
        const target: any = event.target;
        const button = target.closest("[data-creation-theme-variant]");
        if (!button || !elements.presentationThemeVariantList.contains(button)) {
          return;
        }

        state.ui.creationThemeVariantId = button.dataset.creationThemeVariant || "current";
        const variant = getSelectedVariant();
        if (variant.id !== "current") {
          applyCreationTheme(variant.theme);
        } else {
          render();
        }
        runAction(persistSelectedThemeToDeck);
      });
      elements.themeFavoriteList.addEventListener("click", (event) => {
        const target: any = event.target;
        const button = target.closest("[data-theme-favorite-id]");
        if (!button || !elements.themeFavoriteList.contains(button)) {
          return;
        }

        applySavedThemeToDeck(button.dataset.themeFavoriteId);
        runAction(persistSelectedThemeToDeck);
      });
    }

    return {
      generateCandidates,
      generateFromBrief,
      getSelectedVariant,
      getVariants,
      mount,
      renderFavorites,
      renderSavedThemes,
      renderStage,
      resetCandidates
    };
  }
}
