import * as http from "http";

import { createCustomVisual, getCustomVisual, hydrateCustomVisualSlideSpec, listCustomVisuals } from "./services/custom-visuals.ts";
import { getSlide, readSlideSource, readSlideSpec, writeSlideSpec } from "./services/slides.ts";

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
    const currentSpec = readSlideSpec(slideId);
    const nextSpec: SlideSpecPayload = { ...currentSpec };
    const customVisualId = typeof body.customVisualId === "string" ? body.customVisualId : "";

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
    const structured = describeStructuredSlide(slideId);
    const hydratedSlideSpec = structured.slideSpec
      ? hydrateCustomVisualSlideSpec(structured.slideSpec)
      : structured.slideSpec;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      customVisuals: listCustomVisuals(),
      slide: getSlide(slideId),
      slideSpec: hydratedSlideSpec,
      slideSpecError: structured.slideSpecError,
      source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
      structured: structured.structured
    });
  }

  return {
    handleCustomVisualCreate,
    handleCustomVisualsIndex,
    handleSlideCustomVisualUpdate
  };
}
