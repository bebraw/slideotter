import type * as http from "http";
import type { ApiPatternRoute } from "./routes.ts";
import { getPreviewManifest } from "./services/build.ts";
import { getDeckContext } from "./services/state.ts";
import { getSlide, getSlides, readSlideSource } from "./services/slides.ts";
import {
  getVariantStorageStatus,
  listVariantsForSlide
} from "./services/variants.ts";
import { createJsonResponse } from "./http-responses.ts";
import { type JsonObject } from "./api-payloads.ts";
import {
  describeStructuredSlide,
  serializeSlideSpec
} from "./slide-response-helpers.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;

type SlideApiRouteHandlers = {
  handleSlideContextUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) => Promise<void> | void;
  handleSlideCurrentValidation: (req: ServerRequest, res: ServerResponse, slideId: string) => Promise<void> | void;
  handleSlideCustomVisualUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) => Promise<void> | void;
  handleSlideMaterialUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) => Promise<void> | void;
  handleSlideSourceUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) => Promise<void> | void;
  handleSlideSpecUpdate: (req: ServerRequest, res: ServerResponse, slideId: string) => Promise<void> | void;
};

function createSlideApiRoutes(handlers: SlideApiRouteHandlers): readonly ApiPatternRoute[] {
  return [
    {
      method: "GET",
      pattern: /^\/api\/v1\/preview\/slide\/(\d+)$/,
      handler: (_req, res, _url, match) => {
        const index = Number(match[1]);
        const previews = getPreviewManifest();
        const page = previews.pages.find((entry: JsonObject) => entry.index === index) || null;
        createJsonResponse(res, 200, {
          page,
          slide: getSlides().find((entry: JsonObject) => entry.index === index) || null
        });
      }
    },
    {
      method: "GET",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)$/,
      handler: (_req, res, _url, match) => {
        const slideId = match[1] || "";
        const structured = describeStructuredSlide(slideId);
        const source = structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId);
        createJsonResponse(res, 200, {
          context: getDeckContext().slides[slideId] || {},
          slideSpec: structured.slideSpec,
          slideSpecError: structured.slideSpecError,
          slide: getSlide(slideId),
          source,
          structured: structured.structured,
          variantStorage: getVariantStorageStatus(),
          variants: listVariantsForSlide(slideId)
        });
      }
    },
    {
      method: "POST",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/source$/,
      handler: (req, res, _url, match) => handlers.handleSlideSourceUpdate(req, res, match[1] || "")
    },
    {
      method: "POST",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/slide-spec$/,
      handler: (req, res, _url, match) => handlers.handleSlideSpecUpdate(req, res, match[1] || "")
    },
    {
      method: "POST",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/material$/,
      handler: (req, res, _url, match) => handlers.handleSlideMaterialUpdate(req, res, match[1] || "")
    },
    {
      method: "POST",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/custom-visual$/,
      handler: (req, res, _url, match) => handlers.handleSlideCustomVisualUpdate(req, res, match[1] || "")
    },
    {
      method: "POST",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/validate-current$/,
      handler: (req, res, _url, match) => handlers.handleSlideCurrentValidation(req, res, match[1] || "")
    },
    {
      method: "POST",
      pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/context$/,
      handler: (req, res, _url, match) => handlers.handleSlideContextUpdate(req, res, match[1] || "")
    }
  ];
}

export { createSlideApiRoutes };
