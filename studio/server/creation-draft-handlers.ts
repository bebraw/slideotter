import * as http from "http";

import { normalizeOutlineLocks } from "../shared/outline-locks.ts";
import type { CreationFields, DeckPlanPayload, DeckPlanSlide, JsonObject } from "./api-payloads.ts";
import { isDeckPlanSlide } from "./api-payloads.ts";
import { searchCreationImagesAsMaterials } from "./creation-image-search.ts";
import { attachWebSourcesToCreationFields } from "./creation-source-fields.ts";
import { hasCreationBrief, inferCreationTitle } from "./creation-title.ts";
import { generateInitialDeckPlan } from "./services/presentation-generation.ts";
import {
  getPresentationCreationDraft,
  savePresentationCreationDraft
} from "./services/presentation-creation-draft.ts";
import { listSavedThemes } from "./services/presentation-theme-store.ts";
import { sanitizeSourceRetrievalForRuntime } from "./services/sources.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type CreationDraft = ReturnType<typeof getPresentationCreationDraft>;
type InitialDeckPlanResult = Awaited<ReturnType<typeof generateInitialDeckPlan>>;
type OutlineLocks = ReturnType<typeof normalizeOutlineLocks>;

type LockedOutlineContextOptions = {
  excludeIndex?: number;
};

type OutlineGenerationContext = {
  fields: CreationFields;
  lockedSlides: JsonObject[];
  outlineLocks: OutlineLocks;
  previousDeckPlan: DeckPlanPayload;
};

type OutlineSlideRequest = {
  current: CreationDraft;
  fields: CreationFields;
  slideIndex: number;
  slides: DeckPlanSlide[];
  sourceDeckPlan: DeckPlanPayload;
};

type RegeneratedOutlineSlide = {
  deckPlan: DeckPlanPayload;
  result: InitialDeckPlanResult;
};

type CreationDraftHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  deckPlanSlides: (plan: unknown) => DeckPlanSlide[];
  isDeckPlanPayload: (value: unknown) => value is DeckPlanPayload;
  isJsonObject: (value: unknown) => value is JsonObject;
  normalizeCreationFields: (body?: JsonObject) => CreationFields;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: {
    lastError: {
      message?: string;
      updatedAt?: string;
    } | null;
    sourceRetrieval: unknown;
  };
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function buildDeckPlanOutline(slides: unknown): string {
  return (Array.isArray(slides) ? slides : [])
    .filter(isDeckPlanSlide)
    .map((slide, index) => {
      const title = slide.title || `Slide ${index + 1}`;
      const message = slide.keyMessage || slide.intent || "";
      return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
    })
    .join("\n");
}

function getDeckPlanPayload(deps: CreationDraftHandlerDependencies, value: unknown): DeckPlanPayload {
  return deps.isDeckPlanPayload(value) ? value : {};
}

function applyLockedOutlineSlides(
  deps: CreationDraftHandlerDependencies,
  nextPlan: unknown,
  previousPlan: unknown,
  outlineLocks: unknown
): DeckPlanPayload {
  const nextDeckPlan = getDeckPlanPayload(deps, nextPlan);
  const previousDeckPlan = getDeckPlanPayload(deps, previousPlan);
  const nextSlides = deps.deckPlanSlides(nextDeckPlan);
  const previousSlides = deps.deckPlanSlides(previousDeckPlan);
  const locks = normalizeOutlineLocks(outlineLocks);
  if (!nextSlides.length || !previousSlides.length || !Object.keys(locks).length) {
    return nextDeckPlan;
  }

  const slides = nextSlides.map((slide: DeckPlanSlide, index: number) => {
    const base = locks[String(index)] && previousSlides[index]
      ? { ...previousSlides[index] }
      : slide;

    return {
      ...base,
      sourceNotes: base.sourceNotes || base.sourceText || base.sourceNeed || ""
    };
  });

  return {
    ...nextDeckPlan,
    outline: buildDeckPlanOutline(slides),
    slides
  };
}

