import {
  createApiRootResource,
  createCurrentJobResource,
  createPresentationCollectionResource,
  createSchemaResource
} from "./services/hypermedia.ts";
import { type ApiRoute } from "./routes.ts";
import { serializeRuntimeState } from "./runtime-state.ts";
import { createJsonResponse } from "./http-responses.ts";

function createRootResourceRoutes(): readonly ApiRoute[] {
  return [
    {
      method: "GET",
      pathname: "/api/v1",
      handler: (_req, res) => createJsonResponse(res, 200, createApiRootResource())
    },
    {
      method: "GET",
      pathname: "/api/v1/schemas",
      handler: (_req, res) => createJsonResponse(res, 200, createSchemaResource())
    },
    {
      method: "GET",
      pathname: "/api/v1/jobs/current",
      handler: (_req, res) => createJsonResponse(res, 200, createCurrentJobResource(serializeRuntimeState()))
    },
    {
      method: "GET",
      pathname: "/api/v1/presentations",
      handler: (_req, res) => createJsonResponse(res, 200, createPresentationCollectionResource())
    }
  ];
}

export { createRootResourceRoutes };
