import { runSlides } from "./content-run-collections.ts";
import type { ContentRun, ContentRunSlide } from "./content-run-types.ts";

export function getAutoContentRunSlideIndex(run: ContentRun | null | undefined): number {
  const slides = runSlides(run);
  const generatingIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "generating");
  if (generatingIndex >= 0) {
    return generatingIndex + 1;
  }

  for (let index = slides.length - 1; index >= 0; index -= 1) {
    if (slides[index] && slides[index]?.status === "complete") {
      return index + 1;
    }
  }

  const failedIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "failed");
  return failedIndex >= 0 ? failedIndex + 1 : 1;
}

export function getContentRunStatusLabel(status: string | undefined): string {
  switch (status) {
    case "running":
      return "Generating";
    case "failed":
      return "Failed";
    case "stopped":
      return "Stopped";
    case "completed":
      return "Complete";
    default:
      return "Ready";
  }
}

export function getContentRunSlideStatusLabel(status: string | undefined): string {
  switch (status) {
    case "generating":
      return "Generating";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

export function truncateStatusText(value: unknown, maxLength = 140): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function visibleContentRunError(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (
    /generated presentation plan/i.test(text)
    || /invalid json|not valid json|retry also failed|retry failed|expected .*json|schema|guardrails|keypoints|resources/i.test(text)
  ) {
    return "Slide generation failed during validation. Retry this slide or inspect the saved error log.";
  }

  return text || "Slide generation failed. Retry this slide or inspect the saved error log.";
}

function getContentRunFailureDetail(slides: ContentRunSlide[]): string {
  const failedIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "failed");
  if (failedIndex < 0) {
    return "";
  }

  const failedSlide = slides[failedIndex] || {};
  const error = truncateStatusText(visibleContentRunError(failedSlide.error));
  return ` Slide ${failedIndex + 1} failed: ${error}`;
}

export function formatContentRunSummary(run: ContentRun | null, slideCount: number, slides: ContentRunSlide[]): string {
  const completedCount = run && Number.isFinite(Number(run.completed))
    ? Number(run.completed)
    : slides.filter((slide: ContentRunSlide) => slide.status === "complete").length;
  const runStatus = run && run.status ? run.status : "ready";
  const failedCount = slides.filter((slide: ContentRunSlide) => slide.status === "failed").length;
  const generatingIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "generating");
  const activePart = generatingIndex >= 0 ? ` Slide ${generatingIndex + 1} is generating.` : "";
  const failurePart = failedCount ? ` ${failedCount} failed.${getContentRunFailureDetail(slides)}` : "";

  return `${completedCount}/${slideCount} slides complete. ${getContentRunStatusLabel(runStatus)}.${activePart}${failurePart}`;
}
