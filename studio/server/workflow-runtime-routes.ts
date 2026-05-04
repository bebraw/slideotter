import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createAssistantApiRoutes } from "./assistant-routes.ts";
import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createBuildValidationApiRoutes } from "./build-validation-routes.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createLlmApiRoutes } from "./llm-routes.ts";
import { createPreviewApiRoutes } from "./preview-routes.ts";
import { type ApiRoute } from "./routes.ts";
import { getPreviewManifest } from "./services/build.ts";
import { getStudioDomPreviewState } from "./workspace-state.ts";
import { createJsonResponse } from "./http-responses.ts";

type WorkflowRuntimeRouteHandlers = {
  assistantHandlers: ReturnType<typeof createAssistantHandlers>;
  buildValidationHandlers: ReturnType<typeof createBuildValidationHandlers>;
  llmHandlers: ReturnType<typeof createLlmHandlers>;
};

function createWorkflowRuntimeRoutes({
  assistantHandlers,
  buildValidationHandlers,
  llmHandlers
}: WorkflowRuntimeRouteHandlers): readonly ApiRoute[] {
  return [
    ...createBuildValidationApiRoutes({
      handleBuild: (_req, res) => buildValidationHandlers.handleBuild(res),
      handleCheckRemediation: buildValidationHandlers.handleCheckRemediation,
      handlePptxExport: (_req, res) => buildValidationHandlers.handlePptxExport(res),
      handleValidate: buildValidationHandlers.handleValidate
    }),
    ...createLlmApiRoutes({
      handleLlmCheck: (_req, res) => llmHandlers.handleLlmCheck(res),
      handleLlmModels: (_req, res) => llmHandlers.handleLlmModels(res),
      handleLlmModelUpdate: llmHandlers.handleLlmModelUpdate
    }),
    ...createPreviewApiRoutes({
      handleDeckDomPreview: (_req, res) => createJsonResponse(res, 200, getStudioDomPreviewState()),
      handleDeckPreview: (_req, res) => createJsonResponse(res, 200, getPreviewManifest())
    }),
    ...createAssistantApiRoutes({
      handleAssistantSend: assistantHandlers.handleAssistantSend,
      handleAssistantSession: assistantHandlers.handleAssistantSession
    })
  ];
}

export { createWorkflowRuntimeRoutes };
