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

export type ApiPatternRouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  match: RegExpMatchArray
) => Promise<void> | void;

export type ApiPatternRoute = {
  handler: ApiPatternRouteHandler;
  method: string;
  pattern: RegExp;
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

export async function dispatchPatternApiRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  routes: readonly ApiPatternRoute[]
): Promise<boolean> {
  for (const route of routes) {
    if (route.method !== req.method) {
      continue;
    }

    const match = url.pathname.match(route.pattern);
    if (!match) {
      continue;
    }

    await route.handler(req, res, url, match);
    return true;
  }

  return false;
}
