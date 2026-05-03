import type { StudioClientElements } from "../elements.ts";
import type { StudioClientState } from "../state.ts";

export namespace StudioClientWorkflows {
  type WorkflowPayload = {
    deckStructureCandidates?: StudioClientState.JsonRecord[];
    previews?: StudioClientState.State["previews"];
    runtime?: StudioClientState.State["runtime"];
    summary?: string;
    transientVariants?: StudioClientState.VariantRecord[];
    variants?: StudioClientState.VariantRecord[];
  };

  type WorkflowRunOptions = {
    button: StudioClientElements.StudioElement;
    endpoint: string;
  };

  type WorkflowRunnerDependencies = {
    beginAbortableRequest: typeof StudioClientState.beginAbortableRequest;
    clearAbortableRequest: typeof StudioClientState.clearAbortableRequest;
    clearTransientVariants: (slideId: string) => void;
    elements: StudioClientElements.Elements;
    getRequestedCandidateCount: () => number;
    isAbortError: (error: unknown) => boolean;
    isCurrentAbortableRequest: typeof StudioClientState.isCurrentAbortableRequest;
    openVariantGenerationControls: () => void;
    postJson: (url: string, body: unknown, options?: RequestInit) => Promise<WorkflowPayload>;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
    setDeckStructureCandidates: (candidates: StudioClientState.JsonRecord[] | undefined) => void;
    state: StudioClientState.State;
  };

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function formatWorkflowFailure(error: unknown): string {
    const message = errorMessage(error);
    if (/response was not valid JSON|retry also failed|Unterminated string|Expected .* after property value/.test(message)) {
      return "Generation failed because the LLM returned incomplete structured JSON twice. Try fewer candidates, rerun with the current model, or choose a stronger loaded model.";
    }
    return message;
  }

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
  }: WorkflowRunnerDependencies) {
    function applyDeckStructurePayload(payload: WorkflowPayload): void {
      setDeckStructureCandidates(payload.deckStructureCandidates);
      state.runtime = payload.runtime || null;
      elements.operationStatus.textContent = payload.summary || "Deck structure generated.";
      renderDeckStructureCandidates();
      renderStatus();
    }

    async function runDeckStructure({ button, endpoint }: WorkflowRunOptions): Promise<void> {
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
        elements.operationStatus.textContent = formatWorkflowFailure(error);
        renderStatus();
      } finally {
        clearAbortableRequest(state, "deckStructureAbortController", abortController);
        done();
      }
    }

    function applySlidePayload(payload: WorkflowPayload, slideId: string): void {
      state.previews = payload.previews || { pages: [] };
      state.runtime = payload.runtime || null;
      clearTransientVariants(slideId);
      state.transientVariants = [
        ...(payload.transientVariants || []),
        ...state.transientVariants
      ];
      state.variants = payload.variants || [];
      state.selectedVariantId = null;
      state.ui.variantReviewOpen = true;
      elements.operationStatus.textContent = payload.summary || "Slide variants generated.";
      openVariantGenerationControls();
      renderStatus();
      renderPreviews();
      renderVariants();
    }

    async function runSlideCandidate({ button, endpoint }: WorkflowRunOptions): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }

      const slideId = state.selectedSlideId;
      const { abortController, requestSeq } = beginAbortableRequest(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq");
      const candidateCount = getRequestedCandidateCount();
      const done = setBusy(button, "Generating...");
      state.ui.variantReviewOpen = true;
      elements.operationStatus.textContent = `Generating ${candidateCount} slide variant${candidateCount === 1 ? "" : "s"} for the selected slide...`;
      openVariantGenerationControls();
      renderStatus();
      renderVariants();
      try {
        const payload = await postJson(endpoint, {
          candidateCount,
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
        elements.operationStatus.textContent = formatWorkflowFailure(error);
        renderStatus();
      } finally {
        clearAbortableRequest(state, "slideWorkflowAbortController", abortController);
        done();
        renderStatus();
        renderVariants();
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
