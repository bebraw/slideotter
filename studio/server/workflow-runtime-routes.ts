import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createNarrationHandlers } from "./narration-handlers.ts";
import type { ApiRoute } from "./routes.ts";
import {
  createWorkflowRuntimeCoreRoutes,
  type WorkflowRuntimeCoreRouteHandlers
} from "./workflow-runtime-core-routes.ts";
import {
  createWorkflowRuntimeInteractionRoutes,
  type WorkflowRuntimeInteractionRouteHandlers
} from "./workflow-runtime-interaction-routes.ts";

type WorkflowRuntimeRouteHandlers = {
  assistantHandlers: ReturnType<typeof createAssistantHandlers>;
  buildValidationHandlers: ReturnType<typeof createBuildValidationHandlers>;
  llmHandlers: ReturnType<typeof createLlmHandlers>;
  narrationHandlers: ReturnType<typeof createNarrationHandlers>;
} & WorkflowRuntimeCoreRouteHandlers & WorkflowRuntimeInteractionRouteHandlers;

function createWorkflowRuntimeRoutes({
  assistantHandlers,
  buildValidationHandlers,
  llmHandlers,
  narrationHandlers
}: WorkflowRuntimeRouteHandlers): readonly ApiRoute[] {
  return [
    ...createWorkflowRuntimeCoreRoutes({
      buildValidationHandlers,
      llmHandlers
    }),
    ...createWorkflowRuntimeInteractionRoutes({
      assistantHandlers,
      narrationHandlers
    })
  ];
}

export { createWorkflowRuntimeRoutes };
