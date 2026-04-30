import type { StudioClientElements } from "./elements.ts";
import type { StudioClientState as StudioClientStateTypes } from "./state.ts";

export namespace StudioClientRuntimeStatusWorkbench {
  type WorkflowStage =
    | "completed"
    | "gathering-context"
    | "generating-variants"
    | "rebuilding-previews"
    | "rendering-variants"
    | "validating-geometry-text"
    | "validating-render";

  type WorkflowState = {
    id?: string;
    message?: string;
    operation?: string;
    slideId?: string;
    stage?: WorkflowStage | string;
    status?: string;
  };

  type RuntimeSourceSnippet = {
    chunkIndex?: number | string;
    sourceId?: string;
    text?: string;
    title?: string;
    url?: string;
  };

  type RuntimeSourceRetrieval = {
    budget?: {
      omittedSnippetCount?: number | string;
      promptCharCount?: number | string;
      sourceCount?: number | string;
    };
    snippets?: RuntimeSourceSnippet[];
  };

  type RuntimePromptBudget = {
    developerPromptCharCount?: number | string;
    materialPromptCharCount?: number | string;
    model?: string;
    provider?: string;
    requestedMaxOutputTokens?: number | string;
    responseCharCount?: number | string | null;
    retryCount?: number | string;
    schemaCharCount?: number | string;
    schemaName?: string;
    sourcePromptCharCount?: number | string;
    totalPromptCharCount?: number | string;
    userPromptCharCount?: number | string;
    workflowName?: string;
  };

  type RuntimeState = {
    llm?: unknown;
    promptBudget?: RuntimePromptBudget;
    sourceRetrieval?: RuntimeSourceRetrieval;
    validation?: {
      ok?: boolean;
      updatedAt?: string;
    };
    workflow?: WorkflowState;
    workflowHistory?: WorkflowState[];
  };

  type CreationDraft = {
    contentRun?: {
      id?: string;
      status?: string;
    };
    createdPresentationId?: string;
    stage?: string;
  };

  type StudioSlide = {
    id: string;
    index: number;
    title?: string;
  };

  type StudioClientState = {
    creationDraft: CreationDraft | null;
    runtime: RuntimeState | null;
    selectedSlideId: string | null;
    selectedSlideSpec: {
      media?: unknown;
    } | null;
    selectedSlideSpecDraftError: unknown;
    selectedSlideStructured: boolean;
    slides: StudioSlide[];
    ui: {
      creationContentSlideIndex: number;
      creationContentSlidePinned: boolean;
      creationStage: string;
      creationStudioRefreshPending: boolean;
      currentPage: string;
      lastCreatedPresentationId: string | null;
      llmChecking: boolean;
      llmPopoverOpen: boolean;
      themeDrawerOpen: boolean;
    };
    workflowHistory: WorkflowState[];
  };

  type LlmConnectionView = {
    detail: string;
    label: string;
    providerLine: string;
    state: string;
  };

  type RuntimeStatusDependencies = {
    customLayoutWorkbench: {
      isSupported: () => boolean;
      renderLibrary: () => void;
    };
    elements: StudioClientElements.Elements;
    escapeHtml: (value: unknown) => string;
    getPresentationState: () => {
      activePresentationId?: string | null;
    };
    isEmptyCreationDraft: (draft: CreationDraft | null) => boolean;
    llmStatus: {
      getConnectionView: (llm: unknown) => LlmConnectionView;
      setPopoverOpen: (open: boolean) => void;
      togglePopover: () => void;
    };
    presentationCreationWorkbench: {
      getAutoContentRunSlideIndex: (contentRun: CreationDraft["contentRun"]) => number;
      normalizeStage: (stage: string) => string;
      renderContentRunNavStatus: () => void;
      renderStudioContentRunPanel: () => void;
    };
    renderApiExplorer: () => void;
    renderCreationDraft: () => void;
    renderMaterials: () => void;
    renderSources: () => void;
    renderThemeDrawer: () => void;
    renderVariantFlow: () => void;
    request: (url: string, options?: RequestInit) => Promise<{
      result?: {
        summary?: string;
      };
      runtime?: RuntimeState;
    }>;
    resetPresentationCreationControl: () => void;
    resetThemeCandidates: () => void;
    refreshState: () => Promise<void>;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
    setCurrentPage: (page: string) => void;
    state: StudioClientStateTypes.State;
    windowRef: Window;
  };