function buildLockedOutlineContext(
  deps: CreationDraftHandlerDependencies,
  deckPlan: unknown,
  outlineLocks: unknown,
  options: LockedOutlineContextOptions = {}
): JsonObject[] {
  const slides = deps.deckPlanSlides(deckPlan);
  const locks = normalizeOutlineLocks(outlineLocks);
  return slides
    .map((slide: DeckPlanSlide, index: number) => ({ index, slide }))
    .filter(({ index }) => locks[String(index)] && index !== options.excludeIndex)
    .map(({ index, slide }) => buildLockedOutlineSlideContext(slide, index));
}

function buildLockedOutlineSlideContext(slide: DeckPlanSlide, index: number): JsonObject {
  return {
    index,
    intent: slideFieldOrEmpty(slide.intent),
    keyMessage: slideFieldOrEmpty(slide.keyMessage),
    role: slideFieldOrEmpty(slide.role),
    sourceNeed: slideFieldOrEmpty(slide.sourceNeed),
    sourceNotes: slideSourceNotes(slide),
    title: slideTitle(slide, index),
    type: slide.type || "content",
    value: slideFieldOrEmpty(slide.value),
    visualNeed: slideFieldOrEmpty(slide.visualNeed)
  };
}

function slideFieldOrEmpty(value: unknown): unknown {
  return value || "";
}

function slideSourceNotes(slide: DeckPlanSlide): unknown {
  return slide.sourceNotes || slide.sourceText || "";
}

function slideTitle(slide: DeckPlanSlide, index: number): unknown {
  return slide.title || `Slide ${index + 1}`;
}

function getUnmergedDeckPlan(
  baseDeckPlan: DeckPlanPayload,
  overrideDeckPlan: DeckPlanPayload,
  baseSlides: DeckPlanSlide[],
  overrideSlides: DeckPlanSlide[]
): DeckPlanPayload | null {
  if (!baseSlides.length) {
    return Object.keys(overrideDeckPlan).length ? overrideDeckPlan : baseDeckPlan;
  }
  if (!overrideSlides.length) {
    return baseDeckPlan;
  }

  return null;
}

function mergeDeckPlan(
  deps: CreationDraftHandlerDependencies,
  basePlan: unknown,
  overridePlan: unknown
): DeckPlanPayload {
  const baseDeckPlan = getDeckPlanPayload(deps, basePlan);
  const overrideDeckPlan = getDeckPlanPayload(deps, overridePlan);
  const baseSlides = deps.deckPlanSlides(baseDeckPlan);
  const overrideSlides = deps.deckPlanSlides(overrideDeckPlan);
  const unmergedPlan = getUnmergedDeckPlan(baseDeckPlan, overrideDeckPlan, baseSlides, overrideSlides);
  if (unmergedPlan) {
    return unmergedPlan;
  }

  const maxSlides = Math.max(baseSlides.length, overrideSlides.length);
  const slides = Array.from({ length: maxSlides }, (_unused, index) => ({
    ...(baseSlides[index] || {}),
    ...(overrideSlides[index] || {})
  }));

  return {
    ...baseDeckPlan,
    ...overrideDeckPlan,
    outline: overrideDeckPlan.outline || baseDeckPlan.outline || "",
    slides,
    thesis: overrideDeckPlan.thesis || baseDeckPlan.thesis || "",
    narrativeArc: overrideDeckPlan.narrativeArc || baseDeckPlan.narrativeArc || ""
  };
}

function booleanFieldOrFallback(value: unknown, fallback: unknown): unknown {
  return typeof value === "boolean" ? value : fallback;
}

function buildSavedCreationDraftFields(
  deps: CreationDraftHandlerDependencies,
  body: JsonObject,
  current: CreationDraft
): CreationFields {
  return {
    ...(current.fields || {}),
    ...deps.normalizeCreationFields(deps.isJsonObject(body.fields) ? body.fields : body)
  };
}

