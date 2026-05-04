import type { URL } from "url";
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
import { getPresentationCreationDraft } from "./services/presentations.ts";
import { getDeckContext } from "./services/state.ts";
import { getSlide, getSlides, readSlideSource } from "./services/slides.ts";
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
import { createPreviewApiRoutes } from "./preview-routes.ts";
import { dispatchExactApiRoute, dispatchPatternApiRoute, type ApiPatternRoute, type ApiRoute } from "./routes.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createThemeApiRoutes } from "./theme-routes.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOperationApiRoutes } from "./operation-routes.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";
import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createAssistantApiRoutes } from "./assistant-routes.ts";
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
import {
  deckPlanSlides,
  isDeckPlanPayload,
  isJsonObject,
  isOutlinePlanPayload,
  isSlideSpecPayload,
  isVisualThemePayload,
  jsonObjectOrEmpty,
  normalizeCreationFields,
  type JsonObject
} from "./api-payloads.ts";
import { buildCompactPresentationSourceText } from "./presentation-source-summary.ts";
import {
  errorCode,
  errorMessage
} from "./server-errors.ts";
import {
  describeStructuredSlide,
  serializeSlideSpec
} from "./slide-response-helpers.ts";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;

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

const versionedApiRoutes: readonly ApiRoute[] = [
  {
    method: "GET",
    pathname: "/api/v1",
    handler: (_req, res) => createJsonResponse(res, 200, createApiRootResource())
  },
  {
    method: "GET",
    pathname: "/api/v1/schemas",
    handler: (_req, res) => createJsonResponse(res, 200, createSchemaResource())
  },
  {
    method: "GET",
    pathname: "/api/v1/jobs/current",
    handler: (_req, res) => createJsonResponse(res, 200, createCurrentJobResource(serializeRuntimeState()))
  },
  {
    method: "GET",
    pathname: "/api/v1/presentations",
    handler: (_req, res) => createJsonResponse(res, 200, createPresentationCollectionResource())
  }
];

const browserApiRoutes: readonly ApiRoute[] = [
  {
    method: "GET",
    pathname: "/api/v1/state",
    handler: (_req, res) => createJsonResponse(res, 200, getWorkspaceState())
  },
  {
    method: "GET",
    pathname: "/api/v1/runtime",
    handler: (_req, res) => createJsonResponse(res, 200, {
      runtime: serializeRuntimeState()
    })
  },
  {
    method: "GET",
    pathname: "/api/v1/runtime/stream",
    handler: (req, res) => registerRuntimeStream(req, res, getPresentationCreationDraft())
  }
];

const workflowApiRoutes: readonly ApiRoute[] = [
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
  ...createThemeApiRoutes({
    handleRuntimeThemeSave: themeHandlers.handleRuntimeThemeSave,
    handleThemeCandidates: themeHandlers.handleThemeCandidates,
    handleThemeGenerate: themeHandlers.handleThemeGenerate
  }),
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
  ...createPreviewApiRoutes({
    handleDeckDomPreview: (_req, res) => createJsonResponse(res, 200, getStudioDomPreviewState()),
    handleDeckPreview: (_req, res) => createJsonResponse(res, 200, getPreviewManifest())
  }),
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
  ...createOperationApiRoutes({
    handleDrillWording: operationHandlers.handleDrillWording,
    handleIdeateDeckStructure: operationHandlers.handleIdeateDeckStructure,
    handleIdeateSlide: operationHandlers.handleIdeateSlide,
    handleIdeateStructure: operationHandlers.handleIdeateStructure,
    handleIdeateTheme: operationHandlers.handleIdeateTheme,
    handleRedoLayout: operationHandlers.handleRedoLayout,
    handleVariantApply: operationHandlers.handleVariantApply,
    handleVariantCapture: operationHandlers.handleVariantCapture
  }),
  ...createAssistantApiRoutes({
    handleAssistantSend: assistantHandlers.handleAssistantSend,
    handleAssistantSession: assistantHandlers.handleAssistantSession
  })
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
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideSourceUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/slide-spec$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideSpecUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/material$/,
    handler: (req, res, _url, match) => materialSourceHandlers.handleSlideMaterialUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/custom-visual$/,
    handler: (req, res, _url, match) => customVisualHandlers.handleSlideCustomVisualUpdate(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/validate-current$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideCurrentValidation(req, res, match[1] || "")
  },
  {
    method: "POST",
    pattern: /^\/api\/v1\/slides\/([a-z0-9-]+)\/context$/,
    handler: (req, res, _url, match) => slideEditHandlers.handleSlideContextUpdate(req, res, match[1] || "")
  }
];

export async function handleApi(req: ServerRequest, res: ServerResponse, url: URL): Promise<void> {
  if (await dispatchExactApiRoute(req, res, url, versionedApiRoutes)) {
    return;
  }

  if (await dispatchPatternApiRoute(req, res, url, hypermediaApiRoutes)) {
    return;
  }

  if (!url.pathname.startsWith("/api/v1/")) {
    notFound(res);
    return;
  }

  if (await dispatchExactApiRoute(req, res, url, browserApiRoutes)) {
    return;
  }

  if (await dispatchExactApiRoute(req, res, url, workflowApiRoutes)) {
    return;
  }

  if (await dispatchPatternApiRoute(req, res, url, slideApiRoutes)) {
    return;
  }

  notFound(res);
}
