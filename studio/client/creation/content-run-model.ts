export type ContentRunSlide = Record<string, unknown> & {
  error?: string;
  errorLogPath?: string;
  slideSpec?: Record<string, unknown>;
  status?: string;
};

export type ContentRun = Record<string, unknown> & {
  completed?: number;
  failedSlideIndex?: number;
  slideCount?: number;
  slides?: ContentRunSlide[];
  status?: string;
};

export type ContentRunDeckPlanSlide = Record<string, unknown> & {
  intent?: unknown;
  keyMessage?: unknown;
  sourceNeed?: unknown;
  title?: unknown;
  visualNeed?: unknown;
};

export type ContentRunDeckPlan = Record<string, unknown> & {
  slides?: ContentRunDeckPlanSlide[];
};

export type ContentRunActionState = {
  completedCount: number;
  failedIndex: number;
  incompleteCount: number;
  run: ContentRun;
  runSlides: ContentRunSlide[];
  slideCount: number;
};

export type ContentRunPreviewState = ContentRunActionState & {
  planSlide: ContentRunDeckPlanSlide;
  runSlide: ContentRunSlide | null;
  selected: number;
  status: string;
  statusLabel: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function runSlides(run: ContentRun | null | undefined): ContentRunSlide[] {
  return run && Array.isArray(run.slides) ? run.slides.filter(isRecord) : [];
}

export function planSlides(deckPlan: ContentRunDeckPlan | null | undefined): ContentRunDeckPlanSlide[] {
  return deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isRecord) : [];
}

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

function getContentRunFailureDetail(slides: ContentRunSlide[]): string {
  const failedIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "failed");
  if (failedIndex < 0) {
    return "";
  }

  const failedSlide = slides[failedIndex] || {};
  const error = truncateStatusText(failedSlide.error || "Slide generation failed.");
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

export function getContentRunActionState(deckPlan: ContentRunDeckPlan | null | undefined, run: ContentRun | null | undefined): ContentRunActionState | null {
  const planSlideList = planSlides(deckPlan);
  const runSlideList = runSlides(run);
  if (!run || !planSlideList.length) {
    return null;
  }

  const slideCount = Number.isFinite(Number(run.slideCount)) ? Number(run.slideCount) : planSlideList.length;
  const failedIndex = runSlideList.findIndex((slide: ContentRunSlide) => slide.status === "failed");
  const completedCount = Number.isFinite(Number(run.completed))
    ? Number(run.completed)
    : runSlideList.filter((slide: ContentRunSlide) => slide.status === "complete").length;
  const incompleteCount = runSlideList.filter((slide: ContentRunSlide) => slide.status !== "complete").length;

  return {
    completedCount,
    failedIndex,
    incompleteCount,
    run,
    runSlides: runSlideList,
    slideCount
  };
}

export function shouldShowContentRunNavStatus(deckPlan: ContentRunDeckPlan | null | undefined, run: ContentRun | null | undefined): boolean {
  const planSlideList = planSlides(deckPlan);
  const slideCount = run && Number.isFinite(Number(run.slideCount))
    ? Number(run.slideCount)
    : planSlideList.length;
  return Boolean(run
    && slideCount
    && ["running", "failed", "stopped"].includes(run.status || ""));
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

  const planSlideList = planSlides(deckPlan);
  const selected = Number.isFinite(Number(selectedSlideIndex))
    ? Math.max(1, Math.min(actionState.slideCount, Number(selectedSlideIndex)))
    : 1;
  const planSlide = planSlideList[selected - 1] || {};
  const runSlide = actionState.runSlides[selected - 1] || null;
  const status = runSlide && runSlide.status ? runSlide.status : "pending";

  return {
    ...actionState,
    planSlide,
    runSlide,
    selected,
    status,
    statusLabel: getContentRunSlideStatusLabel(status)
  };
}
