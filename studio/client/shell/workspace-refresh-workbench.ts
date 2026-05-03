import { StudioClientWorkspaceState } from "../api/workspace-state.ts";
import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientPresentationCreationControl } from "../creation/presentation-creation-control.ts";
import { StudioClientPresentationCreationWorkbench } from "../creation/presentation-creation-workbench.ts";

export namespace StudioClientWorkspaceRefreshWorkbench {
  type WorkspacePayload = StudioClientWorkspaceState.WorkspacePayload;
  type PresentationCreationWorkbench = ReturnType<typeof StudioClientPresentationCreationWorkbench.createPresentationCreationWorkbench>;

  export type WorkspaceRefreshWorkbenchOptions = {
    elements: StudioClientElements.Elements;
    loadSlide: (slideId: string) => Promise<void>;
    presentationCreationWorkbench: PresentationCreationWorkbench;
    renderAssistant: () => void;
    renderCreationDraft: () => void;
    renderCustomLayoutLibrary: () => void;
    renderDeckFields: () => void;
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    renderOutlinePlans: () => void;
    renderPresentationLibrary: () => void;
    renderPreviews: () => void;
    renderSavedThemes: () => void;
    renderSources: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    request: <T>(url: string, options?: StudioClientCore.JsonRequestOptions) => Promise<T>;
    state: StudioClientState.State;
    syncSelectedSlideToActiveList: () => StudioClientState.StudioSlide | null;
  };

  export type WorkspaceRefreshWorkbench = {
    refreshState: () => Promise<void>;
  };

  export function createWorkspaceRefreshWorkbench({
    elements,
    loadSlide,
    presentationCreationWorkbench,
    renderAssistant,
    renderCreationDraft,
    renderCustomLayoutLibrary,
    renderDeckFields,
    renderDeckLengthPlan,
    renderDeckStructureCandidates,
    renderOutlinePlans,
    renderPresentationLibrary,
    renderPreviews,
    renderSavedThemes,
    renderSources,
    renderStatus,
    renderVariants,
    request,
    state,
    syncSelectedSlideToActiveList
  }: WorkspaceRefreshWorkbenchOptions): WorkspaceRefreshWorkbench {
    return {
      refreshState: async () => {
        const [payload, apiRoot] = await Promise.all([
          request<WorkspacePayload>("/api/state"),
          request<StudioClientState.HypermediaResource>("/api/v1")
        ]);
        const activePresentation = apiRoot && apiRoot.links && apiRoot.links.activePresentation && apiRoot.links.activePresentation.href
          ? await request<StudioClientState.HypermediaResource>(apiRoot.links.activePresentation.href)
          : null;

        StudioClientWorkspaceState.applyWorkspacePayload(state, payload, apiRoot, activePresentation);
        elements.deckLengthTarget.value = "";

        syncSelectedSlideToActiveList();
        StudioClientPresentationCreationControl.hydrateDraftFields({
          state,
          workbench: presentationCreationWorkbench
        });

        renderDeckFields();
        renderDeckLengthPlan();
        renderDeckStructureCandidates();
        renderSavedThemes();
        renderCreationDraft();
        renderPresentationLibrary();
        renderAssistant();
        renderStatus();
        renderPreviews();
        renderCustomLayoutLibrary();
        renderOutlinePlans();
        renderSources();
        renderVariants();

        if (state.selectedSlideId) {
          await loadSlide(state.selectedSlideId);
        }
      }
    };
  }
}
