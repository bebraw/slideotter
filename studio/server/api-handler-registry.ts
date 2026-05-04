import { createSlideHandlerRegistry } from "./api-slide-handler-registry.ts";
import { createWorkflowHandlerRegistry } from "./api-workflow-handler-registry.ts";
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

function createSharedHandlerDependencies() {
  return {
    buildCompactPresentationSourceText,
    createJsonResponse,
    createPresentationPayload,
    createWorkflowProgressReporter,
    deckPlanSlides,
    describeStructuredSlide,
    errorCode,
    errorMessage,
    isDeckPlanPayload,
    isJsonObject,
    isOutlinePlanPayload,
    isSlideSpecPayload,
    isVisualThemePayload,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    serializeSlideSpec,
    updateWorkflowState
  };
}

type SharedHandlerDependencies = ReturnType<typeof createSharedHandlerDependencies>;

function createApiHandlerRegistry() {
  const deps = createSharedHandlerDependencies();

  return {
    ...createSlideHandlerRegistry(deps),
    ...createWorkflowHandlerRegistry(deps)
  };
}

export { createApiHandlerRegistry };
export type { SharedHandlerDependencies };
