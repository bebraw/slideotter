import * as http from "http";

import { buildAndRenderDeck, getPreviewManifest } from "./services/build.ts";
import { getDomPreviewState } from "./services/dom-preview.ts";
import { assertBaseVersion, getSlideVersion } from "./services/hypermedia.ts";
import { listPresentations } from "./services/presentations.ts";
import {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent,
  normalizeSelectionScope
} from "./services/selection-scope.ts";
import { getDeckContext, updateDeckFields, updateSlideContext } from "./services/state.ts";
import { getSlide, readSlideSource, readSlideSpec, writeSlideSource, writeSlideSpec } from "./services/slides.ts";
import { validateSlideSpecInDom } from "./services/dom-validate.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  layout?: unknown;
  media?: JsonObject;
  type?: unknown;
};

type RuntimeStateAccess = {
  build: {
    ok: boolean;
    updatedAt: string | null;
  };
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
};

type SlideEditHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  describeStructuredSlide: (slideId: string) => JsonObject;
  isJsonObject: (value: unknown) => value is JsonObject;
  isSlideSpecPayload: (value: unknown) => value is SlideSpecPayload;
  isVisualThemePayload: (value: unknown) => value is JsonObject;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeSlideSpec: (slideSpec: unknown) => string;
};

function activePresentationIdFromBody(body: JsonObject): string {
  const presentations = listPresentations() as JsonObject & { activePresentationId?: unknown };
  const bodyPresentationId = typeof body.presentationId === "string" ? body.presentationId : "";
  return bodyPresentationId || String(presentations.activePresentationId || "");
}

export function createSlideEditHandlers(deps: SlideEditHandlerDependencies) {
  const {
    createJsonResponse,
    describeStructuredSlide,
    isJsonObject,
    isSlideSpecPayload,
    isVisualThemePayload,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeSlideSpec
  } = deps;

  async function handleSlideSourceUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.source !== "string") {
      throw new Error("Expected a string field named source");
    }

    const slide = getSlide(slideId);
    if (slide.structured) {
      throw new Error("Raw source editing is disabled for structured JSON slides.");
    }

    writeSlideSource(slideId, body.source);
    const context = isVisualThemePayload(body.visualTheme)
      ? updateDeckFields({ visualTheme: body.visualTheme })
      : getDeckContext();
    const previews = body.rebuild === false ? getPreviewManifest() : (await buildAndRenderDeck()).previews;

    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    runtimeState.lastError = null;
    publishRuntimeState();
    const structured = describeStructuredSlide(slideId);

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      previews,
      slideSpec: structured.slideSpec,
      slideSpecError: structured.slideSpecError,
      structured: structured.structured,
      slide: getSlide(slideId),
      source: readSlideSource(slideId)
    });
  }

  async function handleSlideSpecUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
    const body = await readJsonBody(req);
    if (!body.slideSpec || typeof body.slideSpec !== "object" || Array.isArray(body.slideSpec)) {
      throw new Error("Expected an object field named slideSpec");
    }

    const activePresentationId = activePresentationIdFromBody({});
    assertBaseVersion(getSlideVersion(activePresentationId, slideId), body.baseVersion, "Slide");
    const currentSlideSpec = readSlideSpec(slideId);
    const nextSlideSpec = jsonObjectOrEmpty(body.slideSpec);
    const selectionScope = normalizeSelectionScope(body.selectionScope, {
      slideId,
      slideSpec: currentSlideSpec
    });
    if (selectionScope) {
      assertSelectionAnchorsCurrent(currentSlideSpec, selectionScope);
      const requestedSelectionScope = isJsonObject(body.selectionScope) ? body.selectionScope : {};
      if (!requestedSelectionScope.allowFamilyChange) {
        assertPatchWithinSelectionScope(currentSlideSpec, nextSlideSpec, selectionScope);
      }
    }

    writeSlideSpec(slideId, nextSlideSpec, { preservePlacement: body.preserveSlidePosition === true });
    const context = isVisualThemePayload(body.visualTheme)
      ? updateDeckFields({ visualTheme: body.visualTheme })
      : getDeckContext();
    const shouldRebuild = body.rebuild !== false;
    const previews = shouldRebuild ? (await buildAndRenderDeck()).previews : getPreviewManifest();

    if (shouldRebuild) {
      runtimeState.build = {
        ok: true,
        updatedAt: new Date().toISOString()
      };
    }
    runtimeState.lastError = null;
    publishRuntimeState();
    const structured = describeStructuredSlide(slideId);

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      previews,
      slide: getSlide(slideId),
      slideSpec: structured.slideSpec,
      slideSpecError: structured.slideSpecError,
      source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
      structured: structured.structured
    });
  }

  async function handleSlideCurrentValidation(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
    const body = await readJsonBody(req);
    const slide = getSlide(slideId);
    const slideSpec = isSlideSpecPayload(body.slideSpec)
      ? body.slideSpec
      : readSlideSpec(slideId);
    const validation = await validateSlideSpecInDom({
      id: slide.id,
      index: slide.index,
      slideSpec,
      title: slide.title
    });

    createJsonResponse(res, 200, {
      slideId,
      validation
    });
  }

  async function handleSlideContextUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
    const body = await readJsonBody(req);
    const context = updateSlideContext(slideId, body || {});
    createJsonResponse(res, 200, {
      context,
      slideContext: context.slides[slideId] || {}
    });
  }

  return {
    handleSlideContextUpdate,
    handleSlideCurrentValidation,
    handleSlideSourceUpdate,
    handleSlideSpecUpdate
  };
}
