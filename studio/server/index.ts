import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { URL } from "url";
import { fileURLToPath } from "url";
import { loadEnvFiles } from "./services/env.ts";

loadEnvFiles();

import { getPreviewManifest } from "./services/build.ts";
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
import {
  createJsonResponse,
  notFound,
  readJsonBody
} from "./http-responses.ts";
import { handleStatic } from "./static-routes.ts";
import {
  deckPlanSlides,
  isDeckPlanPayload,
  isJsonObject,
  isOutlinePlanPayload,
  isSlideSpecPayload,
  isSourcePayload,
  isVisualThemePayload,
  jsonObjectOrEmpty,
  normalizeCreationFields,
  type JsonObject,
  type SourcePayload
} from "./api-payloads.ts";

const defaultPort = Number(process.env.PORT || 4173);
const defaultHost = process.env.HOST || "127.0.0.1";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;
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

function serializeSlideSpec(slideSpec: unknown): string {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
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
