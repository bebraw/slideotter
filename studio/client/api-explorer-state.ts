import { StudioClientState } from "./state.ts";

export namespace StudioClientApiExplorerState {
  export type ApiExplorerState = StudioClientState.State["hypermedia"]["explorer"];

  export function getExplorerState(state: StudioClientState.State): ApiExplorerState {
    if (!state.hypermedia) {
      state.hypermedia = {
        activePresentation: null,
        explorer: {
          history: [],
          resource: null,
          url: "/api/v1"
        },
        root: null
      };
    }
    if (!state.hypermedia.explorer) {
      state.hypermedia.explorer = {
        history: [],
        resource: null,
        url: "/api/v1"
      };
    }
    return state.hypermedia.explorer;
  }
}
