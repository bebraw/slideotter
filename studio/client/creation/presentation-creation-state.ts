import { StudioClientDomPreviewState } from "../preview/dom-preview-state.ts";
import { StudioClientState } from "../state.ts";

export namespace StudioClientPresentationCreationState {
  export type PresentationState = {
    activePresentationId: string | null;
    presentations: StudioClientState.PresentationSummary[];
  };

  export function getPresentationState(state: StudioClientState.State): PresentationState {
    return {
      activePresentationId: state.presentations.activePresentationId || null,
      presentations: Array.isArray(state.presentations.presentations) ? state.presentations.presentations : []
    };
  }

  export function isWorkflowRunning(state: StudioClientState.State): boolean {
    const workflow = state.runtime && state.runtime.workflow;
    return Boolean(workflow && workflow.status === "running");
  }

  export function isEmptyCreationDraft(draft: StudioClientState.CreationDraft | null): boolean {
    if (!draft || typeof draft !== "object") {
      return true;
    }

    const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};
    const imageSearch = StudioClientDomPreviewState.isJsonRecord(fields.imageSearch) ? fields.imageSearch : {};
    return !draft.contentRun
      && !draft.createdPresentationId
      && !draft.deckPlan
      && !String(fields.title || "").trim()
      && !String(fields.audience || "").trim()
      && !String(fields.tone || "").trim()
      && !String(fields.objective || "").trim()
      && !String(fields.constraints || "").trim()
      && !String(fields.presentationSourceText || "").trim()
      && !String(fields.themeBrief || "").trim()
      && !String(imageSearch.query || "").trim()
      && !String(imageSearch.restrictions || "").trim();
  }
}
