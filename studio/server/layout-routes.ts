import type { ApiRoute } from "./routes.ts";

type LayoutRouteHandlers = {
  handleCustomLayoutDraft: ApiRoute["handler"];
  handleCustomLayoutPreview: ApiRoute["handler"];
  handleFavoriteLayoutDelete: ApiRoute["handler"];
  handleFavoriteLayoutSave: ApiRoute["handler"];
  handleLayoutApply: ApiRoute["handler"];
  handleLayoutCandidateSave: ApiRoute["handler"];
  handleLayoutExport: ApiRoute["handler"];
  handleLayoutImport: ApiRoute["handler"];
  handleLayoutSave: ApiRoute["handler"];
  handleLayoutsIndex: ApiRoute["handler"];
};

export function createLayoutApiRoutes(handlers: LayoutRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/layouts", handler: handlers.handleLayoutsIndex },
    { method: "POST", pathname: "/api/layouts/save", handler: handlers.handleLayoutSave },
    { method: "POST", pathname: "/api/layouts/favorites/save", handler: handlers.handleFavoriteLayoutSave },
    { method: "POST", pathname: "/api/layouts/candidates/save", handler: handlers.handleLayoutCandidateSave },
    { method: "POST", pathname: "/api/layouts/favorites/delete", handler: handlers.handleFavoriteLayoutDelete },
    { method: "POST", pathname: "/api/layouts/export", handler: handlers.handleLayoutExport },
    { method: "POST", pathname: "/api/layouts/import", handler: handlers.handleLayoutImport },
    { method: "POST", pathname: "/api/layouts/apply", handler: handlers.handleLayoutApply },
    { method: "POST", pathname: "/api/layouts/custom/preview", handler: handlers.handleCustomLayoutPreview },
    { method: "POST", pathname: "/api/layouts/custom/draft", handler: handlers.handleCustomLayoutDraft }
  ];
}
