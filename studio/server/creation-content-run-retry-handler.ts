import {
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
import { assertGeneratedSlideFitsDom } from "./content-run-slide-validation.ts";
import { contentRunVisibleErrorMessage } from "./content-run-visible-errors.ts";
import { writeGenerationErrorDiagnostic } from "./services/generation-diagnostics.ts";
import { createMaterialFromDataUrl, createMaterialFromRemoteImage } from "./services/materials.ts";
import {
  clearPresentationCreationDraft,
  createOutlinePlanFromDeckPlan,
  createPresentation,
  getPresentationCreationDraft,
  regeneratePresentationSlides,
  savePresentationCreationDraft,
  setActivePresentation
} from "./services/presentations.ts";
import { generatePresentationFromDeckPlanIncremental } from "./services/presentation-generation.ts";
import { validateSlideSpec } from "./services/slide-specs/index.ts";
import { sanitizeSourceRetrievalForRuntime } from "./services/sources.ts";
import type { ContentRunHelpers } from "./creation-content-run-helpers.ts";
import type {
  ContentRunPatch,
  ContentRunSlide,
  ContentRunState,
  CreationContentRunHandlerDependencies,
  DeckPlanPayload,
  DeckPlanSlide,
  GeneratedPartialSlidePayload,
  GenerationDraftFields,
  GenerationProgressPayload,
  JsonObject,
  MaterialPayload,
  ServerRequest,
  ServerResponse,
  SlideSpecPayload
} from "./creation-content-run-types.ts";

type CreationContentRunRetryHandlerDependencies = Pick<
  CreationContentRunHandlerDependencies,
  | "createJsonResponse"
  | "createWorkflowProgressReporter"
  | "errorCode"
  | "jsonObjectOrEmpty"
  | "normalizeCreationFields"
  | "publishCreationDraftUpdate"
  | "publishRuntimeState"
  | "readJsonBody"
  | "resetPresentationRuntime"
  | "runtimeState"
  | "serializeRuntimeState"
  | "updateWorkflowState"
> & {
  helpers: ContentRunHelpers;
  isJsonObject: (value: unknown) => value is JsonObject;
};

type GeneratedPresentationResult = Awaited<ReturnType<typeof generatePresentationFromDeckPlanIncremental>>;

type RetryRequestContext = {
  current: JsonObject;
  deckPlan: DeckPlanPayload;
  nextSlides: ContentRunSlide[];
  planSlides: DeckPlanSlide[];
  run: ContentRunState;
  seedSlideSpecs: SlideSpecPayload[];
  slideCount: number;
  startIndex: number;
  usedMaterialIds: string[];
};

type RetryDraftParts = {
  current: JsonObject;
  deckPlan: DeckPlanPayload | null;
  planSlides: DeckPlanSlide[];
  run: ContentRunState | null;
  slideCount: number;
};

function collectSlideMaterialIds(spec: SlideSpecPayload, isJsonObject: (value: unknown) => value is JsonObject): string[] {
  const ids: string[] = [];
  if (isJsonObject(spec.media) && typeof spec.media.id === "string") {
    ids.push(spec.media.id);
  }
  if (Array.isArray(spec.mediaItems)) {
    spec.mediaItems.forEach((item: unknown) => {
      if (isJsonObject(item) && typeof item.id === "string") {
        ids.push(item.id);
      }
    });
  }
  return ids;
}

function clampRetryStartIndex(body: JsonObject, failedSlideIndex: unknown, slideCount: number): number {
  const requestedIndex = Number.isFinite(Number(body.slideIndex)) ? Number(body.slideIndex) : null;
  const failedIndex = failedSlideIndex === null || failedSlideIndex === undefined ? null : Number(failedSlideIndex);
  const rawIndex = requestedIndex !== null
    ? requestedIndex
    : failedIndex !== null
      ? failedIndex
      : 0;
  return Math.max(0, Math.min(slideCount - 1, rawIndex));
}

function createRetrySlides(
  slideCount: number,
  startIndex: number,
  seedSlides: ContentRunSlide[],
  isSlideSpecPayload: (value: unknown) => value is SlideSpecPayload
): ContentRunSlide[] {
  return Array.from({ length: slideCount }, (_unused: unknown, index: number) => {
    if (index < startIndex) {
      const seed = seedSlides[index];
      return {
        error: null,
        slideContext: seed ? seed.slideContext || null : null,
        slideSpec: seed && isSlideSpecPayload(seed.slideSpec) ? seed.slideSpec : null,
        status: "complete"
      };
    }
    return {
      error: null,
      slideContext: null,
      slideSpec: null,
      status: "pending"
    };
  });
}

function readRetryDraftParts(params: {
  current: unknown;
  deckPlanSlides: (deckPlan: unknown) => DeckPlanSlide[];
  isContentRunState: (value: unknown) => value is ContentRunState;
  isDeckPlanPayload: (value: unknown) => value is DeckPlanPayload;
  isJsonObject: (value: unknown) => value is JsonObject;
}): RetryDraftParts {
  const current = params.isJsonObject(params.current) ? params.current : {};
  const deckPlan = params.isDeckPlanPayload(current.deckPlan) ? current.deckPlan : null;
  const run = params.isContentRunState(current.contentRun) ? current.contentRun : null;
  const planSlides = params.deckPlanSlides(deckPlan);
  return {
    current,
    deckPlan,
    planSlides,
    run,
    slideCount: planSlides.length
  };
}

function requireRetryDeckPlan(deckPlan: DeckPlanPayload | null, slideCount: number): DeckPlanPayload {
  if (!deckPlan || !slideCount) {
    throw new Error("Expected an approved outline before retrying a slide");
  }
  return deckPlan;
}

function requireRetryContentRun(run: ContentRunState | null): ContentRunState {
  if (!run || !Array.isArray(run.slides) || run.id === "") {
    throw new Error("No content run is available to retry");
  }
  if (run.status === "running") {
    throw new Error("Generation is already running");
  }
  return run;
}

function requireRetrySeedSlides(
  run: ContentRunState,
  startIndex: number,
  isContentRunSlide: (value: unknown) => value is ContentRunSlide,
  isSlideSpecPayload: (value: unknown) => value is SlideSpecPayload
): ContentRunSlide[] {
  const seedSlides = run.slides?.filter(isContentRunSlide).slice(0, startIndex) || [];
  if (!seedSlides.every((slide) => slide.status === "complete" && isSlideSpecPayload(slide.slideSpec))) {
    throw new Error("Retry slide requires completed slides before the retry point");
  }
  return seedSlides;
}

function prepareRetryRequest(params: {
  body: JsonObject;
  current: unknown;
  deckPlanSlides: (deckPlan: unknown) => DeckPlanSlide[];
  isContentRunSlide: (value: unknown) => value is ContentRunSlide;
  isContentRunState: (value: unknown) => value is ContentRunState;
  isDeckPlanPayload: (value: unknown) => value is DeckPlanPayload;
  isJsonObject: (value: unknown) => value is JsonObject;
  isSlideSpecPayload: (value: unknown) => value is SlideSpecPayload;
}): RetryRequestContext {
  const draftParts = readRetryDraftParts(params);
  const deckPlan = requireRetryDeckPlan(draftParts.deckPlan, draftParts.slideCount);
  const run = requireRetryContentRun(draftParts.run);
  const startIndex = clampRetryStartIndex(params.body, run.failedSlideIndex, draftParts.slideCount);
  const seedSlides = requireRetrySeedSlides(run, startIndex, params.isContentRunSlide, params.isSlideSpecPayload);
  const seedSlideSpecs = seedSlides.map((slide) => slide.slideSpec).filter(params.isSlideSpecPayload);
  return {
    current: draftParts.current,
    deckPlan,
    nextSlides: createRetrySlides(draftParts.slideCount, startIndex, seedSlides, params.isSlideSpecPayload),
    planSlides: draftParts.planSlides,
    run,
    seedSlideSpecs,
    slideCount: draftParts.slideCount,
    startIndex,
    usedMaterialIds: seedSlideSpecs.flatMap((spec) => collectSlideMaterialIds(spec, params.isJsonObject)).filter(Boolean)
  };
}

async function importRetryMaterials(generationMaterials: MaterialPayload[]): Promise<Map<string, unknown>> {
  const importedMaterials: MaterialPayload[] = [];
  const starterGenerationMaterials = generationMaterials.filter((material) => material.dataUrl);
  starterGenerationMaterials.forEach((material) => {
    importedMaterials.push(createMaterialFromDataUrl({
      alt: material.alt,
      caption: material.caption,
      dataUrl: material.dataUrl,
      fileName: material.fileName,
      id: material.id,
      title: material.title
    }));
  });

  const remoteMaterials = generationMaterials.filter((material) => material.url && !material.dataUrl);
  for (const material of remoteMaterials) {
    try {
      importedMaterials.push(await createMaterialFromRemoteImage({
        alt: material.alt,
        caption: material.caption,
        creator: material.creator,
        id: material.id,
        license: material.license,
        licenseUrl: material.licenseUrl,
        provider: material.provider,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      }));
    } catch (error) {
      // Ignore import failures.
    }
  }

  return new Map(importedMaterials.map((material) => [String(material.id || ""), material.url]));
}

function currentDraftFields(current: unknown, isJsonObject: (value: unknown) => value is JsonObject): JsonObject {
  return isJsonObject(current) && isJsonObject(current.fields) ? current.fields : {};
}

async function completeRetryGeneration(params: {
  current: unknown;
  deckPlan: DeckPlanPayload;
  generated: GeneratedPresentationResult;
  generationMaterials: MaterialPayload[];
  isJsonObject: (value: unknown) => value is JsonObject;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  runtimeState: CreationContentRunRetryHandlerDependencies["runtimeState"];
  slideCount: number;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
}): Promise<void> {
  const currentFields = currentDraftFields(params.current, params.isJsonObject);
  const presentation = createPresentation({
    ...currentFields,
    createDefaultFlow: false,
    outline: params.deckPlan.outline || "",
    targetSlideCount: params.slideCount,
    title: currentFields.title || "slideotter"
  });
  createOutlinePlanFromDeckPlan(presentation.id, params.deckPlan, {
    audience: currentFields.audience,
    name: "Approved retried creation outline",
    objective: currentFields.objective,
    presentationDensity: currentFields.presentationDensity,
    purpose: currentFields.objective,
    targetSlideCount: params.slideCount,
    title: currentFields.title,
    tone: currentFields.tone
  });
  setActivePresentation(presentation.id);

  const materialUrlById = await importRetryMaterials(params.generationMaterials);
  const slideSpecs = Array.isArray(params.generated.slideSpecs)
    ? params.generated.slideSpecs.map((slideSpec: unknown) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById))
    : [];
  regeneratePresentationSlides(presentation.id, slideSpecs, {
    outline: params.generated.outline,
    slideContexts: params.generated.slideContexts,
    targetSlideCount: params.generated.targetSlideCount
  });

  const nextDraft = savePresentationCreationDraft({
    ...getPresentationCreationDraft(),
    contentRun: null,
    createdPresentationId: presentation.id,
    stage: "content"
  });
  params.publishCreationDraftUpdate(nextDraft);

  params.updateWorkflowState({
    generation: params.generated.generation,
    message: params.generated.summary,
    ok: true,
    operation: "retry-presentation-slide",
    stage: "completed",
    status: "completed"
  });
  params.runtimeState.lastError = null;
  params.runtimeState.sourceRetrieval = sanitizeSourceRetrievalForRuntime(params.generated.retrieval);
  params.publishRuntimeState();
  params.publishCreationDraftUpdate(clearPresentationCreationDraft());
}

