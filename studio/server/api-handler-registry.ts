import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import {
  createWorkflowProgressReporter,
  publishCreationDraftUpdate,
  publishRuntimeState,
  resetPresentationRuntime,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
} from "./runtime-state.ts";
import { createPresentationPayload } from "./workspace-state.ts";
import {
  createJsonResponse,
  readJsonBody
} from "./http-responses.ts";
import {
  deckPlanSlides,
  isDeckPlanPayload,
  isJsonObject,
  isOutlinePlanPayload,
  isSlideSpecPayload,
  isVisualThemePayload,
  jsonObjectOrEmpty,
  normalizeCreationFields
} from "./api-payloads.ts";
import { buildCompactPresentationSourceText } from "./presentation-source-summary.ts";
import {
  errorCode,
  errorMessage
} from "./server-errors.ts";
import {
  describeStructuredSlide,
  serializeSlideSpec
} from "./slide-response-helpers.ts";

function createApiHandlerRegistry() {
  const buildValidationHandlers = createBuildValidationHandlers({
    createJsonResponse,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });
  const llmHandlers = createLlmHandlers({
    createJsonResponse,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState
  });
  const presentationHandlers = createPresentationHandlers({
    createJsonResponse,
    createPresentationPayload,
    createWorkflowProgressReporter,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    updateWorkflowState
  });
  const materialSourceHandlers = createMaterialSourceHandlers({
    createJsonResponse,
    describeStructuredSlide,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    serializeSlideSpec,
    updateWorkflowState
  });
  const customVisualHandlers = createCustomVisualHandlers({
    createJsonResponse,
    describeStructuredSlide,
    publishRuntimeState,
    readJsonBody,
    serializeSlideSpec
  });
  const layoutHandlers = createLayoutHandlers({
    createJsonResponse,
    describeStructuredSlide,
    isJsonObject,
    isSlideSpecPayload,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeSlideSpec
  });
  const themeHandlers = createThemeHandlers({
    createJsonResponse,
    readJsonBody,
    updateWorkflowState
  });
  const deckSlideHandlers = createDeckSlideHandlers({
    createJsonResponse,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });
  const operationHandlers = createOperationHandlers({
    createJsonResponse,
    createWorkflowProgressReporter,
    describeStructuredSlide,
    isVisualThemePayload,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    serializeSlideSpec,
    updateWorkflowState
  });
  const outlinePlanHandlers = createOutlinePlanHandlers({
    buildCompactPresentationSourceText,
    createJsonResponse,
    createPresentationPayload,
    deckPlanSlides,
    isJsonObject,
    isOutlinePlanPayload,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });
  const creationDraftHandlers = createCreationDraftHandlers({
    createJsonResponse,
    createWorkflowProgressReporter,
    deckPlanSlides,
    isDeckPlanPayload,
    isJsonObject,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });
  const creationContentRunHandlers = createCreationContentRunHandlers({
    createJsonResponse,
    createWorkflowProgressReporter,
    errorCode,
    errorMessage,
    isJsonObject,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });
  const slideEditHandlers = createSlideEditHandlers({
    createJsonResponse,
    describeStructuredSlide,
    isJsonObject,
    isSlideSpecPayload,
    isVisualThemePayload,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeSlideSpec
  });
  const assistantHandlers = createAssistantHandlers({
    createJsonResponse,
    createWorkflowProgressReporter,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });

  return {
    assistantHandlers,
    buildValidationHandlers,
    creationContentRunHandlers,
    creationDraftHandlers,
    customVisualHandlers,
    deckSlideHandlers,
    layoutHandlers,
    llmHandlers,
    materialSourceHandlers,
    operationHandlers,
    outlinePlanHandlers,
    presentationHandlers,
    slideEditHandlers,
    themeHandlers
  };
}

export { createApiHandlerRegistry };
