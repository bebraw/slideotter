import * as http from "http";

import { getLlmModelState, getLlmStatus, setLlmModelOverride, verifyLlmConnection } from "./services/llm/client.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type RuntimeStateAccess = {
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  llmCheck: unknown;
};

type LlmHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeRuntimeState: () => JsonObject;
};

export function createLlmHandlers(deps: LlmHandlerDependencies) {
  const {
    createJsonResponse,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState
  } = deps;

  async function handleLlmCheck(res: ServerResponse): Promise<void> {
    const result = await verifyLlmConnection();
    runtimeState.llmCheck = result;
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      llm: getLlmStatus(),
      result,
      runtime: serializeRuntimeState()
    });
  }

  async function handleLlmModels(res: ServerResponse): Promise<void> {
    createJsonResponse(res, 200, {
      llm: await getLlmModelState(),
      runtime: serializeRuntimeState()
    });
  }

  async function handleLlmModelUpdate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const llm = await setLlmModelOverride(body.modelOverride);
    runtimeState.llmCheck = null;
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      llm,
      runtime: serializeRuntimeState()
    });
  }

  return {
    handleLlmCheck,
    handleLlmModelUpdate,
    handleLlmModels
  };
}
