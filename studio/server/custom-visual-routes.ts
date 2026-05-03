import type { ApiRoute } from "./routes.ts";

type RouteHandler = ApiRoute["handler"];

type CustomVisualRouteOptions = {
  handleCustomVisualCreate: RouteHandler;
  handleCustomVisualsIndex: RouteHandler;
};

export function createCustomVisualApiRoutes(options: CustomVisualRouteOptions): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/custom-visuals", handler: options.handleCustomVisualsIndex },
    { method: "POST", pathname: "/api/custom-visuals", handler: options.handleCustomVisualCreate }
  ];
}
