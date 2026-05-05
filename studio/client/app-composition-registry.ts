import type { StudioClientAssistantActions } from "./creation/assistant-actions.ts";
import type { StudioClientDeckPlanningActions } from "./planning/deck-planning-actions.ts";
import type { StudioClientPreviewActions } from "./preview/preview-actions.ts";
import type { StudioClientRuntimeStatusActions } from "./runtime/runtime-status-actions.ts";
import type { StudioClientNavigationShell } from "./shell/navigation-shell.ts";
import type { StudioClientSlideLoadActions } from "./editor/slide-load-actions.ts";
import type { StudioClientThemePanelActions } from "./creation/theme-panel-actions.ts";
import type { StudioClientVariantReviewActions } from "./variants/variant-review-actions.ts";
import type { StudioClientWorkspaceRefreshActions } from "./shell/workspace-refresh-actions.ts";

type NavigationShell = ReturnType<typeof StudioClientNavigationShell.createNavigationShell>;

function requireRegistered<TValue>(value: TValue | null, name: string): TValue {
  if (!value) {
    throw new Error(`Studio client composition dependency was read before initialization: ${name}`);
  }

  return value;
}

export function createStudioClientCompositionRegistry() {
  let assistantActions: StudioClientAssistantActions.AssistantActions | null = null;
  let deckPlanningActions: StudioClientDeckPlanningActions.DeckPlanningActions | null = null;
  let navigationShell: NavigationShell | null = null;
  let previewActions: StudioClientPreviewActions.PreviewActions | null = null;
  let runtimeStatusActions: StudioClientRuntimeStatusActions.RuntimeStatusActions | null = null;
  let slideLoadActions: StudioClientSlideLoadActions.SlideLoadActions | null = null;
  let themePanelActions: StudioClientThemePanelActions.ThemePanelActions | null = null;
  let variantReviewActions: StudioClientVariantReviewActions.VariantReviewActions | null = null;
  let workspaceRefreshActions: StudioClientWorkspaceRefreshActions.WorkspaceRefreshActions | null = null;

  return {
    getAssistantActions: () => requireRegistered(assistantActions, "assistantActions"),
    getDeckPlanningActions: () => requireRegistered(deckPlanningActions, "deckPlanningActions"),
    getNavigationShell: () => requireRegistered(navigationShell, "navigationShell"),
    getPreviewActions: () => requireRegistered(previewActions, "previewActions"),
    getRuntimeStatusActions: () => requireRegistered(runtimeStatusActions, "runtimeStatusActions"),
    getSlideLoadActions: () => requireRegistered(slideLoadActions, "slideLoadActions"),
    getThemePanelActions: () => requireRegistered(themePanelActions, "themePanelActions"),
    getVariantReviewActions: () => requireRegistered(variantReviewActions, "variantReviewActions"),
    getWorkspaceRefreshActions: () => requireRegistered(workspaceRefreshActions, "workspaceRefreshActions"),
    setAssistantActions: (value: StudioClientAssistantActions.AssistantActions) => {
      assistantActions = value;
    },
    setDeckPlanningActions: (value: StudioClientDeckPlanningActions.DeckPlanningActions) => {
      deckPlanningActions = value;
    },
    setNavigationShell: (value: NavigationShell) => {
      navigationShell = value;
    },
    setPreviewActions: (value: StudioClientPreviewActions.PreviewActions) => {
      previewActions = value;
    },
    setRuntimeStatusActions: (value: StudioClientRuntimeStatusActions.RuntimeStatusActions) => {
      runtimeStatusActions = value;
    },
    setSlideLoadActions: (value: StudioClientSlideLoadActions.SlideLoadActions) => {
      slideLoadActions = value;
    },
    setThemePanelActions: (value: StudioClientThemePanelActions.ThemePanelActions) => {
      themePanelActions = value;
    },
    setVariantReviewActions: (value: StudioClientVariantReviewActions.VariantReviewActions) => {
      variantReviewActions = value;
    },
    setWorkspaceRefreshActions: (value: StudioClientWorkspaceRefreshActions.WorkspaceRefreshActions) => {
      workspaceRefreshActions = value;
    }
  };
}
