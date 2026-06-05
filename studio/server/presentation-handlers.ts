import * as http from "http";

import { assertBaseVersion, getPresentationVersion } from "./services/hypermedia.ts";
import { assertGeneratedSlideFitsDom } from "./content-run-slide-validation.ts";
import { contentRunVisibleErrorMessage } from "./content-run-visible-errors.ts";
import { importImageSearchResults } from "./services/image-search.ts";
import { createMaterialFromDataUrl } from "./services/materials.ts";
import { createLiveContentRunPlaceholderDeck } from "./services/creation-content-run-decks.ts";
import { writeGenerationErrorDiagnostic } from "./services/generation-diagnostics.ts";
import {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  getPresentationCreationDraft,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  listPresentations,
  readPresentationDeckContext,
  regeneratePresentationSlides,
  readPresentationSummary,
  savePresentationCreationDraft,
  setActivePresentation
} from "./services/presentations.ts";
import { generateInitialPresentation, generatePresentationFromDeckPlanIncremental } from "./services/presentation-generation.ts";
import { publishCreationDraftUpdate } from "./runtime-state.ts";
import { validateSlideSpec } from "./services/slide-specs/index.ts";
import { createSource, sanitizeSourceRetrievalForRuntime } from "./services/sources.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type StarterMaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  title?: unknown;
};

type ImageSearchPayload = JsonObject & {
  count?: unknown;
  provider?: unknown;
  query?: unknown;
  restrictions?: unknown;
};

type ContentRunSlide = JsonObject & {
  error?: unknown;
  errorLogPath?: unknown;
  slideContext?: unknown;
  slideSpec?: JsonObject | null;
  status?: unknown;
};

type ErrorWithCode = Error & {
  code?: string;
};

type RuntimeStateAccess = {
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  sourceRetrieval: unknown;
  workflow?: JsonObject | null;
};

type PresentationHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createPresentationPayload: (extra?: JsonObject) => JsonObject;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  resetPresentationRuntime: () => void;
  runtimeState: RuntimeStateAccess;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStarterMaterialPayload(value: unknown): value is StarterMaterialPayload {
  return isJsonObject(value);
}

function isImageSearchPayload(value: unknown): value is ImageSearchPayload {
  return isJsonObject(value);
}

function isContentRunSlide(value: unknown): value is ContentRunSlide {
  return isJsonObject(value);
}

function errorCode(value: unknown): string {
  return value instanceof Error && typeof (value as ErrorWithCode).code === "string"
    ? String((value as ErrorWithCode).code)
    : "";
}

function requestContentRunStopForDeletedPresentation(presentationId: string): void {
  const draft = getPresentationCreationDraft();
  const contentRun = isJsonObject(draft.contentRun) ? draft.contentRun : null;
  if (
    draft.createdPresentationId !== presentationId
    || !contentRun
    || contentRun.status !== "running"
  ) {
    return;
  }

  const nextDraft = savePresentationCreationDraft({
    ...draft,
    contentRun: {
      ...contentRun,
      stopRequested: true,
      updatedAt: new Date().toISOString()
    }
  });
  publishCreationDraftUpdate(nextDraft);
}

