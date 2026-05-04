import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { type ApiRoute } from "./routes.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createWorkflowCreationRoutes } from "./workflow-creation-routes.ts";
import { createWorkflowEditorRoutes } from "./workflow-editor-routes.ts";
import { createWorkflowRuntimeRoutes } from "./workflow-runtime-routes.ts";

type WorkflowRouteRegistryHandlers = {
  assistantHandlers: ReturnType<typeof createAssistantHandlers>;
  buildValidationHandlers: ReturnType<typeof createBuildValidationHandlers>;
  creationContentRunHandlers: ReturnType<typeof createCreationContentRunHandlers>;
  creationDraftHandlers: ReturnType<typeof createCreationDraftHandlers>;
  customVisualHandlers: ReturnType<typeof createCustomVisualHandlers>;
  deckSlideHandlers: ReturnType<typeof createDeckSlideHandlers>;
  layoutHandlers: ReturnType<typeof createLayoutHandlers>;
  llmHandlers: ReturnType<typeof createLlmHandlers>;
  materialSourceHandlers: ReturnType<typeof createMaterialSourceHandlers>;
  operationHandlers: ReturnType<typeof createOperationHandlers>;
  outlinePlanHandlers: ReturnType<typeof createOutlinePlanHandlers>;
  presentationHandlers: ReturnType<typeof createPresentationHandlers>;
  themeHandlers: ReturnType<typeof createThemeHandlers>;
};

function createWorkflowRouteRegistry(handlers: WorkflowRouteRegistryHandlers): readonly ApiRoute[] {
  return [
    ...createWorkflowRuntimeRoutes({
      assistantHandlers: handlers.assistantHandlers,
      buildValidationHandlers: handlers.buildValidationHandlers,
      llmHandlers: handlers.llmHandlers
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