function buildSavedCreationDraft(
  deps: CreationDraftHandlerDependencies,
  body: JsonObject,
  current: CreationDraft
): CreationDraft {
  return savePresentationCreationDraft({
    ...current,
    approvedOutline: booleanFieldOrFallback(body.approvedOutline, current.approvedOutline),
    deckPlan: body.deckPlan || current.deckPlan,
    fields: buildSavedCreationDraftFields(deps, body, current),
    outlineLocks: body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks,
    outlineDirty: booleanFieldOrFallback(body.outlineDirty, current.outlineDirty),
    retrieval: body.retrieval || current.retrieval,
    stage: body.stage || current.stage || "brief"
  });
}

async function getGenerationFieldsWithMaterials(fields: CreationFields): Promise<CreationFields & { presentationMaterials: unknown[] }> {
  const generationFields = await attachWebSourcesToCreationFields(fields);
  const imageSearch = await searchCreationImagesAsMaterials(generationFields);
  return {
    ...generationFields,
    presentationMaterials: [
      ...(Array.isArray(generationFields.presentationMaterials) ? generationFields.presentationMaterials : []),
      ...imageSearch.materials
    ]
  };
}

function publishOutlineRuntimeState(
  deps: CreationDraftHandlerDependencies,
  retrieval: unknown
): void {
  deps.runtimeState.lastError = null;
  deps.runtimeState.sourceRetrieval = sanitizeSourceRetrievalForRuntime(retrieval);
  deps.publishRuntimeState();
}

function assertCreationBrief(fields: CreationFields, message: string): void {
  if (!hasCreationBrief(fields)) {
    throw new Error(message);
  }
}

function createOutlineReporter(
  deps: CreationDraftHandlerDependencies,
  operation: string,
  message: string,
  stage: string
): (progress: JsonObject) => void {
  const reportProgress = deps.createWorkflowProgressReporter({ operation });
  reportProgress({ message, stage });
  return reportProgress;
}

function getOutlineGenerationContext(
  deps: CreationDraftHandlerDependencies,
  body: JsonObject,
  current: CreationDraft
): OutlineGenerationContext {
  const fields = deps.normalizeCreationFields(deps.isJsonObject(body.fields) ? body.fields : body);
  assertCreationBrief(fields, "Describe the presentation before generating an outline");

  const previousDeckPlan = mergeDeckPlan(deps, current.deckPlan, body.deckPlan || current.deckPlan);
  const outlineLocks = normalizeOutlineLocks(body.outlineLocks || current.outlineLocks);
  const lockedSlides = buildLockedOutlineContext(deps, previousDeckPlan, outlineLocks);
  const previousSlides = deps.deckPlanSlides(previousDeckPlan);
  if (previousSlides.length && lockedSlides.length >= previousSlides.length) {
    throw new Error("Unlock at least one outline slide before regenerating.");
  }

  return {
    fields,
    lockedSlides,
    outlineLocks,
    previousDeckPlan
  };
}

function saveGeneratedOutlineDraft(
  fields: CreationFields,
  deckPlan: DeckPlanPayload,
  outlineLocks: OutlineLocks,
  retrieval: unknown
): CreationDraft {
  return savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan,
    fields: {
      ...fields,
      title: inferCreationTitle(fields, deckPlan, fields.title || "")
    },
    outlineLocks,
    outlineDirty: false,
    retrieval,
    stage: "structure"
  });
}

