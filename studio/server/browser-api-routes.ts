import type { ApiRoute } from "./routes.ts";
import { createJsonResponse } from "./http-responses.ts";
import { getPresentationCreationDraft } from "./services/presentations.ts";
import {
  registerRuntimeStream,
  serializeRuntimeState
} from "./runtime-state.ts";
import { getWorkspaceState } from "./workspace-state.ts";

const browserApiRoutes: readonly ApiRoute[] = [
  {
    method: "GET",
    pathname: "/api/v1/state",
    handler: (_req, res) => createJsonResponse(res, 200, getWorkspaceState())
  },
  {
    method: "GET",
    pathname: "/api/v1/runtime",
    handler: (_req, res) => createJsonResponse(res, 200, {
      runtime: serializeRuntimeState()
    })
  },
  {
    method: "GET",
    pathname: "/api/v1/runtime/stream",
    handler: (req, res) => registerRuntimeStream(req, res, getPresentationCreationDraft())
  }
];

export { browserApiRoutes };
