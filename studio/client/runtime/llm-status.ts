import type { StudioClientState } from "../state.ts";

export namespace StudioClientLlmStatus {
  type LlmStatus = {
    available?: boolean;
    baseUrl?: string;
    configuredReason?: string;
    lastCheck?: {
      ok?: boolean;
      summary?: string;
      testedAt?: string;
    };
    model?: string;
    provider?: string;
  };

  type LlmConnectionView = {
    detail: string;
    label: string;
    providerLine: string;
    state: string;
  };

  export function createLlmStatus({
    renderStatus,
    state
  }: {
    renderStatus: () => void;
    state: StudioClientState.State;
  }) {
    function asLlmStatus(value: unknown): LlmStatus | null {
      return value && typeof value === "object" && !Array.isArray(value) ? value as LlmStatus : null;
    }

    function getConnectionView(value: unknown): LlmConnectionView {
      if (state.ui.llmChecking) {
        return {
          detail: "Checking LLM provider configuration and structured output support.",
          label: "LLM checking",
          providerLine: "LLM provider",
          state: "idle"
        };
      }

      const llm = asLlmStatus(value);
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

    function setPopoverOpen(open: boolean): void {
      state.ui.llmPopoverOpen = Boolean(open);
      renderStatus();
    }

    function togglePopover(): void {
      setPopoverOpen(!state.ui.llmPopoverOpen);
    }

    return {
      getConnectionView,
      setPopoverOpen,
      togglePopover
    };
  }
}
