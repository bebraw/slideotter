namespace StudioClientPresentationCreationWorkbench {
  export function createPresentationCreationWorkbench(deps) {
    const {
      elements,
      escapeHtml,
      getPresentationState,
      isWorkflowRunning,
      renderCreationThemeStage,
      renderDomSlide,
      resetThemeCandidates,
      refreshState,
      saveCreationDraft,
      request,
      setBusy,
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

    function getAutoContentRunSlideIndex(run) {
      const slides = run && Array.isArray(run.slides) ? run.slides : [];
      const generatingIndex = slides.findIndex((slide) => slide && slide.status === "generating");
      if (generatingIndex >= 0) {
        return generatingIndex + 1;
      }

      for (let index = slides.length - 1; index >= 0; index -= 1) {
        if (slides[index] && slides[index].status === "complete") {
          return index + 1;
        }
      }

      const failedIndex = slides.findIndex((slide) => slide && slide.status === "failed");
      return failedIndex >= 0 ? failedIndex + 1 : 1;
    }

    function getContentRunStatusLabel(status) {
      switch (status) {
        case "running":
          return "Generating";
        case "failed":
          return "Failed";
        case "stopped":
          return "Stopped";
        case "completed":
          return "Complete";
        default:
          return "Ready";
      }
    }

    function truncateStatusText(value, maxLength = 140) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      if (text.length <= maxLength) {
        return text;
      }

      return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
    }

    function getContentRunFailureDetail(runSlides) {
      const failedIndex = runSlides.findIndex((slide) => slide && slide.status === "failed");
      if (failedIndex < 0) {
        return "";
      }

      const failedSlide = runSlides[failedIndex] || {};
      const error = truncateStatusText(failedSlide.error || "Slide generation failed.");
      return ` Slide ${failedIndex + 1} failed: ${error}`;
    }

    function formatContentRunSummary(run, slideCount, runSlides) {
      const completedCount = run && Number.isFinite(Number(run.completed))
        ? Number(run.completed)
        : runSlides.filter((slide) => slide && slide.status === "complete").length;
      const runStatus = run && run.status ? run.status : "ready";
      const failedCount = runSlides.filter((slide) => slide && slide.status === "failed").length;
      const generatingIndex = runSlides.findIndex((slide) => slide && slide.status === "generating");
      const activePart = generatingIndex >= 0 ? ` Slide ${generatingIndex + 1} is generating.` : "";
      const failurePart = failedCount ? ` ${failedCount} failed.${getContentRunFailureDetail(runSlides)}` : "";

      return `${completedCount}/${slideCount} slides complete. ${getContentRunStatusLabel(runStatus)}.${activePart}${failurePart}`;
    }

    function getLiveStudioContentRun() {
      const draft = state.creationDraft || {};
      const run = draft.contentRun && typeof draft.contentRun === "object" ? draft.contentRun : null;
      if (!run || !draft.createdPresentationId) {
        return null;
      }

      const presentationState = getPresentationState();
      return draft.createdPresentationId === presentationState.activePresentationId ? run : null;
    }

    function renderContentRunNavStatus() {
      if (!elements.contentRunNavStatus) {
        return;
      }

      const draft = state.creationDraft || {};
      const deckPlan = draft.deckPlan;
      const run = draft.contentRun;
      const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
      const slideCount = run && Number.isFinite(Number(run.slideCount))
        ? Number(run.slideCount)
        : deckPlan && Array.isArray(deckPlan.slides)
          ? deckPlan.slides.length
          : 0;

      const shouldShow = run
        && slideCount
        && ["running", "failed", "stopped"].includes(run.status || "");
      if (!shouldShow) {
        elements.contentRunNavStatus.hidden = true;
        elements.contentRunNavStatus.textContent = "";
        elements.contentRunNavStatus.dataset.state = "idle";
        return;
      }

      elements.contentRunNavStatus.hidden = false;
      const summary = formatContentRunSummary(run, slideCount, runSlides);
      elements.contentRunNavStatus.textContent = summary;
      elements.contentRunNavStatus.title = summary;
      elements.contentRunNavStatus.dataset.state = run.status || "idle";
    }

    function getContentRunActionState() {
      const draft = state.creationDraft || {};
      const deckPlan = draft.deckPlan;
      const run = draft.contentRun && typeof draft.contentRun === "object" ? draft.contentRun : null;
      const planSlides = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
      const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
      if (!run || !planSlides.length) {
        return null;
      }

      const slideCount = Number.isFinite(Number(run.slideCount)) ? Number(run.slideCount) : planSlides.length;
      const failedIndex = runSlides.findIndex((slide) => slide && slide.status === "failed");
      const completedCount = Number.isFinite(Number(run.completed))
        ? Number(run.completed)
        : runSlides.filter((slide) => slide && slide.status === "complete").length;
      const incompleteCount = runSlides.filter((slide) => slide && slide.status !== "complete").length;

      return {
        completedCount,
        failedIndex,
        incompleteCount,
        run,
        runSlides,
        slideCount
      };
    }

    function renderStudioContentRunPanel() {
      if (!elements.studioContentRunPanel) {
        return;
      }

      const actionState = getContentRunActionState();
      const activeRun = getLiveStudioContentRun();
      if (!actionState || !activeRun || !["running", "failed", "stopped"].includes(actionState.run.status || "")) {
        elements.studioContentRunPanel.hidden = true;
        elements.studioContentRunPanel.innerHTML = "";
        return;
      }

      const { completedCount, failedIndex, incompleteCount, run, runSlides, slideCount } = actionState;
      const summary = formatContentRunSummary(run, slideCount, runSlides);
      const canRetry = run.status === "failed" && failedIndex >= 0 && !isWorkflowRunning();
      const canAcceptPartial = run.status !== "running" && completedCount > 0 && incompleteCount > 0;

      elements.studioContentRunPanel.hidden = false;
      elements.studioContentRunPanel.dataset.state = run.status || "idle";
      elements.studioContentRunPanel.innerHTML = `
        <div>
          <p class="eyebrow">Live generation</p>
          <strong>${escapeHtml(summary)}</strong>
        </div>
        <div class="button-row compact">
          ${run.status === "running" ? "<button class=\"secondary compact-button\" type=\"button\" data-studio-content-run-stop>Stop</button>" : ""}
          ${canRetry ? `<button class="secondary compact-button" type="button" data-studio-content-run-retry="${failedIndex + 1}">Retry slide ${failedIndex + 1}</button>` : ""}
          ${canAcceptPartial ? "<button class=\"secondary compact-button\" type=\"button\" data-studio-content-run-accept-partial>Accept completed</button>" : ""}
        </div>
      `;
    }

    function renderContentRun(draft) {
      if (!elements.contentRunRail || !elements.contentRunPreview || !elements.contentRunPreviewTitle || !elements.contentRunPreviewEyebrow || !elements.contentRunPreviewActions || !elements.contentRunSummary) {
        return;
      }

      const deckPlan = draft && draft.deckPlan;
      const planSlides = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
      const run = draft && draft.contentRun;
      const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
      const slideCount = planSlides.length;

      if (!slideCount) {
        elements.contentRunRail.innerHTML = "";
        elements.contentRunPreviewActions.innerHTML = "";
        elements.contentRunSummary.textContent = "No slides generated yet.";
        elements.contentRunPreviewEyebrow.textContent = "Preview";
        elements.contentRunPreviewTitle.textContent = "No outline yet";
        elements.contentRunPreview.innerHTML = `
          <div class="creation-content-placeholder">
            <h4>Generate an outline first</h4>
            <p>Draft slides are available after the outline is approved.</p>
          </div>
        `;
        return;
      }

      const selected = Number.isFinite(Number(state.ui.creationContentSlideIndex))
        ? Math.max(1, Math.min(slideCount, Number(state.ui.creationContentSlideIndex)))
        : 1;
      state.ui.creationContentSlideIndex = selected;

      const statusLabel = (status) => {
        switch (status) {
          case "generating":
            return "Generating";
          case "complete":
            return "Complete";
          case "failed":
            return "Failed";
          default:
            return "Pending";
        }
      };

      elements.contentRunSummary.textContent = formatContentRunSummary(run, slideCount, runSlides);

      elements.contentRunRail.innerHTML = planSlides.map((slide, index) => {
        const runSlide = runSlides[index] || null;
        const status = runSlide && runSlide.status ? runSlide.status : "pending";
        const active = selected === index + 1;
        const displayTitle = status === "complete" && runSlide && runSlide.slideSpec && runSlide.slideSpec.title
          ? runSlide.slideSpec.title
          : slide.title || `Slide ${index + 1}`;
        const role = slide.role || "slide";
        return `
          <button
            class="creation-content-rail-item${active ? " is-active" : ""}"
            type="button"
            data-content-run-slide="${index + 1}"
            data-status="${escapeHtml(status)}"
            aria-pressed="${active ? "true" : "false"}"
          >
            <span class="creation-content-rail-index" aria-hidden="true">${index + 1}</span>
            <span class="creation-content-rail-meta">
              <strong>${escapeHtml(displayTitle)}</strong>
              <small>${escapeHtml(`${role} - ${statusLabel(status)}`)}</small>
            </span>
          </button>
        `;
      }).join("");

      const index = selected - 1;
      const planSlide = planSlides[index] || {};
      const runSlide = runSlides[index] || null;
      const status = runSlide && runSlide.status ? runSlide.status : "pending";
      const completedCount = run && Number.isFinite(Number(run.completed))
        ? Number(run.completed)
        : runSlides.filter((slide) => slide && slide.status === "complete").length;
      const incompleteCount = runSlides.filter((slide) => slide && slide.status !== "complete").length;

      elements.contentRunPreviewActions.innerHTML = "";
      elements.contentRunPreviewEyebrow.textContent = statusLabel(status);
      elements.contentRunPreviewTitle.textContent = `${selected}. ${planSlide.title || `Slide ${selected}`}`;

      if (run && run.status === "running") {
        elements.contentRunPreviewActions.innerHTML = `
          <button class="secondary compact-button" type="button" data-content-run-stop>Stop generation</button>
        `;
      }
      if (run && run.status !== "running" && completedCount > 0 && incompleteCount > 0) {
        elements.contentRunPreviewActions.insertAdjacentHTML("beforeend", `
          <button class="secondary compact-button" type="button" data-content-run-accept-partial>Accept completed</button>
        `);
      }

      if (status === "complete" && runSlide && runSlide.slideSpec) {
        elements.contentRunPreview.innerHTML = "";
        renderDomSlide(elements.contentRunPreview, runSlide.slideSpec, {
          index: selected,
          totalSlides: slideCount
        });
        return;
      }

      if (status === "failed") {
        const retryDisabled = isWorkflowRunning();
        elements.contentRunPreviewActions.insertAdjacentHTML("beforeend", `
          <button class="secondary compact-button" type="button" data-content-run-retry-slide="${selected}"${retryDisabled ? " disabled" : ""}>Retry slide</button>
        `);
      }

      const describe = (label, value, fallback) => {
        const body = String(value || "").trim() || fallback;
        return `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(body)}</dd>
          </div>
        `;
      };

      elements.contentRunPreview.innerHTML = `
        <div class="creation-content-placeholder">
          <h4>${escapeHtml(planSlide.title || `Slide ${selected}`)}</h4>
          ${status === "failed" ? `<p>${escapeHtml(String(runSlide && runSlide.error ? runSlide.error : "Slide generation failed."))}</p>` : ""}
          ${status === "failed" && runSlide && runSlide.errorLogPath ? `<p>Full error log: <code>${escapeHtml(runSlide.errorLogPath)}</code></p>` : ""}
          ${status === "generating" ? "<p>Drafting this slide now...</p>" : status === "pending" ? "<p>Waiting for generation.</p>" : ""}
          <dl>
            ${describe("Intent", planSlide.intent, "No intent provided.")}
            ${describe("Key message", planSlide.keyMessage || planSlide.intent, "No key message provided.")}
            ${describe("Source need", planSlide.sourceNeed, "No specific source need.")}
            ${describe("Visual need", planSlide.visualNeed, "No specific visual need.")}
          </dl>
        </div>
      `;
    }

    function closestContainedButton(target, container, selector) {
      if (!target || typeof target.closest !== "function") {
        return null;
      }

      const button = target.closest(selector);
      return button && container.contains(button) ? button : null;
    }

    function retrySlide(slideNumber) {
      request("/api/presentations/draft/content/retry", {
        body: JSON.stringify({
          slideIndex: slideNumber - 1
        }),
        method: "POST"
      }).catch((error) => window.alert(error.message));
    }

    function stopRun(button) {
      const done = setBusy(button, "Stopping...");
      request("/api/presentations/draft/content/stop", {
        method: "POST"
      }).catch((error) => window.alert(error.message)).finally(() => done());
    }

    function acceptPartial(button) {
      const done = setBusy(button, "Accepting...");
      request("/api/presentations/draft/content/accept-partial", {
        method: "POST"
      }).then((payload) => {
        state.creationDraft = payload.creationDraft || state.creationDraft;
        return refreshState();
      }).catch((error) => window.alert(error.message)).finally(() => done());
    }

    function handleContentRunActionClick(event, container, selectors) {
      const target = event.target;
      const retryButton = closestContainedButton(target, container, selectors.retry);
      if (retryButton) {
        const slideNumber = Number.parseInt(retryButton.dataset[selectors.retryDataset], 10);
        if (Number.isFinite(slideNumber)) {
          retrySlide(slideNumber);
        }
        return;
      }

      const stopButton = closestContainedButton(target, container, selectors.stop);
      if (stopButton) {
        stopRun(stopButton);
        return;
      }

      const acceptButton = closestContainedButton(target, container, selectors.accept);
      if (acceptButton) {
        acceptPartial(acceptButton);
      }
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

    function mountContentRunControls(renderCreationDraft) {
      if (elements.contentRunRail) {
        elements.contentRunRail.addEventListener("click", (event) => {
          const button = closestContainedButton(event.target, elements.contentRunRail, "[data-content-run-slide]");
          if (!button) {
            return;
          }

          const slideNumber = Number.parseInt(button.dataset.contentRunSlide, 10);
          if (!Number.isFinite(slideNumber)) {
            return;
          }

          state.ui.creationContentSlideIndex = slideNumber;
          state.ui.creationContentSlidePinned = true;
          renderCreationDraft();
        });
      }

      if (elements.contentRunPreviewActions) {
        elements.contentRunPreviewActions.addEventListener("click", (event) => {
          handleContentRunActionClick(event, elements.contentRunPreviewActions, {
            accept: "[data-content-run-accept-partial]",
            retry: "[data-content-run-retry-slide]",
            retryDataset: "contentRunRetrySlide",
            stop: "[data-content-run-stop]"
          });
        });
      }

      if (elements.studioContentRunPanel) {
        elements.studioContentRunPanel.addEventListener("click", (event) => {
          handleContentRunActionClick(event, elements.studioContentRunPanel, {
            accept: "[data-studio-content-run-accept-partial]",
            retry: "[data-studio-content-run-retry]",
            retryDataset: "studioContentRunRetry",
            stop: "[data-studio-content-run-stop]"
          });
        });
      }
    }

    return {
      applyFields,
      formatContentRunSummary,
      getAutoContentRunSlideIndex,
      getFields,
      getInputElements,
      getLiveStudioContentRun,
      getStatusLabel: getContentRunStatusLabel,
      isOutlineRelevantInput,
      mountContentRunControls,
      mountInputs,
      renderContentRun,
      renderContentRunNavStatus,
      renderStudioContentRunPanel,
      truncateStatusText
    };
  }
}
