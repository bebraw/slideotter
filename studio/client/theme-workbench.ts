namespace StudioClientThemeWorkbench {
  export function createThemeWorkbench({
    elements,
    escapeHtml,
    getBrief,
    getCurrentTheme,
    getRequestContext,
    render,
    request,
    setBusy,
    state
  }) {
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

    return {
      generateCandidates,
      getVariants,
      renderFavorites,
      renderSavedThemes,
      resetCandidates
    };
  }
}
