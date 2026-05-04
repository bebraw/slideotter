import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import type { SharedHandlerDependencies } from "./api-handler-registry.ts";

function createRuntimeWorkflowHandlerRegistry(deps: SharedHandlerDependencies) {
  const buildValidationHandlers = createBuildValidationHandlers({
    createJsonResponse: deps.createJsonResponse,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
  const presentationHandlers = createPresentationHandlers({
    createJsonResponse: deps.createJsonResponse,
    createPresentationPayload: deps.createPresentationPayload,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    resetPresentationRuntime: deps.resetPresentationRuntime,
    runtimeState: deps.runtimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
  const layoutHandlers = createLayoutHandlers({
    createJsonResponse: deps.createJsonResponse,
    describeStructuredSlide: deps.describeStructuredSlide,
    isJsonObject: deps.isJsonObject,
    isSlideSpecPayload: deps.isSlideSpecPayload,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeSlideSpec: deps.serializeSlideSpec
  });
  const themeHandlers = createThemeHandlers({
    createJsonResponse: deps.createJsonResponse,
    readJsonBody: deps.readJsonBody,
    updateWorkflowState: deps.updateWorkflowState
  });
  const deckSlideHandlers = createDeckSlideHandlers({
    createJsonResponse: deps.createJsonResponse,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });

  return {
    buildValidationHandlers,
    deckSlideHandlers,
    layoutHandlers,
    presentationHandlers,
    themeHandlers
  };
}

export { createRuntimeWorkflowHandlerRegistry };
