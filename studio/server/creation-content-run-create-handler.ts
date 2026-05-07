import {
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
import { searchCreationImagesAsMaterials } from "./creation-image-search.ts";
import { attachWebSourcesToCreationFields } from "./creation-source-fields.ts";
import { writeGenerationErrorDiagnostic } from "./services/generation-diagnostics.ts";
import { createMaterialFromDataUrl, createMaterialFromRemoteImage } from "./services/materials.ts";
import {
  clearPresentationCreationDraft,
  createOutlinePlanFromDeckPlan,
  createPresentation,
  getPresentationCreationDraft,
  readPresentationSummary,
  regeneratePresentationSlides,
  savePresentationCreationDraft,
  setActivePresentation
} from "./services/presentations.ts";
import { createLiveContentRunPlaceholderDeck } from "./services/creation-content-run-decks.ts";
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
  SlideSpecPayload,
  StarterMaterialPayload
} from "./creation-content-run-types.ts";

type CreationContentRunCreateHandlerDependencies = Pick<
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

function createPresentationDraftCreateHandler(deps: CreationContentRunCreateHandlerDependencies) {
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
    isContentRunSlide,
    isContentRunState,
    isMaterialPayload,
    slugify
  } = helpers;

  return async function handlePresentationDraftCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const fields = normalizeCreationFields({
      ...(current.fields || {}),
      ...(body.fields || {})
    });
    const deckPlan = jsonObjectOrEmpty(body.deckPlan || current.deckPlan);
    const approvedOutline = body.approvedOutline === true || current.approvedOutline === true;
    const generationFields = await attachWebSourcesToCreationFields(fields);
    const starterSourceText = generationFields.presentationSourceText;
    const starterMaterials = Array.isArray(body.presentationMaterials) ? body.presentationMaterials : [];

    if (!fields.title) {
      throw new Error("Expected a presentation title before creating slides");
    }
    if (!approvedOutline) {
      throw new Error("Approve the generated outline before creating slides");
    }
    if (current.outlineDirty) {
      throw new Error("Regenerate the outline after changing the brief before creating slides");
    }
    if (!deckPlan || !Array.isArray(deckPlan.slides) || !deckPlan.slides.length) {
      throw new Error("Expected an approved outline before creating slides");
    }

    const currentContentRun = jsonObjectOrEmpty(current.contentRun);
    if (currentContentRun.status === "running") {
      createJsonResponse(res, 200, {
        creationDraft: current,
        runtime: serializeRuntimeState()
      });
      return;
    }

    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "create-presentation-from-outline"
    });
    reportProgress({
      message: "Drafting slides from approved outline...",
      stage: "drafting-slides"
    });

    const timestamp = new Date().toISOString();
    const slideCount = deckPlan.slides.length;
    const runId = `content-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runSlides = Array.from({ length: slideCount }, () => ({
      error: null,
      slideContext: null,
      slideSpec: null,
      status: "pending"
    }));

    const livePlaceholderDeck = createLiveContentRunPlaceholderDeck(deckPlan);
    const presentation = createPresentation({
      ...fields,
      initialSlideSpecs: livePlaceholderDeck.slideSpecs,
      outline: deckPlan.outline || "",
      targetSlideCount: fields.targetSlideCount || slideCount,
      title: fields.title
    });
    createOutlinePlanFromDeckPlan(presentation.id, deckPlan, {
      audience: fields.audience,
      name: "Approved creation outline",
      objective: fields.objective,
      purpose: fields.objective,
      targetSlideCount: slideCount,
      title: fields.title,
      tone: fields.tone
    });
    setActivePresentation(presentation.id);
    regeneratePresentationSlides(presentation.id, livePlaceholderDeck.slideSpecs, {
      outline: deckPlan.outline || "",
      slideContexts: livePlaceholderDeck.slideContexts,
      targetSlideCount: slideCount
    });

    const draft = savePresentationCreationDraft({
      ...current,
      approvedOutline: true,
      contentRun: {
        completed: 0,
        failedSlideIndex: null,
        id: runId,
        slideCount,
        slides: runSlides,
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp
      },
      createdPresentationId: presentation.id,
      deckPlan,
      fields,
      outlineDirty: false,
      stage: "content"
    });
    publishCreationDraftUpdate(draft);

    createJsonResponse(res, 202, {
      creationDraft: draft,
      presentation: readPresentationSummary(presentation.id),
      runtime: serializeRuntimeState()
    });

    const starterGenerationMaterials: MaterialPayload[] = starterMaterials.map((material: StarterMaterialPayload, index: number) => {
      const title = String(material.title || material.fileName || `Starter image ${index + 1}`).trim() || `Starter image ${index + 1}`;
      const id = `material-starter-${slugify(material.fileName || title, `image-${index + 1}`)}`;
      return {
        alt: material.alt || title,
        caption: material.caption || "",
        dataUrl: material.dataUrl,
        fileName: material.fileName || title,
        id,
        title,
        url: material.dataUrl
      };
    });

    const runGeneration = async (): Promise<void> => {
      try {
        const contentRunState = (next: ContentRunPatch): unknown => {
          const latest = getPresentationCreationDraft();
          const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!run || run.id !== runId) {
            return null;
          }

          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...run,
              ...next,
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
          return nextDraft;
        };

        const shouldStop = (): boolean => {
          const latest = getPresentationCreationDraft();
          const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          return Boolean(run && run.id === runId && run.stopRequested === true);
        };

        const imageSearch = await searchCreationImagesAsMaterials(fields);
        const searchedMaterials: MaterialPayload[] = imageSearch.materials.filter(isMaterialPayload);

        const generationMaterials = [
          ...starterGenerationMaterials,
          ...searchedMaterials
        ];

        if (starterSourceText) {
          await createSource({
            text: starterSourceText,
            title: "Starter sources"
          });
        }

        const importedMaterials: MaterialPayload[] = [];
        starterGenerationMaterials.forEach((material) => {
          if (!material.dataUrl) {
            return;
          }
          importedMaterials.push(createMaterialFromDataUrl({
            alt: material.alt,
            caption: material.caption,
            dataUrl: material.dataUrl,
            fileName: material.fileName,
            id: material.id,
            title: material.title
          }));
        });

        for (const material of searchedMaterials) {
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
            // Continue with other search images.
          }
        }

        const materialUrlById = new Map(importedMaterials.map((material) => [String(material.id || ""), material.url]));
        const liveSlideSpecs = livePlaceholderDeck.slideSpecs.map((slideSpec: SlideSpecPayload) => ({ ...slideSpec }));
        const liveSlideContexts: JsonObject = { ...livePlaceholderDeck.slideContexts };
        const publishLiveDeck = (): void => {
          regeneratePresentationSlides(presentation.id, liveSlideSpecs.map((slideSpec) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById)), {
            outline: deckPlan.outline || "",
            slideContexts: liveSlideContexts,
            targetSlideCount: slideCount
          });
        };

        contentRunState({
          materials: generationMaterials,
          sourceText: starterSourceText
        });

        const draftFields: GenerationDraftFields = {
          ...fields,
          includeActiveMaterials: false,
          includeActiveSources: false,
          onProgress: undefined,
          presentationMaterials: generationMaterials,
          presentationSourceText: starterSourceText
        };

        const setSlideState = (index: number, next: ContentRunSlide): unknown => {
          const latest = getPresentationCreationDraft();
          const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!run || run.id !== runId || !Array.isArray(run.slides)) {
            return null;
          }

          const slides = run.slides.filter(isContentRunSlide).map((slide, idx) => idx === index ? { ...slide, ...next } : slide);
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
            && Number.isFinite(Number(progress.slideCount))
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
          onSlide: async (payload: unknown): Promise<void> => {
            const partial = jsonObjectOrEmpty(payload) as GeneratedPartialSlidePayload;
            const slideIndex = Number(partial.slideIndex);
            const slideCountProgress = Number(partial.slideCount);
            const slideIndexZero = slideIndex - 1;
            const validatedSpec = jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
            const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
            const partialContexts = isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
            const partialContext = partialContexts[contextKey] || null;
            liveSlideSpecs[slideIndexZero] = validatedSpec;
            liveSlideContexts[contextKey] = partialContext || liveSlideContexts[contextKey] || {};
            publishLiveDeck();
            setSlideState(slideIndexZero, {
              slideContext: partialContext,
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
          shouldStop
        });

        reportProgress({
          message: "Finalizing generated slides into deck files...",
          stage: "finalizing"
        });

        setActivePresentation(presentation.id);
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
          stage: "structure"
        });
        publishCreationDraftUpdate(nextDraft);

        updateWorkflowState({
          generation: generated.generation,
          message: [
            generated.summary,
            "Created from an approved outline."
          ].filter(Boolean).join(" "),
          ok: true,
          operation: "create-presentation-from-outline",
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
        const run = isJsonObject(latest) && isContentRunState(latest.contentRun) && latest.contentRun.id === runId ? latest.contentRun : null;
        if (errorCode(error) === "CONTENT_RUN_STOPPED" || run?.stopRequested === true) {
          if (run && Array.isArray(run.slides)) {
            const nextDraft = savePresentationCreationDraft({
              ...latest,
              contentRun: {
                ...run,
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
            operation: "create-presentation-from-outline",
            stage: "stopped",
            status: "stopped"
          });
          publishRuntimeState();
          return;
        }

        if (run && Array.isArray(run.slides)) {
          const slides = run.slides.filter(isContentRunSlide);
          const firstIncomplete = slides.findIndex((slide) => slide.status !== "complete");
          const failedIndex = firstIncomplete >= 0 ? firstIncomplete : null;
          const diagnostic = writeGenerationErrorDiagnostic(error, {
            deckTitle: fields.title,
            operation: "create-presentation-from-outline",
            planSlide: failedIndex === null || !Array.isArray(deckPlan.slides) ? null : deckPlan.slides[failedIndex] || null,
            runId,
            slideCount,
            slideIndex: failedIndex,
            workflow: runtimeState.workflow
          });
          const nextSlides = slides.map((slide, index) => {
            if (failedIndex === index) {
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
              ...run,
              failedSlideIndex: failedIndex,
              slides: nextSlides,
              status: "failed",
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
        }

        updateWorkflowState({
          message: errorMessage(error),
          ok: false,
          operation: "create-presentation-from-outline",
          stage: "failed",
          status: "failed"
        });
        publishRuntimeState();
      }
    };

    runGeneration();
  };
}

export { createPresentationDraftCreateHandler };
