export namespace StudioClientValidationReport {
  export function renderValidationReport({ elements, escapeHtml, state }) {
    if (!state.validation) {
      elements.validationSummary.innerHTML = "";
      elements.reportBox.textContent = "No checks run yet.";
      return;
    }

    const issueLines = [];
    const skippedChecks = [];
    const summaryBlocks = [];
    [["geometry", state.validation.geometry], ["text", state.validation.text], ["render", state.validation.render]].forEach(([label, block]) => {
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

      issues.forEach((issue) => {
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
