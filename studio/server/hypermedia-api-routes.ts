import type { ApiPatternRoute } from "./routes.ts";
import { createJsonResponse, readJsonBody } from "./http-responses.ts";
import {
  createMemoryItem,
  linkMemoryEvidence,
  retireMemoryItem,
  searchMemoryItems,
  updateMemoryItem
} from "./services/memory.ts";
import {
  assertBaseVersion,
  createCandidateCollectionResource,
  createCandidateResource,
  createCheckReportResource,
  createExportCollectionResource,
  createMemoryCollectionResource,
  createMemoryDependentSlidesResource,
  createMemoryEvidenceResource,
  createMemoryItemResource,
  createPresentationResource,
  createSlideCollectionResource,
  createSlideResource,
  createSlideWorkflowResource,
  getMemoryVersion
} from "./services/hypermedia.ts";

const hypermediaApiRoutes: readonly ApiPatternRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/([a-z0-9-]+)\/evidence$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createMemoryEvidenceResource(match[1] || "", match[2] || ""))
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/([a-z0-9-]+)\/evidence$/,
    handler: async (req, res, _url, match) => {
      const presentationId = match[1] || "";
      const memoryId = match[2] || "";
      const body = await readJsonBody(req);
      assertBaseVersion(getMemoryVersion(presentationId), body.baseVersion, "Memory");
      linkMemoryEvidence(memoryId, body, { presentationId });
      createJsonResponse(res, 200, createMemoryItemResource(presentationId, memoryId));
    }
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/([a-z0-9-]+)\/dependent-slides$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createMemoryDependentSlidesResource(match[1] || "", match[2] || ""))
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/([a-z0-9-]+)\/retire$/,
    handler: async (req, res, _url, match) => {
      const presentationId = match[1] || "";
      const memoryId = match[2] || "";
      const body = await readJsonBody(req);
      assertBaseVersion(getMemoryVersion(presentationId), body.baseVersion, "Memory");
      retireMemoryItem(memoryId, { presentationId });
      createJsonResponse(res, 200, createMemoryItemResource(presentationId, memoryId));
    }
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/derived-slidesets$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createMemoryCollectionResource(match[1] || ""))
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/search$/,
    handler: async (req, res, _url, match) => {
      const presentationId = match[1] || "";
      const body = await readJsonBody(req);
      const query = String(body.query || "");
      searchMemoryItems(query, { limit: body.limit, presentationId });
      createJsonResponse(res, 200, createMemoryCollectionResource(presentationId, { query }));
    }
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/([a-z0-9-]+)$/,
    handler: async (req, res, _url, match) => {
      const presentationId = match[1] || "";
      const memoryId = match[2] || "";
      const body = await readJsonBody(req);
      assertBaseVersion(getMemoryVersion(presentationId), body.baseVersion, "Memory");
      updateMemoryItem(memoryId, body, { presentationId });
      createJsonResponse(res, 200, createMemoryItemResource(presentationId, memoryId));
    }
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createMemoryItemResource(match[1] || "", match[2] || ""))
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory$/,
    handler: async (req, res, _url, match) => {
      const presentationId = match[1] || "";
      const body = await readJsonBody(req);
      assertBaseVersion(getMemoryVersion(presentationId), body.baseVersion, "Memory");
      const item = createMemoryItem(body, { presentationId });
      createJsonResponse(res, 201, createMemoryItemResource(presentationId, item.id));
    }
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/memory$/,
    handler: (_req, res, url, match) => createJsonResponse(res, 200, createMemoryCollectionResource(match[1] || "", {
      query: url.searchParams.get("query") || "",
      relatedTo: url.searchParams.get("relatedTo") || "",
      type: url.searchParams.get("type") || ""
    }))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/checks$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createCheckReportResource(match[1] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/exports$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createExportCollectionResource(match[1] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createSlideCollectionResource(match[1] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/workflows$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createSlideWorkflowResource(match[1] || "", match[2] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/candidates\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createCandidateResource(match[1] || "", match[2] || "", match[3] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/candidates$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createCandidateCollectionResource(match[1] || "", match[2] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createSlideResource(match[1] || "", match[2] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createPresentationResource(match[1] || ""))
  }
];

export { hypermediaApiRoutes };
