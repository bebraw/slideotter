import { getPresentationCreationDraft } from "./services/presentation-creation-draft.ts";
import type {
  ContentRunPatch,
  ContentRunSlide,
  ContentRunState,
  GenerationProgressPayload,
  JsonObject
} from "./creation-content-run-types.ts";

type ContentRunStateWriter = (next: ContentRunPatch) => unknown;

type ContentRunProgressHandlersOptions = {
  contentRunState: ContentRunStateWriter;
  isContentRunSlide: (value: unknown) => value is ContentRunSlide;
  isContentRunState: (value: unknown) => value is ContentRunState;
  reportProgress: (progress: GenerationProgressPayload) => void;
  requireProgressSlideCount?: boolean;
  runId: string;
  slideCount: number;
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function createContentRunProgressHandlers(options: ContentRunProgressHandlersOptions) {
  const setSlideState = (index: number, next: ContentRunSlide): unknown => {
    const latest = asJsonObject(getPresentationCreationDraft());
    const latestRun = options.isContentRunState(latest.contentRun) ? latest.contentRun : null;
    if (!latestRun || latestRun.id !== options.runId || !Array.isArray(latestRun.slides)) {
      return null;
    }

    const slides = latestRun.slides
      .filter(options.isContentRunSlide)
      .map((slide, idx) => idx === index ? { ...slide, ...next } : slide);
    const completed = slides.filter((slide) => slide.status === "complete").length;
    return options.contentRunState({
      completed,
      slides
    });
  };

  const reportProgressWithRun = (progress: GenerationProgressPayload): void => {
    const slideIndex = Number(progress.slideIndex);
    const hasSlideCount = Number.isFinite(Number(progress.slideCount));
    if (
      progress
      && progress.stage === "drafting-slide"
      && Number.isFinite(slideIndex)
      && (!options.requireProgressSlideCount || hasSlideCount)
      && slideIndex >= 1
      && slideIndex <= options.slideCount
    ) {
      setSlideState(slideIndex - 1, { status: "generating", error: null });
    }

    options.reportProgress({
      ...progress,
      stage: typeof progress.stage === "string" ? progress.stage : "running"
    });
  };

  return {
    reportProgressWithRun,
    setSlideState
  };
}

export { createContentRunProgressHandlers };
