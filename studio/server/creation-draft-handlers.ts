import * as http from "http";

import { normalizeOutlineLocks } from "../shared/outline-locks.ts";
import { attachWebSourcesToCreationFields } from "./creation-source-fields.ts";
import { generateInitialDeckPlan } from "./services/presentation-generation.ts";
import {
  getPresentationCreationDraft,
  listSavedThemes,
  savePresentationCreationDraft
} from "./services/presentations.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type CreationFields = JsonObject & {
  imageSearch: {
    count: unknown;
    provider: unknown;
    query: string;
    restrictions: string;
  };
  lang: string;
  presentationSourceUrls: string;
  presentationSourceText: string;
  targetSlideCount: unknown;
  title: string;
  visualTheme: JsonObject;
};

type DeckPlanSlide = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  sourceNotes?: unknown;
  sourceText?: unknown;
  title?: unknown;
  type?: unknown;
  value?: unknown;
  visualNeed?: unknown;
};

type DeckPlanPayload = JsonObject & {
  narrativeArc?: unknown;
  outline?: unknown;
  slides?: DeckPlanSlide[];
  thesis?: unknown;
};

type LockedOutlineContextOptions = {
  excludeIndex?: number;
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

export function createCreationDraftHandlers(deps: CreationDraftHandlerDependencies) {
  const {
    createJsonResponse,
    createWorkflowProgressReporter,
    deckPlanSlides,
    isDeckPlanPayload,
    isJsonObject,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  function buildDeckPlanOutline(slides: unknown): string {
    return (Array.isArray(slides) ? slides : [])
      .filter((slide): slide is DeckPlanSlide => isJsonObject(slide))
      .map((slide, index) => {
        const title = slide && slide.title ? slide.title : `Slide ${index + 1}`;
        const message = slide && (slide.keyMessage || slide.intent) ? slide.keyMessage || slide.intent : "";
        return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
      })
      .join("\n");
  }

  function applyLockedOutlineSlides(nextPlan: unknown, previousPlan: unknown, outlineLocks: unknown): DeckPlanPayload {
    const nextDeckPlan = isDeckPlanPayload(nextPlan) ? nextPlan : {};
    const previousDeckPlan = isDeckPlanPayload(previousPlan) ? previousPlan : {};
    const nextSlides = deckPlanSlides(nextDeckPlan);
    const previousSlides = deckPlanSlides(previousDeckPlan);
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

  function buildLockedOutlineContext(deckPlan: unknown, outlineLocks: unknown, options: LockedOutlineContextOptions = {}): JsonObject[] {
    const slides = deckPlanSlides(deckPlan);
    const locks = normalizeOutlineLocks(outlineLocks);
    return slides
      .map((slide: DeckPlanSlide, index: number) => ({ index, slide }))
      .filter(({ index }) => locks[String(index)] && index !== options.excludeIndex)
      .map(({ index, slide }) => ({
        index,
        intent: slide.intent || "",
        keyMessage: slide.keyMessage || "",
        role: slide.role || "",
        sourceNeed: slide.sourceNeed || "",
        sourceNotes: slide.sourceNotes || slide.sourceText || "",
        title: slide.title || `Slide ${index + 1}`,
        type: slide.type || "content",
        value: slide.value || "",
        visualNeed: slide.visualNeed || ""
      }));
  }

  async function handlePresentationDraftSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const draft = savePresentationCreationDraft({
      ...current,
      approvedOutline: typeof body.approvedOutline === "boolean" ? body.approvedOutline : current.approvedOutline,
      deckPlan: body.deckPlan || current.deckPlan,
      fields: {
        ...(current.fields || {}),
        ...normalizeCreationFields(isJsonObject(body.fields) ? body.fields : body)
      },
      outlineLocks: body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks,
      outlineDirty: typeof body.outlineDirty === "boolean" ? body.outlineDirty : current.outlineDirty,
      retrieval: body.retrieval || current.retrieval,
      stage: body.stage || current.stage || "brief"
    });

    createJsonResponse(res, 200, {
      creationDraft: draft,
      savedThemes: listSavedThemes()
    });
    publishCreationDraftUpdate(draft);
  }

  async function handlePresentationDraftOutline(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const fields = normalizeCreationFields(isJsonObject(body.fields) ? body.fields : body);
    if (!fields.title) {
      throw new Error("Expected a presentation title before generating an outline");
    }
    const mergeDeckPlan = (basePlan: unknown, overridePlan: unknown): DeckPlanPayload => {
      const baseDeckPlan = isDeckPlanPayload(basePlan) ? basePlan : {};
      const overrideDeckPlan = isDeckPlanPayload(overridePlan) ? overridePlan : {};
      const baseSlides = deckPlanSlides(baseDeckPlan);
      const overrideSlides = deckPlanSlides(overrideDeckPlan);
      if (!baseSlides.length) {
        return Object.keys(overrideDeckPlan).length ? overrideDeckPlan : baseDeckPlan;
      }
      if (!overrideSlides.length) {
        return baseDeckPlan;
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
    };

    const previousDeckPlan = mergeDeckPlan(current.deckPlan, body.deckPlan || current.deckPlan);
    const outlineLocks = normalizeOutlineLocks(body.outlineLocks || current.outlineLocks);
    const lockedSlides = buildLockedOutlineContext(previousDeckPlan, outlineLocks);
    const previousSlides = deckPlanSlides(previousDeckPlan);
    if (previousSlides.length && lockedSlides.length >= previousSlides.length) {
      throw new Error("Unlock at least one outline slide before regenerating.");
    }

    const reportProgress = createWorkflowProgressReporter({
      operation: "plan-presentation-outline"
    });
    reportProgress({
      message: "Planning staged presentation outline...",
      stage: "planning-outline"
    });

    const generationFields = await attachWebSourcesToCreationFields(fields);
    const result = await generateInitialDeckPlan({
      ...generationFields,
      lockedOutlineSlides: lockedSlides,
      onProgress: reportProgress
    });
    const deckPlan = applyLockedOutlineSlides(result.plan, previousDeckPlan, outlineLocks);
    const deckPlanSlideCount = deckPlanSlides(deckPlan).length;
    const draft = savePresentationCreationDraft({
      approvedOutline: false,
      deckPlan,
      fields,
      outlineLocks,
      outlineDirty: false,
      retrieval: result.retrieval,
      stage: "structure"
    });
    updateWorkflowState({
      generation: result.generation,
      message: `Generated an outline with ${deckPlanSlideCount} slide${deckPlanSlideCount === 1 ? "" : "s"}. Approve it before creating slides.`,
      ok: true,
      operation: "plan-presentation-outline",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    runtimeState.sourceRetrieval = result.retrieval || null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      creationDraft: draft,
      deckPlan,
      retrieval: result.retrieval,
      runtime: serializeRuntimeState()
    });
    publishCreationDraftUpdate(draft);
  }

  async function handlePresentationDraftOutlineSlide(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const sourceDeckPlan = isDeckPlanPayload(body.deckPlan) ? body.deckPlan : isDeckPlanPayload(current.deckPlan) ? current.deckPlan : {};
    const slides = deckPlanSlides(sourceDeckPlan);
    const slideIndex = Number.parseInt(String(body.slideIndex), 10);
    if (!slides.length || !Number.isFinite(slideIndex) || slideIndex < 0 || slideIndex >= slides.length) {
      throw new Error("Expected a valid outline slide to regenerate");
    }

    const fields = {
      ...normalizeCreationFields({
        ...(current.fields || {}),
        ...(isJsonObject(body.fields) ? body.fields : {})
      }),
      targetSlideCount: slides.length
    };
    if (!fields.title) {
      throw new Error("Expected a presentation title before regenerating an outline slide");
    }

    const reportProgress = createWorkflowProgressReporter({
      operation: "regenerate-outline-slide"
    });
    reportProgress({
      message: `Regenerating outline slide ${slideIndex + 1}...`,
      stage: "planning-outline-slide"
    });

    const keepLocks = Object.fromEntries(slides.map((_slide: DeckPlanSlide, index: number) => [String(index), index !== slideIndex]));
    const generationFields = await attachWebSourcesToCreationFields(fields);
    const result = await generateInitialDeckPlan({
      ...generationFields,
      lockedOutlineSlides: buildLockedOutlineContext(sourceDeckPlan, keepLocks, { excludeIndex: slideIndex }),
      onProgress: reportProgress
    });
    const resultPlan = result.plan || {};
    const generatedSlides = deckPlanSlides(resultPlan);
    const replacement = generatedSlides[slideIndex];
    if (!replacement) {
      throw new Error("Regenerated outline did not include the requested slide");
    }

    const nextSlides = slides.map((slide: DeckPlanSlide, index: number) => index === slideIndex ? replacement : slide);
    const deckPlan = {
      ...sourceDeckPlan,
      narrativeArc: resultPlan.narrativeArc || sourceDeckPlan.narrativeArc,
      outline: buildDeckPlanOutline(nextSlides),
      slides: nextSlides,
      thesis: resultPlan.thesis || sourceDeckPlan.thesis
    };
    const draft = savePresentationCreationDraft({
      ...current,
      approvedOutline: false,
      deckPlan,
      fields,
      outlineDirty: false,
      retrieval: result.retrieval,
      stage: "structure"
    });

    updateWorkflowState({
      generation: result.generation,
      message: `Regenerated outline slide ${slideIndex + 1}.`,
      ok: true,
      operation: "regenerate-outline-slide",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    runtimeState.sourceRetrieval = result.retrieval || null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      creationDraft: draft,
      deckPlan,
      retrieval: result.retrieval,
      runtime: serializeRuntimeState()
    });
    publishCreationDraftUpdate(draft);
  }

  async function handlePresentationDraftApprove(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const outlineLocks = body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks;
    const sourceDeckPlan = isDeckPlanPayload(current.deckPlan) ? current.deckPlan : isDeckPlanPayload(body.deckPlan) ? body.deckPlan : {};
    if (!deckPlanSlides(sourceDeckPlan).length) {
      throw new Error("Expected a generated outline before approval");
    }

    const deckPlan = applyLockedOutlineSlides(sourceDeckPlan, current.deckPlan, outlineLocks);
    const draft = savePresentationCreationDraft({
      ...current,
      approvedOutline: true,
      deckPlan,
      outlineLocks,
      outlineDirty: false,
      stage: "content"
    });

    createJsonResponse(res, 200, {
      creationDraft: draft
    });
    publishCreationDraftUpdate(draft);
  }

  return {
    handlePresentationDraftApprove,
    handlePresentationDraftOutline,
    handlePresentationDraftOutlineSlide,
    handlePresentationDraftSave
  };
}
