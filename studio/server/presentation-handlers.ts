import * as http from "http";

import { assertBaseVersion, getPresentationVersion } from "./services/hypermedia.ts";
import { importImageSearchResults } from "./services/image-search.ts";
import { createMaterialFromDataUrl } from "./services/materials.ts";
import {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  listPresentations,
  readPresentationDeckContext,
  regeneratePresentationSlides,
  setActivePresentation
} from "./services/presentations.ts";
import { generateInitialPresentation } from "./services/presentation-generation.ts";
import { createSource } from "./services/sources.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type StarterMaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  title?: unknown;
};

type ImageSearchPayload = JsonObject & {
  count?: unknown;
  provider?: unknown;
  query?: unknown;
  restrictions?: unknown;
};

type RuntimeStateAccess = {
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  sourceRetrieval: unknown;
};

type PresentationHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createPresentationPayload: (extra?: JsonObject) => JsonObject;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  resetPresentationRuntime: () => void;
  runtimeState: RuntimeStateAccess;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStarterMaterialPayload(value: unknown): value is StarterMaterialPayload {
  return isJsonObject(value);
}

function isImageSearchPayload(value: unknown): value is ImageSearchPayload {
  return isJsonObject(value);
}

export function createPresentationHandlers(deps: PresentationHandlerDependencies) {
  const {
    createJsonResponse,
    createPresentationPayload,
    createWorkflowProgressReporter,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    resetPresentationRuntime,
    runtimeState,
    updateWorkflowState
  } = deps;

  async function handlePresentationSelect(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    setActivePresentation(body.presentationId);
    resetPresentationRuntime();
    createJsonResponse(res, 200, createPresentationPayload());
  }

  async function handlePresentationCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const fields = body;
    const starterSourceText = typeof fields.presentationSourceText === "string"
      ? fields.presentationSourceText.trim()
      : "";
    const starterMaterials = Array.isArray(fields.presentationMaterials)
      ? fields.presentationMaterials.filter(isStarterMaterialPayload)
      : [];
    let presentation = null;
    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "create-presentation"
    });
    reportProgress({
      message: "Generating initial presentation slides...",
      stage: "generating-slides"
    });
    try {
      presentation = createPresentation({
        ...fields,
        targetSlideCount: fields.targetSlideCount || fields.targetCount
      });

      if (starterSourceText) {
        await createSource({
          text: starterSourceText,
          title: "Starter sources"
        });
      }

      starterMaterials.forEach((material: StarterMaterialPayload) => {
        createMaterialFromDataUrl({
          alt: material.alt || material.title || material.fileName,
          caption: material.caption || "",
          dataUrl: material.dataUrl,
          fileName: material.fileName || material.title || "starter-image",
          title: material.title || material.fileName || "Starter image"
        });
      });

      let imageSearchResult = null;
      if (isImageSearchPayload(fields.imageSearch) && String(fields.imageSearch.query || "").trim()) {
        imageSearchResult = await importImageSearchResults({
          count: fields.imageSearch.count,
          provider: fields.imageSearch.provider,
          query: fields.imageSearch.query,
          restrictions: fields.imageSearch.restrictions
        });
      }

      const generated = await generateInitialPresentation({
        ...fields,
        includeActiveMaterials: true,
        includeActiveSources: true,
        onProgress: reportProgress,
        presentationSourceText: starterSourceText
      });
      presentation = regeneratePresentationSlides(presentation.id, generated.slideSpecs, {
        outline: generated.outline,
        slideContexts: generated.slideContexts,
        targetSlideCount: generated.targetSlideCount
      });
      setActivePresentation(presentation.id);
      updateWorkflowState({
        generation: generated.generation,
        message: [
          generated.summary,
          starterSourceText ? "Starter sources were saved with the new presentation." : "",
          starterMaterials.length ? `${starterMaterials.length} starter image${starterMaterials.length === 1 ? "" : "s"} were saved with the new presentation.` : "",
          imageSearchResult && imageSearchResult.imported.length ? `${imageSearchResult.imported.length} searched image${imageSearchResult.imported.length === 1 ? "" : "s"} were imported from ${imageSearchResult.providerLabel || imageSearchResult.provider}.` : ""
        ].filter(Boolean).join(" "),
        ok: true,
        operation: "create-presentation",
        stage: "completed",
        status: "completed"
      });
      runtimeState.lastError = null;
      runtimeState.sourceRetrieval = generated.retrieval || null;
      publishRuntimeState();
      createJsonResponse(res, 200, createPresentationPayload({ presentation }));
    } catch (error) {
      if (presentation && presentation.id) {
        try {
          deletePresentation(presentation.id);
        } catch (_cleanupError) {
          // Leave the original generation failure visible.
        }
      }

      throw error;
    }
  }

  async function handlePresentationDuplicate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    assertBaseVersion(getPresentationVersion(body.presentationId), body.baseVersion, "Presentation");
    const presentation = duplicatePresentation(body.presentationId, {
      title: body.title
    });
    resetPresentationRuntime();
    createJsonResponse(res, 200, createPresentationPayload({ presentation }));
  }

  async function handlePresentationRegenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    const context = readPresentationDeckContext(body.presentationId);
    const deck = jsonObjectOrEmpty(context && context.deck);
    const lengthProfile = jsonObjectOrEmpty(deck.lengthProfile);
    const targetSlideCount = body.targetSlideCount
      ?? lengthProfile.targetCount
      ?? body.targetCount;
    setActivePresentation(body.presentationId);
    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "regenerate-presentation"
    });
    reportProgress({
      message: "Regenerating presentation slides from saved context...",
      stage: "generating-slides"
    });
    const generated = await generateInitialPresentation({
      ...deck,
      onProgress: reportProgress,
      targetSlideCount
    });
    const presentation = regeneratePresentationSlides(body.presentationId, generated.slideSpecs, {
      outline: generated.outline,
      slideContexts: generated.slideContexts,
      targetSlideCount: generated.targetSlideCount
    });
    updateWorkflowState({
      generation: generated.generation,
      message: `Regenerated ${generated.slideSpecs.length} slide${generated.slideSpecs.length === 1 ? "" : "s"} from the saved presentation context.`,
      ok: true,
      operation: "regenerate-presentation",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    runtimeState.sourceRetrieval = generated.retrieval || null;
    publishRuntimeState();
    createJsonResponse(res, 200, createPresentationPayload({ presentation }));
  }

  async function handlePresentationDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.presentationId !== "string" || !body.presentationId) {
      throw new Error("Expected presentationId");
    }

    assertBaseVersion(getPresentationVersion(body.presentationId), body.baseVersion, "Presentation");
    deletePresentation(body.presentationId);
    resetPresentationRuntime();
    createJsonResponse(res, 200, createPresentationPayload());
  }

  function handlePresentationsIndex(res: ServerResponse): void {
    createJsonResponse(res, 200, listPresentations());
  }

  return {
    handlePresentationCreate,
    handlePresentationDelete,
    handlePresentationDuplicate,
    handlePresentationRegenerate,
    handlePresentationSelect,
    handlePresentationsIndex
  };
}
