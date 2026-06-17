import { StudioClientState } from "../core/state.ts";
import { isJsonRecord } from "../preview/dom-preview-record.ts";
import { setFromPayload } from "../preview/dom-preview-slides.ts";

export namespace StudioClientWorkspaceState {
  type JsonRecord = StudioClientState.JsonRecord;
  type VariantRecord = StudioClientState.VariantRecord;

  export type WorkspacePayload = JsonRecord & {
    activeOutlinePlanId?: string;
    assistant?: StudioClientState.State["assistant"];
    context: StudioClientState.DeckContext;
    creationDraft?: StudioClientState.CreationDraft | null;
    favoriteLayouts?: StudioClientState.SavedLayout[];
    layouts?: StudioClientState.SavedLayout[];
    materials?: JsonRecord[];
    customVisuals?: JsonRecord[];
    outlinePlans?: StudioClientState.OutlinePlan[];
    presentations?: StudioClientState.State["presentations"];
    previews: StudioClientState.State["previews"];
    runtime: StudioClientState.State["runtime"];
    savedThemes?: StudioClientState.SavedTheme[];
    skippedSlides?: StudioClientState.StudioSlide[];
    slides: StudioClientState.StudioSlide[];
    sources?: StudioClientState.SourceRecord[];
    variants?: VariantRecord[];
    variantStorage?: unknown;
  };

  function fallbackValue<T>(value: T | undefined, fallback: T): T {
    return value === undefined ? fallback : value;
  }

  function fallbackArray<T>(value: T[] | undefined): T[] {
    return value === undefined ? [] : value;
  }

  function activeOutlinePlanId(payload: WorkspacePayload): string {
    return typeof payload.activeOutlinePlanId === "string" ? payload.activeOutlinePlanId : "";
  }

  function applyWorkspaceContent(state: StudioClientState.State, payload: WorkspacePayload): void {
    state.assistant = fallbackValue(payload.assistant, { selection: null, session: null, suggestions: [] });
    state.context = payload.context;
    state.creationDraft = fallbackValue(payload.creationDraft, null);
    state.deckStructureCandidates = [];
    state.favoriteLayouts = fallbackArray(payload.favoriteLayouts);
    state.layouts = fallbackArray(payload.layouts);
    state.materials = fallbackArray(payload.materials);
    state.customVisuals = fallbackArray(payload.customVisuals);
    state.activeOutlinePlanId = activeOutlinePlanId(payload);
    state.outlinePlans = fallbackArray(payload.outlinePlans);
    state.presentations = fallbackValue(payload.presentations, { activePresentationId: null, presentations: [] });
    state.previews = payload.previews;
    state.runtime = payload.runtime;
  }

  function applyWorkspaceCollections(state: StudioClientState.State, payload: WorkspacePayload): void {
    state.skippedSlides = fallbackArray(payload.skippedSlides);
    state.savedThemes = fallbackArray(payload.savedThemes);
    state.sources = fallbackArray(payload.sources);
    state.slides = payload.slides;
    state.transientVariants = [];
    state.variantStorage = fallbackValue(payload.variantStorage, null);
    state.variants = fallbackArray(payload.variants);
  }

  function applyWorkspaceSelectionState(state: StudioClientState.State): void {
    state.selectedDeckStructureId = null;
    state.deckLengthPlan = null;
  }

  function applyWorkspaceHypermedia(
    state: StudioClientState.State,
    apiRoot: StudioClientState.HypermediaResource,
    activePresentation: StudioClientState.HypermediaResource | null
  ): void {
    state.hypermedia = {
      ...(state.hypermedia || {}),
      activePresentation,
      root: apiRoot
    };
  }

  function applyWorkflowHistory(state: StudioClientState.State, payload: WorkspacePayload): void {
    const runtimeHistory = payload.runtime && Array.isArray(payload.runtime.workflowHistory)
      ? payload.runtime.workflowHistory
      : [];
    state.workflowHistory = runtimeHistory.filter((entry: unknown): entry is StudioClientState.WorkflowState => isJsonRecord(entry));
  }

  export function applyWorkspacePayload(
    state: StudioClientState.State,
    payload: WorkspacePayload,
    apiRoot: StudioClientState.HypermediaResource,
    activePresentation: StudioClientState.HypermediaResource | null
  ): void {
    applyWorkspaceContent(state, payload);
    applyWorkspaceHypermedia(state, apiRoot, activePresentation);
    setFromPayload(state, payload);
    applyWorkflowHistory(state, payload);
    applyWorkspaceSelectionState(state);
    applyWorkspaceCollections(state, payload);
  }
}
