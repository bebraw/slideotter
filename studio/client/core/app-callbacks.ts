import type { StudioClientPresentationCreationState } from "../creation/presentation-creation-state.ts";

export namespace StudioClientAppCallbacks {
  type RuntimeStatusActions = {
    renderStatus: () => void;
  };

  type NavigationShell = {
    setAssistantDrawerOpen: (open: boolean) => void;
    setChecksPanelOpen: (open: boolean) => void;
    setCurrentPage: (page: string) => void;
    setThemeDrawerOpen: (open: boolean) => void;
  };

  type VariantReviewActions = {
    render: () => void;
    renderComparison: () => void;
  };

  type DeckPlanningActions = {
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    setDeckStructureCandidates: (candidates: unknown[] | undefined) => void;
  };

  type DeckContextActions = {
    renderDeckFields: () => void;
  };

  type AssistantActions = {
    renderSelection: () => void;
  };

  type PreviewActions = {
    render: () => void;
  };

  type PresentationCreationActions = {
    getPresentationState: () => StudioClientPresentationCreationState.PresentationState;
    isWorkflowRunning: () => boolean;
  };

  type ThemeActions = {
    resetThemeCandidates: () => void;
  };

  type ThemePanelActions = {
    renderSavedThemes: () => void;
    renderStage: () => void;
  };

  type PresentationCreationWorkbench = {
    renderDraft: () => void;
  };

  type SlideLoadActions = {
    loadSlide: (slideId: string) => Promise<void>;
  };

  type WorkspaceRefreshActions = {
    refreshState: () => Promise<void>;
  };

  export type AppCallbacksOptions = {
    getAssistantActions: () => AssistantActions;
    getDeckContextActions: () => DeckContextActions;
    getDeckPlanningActions: () => DeckPlanningActions;
    getNavigationShell: () => NavigationShell;
    getPresentationCreationActions: () => PresentationCreationActions;
    getPresentationCreationWorkbench: () => PresentationCreationWorkbench;
    getPreviewActions: () => PreviewActions;
    getRuntimeStatusActions: () => RuntimeStatusActions;
    getSlideLoadActions: () => SlideLoadActions;
    getThemeActions: () => ThemeActions;
    getThemePanelActions: () => ThemePanelActions;
    getVariantReviewActions: () => VariantReviewActions;
    getWorkspaceRefreshActions: () => WorkspaceRefreshActions;
  };

  export type AppCallbacks = {
    getPresentationState: () => StudioClientPresentationCreationState.PresentationState;
    isWorkflowRunning: () => boolean;
    loadSlide: (slideId: string) => Promise<void>;
    refreshState: () => Promise<void>;
    renderAssistantSelection: () => void;
    renderCreationDraft: () => void;
    renderCreationThemeStage: () => void;
    renderDeckFields: () => void;
    renderDeckLengthPlan: () => void;
    renderDeckStructureCandidates: () => void;
    renderPreviews: () => void;
    renderSavedThemes: () => void;
    renderStatus: () => void;
    renderVariantComparison: () => void;
    renderVariants: () => void;
    resetThemeCandidates: () => void;
    setAssistantDrawerOpen: (open: boolean) => void;
    setChecksPanelOpen: (open: boolean) => void;
    setCurrentPage: (page: string) => void;
    setDeckStructureCandidates: (candidates: unknown[] | undefined) => void;
    setThemeDrawerOpen: (open: boolean) => void;
  };

  export function createAppCallbacks(options: AppCallbacksOptions): AppCallbacks {
    return {
      getPresentationState: () => options.getPresentationCreationActions().getPresentationState(),
      isWorkflowRunning: () => options.getPresentationCreationActions().isWorkflowRunning(),
      loadSlide: async (slideId) => {
        await options.getSlideLoadActions().loadSlide(slideId);
      },
      refreshState: async () => {
        await options.getWorkspaceRefreshActions().refreshState();
      },
      renderAssistantSelection: () => options.getAssistantActions().renderSelection(),
      renderCreationDraft: () => options.getPresentationCreationWorkbench().renderDraft(),
      renderCreationThemeStage: () => options.getThemePanelActions().renderStage(),
      renderDeckFields: () => options.getDeckContextActions().renderDeckFields(),
      renderDeckLengthPlan: () => options.getDeckPlanningActions().renderDeckLengthPlan(),
      renderDeckStructureCandidates: () => options.getDeckPlanningActions().renderDeckStructureCandidates(),
      renderPreviews: () => options.getPreviewActions().render(),
      renderSavedThemes: () => options.getThemePanelActions().renderSavedThemes(),
      renderStatus: () => options.getRuntimeStatusActions().renderStatus(),
      renderVariantComparison: () => options.getVariantReviewActions().renderComparison(),
      renderVariants: () => options.getVariantReviewActions().render(),
      resetThemeCandidates: () => options.getThemeActions().resetThemeCandidates(),
      setAssistantDrawerOpen: (open) => options.getNavigationShell().setAssistantDrawerOpen(open),
      setChecksPanelOpen: (open) => options.getNavigationShell().setChecksPanelOpen(open),
      setCurrentPage: (page) => options.getNavigationShell().setCurrentPage(page),
      setDeckStructureCandidates: (candidates) => options.getDeckPlanningActions().setDeckStructureCandidates(candidates),
      setThemeDrawerOpen: (open) => options.getNavigationShell().setThemeDrawerOpen(open)
    };
  }
}
