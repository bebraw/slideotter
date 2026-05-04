import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createCreationOutlineApiRoutes } from "./creation-outline-routes.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createPresentationApiRoutes } from "./presentation-routes.ts";
import { type ApiRoute } from "./routes.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";

type WorkflowCreationRouteHandlers = {
  creationContentRunHandlers: ReturnType<typeof createCreationContentRunHandlers>;
  creationDraftHandlers: ReturnType<typeof createCreationDraftHandlers>;
  outlinePlanHandlers: ReturnType<typeof createOutlinePlanHandlers>;
  presentationHandlers: ReturnType<typeof createPresentationHandlers>;
};

function createWorkflowCreationRoutes({
  creationContentRunHandlers,
  creationDraftHandlers,
  outlinePlanHandlers,
  presentationHandlers
}: WorkflowCreationRouteHandlers): readonly ApiRoute[] {
  return [
    ...createPresentationApiRoutes({
      handlePresentationCreate: presentationHandlers.handlePresentationCreate,
      handlePresentationDelete: presentationHandlers.handlePresentationDelete,
      handlePresentationDuplicate: presentationHandlers.handlePresentationDuplicate,
      handlePresentationRegenerate: presentationHandlers.handlePresentationRegenerate,
      handlePresentationSelect: presentationHandlers.handlePresentationSelect,
      handlePresentationsIndex: (_req, res) => presentationHandlers.handlePresentationsIndex(res)
    }),
    ...createCreationOutlineApiRoutes({
      handleOutlinePlanArchive: outlinePlanHandlers.handleOutlinePlanArchive,
      handleOutlinePlanDelete: outlinePlanHandlers.handleOutlinePlanDelete,
      handleOutlinePlanDerive: outlinePlanHandlers.handleOutlinePlanDerive,
      handleOutlinePlanDuplicate: outlinePlanHandlers.handleOutlinePlanDuplicate,
      handleOutlinePlanGenerate: outlinePlanHandlers.handleOutlinePlanGenerate,
      handleOutlinePlanPropose: outlinePlanHandlers.handleOutlinePlanPropose,
      handleOutlinePlanSave: outlinePlanHandlers.handleOutlinePlanSave,
      handleOutlinePlanStageCreation: outlinePlanHandlers.handleOutlinePlanStageCreation,
      handlePresentationDraftApprove: creationDraftHandlers.handlePresentationDraftApprove,
      handlePresentationDraftContentAcceptPartial: (_req, res) => creationContentRunHandlers.handlePresentationDraftContentAcceptPartial(res),
      handlePresentationDraftContentRetry: creationContentRunHandlers.handlePresentationDraftContentRetry,
      handlePresentationDraftContentStop: (_req, res) => creationContentRunHandlers.handlePresentationDraftContentStop(res),
      handlePresentationDraftCreate: creationContentRunHandlers.handlePresentationDraftCreate,
      handlePresentationDraftOutline: creationDraftHandlers.handlePresentationDraftOutline,
      handlePresentationDraftOutlineSlide: creationDraftHandlers.handlePresentationDraftOutlineSlide,
      handlePresentationDraftSave: creationDraftHandlers.handlePresentationDraftSave
    })
  ];
}

export { createWorkflowCreationRoutes };
