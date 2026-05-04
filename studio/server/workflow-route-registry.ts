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
import { type ApiRoute } from "./routes.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createThemeApiRoutes } from "./theme-routes.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOperationApiRoutes } from "./operation-routes.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createAssistantHandlers } from "./assistant-handlers.ts";
import { createAssistantApiRoutes } from "./assistant-routes.ts";
import { getPreviewManifest } from "./services/build.ts";
import { getStudioDomPreviewState } from "./workspace-state.ts";
import { createJsonResponse } from "./http-responses.ts";

type WorkflowRouteRegistryHandlers = {
  assistantHandlers: ReturnType<typeof createAssistantHandlers>;
  buildValidationHandlers: ReturnType<typeof createBuildValidationHandlers>;
  creationContentRunHandlers: ReturnType<typeof createCreationContentRunHandlers>;
  creationDraftHandlers: ReturnType<typeof createCreationDraftHandlers>;
  customVisualHandlers: ReturnType<typeof createCustomVisualHandlers>;
  deckSlideHandlers: ReturnType<typeof createDeckSlideHandlers>;
  layoutHandlers: ReturnType<typeof createLayoutHandlers>;
  llmHandlers: ReturnType<typeof createLlmHandlers>;
  materialSourceHandlers: ReturnType<typeof createMaterialSourceHandlers>;
  operationHandlers: ReturnType<typeof createOperationHandlers>;
  outlinePlanHandlers: ReturnType<typeof createOutlinePlanHandlers>;
  presentationHandlers: ReturnType<typeof createPresentationHandlers>;
  themeHandlers: ReturnType<typeof createThemeHandlers>;
};

function createWorkflowRouteRegistry({
  assistantHandlers,
  buildValidationHandlers,
  creationContentRunHandlers,
  creationDraftHandlers,
  customVisualHandlers,
  deckSlideHandlers,
  layoutHandlers,
  llmHandlers,
  materialSourceHandlers,
  operationHandlers,
  outlinePlanHandlers,
  presentationHandlers,
  themeHandlers
}: WorkflowRouteRegistryHandlers): readonly ApiRoute[] {
  return [
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
}

export { createWorkflowRouteRegistry };
