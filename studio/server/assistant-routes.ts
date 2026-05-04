import type { ApiRoute } from "./routes.ts";

type AssistantRouteHandlers = {
  handleAssistantSend: ApiRoute["handler"];
  handleAssistantSession: ApiRoute["handler"];
};

export function createAssistantApiRoutes(handlers: AssistantRouteHandlers): readonly ApiRoute[] {
  return [
    { method: "GET", pathname: "/api/assistant/session", handler: handlers.handleAssistantSession },
    { method: "POST", pathname: "/api/assistant/message", handler: handlers.handleAssistantSend }
  ];
}
