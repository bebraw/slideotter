import type { ApiRoute } from "./routes.ts";

type RouteHandler = ApiRoute["handler"];

type MaterialSourceRouteOptions = {
  handleMaterialUpload: RouteHandler;
  handleMaterialsIndex: RouteHandler;
  handleSourceCreate: RouteHandler;
  handleSourceDelete: RouteHandler;
  handleSourcesIndex: RouteHandler;
};

export function createMaterialSourceApiRoutes(options: MaterialSourceRouteOptions): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/v1/materials", handler: options.handleMaterialsIndex },
    { method: "POST", pathname: "/api/v1/materials", handler: options.handleMaterialUpload },
    { method: "GET", pathname: "/api/v1/sources", handler: options.handleSourcesIndex },
    { method: "POST", pathname: "/api/v1/sources", handler: options.handleSourceCreate },
    { method: "POST", pathname: "/api/v1/sources/delete", handler: options.handleSourceDelete }
  ];
}
