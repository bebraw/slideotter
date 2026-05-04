import type { ApiRoute } from "./routes.ts";

type PreviewRouteHandlers = {
  handleDeckDomPreview: ApiRoute["handler"];
  handleDeckPreview: ApiRoute["handler"];
};

export function createPreviewApiRoutes(handlers: PreviewRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/preview/deck", handler: handlers.handleDeckPreview },
    { method: "GET", pathname: "/api/dom-preview/deck", handler: handlers.handleDeckDomPreview }
  ];
}
