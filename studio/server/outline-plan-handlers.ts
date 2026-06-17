import * as http from "http";

import { recordDerivedSlideset } from "./services/memory.ts";
import {
  archiveOutlinePlan,
  createOutlinePlanFromPresentation,
  deleteOutlinePlan,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  getOutlinePlan,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  proposeDeckChangesFromOutlinePlan,
  saveOutlinePlan,
  setActiveOutlinePlan
} from "./services/presentation-outline-plans.ts";
import { readPresentationDeckContext } from "./services/presentation-context-store.ts";
import { savePresentationCreationDraft } from "./services/presentation-creation-draft.ts";
import { getActivePresentationId } from "./services/active-presentation.ts";
import type { OutlinePlan } from "./services/outline-plans.ts";

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
  presentationDensity: "spacious" | "balanced" | "dense";
  presentationSourceUrls: string;
  presentationSourceText: string;
  targetSlideCount: unknown;
  title: string;
  visualTheme: JsonObject;
};

type OutlinePlanPayload = JsonObject & {
  archivedAt?: unknown;
};

type OutlinePlanHandlerDependencies = {
  buildCompactPresentationSourceText: (presentationId: string) => string;
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createPresentationPayload: (extra?: JsonObject) => JsonObject;
  deckPlanSlides: (plan: unknown) => JsonObject[];
  isJsonObject: (value: unknown) => value is JsonObject;
  isOutlinePlanPayload: (value: unknown) => value is OutlinePlanPayload;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  normalizeCreationFields: (body?: JsonObject) => CreationFields;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  resetPresentationRuntime: () => void;
  runtimeState: {
    lastError: {
      message?: string;
      updatedAt?: string;
    } | null;
  };
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function activePresentationIdFromBody(body: JsonObject): string {
  const bodyPresentationId = typeof body.presentationId === "string" ? body.presentationId : "";
  return bodyPresentationId || getActivePresentationId();
}

function requireActiveOutlinePlan(
  deps: OutlinePlanHandlerDependencies,
  presentationId: string,
  planId: unknown
): OutlinePlan {
  if (typeof planId !== "string" || !planId) {
    throw new Error("Expected planId");
  }

  const outlinePlan = getOutlinePlan(presentationId, planId);
  if (!deps.isOutlinePlanPayload(outlinePlan)) {
    throw new Error("Expected outline plan");
  }
  if (outlinePlan.archivedAt) {
    throw new Error("Archived outline plans cannot start live deck generation.");
  }

  return outlinePlan;
}

function outlinePlanCreationFields(
  deps: OutlinePlanHandlerDependencies,
  params: {
    body: JsonObject;
    deckPlanSlideCount: number;
    outlinePlan: OutlinePlan;
    presentationId: string;
    sourceDeck: JsonObject;
  }
): CreationFields {
  const { body, deckPlanSlideCount, outlinePlan, presentationId, sourceDeck } = params;
  return deps.normalizeCreationFields({
    audience: outlinePlan.audience || sourceDeck.audience || "",
    constraints: body.copyDeckContext === false ? "" : sourceDeck.constraints || "",
    objective: outlinePlan.objective || outlinePlan.purpose || sourceDeck.objective || "",
    presentationDensity: outlinePlan.presentationDensity || "balanced",
    presentationSourceText: deps.buildCompactPresentationSourceText(presentationId),
    targetSlideCount: deckPlanSlideCount,
    themeBrief: body.copyDeckContext === false ? "" : sourceDeck.themeBrief || "",
    title: body.title || `${outlinePlan.name} deck`,
    tone: outlinePlan.tone || sourceDeck.tone || "",
    visualTheme: body.copyTheme === false ? {} : sourceDeck.visualTheme || {}
  });
}

function createHandleOutlinePlanGenerate(deps: OutlinePlanHandlerDependencies) {
  const { createJsonResponse, createPresentationPayload, readJsonBody } = deps;
  return async function handleOutlinePlanGenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    const outlinePlan = createOutlinePlanFromPresentation(presentationId, body);
    const activeOutlinePlanId = outlinePlan && typeof outlinePlan.id === "string"
      ? setActiveOutlinePlan(presentationId, outlinePlan.id)
      : undefined;

    createJsonResponse(res, 200, createPresentationPayload({
      activeOutlinePlanId,
      outlinePlan,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  };
}

function createHandleOutlinePlanSave(deps: OutlinePlanHandlerDependencies) {
  const { createJsonResponse, createPresentationPayload, readJsonBody } = deps;
  return async function handleOutlinePlanSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    const outlinePlan = saveOutlinePlan(presentationId, body.outlinePlan || body);

    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlan,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  };
}

function createHandleOutlinePlanDelete(deps: OutlinePlanHandlerDependencies) {
  const { createJsonResponse, createPresentationPayload, readJsonBody } = deps;
  return async function handleOutlinePlanDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const outlinePlans = deleteOutlinePlan(presentationId, body.planId);
    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlans
    }));
  };
}

function createHandleOutlinePlanDuplicate(deps: OutlinePlanHandlerDependencies) {
  const { createJsonResponse, createPresentationPayload, readJsonBody } = deps;
  return async function handleOutlinePlanDuplicate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const outlinePlan = duplicateOutlinePlan(presentationId, body.planId, {
      name: body.name
    });
    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlan,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  };
}

