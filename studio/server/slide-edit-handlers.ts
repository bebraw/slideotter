import * as http from "http";

import { buildAndRenderDeck } from "./services/build.ts";
import { getPreviewManifest } from "./services/preview-manifest.ts";
import { getDomPreviewState } from "./services/dom-preview-state.ts";
import { assertBaseVersion, getSlideVersion } from "./services/hypermedia.ts";
import { listPresentations } from "./services/presentation-lifecycle.ts";
import {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent
} from "./services/selection-assertions.ts";
import { normalizeSelectionScope } from "./services/selection-normalization.ts";
import { getDeckContext, updateDeckFields, updateSlideContext } from "./services/state.ts";
import { getSlide } from "./services/slide-queries.ts";
import { readSlideSource, readSlideSpec } from "./services/slide-spec-store.ts";
import { writeSlideSource, writeSlideSpec } from "./services/slide-writes.ts";
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

async function handleSlideSourceUpdateRequest(
  deps: SlideEditHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse,
  slideId: string
): Promise<void> {
  const {
    createJsonResponse,
    describeStructuredSlide,
    isVisualThemePayload,
    publishRuntimeState,
    readJsonBody,
    runtimeState
  } = deps;

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

function readSlideSpecUpdateBody(body: JsonObject, deps: SlideEditHandlerDependencies, slideId: string): JsonObject {
  if (!body.slideSpec || typeof body.slideSpec !== "object" || Array.isArray(body.slideSpec)) {
    throw new Error("Expected an object field named slideSpec");
  }

  const currentSlideSpec = readSlideSpec(slideId);
  const nextSlideSpec = deps.jsonObjectOrEmpty(body.slideSpec);
  const selectionScope = normalizeSelectionScope(body.selectionScope, {
    slideId,
    slideSpec: currentSlideSpec
  });
  if (selectionScope) {
    assertSelectionAnchorsCurrent(currentSlideSpec, selectionScope);
    const requestedSelectionScope = deps.isJsonObject(body.selectionScope) ? body.selectionScope : {};
    if (!requestedSelectionScope.allowFamilyChange) {
      assertPatchWithinSelectionScope(currentSlideSpec, nextSlideSpec, selectionScope);
    }
  }

  return nextSlideSpec;
}

async function writeSlideSpecAndMaybeRebuild(
  body: JsonObject,
  deps: SlideEditHandlerDependencies,
  slideId: string,
  nextSlideSpec: JsonObject
) {
  writeSlideSpec(slideId, nextSlideSpec, { preservePlacement: body.preserveSlidePosition === true });
  const context = deps.isVisualThemePayload(body.visualTheme)
    ? updateDeckFields({ visualTheme: body.visualTheme })
    : getDeckContext();
  const shouldRebuild = body.rebuild !== false;
  const previews = shouldRebuild ? (await buildAndRenderDeck()).previews : getPreviewManifest();

  if (shouldRebuild) {
    deps.runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
  }
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();
  return { context, previews };
}

function sendSlideSpecUpdateResponse(
  deps: SlideEditHandlerDependencies,
  res: ServerResponse,
  slideId: string,
  result: { context: unknown; previews: unknown }
): void {
  const structured = deps.describeStructuredSlide(slideId);
  deps.createJsonResponse(res, 200, {
    context: result.context,
    domPreview: getDomPreviewState({ includeDetours: true }),
    previews: result.previews,
    slide: getSlide(slideId),
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? deps.serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
}

async function handleSlideSpecUpdateRequest(
  deps: SlideEditHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse,
  slideId: string
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const activePresentationId = activePresentationIdFromBody({});
  assertBaseVersion(getSlideVersion(activePresentationId, slideId), body.baseVersion, "Slide");
  const nextSlideSpec = readSlideSpecUpdateBody(body, deps, slideId);
  const result = await writeSlideSpecAndMaybeRebuild(body, deps, slideId, nextSlideSpec);
  sendSlideSpecUpdateResponse(deps, res, slideId, result);
}

async function handleSlideCurrentValidationRequest(
  deps: SlideEditHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse,
  slideId: string
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const slide = getSlide(slideId);
  const slideSpec = deps.isSlideSpecPayload(body.slideSpec)
    ? body.slideSpec
    : readSlideSpec(slideId);
  const validation = await validateSlideSpecInDom({
    id: slide.id,
    index: slide.index,
    slideSpec,
    title: slide.title
  });

  deps.createJsonResponse(res, 200, {
    slideId,
    validation
  });
}

async function handleSlideContextUpdateRequest(
  deps: SlideEditHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse,
  slideId: string
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const context = updateSlideContext(slideId, body || {});
  deps.createJsonResponse(res, 200, {
    context,
    slideContext: context.slides[slideId] || {}
  });
}

export function createSlideEditHandlers(deps: SlideEditHandlerDependencies) {
  return {
    handleSlideContextUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) =>
      handleSlideContextUpdateRequest(deps, req, res, slideId),
    handleSlideCurrentValidation: (req: ServerRequest, res: ServerResponse, slideId: string) =>
      handleSlideCurrentValidationRequest(deps, req, res, slideId),
    handleSlideSourceUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) =>
      handleSlideSourceUpdateRequest(deps, req, res, slideId),
    handleSlideSpecUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) =>
      handleSlideSpecUpdateRequest(deps, req, res, slideId)
  };
}
