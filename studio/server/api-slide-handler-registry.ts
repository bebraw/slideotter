import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";
import type { SharedHandlerDependencies } from "./api-handler-registry.ts";

function createSlideHandlerRegistry(deps: SharedHandlerDependencies) {
  const materialSourceHandlers = createMaterialSourceHandlers({
    createJsonResponse: deps.createJsonResponse,
    describeStructuredSlide: deps.describeStructuredSlide,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeRuntimeState: deps.serializeRuntimeState,
    serializeSlideSpec: deps.serializeSlideSpec,
    updateWorkflowState: deps.updateWorkflowState
  });
  const customVisualHandlers = createCustomVisualHandlers({
    createJsonResponse: deps.createJsonResponse,
    describeStructuredSlide: deps.describeStructuredSlide,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    serializeSlideSpec: deps.serializeSlideSpec
  });
  const slideEditHandlers = createSlideEditHandlers({
    createJsonResponse: deps.createJsonResponse,
    describeStructuredSlide: deps.describeStructuredSlide,
    isJsonObject: deps.isJsonObject,
    isSlideSpecPayload: deps.isSlideSpecPayload,
    isVisualThemePayload: deps.isVisualThemePayload,
    jsonObjectOrEmpty: deps.jsonObjectOrEmpty,
    publishRuntimeState: deps.publishRuntimeState,
    readJsonBody: deps.readJsonBody,
    runtimeState: deps.runtimeState,
    serializeSlideSpec: deps.serializeSlideSpec
  });

  return {
    customVisualHandlers,
    materialSourceHandlers,
    slideEditHandlers
  };
}

export { createSlideHandlerRegistry };
