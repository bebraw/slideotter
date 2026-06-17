import { createMaterialSourceApiRoutes } from "./material-source-routes.ts";
import { createOperationApiRoutes } from "./operation-routes.ts";
import type { ApiRoute } from "./api-route-types.ts";

type WorkflowEditorMaterialOperationRouteHandlers = {
  materialSourceHandlers: {
    handleMaterialUpload: Parameters<typeof createMaterialSourceApiRoutes>[0]["handleMaterialUpload"];
    handleMaterialsIndex: (res: Parameters<Parameters<typeof createMaterialSourceApiRoutes>[0]["handleMaterialsIndex"]>[1]) => void;
    handleSourceCreate: Parameters<typeof createMaterialSourceApiRoutes>[0]["handleSourceCreate"];
    handleSourceDelete: Parameters<typeof createMaterialSourceApiRoutes>[0]["handleSourceDelete"];
    handleSourcesIndex: (res: Parameters<Parameters<typeof createMaterialSourceApiRoutes>[0]["handleSourcesIndex"]>[1]) => void;
    handleSvglImport: Parameters<typeof createMaterialSourceApiRoutes>[0]["handleSvglImport"];
    handleSvglSearch: Parameters<typeof createMaterialSourceApiRoutes>[0]["handleSvglSearch"];
  };
  operationHandlers: {
    handleDrillWording: Parameters<typeof createOperationApiRoutes>[0]["handleDrillWording"];
    handleIdeateDeckStructure: Parameters<typeof createOperationApiRoutes>[0]["handleIdeateDeckStructure"];
    handleIdeateSlide: Parameters<typeof createOperationApiRoutes>[0]["handleIdeateSlide"];
    handleIdeateStructure: Parameters<typeof createOperationApiRoutes>[0]["handleIdeateStructure"];
    handleIdeateTheme: Parameters<typeof createOperationApiRoutes>[0]["handleIdeateTheme"];
    handleRedoLayout: Parameters<typeof createOperationApiRoutes>[0]["handleRedoLayout"];
    handleRefineDeckNarration: Parameters<typeof createOperationApiRoutes>[0]["handleRefineDeckNarration"];
    handleRefineNarration: Parameters<typeof createOperationApiRoutes>[0]["handleRefineNarration"];
    handleVariantApply: Parameters<typeof createOperationApiRoutes>[0]["handleVariantApply"];
    handleVariantCapture: Parameters<typeof createOperationApiRoutes>[0]["handleVariantCapture"];
  };
};

function createWorkflowEditorMaterialOperationRoutes(handlers: WorkflowEditorMaterialOperationRouteHandlers): readonly ApiRoute[] {
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

export { createWorkflowEditorMaterialOperationRoutes };
export type { WorkflowEditorMaterialOperationRouteHandlers };
