import type { ApiRoute } from "./routes.ts";

type RouteHandler = ApiRoute["handler"];

type LlmRouteOptions = {
  handleLlmCheck: RouteHandler;
  handleLlmModelUpdate: RouteHandler;
  handleLlmModels: RouteHandler;
};

export function createLlmApiRoutes(options: LlmRouteOptions): readonly ApiRoute[] {
  return [
    { method: "POST", pathname: "/api/llm/check", handler: options.handleLlmCheck },
    { method: "GET", pathname: "/api/llm/models", handler: options.handleLlmModels },
    { method: "POST", pathname: "/api/llm/model", handler: options.handleLlmModelUpdate }
  ];
}
