export type CurrentSlideValidation = {
  errors?: Array<{ message?: string; rule?: string }>;
  issues?: Array<{ message?: string; rule?: string }>;
  ok?: boolean;
  state?: "blocked" | "draft-unchecked" | "looks-good" | "needs-attention";
};

export function validationLabel(validation: CurrentSlideValidation): string {
  switch (validation.state) {
    case "looks-good":
      return "Looks good";
    case "needs-attention":
      return "Needs attention";
    case "blocked":
      return "Blocked";
    default:
      return "Draft unchecked";
  }
}

export function validationDetail(validation: CurrentSlideValidation): string {
  const issueCount = Array.isArray(validation.issues) ? validation.issues.length : 0;
  const errorCount = Array.isArray(validation.errors) ? validation.errors.length : 0;
  switch (validation.state) {
    case "looks-good":
      return "Current-slide DOM validation passed for this media treatment.";
    case "needs-attention":
      return `${issueCount} warning${issueCount === 1 ? "" : "s"} found. Review media fit, caption spacing, or progress-area clearance.`;
    case "blocked":
      return `${errorCount || issueCount} blocking issue${(errorCount || issueCount) === 1 ? "" : "s"} found on the current slide.`;
    default:
      return "Adjust media or run checks to validate the current slide.";
  }
}
