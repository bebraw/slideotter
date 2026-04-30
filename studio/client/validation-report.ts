import type { StudioClientElements } from "./elements.ts";

export namespace StudioClientValidationReport {
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
    elements: StudioClientElements.Elements;
    escapeHtml: (value: unknown) => string;
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

  export function renderValidationReport({ elements, escapeHtml, state }: ValidationReportDependencies): void {
    if (!state.validation) {
      elements.validationSummary.innerHTML = "";
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

    elements.validationSummary.innerHTML = summaryBlocks.map((block) => `
      <div class="validation-summary-card" data-status="${escapeHtml(block.status)}">
        <strong>${escapeHtml(block.label)}</strong>
        <span>${escapeHtml(block.status)}</span>
        <span>${block.count} issue${block.count === 1 ? "" : "s"}</span>
      </div>
    `).join("");
    elements.reportBox.textContent = issueLines.length
      ? issueLines.join("\n")
      : skippedChecks.length
        ? `No issues found. Skipped ${skippedChecks.join(", ")}.`
        : "No issues found.";
  }
}
