import * as http from "http";

import { getDomPreviewState } from "./services/dom-preview.ts";
import {
  applyLayoutToSlideSpec,
  deleteFavoriteLayout,
  exportDeckLayout,
  exportDeckLayoutPack,
  exportFavoriteLayout,
  exportFavoriteLayoutPack,
  importDeckLayout,
  importDeckLayoutPack,
  importFavoriteLayout,
  importFavoriteLayoutPack,
  readFavoriteLayouts,
  readLayouts,
  saveFavoriteLayout,
  saveFavoriteLayoutFromDeckLayout,
  saveLayoutFromSlideSpec
} from "./services/layouts.ts";
import { getPreviewManifest } from "./services/build.ts";
import { getSlide, readSlideSource, readSlideSpec, writeSlideSpec } from "./services/slides.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  layout?: unknown;
  type?: unknown;
};

type LayoutImportDocument = JsonObject & {
  kind?: unknown;
  layouts?: unknown;
};

type LayoutPreviewPayload = JsonObject & {
  currentSlideValidation?: unknown;
  mode?: unknown;
};

type RuntimeStateAccess = {
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
};

type LayoutHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  describeStructuredSlide: (slideId: string) => JsonObject;
  isJsonObject: (value: unknown) => value is JsonObject;
  isSlideSpecPayload: (value: unknown) => value is SlideSpecPayload;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeSlideSpec: (slideSpec: unknown) => string;
};

