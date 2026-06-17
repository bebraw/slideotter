import {
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
import { searchCreationImagesAsMaterials } from "./creation-image-search.ts";
import { attachWebSourcesToCreationFields } from "./creation-source-fields.ts";
import { assertGeneratedSlideFitsDom } from "./content-run-slide-validation.ts";
import { contentRunVisibleErrorMessage } from "./content-run-visible-errors.ts";
import { createContentRunProgressHandlers } from "./creation-content-run-progress.ts";
import { inferCreationTitle } from "./creation-title.ts";
import { writeGenerationErrorDiagnostic } from "./services/generation-diagnostics.ts";
import { createMaterialFromDataUrl, createMaterialFromRemoteImage } from "./services/material-creation.ts";
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
import { createSource, sanitizeSourceRetrievalForRuntime } from "./services/sources.ts";
import type { ContentRunHelpers } from "./creation-content-run-helpers.ts";
import type {
  ContentRunPatch,
  CreationFields,
  CreationContentRunHandlerDependencies,
  GeneratedPartialSlidePayload,
  GenerationDraftFields,
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

type DraftGenerationRunParams = {
  contentRunState: (next: ContentRunPatch) => unknown;
  deckPlan: JsonObject;
  errorCode: (error: unknown) => string;
  isContentRunSlide: ContentRunHelpers["isContentRunSlide"];
  isContentRunState: ContentRunHelpers["isContentRunState"];
  isJsonObject: (value: unknown) => value is JsonObject;
  isMaterialPayload: ContentRunHelpers["isMaterialPayload"];
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  livePlaceholderDeck: {
    slideContexts: JsonObject;
    slideSpecs: SlideSpecPayload[];
  };
  presentation: {
    id: string;
  };
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  reportProgress: (progress: JsonObject) => void;
  resolvedFields: CreationFields;
  runtimeState: CreationContentRunCreateHandlerDependencies["runtimeState"];
  runId: string;
  shouldStop: () => boolean;
  slideCount: number;
  starterGenerationMaterials: MaterialPayload[];
  starterSourceText: unknown;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

type DraftLiveDeckState = {
  liveSlideContexts: JsonObject;
  liveSlideSpecs: JsonObject[];
  materialUrlById: Map<string, unknown>;
  publishLiveDeck: () => void;
};

type DraftCreateContext = {
  approvedOutline: boolean;
  current: JsonObject;
  deckPlan: JsonObject & { slides: unknown[] };
  resolvedFields: CreationFields;
  starterMaterials: StarterMaterialPayload[];
  starterSourceText: unknown;
};

async function importStarterSource(presentationId: string, starterSourceText: unknown): Promise<void> {
  if (!starterSourceText) {
    return;
  }

  await createSource({
    presentationId,
    text: starterSourceText,
    title: "Starter sources"
  });
}

function importStarterMaterials(presentationId: string, materials: MaterialPayload[]): MaterialPayload[] {
  return materials
    .filter((material) => Boolean(material.dataUrl))
    .map((material) => createMaterialFromDataUrl({
      alt: material.alt,
      caption: material.caption,
      dataUrl: material.dataUrl,
      fileName: material.fileName,
      id: material.id,
      presentationId,
      title: material.title
    }));
}

async function importSearchedMaterials(presentationId: string, materials: MaterialPayload[]): Promise<MaterialPayload[]> {
  const importedMaterials: MaterialPayload[] = [];
  for (const material of materials) {
    try {
      importedMaterials.push(await createMaterialFromRemoteImage({
        alt: material.alt,
        caption: material.caption,
        creator: material.creator,
        id: material.id,
        license: material.license,
        licenseUrl: material.licenseUrl,
        presentationId,
        provider: material.provider,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      }));
    } catch (error) {
      // Continue with other search images.
    }
  }

  return importedMaterials;
}

function createMaterialUrlMap(importedMaterials: MaterialPayload[]): Map<string, unknown> {
  return new Map(importedMaterials.map((material) => [String(material.id || ""), material.url]));
}

function createPendingContentRunSlides(slideCount: number): ContentRunPatch[] {
  return Array.from({ length: slideCount }, () => ({
    error: null,
    slideContext: null,
    slideSpec: null,
    status: "pending"
  }));
}

async function resolveDraftCreateContext(params: {
  body: JsonObject;
  current: JsonObject;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  normalizeCreationFields: CreationContentRunCreateHandlerDependencies["normalizeCreationFields"];
}): Promise<DraftCreateContext> {
  const fields = params.normalizeCreationFields({
    ...(params.current.fields || {}),
    ...(params.body.fields || {})
  });
  const deckPlan = params.jsonObjectOrEmpty(params.body.deckPlan || params.current.deckPlan);
  const creationTitle = inferCreationTitle(fields, deckPlan, "");
  const resolvedFields: CreationFields = {
    ...fields,
    title: creationTitle
  };
  const generationFields = await attachWebSourcesToCreationFields(resolvedFields);
  return {
    approvedOutline: params.body.approvedOutline === true || params.current.approvedOutline === true,
    current: params.current,
    deckPlan: { ...deckPlan, slides: Array.isArray(deckPlan.slides) ? deckPlan.slides : [] },
    resolvedFields,
    starterMaterials: Array.isArray(params.body.presentationMaterials) ? params.body.presentationMaterials : [],
    starterSourceText: generationFields.presentationSourceText
  };
}

function assertDraftCreateContext(context: DraftCreateContext): void {
  if (!context.resolvedFields.title) {
    throw new Error("Expected a presentation title before creating slides");
  }
  if (!context.approvedOutline) {
    throw new Error("Approve the generated outline before creating slides");
  }
  if (context.current.outlineDirty) {
    throw new Error("Regenerate the outline after changing the brief before creating slides");
  }
  if (!context.deckPlan.slides.length) {
    throw new Error("Expected an approved outline before creating slides");
  }
}

function createDraftPlaceholderPresentation(context: DraftCreateContext, livePlaceholderDeck: {
  slideContexts: JsonObject;
  slideSpecs: SlideSpecPayload[];
}): { id: string } {
  const slideCount = context.deckPlan.slides.length;
  const presentation = createPresentation({
    ...context.resolvedFields,
    createDefaultFlow: false,
    initialSlideSpecs: livePlaceholderDeck.slideSpecs,
    outline: context.deckPlan.outline || "",
    targetSlideCount: context.resolvedFields.targetSlideCount || slideCount,
    title: context.resolvedFields.title
  });
  createOutlinePlanFromDeckPlan(presentation.id, context.deckPlan, {
    audience: context.resolvedFields["audience"],
    name: "Approved creation outline",
    objective: context.resolvedFields["objective"],
    presentationDensity: context.resolvedFields.presentationDensity,
    purpose: context.resolvedFields["objective"],
    targetSlideCount: slideCount,
    title: context.resolvedFields.title,
    tone: context.resolvedFields["tone"]
  });
  setActivePresentation(presentation.id);
  regeneratePresentationSlides(presentation.id, livePlaceholderDeck.slideSpecs, {
    outline: context.deckPlan.outline || "",
    slideContexts: livePlaceholderDeck.slideContexts,
    targetSlideCount: slideCount
  });
  return presentation;
}

function saveDraftContentRun(context: DraftCreateContext, presentationId: string, runId: string): JsonObject {
  const timestamp = new Date().toISOString();
  const slideCount = context.deckPlan.slides.length;
  return savePresentationCreationDraft({
    ...context.current,
    approvedOutline: true,
    contentRun: {
      completed: 0,
      failedSlideIndex: null,
      id: runId,
      slideCount,
      slides: createPendingContentRunSlides(slideCount),
      startedAt: timestamp,
      status: "running",
      updatedAt: timestamp
    },
    createdPresentationId: presentationId,
    deckPlan: context.deckPlan,
    fields: context.resolvedFields,
    outlineDirty: false,
    stage: "content"
  });
}

function createPresentationDraftCreateHandler(deps: CreationContentRunCreateHandlerDependencies) {
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
    isContentRunSlide,
    isContentRunState,
    isMaterialPayload,
    slugify
  } = helpers;

  function createStarterGenerationMaterials(starterMaterials: StarterMaterialPayload[]): MaterialPayload[] {
    return starterMaterials.map((material: StarterMaterialPayload, index: number) => {
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
  }

  function createContentRunStateUpdater(runId: string): (next: ContentRunPatch) => unknown {
    return (next: ContentRunPatch): unknown => {
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
  }

  function createStopChecker(runId: string): () => boolean {
    return (): boolean => {
      const latest = getPresentationCreationDraft();
      const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
      return Boolean(run && run.id === runId && run.stopRequested === true);
    };
  }

  return async function handlePresentationDraftCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const draftContext = await resolveDraftCreateContext({ body, current, jsonObjectOrEmpty, normalizeCreationFields });
    assertDraftCreateContext(draftContext);

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

    const slideCount = draftContext.deckPlan.slides.length;
    const runId = `content-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const livePlaceholderDeck = createLiveContentRunPlaceholderDeck(draftContext.deckPlan);
    const presentation = createDraftPlaceholderPresentation(draftContext, livePlaceholderDeck);
    const draft = saveDraftContentRun(draftContext, presentation.id, runId);
    publishCreationDraftUpdate(draft);

    createJsonResponse(res, 202, {
      creationDraft: draft,
      presentation: readPresentationSummary(presentation.id),
      runtime: serializeRuntimeState()
    });

    const starterGenerationMaterials = createStarterGenerationMaterials(draftContext.starterMaterials);
    void runPresentationDraftGeneration({
      contentRunState: createContentRunStateUpdater(runId),
      deckPlan: draftContext.deckPlan,
      errorCode,
      isContentRunSlide,
      isContentRunState,
      isJsonObject,
      isMaterialPayload,
      jsonObjectOrEmpty,
      livePlaceholderDeck,
      presentation,
      publishCreationDraftUpdate,
      publishRuntimeState,
      reportProgress,
      resolvedFields: draftContext.resolvedFields,
      runtimeState,
      runId,
      shouldStop: createStopChecker(runId),
      slideCount,
      starterGenerationMaterials,
      starterSourceText: draftContext.starterSourceText,
      updateWorkflowState
    });
  };
}

async function runPresentationDraftGeneration(params: DraftGenerationRunParams): Promise<void> {
  try {
    const { generationMaterials, liveDeck } = await prepareDraftGeneration(params);

    params.contentRunState({
      materials: generationMaterials,
      sourceCount: params.starterSourceText ? 1 : 0
    });

    const draftFields: GenerationDraftFields = {
      ...params.resolvedFields,
      includeActiveMaterials: false,
      includeActiveSources: true,
      onProgress: undefined,
      presentationMaterials: generationMaterials,
      presentationSourceText: ""
    };

    const { reportProgressWithRun, setSlideState } = createContentRunProgressHandlers({
      contentRunState: params.contentRunState,
      isContentRunSlide: params.isContentRunSlide,
      isContentRunState: params.isContentRunState,
      reportProgress: params.reportProgress,
      requireProgressSlideCount: true,
      runId: params.runId,
      slideCount: params.slideCount
    });

    draftFields.onProgress = reportProgressWithRun;

    const generated = await generatePresentationFromDeckPlanIncremental(draftFields, params.deckPlan, {}, {
      onSlide: (payload: unknown) => handleDraftGeneratedSlide(payload, params, liveDeck, setSlideState),
      shouldStop: params.shouldStop
    });

    finalizeDraftGeneration(generated, params, liveDeck.materialUrlById);
  } catch (error) {
    handlePresentationDraftGenerationFailure(error, params);
  }
}

async function prepareDraftGeneration(params: DraftGenerationRunParams): Promise<{ generationMaterials: MaterialPayload[]; liveDeck: DraftLiveDeckState }> {
  const imageSearch = await searchCreationImagesAsMaterials(params.resolvedFields);
  const searchedMaterials = imageSearch.materials.filter(params.isMaterialPayload);
  const generationMaterials = [
    ...params.starterGenerationMaterials,
    ...searchedMaterials
  ];

  await importStarterSource(params.presentation.id, params.starterSourceText);
  const importedMaterials = [
    ...importStarterMaterials(params.presentation.id, params.starterGenerationMaterials),
    ...await importSearchedMaterials(params.presentation.id, searchedMaterials)
  ];

  const materialUrlById = createMaterialUrlMap(importedMaterials);
  const liveSlideSpecs = params.livePlaceholderDeck.slideSpecs.map((slideSpec) => ({ ...slideSpec }));
  const liveSlideContexts: JsonObject = { ...params.livePlaceholderDeck.slideContexts };
  return {
    generationMaterials,
    liveDeck: {
      liveSlideContexts,
      liveSlideSpecs,
      materialUrlById,
      publishLiveDeck: () => {
        regeneratePresentationSlides(params.presentation.id, liveSlideSpecs.map((slideSpec) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById)), {
          outline: params.deckPlan.outline || "",
          slideContexts: liveSlideContexts,
          targetSlideCount: params.slideCount
        });
      }
    }
  };
}

async function handleDraftGeneratedSlide(
  payload: unknown,
  params: DraftGenerationRunParams,
  liveDeck: DraftLiveDeckState,
  setSlideState: (index: number, next: ContentRunPatch) => unknown
): Promise<void> {
  const partial = params.jsonObjectOrEmpty(payload) as GeneratedPartialSlidePayload;
  const slideIndex = Number(partial.slideIndex);
  const slideCountProgress = Number(partial.slideCount);
  const slideIndexZero = slideIndex - 1;
  const validatedSpec = params.jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
  await assertGeneratedSlideFitsDom(slideIndex, validatedSpec);
  const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
  const partialContexts = params.isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
  const partialContext = partialContexts[contextKey] || null;
  liveDeck.liveSlideSpecs[slideIndexZero] = validatedSpec;
  liveDeck.liveSlideContexts[contextKey] = partialContext || liveDeck.liveSlideContexts[contextKey] || {};
  liveDeck.publishLiveDeck();
  setSlideState(slideIndexZero, {
    slideContext: partialContext,
    slideSpec: validatedSpec,
    status: "complete"
  });
  params.reportProgress({
    message: `Completed slide ${slideIndex}/${slideCountProgress}.`,
    slideCount: slideCountProgress,
    slideIndex,
    stage: "completed-slide"
  });
}

function finalizeDraftGeneration(generated: JsonObject, params: DraftGenerationRunParams, materialUrlById: Map<string, unknown>): void {
  params.reportProgress({
    message: "Finalizing generated slides into deck files...",
    stage: "finalizing"
  });
  setActivePresentation(params.presentation.id);
  const slideSpecs = Array.isArray(generated.slideSpecs)
    ? generated.slideSpecs.map((slideSpec: unknown) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById))
    : [];
  regeneratePresentationSlides(params.presentation.id, slideSpecs, {
    outline: generated.outline,
    slideContexts: generated.slideContexts,
    targetSlideCount: generated.targetSlideCount
  });
  params.publishCreationDraftUpdate(savePresentationCreationDraft({
    ...getPresentationCreationDraft(),
    contentRun: null,
    createdPresentationId: params.presentation.id,
    stage: "structure"
  }));
  params.updateWorkflowState({
    generation: generated.generation,
    message: [generated.summary, "Created from an approved outline."].filter(Boolean).join(" "),
    ok: true,
    operation: "create-presentation-from-outline",
    stage: "completed",
    status: "completed"
  });
  params.runtimeState.lastError = null;
  params.runtimeState.sourceRetrieval = sanitizeSourceRetrievalForRuntime(generated.retrieval);
  params.publishRuntimeState();
  params.publishCreationDraftUpdate(clearPresentationCreationDraft());
}

function handlePresentationDraftGenerationFailure(error: unknown, params: DraftGenerationRunParams): void {
  const latest = getPresentationCreationDraft();
  const run = params.isJsonObject(latest) && params.isContentRunState(latest.contentRun) && latest.contentRun.id === params.runId ? latest.contentRun : null;
  if (params.errorCode(error) === "CONTENT_RUN_STOPPED" || run?.stopRequested === true) {
    handleStoppedDraftGeneration(latest, run, params);
    return;
  }

  if (run && Array.isArray(run.slides)) {
    recordFailedDraftGeneration(error, latest, { ...run, slides: run.slides }, params);
  }

  params.updateWorkflowState({
    message: contentRunVisibleErrorMessage(error),
    ok: false,
    operation: "create-presentation-from-outline",
    stage: "failed",
    status: "failed"
  });
  params.publishRuntimeState();
}

function handleStoppedDraftGeneration(latest: JsonObject, run: JsonObject | null, params: DraftGenerationRunParams): void {
  if (run && Array.isArray(run.slides)) {
    params.publishCreationDraftUpdate(savePresentationCreationDraft({
      ...latest,
      contentRun: {
        ...run,
        status: "stopped",
        stopRequested: false,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  params.updateWorkflowState({
    message: "Slide generation stopped. Completed slides are kept.",
    ok: false,
    operation: "create-presentation-from-outline",
    stage: "stopped",
    status: "stopped"
  });
  params.publishRuntimeState();
}

function recordFailedDraftGeneration(
  error: unknown,
  latest: JsonObject,
  run: JsonObject & { slides: unknown[] },
  params: DraftGenerationRunParams
): void {
  const slides = run.slides.filter(params.isContentRunSlide);
  const firstIncomplete = slides.findIndex((slide) => slide.status !== "complete");
  const failedIndex = firstIncomplete >= 0 ? firstIncomplete : null;
  const diagnostic = writeGenerationErrorDiagnostic(error, {
    deckTitle: params.resolvedFields.title,
    operation: "create-presentation-from-outline",
    planSlide: failedIndex === null || !Array.isArray(params.deckPlan.slides) ? null : params.deckPlan.slides[failedIndex] || null,
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
      slides: slides.map((slide, index) => failedIndex === index
        ? { ...slide, error: contentRunVisibleErrorMessage(error), errorLogPath: diagnostic.filePath, status: "failed" }
        : slide),
      status: "failed",
      updatedAt: new Date().toISOString()
    }
  }));
}

export { createPresentationDraftCreateHandler };
