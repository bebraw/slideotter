import * as http from "http";

import { createCustomVisual, getCustomVisual, hydrateCustomVisualSlideSpec, listCustomVisuals } from "./services/custom-visuals.ts";
import { getSlide } from "./services/slide-queries.ts";
import { readSlideSource, readSlideSpec } from "./services/slide-spec-store.ts";
import { writeSlideSpec } from "./services/slide-writes.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  customVisual?: JsonObject;
};

type CustomVisualHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  describeStructuredSlide: (slideId: string) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  serializeSlideSpec: (slideSpec: unknown) => string;
};

function applyCustomVisualSelection(slideId: string, customVisualId: string): void {
  const currentSpec = readSlideSpec(slideId);
  const nextSpec: SlideSpecPayload = { ...currentSpec };

  if (!customVisualId) {
    delete nextSpec.customVisual;
  } else {
    const customVisual = getCustomVisual(customVisualId);
    nextSpec.customVisual = {
      id: customVisual.id,
      role: customVisual.role,
      title: customVisual.title
    };
  }

  writeSlideSpec(slideId, nextSpec);
}

function createSlideCustomVisualPayload(
  slideId: string,
  structured: JsonObject,
  serializeSlideSpec: (slideSpec: unknown) => string
): JsonObject {
  const hydratedSlideSpec = structured.slideSpec
    ? hydrateCustomVisualSlideSpec(structured.slideSpec)
    : structured.slideSpec;

  return {
    customVisuals: listCustomVisuals(),
    slide: getSlide(slideId),
    slideSpec: hydratedSlideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  };
}

export function createCustomVisualHandlers(deps: CustomVisualHandlerDependencies) {
  const {
    createJsonResponse,
    describeStructuredSlide,
    publishRuntimeState,
    readJsonBody,
    serializeSlideSpec
  } = deps;

  async function handleCustomVisualCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const customVisual = createCustomVisual(body || {});
    publishRuntimeState();

    createJsonResponse(res, 200, {
      customVisual,
      customVisuals: listCustomVisuals()
    });
  }

  function handleCustomVisualsIndex(res: ServerResponse): void {
    createJsonResponse(res, 200, { customVisuals: listCustomVisuals() });
  }

  async function handleSlideCustomVisualUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
    const body = await readJsonBody(req);
    const customVisualId = typeof body.customVisualId === "string" ? body.customVisualId : "";
    applyCustomVisualSelection(slideId, customVisualId);
    const structured = describeStructuredSlide(slideId);
    publishRuntimeState();

    createJsonResponse(res, 200, createSlideCustomVisualPayload(slideId, structured, serializeSlideSpec));
  }

  return {
    handleCustomVisualCreate,
    handleCustomVisualsIndex,
    handleSlideCustomVisualUpdate
  };
}