function isLayoutImportDocument(value: unknown): value is LayoutImportDocument {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isLayoutPreviewPayload(value: unknown): value is LayoutPreviewPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function createLayoutHandlers(deps: LayoutHandlerDependencies) {
  const {
    createJsonResponse,
    describeStructuredSlide,
    isJsonObject,
    isSlideSpecPayload,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeSlideSpec
  } = deps;

  function createLayoutEvidence(body: JsonObject): JsonObject {
    const layoutPreview = isLayoutPreviewPayload(body.layoutPreview)
      ? body.layoutPreview
      : null;
    const currentSlideValidation = layoutPreview && isJsonObject(layoutPreview.currentSlideValidation)
      ? layoutPreview.currentSlideValidation
      : null;
    return {
      currentSlideValidation: currentSlideValidation || null,
      mode: layoutPreview && typeof layoutPreview.mode === "string" ? layoutPreview.mode : "current-slide",
      operation: typeof body.operation === "string" ? body.operation : "layout-save",
      status: currentSlideValidation && currentSlideValidation.ok === true ? "passed" : "unchecked"
    };
  }

  function createLayoutCompatibility(body: JsonObject, slideType: unknown): JsonObject {
    const layoutPreview = isLayoutPreviewPayload(body.layoutPreview)
      ? body.layoutPreview
      : null;
    const mode = layoutPreview && typeof layoutPreview.mode === "string" ? layoutPreview.mode : "current-slide";
    return {
      contentDensities: mode === "multi-slide" ? ["current-slide", "representative"] : ["current-slide"],
      slideTypes: typeof slideType === "string" && slideType ? [slideType] : [],
      themes: ["current"]
    };
  }

  async function handleLayoutSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const slideId = typeof body.slideId === "string" ? body.slideId : "";
    if (!slideId) {
      throw new Error("Expected slideId when saving a layout");
    }

    const slideSpec = readSlideSpec(slideId);
    const saved = saveLayoutFromSlideSpec(slideSpec, {
      compatibility: createLayoutCompatibility(body, slideSpec.type),
      description: body.description,
      name: body.name,
      provenance: {
        operation: "manual-save",
        slideId,
        source: "current-slide",
        slideType: slideSpec.type
      },
      validationEvidence: createLayoutEvidence(body)
    });
    publishRuntimeState();

    createJsonResponse(res, 200, {
      layout: saved.layout,
      layouts: saved.state.layouts
    });
  }

  async function handleFavoriteLayoutSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
    if (!layoutId) {
      throw new Error("Expected layoutId when saving a favorite layout");
    }

    const saved = saveFavoriteLayoutFromDeckLayout(layoutId);
    publishRuntimeState();

    createJsonResponse(res, 200, {
      favoriteLayout: saved.layout,
      favoriteLayouts: saved.state.layouts
    });
  }

  async function handleLayoutCandidateSave(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const slideSpec = isSlideSpecPayload(body.slideSpec)
      ? body.slideSpec
      : null;
    if (!slideSpec) {
      throw new Error("Expected slideSpec when saving a layout candidate");
    }

    const name = typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : `${slideSpec.layout || "standard"} ${slideSpec.type || "slide"}`;
    const description = typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : `Saved from generated layout candidate "${name}".`;
    const deckSaved = saveLayoutFromSlideSpec(slideSpec, {
      compatibility: createLayoutCompatibility(body, slideSpec.type),
      description,
      definition: body.layoutDefinition,
      name,
      provenance: {
        candidateOperation: typeof body.operation === "string" ? body.operation : "layout-candidate",
        source: "candidate",
        slideType: slideSpec.type
      },
      validationEvidence: createLayoutEvidence(body)
    });
    let favoriteSaved = null;

    if (body.favorite === true) {
      const layoutPreview = isLayoutPreviewPayload(body.layoutPreview)
        ? body.layoutPreview
        : null;
      if (body.operation === "custom-layout" && (!layoutPreview || layoutPreview.mode !== "multi-slide")) {
        throw new Error("Favorite custom layouts require a multi-slide preview");
      }
      const currentSlideValidation = layoutPreview && isJsonObject(layoutPreview.currentSlideValidation)
        ? layoutPreview.currentSlideValidation
        : null;
      if (
        body.operation === "custom-layout"
        && (!currentSlideValidation || currentSlideValidation.ok !== true)
      ) {
        throw new Error("Favorite custom layouts require a passing current-slide validation preview");
      }
      favoriteSaved = saveFavoriteLayout({
        ...deckSaved.layout,
        id: `favorite-${deckSaved.layout.id}`,
        description: deckSaved.layout.description || description
      });
    }

    publishRuntimeState();
    createJsonResponse(res, 200, {
      favoriteLayout: favoriteSaved ? favoriteSaved.layout : null,
      favoriteLayouts: readFavoriteLayouts().layouts,
      layout: deckSaved.layout,
      layouts: readLayouts().layouts
    });
  }

  async function handleFavoriteLayoutDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
    if (!layoutId) {
      throw new Error("Expected layoutId when deleting a favorite layout");
    }

    const state = deleteFavoriteLayout(layoutId);
    publishRuntimeState();

    createJsonResponse(res, 200, {
      favoriteLayouts: state.layouts
    });
  }

  async function handleLayoutExport(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
    const scope = typeof body.scope === "string" ? body.scope : "deck";
    const pack = body.pack === true;
    if (!layoutId && !pack) {
      throw new Error("Expected layoutId when exporting a layout");
    }

    const document = pack
      ? scope === "favorite"
        ? exportFavoriteLayoutPack()
        : exportDeckLayoutPack()
      : scope === "favorite"
        ? exportFavoriteLayout(layoutId)
        : exportDeckLayout(layoutId);

    createJsonResponse(res, 200, { document });
  }

  async function handleLayoutImport(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const scope = typeof body.scope === "string" ? body.scope : "deck";
    const document = isLayoutImportDocument(body.document) ? body.document : null;
    if (!document) {
      throw new Error("Expected document when importing a layout");
    }

    const isPack = document.kind === "slideotter.layoutPack" || Array.isArray(document.layouts);
    const saved = scope === "favorite"
      ? isPack
        ? importFavoriteLayoutPack(document, { description: body.description, id: body.id, name: body.name })
        : importFavoriteLayout(document, { description: body.description, id: body.id, name: body.name })
      : isPack
        ? importDeckLayoutPack(document, { description: body.description, id: body.id, name: body.name })
        : importDeckLayout(document, { description: body.description, id: body.id, name: body.name });
    publishRuntimeState();
    const importedLayouts = "layouts" in saved && Array.isArray(saved.layouts) ? saved.layouts : [saved.layout];

    createJsonResponse(res, 200, {
      favoriteLayouts: readFavoriteLayouts().layouts,
      layout: saved.layout,
      importedLayouts,
      layouts: readLayouts().layouts
    });
  }

  async function handleLayoutApply(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const slideId = typeof body.slideId === "string" ? body.slideId : "";
    const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
    if (!slideId || !layoutId) {
      throw new Error("Expected slideId and layoutId when applying a layout");
    }

    const currentSpec = readSlideSpec(slideId);
    const nextSpec = applyLayoutToSlideSpec(currentSpec, layoutId);
    writeSlideSpec(slideId, nextSpec);
    const structured = describeStructuredSlide(slideId);
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      domPreview: getDomPreviewState({ includeDetours: true }),
      favoriteLayouts: readFavoriteLayouts().layouts,
      layouts: readLayouts().layouts,
      previews: getPreviewManifest(),
      slide: getSlide(slideId),
      slideSpec: structured.slideSpec,
      slideSpecError: structured.slideSpecError,
      source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
      structured: structured.structured
    });
  }

  function handleLayoutsIndex(res: ServerResponse): void {
    createJsonResponse(res, 200, { layouts: readLayouts().layouts });
  }

  return {
    handleFavoriteLayoutDelete,
    handleFavoriteLayoutSave,
    handleLayoutApply,
    handleLayoutCandidateSave,
    handleLayoutExport,
    handleLayoutImport,
    handleLayoutsIndex,
    handleLayoutSave
  };
}
