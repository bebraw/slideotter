import type { ApiRoute } from "./routes.ts";

type PreviewRouteHandlers = {
  handleDeckDomPreview: ApiRoute["handler"];
  handleDeckPreview: ApiRoute["handler"];
};

export function createPreviewApiRoutes(handlers: PreviewRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/v1/preview/deck", handler: handlers.handleDeckPreview },
    { method: "GET", pathname: "/api/v1/dom-preview/deck", handler: handlers.handleDeckDomPreview }
  ];
}
