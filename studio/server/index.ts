import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as ts from "typescript";
import { URL } from "url";
import { fileURLToPath } from "url";
import { loadEnvFiles } from "./services/env.ts";

loadEnvFiles();

import { getPreviewManifest } from "./services/build.ts";
import { renderDomPreviewDocument, renderPresentationPreviewDocument } from "./services/dom-preview.ts";
import {
  createApiRootResource,
  createCandidateCollectionResource,
  createCandidateResource,
  createCheckReportResource,
  createCurrentJobResource,
  createExportCollectionResource,
  createPresentationCollectionResource,
  createPresentationResource,
  createSchemaResource,
  createSlideCollectionResource,
  createSlideResource,
  createSlideWorkflowResource
} from "./services/hypermedia.ts";
import { getMaterialFilePath } from "./services/materials.ts";
import { clientDistDir, outputDir } from "./services/paths.ts";
import {
  clearPresentationCreationDraft,
  getPresentationPaths,
  getPresentationCreationDraft
} from "./services/presentations.ts";
import { ensureState, getDeckContext } from "./services/state.ts";
import { getSlide, getSlides, readSlideSource, readSlideSpec } from "./services/slides.ts";
import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createBuildValidationApiRoutes } from "./build-validation-routes.ts";
import { createCreationContentRunHandlers } from "./creation-content-run-handlers.ts";
import { createCreationDraftHandlers } from "./creation-draft-handlers.ts";
import { createCreationOutlineApiRoutes } from "./creation-outline-routes.ts";
import { createCustomVisualHandlers } from "./custom-visual-handlers.ts";
import { createCustomVisualApiRoutes } from "./custom-visual-routes.ts";
import { createDeckSlideHandlers } from "./deck-slide-handlers.ts";
import { createDeckSlideApiRoutes } from "./deck-slide-routes.ts";
import { createLayoutHandlers } from "./layout-handlers.ts";
import { createLayoutApiRoutes } from "./layout-routes.ts";
import { createLlmHandlers } from "./llm-handlers.ts";
import { createLlmApiRoutes } from "./llm-routes.ts";
import { createMaterialSourceHandlers } from "./material-source-handlers.ts";
import { createMaterialSourceApiRoutes } from "./material-source-routes.ts";
import { createPresentationHandlers } from "./presentation-handlers.ts";
import { createPresentationApiRoutes } from "./presentation-routes.ts";
import { dispatchExactApiRoute, dispatchPatternApiRoute, type ApiPatternRoute, type ApiRoute } from "./routes.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";
import { createAssistantHandlers } from "./assistant-handlers.ts";
import {
  createWorkflowProgressReporter,
  publishCreationDraftUpdate,
  publishRuntimeState,
  registerRuntimeStream,
  resetPresentationRuntime,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
} from "./runtime-state.ts";
import {
  getVariantStorageStatus,
  listVariantsForSlide
} from "./services/variants.ts";
import {
  createPresentationPayload,
  getStudioDomPreviewState,
  getWorkspaceState
} from "./workspace-state.ts";

const defaultPort = Number(process.env.PORT || 4173);
const defaultHost = process.env.HOST || "127.0.0.1";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  layout?: unknown;
  media?: JsonObject;
  type?: unknown;
};

type ImageSearchPayload = JsonObject & {
  count?: unknown;
  provider?: unknown;
  query?: unknown;
  restrictions?: unknown;
};

type CreationFields = JsonObject & {
  imageSearch: {
    count: unknown;
    provider: unknown;
    query: string;
    restrictions: string;
  };
  presentationSourceText: string;
  targetSlideCount: unknown;
  title: string;
  visualTheme: JsonObject;
};

type SourcePayload = JsonObject & {
  text?: unknown;
  title?: unknown;
  url?: unknown;
};

type DeckPlanSlide = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  sourceNotes?: unknown;
  sourceText?: unknown;
  title?: unknown;
  type?: unknown;
  visualNeed?: unknown;
};

type DeckPlanPayload = JsonObject & {
  narrativeArc?: unknown;
  outline?: unknown;
  slides?: DeckPlanSlide[];
  thesis?: unknown;
};

