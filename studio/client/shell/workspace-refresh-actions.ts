import { StudioClientCore } from "../platform/core.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import type { StudioClientWorkspaceRefreshWorkbench } from "./workspace-refresh-workbench.ts";

export namespace StudioClientWorkspaceRefreshActions {
  export type WorkspaceRefreshActionsOptions = Omit<StudioClientWorkspaceRefreshWorkbench.WorkspaceRefreshWorkbenchOptions, "request">;

  export type WorkspaceRefreshActions = {
    refreshState: () => Promise<void>;
  };

  export function createWorkspaceRefreshActions(options: WorkspaceRefreshActionsOptions): WorkspaceRefreshActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: () => import("./workspace-refresh-workbench.ts"),
      create: ({ StudioClientWorkspaceRefreshWorkbench }): StudioClientWorkspaceRefreshWorkbench.WorkspaceRefreshWorkbench => (
        StudioClientWorkspaceRefreshWorkbench.createWorkspaceRefreshWorkbench({
          ...options,
          request: StudioClientCore.request
        })
      )
    });

    return {
      refreshState: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.refreshState();
      }
    };
  }
}
