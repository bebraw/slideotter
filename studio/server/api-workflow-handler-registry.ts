import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import type { SharedHandlerDependencies } from "./api-handler-registry.ts";

function createWorkflowHandlerRegistry(deps: SharedHandlerDependencies) {
  const buildValidationHandlers = createBuildValidationHandlers({
    createJsonResponse: deps.createJsonResponse,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
  const llmHandlers = createLlmHandlers({
    createJsonResponse: deps.createJsonResponse,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState
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
  const operationHandlers = createOperationHandlers({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    describeStructuredSlide: deps.describeStructuredSlide,
    isVisualThemePayload: deps.isVisualThemePayload,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    serializeSlideSpec: deps.serializeSlideSpec,
    updateWorkflowState: deps.updateWorkflowState
  });
  const outlinePlanHandlers = createOutlinePlanHandlers({
    buildCompactPresentationSourceText: deps.buildCompactPresentationSourceText,
    createJsonResponse: deps.createJsonResponse,
    createPresentationPayload: deps.createPresentationPayload,
    deckPlanSlides: deps.deckPlanSlides,
    isJsonObject: deps.isJsonObject,
    isOutlinePlanPayload: deps.isOutlinePlanPayload,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    normalizeCreationFields: deps.normalizeCreationFields,
    publishCreationDraftUpdate: deps.publishCreationDraftUpdate,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    resetPresentationRuntime: deps.resetPresentationRuntime,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
  const creationDraftHandlers = createCreationDraftHandlers({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    deckPlanSlides: deps.deckPlanSlides,
    isDeckPlanPayload: deps.isDeckPlanPayload,
    isJsonObject: deps.isJsonObject,
    normalizeCreationFields: deps.normalizeCreationFields,
    publishCreationDraftUpdate: deps.publishCreationDraftUpdate,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
  const creationContentRunHandlers = createCreationContentRunHandlers({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    errorCode: deps.errorCode,
    errorMessage: deps.errorMessage,
    isJsonObject: deps.isJsonObject,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    normalizeCreationFields: deps.normalizeCreationFields,
    publishCreationDraftUpdate: deps.publishCreationDraftUpdate,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    resetPresentationRuntime: deps.resetPresentationRuntime,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
  const assistantHandlers = createAssistantHandlers({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });

  return {
    assistantHandlers,
    buildValidationHandlers,
    creationContentRunHandlers,
    creationDraftHandlers,
    deckSlideHandlers,
    layoutHandlers,
    llmHandlers,
    operationHandlers,
    outlinePlanHandlers,
    presentationHandlers,
    themeHandlers
  };
}

export { createWorkflowHandlerRegistry };