type OutlinePlanPayload = JsonObject & {
  archivedAt?: unknown;
  audience?: unknown;
  name?: unknown;
  objective?: unknown;
  purpose?: unknown;
  tone?: unknown;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonObjectOrEmpty(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

function isSlideSpecPayload(value: unknown): value is SlideSpecPayload {
  return isJsonObject(value);
}

function isImageSearchPayload(value: unknown): value is ImageSearchPayload {
  return isJsonObject(value);
}

function isSourcePayload(value: unknown): value is SourcePayload {
  return isJsonObject(value);
}

function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return isJsonObject(value);
}

function isDeckPlanPayload(value: unknown): value is DeckPlanPayload {
  return isJsonObject(value);
}

function deckPlanSlides(plan: unknown): DeckPlanSlide[] {
  return isDeckPlanPayload(plan) && Array.isArray(plan.slides)
    ? plan.slides.filter(isDeckPlanSlide)
    : [];
}

function isOutlinePlanPayload(value: unknown): value is OutlinePlanPayload {
  return isJsonObject(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStatusCode(error: unknown): number {
  return isJsonObject(error) && typeof error.statusCode === "number" ? error.statusCode : 500;
}

function errorCode(error: unknown): string {
  return isJsonObject(error) && typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
}

type ServerStartOptions = {
  host?: string;
  port?: number | string;
};

function createJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(body);
}

function createTextResponse(res: ServerResponse, statusCode: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": contentType
  });
  res.end(body);
}

function notFound(res: ServerResponse): void {
  createTextResponse(res, 404, "Not found");
}

function readBody(req: ServerRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: Buffer | string) => {
      body += chunk;
      if (body.length > 7 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJsonBody(req: ServerRequest): Promise<JsonObject> {
  const body = await readBody(req);
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Request body must be valid JSON");
  }
}

function sendFile(res: ServerResponse, fileName: string): void {
  if (!fs.existsSync(fileName) && path.extname(fileName).toLowerCase() === ".js") {
    const tsFileName = `${fileName.slice(0, -3)}.ts`;
    if (fs.existsSync(tsFileName) && fs.statSync(tsFileName).isFile()) {
      const source = fs.readFileSync(tsFileName, "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.None,
          target: ts.ScriptTarget.ES2022
        },
        fileName: tsFileName
      }).outputText;
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "application/javascript; charset=utf-8"
      });
      res.end(output);
      return;
    }
  }

  if (!fs.existsSync(fileName) || !fs.statSync(fileName).isFile()) {
    notFound(res);
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp"
  };
  const contentType = contentTypes[ext] || "application/octet-stream";
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": contentType
  };

  if (ext === ".pdf" || ext === ".pptx") {
    headers["Content-Disposition"] = `attachment; filename="${path.basename(fileName).replace(/["\\\r\n]/gu, "_")}"`;
  }

  const stream = fs.createReadStream(fileName);
  res.writeHead(200, headers);
  stream.pipe(res);
}