function createHandleOutlinePlanArchive(deps: OutlinePlanHandlerDependencies) {
  const { createJsonResponse, createPresentationPayload, readJsonBody } = deps;
  return async function handleOutlinePlanArchive(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const outlinePlan = archiveOutlinePlan(presentationId, body.planId);
    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlan,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  };
}

function createHandleOutlinePlanActive(deps: OutlinePlanHandlerDependencies) {
  const { createJsonResponse, createPresentationPayload, readJsonBody } = deps;
  return async function handleOutlinePlanActive(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const activeOutlinePlanId = setActiveOutlinePlan(presentationId, body.planId);
    createJsonResponse(res, 200, createPresentationPayload({
      activeOutlinePlanId,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  };
}

function createHandleOutlinePlanPropose(deps: OutlinePlanHandlerDependencies) {
  const {
    createJsonResponse,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  return async function handleOutlinePlanPropose(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const candidate = proposeDeckChangesFromOutlinePlan(presentationId, body.planId);
    updateWorkflowState({
      dryRun: true,
      message: typeof candidate.summary === "string" ? candidate.summary : "Prepared outline plan changes.",
      ok: true,
      operation: "outline-plan-propose-current-deck",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      deckStructureCandidates: [candidate],
      runtime: serializeRuntimeState(),
      summary: candidate.summary
    });
  };
}

function createHandleOutlinePlanStageCreation(deps: OutlinePlanHandlerDependencies) {
  const {
    createJsonResponse,
    createPresentationPayload,
    deckPlanSlides,
    isJsonObject,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    updateWorkflowState
  } = deps;

  return async function handleOutlinePlanStageCreation(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    const outlinePlan = requireActiveOutlinePlan(deps, presentationId, body.planId);
    const sourceContext = readPresentationDeckContext(presentationId);
    const sourceDeck = isJsonObject(sourceContext) && isJsonObject(sourceContext.deck) ? sourceContext.deck : {};
    const deckPlan = outlinePlanToDeckPlan(outlinePlan);
    const deckPlanSlideCount = deckPlanSlides(deckPlan).length;
    const fields = outlinePlanCreationFields(deps, {
      body,
      deckPlanSlideCount,
      outlinePlan,
      presentationId,
      sourceDeck
    });
    const draft = savePresentationCreationDraft({
      approvedOutline: true,
      contentRun: null,
      createdPresentationId: null,
      deckPlan,
      fields,
      outlineDirty: false,
      outlineLocks: {},
      retrieval: null,
      stage: "content"
    });
    publishCreationDraftUpdate(draft);

    updateWorkflowState({
      dryRun: true,
      message: `Staged "${outlinePlan.name}" as an approved outline for live deck generation.`,
      ok: true,
      operation: "outline-plan-stage-creation",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, createPresentationPayload({
      creationDraft: draft,
      outlinePlan
    }));
  };
}

function createHandleOutlinePlanDerive(deps: OutlinePlanHandlerDependencies) {
  const {
    createJsonResponse,
    createPresentationPayload,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    updateWorkflowState
  } = deps;

  return async function handleOutlinePlanDerive(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    resetPresentationRuntime();
    const result = derivePresentationFromOutlinePlan(presentationId, body.planId, {
      copyDeckContext: body.copyDeckContext !== false,
      copyMaterials: body.copyMaterials === true,
      copySources: body.copySources === true,
      copyTheme: body.copyTheme !== false,
      title: body.title
    });
    const presentation = jsonObjectOrEmpty(result.presentation);
    const outlinePlan = jsonObjectOrEmpty(result.outlinePlan);
    recordDerivedSlideset({
      id: `outline-${String(outlinePlan.id || "plan")}-${String(presentation.id || "deck")}`,
      purpose: `Derived deck from outline plan "${String(outlinePlan.name || "outline plan")}".`,
      resultPresentationId: presentation.id,
      sourcePresentationId: presentationId,
      targetLength: presentation.slideCount
    }, { presentationId });
    updateWorkflowState({
      message: `Derived "${String(presentation.title || "presentation")}" from outline plan "${String(outlinePlan.name || "outline plan")}".`,
      ok: true,
      operation: "derive-presentation-from-outline-plan",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, createPresentationPayload(result));
  };
}

export function createOutlinePlanHandlers(deps: OutlinePlanHandlerDependencies) {
  return {
    handleOutlinePlanActive: createHandleOutlinePlanActive(deps),
    handleOutlinePlanArchive: createHandleOutlinePlanArchive(deps),
    handleOutlinePlanDelete: createHandleOutlinePlanDelete(deps),
    handleOutlinePlanDerive: createHandleOutlinePlanDerive(deps),
    handleOutlinePlanDuplicate: createHandleOutlinePlanDuplicate(deps),
    handleOutlinePlanGenerate: createHandleOutlinePlanGenerate(deps),
    handleOutlinePlanPropose: createHandleOutlinePlanPropose(deps),
    handleOutlinePlanSave: createHandleOutlinePlanSave(deps),
    handleOutlinePlanStageCreation: createHandleOutlinePlanStageCreation(deps)
  };
}
