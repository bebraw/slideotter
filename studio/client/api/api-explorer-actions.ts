import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientApiExplorerState } from "./api-explorer-state.ts";

export namespace StudioClientApiExplorerActions {
  type ApiExplorerOpenOptions = {
    pushHistory?: boolean;
  };

  type ApiExplorerState = StudioClientApiExplorerState.ApiExplorerState;

  type ApiExplorerWorkbench = {
    getState: () => ApiExplorerState;
    mount: () => void;
    openResource: (href: string | null | undefined, options?: ApiExplorerOpenOptions) => Promise<void>;
    render: () => void;
  };

  export type ApiExplorerActionsOptions = {
    elements: StudioClientElements.Elements;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type ApiExplorerActions = {
    getState: () => ApiExplorerState;
    openResource: (href: string | null | undefined, options?: ApiExplorerOpenOptions) => Promise<void>;
    render: () => void;
  };

  export function createApiExplorerActions({
    elements,
    state,
    windowRef
  }: ApiExplorerActionsOptions): ApiExplorerActions {
    let apiExplorer: ApiExplorerWorkbench | null = null;
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: () => import("./api-explorer.ts"),
      create: ({ StudioClientApiExplorer }): ApiExplorerWorkbench => (
        StudioClientApiExplorer.createApiExplorer({
          createDomElement: StudioClientCore.createDomElement,
          elements,
          request: StudioClientCore.request,
          state,
          window: windowRef
        })
      ),
      mount: (workbench) => workbench.mount()
    });

    async function getApiExplorer(): Promise<ApiExplorerWorkbench> {
      apiExplorer = await lazyWorkbench.load();
      return apiExplorer;
    }

    return {
      getState: () => apiExplorer ? apiExplorer.getState() : StudioClientApiExplorerState.getExplorerState(state),
      openResource: async (href, options = {}) => {
        const workbench = await getApiExplorer();
        return workbench.openResource(href, options);
      },
      render: () => {
        if (apiExplorer) {
          apiExplorer.render();
        }
      }
    };
  }
}
