import type { ApiRoute } from "./routes.ts";

type RouteHandler = ApiRoute["handler"];

type BuildValidationRouteOptions = {
  handleBuild: RouteHandler;
  handleCheckRemediation: RouteHandler;
  handlePptxExport: RouteHandler;
  handleValidate: RouteHandler;
};

export function createBuildValidationApiRoutes(options: BuildValidationRouteOptions): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/v1/build", handler: options.handleBuild },
    { method: "POST", pathname: "/api/v1/exports/pptx", handler: options.handlePptxExport },
    { method: "POST", pathname: "/api/v1/validate", handler: options.handleValidate },
    { method: "POST", pathname: "/api/v1/checks/remediate", handler: options.handleCheckRemediation }
  ];
}
