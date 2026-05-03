import type * as http from "http";
import type { URL } from "url";

export type ApiRouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
) => Promise<void> | void;

export type ApiRoute = {
  handler: ApiRouteHandler;
  method: string;
  pathname: string;
};

export async function dispatchExactApiRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  routes: readonly ApiRoute[]
): Promise<boolean> {
  const route = routes.find((candidate) => candidate.method === req.method && candidate.pathname === url.pathname);
  if (!route) {
    return false;
  }

  await route.handler(req, res, url);
  return true;
}
