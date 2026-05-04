import {
  runSlides,
  truncateStatusText,
  type ContentRun
} from "./content-run-model.ts";

export type CreationDraftStatusContext = {
  approved: boolean;
  contentRun?: ContentRun | null;
  hasOutline: boolean;
  outlineDirty: boolean;
  unlockedOutlineCount: number;
  workflowRunning: boolean;
};

export function formatCreationDraftStatus(context: CreationDraftStatusContext): string {
  const {
    approved,
    contentRun,
    hasOutline,
    outlineDirty,
    unlockedOutlineCount,
    workflowRunning
  } = context;

  if (workflowRunning) {
    return "Generation is running from a locked snapshot. Wait for it to finish before changing the draft.";
  }

  if (contentRun && contentRun.status === "failed") {
    const failedSlideNumber = Number.isFinite(Number(contentRun.failedSlideIndex))
      ? Number(contentRun.failedSlideIndex) + 1
      : null;
    const failedSlide = failedSlideNumber
      ? runSlides(contentRun)[failedSlideNumber - 1]
      : null;
    const failedError = failedSlide && failedSlide.error
      ? truncateStatusText(failedSlide.error, 180)
      : "Slide generation failed.";

    return `Slide generation failed${failedSlideNumber ? ` on slide ${failedSlideNumber}` : ""}. ${failedError} Retry from the failed slide in Studio or inspect the saved error log.`;
  }

  if (contentRun && contentRun.status === "stopped") {
    return "Slide generation stopped. Completed slides remain available in Slide Studio.";
  }

  if (outlineDirty) {
    return "Brief changed. Regenerate the outline before approving it.";
  }

  if (hasOutline && unlockedOutlineCount === 0) {
    return "All outline slides are kept. Unlock a slide before regenerating the outline.";
  }

  if (approved) {
    return "Outline approved. Slide Studio will show generated slides as they validate.";
  }

  if (hasOutline) {
    return "Review the outline, then approve it to create slides.";
  }

  return "Draft is saved locally as ignored runtime state.";
}
