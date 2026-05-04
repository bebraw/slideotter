import type { ApiRoute } from "./routes.ts";

type ThemeRouteHandlers = {
  handleRuntimeThemeSave: ApiRoute["handler"];
  handleThemeCandidates: ApiRoute["handler"];
  handleThemeGenerate: ApiRoute["handler"];
};

export function createThemeApiRoutes(handlers: ThemeRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/v1/themes/save", handler: handlers.handleRuntimeThemeSave },
    { method: "POST", pathname: "/api/v1/themes/generate", handler: handlers.handleThemeGenerate },
    { method: "POST", pathname: "/api/v1/themes/candidates", handler: handlers.handleThemeCandidates }
  ];
}
