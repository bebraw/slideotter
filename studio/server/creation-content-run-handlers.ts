import { createCreationContentRunControlHandlers } from "./creation-content-run-control-handlers.ts";
import { createPresentationDraftCreateHandler } from "./creation-content-run-create-handler.ts";
import { createContentRunHelpers } from "./creation-content-run-helpers.ts";
import { createPresentationDraftContentRetryHandler } from "./creation-content-run-retry-handler.ts";
import type { CreationContentRunHandlerDependencies } from "./creation-content-run-types.ts";

function createContentRunControlHandlers(
  deps: CreationContentRunHandlerDependencies,
  helpers: ReturnType<typeof createContentRunHelpers>
): ReturnType<typeof createCreationContentRunControlHandlers> {
  const {
    createJsonResponse,
    isJsonObject,
    jsonObjectOrEmpty,
    normalizeCreationFields,
    publishCreationDraftUpdate,
    publishRuntimeState,
    resetPresentationRuntime,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  return createCreationContentRunControlHandlers({
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
}

function createContentRunDraftCreateHandler(
  deps: CreationContentRunHandlerDependencies,
  helpers: ReturnType<typeof createContentRunHelpers>
): ReturnType<typeof createPresentationDraftCreateHandler> {
  return createPresentationDraftCreateHandler({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    errorCode: deps.errorCode,
    helpers,
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

function createContentRunRetryHandler(
  deps: CreationContentRunHandlerDependencies,
  helpers: ReturnType<typeof createContentRunHelpers>
): ReturnType<typeof createPresentationDraftContentRetryHandler> {
  return createPresentationDraftContentRetryHandler({
    createJsonResponse: deps.createJsonResponse,
    createWorkflowProgressReporter: deps.createWorkflowProgressReporter,
    errorCode: deps.errorCode,
    helpers,
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

export function createCreationContentRunHandlers(deps: CreationContentRunHandlerDependencies) {
  const helpers = createContentRunHelpers(deps.isJsonObject);
  const contentRunControlHandlers = createContentRunControlHandlers(deps, helpers);
  const handlePresentationDraftCreate = createContentRunDraftCreateHandler(deps, helpers);
  const handlePresentationDraftContentRetry = createContentRunRetryHandler(deps, helpers);

  return {
    handlePresentationDraftContentAcceptPartial: contentRunControlHandlers.handlePresentationDraftContentAcceptPartial,
    handlePresentationDraftContentRetry,
    handlePresentationDraftContentStop: contentRunControlHandlers.handlePresentationDraftContentStop,
    handlePresentationDraftCreate
  };
}
