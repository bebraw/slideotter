import * as http from "http";

import { getDomPreviewState } from "./services/dom-preview.ts";
import { createMaterialFromDataUrl, getMaterial, listMaterials } from "./services/materials.ts";
import { createSource, deleteSource, listSources } from "./services/sources.ts";
import { getSlide, readSlideSource, readSlideSpec, writeSlideSpec } from "./services/slides.ts";

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

export function createMaterialSourceHandlers(deps: MaterialSourceHandlerDependencies) {
  const {
    createJsonResponse,
    describeStructuredSlide,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    serializeSlideSpec,
    updateWorkflowState
  } = deps;

  async function handleMaterialUpload(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const material = createMaterialFromDataUrl(body || {});
    publishRuntimeState();

    createJsonResponse(res, 200, {
      material,
      materials: listMaterials()
    });
  }

  function handleMaterialsIndex(res: ServerResponse): void {
    createJsonResponse(res, 200, { materials: listMaterials() });
  }

  async function handleSourceCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
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

  async function handleSourceDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
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

  function handleSourcesIndex(res: ServerResponse): void {
    createJsonResponse(res, 200, { sources: listSources() });
  }

  async function handleSlideMaterialUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
    const body = await readJsonBody(req);
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
    const structured = describeStructuredSlide(slideId);
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      domPreview: getDomPreviewState(),
      materials: listMaterials(),
      slide: getSlide(slideId),
      slideSpec: structured.slideSpec,
      slideSpecError: structured.slideSpecError,
      source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
      structured: structured.structured
    });
  }

  return {
    handleMaterialUpload,
    handleMaterialsIndex,
    handleSlideMaterialUpdate,
    handleSourceCreate,
    handleSourceDelete,
    handleSourcesIndex
  };
}
