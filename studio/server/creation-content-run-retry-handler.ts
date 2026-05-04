import {
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
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
import { createSource } from "./services/sources.ts";
import type { ContentRunHelpers } from "./creation-content-run-helpers.ts";
import type {
  ContentRunPatch,
  ContentRunSlide,
  CreationContentRunHandlerDependencies,
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
  | "errorMessage"
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

function createPresentationDraftContentRetryHandler(deps: CreationContentRunRetryHandlerDependencies) {
  const {
    createJsonResponse,
    createWorkflowProgressReporter,
    errorCode,
    errorMessage,
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
    const current = getPresentationCreationDraft();
    const deckPlan = isJsonObject(current) && isDeckPlanPayload(current.deckPlan) ? current.deckPlan : null;
    const run = isJsonObject(current) && isContentRunState(current.contentRun) ? current.contentRun : null;
    const planSlides = deckPlanSlides(deckPlan);
    const slideCount = planSlides.length;

    if (!deckPlan || !slideCount) {
      throw new Error("Expected an approved outline before retrying a slide");
    }
    if (!run || !Array.isArray(run.slides) || run.id === "") {
      throw new Error("No content run is available to retry");
    }
    if (run.status === "running") {
      throw new Error("Generation is already running");
    }

    const requestedIndex = Number.isFinite(Number(body.slideIndex)) ? Number(body.slideIndex) : null;
    const failedIndex = run.failedSlideIndex === null || run.failedSlideIndex === undefined ? null : Number(run.failedSlideIndex);
    const startIndex = requestedIndex !== null
      ? Math.max(0, Math.min(slideCount - 1, requestedIndex))
      : failedIndex !== null
        ? Math.max(0, Math.min(slideCount - 1, failedIndex))
        : 0;

    const runSlides = run.slides.filter(isContentRunSlide);
    const seedSlides = runSlides.slice(0, startIndex);
    if (!seedSlides.every((slide) => slide.status === "complete" && isSlideSpecPayload(slide.slideSpec))) {
      throw new Error("Retry slide requires completed slides before the retry point");
    }

    const seedSlideSpecs = seedSlides.map((slide) => slide.slideSpec).filter(isSlideSpecPayload);
    const collectMediaIds = (spec: SlideSpecPayload): string[] => {
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
    };
    const usedMaterialIds = seedSlideSpecs.flatMap(collectMediaIds).filter(Boolean);

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
    const nextSlides: ContentRunSlide[] = Array.from({ length: slideCount }, (_unused: unknown, index: number) => {
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

    const draft = savePresentationCreationDraft({
      ...current,
      contentRun: {
        completed: startIndex,
        failedSlideIndex: null,
        id: runId,
        materials: run.materials || [],
        sourceText: run.sourceText || "",
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
          includeActiveSources: false,
          onProgress: undefined,
          presentationMaterials: generationMaterials,
          presentationSourceText: String(run.sourceText || "")
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

        const presentation = createPresentation({
          ...(isJsonObject(current) && isJsonObject(current.fields) ? current.fields : {}),
          outline: deckPlan.outline || "",
          targetSlideCount: slideCount,
          title: isJsonObject(current) && isJsonObject(current.fields) && current.fields.title ? current.fields.title : "slideotter"
        });
        createOutlinePlanFromDeckPlan(presentation.id, deckPlan, {
          audience: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.audience : undefined,
          name: "Approved retried creation outline",
          objective: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.objective : undefined,
          purpose: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.objective : undefined,
          targetSlideCount: slideCount,
          title: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.title : undefined,
          tone: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.tone : undefined
        });
        setActivePresentation(presentation.id);

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

        if (run.sourceText) {
          await createSource({
            text: run.sourceText,
            title: "Starter sources"
          });
        }

        const materialUrlById = new Map(importedMaterials.map((material) => [String(material.id || ""), material.url]));
        const slideSpecs = Array.isArray(generated.slideSpecs)
          ? generated.slideSpecs.map((slideSpec: unknown) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById))
          : [];
        regeneratePresentationSlides(presentation.id, slideSpecs, {
          outline: generated.outline,
          slideContexts: generated.slideContexts,
          targetSlideCount: generated.targetSlideCount
        });

        const nextDraft = savePresentationCreationDraft({
          ...getPresentationCreationDraft(),
          contentRun: null,
          createdPresentationId: presentation.id,
          stage: "content"
        });
        publishCreationDraftUpdate(nextDraft);

        updateWorkflowState({
          generation: generated.generation,
          message: generated.summary,
          ok: true,
          operation: "retry-presentation-slide",
          stage: "completed",
          status: "completed"
        });
        runtimeState.lastError = null;
        runtimeState.sourceRetrieval = generated.retrieval || null;
        publishRuntimeState();
        const resetDraft = clearPresentationCreationDraft();
        publishCreationDraftUpdate(resetDraft);
      } catch (error) {
        const latest = getPresentationCreationDraft();
        const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) && latest.contentRun.id === runId ? latest.contentRun : null;
        if (errorCode(error) === "CONTENT_RUN_STOPPED") {
          if (latestRun && Array.isArray(latestRun.slides)) {
            const nextDraft = savePresentationCreationDraft({
              ...latest,
              contentRun: {
                ...latestRun,
                status: "stopped",
                stopRequested: false,
                updatedAt: new Date().toISOString()
              }
            });
            publishCreationDraftUpdate(nextDraft);
          }

          updateWorkflowState({
            message: "Slide generation stopped. Completed slides are kept.",
            ok: false,
            operation: "retry-presentation-slide",
            stage: "stopped",
            status: "stopped"
          });
          publishRuntimeState();
          return;
        }

        if (latestRun && Array.isArray(latestRun.slides)) {
          const latestSlides = latestRun.slides.filter(isContentRunSlide);
          const firstIncomplete = latestSlides.findIndex((slide) => slide.status !== "complete");
          const failedIndexNext = firstIncomplete >= 0 ? firstIncomplete : null;
          const diagnostic = writeGenerationErrorDiagnostic(error, {
            deckTitle: isJsonObject(current) && isJsonObject(current.fields) && current.fields.title ? current.fields.title : "",
            operation: "retry-presentation-slide",
            planSlide: failedIndexNext === null ? null : planSlides[failedIndexNext] || null,
            runId,
            slideCount,
            slideIndex: failedIndexNext,
            workflow: runtimeState.workflow
          });
          const slides = latestSlides.map((slide, index) => {
            if (failedIndexNext === index) {
              return {
                ...slide,
                error: errorMessage(error),
                errorLogPath: diagnostic.filePath,
                status: "failed"
              };
            }
            return slide;
          });
          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...latestRun,
              failedSlideIndex: failedIndexNext,
              slides,
              status: "failed",
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
        }

        updateWorkflowState({
          message: errorMessage(error),
          ok: false,
          operation: "retry-presentation-slide",
          stage: "failed",
          status: "failed"
        });
        publishRuntimeState();
      }
    };

    runGeneration();
  };
}

export { createPresentationDraftContentRetryHandler };
