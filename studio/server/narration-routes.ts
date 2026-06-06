import type { ApiRoute } from "./routes.ts";

type NarrationRouteHandlers = {
  handleNarrationStatus: ApiRoute["handler"];
  handleNarrationSynthesize: ApiRoute["handler"];
};

function createNarrationApiRoutes(handlers: NarrationRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/v1/narration/status", handler: handlers.handleNarrationStatus },
    { method: "POST", pathname: "/api/v1/narration/synthesize", handler: handlers.handleNarrationSynthesize }
  ];
}

export { createNarrationApiRoutes };
