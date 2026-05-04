import type { SharedHandlerDependencies } from "./api-handler-registry.ts";
import { createCreationWorkflowHandlerRegistry } from "./api-creation-workflow-handler-registry.ts";
import { createRuntimeWorkflowHandlerRegistry } from "./api-runtime-workflow-handler-registry.ts";

function createWorkflowHandlerRegistry(deps: SharedHandlerDependencies) {
  return {
    ...createCreationWorkflowHandlerRegistry(deps),
    ...createRuntimeWorkflowHandlerRegistry(deps)
  };
}

export { createWorkflowHandlerRegistry };
