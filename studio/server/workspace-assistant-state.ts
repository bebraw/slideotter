import { getAssistantSession, getAssistantSuggestions } from "./services/assistant.ts";
import { buildActionDescriptors } from "./services/selection-actions.ts";

type JsonObject = Record<string, unknown>;

function getWorkspaceAssistantState(): JsonObject {
  return {
    actions: buildActionDescriptors(),
    session: getAssistantSession(),
    suggestions: getAssistantSuggestions()
  };
}

export { getWorkspaceAssistantState };
