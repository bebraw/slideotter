import * as http from "http";

import { assertBaseVersion, getPresentationVersion } from "./services/hypermedia.ts";
import { assertGeneratedSlideFitsDom } from "./content-run-slide-validation.ts";
import { contentRunVisibleErrorMessage } from "./content-run-visible-errors.ts";
import { importImageSearchResults } from "./services/image-search.ts";
import { createMaterialFromDataUrl } from "./services/material-creation.ts";
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

type PresentationRebuildGenerationParams = {
  contentRunState: (next: JsonObject) => unknown;
  deck: JsonObject;
  deckPlan: JsonObject;
  deckPlanSlides: JsonObject[];
  errorCode: (value: unknown) => string;
  isContentRunSlide: (value: unknown) => value is ContentRunSlide;
  isJsonObject: (value: unknown) => value is JsonObject;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  latestPlan: JsonObject | null;
  livePlaceholderDeck: {
    slideContexts: JsonObject;
    slideSpecs: JsonObject[];
  };
  presentationId: string;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  reportProgress: (progress: JsonObject) => void;
  runtimeState: RuntimeStateAccess;
  runId: string;
  setSlideState: (index: number, next: ContentRunSlide) => unknown;
  shouldStop: () => boolean;
  slideCount: number;
  targetSlideCount: unknown;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

type PresentationRebuildContext = {
  deck: JsonObject;
  deckPlan: JsonObject;
  deckPlanSlides: JsonObject[];
  latestPlan: JsonObject | null;
  presentationId: string;
  targetSlideCount: unknown;
};

type PresentationCreateArtifacts = {
  imageSearchResult: Awaited<ReturnType<typeof importImageSearchResults>> | null;
  starterMaterials: StarterMaterialPayload[];
  starterSourceText: string;
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

function getStarterSourceText(fields: JsonObject): string {
  return typeof fields.presentationSourceText === "string"
    ? fields.presentationSourceText.trim()
    : "";
}

function getStarterMaterials(fields: JsonObject): StarterMaterialPayload[] {
  return Array.isArray(fields.presentationMaterials)
    ? fields.presentationMaterials.filter(isStarterMaterialPayload)
    : [];
}

async function createStarterSource(starterSourceText: string): Promise<void> {
  if (!starterSourceText) {
    return;
  }

  await createSource({
    text: starterSourceText,
    title: "Starter sources"
  });
}

function createStarterMaterials(starterMaterials: StarterMaterialPayload[]): void {
  starterMaterials.forEach((material: StarterMaterialPayload) => {
    createMaterialFromDataUrl({
      alt: material.alt || material.title || material.fileName,
      caption: material.caption || "",
      dataUrl: material.dataUrl,
      fileName: material.fileName || material.title || "starter-image",
      title: material.title || material.fileName || "Starter image"
    });
  });
}

async function importRequestedImageSearch(fields: JsonObject): Promise<Awaited<ReturnType<typeof importImageSearchResults>> | null> {
  if (!isImageSearchPayload(fields.imageSearch) || !String(fields.imageSearch.query || "").trim()) {
    return null;
  }

  return importImageSearchResults({
    count: fields.imageSearch.count,
    provider: fields.imageSearch.provider,
    query: fields.imageSearch.query,
    restrictions: fields.imageSearch.restrictions
  });
}

async function createPresentationArtifacts(fields: JsonObject): Promise<PresentationCreateArtifacts> {
  const starterSourceText = getStarterSourceText(fields);
  const starterMaterials = getStarterMaterials(fields);
  await createStarterSource(starterSourceText);
  createStarterMaterials(starterMaterials);
  return {
    imageSearchResult: await importRequestedImageSearch(fields),
    starterMaterials,
    starterSourceText
  };
}

function createPresentationCompletionMessage(
  generated: JsonObject,
  artifacts: PresentationCreateArtifacts
): string {
  const imageSearchResult = artifacts.imageSearchResult;
  return [
    generated.summary,
    artifacts.starterSourceText ? "Starter sources were saved with the new presentation." : "",
    artifacts.starterMaterials.length ? `${artifacts.starterMaterials.length} starter image${artifacts.starterMaterials.length === 1 ? "" : "s"} were saved with the new presentation.` : "",
    imageSearchResult && imageSearchResult.imported.length ? `${imageSearchResult.imported.length} searched image${imageSearchResult.imported.length === 1 ? "" : "s"} were imported from ${imageSearchResult.providerLabel || imageSearchResult.provider}.` : ""
  ].filter(Boolean).join(" ");
}

function createFallbackRebuildDeckPlan(
  context: JsonObject,
  deck: JsonObject,
  jsonObjectOrEmpty: (value: unknown) => JsonObject
): JsonObject {
  return {
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
}

function createPendingContentRunSlides(slideCount: number): ContentRunSlide[] {
  return Array.from({ length: slideCount }, () => ({
    error: null,
    slideContext: null,
    slideSpec: null,
    status: "pending"
  }));
}

function resolvePresentationRebuildContext(
  body: JsonObject,
  jsonObjectOrEmpty: (value: unknown) => JsonObject
): PresentationRebuildContext {
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  const presentationId = body.presentationId;
  const context = readPresentationDeckContext(presentationId);
  const deck = jsonObjectOrEmpty(context && context.deck);
  const lengthProfile = jsonObjectOrEmpty(deck.lengthProfile);
  const targetSlideCount = body.targetSlideCount
    ?? lengthProfile.targetCount
    ?? body.targetCount;
  const savedPlans = listOutlinePlans(presentationId);
  const latestPlan = savedPlans[savedPlans.length - 1] || null;
  const deckPlan = latestPlan
    ? outlinePlanToDeckPlan(latestPlan)
    : createFallbackRebuildDeckPlan(context, deck, jsonObjectOrEmpty);
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isJsonObject) : [];
  if (!deckPlanSlides.length) {
    throw new Error("Expected saved slide context before rebuilding presentation");
  }

  return { deck, deckPlan, deckPlanSlides, latestPlan, presentationId, targetSlideCount };
}

function publishLiveRebuildPlaceholder(presentationId: string, deckPlan: JsonObject, slideCount: number): {
  slideContexts: JsonObject;
  slideSpecs: JsonObject[];
} {
  const livePlaceholderDeck = createLiveContentRunPlaceholderDeck(deckPlan);
  regeneratePresentationSlides(presentationId, livePlaceholderDeck.slideSpecs, {
    outline: livePlaceholderDeck.slideSpecs.map((slide, index) => `${index + 1}. ${String(slide.title || `Slide ${index + 1}`)}`).join("\n"),
    slideContexts: livePlaceholderDeck.slideContexts,
    targetSlideCount: slideCount
  });
  return livePlaceholderDeck;
}

function savePresentationRebuildDraft(params: {
  deck: JsonObject;
  deckPlan: JsonObject;
  presentationId: string;
  runId: string;
  slideCount: number;
  targetSlideCount: unknown;
}): JsonObject {
  const timestamp = new Date().toISOString();
  return savePresentationCreationDraft({
    approvedOutline: true,
    contentRun: {
      completed: 0,
      failedSlideIndex: null,
      id: params.runId,
      slideCount: params.slideCount,
      slides: createPendingContentRunSlides(params.slideCount),
      startedAt: timestamp,
      status: "running",
      updatedAt: timestamp
    },
    createdPresentationId: params.presentationId,
    deckPlan: params.deckPlan,
    fields: {
      ...params.deck,
      targetSlideCount: params.targetSlideCount || params.slideCount,
      title: params.deck.title || readPresentationSummary(params.presentationId).title || params.presentationId
    },
    outlineDirty: false,
    stage: "content"
  });
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

      const artifacts = await createPresentationArtifacts(fields);
      const generated = await generateInitialPresentation({
        ...fields,
        includeActiveMaterials: true,
        includeActiveSources: true,
        onProgress: reportProgress,
        presentationSourceText: artifacts.starterSourceText
      });
      presentation = regeneratePresentationSlides(presentation.id, generated.slideSpecs, {
        outline: generated.outline,
        slideContexts: generated.slideContexts,
        targetSlideCount: generated.targetSlideCount
      });
      setActivePresentation(presentation.id);
      updateWorkflowState({
        generation: generated.generation,
        message: createPresentationCompletionMessage(generated, artifacts),
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

  function createContentRunStateUpdater(runId: string): (next: JsonObject) => unknown {
    return (next: JsonObject): unknown => {
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
  }

  function createStopChecker(runId: string): () => boolean {
    return (): boolean => {
      const latest = getPresentationCreationDraft();
      const run = isJsonObject(latest.contentRun) ? latest.contentRun : null;
      return Boolean(run && run.id === runId && run.stopRequested === true);
    };
  }

  function createSlideStateSetter(
    runId: string,
    contentRunState: (next: JsonObject) => unknown
  ): (index: number, next: ContentRunSlide) => unknown {
    return (index: number, next: ContentRunSlide): unknown => {
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
    const rebuild = resolvePresentationRebuildContext(body, jsonObjectOrEmpty);

    setActivePresentation(rebuild.presentationId);
    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "regenerate-presentation",
      presentationId: rebuild.presentationId
    });
    reportProgress({
      message: "Preparing live rebuild placeholders...",
      stage: "drafting-slides"
    });

    const slideCount = rebuild.deckPlanSlides.length;
    const runId = `rebuild-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const livePlaceholderDeck = publishLiveRebuildPlaceholder(rebuild.presentationId, rebuild.deckPlan, slideCount);
    const draft = savePresentationRebuildDraft({
      deck: rebuild.deck,
      deckPlan: rebuild.deckPlan,
      presentationId: rebuild.presentationId,
      runId,
      slideCount,
      targetSlideCount: rebuild.targetSlideCount
    });
    publishCreationDraftUpdate(draft);
    publishRuntimeState();
    createJsonResponse(res, 202, createPresentationPayload({
      creationDraft: draft,
      presentation: readPresentationSummary(rebuild.presentationId)
    }));

    const contentRunState = createContentRunStateUpdater(runId);
    void runPresentationRebuildGeneration({
      contentRunState,
      deck: rebuild.deck,
      deckPlan: rebuild.deckPlan,
      deckPlanSlides: rebuild.deckPlanSlides,
      errorCode,
      isContentRunSlide,
      isJsonObject,
      jsonObjectOrEmpty,
      latestPlan: rebuild.latestPlan,
      livePlaceholderDeck,
      presentationId: rebuild.presentationId,
      publishCreationDraftUpdate,
      publishRuntimeState,
      reportProgress,
      runtimeState,
      runId,
      setSlideState: createSlideStateSetter(runId, contentRunState),
      shouldStop: createStopChecker(runId),
      slideCount,
      targetSlideCount: rebuild.targetSlideCount,
      updateWorkflowState
    });
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

async function runPresentationRebuildGeneration(params: PresentationRebuildGenerationParams): Promise<void> {
  const liveSlideSpecs = params.livePlaceholderDeck.slideSpecs.map((slideSpec) => ({ ...slideSpec }));
  const liveSlideContexts: JsonObject = { ...params.livePlaceholderDeck.slideContexts };
  const publishLiveDeck = (): void => {
    regeneratePresentationSlides(params.presentationId, liveSlideSpecs, {
      outline: String(params.deckPlan.outline || "") || liveSlideSpecs.map((slide, index) => `${index + 1}. ${String(slide.title || `Slide ${index + 1}`)}`).join("\n"),
      slideContexts: liveSlideContexts,
      targetSlideCount: params.slideCount
    });
  };

  try {
    const generationFields = {
      ...params.deck,
      includeActiveMaterials: true,
      includeActiveSources: true,
      onProgress: createPresentationRebuildProgressHandler(params),
      presentationDensity: params.latestPlan && params.latestPlan.presentationDensity || "balanced",
      targetSlideCount: params.targetSlideCount || params.slideCount
    };

    const generated = await generatePresentationFromDeckPlanIncremental(generationFields, params.deckPlan, {}, {
      onSlide: async (payload: unknown): Promise<void> => {
        const partial = params.jsonObjectOrEmpty(payload);
        const slideIndex = Number(partial.slideIndex);
        const slideCountProgress = Number(partial.slideCount);
        const slideIndexZero = slideIndex - 1;
        const validatedSpec = params.jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
        await assertGeneratedSlideFitsDom(slideIndex, validatedSpec);
        const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
        const partialContexts = params.isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
        const partialContext = partialContexts[contextKey] || null;
        liveSlideSpecs[slideIndexZero] = validatedSpec;
        liveSlideContexts[contextKey] = params.isJsonObject(partialContext)
          ? partialContext
          : liveSlideContexts[contextKey] || {};
        publishLiveDeck();
        params.setSlideState(slideIndexZero, {
          slideContext: liveSlideContexts[contextKey],
          slideSpec: validatedSpec,
          status: "complete"
        });
        params.reportProgress({
          message: `Completed slide ${slideIndex}/${slideCountProgress}.`,
          presentationId: params.presentationId,
          slideCount: slideCountProgress,
          slideIndex,
          stage: "completed-slide"
        });
      },
      shouldStop: params.shouldStop
    });

    params.reportProgress({
      message: "Finalizing rebuilt slides into deck files...",
      stage: "finalizing"
    });

    setActivePresentation(params.presentationId);
    regeneratePresentationSlides(params.presentationId, generated.slideSpecs, {
      outline: generated.outline,
      slideContexts: generated.slideContexts,
      targetSlideCount: generated.targetSlideCount
    });

    const nextDraft = savePresentationCreationDraft({
      ...getPresentationCreationDraft(),
      contentRun: null,
      createdPresentationId: params.presentationId,
      stage: "structure"
    });
    params.publishCreationDraftUpdate(nextDraft);

    params.updateWorkflowState({
      generation: generated.generation,
      message: `Rebuilt ${generated.slideSpecs.length} slide${generated.slideSpecs.length === 1 ? "" : "s"} from the saved presentation context, replacing the previous slide files.`,
      ok: true,
      operation: "regenerate-presentation",
      presentationId: params.presentationId,
      stage: "completed",
      status: "completed"
    });
    params.runtimeState.lastError = null;
    params.runtimeState.sourceRetrieval = sanitizeSourceRetrievalForRuntime(generated.retrieval);
    params.publishRuntimeState();
  } catch (error) {
    handlePresentationRebuildFailure(error, params);
  }
}

function createPresentationRebuildProgressHandler(params: PresentationRebuildGenerationParams): (progress: JsonObject) => void {
  return (progress: JsonObject): void => {
    const slideIndex = Number(progress.slideIndex);
    if (
      progress.stage === "drafting-slide"
      && Number.isFinite(slideIndex)
      && slideIndex >= 1
      && slideIndex <= params.slideCount
    ) {
      params.setSlideState(slideIndex - 1, { status: "generating", error: null });
    }

    params.reportProgress({
      ...progress,
      stage: typeof progress.stage === "string" ? progress.stage : "running"
    });
  };
}

function handleStoppedPresentationRebuild(latest: JsonObject, run: JsonObject | null, params: PresentationRebuildGenerationParams): void {
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
    params.publishCreationDraftUpdate(nextDraft);
  }

  params.updateWorkflowState({
    message: "Presentation rebuild stopped. Completed slides are kept.",
    ok: false,
    operation: "regenerate-presentation",
    presentationId: params.presentationId,
    stage: "stopped",
    status: "stopped"
  });
  params.publishRuntimeState();
}

function recordFailedPresentationRebuild(error: unknown, latest: JsonObject, run: JsonObject, params: PresentationRebuildGenerationParams): void {
  if (!Array.isArray(run.slides)) {
    return;
  }

  const slides = run.slides.filter(params.isContentRunSlide);
  const firstIncomplete = slides.findIndex((slide) => slide.status !== "complete");
  const failedIndex = firstIncomplete >= 0 ? firstIncomplete : null;
  const diagnostic = writeGenerationErrorDiagnostic(error, {
    deckTitle: String(params.deck.title || params.presentationId),
    operation: "regenerate-presentation",
    planSlide: failedIndex === null ? null : params.deckPlanSlides[failedIndex] || null,
    runId: params.runId,
    slideCount: params.slideCount,
    slideIndex: failedIndex,
    workflow: params.runtimeState.workflow
  });
  params.publishCreationDraftUpdate(savePresentationCreationDraft({
    ...latest,
    contentRun: {
      ...run,
      failedSlideIndex: failedIndex,
      slides: slides.map((slide, index) => index === failedIndex
        ? { ...slide, error: contentRunVisibleErrorMessage(error), errorLogPath: diagnostic.filePath, status: "failed" }
        : slide),
      status: "failed",
      updatedAt: new Date().toISOString()
    }
  }));
}

function handlePresentationRebuildFailure(error: unknown, params: PresentationRebuildGenerationParams): void {
  const latest = getPresentationCreationDraft();
  const run = params.isJsonObject(latest.contentRun) && latest.contentRun.id === params.runId ? latest.contentRun : null;
  if (params.errorCode(error) === "CONTENT_RUN_STOPPED" || run?.stopRequested === true) {
    handleStoppedPresentationRebuild(latest, run, params);
    return;
  }

  if (run) {
    recordFailedPresentationRebuild(error, latest, run, params);
  }

  params.updateWorkflowState({
    message: contentRunVisibleErrorMessage(error),
    ok: false,
    operation: "regenerate-presentation",
    presentationId: params.presentationId,
    stage: "failed",
    status: "failed"
  });
  params.publishRuntimeState();
}
