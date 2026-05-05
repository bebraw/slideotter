import { StudioClientDomPreviewState } from "../preview/dom-preview-state.ts";
import type { StudioClientState } from "../core/state.ts";
import { StudioClientWorkflowStatus } from "../runtime/workflow-status.ts";

export namespace StudioClientPresentationCreationState {
  type JsonRecord = StudioClientState.JsonRecord;

  export type CreationRunSlide = JsonRecord & {
    error?: string;
    errorLogPath?: string;
    slideSpec?: JsonRecord;
    status?: string;
  };

  export type CreationDraft = JsonRecord & {
    contentRun?: {
      completed?: number;
      failedSlideIndex?: number;
      id?: string;
      slideCount?: number;
      slides?: CreationRunSlide[];
      status?: string;
    };
    approvedOutline?: boolean;
    createdPresentationId?: string;
    deckPlan?: JsonRecord & {
      narrativeArc?: string;
      outline?: string;
      slides?: JsonRecord[];
      thesis?: string;
    };
    fields?: JsonRecord;
    outlineDirty?: boolean;
    outlineLocks?: Record<string, boolean>;
    retrieval?: JsonRecord & {
      snippets?: Array<{ text?: string; title?: string }>;
    };
    stage?: string;
  };

  export type PresentationSummary = JsonRecord & {
    id: string;
    title?: string;
  };

  export type OutlinePlanSlide = JsonRecord & {
    intent?: string;
    layoutHint?: string;
    mustInclude?: string[];
    sourceSlideId?: string;
    value?: string;
    workingTitle?: string;
  };

  export type OutlinePlanSection = JsonRecord & {
    intent?: string;
    slides?: OutlinePlanSlide[];
    title?: string;
  };

  export type OutlinePlan = JsonRecord & {
    id: string;
    name?: string;
    objective?: string;
    purpose?: string;
    sections?: OutlinePlanSection[];
  };

  export type PresentationState = {
    activePresentationId: string | null;
    presentations: PresentationSummary[];
  };

  export function getPresentationState(state: StudioClientState.State): PresentationState {
    return {
      activePresentationId: state.presentations.activePresentationId || null,
      presentations: Array.isArray(state.presentations.presentations) ? state.presentations.presentations : []
    };
  }

  export function isWorkflowRunning(state: StudioClientState.State): boolean {
    return StudioClientWorkflowStatus.isRuntimeWorkflowRunning(state.runtime);
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
      && !String(fields.lang || "").trim()
      && !String(fields.objective || "").trim()
      && !String(fields.constraints || "").trim()
      && !String(fields.presentationSourceUrls || "").trim()
      && !String(fields.presentationSourceText || "").trim()
      && !String(fields.themeBrief || "").trim()
      && !String(imageSearch.query || "").trim()
      && !String(imageSearch.restrictions || "").trim();
  }
}
