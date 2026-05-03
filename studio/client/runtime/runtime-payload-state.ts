import { StudioClientState } from "../core/state.ts";

export namespace StudioClientRuntimePayloadState {
  export type BuildPayload = {
    previews: StudioClientState.State["previews"];
    runtime: StudioClientState.State["runtime"];
  };

  export type ValidationPayload = BuildPayload & {
    ok?: boolean;
  };

  export type RuntimePayload = {
    runtime?: StudioClientState.State["runtime"];
  };

  export function applyBuildPayload(state: StudioClientState.State, payload: BuildPayload): void {
    state.previews = payload.previews;
    state.runtime = payload.runtime;
  }

  export function applyValidationPayload(state: StudioClientState.State, payload: ValidationPayload): void {
    state.previews = payload.previews;
    state.runtime = payload.runtime || state.runtime;
    state.validation = payload;
  }

  export function applyRuntimePayload(state: StudioClientState.State, payload: RuntimePayload): void {
    state.runtime = payload.runtime || state.runtime;
  }
}