  type CheckLlmOptions = {
    silent?: boolean;
  };

  type RuntimeStreamEvent = MessageEvent<string>;

  const workflowStageFallback: Record<WorkflowStage, string> = {
    "gathering-context": "Gathering context...",
    "generating-variants": "Generating variants...",
    "rendering-variants": "Rendering previews...",
    "rebuilding-previews": "Rebuilding previews...",
    "validating-geometry-text": "Running checks...",
    "validating-render": "Running full gate...",
    completed: "Workflow completed."
  };

  export function createRuntimeStatusWorkbench(dependencies: RuntimeStatusDependencies) {
    const {
      customLayoutWorkbench,
      elements,
      escapeHtml,
      getPresentationState,
      isEmptyCreationDraft,
      llmStatus,
      presentationCreationWorkbench,
      renderApiExplorer,
      renderCreationDraft,
      renderMaterials,
      renderSources,
      renderThemeDrawer,
      renderVariantFlow,
      request,
      resetPresentationCreationControl,
      resetThemeCandidates,
      refreshState,
      setBusy,
      setCurrentPage,
      state,
      windowRef
    } = dependencies;

    let runtimeEventSource: EventSource | null = null;

    function describeWorkflowProgress(workflow: WorkflowState | null | undefined): string {
      if (!workflow) {
        return "";
      }

      if (workflow.message) {
        return workflow.message;
      }

      const fallback = workflow.stage && workflow.stage in workflowStageFallback
        ? workflowStageFallback[workflow.stage as WorkflowStage]
        : undefined;

      return fallback || "Working...";
    }

    function renderWorkflowHistory(): void {
      const events = Array.isArray(state.workflowHistory) ? state.workflowHistory.slice(-4).reverse() : [];

      if (!events.length) {
        elements.workflowHistory.innerHTML = "";
        return;
      }

      elements.workflowHistory.innerHTML = events.map((event: WorkflowState) => {
        const labelParts = [
          event.operation || "workflow",
          event.slideId || "",
          event.stage || event.status || ""
        ].filter(Boolean);

        return `
          <div class="workflow-history-item">
            <strong>${escapeHtml(labelParts.join(" • "))}</strong>
            <span>${escapeHtml(event.message || describeWorkflowProgress(event))}</span>
          </div>
        `;
      }).join("");
    }

    function renderSourceRetrieval(): void {
      if (!elements.sourceRetrievalList) {
        return;
      }

      const retrieval = state.runtime && state.runtime.sourceRetrieval;
      const snippets = retrieval && Array.isArray(retrieval.snippets) ? retrieval.snippets : [];
      if (!snippets.length) {
        if (elements.sourceRetrievalSummary) {
          elements.sourceRetrievalSummary.textContent = "No source snippets were used by the last generation.";
        }
        elements.sourceRetrievalList.innerHTML = "<div class=\"source-retrieval-empty\">No source snippets were used by the last generation.</div>";
        return;
      }

      if (elements.sourceRetrievalSummary) {
        const budget = retrieval && retrieval.budget ? retrieval.budget : {};
        const sourceKeys = new Set(snippets.map((snippet: RuntimeSourceSnippet) => snippet.sourceId || snippet.title || snippet.url || "").filter(Boolean));
        const sourceCount = Number.isFinite(Number(budget.sourceCount)) ? Number(budget.sourceCount) : sourceKeys.size || snippets.length;
        const promptChars = Number.isFinite(Number(budget.promptCharCount)) ? Number(budget.promptCharCount) : null;
        const omittedCount = Number.isFinite(Number(budget.omittedSnippetCount)) ? Number(budget.omittedSnippetCount) : 0;
        const budgetLabel = promptChars === null ? "" : `, ${promptChars} source chars`;
        const omittedLabel = omittedCount > 0 ? `, ${omittedCount} omitted by budget` : "";
        elements.sourceRetrievalSummary.textContent = `${snippets.length} source snippet${snippets.length === 1 ? "" : "s"} from ${sourceCount} source${sourceCount === 1 ? "" : "s"} informed the last generation${budgetLabel}${omittedLabel}.`;
      }

      elements.sourceRetrievalList.innerHTML = snippets.map((snippet: RuntimeSourceSnippet, index: number) => {
        const meta = [
          snippet.url || "",
          Number.isFinite(Number(snippet.chunkIndex)) ? `chunk ${Number(snippet.chunkIndex) + 1}` : ""
        ].filter(Boolean).join(" · ");

        return `
          <article class="source-retrieval-card">
            <strong>${escapeHtml(snippet.title || `Source ${index + 1}`)}</strong>
            <span>${escapeHtml(meta || "Retrieved source")}</span>
            <p>${escapeHtml(snippet.text || "Snippet text is not stored in diagnostics.")}</p>
          </article>
        `;
      }).join("");
    }

    function formatCharCount(value: number | string | null | undefined): string {
      const number = Number(value);
      return Number.isFinite(number) ? number.toLocaleString() : "0";
    }

    function renderPromptBudget(): void {
      if (!elements.promptBudgetList) {
        return;
      }

      const budget = state.runtime && state.runtime.promptBudget;
      if (!budget) {
        if (elements.promptBudgetSummary) {
          elements.promptBudgetSummary.textContent = "No prompt budget has been recorded yet.";
        }
        elements.promptBudgetList.innerHTML = "<div class=\"source-retrieval-empty\">No prompt budget has been recorded yet.</div>";
        return;
      }

      const totalPrompt = Number(budget.totalPromptCharCount || 0);
      const responseChars = Number.isFinite(Number(budget.responseCharCount)) ? Number(budget.responseCharCount) : null;
      const retryLabel = Number(budget.retryCount || 0) > 0 ? `, ${budget.retryCount} retry` : "";
      if (elements.promptBudgetSummary) {
        elements.promptBudgetSummary.textContent = `${budget.workflowName || budget.schemaName || "LLM workflow"} used ${formatCharCount(totalPrompt)} prompt chars with a ${formatCharCount(budget.requestedMaxOutputTokens)} token output cap${retryLabel}.`;
      }

      const rows = [
        ["Developer prompt", budget.developerPromptCharCount],
        ["User prompt", budget.userPromptCharCount],
        ["Schema", budget.schemaCharCount],
        ["Source context", budget.sourcePromptCharCount],
        ["Material context", budget.materialPromptCharCount],
        ["Response", responseChars]
      ];

      elements.promptBudgetList.innerHTML = `
        <article class="source-retrieval-card">
          <strong>${escapeHtml(budget.provider || "LLM")} ${escapeHtml(budget.model || "")}</strong>
          <span>${escapeHtml(budget.schemaName || "structured response")}</span>
          <p>${rows.map(([label, value]) => `${escapeHtml(label)}: ${formatCharCount(value)}`).join(" · ")}</p>
        </article>
      `;
    }

    function renderStatus(): void {
      const llm = state.runtime && state.runtime.llm;
      const validation = state.runtime && state.runtime.validation;
      const workflow = state.runtime && state.runtime.workflow;
      const workflowRunning = Boolean(workflow && workflow.status === "running");
      const selected = state.slides.find((slide: StudioSlide) => slide.id === state.selectedSlideId);
      const llmView = llmStatus.getConnectionView(llm);

      elements.validationStatus.textContent = validation && validation.updatedAt
        ? `Checks ${validation.ok ? "passed" : "need review"}`
        : "Checks idle";
      elements.validationStatus.dataset.state = validation && validation.updatedAt
        ? (validation.ok ? "ok" : "warn")
        : "idle";
      elements.llmNavStatus.textContent = llmView.label;
      elements.llmNavStatus.dataset.state = llmView.state;
      elements.showLlmDiagnosticsButton.title = llmView.detail;
      elements.showLlmDiagnosticsButton.setAttribute("aria-label", `${llmView.label}. ${llmView.detail}`);
      elements.showLlmDiagnosticsButton.classList.toggle("active", state.ui.llmPopoverOpen);
      elements.showLlmDiagnosticsButton.setAttribute("aria-expanded", state.ui.llmPopoverOpen ? "true" : "false");
      elements.llmPopover.hidden = !state.ui.llmPopoverOpen;
      presentationCreationWorkbench.renderContentRunNavStatus();
      presentationCreationWorkbench.renderStudioContentRunPanel();

      elements.ideateSlideButton.disabled = !selected || workflowRunning;
      elements.ideateStructureButton.disabled = !selected || workflowRunning;
      elements.ideateThemeButton.disabled = !selected || workflowRunning;
      elements.redoLayoutButton.disabled = !selected || workflowRunning;
      elements.quickCustomLayoutButton.disabled = !selected || !customLayoutWorkbench.isSupported() || workflowRunning;
      elements.quickCustomLayoutProfile.disabled = !selected || !customLayoutWorkbench.isSupported() || workflowRunning;
      elements.captureVariantButton.disabled = !selected;
      elements.saveLayoutButton.disabled = !selected || !state.selectedSlideSpec;
      if (elements.customLayoutPreviewButton) {
        const customLayoutDisabled = !selected || !customLayoutWorkbench.isSupported() || workflowRunning;
        elements.customLayoutLoadButton.disabled = customLayoutDisabled;
        elements.customLayoutPreviewButton.disabled = customLayoutDisabled;
        elements.customLayoutDiscardButton.disabled = customLayoutDisabled;
      }
      elements.applyLayoutButton.disabled = !selected || !state.selectedSlideSpec || !elements.layoutLibrarySelect.value;
      const selectedLayoutValue = elements.layoutLibrarySelect.value || "";
      elements.favoriteLayoutButton.disabled = !selectedLayoutValue || selectedLayoutValue.startsWith("favorite:");
      elements.deleteFavoriteLayoutButton.disabled = !selectedLayoutValue.startsWith("favorite:");
      elements.materialDetachButton.disabled = !selected || !state.selectedSlideSpec || !state.selectedSlideSpec.media;
      elements.materialUploadButton.disabled = workflowRunning;
      elements.openPresentationModeButton.disabled = !getPresentationState().activePresentationId;
      elements.saveSlideSpecButton.disabled = !selected
        || !state.selectedSlideStructured
        || !state.selectedSlideSpec
        || Boolean(state.selectedSlideSpecDraftError);
      elements.selectedSlideLabel.textContent = selected
        ? `${selected.index}/${state.slides.length} ${selected.title}`
        : "Slide not selected";
      renderVariantFlow();
      renderCreationDraft();
      renderWorkflowHistory();
      renderMaterials();
      customLayoutWorkbench.renderLibrary();
      renderSources();
      renderSourceRetrieval();
      renderPromptBudget();
      renderApiExplorer();

      const llmDetail = llmView.detail.startsWith(llmView.providerLine)
        ? llmView.detail.slice(llmView.providerLine.length)
        : `. ${llmView.detail}`;
      elements.llmStatusNote.innerHTML = `<strong>${escapeHtml(llmView.providerLine)}</strong>${escapeHtml(llmDetail)}`;
    }

    function setLlmPopoverOpen(open: boolean): void {
      llmStatus.setPopoverOpen(open);
    }

    function toggleLlmPopover(): void {
      llmStatus.togglePopover();
    }

    function applyRuntimeUpdate(runtime: RuntimeState | null | undefined): void {
      if (!runtime) {
        return;
      }

      state.runtime = runtime;
      state.workflowHistory = Array.isArray(runtime.workflowHistory) ? runtime.workflowHistory : state.workflowHistory;
      renderStatus();
      renderWorkflowHistory();
      renderSourceRetrieval();
      renderPromptBudget();
      renderApiExplorer();

      const workflow = runtime.workflow;
      if (workflow && workflow.status) {
        elements.operationStatus.textContent = describeWorkflowProgress(workflow);
      }
    }

    function applyWorkflowEvent(workflowEvent: WorkflowState | null | undefined): void {
      if (!workflowEvent || typeof workflowEvent !== "object") {
        return;
      }

      const history = Array.isArray(state.workflowHistory) ? state.workflowHistory : [];
      const previous = history[history.length - 1];
      if (previous && previous.id === workflowEvent.id) {
        return;
      }

      state.workflowHistory = [
        ...history.slice(-11),
        workflowEvent
      ];
      renderWorkflowHistory();
    }

    function applyCreationDraftUpdate(creationDraft: CreationDraft | null | undefined): void {
      if (!creationDraft) {
        return;
      }

      const previousDraft = state.creationDraft;
      const previousPresentationId = state.creationDraft && state.creationDraft.createdPresentationId;
      const previousRunId = state.creationDraft && state.creationDraft.contentRun && state.creationDraft.contentRun.id;
      const nextRunId = creationDraft.contentRun && creationDraft.contentRun.id;
      state.creationDraft = creationDraft;
      if (creationDraft.stage) {
        state.ui.creationStage = presentationCreationWorkbench.normalizeStage(creationDraft.stage || state.ui.creationStage);
      }
      if (nextRunId && nextRunId !== previousRunId) {
        state.ui.creationContentSlidePinned = false;
      }
      if (creationDraft.contentRun && creationDraft.contentRun.status === "running" && !state.ui.creationContentSlidePinned) {
        state.ui.creationContentSlideIndex = presentationCreationWorkbench.getAutoContentRunSlideIndex(creationDraft.contentRun);
      }
      if (isEmptyCreationDraft(creationDraft) && !isEmptyCreationDraft(previousDraft)) {
        resetPresentationCreationControl();
      }

      presentationCreationWorkbench.renderContentRunNavStatus();
      renderCreationDraft();

      const nextPresentationId = creationDraft.createdPresentationId;
      const shouldRefreshLiveStudio = nextPresentationId
        && nextPresentationId === getPresentationState().activePresentationId
        && creationDraft.contentRun
        && state.ui.currentPage === "studio";
      if (shouldRefreshLiveStudio && !state.ui.creationStudioRefreshPending) {
        state.ui.creationStudioRefreshPending = true;
        refreshState()
          .catch((error) => windowRef.alert(error.message))
          .finally(() => {
            state.ui.creationStudioRefreshPending = false;
          });
      }
      if (nextPresentationId && nextPresentationId !== previousPresentationId && nextPresentationId !== state.ui.lastCreatedPresentationId) {
        state.ui.lastCreatedPresentationId = nextPresentationId;
        refreshState()
          .then(() => {
            setCurrentPage("studio");
            state.ui.themeDrawerOpen = false;
            resetThemeCandidates();
            renderThemeDrawer();
            elements.operationStatus.textContent = "Created deck. Review the slides, then open Theme when the surface needs tuning.";
          })
          .catch((error) => windowRef.alert(error.message));
      }
    }

    function connectRuntimeStream(): void {
      if (runtimeEventSource) {
        runtimeEventSource.close();
      }

      runtimeEventSource = new EventSource("/api/runtime/stream");
      runtimeEventSource.addEventListener("runtime", (event: RuntimeStreamEvent) => {
        try {
          const payload = JSON.parse(event.data);
          applyRuntimeUpdate(payload.runtime);
        } catch (error) {
          // Ignore malformed stream messages and keep the connection alive.
        }
      });
      runtimeEventSource.addEventListener("workflow", (event: RuntimeStreamEvent) => {
        try {
          const payload = JSON.parse(event.data);
          applyWorkflowEvent(payload.workflowEvent);
        } catch (error) {
          // Ignore malformed stream messages and keep the connection alive.
        }
      });
      runtimeEventSource.addEventListener("creationDraft", (event: RuntimeStreamEvent) => {
        try {
          const payload = JSON.parse(event.data);
          applyCreationDraftUpdate(payload.creationDraft);
        } catch (error) {
          // Ignore malformed stream messages and keep the connection alive.
        }
      });
    }

    async function checkLlmProvider(options: CheckLlmOptions = {}): Promise<void> {
      const done = options.silent ? null : setBusy(elements.checkLlmButton, "Checking...");
      state.ui.llmChecking = true;
      renderStatus();

      try {
        const payload = await request("/api/llm/check", {
          body: JSON.stringify({}),
          method: "POST"
        });
        state.runtime = payload.runtime || null;
        if (!options.silent) {
          elements.operationStatus.textContent = payload.result && payload.result.summary
            ? payload.result.summary
            : "LLM provider check completed.";
        }
        renderStatus();
      } catch (error) {
        if (!options.silent) {
          throw error;
        }
        elements.llmStatusNote.innerHTML = `<strong>LLM provider</strong> startup check failed. ${escapeHtml(error instanceof Error ? error.message : String(error))}`;
      } finally {
        state.ui.llmChecking = false;
        renderStatus();
        if (done) {
          done();
        }
      }
    }

    return {
      applyCreationDraftUpdate,
      applyRuntimeUpdate,
      applyWorkflowEvent,
      checkLlmProvider,
      connectRuntimeStream,
      describeWorkflowProgress,
      renderPromptBudget,
      renderSourceRetrieval,
      renderStatus,
      renderWorkflowHistory,
      setLlmPopoverOpen,
      toggleLlmPopover
    };
  }
}
