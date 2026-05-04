import * as http from "http";
import { URL } from "url";

import { getAssistantSession, getAssistantSuggestions, handleAssistantMessage } from "./services/assistant.ts";
import { getPreviewManifest } from "./services/build.ts";
import { buildActionDescriptors } from "./services/selection-scope.ts";
import { getDeckContext } from "./services/state.ts";
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

export function createAssistantHandlers(deps: AssistantHandlerDependencies) {
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

  async function handleAssistantSession(_req: ServerRequest, res: ServerResponse, url: URL): Promise<void> {
    const sessionId = url.searchParams.get("sessionId") || "default";
    createJsonResponse(res, 200, {
      actions: buildActionDescriptors(),
      session: getAssistantSession(sessionId),
      suggestions: getAssistantSuggestions()
    });
  }

  async function handleAssistantSend(req: ServerRequest, res: ServerResponse): Promise<void> {
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

    if (action.type === "ideate-slide" || action.type === "ideate-structure" || action.type === "ideate-theme" || action.type === "drill-wording" || action.type === "redo-layout" || action.type === "selection-command") {
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

    if (action.type === "ideate-deck-structure") {
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

    if (action.type === "validate" && Object.keys(validation).length) {
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

    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      action: resultRecord.action,
      actions: buildActionDescriptors(),
      context: resultRecord.context || getDeckContext(),
      deckStructureCandidates: Array.isArray(resultRecord.deckStructureCandidates) ? resultRecord.deckStructureCandidates : [],
      previews: resultRecord.previews || getPreviewManifest(),
      reply: resultRecord.reply,
      runtime: serializeRuntimeState(),
      session: resultRecord.session,
      suggestions: getAssistantSuggestions(),
      transientVariants: Array.isArray(resultRecord.transientVariants) ? resultRecord.transientVariants : [],
      validation: resultRecord.validation || null,
      variants: listAllVariants()
    });
  }

  return {
    handleAssistantSend,
    handleAssistantSession
  };
}
