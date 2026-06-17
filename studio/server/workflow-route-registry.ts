import type { ApiHandlerRegistry } from "./api-handler-registry.ts";
import type { ApiRoute } from "./api-route-types.ts";
import { createWorkflowCreationRoutes } from "./workflow-creation-routes.ts";
import { createWorkflowEditorRoutes } from "./workflow-editor-routes.ts";
import { createWorkflowRuntimeRoutes } from "./workflow-runtime-routes.ts";

function createWorkflowRouteRegistry(handlers: ApiHandlerRegistry): readonly ApiRoute[] {
  return [
    ...createWorkflowRuntimeRoutes({
      assistantHandlers: handlers.assistantHandlers,
      buildValidationHandlers: handlers.buildValidationHandlers,
      llmHandlers: handlers.llmHandlers,
      narrationHandlers: handlers.narrationHandlers
    }),
    ...createWorkflowCreationRoutes({
      creationContentRunHandlers: handlers.creationContentRunHandlers,
      creationDraftHandlers: handlers.creationDraftHandlers,
      outlinePlanHandlers: handlers.outlinePlanHandlers,
      presentationHandlers: handlers.presentationHandlers
    }),
    ...createWorkflowEditorRoutes({
      customVisualHandlers: handlers.customVisualHandlers,
      deckSlideHandlers: handlers.deckSlideHandlers,
      layoutHandlers: handlers.layoutHandlers,
      materialSourceHandlers: handlers.materialSourceHandlers,
      operationHandlers: handlers.operationHandlers,
      themeHandlers: handlers.themeHandlers
    })
  ];
}

export { createWorkflowRouteRegistry };
