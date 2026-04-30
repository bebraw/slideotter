export namespace StudioClientAssistantWorkbench {
  type AssistantWorkbenchDependencies = {
    clearAssistantSelection: () => void;
    clearTransientVariants: (slideId: string) => void;
    elements: Record<string, any>;
    escapeHtml: (value: any) => string;
    getRequestedCandidateCount: () => number;
    openVariantGenerationControls: () => void;
    postJson: (url: string, body: any, options?: any) => Promise<any>;
    renderDeckFields: () => void;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderValidation: () => void;
    renderVariants: () => void;
    setAssistantDrawerOpen: (open: boolean) => void;
    setBusy: (button: any, label: string) => () => void;
    setChecksPanelOpen: (open: boolean) => void;
    setDeckStructureCandidates: (candidates: any[]) => void;
    state: any;
    windowRef: Window;
  };

  export function createAssistantWorkbench(dependencies: AssistantWorkbenchDependencies) {
    const {
      clearAssistantSelection,
      clearTransientVariants,
      elements,
      escapeHtml,
      getRequestedCandidateCount,
      openVariantGenerationControls,
      postJson,
      renderDeckFields,
      renderDeckStructureCandidates,
      renderPreviews,
      renderStatus,
      renderValidation,
      renderVariants,
      setAssistantDrawerOpen,
      setBusy,
      setChecksPanelOpen,
      setDeckStructureCandidates,
      state,
      windowRef
    } = dependencies;

    function render() {
      const session = state.assistant.session;
      const suggestions = Array.isArray(state.assistant.suggestions) ? state.assistant.suggestions : [];

      elements.assistantSuggestions.innerHTML = "";
      suggestions.forEach((suggestion) => {
        const button = document.createElement("button");
        button.className = "secondary assistant-suggestion";
        button.type = "button";
        button.textContent = suggestion.label;
        button.addEventListener("click", () => {
          setAssistantDrawerOpen(true);
          elements.assistantInput.value = suggestion.prompt;
          elements.assistantInput.focus();
        });
        elements.assistantSuggestions.appendChild(button);
      });

      elements.assistantLog.innerHTML = "";
      const messages = session && Array.isArray(session.messages) ? session.messages.slice(-8) : [];

      if (!messages.length) {
        elements.assistantLog.innerHTML = "<p class=\"assistant-empty\">No messages.</p>";
        renderSelection();
        return;
      }

      messages.forEach((message) => {
        const item = document.createElement("div");
        item.className = "assistant-message";
        item.dataset.role = message.role;
        const roleLabel = message.role === "assistant" ? "Studio" : "You";
        item.innerHTML = `
          <span class="assistant-message-meta">${escapeHtml(roleLabel)}</span>
          <p class="assistant-message-body">${escapeHtml(message.content)}</p>
          ${message.selection ? `
            <p class="assistant-message-selection">
              <strong>${escapeHtml(message.selection.scopeLabel || message.selection.label || (message.selection.kind === "selectionGroup" ? "Selected fields" : "Selection"))}</strong>
              ${escapeHtml(message.selection.text || message.selection.selectedText || "")}
            </p>
          ` : ""}
        `;
        elements.assistantLog.appendChild(item);
      });

      elements.assistantLog.scrollTop = elements.assistantLog.scrollHeight;
      renderSelection();
    }

    function renderSelection() {
      const selection = state.assistant.selection;
      if (!elements.assistantSelection) {
        return;
      }

      if (!selection || selection.slideId !== state.selectedSlideId) {
        elements.assistantSelection.hidden = true;
        elements.assistantSelection.innerHTML = "";
        return;
      }

      elements.assistantSelection.hidden = false;
      const selectionText = selection.kind === "selectionGroup"
        ? `${selection.selections.length} fields selected`
        : selection.text || selection.selectedText || "";
      elements.assistantSelection.innerHTML = `
        <div>
          <span>Using selection</span>
          <strong>${escapeHtml(selection.scopeLabel || selection.label || "Slide text")}</strong>
          <p>${escapeHtml(selectionText)}</p>
        </div>
        <button type="button" class="secondary" data-action="clear-selection">Clear</button>
      `;
      elements.assistantSelection.querySelector("[data-action=\"clear-selection\"]").addEventListener("click", clearAssistantSelection);
    }

    async function sendMessage() {
      const message = elements.assistantInput.value.trim();
      if (!message) {
        return;
      }

      const selection = state.assistant.selection && state.assistant.selection.slideId === state.selectedSlideId
        ? state.assistant.selection
        : null;
      const done = setBusy(elements.assistantSendButton, "Sending...");
      try {
        setAssistantDrawerOpen(true);
        const payload = await postJson("/api/assistant/message", {
          candidateCount: getRequestedCandidateCount(),
          message,
          selection,
          sessionId: state.assistant.session && state.assistant.session.id ? state.assistant.session.id : "default",
          slideId: state.selectedSlideId
        });
        state.assistant = {
          session: payload.session,
          suggestions: payload.suggestions || state.assistant.suggestions
        };
        state.context = payload.context || state.context;
        state.previews = payload.previews;
        state.runtime = payload.runtime;
        if (payload.validation) {
          state.validation = payload.validation;
          setChecksPanelOpen(true);
        }
        if (payload.action && payload.action.type === "ideate-deck-structure") {
          setDeckStructureCandidates(payload.deckStructureCandidates);
        }
        clearTransientVariants(state.selectedSlideId);
        state.transientVariants = [
          ...(payload.transientVariants || []),
          ...state.transientVariants
        ];
        state.variants = payload.variants || state.variants;
        if ((payload.transientVariants || []).length || (payload.variants || []).length) {
          state.selectedVariantId = null;
          state.ui.variantReviewOpen = true;
        }
        if ((payload.transientVariants || []).length || (payload.variants || []).length) {
          openVariantGenerationControls();
        }
        elements.assistantInput.value = "";
        clearAssistantSelection();
        elements.operationStatus.textContent = payload.reply && payload.reply.content
          ? payload.reply.content
          : "Assistant action completed.";
        renderDeckFields();
        renderDeckStructureCandidates();
        render();
        renderStatus();
        renderPreviews();
        renderVariants();
        renderValidation();
      } finally {
        done();
      }
    }

    function mount() {
      elements.assistantSendButton.addEventListener("click", () => sendMessage().catch((error) => windowRef.alert(error.message)));
    }

    return {
      mount,
      render,
      renderSelection,
      sendMessage
    };
  }
}