function latestRetryRun(
  runId: string,
  isContentRunState: (value: unknown) => value is ContentRunState,
  isJsonObject: (value: unknown) => value is JsonObject
): { latest: JsonObject; latestRun: ContentRunState | null } {
  const latest = getPresentationCreationDraft();
  const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) && latest.contentRun.id === runId
    ? latest.contentRun
    : null;
  return { latest: isJsonObject(latest) ? latest : {}, latestRun };
}

function markRetryGenerationStopped(params: {
  latest: JsonObject;
  latestRun: ContentRunState | null;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
}): void {
  if (params.latestRun && Array.isArray(params.latestRun.slides)) {
    const nextDraft = savePresentationCreationDraft({
      ...params.latest,
      contentRun: {
        ...params.latestRun,
        status: "stopped",
        stopRequested: false,
        updatedAt: new Date().toISOString()
      }
    });
    params.publishCreationDraftUpdate(nextDraft);
  }

  params.updateWorkflowState({
    message: "Slide generation stopped. Completed slides are kept.",
    ok: false,
    operation: "retry-presentation-slide",
    stage: "stopped",
    status: "stopped"
  });
  params.publishRuntimeState();
}

function markRetryGenerationFailed(params: {
  current: unknown;
  error: unknown;
  isContentRunSlide: (value: unknown) => value is ContentRunSlide;
  isJsonObject: (value: unknown) => value is JsonObject;
  latest: JsonObject;
  latestRun: ContentRunState | null;
  planSlides: DeckPlanSlide[];
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  runId: string;
  runtimeState: CreationContentRunRetryHandlerDependencies["runtimeState"];
  slideCount: number;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
}): void {
  if (params.latestRun && Array.isArray(params.latestRun.slides)) {
    const latestSlides = params.latestRun.slides.filter(params.isContentRunSlide);
    const firstIncomplete = latestSlides.findIndex((slide) => slide.status !== "complete");
    const failedIndexNext = firstIncomplete >= 0 ? firstIncomplete : null;
    const currentFields = currentDraftFields(params.current, params.isJsonObject);
    const diagnostic = writeGenerationErrorDiagnostic(params.error, {
      deckTitle: currentFields.title || "",
      operation: "retry-presentation-slide",
      planSlide: failedIndexNext === null ? null : params.planSlides[failedIndexNext] || null,
      runId: params.runId,
      slideCount: params.slideCount,
      slideIndex: failedIndexNext,
      workflow: params.runtimeState.workflow
    });
    const slides = latestSlides.map((slide, index) => {
      if (failedIndexNext === index) {
        return {
          ...slide,
          error: contentRunVisibleErrorMessage(params.error),
          errorLogPath: diagnostic.filePath,
          status: "failed"
        };
      }
      return slide;
    });
    const nextDraft = savePresentationCreationDraft({
      ...params.latest,
      contentRun: {
        ...params.latestRun,
        failedSlideIndex: failedIndexNext,
        slides,
        status: "failed",
        updatedAt: new Date().toISOString()
      }
    });
    params.publishCreationDraftUpdate(nextDraft);
  }

  params.updateWorkflowState({
    message: contentRunVisibleErrorMessage(params.error),
    ok: false,
    operation: "retry-presentation-slide",
    stage: "failed",
    status: "failed"
  });
  params.publishRuntimeState();
}

