namespace StudioClientContentRunActions {
  function closestContainedButton(target, container, selector) {
    if (!target || typeof target.closest !== "function") {
      return null;
    }

    const button = target.closest(selector);
    return button && container.contains(button) ? button : null;
  }

  export function mountContentRunControls({
    elements,
    refreshState,
    renderCreationDraft,
    request,
    setBusy,
    state
  }) {
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

    function handleActionClick(event, container, selectors) {
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
        handleActionClick(event, elements.contentRunPreviewActions, {
          accept: "[data-content-run-accept-partial]",
          retry: "[data-content-run-retry-slide]",
          retryDataset: "contentRunRetrySlide",
          stop: "[data-content-run-stop]"
        });
      });
    }

    if (elements.studioContentRunPanel) {
      elements.studioContentRunPanel.addEventListener("click", (event) => {
        handleActionClick(event, elements.studioContentRunPanel, {
          accept: "[data-studio-content-run-accept-partial]",
          retry: "[data-studio-content-run-retry]",
          retryDataset: "studioContentRunRetry",
          stop: "[data-studio-content-run-stop]"
        });
      });
    }
  }
}
