import type { ApiRoute } from "./routes.ts";

type CreationOutlineRouteHandlers = {
  handleOutlinePlanArchive: ApiRoute["handler"];
  handleOutlinePlanDelete: ApiRoute["handler"];
  handleOutlinePlanDerive: ApiRoute["handler"];
  handleOutlinePlanDuplicate: ApiRoute["handler"];
  handleOutlinePlanGenerate: ApiRoute["handler"];
  handleOutlinePlanPropose: ApiRoute["handler"];
  handleOutlinePlanSave: ApiRoute["handler"];
  handleOutlinePlanStageCreation: ApiRoute["handler"];
  handlePresentationDraftApprove: ApiRoute["handler"];
  handlePresentationDraftContentAcceptPartial: ApiRoute["handler"];
  handlePresentationDraftContentRetry: ApiRoute["handler"];
  handlePresentationDraftContentStop: ApiRoute["handler"];
  handlePresentationDraftCreate: ApiRoute["handler"];
  handlePresentationDraftOutline: ApiRoute["handler"];
  handlePresentationDraftOutlineSlide: ApiRoute["handler"];
  handlePresentationDraftSave: ApiRoute["handler"];
};

export function createCreationOutlineApiRoutes(handlers: CreationOutlineRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/v1/presentations/draft", handler: handlers.handlePresentationDraftSave },
    { method: "POST", pathname: "/api/v1/presentations/draft/outline", handler: handlers.handlePresentationDraftOutline },
    { method: "POST", pathname: "/api/v1/presentations/draft/outline/slide", handler: handlers.handlePresentationDraftOutlineSlide },
    { method: "POST", pathname: "/api/v1/presentations/draft/approve", handler: handlers.handlePresentationDraftApprove },
    { method: "POST", pathname: "/api/v1/presentations/draft/create", handler: handlers.handlePresentationDraftCreate },
    { method: "POST", pathname: "/api/v1/outline-plans/generate", handler: handlers.handleOutlinePlanGenerate },
    { method: "POST", pathname: "/api/v1/outline-plans", handler: handlers.handleOutlinePlanSave },
    { method: "POST", pathname: "/api/v1/outline-plans/delete", handler: handlers.handleOutlinePlanDelete },
    { method: "POST", pathname: "/api/v1/outline-plans/duplicate", handler: handlers.handleOutlinePlanDuplicate },
    { method: "POST", pathname: "/api/v1/outline-plans/archive", handler: handlers.handleOutlinePlanArchive },
    { method: "POST", pathname: "/api/v1/outline-plans/propose", handler: handlers.handleOutlinePlanPropose },
    { method: "POST", pathname: "/api/v1/outline-plans/stage-creation", handler: handlers.handleOutlinePlanStageCreation },
    { method: "POST", pathname: "/api/v1/outline-plans/derive", handler: handlers.handleOutlinePlanDerive },
    { method: "POST", pathname: "/api/v1/presentations/draft/content/retry", handler: handlers.handlePresentationDraftContentRetry },
    { method: "POST", pathname: "/api/v1/presentations/draft/content/accept-partial", handler: handlers.handlePresentationDraftContentAcceptPartial },
    { method: "POST", pathname: "/api/v1/presentations/draft/content/stop", handler: handlers.handlePresentationDraftContentStop }
  ];
}
