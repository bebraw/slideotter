import type { ApiRoute } from "./routes.ts";

type RouteHandler = ApiRoute["handler"];

type PresentationRouteOptions = {
  handlePresentationCreate: RouteHandler;
  handlePresentationDelete: RouteHandler;
  handlePresentationDuplicate: RouteHandler;
  handlePresentationRegenerate: RouteHandler;
  handlePresentationSelect: RouteHandler;
  handlePresentationsIndex: RouteHandler;
};

export function createPresentationApiRoutes(options: PresentationRouteOptions): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/v1/presentations", handler: options.handlePresentationsIndex },
    { method: "POST", pathname: "/api/v1/presentations/select", handler: options.handlePresentationSelect },
    { method: "POST", pathname: "/api/v1/presentations", handler: options.handlePresentationCreate },
    { method: "POST", pathname: "/api/v1/presentations/duplicate", handler: options.handlePresentationDuplicate },
    { method: "POST", pathname: "/api/v1/presentations/regenerate", handler: options.handlePresentationRegenerate },
    { method: "POST", pathname: "/api/v1/presentations/delete", handler: options.handlePresentationDelete }
  ];
}
