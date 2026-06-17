import type { ApiHandlerRegistry } from "./api-handler-registry.ts";
import type { ApiPatternRoute } from "./routes.ts";
import type { ApiRoute } from "./routes.ts";
import { createRootResourceRoutes } from "./root-resource-routes.ts";
import { createSlideRouteRegistry } from "./slide-route-registry.ts";
import { createWorkflowRouteRegistry } from "./workflow-route-registry.ts";

type ApiRouteRegistry = {
  slideApiRoutes: readonly ApiPatternRoute[];
  versionedApiRoutes: readonly ApiRoute[];
  workflowApiRoutes: readonly ApiRoute[];
};

function createApiRouteRegistry(handlers: ApiHandlerRegistry): ApiRouteRegistry {
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
