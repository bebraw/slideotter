import * as http from "http";

import { getDomPreviewState } from "./services/dom-preview-state.ts";
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
import { getPreviewManifest } from "./services/preview-manifest.ts";
import { getSlide } from "./services/slide-queries.ts";
import { readSlideSource, readSlideSpec } from "./services/slide-spec-store.ts";
import { writeSlideSpec } from "./services/slide-writes.ts";

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

function isJsonRecord(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createLayoutEvidence(body: JsonObject): JsonObject {
  const layoutPreview = isLayoutPreviewPayload(body.layoutPreview)
    ? body.layoutPreview
    : null;
  const currentSlideValidation = layoutPreview && isJsonRecord(layoutPreview.currentSlideValidation)
    ? layoutPreview.currentSlideValidation
    : null;
  const mode = layoutPreview && typeof layoutPreview.mode === "string"
    ? layoutPreview.mode
    : "current-slide";
  const representativePreview = mode === "multi-slide";
  const currentSlidePassed = currentSlideValidation?.ok === true;

  return {
    currentSlideValidation: currentSlideValidation || null,
    favoriteReady: representativePreview && currentSlidePassed,
    mode,
    operation: typeof body.operation === "string" ? body.operation : "layout-save",
    previewEvidence: {
      currentSlide: Boolean(currentSlideValidation),
      representative: representativePreview
    },
    status: currentSlidePassed ? "passed" : "unchecked"
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
    themes: ["current"],
    validationScope: mode === "multi-slide" ? "current-and-representative" : "current-slide"
  };
}

function layoutCandidateText(body: JsonObject, slideSpec: SlideSpecPayload): { description: string; name: string } {
  const name = typeof body.name === "string" && body.name.trim()
    ? body.name.trim()
    : `${slideSpec.layout || "standard"} ${slideSpec.type || "slide"}`;
  const description = typeof body.description === "string" && body.description.trim()
    ? body.description.trim()
    : `Saved from generated layout candidate "${name}".`;

  return {
    description,
    name
  };
}

function validateFavoriteLayoutCandidate(body: JsonObject): void {
  if (body.favorite !== true || body.operation !== "custom-layout") {
    return;
  }

  const layoutPreview = isLayoutPreviewPayload(body.layoutPreview)
    ? body.layoutPreview
    : null;
  if (!layoutPreview || layoutPreview.mode !== "multi-slide") {
    throw new Error("Favorite custom layouts require a multi-slide preview");
  }
  const currentSlideValidation = layoutPreview && isJsonRecord(layoutPreview.currentSlideValidation)
    ? layoutPreview.currentSlideValidation
    : null;
  if (!currentSlideValidation || currentSlideValidation.ok !== true) {
    throw new Error("Favorite custom layouts require a passing current-slide validation preview");
  }
}

function saveFavoriteLayoutCandidate(body: JsonObject, deckLayout: JsonObject, description: string): ReturnType<typeof saveFavoriteLayout> | null {
  if (body.favorite !== true) {
    return null;
  }

  validateFavoriteLayoutCandidate(body);
  return saveFavoriteLayout({
    ...deckLayout,
    id: `favorite-${deckLayout.id}`,
    description: deckLayout.description || description
  });
}

async function handleLayoutSaveRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
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
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    layout: saved.layout,
    layouts: saved.state.layouts
  });
}

async function handleFavoriteLayoutSaveRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  if (!layoutId) {
    throw new Error("Expected layoutId when saving a favorite layout");
  }

  const saved = saveFavoriteLayoutFromDeckLayout(layoutId);
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    favoriteLayout: saved.layout,
    favoriteLayouts: saved.state.layouts
  });
}

async function handleLayoutCandidateSaveRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const slideSpec = deps.isSlideSpecPayload(body.slideSpec)
    ? body.slideSpec
    : null;
  if (!slideSpec) {
    throw new Error("Expected slideSpec when saving a layout candidate");
  }

  const { description, name } = layoutCandidateText(body, slideSpec);
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
  const favoriteSaved = saveFavoriteLayoutCandidate(body, deckSaved.layout, description);

  deps.publishRuntimeState();
  deps.createJsonResponse(res, 200, {
    favoriteLayout: favoriteSaved ? favoriteSaved.layout : null,
    favoriteLayouts: readFavoriteLayouts().layouts,
    layout: deckSaved.layout,
    layouts: readLayouts().layouts
  });
}

async function handleFavoriteLayoutDeleteRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  if (!layoutId) {
    throw new Error("Expected layoutId when deleting a favorite layout");
  }

  const state = deleteFavoriteLayout(layoutId);
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    favoriteLayouts: state.layouts
  });
}

async function handleLayoutExportRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
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

  deps.createJsonResponse(res, 200, { document });
}

async function handleLayoutImportRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
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
  deps.publishRuntimeState();
  const importedLayouts = "layouts" in saved && Array.isArray(saved.layouts) ? saved.layouts : [saved.layout];

  deps.createJsonResponse(res, 200, {
    favoriteLayouts: readFavoriteLayouts().layouts,
    layout: saved.layout,
    importedLayouts,
    layouts: readLayouts().layouts
  });
}

async function handleLayoutApplyRequest(
  deps: LayoutHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const slideId = typeof body.slideId === "string" ? body.slideId : "";
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  if (!slideId || !layoutId) {
    throw new Error("Expected slideId and layoutId when applying a layout");
  }

  const currentSpec = readSlideSpec(slideId);
  const nextSpec = applyLayoutToSlideSpec(currentSpec, layoutId);
  writeSlideSpec(slideId, nextSpec);
  const structured = deps.describeStructuredSlide(slideId);
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    domPreview: getDomPreviewState({ includeDetours: true }),
    favoriteLayouts: readFavoriteLayouts().layouts,
    layouts: readLayouts().layouts,
    previews: getPreviewManifest(),
    slide: getSlide(slideId),
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? deps.serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
}

function handleLayoutsIndexRequest(deps: LayoutHandlerDependencies, res: ServerResponse): void {
  deps.createJsonResponse(res, 200, { layouts: readLayouts().layouts });
}

export function createLayoutHandlers(deps: LayoutHandlerDependencies) {
  return {
    handleFavoriteLayoutDelete: (req: ServerRequest, res: ServerResponse) =>
      handleFavoriteLayoutDeleteRequest(deps, req, res),
    handleFavoriteLayoutSave: (req: ServerRequest, res: ServerResponse) =>
      handleFavoriteLayoutSaveRequest(deps, req, res),
    handleLayoutApply: (req: ServerRequest, res: ServerResponse) => handleLayoutApplyRequest(deps, req, res),
    handleLayoutCandidateSave: (req: ServerRequest, res: ServerResponse) =>
      handleLayoutCandidateSaveRequest(deps, req, res),
    handleLayoutExport: (req: ServerRequest, res: ServerResponse) => handleLayoutExportRequest(deps, req, res),
    handleLayoutImport: (req: ServerRequest, res: ServerResponse) => handleLayoutImportRequest(deps, req, res),
    handleLayoutsIndex: (res: ServerResponse) => handleLayoutsIndexRequest(deps, res),
    handleLayoutSave: (req: ServerRequest, res: ServerResponse) => handleLayoutSaveRequest(deps, req, res)
  };
}

export const _test = {
  createLayoutCompatibility,
  createLayoutEvidence
};
