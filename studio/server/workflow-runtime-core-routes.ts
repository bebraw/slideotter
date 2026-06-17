import { createBuildValidationApiRoutes } from "./build-validation-routes.ts";
import { createLlmApiRoutes } from "./llm-routes.ts";
import { createPreviewApiRoutes } from "./preview-routes.ts";
import { createJsonResponse } from "./http-responses.ts";
import type { ApiRoute } from "./routes.ts";
import { getPreviewManifest } from "./services/preview-manifest.ts";
import { getDomPreviewState } from "./services/dom-preview-state.ts";

type WorkflowRuntimeCoreRouteHandlers = {
  buildValidationHandlers: {
    handleBuild: (res: Parameters<Parameters<typeof createBuildValidationApiRoutes>[0]["handleBuild"]>[1]) => void;
    handleCheckRemediation: Parameters<typeof createBuildValidationApiRoutes>[0]["handleCheckRemediation"];
    handlePptxExport: (res: Parameters<Parameters<typeof createBuildValidationApiRoutes>[0]["handlePptxExport"]>[1]) => void;
    handleValidate: Parameters<typeof createBuildValidationApiRoutes>[0]["handleValidate"];
  };
  llmHandlers: {
    handleLlmCheck: (res: Parameters<Parameters<typeof createLlmApiRoutes>[0]["handleLlmCheck"]>[1]) => void;
    handleLlmModelUpdate: Parameters<typeof createLlmApiRoutes>[0]["handleLlmModelUpdate"];
    handleLlmModels: (res: Parameters<Parameters<typeof createLlmApiRoutes>[0]["handleLlmModels"]>[1]) => void;
  };
};

function createWorkflowRuntimeCoreRoutes({
  buildValidationHandlers,
  llmHandlers
}: WorkflowRuntimeCoreRouteHandlers): readonly ApiRoute[] {
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
      handleDeckDomPreview: (_req, res) => createJsonResponse(res, 200, getDomPreviewState({ includeDetours: true })),
      handleDeckPreview: (_req, res) => createJsonResponse(res, 200, getPreviewManifest())
    })
  ];
}

export { createWorkflowRuntimeCoreRoutes };
export type { WorkflowRuntimeCoreRouteHandlers };
