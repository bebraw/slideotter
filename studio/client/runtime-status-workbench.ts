import type { StudioClientElements } from "./elements.ts";
import type { StudioClientState as StudioClientStateTypes } from "./state.ts";

export namespace StudioClientRuntimeStatusWorkbench {
  type CreateDomElement = (
    tagName: string,
    options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      dataset?: Record<string, string | number | boolean>;
      disabled?: boolean;
      text?: unknown;
    },
    children?: Array<Node | string | number | boolean>
  ) => HTMLElement;

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

  type RuntimeLlmStatus = {
    model?: string;
    provider?: string;
  };

  type LlmModelState = {
    activeModel?: string;
    configuredModel?: string;
    error?: string;
    models?: string[];
    provider?: string;
    runtimeOverride?: string;
  };

  type LlmModelsResponse = {
    llm?: LlmModelState;
    runtime?: RuntimeState;
  };

  type LlmModelUpdateRequest = {
    modelOverride: string;
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

  type LlmCheckRequest = Record<string, never>;

  type LlmCheckResponse = {
    result?: {
      summary?: string;
    };
    runtime?: RuntimeState;
  };

  type Request = <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;

  type RuntimeStatusDependencies = {
    createDomElement: CreateDomElement;
    customLayoutWorkbench: {
      isSupported: () => boolean;
      renderLibrary: () => void;
    };
    elements: StudioClientElements.Elements;
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
    request: Request;
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
      createDomElement,
      customLayoutWorkbench,
      elements,
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
    let llmModelState: LlmModelState | null = null;

    function asRecord(value: unknown): Record<string, unknown> {
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    }

    function asRuntimeLlmStatus(value: unknown): RuntimeLlmStatus {
      const record = asRecord(value);
      return {
        model: typeof record.model === "string" ? record.model : "",
        provider: typeof record.provider === "string" ? record.provider : ""
      };
    }

    function currentLlmActiveModel(): string {
      const llm = asRuntimeLlmStatus(state.runtime && state.runtime.llm);
      return (llmModelState && llmModelState.activeModel) || llm.model || "";
    }

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
        elements.workflowHistory.replaceChildren();
        return;
      }

      elements.workflowHistory.replaceChildren(...events.map((event: WorkflowState) => {
        const labelParts = [
          event.operation || "workflow",
          event.slideId || "",
          event.stage || event.status || ""
        ].filter(Boolean);

        return createDomElement("div", { className: "workflow-history-item" }, [
          createDomElement("strong", { text: labelParts.join(" • ") }),
          createDomElement("span", { text: event.message || describeWorkflowProgress(event) })
        ]);
      }));
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
        elements.sourceRetrievalList.replaceChildren(createDomElement("div", {
          className: "source-retrieval-empty",
          text: "No source snippets were used by the last generation."
        }));
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

      elements.sourceRetrievalList.replaceChildren(...snippets.map((snippet: RuntimeSourceSnippet, index: number) => {
        const meta = [
          snippet.url || "",
          Number.isFinite(Number(snippet.chunkIndex)) ? `chunk ${Number(snippet.chunkIndex) + 1}` : ""
        ].filter(Boolean).join(" · ");

        return createDomElement("article", { className: "source-retrieval-card" }, [
          createDomElement("strong", { text: snippet.title || `Source ${index + 1}` }),
          createDomElement("span", { text: meta || "Retrieved source" }),
          createDomElement("p", { text: snippet.text || "Snippet text is not stored in diagnostics." })
        ]);
      }));
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
        elements.promptBudgetList.replaceChildren(createDomElement("div", {
          className: "source-retrieval-empty",
          text: "No prompt budget has been recorded yet."
        }));
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

      elements.promptBudgetList.replaceChildren(createDomElement("article", { className: "source-retrieval-card" }, [
        createDomElement("strong", { text: `${budget.provider || "LLM"} ${budget.model || ""}` }),
        createDomElement("span", { text: budget.schemaName || "structured response" }),
        createDomElement("p", { text: rows.map(([label, value]) => `${label}: ${formatCharCount(value)}`).join(" · ") })
      ]));
    }

    function renderLlmStatusNote(label: string, detail: string): void {
      elements.llmStatusNote.replaceChildren(
        createDomElement("strong", { text: label }),
        document.createTextNode(detail)
      );
    }

    function renderLlmModelControls(): void {
      const llm = asRuntimeLlmStatus(state.runtime && state.runtime.llm);
      const isLmStudio = llm.provider === "lmstudio";
      elements.llmModelControl.hidden = !isLmStudio;

      if (!isLmStudio) {
        elements.llmModelSelect.replaceChildren();
        elements.llmModelNote.textContent = "Model selection is available when the active provider is LM Studio.";
        return;
      }

      const modelState = llmModelState || {
        activeModel: llm.model || "",
        configuredModel: llm.model || "",
        models: [],
        provider: "lmstudio",
        runtimeOverride: ""
      };
      const models = Array.isArray(modelState.models) ? modelState.models : [];
      const activeModel = currentLlmActiveModel();
      const optionModels = Array.from(new Set([
        activeModel,
        ...models
      ].filter(Boolean)));

      elements.llmModelSelect.replaceChildren(...optionModels.map((model) => {
        const option = createDomElement("option", {
          attributes: {
            value: model
          },
          text: model
        }) as HTMLOptionElement;
        option.selected = model === activeModel;
        return option;
      }));
      elements.llmModelSelect.disabled = !optionModels.length;
      elements.llmModelApplyButton.disabled = !optionModels.length || elements.llmModelSelect.value === activeModel;
      elements.llmModelClearButton.disabled = !modelState.runtimeOverride;

      if (modelState.error) {
        elements.llmModelNote.textContent = `Model refresh failed. ${modelState.error}`;
      } else if (models.length) {
        const overrideLabel = modelState.runtimeOverride ? " Runtime override is active." : " Environment default is active.";
        elements.llmModelNote.textContent = `${models.length} loaded model${models.length === 1 ? "" : "s"} from LM Studio.${overrideLabel}`;
      } else {
        elements.llmModelNote.textContent = activeModel
          ? "Refresh loaded LM Studio models before switching."
          : "Refresh loaded LM Studio models before selecting a runtime override.";
      }
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
      renderLlmModelControls();

      const llmDetail = llmView.detail.startsWith(llmView.providerLine)
        ? llmView.detail.slice(llmView.providerLine.length)
        : `. ${llmView.detail}`;
      renderLlmStatusNote(llmView.providerLine, llmDetail);
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
        const requestBody: LlmCheckRequest = {};
        const payload = await request<LlmCheckResponse>("/api/llm/check", {
          body: JSON.stringify(requestBody),
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
        renderLlmStatusNote("LLM provider", ` startup check failed. ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        state.ui.llmChecking = false;
        renderStatus();
        if (done) {
          done();
        }
      }
    }

    async function refreshLlmModels(): Promise<void> {
      const done = setBusy(elements.llmModelRefreshButton, "Refreshing...");

      try {
        const payload = await request<LlmModelsResponse>("/api/llm/models");
        llmModelState = payload.llm || null;
        if (payload.runtime) {
          state.runtime = payload.runtime;
        }
        elements.operationStatus.textContent = llmModelState && llmModelState.error
          ? `LM Studio model refresh failed. ${llmModelState.error}`
          : "Refreshed loaded LM Studio models.";
        renderStatus();
      } finally {
        done();
      }
    }

    async function applyLlmModelOverride(): Promise<void> {
      const selectedModel = elements.llmModelSelect.value || "";
      if (!selectedModel) {
        windowRef.alert("Select a loaded LM Studio model first.");
        return;
      }

      const done = setBusy(elements.llmModelApplyButton, "Applying...");
      try {
        const requestBody: LlmModelUpdateRequest = {
          modelOverride: selectedModel
        };
        const payload = await request<LlmModelsResponse>("/api/llm/model", {
          body: JSON.stringify(requestBody),
          method: "POST"
        });
        llmModelState = payload.llm || null;
        state.runtime = payload.runtime || state.runtime;
        elements.operationStatus.textContent = `Using ${selectedModel} for LM Studio workflows. Run Check when you want to verify it.`;
        renderStatus();
      } finally {
        done();
      }
    }

    async function clearLlmModelOverride(): Promise<void> {
      const done = setBusy(elements.llmModelClearButton, "Clearing...");
      try {
        const requestBody: LlmModelUpdateRequest = {
          modelOverride: ""
        };
        const payload = await request<LlmModelsResponse>("/api/llm/model", {
          body: JSON.stringify(requestBody),
          method: "POST"
        });
        llmModelState = payload.llm || null;
        state.runtime = payload.runtime || state.runtime;
        elements.operationStatus.textContent = "Cleared LM Studio model override. Environment model is active again.";
        renderStatus();
      } finally {
        done();
      }
    }

    function mountLlmModelControls(): void {
      elements.llmModelRefreshButton.addEventListener("click", () => refreshLlmModels().catch((error) => windowRef.alert(error.message)));
      elements.llmModelApplyButton.addEventListener("click", () => applyLlmModelOverride().catch((error) => windowRef.alert(error.message)));
      elements.llmModelClearButton.addEventListener("click", () => clearLlmModelOverride().catch((error) => windowRef.alert(error.message)));
      elements.llmModelSelect.addEventListener("change", () => {
        elements.llmModelApplyButton.disabled = !elements.llmModelSelect.value || elements.llmModelSelect.value === currentLlmActiveModel();
      });
    }

    return {
      applyCreationDraftUpdate,
      applyRuntimeUpdate,
      applyWorkflowEvent,
      checkLlmProvider,
      connectRuntimeStream,
      describeWorkflowProgress,
      mountLlmModelControls,
      renderPromptBudget,
      renderSourceRetrieval,
      renderStatus,
      renderWorkflowHistory,
      setLlmPopoverOpen,
      toggleLlmPopover
    };
  }
}
