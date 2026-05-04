import { createCreationContentRunControlHandlers } from "./creation-content-run-control-handlers.ts";
import { createPresentationDraftCreateHandler } from "./creation-content-run-create-handler.ts";
import { createContentRunHelpers } from "./creation-content-run-helpers.ts";
import { createPresentationDraftContentRetryHandler } from "./creation-content-run-retry-handler.ts";
import type { CreationContentRunHandlerDependencies } from "./creation-content-run-types.ts";

export function createCreationContentRunHandlers(deps: CreationContentRunHandlerDependencies) {
  const {
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
  } = deps;

  const helpers = createContentRunHelpers(isJsonObject);
  const contentRunControlHandlers = createCreationContentRunControlHandlers({
    createJsonResponse,
    helpers,
    isJsonObject,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  });
  const handlePresentationDraftCreate = createPresentationDraftCreateHandler({
    createJsonResponse,
    createWorkflowProgressReporter,
    errorCode,
    errorMessage,
    helpers,
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
  const handlePresentationDraftContentRetry = createPresentationDraftContentRetryHandler({
    createJsonResponse,
    createWorkflowProgressReporter,
    errorCode,
    errorMessage,
    helpers,
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

  return {
    handlePresentationDraftContentAcceptPartial: contentRunControlHandlers.handlePresentationDraftContentAcceptPartial,
    handlePresentationDraftContentRetry,
    handlePresentationDraftContentStop: contentRunControlHandlers.handlePresentationDraftContentStop,
    handlePresentationDraftCreate
  };
}
