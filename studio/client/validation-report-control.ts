import type { StudioClientElements } from "./elements.ts";
import type { StudioClientState } from "./state.ts";

export namespace StudioClientValidationReportControl {
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

  export type ValidationIssue = {
    level?: string;
    message?: string;
    rule?: string;
    slide?: string | number;
  };

  export type ValidationReportRenderer = {
    renderValidationReport: (dependencies: {
      createDomElement: CreateDomElement;
      elements: StudioClientElements.Elements;
      onSuggestRemediation: (issue: ValidationIssue, blockName: string, issueIndex: number, button: HTMLButtonElement) => void;
      state: Pick<StudioClientState.State, "validation">;
    }) => void;
  };

  export type LazyValidationReportRenderer = {
    get: () => ValidationReportRenderer | null;
    load: () => Promise<ValidationReportRenderer>;
  };

  export function renderValidationReport(deps: {
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    lazyRenderer: LazyValidationReportRenderer;
    onSuggestRemediation: (issue: ValidationIssue, blockName: string, issueIndex: number, button: HTMLButtonElement) => void;
    state: Pick<StudioClientState.State, "validation">;
  }): void {
    const {
      createDomElement,
      elements,
      lazyRenderer,
      onSuggestRemediation,
      state
    } = deps;

    if (!state.validation && !lazyRenderer.get()) {
      elements.validationSummary.replaceChildren();
      elements.reportBox.textContent = "No checks run yet.";
      return;
    }

    lazyRenderer.load().then((renderer) => renderer.renderValidationReport({
      createDomElement,
      elements,
      onSuggestRemediation,
      state
    })).catch((error: unknown) => {
      elements.reportBox.textContent = error instanceof Error ? error.message : String(error);
    });
  }
}
