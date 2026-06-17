import { getWorkspaceAssistantState } from "./workspace-assistant-state.ts";
import { getWorkspaceAssetsState } from "./workspace-assets-state.ts";
import { getWorkspaceDeckState } from "./workspace-deck-state.ts";

type JsonObject = Record<string, unknown>;

export function getWorkspaceState(): JsonObject {
  return {
    assistant: getWorkspaceAssistantState(),
    ...getWorkspaceDeckState(),
    ...getWorkspaceAssetsState()
  };
}

export function createPresentationPayload(extra: JsonObject = {}): JsonObject {
  return {
    ...extra,
    ...getWorkspaceState()
  };
}
