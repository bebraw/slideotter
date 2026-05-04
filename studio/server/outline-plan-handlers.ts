import * as http from "http";

import {
  archiveOutlinePlan,
  createOutlinePlanFromPresentation,
  deleteOutlinePlan,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  getActivePresentationId,
  getOutlinePlan,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  proposeDeckChangesFromOutlinePlan,
  readPresentationDeckContext,
  saveOutlinePlan,
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

export function createOutlinePlanHandlers(deps: OutlinePlanHandlerDependencies) {
  const {
    buildCompactPresentationSourceText,
    createJsonResponse,
    createPresentationPayload,
    deckPlanSlides,
    isJsonObject,
    isOutlinePlanPayload,
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

  async function handleOutlinePlanGenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    const outlinePlan = createOutlinePlanFromPresentation(presentationId, body);

    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlan,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  }

  async function handleOutlinePlanSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    const outlinePlan = saveOutlinePlan(presentationId, body.outlinePlan || body);

    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlan,
      outlinePlans: listOutlinePlans(presentationId)
    }));
  }

  async function handleOutlinePlanDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const outlinePlans = deleteOutlinePlan(presentationId, body.planId);
    createJsonResponse(res, 200, createPresentationPayload({
      outlinePlans
    }));
  }

  async function handleOutlinePlanDuplicate(req: ServerRequest, res: ServerResponse): Promise<void> {
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
  }

  async function handleOutlinePlanArchive(req: ServerRequest, res: ServerResponse): Promise<void> {
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
  }

  async function handleOutlinePlanPropose(req: ServerRequest, res: ServerResponse): Promise<void> {
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
  }

  async function handleOutlinePlanStageCreation(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    if (typeof body.planId !== "string" || !body.planId) {
      throw new Error("Expected planId");
    }

    const outlinePlan = getOutlinePlan(presentationId, body.planId);
    if (!isOutlinePlanPayload(outlinePlan)) {
      throw new Error("Expected outline plan");
    }
    if (outlinePlan.archivedAt) {
      throw new Error("Archived outline plans cannot start live deck generation.");
    }

    const sourceContext = readPresentationDeckContext(presentationId);
    const sourceDeck = isJsonObject(sourceContext) && isJsonObject(sourceContext.deck) ? sourceContext.deck : {};
    const deckPlan = outlinePlanToDeckPlan(outlinePlan);
    const deckPlanSlideCount = deckPlanSlides(deckPlan).length;
    const fields = normalizeCreationFields({
      audience: outlinePlan.audience || sourceDeck.audience || "",
      constraints: body.copyDeckContext === false ? "" : sourceDeck.constraints || "",
      objective: outlinePlan.objective || outlinePlan.purpose || sourceDeck.objective || "",
      presentationSourceText: body.copySources === true ? buildCompactPresentationSourceText(presentationId) : "",
      targetSlideCount: deckPlanSlideCount,
      themeBrief: body.copyDeckContext === false ? "" : sourceDeck.themeBrief || "",
      title: body.title || `${outlinePlan.name} deck`,
      tone: outlinePlan.tone || sourceDeck.tone || "",
      visualTheme: body.copyTheme === false ? {} : sourceDeck.visualTheme || {}
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
  }

  async function handleOutlinePlanDerive(req: ServerRequest, res: ServerResponse): Promise<void> {
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
  }

  return {
    handleOutlinePlanArchive,
    handleOutlinePlanDelete,
    handleOutlinePlanDerive,
    handleOutlinePlanDuplicate,
    handleOutlinePlanGenerate,
    handleOutlinePlanPropose,
    handleOutlinePlanSave,
    handleOutlinePlanStageCreation
  };
}
