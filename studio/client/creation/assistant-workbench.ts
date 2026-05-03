import type { StudioClientElements } from "../core/elements.ts";

export namespace StudioClientAssistantWorkbench {
  type AssistantSuggestion = {
    label: string;
    prompt: string;
  };

  type AssistantMessage = {
    content: string;
    role: string;
    selection?: AssistantSelection;
  };

  type AssistantSelection = {
    kind?: string;
    label?: string;
    scopeLabel?: string;
    selectedText?: string;
    selections?: unknown[];
    slideId?: string | null;
    text?: string;
  };

  type AssistantSession = {
    id?: string;
    messages?: AssistantMessage[];
  };

  type AssistantState = {
    selection?: AssistantSelection | null;
    session?: AssistantSession | null;
    suggestions?: AssistantSuggestion[];
  };

  type AssistantAction = {
    type?: string;
  };

  type AssistantReply = {
    content?: string;
  };

  type AssistantPayload = {
    action?: AssistantAction;
    context?: unknown;
    deckStructureCandidates?: unknown[];
    previews?: unknown;
    reply?: AssistantReply;
    runtime?: unknown;
    session?: AssistantSession;
    suggestions?: AssistantSuggestion[];
    transientVariants?: unknown[];
    validation?: unknown;
    variants?: unknown[];
  };

  type StudioState = {
    assistant: AssistantState;
    context?: unknown;
    previews?: unknown;
    runtime?: unknown;
    selectedSlideId: string | null;
    selectedVariantId: string | null;
    transientVariants: unknown[];
    ui: {
      variantReviewOpen: boolean;
    };
    validation?: unknown;
    variants?: unknown[];
  };

  export type AssistantWorkbenchDependencies = {
    clearAssistantSelection: () => void;
    clearTransientVariants: (slideId: string) => void;
    createDomElement: (tagName: string, options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      dataset?: Record<string, string | number | boolean>;
      text?: unknown;
    }, children?: Array<Node | string | number | boolean>) => HTMLElement;
    elements: StudioClientElements.Elements;
    getRequestedCandidateCount: () => Promise<number>;
    openVariantGenerationControls: () => void;
    postJson: (url: string, body: unknown, options?: RequestInit) => Promise<AssistantPayload>;
    renderDeckFields: () => void;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderValidation: () => void;
    renderVariants: () => void;
    setAssistantDrawerOpen: (open: boolean) => void;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
    setChecksPanelOpen: (open: boolean) => void;
    setDeckStructureCandidates: (candidates: unknown[]) => void;
    state: StudioState;
    windowRef: Window;
  };

  export function createAssistantWorkbench(dependencies: AssistantWorkbenchDependencies) {
    const {
      clearAssistantSelection,
      clearTransientVariants,
      createDomElement,
      elements,
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

    function createSecondaryButton(label: string): HTMLButtonElement {
      return createDomElement("button", {
        attributes: {
          type: "button"
        },
        className: "secondary",
        text: label
      }) as HTMLButtonElement;
    }

    function render() {
      const session = state.assistant.session;
      const suggestions = Array.isArray(state.assistant.suggestions) ? state.assistant.suggestions : [];

      elements.assistantSuggestions.replaceChildren();
      suggestions.forEach((suggestion: AssistantSuggestion) => {
        const button = createSecondaryButton(suggestion.label);
        button.classList.add("assistant-suggestion");
        button.addEventListener("click", () => {
          setAssistantDrawerOpen(true);
          elements.assistantInput.value = suggestion.prompt;
          elements.assistantInput.focus();
        });
        elements.assistantSuggestions.appendChild(button);
      });

      elements.assistantLog.replaceChildren();
      const messages = session && Array.isArray(session.messages) ? session.messages.slice(-8) : [];

      if (!messages.length) {
        elements.assistantLog.replaceChildren(createDomElement("p", {
          className: "assistant-empty",
          text: "No messages."
        }));
        renderSelection();
        return;
      }

      messages.forEach((message: AssistantMessage) => {
        const roleLabel = message.role === "assistant" ? "Studio" : "You";
        const children: Node[] = [
          createDomElement("span", {
            className: "assistant-message-meta",
            text: roleLabel
          }),
          createDomElement("p", {
            className: "assistant-message-body",
            text: message.content
          })
        ];
        if (message.selection) {
          children.push(createDomElement("p", {
            className: "assistant-message-selection"
          }, [
            createDomElement("strong", {
              text: message.selection.scopeLabel || message.selection.label || (message.selection.kind === "selectionGroup" ? "Selected fields" : "Selection")
            }),
            ` ${message.selection.text || message.selection.selectedText || ""}`
          ]));
        }
        const item = createDomElement("div", {
          className: "assistant-message",
          dataset: {
            role: message.role
          }
        }, children);
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
        elements.assistantSelection.replaceChildren();
        return;
      }

      elements.assistantSelection.hidden = false;
      const selectionText = selection.kind === "selectionGroup"
        ? `${Array.isArray(selection.selections) ? selection.selections.length : 0} fields selected`
        : selection.text || selection.selectedText || "";
      const clearButton = createSecondaryButton("Clear");
      clearButton.dataset.action = "clear-selection";
      clearButton.addEventListener("click", clearAssistantSelection);
      elements.assistantSelection.replaceChildren(
        createDomElement("div", {}, [
          createDomElement("span", { text: "Using selection" }),
          createDomElement("strong", { text: selection.scopeLabel || selection.label || "Slide text" }),
          createDomElement("p", { text: selectionText })
        ]),
        clearButton
      );
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
          candidateCount: await getRequestedCandidateCount(),
          message,
          selection,
          sessionId: state.assistant.session && state.assistant.session.id ? state.assistant.session.id : "default",
          slideId: state.selectedSlideId
        });
        state.assistant = {};
        if (payload.session) {
          state.assistant.session = payload.session;
        }
        const suggestions = payload.suggestions || state.assistant.suggestions;
        if (suggestions) {
          state.assistant.suggestions = suggestions;
        }
        state.context = payload.context || state.context;
        state.previews = payload.previews;
        state.runtime = payload.runtime;
        if (payload.validation) {
          state.validation = payload.validation;
          setChecksPanelOpen(true);
        }
        if (payload.action && payload.action.type === "ideate-deck-structure") {
          setDeckStructureCandidates(payload.deckStructureCandidates || []);
        }
        if (state.selectedSlideId) {
          clearTransientVariants(state.selectedSlideId);
        }
        state.transientVariants = [
          ...(payload.transientVariants || []),
          ...state.transientVariants
        ];
        if (payload.variants) {
          state.variants = payload.variants;
        }
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
      elements.assistantSendButton.addEventListener("click", () => sendMessage().catch((error: unknown) => windowRef.alert(error instanceof Error ? error.message : String(error))));
    }

    return {
      mount,
      render,
      renderSelection,
      sendMessage
    };
  }
}
