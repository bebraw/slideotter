import * as http from "http";
import { URL } from "url";

import { getAssistantSession, getAssistantSuggestions, handleAssistantMessage } from "./services/assistant.ts";
import { getPreviewManifest } from "./services/preview-manifest.ts";
import { buildActionDescriptors } from "./services/selection-actions.ts";
import { getDeckContext } from "./services/deck-context-store.ts";
import { listAllVariants } from "./services/variants.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type RuntimeStateAccess = {
  build: {
    ok: boolean;
    updatedAt: string | null;
  };
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  validation: JsonObject | null;
  workflow: JsonObject | null;
};

type AssistantHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function assistantActionUpdatesWorkflow(actionType: unknown): boolean {
  return actionType === "ideate-slide"
    || actionType === "ideate-structure"
    || actionType === "ideate-theme"
    || actionType === "drill-wording"
    || actionType === "redo-layout"
    || actionType === "selection-command";
}

function updateAssistantActionWorkflow(
  action: JsonObject,
  replyContent: string,
  runtimeState: RuntimeStateAccess,
  updateWorkflowState: (nextWorkflow: JsonObject) => void
): void {
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: action.dryRun,
    generation: action.generation,
    message: replyContent || "Assistant workflow completed.",
    ok: true,
    operation: `assistant-${action.type}`,
    slideId: typeof action.slideId === "string" ? action.slideId : null,
    stage: "completed",
    status: "completed"
  });
}

function updateAssistantDeckStructureWorkflow(
  action: JsonObject,
  replyContent: string,
  updateWorkflowState: (nextWorkflow: JsonObject) => void
): void {
  updateWorkflowState({
    dryRun: action.dryRun,
    generation: action.generation,
    message: replyContent || "Assistant deck-structure workflow completed.",
    ok: true,
    operation: "assistant-ideate-deck-structure",
    stage: "completed",
    status: "completed"
  });
}

function updateAssistantValidationWorkflow(
  action: JsonObject,
  validation: JsonObject,
  runtimeState: RuntimeStateAccess,
  updateWorkflowState: (nextWorkflow: JsonObject) => void
): void {
  runtimeState.validation = {
    includeRender: action.includeRender,
    ok: validation.ok,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    includeRender: action.includeRender,
    message: validation.ok ? "Assistant validation completed without blocking issues." : "Assistant validation completed and found issues.",
    ok: validation.ok,
    operation: "assistant-validate",
    stage: "completed",
    status: "completed"
  });
}

function createAssistantResponsePayload(resultRecord: JsonObject, runtime: JsonObject): JsonObject {
  return {
    action: resultRecord.action,
    actions: buildActionDescriptors(),
    context: resultRecord.context || getDeckContext(),
    deckStructureCandidates: Array.isArray(resultRecord.deckStructureCandidates) ? resultRecord.deckStructureCandidates : [],
    previews: resultRecord.previews || getPreviewManifest(),
    reply: resultRecord.reply,
    runtime,
    session: resultRecord.session,
    suggestions: getAssistantSuggestions(),
    transientVariants: Array.isArray(resultRecord.transientVariants) ? resultRecord.transientVariants : [],
    validation: resultRecord.validation || null,
    variants: listAllVariants()
  };
}

async function handleAssistantSessionRequest(
  deps: Pick<AssistantHandlerDependencies, "createJsonResponse">,
  _req: ServerRequest,
  res: ServerResponse,
  url: URL
): Promise<void> {
  const sessionId = url.searchParams.get("sessionId") || "default";
  deps.createJsonResponse(res, 200, {
    actions: buildActionDescriptors(),
    session: getAssistantSession(sessionId),
    suggestions: getAssistantSuggestions()
  });
}

async function handleAssistantSendRequest(
  deps: AssistantHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const {
    createJsonResponse,
    createWorkflowProgressReporter,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  const body = await readJsonBody(req);
  if (typeof body.message !== "string") {
    throw new Error("Expected message when sending to assistant");
  }

  const result = await handleAssistantMessage({
    candidateCount: body.candidateCount,
    dryRun: body.dryRun !== false,
    message: body.message,
    onProgress: createWorkflowProgressReporter({
      dryRun: body.dryRun !== false,
      operation: "assistant-workflow",
      slideId: typeof body.slideId === "string" && body.slideId ? body.slideId : null
    }),
    selection: body.selection && typeof body.selection === "object" ? body.selection : null,
    sessionId: typeof body.sessionId === "string" && body.sessionId ? body.sessionId : "default",
    slideId: typeof body.slideId === "string" && body.slideId ? body.slideId : null
  });
  const resultRecord = jsonObjectOrEmpty(result);
  const action = jsonObjectOrEmpty(resultRecord.action);
  const reply = jsonObjectOrEmpty(resultRecord.reply);
  const validation = jsonObjectOrEmpty(resultRecord.validation);
  const replyContent = typeof reply.content === "string" ? reply.content : "";

  if (assistantActionUpdatesWorkflow(action.type)) {
    updateAssistantActionWorkflow(action, replyContent, runtimeState, updateWorkflowState);
  }

  if (action.type === "ideate-deck-structure") {
    updateAssistantDeckStructureWorkflow(action, replyContent, updateWorkflowState);
  }

  if (action.type === "validate" && Object.keys(validation).length) {
    updateAssistantValidationWorkflow(action, validation, runtimeState, updateWorkflowState);
  }

  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, createAssistantResponsePayload(resultRecord, serializeRuntimeState()));
}

export function createAssistantHandlers(deps: AssistantHandlerDependencies) {
  return {
    handleAssistantSend: (req: ServerRequest, res: ServerResponse) => handleAssistantSendRequest(deps, req, res),
    handleAssistantSession: (req: ServerRequest, res: ServerResponse, url: URL) =>
      handleAssistantSessionRequest(deps, req, res, url)
  };
}
