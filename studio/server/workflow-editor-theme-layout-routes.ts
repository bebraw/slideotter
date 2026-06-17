import { createLayoutApiRoutes } from "./layout-routes.ts";
import { createThemeApiRoutes } from "./theme-routes.ts";
import type { ApiRoute } from "./api-route-types.ts";

type WorkflowEditorThemeLayoutRouteHandlers = {
  layoutHandlers: {
    handleFavoriteLayoutDelete: Parameters<typeof createLayoutApiRoutes>[0]["handleFavoriteLayoutDelete"];
    handleFavoriteLayoutSave: Parameters<typeof createLayoutApiRoutes>[0]["handleFavoriteLayoutSave"];
    handleLayoutApply: Parameters<typeof createLayoutApiRoutes>[0]["handleLayoutApply"];
    handleLayoutCandidateSave: Parameters<typeof createLayoutApiRoutes>[0]["handleLayoutCandidateSave"];
    handleLayoutExport: Parameters<typeof createLayoutApiRoutes>[0]["handleLayoutExport"];
    handleLayoutImport: Parameters<typeof createLayoutApiRoutes>[0]["handleLayoutImport"];
    handleLayoutSave: Parameters<typeof createLayoutApiRoutes>[0]["handleLayoutSave"];
    handleLayoutsIndex: (res: Parameters<Parameters<typeof createLayoutApiRoutes>[0]["handleLayoutsIndex"]>[1]) => void;
  };
  operationHandlers: {
    handleCustomLayoutDraft: Parameters<typeof createLayoutApiRoutes>[0]["handleCustomLayoutDraft"];
    handleCustomLayoutPreview: Parameters<typeof createLayoutApiRoutes>[0]["handleCustomLayoutPreview"];
  };
  themeHandlers: {
    handleRuntimeThemeSave: Parameters<typeof createThemeApiRoutes>[0]["handleRuntimeThemeSave"];
    handleThemeCandidates: Parameters<typeof createThemeApiRoutes>[0]["handleThemeCandidates"];
    handleThemeGenerate: Parameters<typeof createThemeApiRoutes>[0]["handleThemeGenerate"];
  };
};

function createWorkflowEditorThemeLayoutRoutes(handlers: WorkflowEditorThemeLayoutRouteHandlers): readonly ApiRoute[] {
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

export { createWorkflowEditorThemeLayoutRoutes };
export type { WorkflowEditorThemeLayoutRouteHandlers };
