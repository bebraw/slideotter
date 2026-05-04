import type { URL } from "url";
import { createApiHandlerRegistry } from "./api-handler-registry.ts";
import { createApiRouteRegistry } from "./api-route-registry.ts";
import { browserApiRoutes } from "./browser-api-routes.ts";
import { dispatchExactApiRoute, dispatchPatternApiRoute } from "./routes.ts";
import { hypermediaApiRoutes } from "./hypermedia-api-routes.ts";
import { notFound } from "./http-responses.ts";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;

const apiHandlers = createApiHandlerRegistry();
const {
  slideApiRoutes,
  versionedApiRoutes,
  workflowApiRoutes
} = createApiRouteRegistry(apiHandlers);

export async function handleApi(req: ServerRequest, res: ServerResponse, url: URL): Promise<void> {
  if (await dispatchExactApiRoute(req, res, url, versionedApiRoutes)) {
    return;
  }

  if (await dispatchPatternApiRoute(req, res, url, hypermediaApiRoutes)) {
    return;
  }

  if (!url.pathname.startsWith("/api/v1/")) {
    notFound(res);
    return;
  }

  if (await dispatchExactApiRoute(req, res, url, browserApiRoutes)) {
    return;
  }

  if (await dispatchExactApiRoute(req, res, url, workflowApiRoutes)) {
    return;
  }

  if (await dispatchPatternApiRoute(req, res, url, slideApiRoutes)) {
    return;
  }

  notFound(res);
}
