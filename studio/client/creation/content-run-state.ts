import { planSlides, runSlides } from "./content-run-collections.ts";
import { getContentRunSlideStatusLabel } from "./content-run-status.ts";
import type {
  ContentRun,
  ContentRunActionState,
  ContentRunDeckPlan,
  ContentRunDeckPlanSlide,
  ContentRunPreviewState,
  ContentRunSlide
} from "./content-run-types.ts";

function numericRunSlideCount(run: ContentRun | null | undefined, planSlideCount: number): number {
  return run && Number.isFinite(Number(run.slideCount))
    ? Number(run.slideCount)
    : planSlideCount;
}

function completedRunSlideCount(run: ContentRun, runSlideList: ContentRunSlide[]): number {
  return Number.isFinite(Number(run.completed))
    ? Number(run.completed)
    : runSlideList.filter((slide: ContentRunSlide) => slide.status === "complete").length;
}

export function getContentRunActionState(deckPlan: ContentRunDeckPlan | null | undefined, run: ContentRun | null | undefined): ContentRunActionState | null {
  const planSlideList = planSlides(deckPlan);
  const runSlideList = runSlides(run);
  if (!run || !planSlideList.length) {
    return null;
  }

  return {
    completedCount: completedRunSlideCount(run, runSlideList),
    failedIndex: runSlideList.findIndex((slide: ContentRunSlide) => slide.status === "failed"),
    incompleteCount: runSlideList.filter((slide: ContentRunSlide) => slide.status !== "complete").length,
    run,
    runSlides: runSlideList,
    slideCount: numericRunSlideCount(run, planSlideList.length)
  };
}

export function shouldShowContentRunNavStatus(deckPlan: ContentRunDeckPlan | null | undefined, run: ContentRun | null | undefined): boolean {
  const slideCount = numericRunSlideCount(run, planSlides(deckPlan).length);
  return Boolean(run
    && slideCount
    && ["running", "failed", "stopped"].includes(run.status || ""));
}

function selectedContentRunSlideIndex(selectedSlideIndex: unknown, slideCount: number): number {
  return Number.isFinite(Number(selectedSlideIndex))
    ? Math.max(1, Math.min(slideCount, Number(selectedSlideIndex)))
    : 1;
}

function contentRunPreviewStatus(runSlide: ContentRunSlide | null): string {
  return runSlide && runSlide.status ? runSlide.status : "pending";
}

export function getContentRunPreviewState(
  deckPlan: ContentRunDeckPlan | null | undefined,
  run: ContentRun | null | undefined,
  selectedSlideIndex: unknown
): ContentRunPreviewState | null {
  const actionState = getContentRunActionState(deckPlan, run);
  if (!actionState) {
    return null;
  }

  const selected = selectedContentRunSlideIndex(selectedSlideIndex, actionState.slideCount);
  const planSlide = (planSlides(deckPlan)[selected - 1] || {}) as ContentRunDeckPlanSlide;
  const runSlide = actionState.runSlides[selected - 1] || null;
  const status = contentRunPreviewStatus(runSlide);

  return {
    ...actionState,
    planSlide,
    runSlide,
    selected,
    status,
    statusLabel: getContentRunSlideStatusLabel(status)
  };
}
