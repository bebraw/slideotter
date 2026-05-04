import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { type ApiPatternRoute, type ApiRoute } from "./routes.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";
import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createRootResourceRoutes } from "./root-resource-routes.ts";
import { createSlideRouteRegistry } from "./slide-route-registry.ts";
import { createWorkflowRouteRegistry } from "./workflow-route-registry.ts";

type ApiRouteRegistryHandlers = {
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
  slideEditHandlers: ReturnType<typeof createSlideEditHandlers>;
  themeHandlers: ReturnType<typeof createThemeHandlers>;
};

type ApiRouteRegistry = {
  slideApiRoutes: readonly ApiPatternRoute[];
  versionedApiRoutes: readonly ApiRoute[];
  workflowApiRoutes: readonly ApiRoute[];
};

function createApiRouteRegistry(handlers: ApiRouteRegistryHandlers): ApiRouteRegistry {
  return {
    slideApiRoutes: createSlideRouteRegistry({
      customVisualHandlers: handlers.customVisualHandlers,
      materialSourceHandlers: handlers.materialSourceHandlers,
      slideEditHandlers: handlers.slideEditHandlers
    }),
    versionedApiRoutes: createRootResourceRoutes(),
    workflowApiRoutes: createWorkflowRouteRegistry(handlers)
  };
}

export { createApiRouteRegistry };