function getOutlineSlideRequest(
  deps: CreationDraftHandlerDependencies,
  body: JsonObject,
  current: CreationDraft
): OutlineSlideRequest {
  const sourceDeckPlan = getDeckPlanPayload(deps, body.deckPlan || current.deckPlan);
  const slides = deps.deckPlanSlides(sourceDeckPlan);
  const slideIndex = Number.parseInt(String(body.slideIndex), 10);
  if (!slides.length || !Number.isFinite(slideIndex) || slideIndex < 0 || slideIndex >= slides.length) {
    throw new Error("Expected a valid outline slide to regenerate");
  }

  const fields: CreationFields = {
    ...deps.normalizeCreationFields({
      ...(current.fields || {}),
      ...(deps.isJsonObject(body.fields) ? body.fields : {})
    }),
    targetSlideCount: slides.length
  };
  assertCreationBrief(fields, "Describe the presentation before regenerating an outline slide");

  return {
    current,
    fields,
    slideIndex,
    slides,
    sourceDeckPlan
  };
}

function buildOutlineSlideLockMap(slides: DeckPlanSlide[], slideIndex: number): Record<string, boolean> {
  return Object.fromEntries(
    slides.map((_slide: DeckPlanSlide, index: number) => [String(index), index !== slideIndex])
  );
}

function buildRegeneratedDeckPlan(
  request: OutlineSlideRequest,
  resultPlan: DeckPlanPayload,
  replacement: DeckPlanSlide
): DeckPlanPayload {
  const nextSlides = request.slides.map((slide: DeckPlanSlide, index: number) => (
    index === request.slideIndex ? replacement : slide
  ));

  return {
    ...request.sourceDeckPlan,
    narrativeArc: resultPlan.narrativeArc || request.sourceDeckPlan.narrativeArc,
    outline: buildDeckPlanOutline(nextSlides),
    slides: nextSlides,
    title: resultPlan.title || request.sourceDeckPlan.title,
    thesis: resultPlan.thesis || request.sourceDeckPlan.thesis
  };
}

async function generateRegeneratedOutlineSlide(
  deps: CreationDraftHandlerDependencies,
  request: OutlineSlideRequest,
  reportProgress: (progress: JsonObject) => void
): Promise<RegeneratedOutlineSlide> {
  const generationFields = await getGenerationFieldsWithMaterials(request.fields);
  const keepLocks = buildOutlineSlideLockMap(request.slides, request.slideIndex);
  const result = await generateInitialDeckPlan({
    ...generationFields,
    lockedOutlineSlides: buildLockedOutlineContext(
      deps,
      request.sourceDeckPlan,
      keepLocks,
      { excludeIndex: request.slideIndex }
    ),
    onProgress: reportProgress
  });
  const resultPlan = getDeckPlanPayload(deps, result.plan);
  const replacement = deps.deckPlanSlides(resultPlan)[request.slideIndex];
  if (!replacement) {
    throw new Error("Regenerated outline did not include the requested slide");
  }

  return {
    deckPlan: buildRegeneratedDeckPlan(request, resultPlan, replacement),
    result
  };
}

function saveRegeneratedOutlineSlideDraft(
  request: OutlineSlideRequest,
  deckPlan: DeckPlanPayload,
  retrieval: unknown
): CreationDraft {
  return savePresentationCreationDraft({
    ...request.current,
    approvedOutline: false,
    deckPlan,
    fields: {
      ...request.fields,
      title: inferCreationTitle(request.fields, deckPlan, request.fields.title || "")
    },
    outlineDirty: false,
    retrieval,
    stage: "structure"
  });
}

async function handlePresentationDraftSave(
  deps: CreationDraftHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const current = getPresentationCreationDraft();
  const draft = buildSavedCreationDraft(deps, body, current);

  deps.createJsonResponse(res, 200, {
    creationDraft: draft,
    savedThemes: listSavedThemes()
  });
  deps.publishCreationDraftUpdate(draft);
}

