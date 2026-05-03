import { StudioClientState } from "../core/state.ts";

export namespace StudioClientThemeCandidateState {
  export type ThemeCandidateState = {
    themeCandidates: unknown[];
    ui: Pick<StudioClientState.State["ui"], "creationThemeVariantId" | "themeCandidateRefreshIndex" | "themeCandidatesGenerated">;
  };

  export function resetCandidates(state: ThemeCandidateState): void {
    state.themeCandidates = [];
    state.ui.creationThemeVariantId = "current";
    state.ui.themeCandidateRefreshIndex = 0;
    state.ui.themeCandidatesGenerated = false;
  }
}
