export type CustomLayoutValidationIssue = {
  level?: string;
  message?: string;
  rule?: string;
  slide?: number | string;
};

export type CustomLayoutValidation = {
  errors?: CustomLayoutValidationIssue[];
  issues?: CustomLayoutValidationIssue[];
  ok?: boolean;
  state?: "blocked" | "draft-unchecked" | "looks-good" | "needs-attention";
};

export function customLayoutValidationLabel(validation: CustomLayoutValidation): string {
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

export function customLayoutValidationDetail(validation: CustomLayoutValidation): string {
  const issueCount = Array.isArray(validation.issues) ? validation.issues.length : 0;
  const errorCount = Array.isArray(validation.errors) ? validation.errors.length : 0;
  switch (validation.state) {
    case "looks-good":
      return "Current-slide DOM validation passed for this preview.";
    case "needs-attention":
      return `${issueCount} warning${issueCount === 1 ? "" : "s"} found. You can continue, but review spacing and media before saving.`;
    case "blocked":
      return `${errorCount || issueCount} blocking issue${(errorCount || issueCount) === 1 ? "" : "s"} found. Fix the layout before saving as a favorite.`;
    default:
      return "Validate the live draft to create a review candidate.";
  }
}
