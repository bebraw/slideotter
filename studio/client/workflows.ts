namespace StudioClientWorkflows {
  export function createWorkflowRunners({
    beginAbortableRequest,
    clearAbortableRequest,
    clearTransientVariants,
    elements,
    getRequestedCandidateCount,
    isAbortError,
    isCurrentAbortableRequest,
    openVariantGenerationControls,
    postJson,
    renderDeckStructureCandidates,
    renderPreviews,
    renderStatus,
    renderVariants,
    setBusy,
    setDeckStructureCandidates,
    state
  }) {
    function applyDeckStructurePayload(payload) {
      setDeckStructureCandidates(payload.deckStructureCandidates);
      state.runtime = payload.runtime;
      elements.operationStatus.textContent = payload.summary;
      renderDeckStructureCandidates();
      renderStatus();
    }

    async function runDeckStructure({ button, endpoint }) {
      const { abortController, requestSeq } = beginAbortableRequest(state, "deckStructureAbortController", "deckStructureRequestSeq");
      const done = setBusy(button, "Generating...");
      try {
        const payload = await postJson(endpoint, {
          candidateCount: getRequestedCandidateCount(),
          dryRun: true
        }, {
          signal: abortController.signal
        });
        if (!isCurrentAbortableRequest(state, "deckStructureAbortController", "deckStructureRequestSeq", requestSeq, abortController)) {
          return;
        }
        applyDeckStructurePayload(payload);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        throw error;
      } finally {
        clearAbortableRequest(state, "deckStructureAbortController", abortController);
        done();
      }
    }

    function applySlidePayload(payload, slideId) {
      state.previews = payload.previews;
      state.runtime = payload.runtime;
      clearTransientVariants(slideId);
      state.transientVariants = [
        ...(payload.transientVariants || []),
        ...state.transientVariants
      ];
      state.variants = payload.variants;
      state.selectedVariantId = null;
      state.ui.variantReviewOpen = true;
      elements.operationStatus.textContent = payload.summary;
      openVariantGenerationControls();
      renderStatus();
      renderPreviews();
      renderVariants();
    }

    async function runSlideCandidate({ button, endpoint }) {
      if (!state.selectedSlideId) {
        return;
      }

      const slideId = state.selectedSlideId;
      const { abortController, requestSeq } = beginAbortableRequest(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq");
      const done = setBusy(button, "Generating...");
      try {
        const payload = await postJson(endpoint, {
          candidateCount: getRequestedCandidateCount(),
          slideId
        }, {
          signal: abortController.signal
        });
        if (
          !isCurrentAbortableRequest(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq", requestSeq, abortController)
          || state.selectedSlideId !== slideId
        ) {
          return;
        }
        applySlidePayload(payload, slideId);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        throw error;
      } finally {
        clearAbortableRequest(state, "slideWorkflowAbortController", abortController);
        done();
      }
    }

    return {
      applyDeckStructurePayload,
      applySlidePayload,
      runDeckStructure,
      runSlideCandidate
    };
  }
}
(globalThis as any).StudioClientWorkflows = StudioClientWorkflows;
