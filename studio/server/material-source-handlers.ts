import * as http from "http";

import { getDomPreviewState } from "./services/dom-preview-state.ts";
import { createMaterialFromDataUrl } from "./services/material-creation.ts";
import { getMaterial, listMaterials } from "./services/material-library.ts";
import { createSource, deleteSource, listSources } from "./services/sources.ts";
import { importSvglLogo, searchSvglLogos } from "./services/svgl.ts";
import { getSlide } from "./services/slide-queries.ts";
import { readSlideSource, readSlideSpec } from "./services/slide-spec-store.ts";
import { writeSlideSpec } from "./services/slide-writes.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  media?: JsonObject;
  type?: unknown;
};

type RuntimeStateAccess = {
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
};

type MaterialSourceHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  describeStructuredSlide: (slideId: string) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeRuntimeState: () => JsonObject;
  serializeSlideSpec: (slideSpec: unknown) => string;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

async function handleMaterialUploadRequest(
  deps: MaterialSourceHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const material = createMaterialFromDataUrl(body || {});
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    material,
    materials: listMaterials()
  });
}

function handleMaterialsIndexRequest(deps: MaterialSourceHandlerDependencies, res: ServerResponse): void {
  deps.createJsonResponse(res, 200, { materials: listMaterials() });
}

async function handleSvglSearchRequest(
  deps: MaterialSourceHandlerDependencies,
  _req: ServerRequest,
  res: ServerResponse,
  url: URL
): Promise<void> {
  const results = await searchSvglLogos({
    limit: url.searchParams.get("limit") || undefined,
    query: url.searchParams.get("query") || ""
  });

  deps.createJsonResponse(res, 200, { results });
}

async function handleSvglImportRequest(
  deps: MaterialSourceHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const material = await importSvglLogo(body || {});
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    material,
    materials: listMaterials()
  });
}

async function handleSourceCreateRequest(
  deps: MaterialSourceHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const {
    createJsonResponse,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  const body = await readJsonBody(req);
  const source = await createSource(body || {});
  updateWorkflowState({
    message: `Added source ${source.title}.`,
    ok: true,
    operation: "add-source",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    runtime: serializeRuntimeState(),
    source,
    sources: listSources()
  });
}

async function handleSourceDeleteRequest(
  deps: MaterialSourceHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const { createJsonResponse, publishRuntimeState, readJsonBody, runtimeState, serializeRuntimeState, updateWorkflowState } = deps;
  const body = await readJsonBody(req);
  if (typeof body.sourceId !== "string" || !body.sourceId) {
    throw new Error("Expected sourceId");
  }

  const sources = deleteSource(body.sourceId);
  updateWorkflowState({
    message: "Removed presentation source.",
    ok: true,
    operation: "delete-source",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    runtime: serializeRuntimeState(),
    sources
  });
}

function handleSourcesIndexRequest(deps: MaterialSourceHandlerDependencies, res: ServerResponse): void {
  deps.createJsonResponse(res, 200, { sources: listSources() });
}

async function handleSlideMaterialUpdateRequest(
  deps: MaterialSourceHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse,
  slideId: string
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const currentSpec = readSlideSpec(slideId);
  const materialId = typeof body.materialId === "string" ? body.materialId : "";
  const nextSpec: SlideSpecPayload = { ...currentSpec };

  if (!materialId) {
    delete nextSpec.media;
  } else {
    const material = getMaterial(materialId);
    const caption = String(body.caption || material.caption || "").replace(/\s+/g, " ").trim();
    const media: JsonObject = {
      alt: String(body.alt || material.alt || material.title).replace(/\s+/g, " ").trim() || material.title,
      fit: currentSpec.type === "photo" ? "cover" : "contain",
      focalPoint: "center",
      id: material.id,
      src: material.url,
      title: material.title
    };
    if (caption) {
      media.caption = caption;
    }
    nextSpec.media = media;
  }

  writeSlideSpec(slideId, nextSpec);
  const structured = deps.describeStructuredSlide(slideId);
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    domPreview: getDomPreviewState(),
    materials: listMaterials(),
    slide: getSlide(slideId),
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? deps.serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
}

export function createMaterialSourceHandlers(deps: MaterialSourceHandlerDependencies) {
  return {
    handleMaterialUpload: (req: ServerRequest, res: ServerResponse) => handleMaterialUploadRequest(deps, req, res),
    handleMaterialsIndex: (res: ServerResponse) => handleMaterialsIndexRequest(deps, res),
    handleSlideMaterialUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) =>
      handleSlideMaterialUpdateRequest(deps, req, res, slideId),
    handleSvglImport: (req: ServerRequest, res: ServerResponse) => handleSvglImportRequest(deps, req, res),
    handleSvglSearch: (req: ServerRequest, res: ServerResponse, url: URL) =>
      handleSvglSearchRequest(deps, req, res, url),
    handleSourceCreate: (req: ServerRequest, res: ServerResponse) => handleSourceCreateRequest(deps, req, res),
    handleSourceDelete: (req: ServerRequest, res: ServerResponse) => handleSourceDeleteRequest(deps, req, res),
    handleSourcesIndex: (res: ServerResponse) => handleSourcesIndexRequest(deps, res)
  };
}