function createPresentationDraftContentRetryHandler(deps: CreationContentRunRetryHandlerDependencies) {
  const {
    createJsonResponse,
    createWorkflowProgressReporter,
    errorCode,
    helpers,
    isJsonObject,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;
  const {
    deckPlanSlides,
    isContentRunSlide,
    isContentRunState,
    isDeckPlanPayload,
    isMaterialPayload,
    isSlideSpecPayload
  } = helpers;

  return async function handlePresentationDraftContentRetry(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const {
      current,
      deckPlan,
      nextSlides,
      planSlides,
      run,
      seedSlideSpecs,
      slideCount,
      startIndex,
      usedMaterialIds
    } = prepareRetryRequest({
      body,
      current: getPresentationCreationDraft(),
      deckPlanSlides,
      isContentRunSlide,
      isContentRunState,
      isDeckPlanPayload,
      isJsonObject,
      isSlideSpecPayload
    });

    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "retry-presentation-slide"
    });
    reportProgress({
      message: `Retrying slide ${startIndex + 1}/${slideCount}...`,
      stage: "retrying-slide"
    });

    const timestamp = new Date().toISOString();
    const runId = `content-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const draft = savePresentationCreationDraft({
      ...current,
      contentRun: {
        completed: startIndex,
        failedSlideIndex: null,
        id: runId,
        materials: run.materials || [],
        sourceCount: run.sourceCount || 0,
        slideCount,
        slides: nextSlides,
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp
      },
      stage: "content"
    });
    publishCreationDraftUpdate(draft);

    createJsonResponse(res, 202, {
      creationDraft: draft,
      runtime: serializeRuntimeState()
    });

    const runGeneration = async (): Promise<void> => {
      try {
        const generationMaterials = Array.isArray(run.materials) && run.materials.length ? run.materials.filter(isMaterialPayload) : [];

        const draftFields: GenerationDraftFields = {
          ...normalizeCreationFields(isJsonObject(current) ? jsonObjectOrEmpty(current.fields) : {}),
          includeActiveMaterials: false,
          includeActiveSources: true,
          onProgress: undefined,
          presentationMaterials: generationMaterials,
          presentationSourceText: ""
        };

        const contentRunState = (next: ContentRunPatch): unknown => {
          const latest = getPresentationCreationDraft();
          const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!latestRun || latestRun.id !== runId) {
            return null;
          }

          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...latestRun,
              ...next,
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
          return nextDraft;
        };

        const shouldStop = (): boolean => {
          const latest = getPresentationCreationDraft();
          const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          return Boolean(latestRun && latestRun.id === runId && latestRun.stopRequested === true);
        };

        const setSlideState = (index: number, next: ContentRunSlide): unknown => {
          const latest = getPresentationCreationDraft();
          const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!latestRun || latestRun.id !== runId || !Array.isArray(latestRun.slides)) {
            return null;
          }

          const slides = latestRun.slides.filter(isContentRunSlide).map((slide, idx) => idx === index ? { ...slide, ...next } : slide);
          const completed = slides.filter((slide) => slide.status === "complete").length;
          return contentRunState({
            completed,
            slides
          });
        };

        const reportProgressWithRun = (progress: GenerationProgressPayload): void => {
          const slideIndex = Number(progress.slideIndex);
          if (
            progress
            && progress.stage === "drafting-slide"
            && Number.isFinite(slideIndex)
            && slideIndex >= 1
            && slideIndex <= slideCount
          ) {
            setSlideState(slideIndex - 1, { status: "generating", error: null });
          }

          reportProgress({
            ...progress,
            stage: typeof progress.stage === "string" ? progress.stage : "running"
          });
        };
        draftFields.onProgress = reportProgressWithRun;

        const generated = await generatePresentationFromDeckPlanIncremental(draftFields, deckPlan, {}, {
          initialGeneratedPlanSlides: [],
          initialSlideSpecs: seedSlideSpecs,
          onSlide: async (payload: unknown): Promise<void> => {
            const partial = jsonObjectOrEmpty(payload) as GeneratedPartialSlidePayload;
            const slideIndex = Number(partial.slideIndex);
            const slideCountProgress = Number(partial.slideCount);
            const slideIndexZero = slideIndex - 1;
            const validatedSpec = jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
            await assertGeneratedSlideFitsDom(slideIndex, validatedSpec);
            const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
            const partialContexts = isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
            setSlideState(slideIndexZero, {
              slideContext: partialContexts[contextKey] || null,
              slideSpec: validatedSpec,
              status: "complete"
            });
            reportProgress({
              message: `Completed slide ${slideIndex}/${slideCountProgress}.`,
              slideCount: slideCountProgress,
              slideIndex,
              stage: "completed-slide"
            });
          },
          startIndex,
          usedMaterialIds: new Set(usedMaterialIds),
          shouldStop
        });

        reportProgress({
          message: "Finalizing generated slides into deck files...",
          stage: "finalizing"
        });
        await completeRetryGeneration({
          current,
          deckPlan,
          generated,
          generationMaterials,
          isJsonObject,
          publishCreationDraftUpdate,
          publishRuntimeState,
          runtimeState,
          slideCount,
          updateWorkflowState
        });
      } catch (error) {
        const { latest, latestRun } = latestRetryRun(runId, isContentRunState, isJsonObject);
        if (errorCode(error) === "CONTENT_RUN_STOPPED" || latestRun?.stopRequested === true) {
          markRetryGenerationStopped({
            latest,
            latestRun,
            publishCreationDraftUpdate,
            publishRuntimeState,
            updateWorkflowState
          });
          return;
        }

        markRetryGenerationFailed({
          current,
          error,
          isContentRunSlide,
          isJsonObject,
          latest,
          latestRun,
          planSlides,
          publishCreationDraftUpdate,
          publishRuntimeState,
          runId,
          runtimeState,
          slideCount,
          updateWorkflowState
        });
      }
    };

    runGeneration();
  };
}

export { createPresentationDraftContentRetryHandler };
