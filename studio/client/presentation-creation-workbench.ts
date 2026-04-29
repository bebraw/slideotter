namespace StudioClientPresentationCreationWorkbench {
  export function createPresentationCreationWorkbench(deps) {
    const {
      elements,
      isWorkflowRunning,
      renderCreationThemeStage,
      resetThemeCandidates,
      saveCreationDraft,
      state,
      windowRef
    } = deps;

    let draftSaveTimer = null;

    function getFields() {
      const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);
      return {
        audience: elements.presentationAudience.value.trim(),
        constraints: elements.presentationConstraints.value.trim(),
        imageSearch: {
          count: 3,
          provider: elements.presentationImageSearchProvider.value,
          query: elements.presentationImageSearchQuery.value.trim(),
          restrictions: elements.presentationImageSearchRestrictions.value.trim()
        },
        objective: elements.presentationObjective.value.trim(),
        presentationSourceText: (elements.presentationSourceText.value || elements.presentationOutlineSourceText.value || "").trim(),
        sourcingStyle: elements.presentationSourcingStyle ? elements.presentationSourcingStyle.value : "grounded",
        targetSlideCount: Number.isFinite(targetSlideCount) ? targetSlideCount : null,
        themeBrief: elements.presentationThemeBrief ? elements.presentationThemeBrief.value.trim() : "",
        title: elements.presentationTitle.value.trim(),
        tone: elements.presentationTone.value.trim(),
        visualTheme: {
          accent: elements.presentationThemeAccent ? elements.presentationThemeAccent.value : "#7c3aed",
          bg: elements.presentationThemeBg ? elements.presentationThemeBg.value : "#fff7ed",
          fontFamily: elements.presentationFontFamily ? elements.presentationFontFamily.value : "Avenir Next",
          panel: elements.presentationThemePanel ? elements.presentationThemePanel.value : "#ffffff",
          primary: elements.presentationThemePrimary ? elements.presentationThemePrimary.value : "#1f2937",
          progressFill: elements.presentationThemeSecondary.value,
          progressTrack: elements.presentationThemeBg.value,
          secondary: elements.presentationThemeSecondary ? elements.presentationThemeSecondary.value : "#f97316"
        }
      };
    }

    function getInputElements() {
      return [
        elements.presentationTitle,
        elements.presentationAudience,
        elements.presentationTone,
        elements.presentationTargetSlides,
        elements.presentationObjective,
        elements.presentationConstraints,
        elements.presentationSourcingStyle,
        elements.presentationThemeBrief,
        elements.presentationSourceText,
        elements.presentationOutlineSourceText,
        elements.presentationMaterialFile,
        elements.presentationImageSearchQuery,
        elements.presentationImageSearchProvider,
        elements.presentationImageSearchRestrictions,
        elements.presentationSavedTheme,
        elements.presentationFontFamily,
        elements.presentationThemePrimary,
        elements.presentationThemeSecondary,
        elements.presentationThemeAccent,
        elements.presentationThemeBg,
        elements.presentationThemePanel,
        elements.presentationThemeName
      ].filter(Boolean);
    }

    function isOutlineRelevantInput(element) {
      return [
        elements.presentationTitle,
        elements.presentationAudience,
        elements.presentationTone,
        elements.presentationTargetSlides,
        elements.presentationObjective,
        elements.presentationConstraints,
        elements.presentationSourcingStyle,
        elements.presentationSourceText,
        elements.presentationOutlineSourceText,
        elements.presentationImageSearchQuery,
        elements.presentationImageSearchProvider,
        elements.presentationImageSearchRestrictions
      ].includes(element);
    }

    function applyFields(fields: any = {}) {
      elements.presentationTitle.value = fields.title || "";
      elements.presentationAudience.value = fields.audience || "";
      elements.presentationTone.value = fields.tone || "";
      elements.presentationTargetSlides.value = fields.targetSlideCount ? String(fields.targetSlideCount) : "";
      elements.presentationObjective.value = fields.objective || "";
      elements.presentationConstraints.value = fields.constraints || "";
      if (elements.presentationSourcingStyle) {
        elements.presentationSourcingStyle.value = fields.sourcingStyle || "";
      }
      if (elements.presentationThemeBrief) {
        elements.presentationThemeBrief.value = fields.themeBrief || "";
      }
      if (elements.presentationSourceText) {
        elements.presentationSourceText.value = fields.presentationSourceText || "";
      }
      if (elements.presentationOutlineSourceText) {
        elements.presentationOutlineSourceText.value = fields.presentationSourceText || "";
      }
      if (elements.presentationImageSearchQuery) {
        elements.presentationImageSearchQuery.value = fields.imageSearch && fields.imageSearch.query || "";
      }
      if (elements.presentationImageSearchProvider) {
        elements.presentationImageSearchProvider.value = fields.imageSearch && fields.imageSearch.provider || "openverse";
      }
      if (elements.presentationImageSearchRestrictions) {
        elements.presentationImageSearchRestrictions.value = fields.imageSearch && fields.imageSearch.restrictions || "";
      }

      const theme = fields.visualTheme || {};
      if (elements.presentationFontFamily) {
        elements.presentationFontFamily.value = theme.fontFamily || "avenir";
      }
      if (elements.presentationThemePrimary) {
        elements.presentationThemePrimary.value = theme.primary || "#183153";
      }
      if (elements.presentationThemeSecondary) {
        elements.presentationThemeSecondary.value = theme.secondary || "#275d8c";
      }
      if (elements.presentationThemeAccent) {
        elements.presentationThemeAccent.value = theme.accent || "#f28f3b";
      }
      if (elements.presentationThemeBg) {
        elements.presentationThemeBg.value = theme.bg || "#f5f8fc";
      }
      if (elements.presentationThemePanel) {
        elements.presentationThemePanel.value = theme.panel || "#f8fbfe";
      }
    }

    function syncSourceFields(element) {
      if (element === elements.presentationOutlineSourceText) {
        elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
      }
      if (element === elements.presentationSourceText) {
        elements.presentationOutlineSourceText.value = elements.presentationSourceText.value;
      }
    }

    function isThemeElement(element) {
      return [
        elements.presentationFontFamily,
        elements.presentationThemePrimary,
        elements.presentationThemeSecondary,
        elements.presentationThemeAccent,
        elements.presentationThemeBg,
        elements.presentationThemePanel
      ].includes(element);
    }

    function refreshThemeDraftForElement(element) {
      if (isThemeElement(element)) {
        resetThemeCandidates();
        renderCreationThemeStage();
      }
    }

    function scheduleDraftSave(element) {
      if (isWorkflowRunning()) {
        return;
      }
      if (draftSaveTimer) {
        windowRef.clearTimeout(draftSaveTimer);
      }
      draftSaveTimer = windowRef.setTimeout(() => {
        draftSaveTimer = null;
        saveCreationDraft(state.ui.creationStage, {
          invalidateOutline: isOutlineRelevantInput(element)
        }).catch((error) => window.alert(error.message));
      }, 350);
    }

    function flushDraftSave(element) {
      if (draftSaveTimer) {
        windowRef.clearTimeout(draftSaveTimer);
        draftSaveTimer = null;
      }
      saveCreationDraft(state.ui.creationStage, {
        invalidateOutline: isOutlineRelevantInput(element)
      }).catch((error) => window.alert(error.message));
    }

    function mountInputs() {
      getInputElements().forEach((element) => {
        element.addEventListener("input", () => {
          syncSourceFields(element);
          refreshThemeDraftForElement(element);
          scheduleDraftSave(element);
        });
        element.addEventListener("change", () => {
          syncSourceFields(element);
          refreshThemeDraftForElement(element);
          flushDraftSave(element);
        });
      });
    }

    return {
      applyFields,
      getFields,
      getInputElements,
      isOutlineRelevantInput,
      mountInputs
    };
  }
}
