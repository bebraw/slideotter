import type { StudioClientState } from "../core/state.ts";
import { isJsonRecord } from "../preview/dom-preview-record.ts";
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
    presentationDensity?: "spacious" | "balanced" | "dense";
    purpose?: string;
    sections?: OutlinePlanSection[];
    targetSlideCount?: number;
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

  const emptyDraftTextFields = [
    "title",
    "audience",
    "tone",
    "lang",
    "objective",
    "constraints",
    "presentationSourceUrls",
    "presentationSourceText",
    "themeBrief"
  ];

  function draftFields(draft: StudioClientState.CreationDraft): JsonRecord {
    return draft.fields && typeof draft.fields === "object" ? draft.fields : {};
  }

  function hasDraftText(fields: JsonRecord): boolean {
    return emptyDraftTextFields.some((field) => String(fields[field] || "").trim());
  }

  function hasImageSearchText(fields: JsonRecord): boolean {
    const imageSearch = isJsonRecord(fields.imageSearch) ? fields.imageSearch : {};
    return Boolean(String(imageSearch.query || "").trim() || String(imageSearch.restrictions || "").trim());
  }

  function hasNonDefaultDensity(fields: JsonRecord): boolean {
    return fields.presentationDensity === "balanced" || fields.presentationDensity === "dense";
  }

  export function isEmptyCreationDraft(draft: StudioClientState.CreationDraft | null): boolean {
    if (!draft || typeof draft !== "object") {
      return true;
    }

    const fields = draftFields(draft);
    return !draft.contentRun
      && !draft.createdPresentationId
      && !draft.deckPlan
      && !hasDraftText(fields)
      && !hasNonDefaultDensity(fields)
      && !hasImageSearchText(fields);
  }
}
