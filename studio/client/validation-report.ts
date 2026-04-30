import type { StudioClientElements } from "./elements.ts";

export namespace StudioClientValidationReport {
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

  type ValidationIssue = {
    message?: string;
    rule?: string;
    slide?: string | number;
  };

  type ValidationBlock = {
    errors?: ValidationIssue[];
    issues?: ValidationIssue[];
    ok?: boolean;
    skipped?: boolean;
  };

  type ValidationReport = {
    geometry?: ValidationBlock;
    render?: ValidationBlock;
    text?: ValidationBlock;
  };

  type ValidationReportDependencies = {
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    state: {
      validation: ValidationReport | null;
    };
  };

  type ValidationSummaryBlock = {
    count: number;
    label: string;
    status: string;
  };

  type NamedValidationBlock = [string, ValidationBlock | undefined];

  export function renderValidationReport({ createDomElement, elements, state }: ValidationReportDependencies): void {
    if (!state.validation) {
      elements.validationSummary.replaceChildren();
      elements.reportBox.textContent = "No checks run yet.";
      return;
    }

    const issueLines: string[] = [];
    const skippedChecks: string[] = [];
    const summaryBlocks: ValidationSummaryBlock[] = [];
    const blocks: NamedValidationBlock[] = [
      ["geometry", state.validation.geometry],
      ["text", state.validation.text],
      ["render", state.validation.render]
    ];
    blocks.forEach(([label, block]) => {
      if (!block) {
        return;
      }

      const issues = block.issues && block.issues.length ? block.issues : (block.errors || []);
      const status = block.skipped ? "skipped" : (block.ok ? "passed" : "failed");
      summaryBlocks.push({
        count: issues.length,
        label,
        status
      });

      if (block.skipped) {
        skippedChecks.push(label);
        return;
      }

      if (!issues.length) {
        return;
      }

      issues.forEach((issue: ValidationIssue) => {
        const slideLabel = issue.slide ? `slide ${issue.slide}` : label;
        const ruleLabel = issue.rule ? `${issue.rule}: ` : "";
        issueLines.push(`${slideLabel}: ${ruleLabel}${issue.message || "Check issue"}`);
      });
    });

    elements.validationSummary.replaceChildren(...summaryBlocks.map((block) => createDomElement("div", {
      className: "validation-summary-card",
      dataset: { status: block.status }
    }, [
      createDomElement("strong", { text: block.label }),
      createDomElement("span", { text: block.status }),
      createDomElement("span", { text: `${block.count} issue${block.count === 1 ? "" : "s"}` })
    ])));
    elements.reportBox.textContent = issueLines.length
      ? issueLines.join("\n")
      : skippedChecks.length
        ? `No issues found. Skipped ${skippedChecks.join(", ")}.`
        : "No issues found.";
  }
}
