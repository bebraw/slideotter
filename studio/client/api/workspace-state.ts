import { StudioClientDomPreviewState } from "../preview/dom-preview-state.ts";
import { StudioClientState } from "../state.ts";

export namespace StudioClientWorkspaceState {
  type JsonRecord = StudioClientState.JsonRecord;
  type VariantRecord = StudioClientState.VariantRecord;

  export type WorkspacePayload = JsonRecord & {
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

  export function applyWorkspacePayload(
    state: StudioClientState.State,
    payload: WorkspacePayload,
    apiRoot: StudioClientState.HypermediaResource,
    activePresentation: StudioClientState.HypermediaResource | null
  ): void {
    state.assistant = payload.assistant || { selection: null, session: null, suggestions: [] };
    state.context = payload.context;
    state.creationDraft = payload.creationDraft || null;
    state.deckStructureCandidates = [];
    state.favoriteLayouts = payload.favoriteLayouts || [];
    state.hypermedia = {
      ...(state.hypermedia || {}),
      activePresentation,
      root: apiRoot
    };
    state.layouts = payload.layouts || [];
    state.materials = payload.materials || [];
    state.customVisuals = payload.customVisuals || [];
    state.outlinePlans = payload.outlinePlans || [];
    StudioClientDomPreviewState.setFromPayload(state, payload);
    state.presentations = payload.presentations || { activePresentationId: null, presentations: [] };
    state.previews = payload.previews;
    state.runtime = payload.runtime;
    state.skippedSlides = payload.skippedSlides || [];
    state.savedThemes = payload.savedThemes || [];
    state.sources = payload.sources || [];
    const runtimeHistory = payload.runtime && Array.isArray(payload.runtime.workflowHistory)
      ? payload.runtime.workflowHistory
      : [];
    state.workflowHistory = runtimeHistory.filter((entry: unknown): entry is StudioClientState.WorkflowState => (
      StudioClientDomPreviewState.isJsonRecord(entry)
    ));
    state.selectedDeckStructureId = null;
    state.deckLengthPlan = null;
    state.slides = payload.slides;
    state.transientVariants = [];
    state.variantStorage = payload.variantStorage || null;
    state.variants = payload.variants || [];
  }
}
