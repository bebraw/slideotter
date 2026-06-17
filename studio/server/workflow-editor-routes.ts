import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createCustomVisualApiRoutes } from "./custom-visual-routes.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createDeckSlideApiRoutes } from "./deck-slide-routes.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createLayoutApiRoutes } from "./layout-routes.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { createMaterialSourceApiRoutes } from "./material-source-routes.ts";
import { type ApiRoute } from "./routes.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createThemeApiRoutes } from "./theme-routes.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOperationApiRoutes } from "./operation-routes.ts";

type WorkflowEditorRouteHandlers = {
  customVisualHandlers: ReturnType<typeof createCustomVisualHandlers>;
  deckSlideHandlers: ReturnType<typeof createDeckSlideHandlers>;
  layoutHandlers: ReturnType<typeof createLayoutHandlers>;
  materialSourceHandlers: ReturnType<typeof createMaterialSourceHandlers>;
  operationHandlers: ReturnType<typeof createOperationHandlers>;
  themeHandlers: ReturnType<typeof createThemeHandlers>;
};

function createThemeAndLayoutRoutes(handlers: WorkflowEditorRouteHandlers): readonly ApiRoute[] {
  return [
    ...createThemeApiRoutes({
      handleRuntimeThemeSave: handlers.themeHandlers.handleRuntimeThemeSave,
      handleThemeCandidates: handlers.themeHandlers.handleThemeCandidates,
      handleThemeGenerate: handlers.themeHandlers.handleThemeGenerate
    }),
    ...createLayoutApiRoutes({
      handleCustomLayoutDraft: handlers.operationHandlers.handleCustomLayoutDraft,
      handleCustomLayoutPreview: handlers.operationHandlers.handleCustomLayoutPreview,
      handleFavoriteLayoutDelete: handlers.layoutHandlers.handleFavoriteLayoutDelete,
      handleFavoriteLayoutSave: handlers.layoutHandlers.handleFavoriteLayoutSave,
      handleLayoutApply: handlers.layoutHandlers.handleLayoutApply,
      handleLayoutCandidateSave: handlers.layoutHandlers.handleLayoutCandidateSave,
      handleLayoutExport: handlers.layoutHandlers.handleLayoutExport,
      handleLayoutImport: handlers.layoutHandlers.handleLayoutImport,
      handleLayoutSave: handlers.layoutHandlers.handleLayoutSave,
      handleLayoutsIndex: (_req, res) => handlers.layoutHandlers.handleLayoutsIndex(res)
    })
  ];
}

function createMaterialAndOperationRoutes(handlers: WorkflowEditorRouteHandlers): readonly ApiRoute[] {
  return [
    ...createMaterialSourceApiRoutes({
      handleMaterialUpload: handlers.materialSourceHandlers.handleMaterialUpload,
      handleMaterialsIndex: (_req, res) => handlers.materialSourceHandlers.handleMaterialsIndex(res),
      handleSvglImport: handlers.materialSourceHandlers.handleSvglImport,
      handleSvglSearch: handlers.materialSourceHandlers.handleSvglSearch,
      handleSourceCreate: handlers.materialSourceHandlers.handleSourceCreate,
      handleSourceDelete: handlers.materialSourceHandlers.handleSourceDelete,
      handleSourcesIndex: (_req, res) => handlers.materialSourceHandlers.handleSourcesIndex(res)
    }),
    ...createOperationApiRoutes({
      handleDrillWording: handlers.operationHandlers.handleDrillWording,
      handleIdeateDeckStructure: handlers.operationHandlers.handleIdeateDeckStructure,
      handleIdeateSlide: handlers.operationHandlers.handleIdeateSlide,
      handleIdeateStructure: handlers.operationHandlers.handleIdeateStructure,
      handleIdeateTheme: handlers.operationHandlers.handleIdeateTheme,
      handleRefineDeckNarration: handlers.operationHandlers.handleRefineDeckNarration,
      handleRefineNarration: handlers.operationHandlers.handleRefineNarration,
      handleRedoLayout: handlers.operationHandlers.handleRedoLayout,
      handleVariantApply: handlers.operationHandlers.handleVariantApply,
      handleVariantCapture: handlers.operationHandlers.handleVariantCapture
    })
  ];
}

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
    ...createThemeAndLayoutRoutes(handlers),
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
    ...createMaterialAndOperationRoutes(handlers)
  ];
}

export { createWorkflowEditorRoutes };
