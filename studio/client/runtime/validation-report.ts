import type { StudioClientElements } from "../core/elements.ts";

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

  export type ValidationIssue = {
    level?: string;
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
    onSuggestRemediation?: (issue: ValidationIssue, blockName: string, issueIndex: number, button: HTMLButtonElement) => void;
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

  const supportedRemediationRules = new Set([
    "bounds",
    "caption-source-spacing",
    "media-legibility",
    "text-fit"
  ]);

  function isRemediableIssue(issue: ValidationIssue): boolean {
    return supportedRemediationRules.has(String(issue.rule || ""));
  }

  export function renderValidationReport({ createDomElement, elements, onSuggestRemediation, state }: ValidationReportDependencies): void {
    if (!state.validation) {
      elements.validationSummary.replaceChildren();
      elements.reportBox.textContent = "No checks run yet.";
      return;
    }

    const issueRows: HTMLElement[] = [];
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

      issues.forEach((issue: ValidationIssue, issueIndex: number) => {
        const slideLabel = issue.slide ? `slide ${issue.slide}` : label;
        const ruleLabel = issue.rule || "check";
        const action = isRemediableIssue(issue)
          ? createDomElement("button", {
            attributes: { type: "button" },
            className: "secondary validation-remediation-button",
            dataset: {
              validationBlock: label,
              validationIssueIndex: issueIndex
            },
            text: "Suggest fixes"
          })
          : createDomElement("span", { className: "validation-issue-note", text: "Review manually" });
        if (action instanceof HTMLButtonElement && onSuggestRemediation) {
          action.addEventListener("click", () => {
            onSuggestRemediation(issue, label, issueIndex, action);
          });
        }
        issueRows.push(createDomElement("article", {
          className: "validation-issue-row",
          dataset: {
            remediable: isRemediableIssue(issue) ? "true" : "false",
            rule: ruleLabel
          }
        }, [
          createDomElement("div", { className: "validation-issue-copy" }, [
            createDomElement("strong", { text: `${slideLabel}: ${ruleLabel}` }),
            createDomElement("span", { text: issue.message || "Check issue" })
          ]),
          action
        ]));
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
    elements.reportBox.replaceChildren(...(issueRows.length
      ? issueRows
      : [createDomElement("p", {
        className: "section-note",
        text: skippedChecks.length
          ? `No issues found. Skipped ${skippedChecks.join(", ")}.`
          : "No issues found."
      })]));
  }
}
