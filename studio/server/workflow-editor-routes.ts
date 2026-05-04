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

function createWorkflowEditorRoutes({
  customVisualHandlers,
  deckSlideHandlers,
  layoutHandlers,
  materialSourceHandlers,
  operationHandlers,
  themeHandlers
}: WorkflowEditorRouteHandlers): readonly ApiRoute[] {
  return [
    ...createThemeApiRoutes({
      handleRuntimeThemeSave: themeHandlers.handleRuntimeThemeSave,
      handleThemeCandidates: themeHandlers.handleThemeCandidates,
      handleThemeGenerate: themeHandlers.handleThemeGenerate
    }),
    ...createLayoutApiRoutes({
      handleCustomLayoutDraft: operationHandlers.handleCustomLayoutDraft,
      handleCustomLayoutPreview: operationHandlers.handleCustomLayoutPreview,
      handleFavoriteLayoutDelete: layoutHandlers.handleFavoriteLayoutDelete,
      handleFavoriteLayoutSave: layoutHandlers.handleFavoriteLayoutSave,
      handleLayoutApply: layoutHandlers.handleLayoutApply,
      handleLayoutCandidateSave: layoutHandlers.handleLayoutCandidateSave,
      handleLayoutExport: layoutHandlers.handleLayoutExport,
      handleLayoutImport: layoutHandlers.handleLayoutImport,
      handleLayoutSave: layoutHandlers.handleLayoutSave,
      handleLayoutsIndex: (_req, res) => layoutHandlers.handleLayoutsIndex(res)
    }),
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
    ...createMaterialSourceApiRoutes({
      handleMaterialUpload: materialSourceHandlers.handleMaterialUpload,
      handleMaterialsIndex: (_req, res) => materialSourceHandlers.handleMaterialsIndex(res),
      handleSourceCreate: materialSourceHandlers.handleSourceCreate,
      handleSourceDelete: materialSourceHandlers.handleSourceDelete,
      handleSourcesIndex: (_req, res) => materialSourceHandlers.handleSourcesIndex(res)
    }),
    ...createCustomVisualApiRoutes({
      handleCustomVisualCreate: customVisualHandlers.handleCustomVisualCreate,
      handleCustomVisualsIndex: (_req, res) => customVisualHandlers.handleCustomVisualsIndex(res)
    }),
    ...createOperationApiRoutes({
      handleDrillWording: operationHandlers.handleDrillWording,
      handleIdeateDeckStructure: operationHandlers.handleIdeateDeckStructure,
      handleIdeateSlide: operationHandlers.handleIdeateSlide,
      handleIdeateStructure: operationHandlers.handleIdeateStructure,
      handleIdeateTheme: operationHandlers.handleIdeateTheme,
      handleRedoLayout: operationHandlers.handleRedoLayout,
      handleVariantApply: operationHandlers.handleVariantApply,
      handleVariantCapture: operationHandlers.handleVariantCapture
    })
  ];
}

export { createWorkflowEditorRoutes };
