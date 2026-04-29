namespace StudioClientThemeWorkbench {
  export function createThemeWorkbench({
    elements,
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

    return {
      generateCandidates,
      getVariants,
      resetCandidates
    };
  }
}
