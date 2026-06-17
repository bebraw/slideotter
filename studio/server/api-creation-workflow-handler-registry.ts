import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import type { SharedHandlerDependencies } from "./api-handler-registry.ts";

function createCreationLlmHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createLlmHandlers> {
  return createLlmHandlers({
    createJsonResponse: deps.createJsonResponse,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState
  });
}

function createCreationOperationHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createOperationHandlers> {
  return createOperationHandlers({
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
}

function createCreationOutlinePlanHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createOutlinePlanHandlers> {
  return createOutlinePlanHandlers({
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
}

function createCreationDraftFlowHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createCreationDraftHandlers> {
  return createCreationDraftHandlers({
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
}

function createCreationContentFlowHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createCreationContentRunHandlers> {
  return createCreationContentRunHandlers({
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
}

function createCreationAssistantHandlers(deps: SharedHandlerDependencies): ReturnType<typeof createAssistantHandlers> {
  return createAssistantHandlers({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    updateWorkflowState: deps.updateWorkflowState
  });
}

function createCreationWorkflowHandlerRegistry(deps: SharedHandlerDependencies) {
  const llmHandlers = createCreationLlmHandlers(deps);
  const operationHandlers = createCreationOperationHandlers(deps);
  const outlinePlanHandlers = createCreationOutlinePlanHandlers(deps);
  const creationDraftHandlers = createCreationDraftFlowHandlers(deps);
  const creationContentRunHandlers = createCreationContentFlowHandlers(deps);
  const assistantHandlers = createCreationAssistantHandlers(deps);

  return {
    assistantHandlers,
    creationContentRunHandlers,
    creationDraftHandlers,
    llmHandlers,
    operationHandlers,
    outlinePlanHandlers
  };
}

export { createCreationWorkflowHandlerRegistry };