async function handlePresentationDraftOutline(
  deps: CreationDraftHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const current = getPresentationCreationDraft();
  const context = getOutlineGenerationContext(deps, body, current);
  const reportProgress = createOutlineReporter(
    deps,
    "plan-presentation-outline",
    "Planning staged presentation outline...",
    "planning-outline"
  );
  const generationFields = await getGenerationFieldsWithMaterials(context.fields);
  const result = await generateInitialDeckPlan({
    ...generationFields,
    lockedOutlineSlides: context.lockedSlides,
    onProgress: reportProgress
  });
  const deckPlan = applyLockedOutlineSlides(deps, result.plan, context.previousDeckPlan, context.outlineLocks);
  const deckPlanSlideCount = deps.deckPlanSlides(deckPlan).length;
  const draft = saveGeneratedOutlineDraft(context.fields, deckPlan, context.outlineLocks, result.retrieval);

  deps.updateWorkflowState({
    generation: result.generation,
    message: `Generated an outline with ${deckPlanSlideCount} slide${deckPlanSlideCount === 1 ? "" : "s"}. Approve it before creating slides.`,
    ok: true,
    operation: "plan-presentation-outline",
    stage: "completed",
    status: "completed"
  });
  publishOutlineRuntimeState(deps, result.retrieval);

  deps.createJsonResponse(res, 200, {
    creationDraft: draft,
    deckPlan,
    retrieval: result.retrieval,
    runtime: deps.serializeRuntimeState()
  });
  deps.publishCreationDraftUpdate(draft);
}

async function handlePresentationDraftOutlineSlide(
  deps: CreationDraftHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const current = getPresentationCreationDraft();
  const request = getOutlineSlideRequest(deps, body, current);
  const reportProgress = createOutlineReporter(
    deps,
    "regenerate-outline-slide",
    `Regenerating outline slide ${request.slideIndex + 1}...`,
    "planning-outline-slide"
  );
  const { deckPlan, result } = await generateRegeneratedOutlineSlide(deps, request, reportProgress);
  const draft = saveRegeneratedOutlineSlideDraft(request, deckPlan, result.retrieval);

  deps.updateWorkflowState({
    generation: result.generation,
    message: `Regenerated outline slide ${request.slideIndex + 1}.`,
    ok: true,
    operation: "regenerate-outline-slide",
    stage: "completed",
    status: "completed"
  });
  publishOutlineRuntimeState(deps, result.retrieval);

  deps.createJsonResponse(res, 200, {
    creationDraft: draft,
    deckPlan,
    retrieval: result.retrieval,
    runtime: deps.serializeRuntimeState()
  });
  deps.publishCreationDraftUpdate(draft);
}

async function handlePresentationDraftApprove(
  deps: CreationDraftHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const current = getPresentationCreationDraft();
  const outlineLocks = body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks;
  const sourceDeckPlan = getDeckPlanPayload(deps, current.deckPlan || body.deckPlan);
  if (!deps.deckPlanSlides(sourceDeckPlan).length) {
    throw new Error("Expected a generated outline before approval");
  }

  const deckPlan = applyLockedOutlineSlides(deps, sourceDeckPlan, current.deckPlan, outlineLocks);
  const draft = savePresentationCreationDraft({
    ...current,
    approvedOutline: true,
    deckPlan,
    outlineLocks,
    outlineDirty: false,
    stage: "content"
  });

  deps.createJsonResponse(res, 200, {
    creationDraft: draft
  });
  deps.publishCreationDraftUpdate(draft);
}

export function createCreationDraftHandlers(deps: CreationDraftHandlerDependencies) {
  return {
    handlePresentationDraftApprove: (req: ServerRequest, res: ServerResponse) => (
      handlePresentationDraftApprove(deps, req, res)
    ),
    handlePresentationDraftOutline: (req: ServerRequest, res: ServerResponse) => (
      handlePresentationDraftOutline(deps, req, res)
    ),
    handlePresentationDraftOutlineSlide: (req: ServerRequest, res: ServerResponse) => (
      handlePresentationDraftOutlineSlide(deps, req, res)
    ),
    handlePresentationDraftSave: (req: ServerRequest, res: ServerResponse) => (
      handlePresentationDraftSave(deps, req, res)
    )
  };
}
