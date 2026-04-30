namespace StudioClientLlmStatus {
  export function createLlmStatus({ renderStatus, state }) {
    function getConnectionView(llm) {
      if (state.ui.llmChecking) {
        return {
          detail: "Checking LLM provider configuration and structured output support.",
          label: "LLM checking",
          providerLine: "LLM provider",
          state: "idle"
        };
      }

      if (!llm) {
        return {
          detail: "LLM provider state has not loaded yet.",
          label: "LLM status",
          providerLine: "LLM provider",
          state: "idle"
        };
      }

      const llmCheck = llm.lastCheck;
      const providerLine = llm.model
        ? `${llm.provider} using ${llm.model}`
        : `${llm.provider} provider`;
      const baseUrl = llm.baseUrl ? ` at ${llm.baseUrl}` : "";

      if (llmCheck && llmCheck.testedAt) {
        return {
          detail: `${providerLine}${baseUrl}. ${llmCheck.summary}`,
          label: llmCheck.ok ? "LLM ready" : "LLM issue",
          providerLine,
          state: llmCheck.ok ? "ok" : "warn"
        };
      }

      if (llm.available) {
        return {
          detail: `${providerLine}${baseUrl} is configured. Run a provider check to verify live connectivity.`,
          label: "LLM unverified",
          providerLine,
          state: "idle"
        };
      }

      return {
        detail: `${providerLine}${baseUrl} is not ready. ${llm.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating variants."}`,
        label: "LLM off",
        providerLine,
        state: "warn"
      };
    }

    function setPopoverOpen(open) {
      state.ui.llmPopoverOpen = Boolean(open);
      renderStatus();
    }

    function togglePopover() {
      setPopoverOpen(!state.ui.llmPopoverOpen);
    }

    return {
      getConnectionView,
      setPopoverOpen,
      togglePopover
    };
  }
}
(globalThis as any).StudioClientLlmStatus = StudioClientLlmStatus;
