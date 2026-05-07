function rawErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "");
}

export function contentRunVisibleErrorMessage(error: unknown): string {
  const message = rawErrorMessage(error);
  if (
    /generated presentation plan/i.test(message)
    || /invalid json|not valid json|retry also failed|retry failed|expected .*json|schema|guardrails|keypoints|resources/i.test(message)
  ) {
    return "Slide generation failed during validation. Retry this slide or inspect the saved error log.";
  }

  return message || "Slide generation failed. Retry this slide or inspect the saved error log.";
}