export function createPresentationHandlers(deps: PresentationHandlerDependencies) {
  const {
    createJsonResponse,
    createPresentationPayload,
    createWorkflowProgressReporter,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    updateWorkflowState
  } = deps;

  async function handlePresentationSelect(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    setActivePresentation(body.presentationId);
    resetPresentationRuntime();
    createJsonResponse(res, 200, createPresentationPayload());
  }

  async function handlePresentationCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const fields = body;
    const starterSourceText = typeof fields.presentationSourceText === "string"
      ? fields.presentationSourceText.trim()
      : "";
    const starterMaterials = Array.isArray(fields.presentationMaterials)
      ? fields.presentationMaterials.filter(isStarterMaterialPayload)
      : [];
    let presentation = null;
    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "create-presentation"
    });
    reportProgress({
      message: "Generating initial presentation slides...",
      stage: "generating-slides"
    });
    try {
      presentation = createPresentation({
        ...fields,
        targetSlideCount: fields.targetSlideCount || fields.targetCount
      });

      if (starterSourceText) {
        await createSource({
          text: starterSourceText,
          title: "Starter sources"
        });
      }

      starterMaterials.forEach((material: StarterMaterialPayload) => {
        createMaterialFromDataUrl({
          alt: material.alt || material.title || material.fileName,
          caption: material.caption || "",
          dataUrl: material.dataUrl,
          fileName: material.fileName || material.title || "starter-image",
          title: material.title || material.fileName || "Starter image"
        });
      });

      let imageSearchResult = null;
      if (isImageSearchPayload(fields.imageSearch) && String(fields.imageSearch.query || "").trim()) {
        imageSearchResult = await importImageSearchResults({
          count: fields.imageSearch.count,
          provider: fields.imageSearch.provider,
          query: fields.imageSearch.query,
          restrictions: fields.imageSearch.restrictions
        });
      }

      const generated = await generateInitialPresentation({
        ...fields,
        includeActiveMaterials: true,
        includeActiveSources: true,
        onProgress: reportProgress,
        presentationSourceText: starterSourceText
      });
      presentation = regeneratePresentationSlides(presentation.id, generated.slideSpecs, {
        outline: generated.outline,
        slideContexts: generated.slideContexts,
        targetSlideCount: generated.targetSlideCount
      });
      setActivePresentation(presentation.id);
      updateWorkflowState({
        generation: generated.generation,
        message: [
          generated.summary,
          starterSourceText ? "Starter sources were saved with the new presentation." : "",
          starterMaterials.length ? `${starterMaterials.length} starter image${starterMaterials.length === 1 ? "" : "s"} were saved with the new presentation.` : "",
          imageSearchResult && imageSearchResult.imported.length ? `${imageSearchResult.imported.length} searched image${imageSearchResult.imported.length === 1 ? "" : "s"} were imported from ${imageSearchResult.providerLabel || imageSearchResult.provider}.` : ""
        ].filter(Boolean).join(" "),
        ok: true,
        operation: "create-presentation",
        stage: "completed",
        status: "completed"
      });
      runtimeState.lastError = null;
      runtimeState.sourceRetrieval = sanitizeSourceRetrievalForRuntime(generated.retrieval);
      publishRuntimeState();
      createJsonResponse(res, 200, createPresentationPayload({ presentation }));
    } catch (error) {
      if (presentation && presentation.id) {
        try {
          deletePresentation(presentation.id);
        } catch (_cleanupError) {
          // Leave the original generation failure visible.
        }
      }

      throw error;
    }
  }

  async function handlePresentationDuplicate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    assertBaseVersion(getPresentationVersion(body.presentationId), body.baseVersion, "Presentation");
    const presentation = duplicatePresentation(body.presentationId, {
      title: body.title
    });
    resetPresentationRuntime();
    createJsonResponse(res, 200, createPresentationPayload({ presentation }));
  }

  async function handlePresentationRegenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    const context = readPresentationDeckContext(body.presentationId);
    const deck = jsonObjectOrEmpty(context && context.deck);
    const lengthProfile = jsonObjectOrEmpty(deck.lengthProfile);
    const targetSlideCount = body.targetSlideCount
      ?? lengthProfile.targetCount
      ?? body.targetCount;
    const savedPlans = listOutlinePlans(body.presentationId);
    const latestPlan = savedPlans[savedPlans.length - 1] || null;
    const deckPlan = latestPlan
      ? outlinePlanToDeckPlan(latestPlan)
      : {
          audience: deck.audience || "",
          language: deck.lang || "",
          narrativeArc: deck.objective || "",
          outline: deck.outline || "",
          slides: Object.entries(jsonObjectOrEmpty(context.slides))
            .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
            .map(([, slideContext], index) => {
              const slide = jsonObjectOrEmpty(slideContext);
              return {
                intent: slide.intent || "",
                keyMessage: slide.mustInclude || slide.value || slide.intent || "",
                role: index === 0 ? "opening" : "concept",
                sourceNeed: slide.notes || "Use saved presentation context when relevant.",
                title: slide.title || `Slide ${index + 1}`,
                type: "content",
                value: slide.value || "",
                visualNeed: slide.layoutHint || "Use a simple readable layout."
              };
            }),
          thesis: deck.objective || ""
        };
    const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isJsonObject) : [];
    if (!deckPlanSlides.length) {
      throw new Error("Expected saved slide context before rebuilding presentation");
    }

    setActivePresentation(body.presentationId);
    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "regenerate-presentation",
      presentationId: body.presentationId
    });
    reportProgress({
      message: "Preparing live rebuild placeholders...",
      stage: "drafting-slides"
    });

    const timestamp = new Date().toISOString();
    const slideCount = deckPlanSlides.length;
    const runId = `rebuild-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runSlides = Array.from({ length: slideCount }, () => ({
      error: null,
      slideContext: null,
      slideSpec: null,
      status: "pending"
    }));
    const livePlaceholderDeck = createLiveContentRunPlaceholderDeck(deckPlan);
    regeneratePresentationSlides(body.presentationId, livePlaceholderDeck.slideSpecs, {
      outline: livePlaceholderDeck.slideSpecs.map((slide, index) => `${index + 1}. ${String(slide.title || `Slide ${index + 1}`)}`).join("\n"),
      slideContexts: livePlaceholderDeck.slideContexts,
      targetSlideCount: slideCount
    });

    const draft = savePresentationCreationDraft({
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
      createdPresentationId: body.presentationId,
      deckPlan,
      fields: {
        ...deck,
        targetSlideCount: targetSlideCount || slideCount,
        title: deck.title || readPresentationSummary(body.presentationId).title || body.presentationId
      },
      outlineDirty: false,
      stage: "content"
    });
    publishCreationDraftUpdate(draft);
    publishRuntimeState();
    createJsonResponse(res, 202, createPresentationPayload({
      creationDraft: draft,
      presentation: readPresentationSummary(body.presentationId)
    }));

    const runGeneration = async (): Promise<void> => {
      const contentRunState = (next: JsonObject): unknown => {
        const latest = getPresentationCreationDraft();
        const run = isJsonObject(latest.contentRun) ? latest.contentRun : null;
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
        const run = isJsonObject(latest.contentRun) ? latest.contentRun : null;
        return Boolean(run && run.id === runId && run.stopRequested === true);
      };

      const setSlideState = (index: number, next: ContentRunSlide): unknown => {
        const latest = getPresentationCreationDraft();
        const run = isJsonObject(latest.contentRun) ? latest.contentRun : null;
        if (!run || run.id !== runId || !Array.isArray(run.slides)) {
          return null;
        }

        const slides = run.slides.filter(isContentRunSlide).map((slide, slideIndex) => slideIndex === index ? { ...slide, ...next } : slide);
        const completed = slides.filter((slide) => slide.status === "complete").length;
        return contentRunState({
          completed,
          slides
        });
      };

      const liveSlideSpecs = livePlaceholderDeck.slideSpecs.map((slideSpec) => ({ ...slideSpec }));
      const liveSlideContexts: JsonObject = { ...livePlaceholderDeck.slideContexts };
      const publishLiveDeck = (): void => {
        regeneratePresentationSlides(body.presentationId, liveSlideSpecs, {
          outline: deckPlan.outline || liveSlideSpecs.map((slide, index) => `${index + 1}. ${String(slide.title || `Slide ${index + 1}`)}`).join("\n"),
          slideContexts: liveSlideContexts,
          targetSlideCount: slideCount
        });
      };

      try {
        const generationFields = {
          ...deck,
          includeActiveMaterials: true,
          includeActiveSources: true,
          onProgress: (progress: JsonObject): void => {
            const slideIndex = Number(progress.slideIndex);
            if (
              progress.stage === "drafting-slide"
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
          },
          presentationDensity: latestPlan && latestPlan.presentationDensity || "balanced",
          targetSlideCount: targetSlideCount || slideCount
        };

        const generated = await generatePresentationFromDeckPlanIncremental(generationFields, deckPlan, {}, {
          onSlide: async (payload: unknown): Promise<void> => {
            const partial = jsonObjectOrEmpty(payload);
            const slideIndex = Number(partial.slideIndex);
            const slideCountProgress = Number(partial.slideCount);
            const slideIndexZero = slideIndex - 1;
            const validatedSpec = jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
            await assertGeneratedSlideFitsDom(slideIndex, validatedSpec);
            const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
            const partialContexts = isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
            const partialContext = partialContexts[contextKey] || null;
            liveSlideSpecs[slideIndexZero] = validatedSpec;
            liveSlideContexts[contextKey] = isJsonObject(partialContext)
              ? partialContext
              : liveSlideContexts[contextKey] || {};
            publishLiveDeck();
            setSlideState(slideIndexZero, {
              slideContext: liveSlideContexts[contextKey],
              slideSpec: validatedSpec,
              status: "complete"
            });
            reportProgress({
              message: `Completed slide ${slideIndex}/${slideCountProgress}.`,
              presentationId: body.presentationId,
              slideCount: slideCountProgress,
              slideIndex,
              stage: "completed-slide"
            });
          },
          shouldStop
        });

        reportProgress({
          message: "Finalizing rebuilt slides into deck files...",
          stage: "finalizing"
        });

        setActivePresentation(body.presentationId);
        regeneratePresentationSlides(body.presentationId, generated.slideSpecs, {
          outline: generated.outline,
          slideContexts: generated.slideContexts,
          targetSlideCount: generated.targetSlideCount
        });

        const nextDraft = savePresentationCreationDraft({
          ...getPresentationCreationDraft(),
          contentRun: null,
          createdPresentationId: body.presentationId,
          stage: "structure"
        });
        publishCreationDraftUpdate(nextDraft);

        updateWorkflowState({
          generation: generated.generation,
          message: `Rebuilt ${generated.slideSpecs.length} slide${generated.slideSpecs.length === 1 ? "" : "s"} from the saved presentation context, replacing the previous slide files.`,
          ok: true,
          operation: "regenerate-presentation",
          presentationId: body.presentationId,
          stage: "completed",
          status: "completed"
        });
        runtimeState.lastError = null;
        runtimeState.sourceRetrieval = sanitizeSourceRetrievalForRuntime(generated.retrieval);
        publishRuntimeState();
      } catch (error) {
        const latest = getPresentationCreationDraft();
        const run = isJsonObject(latest.contentRun) && latest.contentRun.id === runId ? latest.contentRun : null;
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
            message: "Presentation rebuild stopped. Completed slides are kept.",
            ok: false,
            operation: "regenerate-presentation",
            presentationId: body.presentationId,
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
            deckTitle: String(deck.title || body.presentationId),
            operation: "regenerate-presentation",
            planSlide: failedIndex === null ? null : deckPlanSlides[failedIndex] || null,
            runId,
            slideCount,
            slideIndex: failedIndex,
            workflow: runtimeState.workflow
          });
          const nextSlides = slides.map((slide, index) => index === failedIndex
            ? {
                ...slide,
                error: contentRunVisibleErrorMessage(error),
                errorLogPath: diagnostic.filePath,
                status: "failed"
              }
            : slide);
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
          message: contentRunVisibleErrorMessage(error),
          ok: false,
          operation: "regenerate-presentation",
          presentationId: body.presentationId,
          stage: "failed",
          status: "failed"
        });
        publishRuntimeState();
      }
    };

    runGeneration();
  }

  async function handlePresentationDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    assertBaseVersion(getPresentationVersion(body.presentationId), body.baseVersion, "Presentation");
    requestContentRunStopForDeletedPresentation(body.presentationId);
    deletePresentation(body.presentationId);
    resetPresentationRuntime();
    createJsonResponse(res, 200, createPresentationPayload());
  }

  function handlePresentationsIndex(res: ServerResponse): void {
    createJsonResponse(res, 200, listPresentations());
  }

  return {
    handlePresentationCreate,
    handlePresentationDelete,
    handlePresentationDuplicate,
    handlePresentationRegenerate,
    handlePresentationSelect,
    handlePresentationsIndex
  };
}
