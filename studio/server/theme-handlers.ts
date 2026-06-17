import * as http from "http";

import { listSavedThemes, saveRuntimeTheme } from "./services/presentations.ts";
import { generateThemeCandidates } from "./services/theme-candidates.ts";
import { generateThemeFromBrief } from "./services/theme-generation.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type ThemeHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function publishThemeProgress(
  event: JsonObject,
  operation: "theme-candidates" | "theme-generate",
  fallbackMessage: string,
  updateWorkflowState: (nextWorkflow: JsonObject) => void
): void {
  const message = typeof event.message === "string" ? event.message : fallbackMessage;
  updateWorkflowState({
    detail: typeof event.detail === "string" ? event.detail : message,
    message,
    operation,
    stage: typeof event.stage === "string" ? event.stage : "llm",
    status: "running"
  });
}

function publishThemeCompletion(
  message: string,
  operation: "theme-candidates" | "theme-generate",
  updateWorkflowState: (nextWorkflow: JsonObject) => void
): void {
  updateWorkflowState({
    message,
    operation,
    stage: "completed",
    status: "completed"
  });
}

export function createThemeHandlers(deps: ThemeHandlerDependencies) {
  const {
    createJsonResponse,
    readJsonBody,
    updateWorkflowState
  } = deps;

  async function handleRuntimeThemeSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const savedTheme = saveRuntimeTheme({
      name: body.name,
      theme: body.theme || body.visualTheme
    });

    createJsonResponse(res, 200, {
      savedTheme,
      savedThemes: listSavedThemes()
    });
  }

  async function handleThemeGenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const result = await generateThemeFromBrief(body, {
      onProgress: (event: JsonObject) => {
        publishThemeProgress(event, "theme-generate", "Generating theme from brief.", updateWorkflowState);
      }
    });
    publishThemeCompletion(
      result.source === "llm" ? "Generated theme from brief." : "Generated fallback theme from brief.",
      "theme-generate",
      updateWorkflowState
    );
    createJsonResponse(res, 200, result);
  }

  async function handleThemeCandidates(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const result = await generateThemeCandidates(body, {
      onProgress: (event: JsonObject) => {
        publishThemeProgress(event, "theme-candidates", "Generating theme candidates from brief.", updateWorkflowState);
      }
    });
    publishThemeCompletion("Generated theme candidates.", "theme-candidates", updateWorkflowState);
    createJsonResponse(res, 200, result);
  }

  return {
    handleRuntimeThemeSave,
    handleThemeCandidates,
    handleThemeGenerate
  };
}
