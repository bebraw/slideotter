import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createNarrationHandlers } from "./narration-handlers.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import type { SharedHandlerDependencies } from "./api-handler-registry.ts";

function createRuntimeBuildValidationHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createBuildValidationHandlers> {
  return createBuildValidationHandlers({
    createJsonResponse: deps.createJsonResponse,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
}

function createRuntimePresentationHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createPresentationHandlers> {
  return createPresentationHandlers({
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
}

function createRuntimeLayoutHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createLayoutHandlers> {
  return createLayoutHandlers({
    createJsonResponse: deps.createJsonResponse,
    describeStructuredSlide: deps.describeStructuredSlide,
    isJsonObject: deps.isJsonObject,
    isSlideSpecPayload: deps.isSlideSpecPayload,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeSlideSpec: deps.serializeSlideSpec
  });
}

function createRuntimeThemeHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createThemeHandlers> {
  return createThemeHandlers({
    createJsonResponse: deps.createJsonResponse,
    readJsonBody: deps.readJsonBody,
    updateWorkflowState: deps.updateWorkflowState
  });
}

function createRuntimeDeckSlideHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createDeckSlideHandlers> {
  return createDeckSlideHandlers({
    createJsonResponse: deps.createJsonResponse,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
}

function createRuntimeNarrationHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createNarrationHandlers> {
  return createNarrationHandlers({
    createJsonResponse: deps.createJsonResponse,
    readJsonBody: deps.readJsonBody
  });
}

function createRuntimeWorkflowHandlerRegistry(deps: SharedHandlerDependencies) {
  const buildValidationHandlers = createRuntimeBuildValidationHandlers(deps);
  const presentationHandlers = createRuntimePresentationHandlers(deps);
  const layoutHandlers = createRuntimeLayoutHandlers(deps);
  const themeHandlers = createRuntimeThemeHandlers(deps);
  const deckSlideHandlers = createRuntimeDeckSlideHandlers(deps);
  const narrationHandlers = createRuntimeNarrationHandlers(deps);

  return {
    buildValidationHandlers,
    deckSlideHandlers,
    layoutHandlers,
    narrationHandlers,
    presentationHandlers,
    themeHandlers
  };
}

export { createRuntimeWorkflowHandlerRegistry };
