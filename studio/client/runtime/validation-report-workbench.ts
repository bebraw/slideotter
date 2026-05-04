import type { StudioClientElements } from "../core/elements.ts";
import type { StudioClientState } from "../core/state.ts";
import { StudioClientCheckRemediationState } from "./check-remediation-state.ts";
import { StudioClientValidationReport } from "./validation-report.ts";

export namespace StudioClientValidationReportWorkbench {
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

  type RemediationPayload = StudioClientCheckRemediationState.RemediationPayload & {
    slideId?: string;
  };

  type Dependencies = {
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    loadSlide: (slideId: string) => Promise<void>;
    openVariantGenerationControls: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    request: <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;
    state: StudioClientState.State;
  };

  export type Workbench = {
    render: () => void;
  };

  export function createValidationReportWorkbench({
    createDomElement,
    elements,
    loadSlide,
    openVariantGenerationControls,
    renderPreviews,
    renderStatus,
    renderVariants,
    request,
    state
  }: Dependencies): Workbench {
    function getSlideIdForValidationIssue(issue: StudioClientValidationReport.ValidationIssue): string {
      return StudioClientCheckRemediationState.getSlideIdForIssue(state, issue);
    }

    function applyRemediationPayload(payload: RemediationPayload, slideId: string): void {
      elements.operationStatus.textContent = StudioClientCheckRemediationState.applyPayload(state, payload, slideId);
      openVariantGenerationControls();
      renderStatus();
      renderPreviews();
      renderVariants();
    }

    async function suggestValidationRemediation(
      issue: StudioClientValidationReport.ValidationIssue,
      blockName: string,
      issueIndex: number,
      button: HTMLButtonElement
    ): Promise<void> {
      const slideId = getSlideIdForValidationIssue(issue);
      if (!slideId) {
        elements.operationStatus.textContent = "Select a slide before suggesting remediation.";
        return;
      }

      const originalText = button.textContent || "Suggest fixes";
      button.disabled = true;
      button.textContent = "Suggesting...";
      try {
        const payload = await request<RemediationPayload>("/api/v1/checks/remediate", {
          body: JSON.stringify({
            blockName,
            issue,
            issueIndex,
            slideId
          }),
          method: "POST"
        });
        if (state.selectedSlideId !== slideId) {
          await loadSlide(slideId);
        }
        applyRemediationPayload(payload, slideId);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    return {
      render: () => {
        StudioClientValidationReport.renderValidationReport({
          createDomElement,
          elements,
          onSuggestRemediation: suggestValidationRemediation,
          state
        });
      }
    };
  }
}
