import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import type { StudioClientWorkspaceRefreshWorkbench } from "./workspace-refresh-workbench.ts";

export namespace StudioClientWorkspaceRefreshActions {
  export type WorkspaceRefreshActionsOptions = StudioClientWorkspaceRefreshWorkbench.WorkspaceRefreshWorkbenchOptions;

  export type WorkspaceRefreshActions = {
    refreshState: () => Promise<void>;
  };

  export function createWorkspaceRefreshActions(options: WorkspaceRefreshActionsOptions): WorkspaceRefreshActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<StudioClientWorkspaceRefreshWorkbench.WorkspaceRefreshWorkbench>({
      create: async () => {
        const { StudioClientWorkspaceRefreshWorkbench } = await import("./workspace-refresh-workbench.ts");
        return StudioClientWorkspaceRefreshWorkbench.createWorkspaceRefreshWorkbench(options);
      }
    });

    return {
      refreshState: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.refreshState();
      }
    };
  }
}
