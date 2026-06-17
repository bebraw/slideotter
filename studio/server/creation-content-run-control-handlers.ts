import {
  importContentRunArtifacts,
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
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
import { buildPartialContentRunDeck } from "./services/creation-content-run-decks.ts";
import { createSource } from "./services/sources.ts";
import type { ContentRunHelpers } from "./creation-content-run-helpers.ts";
import type {
  ContentRunSlide,
  ContentRunState,
  CreationContentRunHandlerDependencies,
  CreationFields,
  DeckPlanPayload,
  DeckPlanSlide,
  JsonObject,
  ServerResponse,
  SlideSpecPayload
} from "./creation-content-run-types.ts";

type CreationContentRunControlHandlerDependencies = Pick<
  CreationContentRunHandlerDependencies,
  | "createJsonResponse"
  | "jsonObjectOrEmpty"
  | "normalizeCreationFields"
  | "publishCreationDraftUpdate"
  | "publishRuntimeState"
  | "resetPresentationRuntime"
  | "runtimeState"
  | "serializeRuntimeState"
  | "updateWorkflowState"
> & {
  helpers: ContentRunHelpers;
  isJsonObject: (value: unknown) => value is JsonObject;
};

type PartialContentRunDraft = {
  deckPlan: DeckPlanPayload;
  planSlides: DeckPlanSlide[];
  run: ContentRunState;
  runSlides: ContentRunSlide[];
};

type PartialContentRunDependencies = Pick<
  CreationContentRunControlHandlerDependencies,
  "isJsonObject" | "jsonObjectOrEmpty" | "normalizeCreationFields"
> & {
  helpers: Pick<
    ContentRunHelpers,
    "deckPlanSlides" | "isContentRunSlide" | "isContentRunState" | "isDeckPlanPayload" | "isSlideSpecPayload"
  >;
};

type PartialContentRunPresentationParams = {
  deckPlan: DeckPlanPayload;
  fields: CreationFields;
  planSlides: DeckPlanSlide[];
  run: ContentRunState;
};

type PartialContentRunPresentation = {
  finalSlideSpecs: SlideSpecPayload[];
  id: string;
  skippedCount: number;
};

function requirePartialContentRunDraft(current: unknown, deps: PartialContentRunDependencies): PartialContentRunDraft {
  const { deckPlanSlides, isContentRunSlide, isContentRunState, isDeckPlanPayload, isSlideSpecPayload } = deps.helpers;
  const deckPlan = deps.isJsonObject(current) && isDeckPlanPayload(current.deckPlan) ? current.deckPlan : null;
  const run = deps.isJsonObject(current) && isContentRunState(current.contentRun) ? current.contentRun : null;
  const planSlides = deckPlanSlides(deckPlan);
  const runSlides = run && Array.isArray(run.slides) ? run.slides.filter(isContentRunSlide) : [];

  if (!deckPlan || !planSlides.length) {
    throw new Error("Expected an approved outline before accepting a partial deck");
  }
  if (!run || !runSlides.length) {
    throw new Error("No content run is available to accept");
  }
  if (run.status === "running") {
    throw new Error("Stop generation before accepting a partial deck");
  }
  if (!runSlides.some((slide) => slide.status === "complete" && isSlideSpecPayload(slide.slideSpec))) {
    throw new Error("Accepting a partial deck requires at least one completed slide");
  }

  return {
    deckPlan,
    planSlides,
    run,
    runSlides
  };
}

function normalizedPartialContentRunFields(current: unknown, deps: PartialContentRunDependencies): CreationFields {
  return deps.normalizeCreationFields(deps.isJsonObject(current) ? deps.jsonObjectOrEmpty(current.fields) : {});
}

function createCreationContentRunControlHandlers(deps: CreationContentRunControlHandlerDependencies) {
  const {
    createJsonResponse,
    helpers,
    isJsonObject,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;
  async function createPartialContentRunPresentation(params: PartialContentRunPresentationParams): Promise<PartialContentRunPresentation> {
    const { deckPlan, fields, planSlides, run } = params;
    const { slideContexts, slideSpecs } = buildPartialContentRunDeck(run, deckPlan);
    const presentation = createPresentation({
      ...fields,
      createDefaultFlow: false,
      outline: deckPlan.outline || "",
      targetSlideCount: planSlides.length,
      title: fields.title || "slideotter"
    });
    createOutlinePlanFromDeckPlan(presentation.id, deckPlan, {
      audience: fields.audience,
      name: "Approved partial creation outline",
      objective: fields.objective,
      presentationDensity: fields.presentationDensity,
      purpose: fields.objective,
      targetSlideCount: planSlides.length,
      title: fields.title,
      tone: fields.tone
    });
    setActivePresentation(presentation.id);

    const materialUrlById = await importContentRunArtifacts(run, {
      createMaterialFromDataUrl: (material) => createMaterialFromDataUrl({
        ...material,
        presentationId: presentation.id
      }),
      createMaterialFromRemoteImage: (material) => createMaterialFromRemoteImage({
        ...material,
        presentationId: presentation.id
      }),
      createSource: (source) => createSource({
        ...source,
        presentationId: presentation.id
      })
    });
    const finalSlideSpecs = slideSpecs.map((slideSpec: SlideSpecPayload) => slideSpec.skipped
      ? slideSpec
      : replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById));
    regeneratePresentationSlides(presentation.id, finalSlideSpecs, {
      outline: deckPlan.outline || "",
      slideContexts,
      targetSlideCount: planSlides.length
    });

    const skippedCount = finalSlideSpecs.filter((slideSpec) => slideSpec.skipped === true).length;
    return {
      finalSlideSpecs,
      id: presentation.id,
      skippedCount
    };
  }

  function completePartialContentRunDraft(presentation: PartialContentRunPresentation): unknown {
    const nextDraft = savePresentationCreationDraft({
      ...getPresentationCreationDraft(),
      contentRun: null,
      createdPresentationId: presentation.id,
      stage: "content"
    });
    publishCreationDraftUpdate(nextDraft);

    updateWorkflowState({
      message: `Accepted ${presentation.finalSlideSpecs.length - presentation.skippedCount} completed slide${presentation.finalSlideSpecs.length - presentation.skippedCount === 1 ? "" : "s"} with ${presentation.skippedCount} skipped placeholder${presentation.skippedCount === 1 ? "" : "s"}.`,
      ok: true,
      operation: "accept-partial-presentation",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();
    const resetDraft = clearPresentationCreationDraft();
    publishCreationDraftUpdate(resetDraft);

    return resetDraft;
  }

  async function handlePresentationDraftContentAcceptPartial(res: ServerResponse): Promise<void> {
    const current = getPresentationCreationDraft();
    const { deckPlan, planSlides, run } = requirePartialContentRunDraft(current, {
      helpers,
      isJsonObject,
      jsonObjectOrEmpty,
      normalizeCreationFields
    });

    resetPresentationRuntime();
    updateWorkflowState({
      message: "Accepting completed slides and creating skipped placeholders...",
      ok: false,
      operation: "accept-partial-presentation",
      stage: "accepting-partial",
      status: "running"
    });

    const fields = normalizedPartialContentRunFields(current, {
      helpers,
      isJsonObject,
      jsonObjectOrEmpty,
      normalizeCreationFields
    });
    const presentation = await createPartialContentRunPresentation({
      deckPlan,
      fields,
      planSlides,
      run
    });
    const resetDraft = completePartialContentRunDraft(presentation);

    createJsonResponse(res, 200, {
      creationDraft: resetDraft,
      presentation: readPresentationSummary(presentation.id),
      runtime: serializeRuntimeState()
    });
  }

  async function handlePresentationDraftContentStop(res: ServerResponse): Promise<void> {
    const current = getPresentationCreationDraft();
    const run = jsonObjectOrEmpty(current && current.contentRun);
    if (!run || run.status !== "running") {
      createJsonResponse(res, 200, {
        creationDraft: current,
        runtime: serializeRuntimeState()
      });
      return;
    }

    const nextDraft = savePresentationCreationDraft({
      ...current,
      contentRun: {
        ...run,
        stopRequested: true,
        updatedAt: new Date().toISOString()
      }
    });
    publishCreationDraftUpdate(nextDraft);
    updateWorkflowState({
      message: "Stopping slide generation after the current slide...",
      ok: false,
      operation: runtimeState.workflow && runtimeState.workflow.operation || "create-presentation-from-outline",
      stage: "stopping",
      status: "running"
    });

    createJsonResponse(res, 202, {
      creationDraft: nextDraft,
      runtime: serializeRuntimeState()
    });
  }

  return {
    handlePresentationDraftContentAcceptPartial,
    handlePresentationDraftContentStop
  };
}

export { createCreationContentRunControlHandlers };
