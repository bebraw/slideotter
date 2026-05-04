import type { ApiRoute } from "./routes.ts";

type OperationRouteHandlers = {
  handleDrillWording: ApiRoute["handler"];
  handleIdeateDeckStructure: ApiRoute["handler"];
  handleIdeateSlide: ApiRoute["handler"];
  handleIdeateStructure: ApiRoute["handler"];
  handleIdeateTheme: ApiRoute["handler"];
  handleRedoLayout: ApiRoute["handler"];
  handleVariantApply: ApiRoute["handler"];
  handleVariantCapture: ApiRoute["handler"];
};

export function createOperationApiRoutes(handlers: OperationRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/variants/capture", handler: handlers.handleVariantCapture },
    { method: "POST", pathname: "/api/variants/apply", handler: handlers.handleVariantApply },
    { method: "POST", pathname: "/api/operations/ideate-slide", handler: handlers.handleIdeateSlide },
    { method: "POST", pathname: "/api/operations/drill-wording", handler: handlers.handleDrillWording },
    { method: "POST", pathname: "/api/operations/ideate-theme", handler: handlers.handleIdeateTheme },
    { method: "POST", pathname: "/api/operations/ideate-deck-structure", handler: handlers.handleIdeateDeckStructure },
    { method: "POST", pathname: "/api/operations/ideate-structure", handler: handlers.handleIdeateStructure },
    { method: "POST", pathname: "/api/operations/redo-layout", handler: handlers.handleRedoLayout }
  ];
}
