import { createAssistantApiRoutes } from "./assistant-routes.ts";
import { createNarrationApiRoutes } from "./narration-routes.ts";
import type { ApiRoute } from "./api-route-types.ts";

type WorkflowRuntimeInteractionRouteHandlers = {
  assistantHandlers: {
    handleAssistantSend: Parameters<typeof createAssistantApiRoutes>[0]["handleAssistantSend"];
    handleAssistantSession: Parameters<typeof createAssistantApiRoutes>[0]["handleAssistantSession"];
  };
  narrationHandlers: {
    handleNarrationStatus: Parameters<typeof createNarrationApiRoutes>[0]["handleNarrationStatus"];
    handleNarrationSynthesize: Parameters<typeof createNarrationApiRoutes>[0]["handleNarrationSynthesize"];
  };
};

function createWorkflowRuntimeInteractionRoutes({
  assistantHandlers,
  narrationHandlers
}: WorkflowRuntimeInteractionRouteHandlers): readonly ApiRoute[] {
  return [
    ...createNarrationApiRoutes({
      handleNarrationStatus: narrationHandlers.handleNarrationStatus,
      handleNarrationSynthesize: narrationHandlers.handleNarrationSynthesize
    }),
    ...createAssistantApiRoutes({
      handleAssistantSend: assistantHandlers.handleAssistantSend,
      handleAssistantSession: assistantHandlers.handleAssistantSession
    })
  ];
}

export { createWorkflowRuntimeInteractionRoutes };
export type { WorkflowRuntimeInteractionRouteHandlers };
