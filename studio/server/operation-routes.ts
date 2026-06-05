import type { ApiRoute } from "./routes.ts";

type OperationRouteHandlers = {
  handleDrillWording: ApiRoute["handler"];
  handleIdeateDeckStructure: ApiRoute["handler"];
  handleIdeateSlide: ApiRoute["handler"];
  handleIdeateStructure: ApiRoute["handler"];
  handleIdeateTheme: ApiRoute["handler"];
  handleRefineDeckNarration: ApiRoute["handler"];
  handleRefineNarration: ApiRoute["handler"];
  handleRedoLayout: ApiRoute["handler"];
  handleVariantApply: ApiRoute["handler"];
  handleVariantCapture: ApiRoute["handler"];
};

export function createOperationApiRoutes(handlers: OperationRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/v1/variants/capture", handler: handlers.handleVariantCapture },
    { method: "POST", pathname: "/api/v1/variants/apply", handler: handlers.handleVariantApply },
    { method: "POST", pathname: "/api/v1/operations/ideate-slide", handler: handlers.handleIdeateSlide },
    { method: "POST", pathname: "/api/v1/operations/drill-wording", handler: handlers.handleDrillWording },
    { method: "POST", pathname: "/api/v1/operations/ideate-theme", handler: handlers.handleIdeateTheme },
    { method: "POST", pathname: "/api/v1/operations/ideate-deck-structure", handler: handlers.handleIdeateDeckStructure },
    { method: "POST", pathname: "/api/v1/operations/ideate-structure", handler: handlers.handleIdeateStructure },
    { method: "POST", pathname: "/api/v1/operations/refine-narration", handler: handlers.handleRefineNarration },
    { method: "POST", pathname: "/api/v1/operations/refine-deck-narration", handler: handlers.handleRefineDeckNarration },
    { method: "POST", pathname: "/api/v1/operations/redo-layout", handler: handlers.handleRedoLayout }
  ];
}
