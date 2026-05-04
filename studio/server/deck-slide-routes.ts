import type { ApiRoute } from "./routes.ts";

type RouteHandler = ApiRoute["handler"];

type DeckSlideRouteOptions = {
  handleDeckContextUpdate: RouteHandler;
  handleDeckLengthApply: RouteHandler;
  handleDeckLengthPlan: RouteHandler;
  handleDeckStructureApply: RouteHandler;
  handleManualSlideDelete: RouteHandler;
  handleManualSlidesReorder: RouteHandler;
  handleManualSystemSlideCreate: RouteHandler;
  handleSkippedSlideRestore: RouteHandler;
};

export function createDeckSlideApiRoutes(options: DeckSlideRouteOptions): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/v1/context", handler: options.handleDeckContextUpdate },
    { method: "POST", pathname: "/api/v1/context/deck-structure/apply", handler: options.handleDeckStructureApply },
    { method: "POST", pathname: "/api/v1/deck/scale-length/plan", handler: options.handleDeckLengthPlan },
    { method: "POST", pathname: "/api/v1/deck/scale-length/apply", handler: options.handleDeckLengthApply },
    { method: "POST", pathname: "/api/v1/slides/restore-skipped", handler: options.handleSkippedSlideRestore },
    { method: "POST", pathname: "/api/v1/slides/system", handler: options.handleManualSystemSlideCreate },
    { method: "POST", pathname: "/api/v1/slides/delete", handler: options.handleManualSlideDelete },
    { method: "POST", pathname: "/api/v1/slides/reorder", handler: options.handleManualSlidesReorder }
  ];
}