function serializeSlideSpec(slideSpec: unknown): string {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

function isVisualThemePayload(value: unknown): value is JsonObject {
  return isJsonObject(value);
}

function describeStructuredSlide(slideId: string): JsonObject {
  try {
    const slideSpec = readSlideSpec(slideId);
    return {
      slideSpec,
      slideSpecError: null,
      structured: true
    };
  } catch (error) {
    return {
      slideSpec: null,
      slideSpecError: errorMessage(error),
      structured: false
    };
  }
}

function normalizeCreationFields(body: JsonObject = {}): CreationFields {
  const fields = body;
  const imageSearch = isImageSearchPayload(fields.imageSearch) ? fields.imageSearch : null;
  const targetSlideCount = fields.targetSlideCount || fields.targetCount || null;

  return {
    audience: String(fields.audience || "").trim(),
    constraints: String(fields.constraints || "").trim(),
    imageSearch: imageSearch
      ? {
          count: imageSearch.count || 3,
          provider: imageSearch.provider || "openverse",
          query: String(imageSearch.query || "").trim(),
          restrictions: String(imageSearch.restrictions || "").trim()
        }
      : {
          count: 3,
          provider: "openverse",
          query: "",
          restrictions: ""
        },
    objective: String(fields.objective || "").trim(),
    presentationSourceText: String(fields.presentationSourceText || "").trim(),
    sourcingStyle: typeof fields.sourcingStyle === "string" && ["compact-references", "inline-notes", "none"].includes(fields.sourcingStyle)
      ? fields.sourcingStyle
      : "",
    targetSlideCount,
    themeBrief: String(fields.themeBrief || "").trim(),
    title: String(fields.title || "").trim(),
    tone: String(fields.tone || "").trim(),
    visualTheme: isJsonObject(fields.visualTheme) ? fields.visualTheme : {}
  };
}

function buildCompactPresentationSourceText(presentationId: string): string {
  const paths = getPresentationPaths(presentationId);
  const store = fs.existsSync(paths.sourcesFile)
    ? JSON.parse(fs.readFileSync(paths.sourcesFile, "utf8"))
    : { sources: [] };
  const sources = isJsonObject(store) && Array.isArray(store.sources) ? store.sources.filter(isSourcePayload) : [];

  return sources
    .map((source: SourcePayload, index: number) => {
      const title = String(source.title || `Source ${index + 1}`).replace(/\s+/g, " ").trim();
      const url = String(source.url || "").trim();
      const text = String(source.text || "").replace(/\s+/g, " ").trim().slice(0, 900);
      return [
        title ? `Source: ${title}` : "",
        url ? `URL: ${url}` : "",
        text
      ].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .slice(0, 6)
    .join("\n\n");
}

const buildValidationHandlers = createBuildValidationHandlers({
  createJsonResponse,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
});
const llmHandlers = createLlmHandlers({
  createJsonResponse,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState
});
const presentationHandlers = createPresentationHandlers({
  createJsonResponse,
  createPresentationPayload,
  createWorkflowProgressReporter,
  jsonObjectOrEmpty,
  publishRuntimeState,
  readJsonBody,
  resetPresentationRuntime,
  runtimeState,
  updateWorkflowState
});
const materialSourceHandlers = createMaterialSourceHandlers({
  createJsonResponse,
  describeStructuredSlide,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState,
  serializeSlideSpec,
  updateWorkflowState
});
const customVisualHandlers = createCustomVisualHandlers({
  createJsonResponse,
  describeStructuredSlide,
  publishRuntimeState,
  readJsonBody,
  serializeSlideSpec
});
const layoutHandlers = createLayoutHandlers({
  createJsonResponse,
  describeStructuredSlide,
  isJsonObject,
  isSlideSpecPayload,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeSlideSpec
});
const themeHandlers = createThemeHandlers({
  createJsonResponse,
  readJsonBody,
  updateWorkflowState
});
const deckSlideHandlers = createDeckSlideHandlers({
  createJsonResponse,
  jsonObjectOrEmpty,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
});
const operationHandlers = createOperationHandlers({
  createJsonResponse,
  createWorkflowProgressReporter,
  describeStructuredSlide,
  isVisualThemePayload,
  jsonObjectOrEmpty,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState,
  serializeSlideSpec,
  updateWorkflowState
});
const outlinePlanHandlers = createOutlinePlanHandlers({
  buildCompactPresentationSourceText,
  createJsonResponse,
  createPresentationPayload,
  deckPlanSlides,
  isJsonObject,
  isOutlinePlanPayload,
  jsonObjectOrEmpty,
  normalizeCreationFields,
  publishCreationDraftUpdate,
  publishRuntimeState,
  readJsonBody,
  resetPresentationRuntime,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
});
const creationDraftHandlers = createCreationDraftHandlers({
  createJsonResponse,
  createWorkflowProgressReporter,
  deckPlanSlides,
  isDeckPlanPayload,
  isJsonObject,
  normalizeCreationFields,
  publishCreationDraftUpdate,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
});
const creationContentRunHandlers = createCreationContentRunHandlers({
  createJsonResponse,
  createWorkflowProgressReporter,
  errorCode,
  errorMessage,
  isJsonObject,
  jsonObjectOrEmpty,
  normalizeCreationFields,
  publishCreationDraftUpdate,
  publishRuntimeState,
  readJsonBody,
  resetPresentationRuntime,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
});
const slideEditHandlers = createSlideEditHandlers({
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
});
const assistantHandlers = createAssistantHandlers({
  createJsonResponse,
  createWorkflowProgressReporter,
  jsonObjectOrEmpty,
  publishRuntimeState,
  readJsonBody,
  runtimeState,
  serializeRuntimeState,
  updateWorkflowState
});

const exactApiRoutes: readonly ApiRoute[] = [
  ...createBuildValidationApiRoutes({
    handleBuild: (_req, res) => buildValidationHandlers.handleBuild(res),
    handleCheckRemediation: buildValidationHandlers.handleCheckRemediation,
    handlePptxExport: (_req, res) => buildValidationHandlers.handlePptxExport(res),
    handleValidate: buildValidationHandlers.handleValidate
  }),
  ...createLlmApiRoutes({
    handleLlmCheck: (_req, res) => llmHandlers.handleLlmCheck(res),
    handleLlmModels: (_req, res) => llmHandlers.handleLlmModels(res),
    handleLlmModelUpdate: llmHandlers.handleLlmModelUpdate
  }),
  ...createPresentationApiRoutes({
    handlePresentationCreate: presentationHandlers.handlePresentationCreate,
    handlePresentationDelete: presentationHandlers.handlePresentationDelete,
    handlePresentationDuplicate: presentationHandlers.handlePresentationDuplicate,
    handlePresentationRegenerate: presentationHandlers.handlePresentationRegenerate,
    handlePresentationSelect: presentationHandlers.handlePresentationSelect,
    handlePresentationsIndex: (_req, res) => presentationHandlers.handlePresentationsIndex(res)
  }),
  ...createCreationOutlineApiRoutes({
    handleOutlinePlanArchive: outlinePlanHandlers.handleOutlinePlanArchive,
    handleOutlinePlanDelete: outlinePlanHandlers.handleOutlinePlanDelete,
    handleOutlinePlanDerive: outlinePlanHandlers.handleOutlinePlanDerive,
    handleOutlinePlanDuplicate: outlinePlanHandlers.handleOutlinePlanDuplicate,
    handleOutlinePlanGenerate: outlinePlanHandlers.handleOutlinePlanGenerate,
    handleOutlinePlanPropose: outlinePlanHandlers.handleOutlinePlanPropose,
    handleOutlinePlanSave: outlinePlanHandlers.handleOutlinePlanSave,
    handleOutlinePlanStageCreation: outlinePlanHandlers.handleOutlinePlanStageCreation,
    handlePresentationDraftApprove: creationDraftHandlers.handlePresentationDraftApprove,
    handlePresentationDraftContentAcceptPartial: (_req, res) => creationContentRunHandlers.handlePresentationDraftContentAcceptPartial(res),
    handlePresentationDraftContentRetry: creationContentRunHandlers.handlePresentationDraftContentRetry,
    handlePresentationDraftContentStop: (_req, res) => creationContentRunHandlers.handlePresentationDraftContentStop(res),
    handlePresentationDraftCreate: creationContentRunHandlers.handlePresentationDraftCreate,
    handlePresentationDraftOutline: creationDraftHandlers.handlePresentationDraftOutline,
    handlePresentationDraftOutlineSlide: creationDraftHandlers.handlePresentationDraftOutlineSlide,
    handlePresentationDraftSave: creationDraftHandlers.handlePresentationDraftSave
  }),
  { method: "POST", pathname: "/api/themes/save", handler: themeHandlers.handleRuntimeThemeSave },
  { method: "POST", pathname: "/api/themes/generate", handler: themeHandlers.handleThemeGenerate },
  { method: "POST", pathname: "/api/themes/candidates", handler: themeHandlers.handleThemeCandidates },
  ...createLayoutApiRoutes({
    handleCustomLayoutDraft: operationHandlers.handleCustomLayoutDraft,
    handleCustomLayoutPreview: operationHandlers.handleCustomLayoutPreview,
    handleFavoriteLayoutDelete: layoutHandlers.handleFavoriteLayoutDelete,
    handleFavoriteLayoutSave: layoutHandlers.handleFavoriteLayoutSave,
    handleLayoutApply: layoutHandlers.handleLayoutApply,
    handleLayoutCandidateSave: layoutHandlers.handleLayoutCandidateSave,
    handleLayoutExport: layoutHandlers.handleLayoutExport,
    handleLayoutImport: layoutHandlers.handleLayoutImport,
    handleLayoutSave: layoutHandlers.handleLayoutSave,
    handleLayoutsIndex: (_req, res) => layoutHandlers.handleLayoutsIndex(res)
  }),
  ...createDeckSlideApiRoutes({
    handleDeckContextUpdate: deckSlideHandlers.handleDeckContextUpdate,
    handleDeckLengthApply: deckSlideHandlers.handleDeckLengthApply,
    handleDeckLengthPlan: deckSlideHandlers.handleDeckLengthPlan,
    handleDeckStructureApply: deckSlideHandlers.handleDeckStructureApply,
    handleManualSlideDelete: deckSlideHandlers.handleManualSlideDelete,
    handleManualSlidesReorder: deckSlideHandlers.handleManualSlidesReorder,
    handleManualSystemSlideCreate: deckSlideHandlers.handleManualSystemSlideCreate,
    handleSkippedSlideRestore: deckSlideHandlers.handleSkippedSlideRestore
  }),
  { method: "GET", pathname: "/api/preview/deck", handler: (_req, res) => createJsonResponse(res, 200, getPreviewManifest()) },
  { method: "GET", pathname: "/api/dom-preview/deck", handler: (_req, res) => createJsonResponse(res, 200, getStudioDomPreviewState()) },
  ...createMaterialSourceApiRoutes({
    handleMaterialUpload: materialSourceHandlers.handleMaterialUpload,
    handleMaterialsIndex: (_req, res) => materialSourceHandlers.handleMaterialsIndex(res),
    handleSourceCreate: materialSourceHandlers.handleSourceCreate,
    handleSourceDelete: materialSourceHandlers.handleSourceDelete,
    handleSourcesIndex: (_req, res) => materialSourceHandlers.handleSourcesIndex(res)
  }),
  ...createCustomVisualApiRoutes({
    handleCustomVisualCreate: customVisualHandlers.handleCustomVisualCreate,
    handleCustomVisualsIndex: (_req, res) => customVisualHandlers.handleCustomVisualsIndex(res)
  }),
  { method: "POST", pathname: "/api/variants/capture", handler: operationHandlers.handleVariantCapture },
  { method: "POST", pathname: "/api/variants/apply", handler: operationHandlers.handleVariantApply },
  { method: "POST", pathname: "/api/operations/ideate-slide", handler: operationHandlers.handleIdeateSlide },
  { method: "POST", pathname: "/api/operations/drill-wording", handler: operationHandlers.handleDrillWording },
  { method: "POST", pathname: "/api/operations/ideate-theme", handler: operationHandlers.handleIdeateTheme },
  { method: "POST", pathname: "/api/operations/ideate-deck-structure", handler: operationHandlers.handleIdeateDeckStructure },
  { method: "POST", pathname: "/api/operations/ideate-structure", handler: operationHandlers.handleIdeateStructure },
  { method: "POST", pathname: "/api/operations/redo-layout", handler: operationHandlers.handleRedoLayout },
  { method: "GET", pathname: "/api/assistant/session", handler: assistantHandlers.handleAssistantSession },
  { method: "POST", pathname: "/api/assistant/message", handler: assistantHandlers.handleAssistantSend }
];

const hypermediaApiRoutes: readonly ApiPatternRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/checks$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createCheckReportResource(match[1] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/exports$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createExportCollectionResource(match[1] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createSlideCollectionResource(match[1] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/workflows$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createSlideWorkflowResource(match[1] || "", match[2] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/candidates\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createCandidateResource(match[1] || "", match[2] || "", match[3] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/candidates$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createCandidateCollectionResource(match[1] || "", match[2] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createSlideResource(match[1] || "", match[2] || ""))
  },
  {
    method: "GET",
    pattern: /^\/api\/v1\/presentations\/([a-z0-9-]+)$/,
    handler: (_req, res, _url, match) => createJsonResponse(res, 200, createPresentationResource(match[1] || ""))
  }
];

const slideApiRoutes: readonly ApiPatternRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/preview\/slide\/(\d+)$/,
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
    pattern: /^\/api\/slides\/([a-z0-9-]+)$/,
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
    pattern: /^\/api\/slides\/([a-z0-9-]+)\/source$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideSourceUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/slides\/([a-z0-9-]+)\/slide-spec$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideSpecUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/slides\/([a-z0-9-]+)\/material$/,
    handler: (req, res, _url, match) => materialSourceHandlers.handleSlideMaterialUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/slides\/([a-z0-9-]+)\/custom-visual$/,
    handler: (req, res, _url, match) => customVisualHandlers.handleSlideCustomVisualUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/slides\/([a-z0-9-]+)\/validate-current$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideCurrentValidation(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/slides\/([a-z0-9-]+)\/context$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideContextUpdate(req, res, match[1] || "")
  }
];

async function handleApi(req: ServerRequest, res: ServerResponse, url: URL): Promise<void> {
  if (req.method === "GET" && url.pathname === "/api/v1") {
    createJsonResponse(res, 200, createApiRootResource());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/schemas") {
    createJsonResponse(res, 200, createSchemaResource());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/jobs/current") {
    createJsonResponse(res, 200, createCurrentJobResource(serializeRuntimeState()));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/presentations") {
    createJsonResponse(res, 200, createPresentationCollectionResource());
    return;
  }

  if (await dispatchPatternApiRoute(req, res, url, hypermediaApiRoutes)) {
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    createJsonResponse(res, 200, getWorkspaceState());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runtime") {
    createJsonResponse(res, 200, {
      runtime: serializeRuntimeState()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runtime/stream") {
    registerRuntimeStream(req, res, getPresentationCreationDraft());
    return;
  }

  if (await dispatchExactApiRoute(req, res, url, exactApiRoutes)) {
    return;
  }

  if (await dispatchPatternApiRoute(req, res, url, slideApiRoutes)) {
    return;
  }

  notFound(res);
}

function handleStatic(req: ServerRequest, res: ServerResponse, url: URL): void {
  if (req.method === "GET" && url.pathname === "/deck-preview") {
    createTextResponse(res, 200, renderDomPreviewDocument(), "text/html; charset=utf-8");
    return;
  }

  if (req.method === "GET" && url.pathname === "/present") {
    createTextResponse(res, 200, renderPresentationPreviewDocument(), "text/html; charset=utf-8");
    return;
  }

  const presentationPreviewMatch = url.pathname.match(/^\/present\/([a-z0-9-]+)$/);
  if (req.method === "GET" && presentationPreviewMatch) {
    const presentationId = presentationPreviewMatch[1];
    if (!presentationId) {
      notFound(res);
      return;
    }
    createTextResponse(res, 200, renderPresentationPreviewDocument({
      presentationId
    }), "text/html; charset=utf-8");
    return;
  }

  const materialMatch = url.pathname.match(/^\/presentation-materials\/([a-z0-9-]+)\/([^/]+)$/);
  if (materialMatch) {
    const presentationId = materialMatch[1];
    const fileName = materialMatch[2];
    if (!presentationId || !fileName) {
      notFound(res);
      return;
    }
    sendFile(res, getMaterialFilePath(decodeURIComponent(presentationId), decodeURIComponent(fileName)));
    return;
  }

  if (url.pathname.startsWith("/studio-output/")) {
    const assetPath = path.join(outputDir, url.pathname.replace("/studio-output/", ""));
    sendFile(res, assetPath);
    return;
  }

  const fileName = url.pathname === "/"
    ? path.join(clientDistDir, "index.html")
    : path.join(clientDistDir, url.pathname.replace(/^\/+/, ""));

  if (fs.existsSync(fileName) && fs.statSync(fileName).isFile()) {
    sendFile(res, fileName);
    return;
  }

  sendFile(res, path.join(clientDistDir, "index.html"));
}

async function requestHandler(req: ServerRequest, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    handleStatic(req, res, url);
  } catch (error) {
    if (runtimeState.workflow && runtimeState.workflow.status === "running") {
      updateWorkflowState({
        message: errorMessage(error),
        ok: false,
        stage: "failed",
        status: "failed"
      });
    }
    runtimeState.lastError = {
      message: errorMessage(error),
      updatedAt: new Date().toISOString()
    };
    publishRuntimeState();
    createJsonResponse(res, errorStatusCode(error), {
      code: errorCode(error),
      error: errorMessage(error)
    });
  }
}

function startServer(options: ServerStartOptions = {}) {
  const host = options.host || defaultHost;
  const port = Number(options.port ?? defaultPort);

  ensureState();
  clearPresentationCreationDraft();

  const server = http.createServer(requestHandler);
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = address && typeof address === "object" ? address.port : port;
    process.stdout.write(`Presentation studio available at http://${host}:${actualPort}\n`);
  });

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}

export {
  startServer
};
