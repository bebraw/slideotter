import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createCustomVisualApiRoutes } from "./custom-visual-routes.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createDeckSlideApiRoutes } from "./deck-slide-routes.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import type { ApiRoute } from "./api-route-types.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import {
  createWorkflowEditorMaterialOperationRoutes,
  type WorkflowEditorMaterialOperationRouteHandlers
} from "./workflow-editor-material-operation-routes.ts";
import {
  createWorkflowEditorThemeLayoutRoutes,
  type WorkflowEditorThemeLayoutRouteHandlers
} from "./workflow-editor-theme-layout-routes.ts";

type WorkflowEditorRouteHandlers = {
  customVisualHandlers: ReturnType<typeof createCustomVisualHandlers>;
  deckSlideHandlers: ReturnType<typeof createDeckSlideHandlers>;
  layoutHandlers: ReturnType<typeof createLayoutHandlers>;
  materialSourceHandlers: ReturnType<typeof createMaterialSourceHandlers>;
  operationHandlers: ReturnType<typeof createOperationHandlers>;
  themeHandlers: ReturnType<typeof createThemeHandlers>;
} & WorkflowEditorMaterialOperationRouteHandlers & WorkflowEditorThemeLayoutRouteHandlers;

function createWorkflowEditorRoutes({
  customVisualHandlers,
  deckSlideHandlers,
  layoutHandlers,
  materialSourceHandlers,
  operationHandlers,
  themeHandlers
}: WorkflowEditorRouteHandlers): readonly ApiRoute[] {
  const handlers = {
    customVisualHandlers,
    deckSlideHandlers,
    layoutHandlers,
    materialSourceHandlers,
    operationHandlers,
    themeHandlers
  };
  return [
    ...createWorkflowEditorThemeLayoutRoutes(handlers),
    ...createDeckSlideApiRoutes({
      handleDeckContextUpdate: deckSlideHandlers.handleDeckContextUpdate,
      handleDeckLengthApply: deckSlideHandlers.handleDeckLengthApply,
      handleDeckLengthPlan: deckSlideHandlers.handleDeckLengthPlan,
      handleDeckStructureApply: deckSlideHandlers.handleDeckStructureApply,
      handleManualSlideDelete: deckSlideHandlers.handleManualSlideDelete,
      handleManualSlidesReorder: deckSlideHandlers.handleManualSlidesReorder,
      handleManualSystemSlideCreate: deckSlideHandlers.handleManualSystemSlideCreate,
      handleSkippedSlideRestore: deckSlideHandlers.handleSkippedSlideRestore
    }),
    ...createCustomVisualApiRoutes({
      handleCustomVisualCreate: customVisualHandlers.handleCustomVisualCreate,
      handleCustomVisualsIndex: (_req, res) => customVisualHandlers.handleCustomVisualsIndex(res)
    }),
    ...createWorkflowEditorMaterialOperationRoutes(handlers)
  ];
}

export { createWorkflowEditorRoutes };
