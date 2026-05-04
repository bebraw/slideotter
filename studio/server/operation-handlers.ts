import * as http from "http";

import { getAssistantSession, getAssistantSuggestions } from "./services/assistant.ts";
import { buildAndRenderDeck } from "./services/build.ts";
import { getDomPreviewState } from "./services/dom-preview.ts";
import { assertBaseVersion, getSlideVersion } from "./services/hypermedia.ts";
import { createCustomLayoutDraftDefinition } from "./services/layout-drafts.ts";
import {
  authorCustomLayoutSlide,
  drillWordingSlide,
  ideateDeckStructure,
  ideateSlide,
  ideateStructureSlide,
  ideateThemeSlide,
  redoLayoutSlide
} from "./services/operations.ts";
import { listPresentations } from "./services/presentations.ts";
import {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent,
  normalizeSelectionScope
} from "./services/selection-scope.ts";
import { getDeckContext, updateDeckFields } from "./services/state.ts";
import { readSlideSource, readSlideSpec } from "./services/slides.ts";
import {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listAllVariants,
  listVariantsForSlide
} from "./services/variants.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type VariantCapturePayload = {
  changeSummary: unknown[];
  label?: string;
  notes?: string;
  slideId: string;
  slideSpec: JsonObject | null;
  source?: string;
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

type OperationHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  describeStructuredSlide: (slideId: string) => JsonObject;
  isVisualThemePayload: (value: unknown) => value is JsonObject;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeRuntimeState: () => JsonObject;
  serializeSlideSpec: (slideSpec: unknown) => string;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function activePresentationIdFromBody(body: JsonObject): string {
  const presentations = listPresentations() as JsonObject & { activePresentationId?: unknown };
  const bodyPresentationId = typeof body.presentationId === "string" ? body.presentationId : "";
  return bodyPresentationId || String(presentations.activePresentationId || "");
}

export function createOperationHandlers(deps: OperationHandlerDependencies) {
  const {
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
  } = deps;

  function completeVariantPreview(operation: string, slideId: string, result: JsonObject): void {
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    updateWorkflowState({
      dryRun: true,
      generation: result.generation,
      message: typeof result.summary === "string" ? result.summary : "Previewed custom layout.",
      ok: true,
      operation,
      slideId,
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();
  }

  function sendVariantPreview(res: ServerResponse, result: JsonObject): void {
    createJsonResponse(res, 200, {
      assistant: {
        session: getAssistantSession(),
        suggestions: getAssistantSuggestions()
      },
      generation: result.generation,
      previews: result.previews,
      runtime: serializeRuntimeState(),
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: listAllVariants()
    });
  }

  async function handleVariantCapture(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when capturing a variant");
    }

    let source = typeof body.source === "string" ? body.source : undefined;
    let slideSpec: JsonObject | null = jsonObjectOrEmpty(body.slideSpec);
    if (!Object.keys(slideSpec).length) {
      slideSpec = null;
    }

    if (slideSpec && typeof slideSpec === "object" && !Array.isArray(slideSpec)) {
      source = serializeSlideSpec(slideSpec);
    }

    const variantPayload: VariantCapturePayload = {
      changeSummary: Array.isArray(body.changeSummary) ? body.changeSummary : [],
      slideId: body.slideId,
      slideSpec
    };
    if (typeof body.label === "string") {
      variantPayload.label = body.label;
    }
    if (typeof body.notes === "string") {
      variantPayload.notes = body.notes;
    }
    if (source !== undefined) {
      variantPayload.source = source;
    }
    const variant = captureVariant(variantPayload);
    publishRuntimeState();
    createJsonResponse(res, 200, {
      variant,
      variantStorage: getVariantStorageStatus(),
      variants: listVariantsForSlide(body.slideId)
    });
  }

  async function handleVariantApply(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.variantId !== "string" || !body.variantId) {
      throw new Error("Expected variantId when applying a variant");
    }

    const storedVariant = listAllVariants().find((entry: JsonObject) => entry.id === body.variantId);
    if (!storedVariant) {
      throw new Error(`Unknown variant: ${body.variantId}`);
    }

    const activePresentationId = activePresentationIdFromBody({});
    assertBaseVersion(getSlideVersion(activePresentationId, storedVariant.slideId), body.baseVersion, "Slide");
    const operationScope = jsonObjectOrEmpty(storedVariant.operationScope);
    if (Object.keys(operationScope).length) {
      const currentSlideSpec = readSlideSpec(String(storedVariant.slideId || ""));
      const selectionScope = normalizeSelectionScope(operationScope, {
        slideId: storedVariant.slideId,
        slideSpec: currentSlideSpec
      });
      if (selectionScope) {
        assertSelectionAnchorsCurrent(currentSlideSpec, selectionScope);
        if (!operationScope.allowFamilyChange) {
          assertPatchWithinSelectionScope(currentSlideSpec, storedVariant.slideSpec, selectionScope);
        }
      }
    }

    const variant = applyVariant(body.variantId);
    const context = isVisualThemePayload(variant.visualTheme)
      ? updateDeckFields({ visualTheme: variant.visualTheme })
      : getDeckContext();
    const previews = (await buildAndRenderDeck()).previews;
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    runtimeState.lastError = null;
    publishRuntimeState();

    const structured = describeStructuredSlide(variant.slideId);
    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      previews,
      slideSpec: structured.slideSpec,
      source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(variant.slideId),
      slideId: variant.slideId,
      variantStorage: getVariantStorageStatus(),
      variant
    });
  }

  async function handleIdeateSlide(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when ideating a slide");
    }

    const result = await ideateSlide(body.slideId, {
      candidateCount: body.candidateCount,
      dryRun: true,
      onProgress: createWorkflowProgressReporter({
        dryRun: true,
        operation: "ideate-slide",
        slideId: body.slideId
      })
    });
    completeVariantPreview("ideate-slide", body.slideId, result);
    sendVariantPreview(res, result);
  }

  async function handleDrillWording(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when drilling wording");
    }

    const result = await drillWordingSlide(body.slideId, {
      candidateCount: body.candidateCount,
      dryRun: true,
      onProgress: createWorkflowProgressReporter({
        dryRun: true,
        operation: "drill-wording",
        slideId: body.slideId
      })
    });
    completeVariantPreview("drill-wording", body.slideId, result);
    sendVariantPreview(res, result);
  }

  async function handleIdeateTheme(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when ideating a theme");
    }

    const result = await ideateThemeSlide(body.slideId, {
      candidateCount: body.candidateCount,
      dryRun: true,
      onProgress: createWorkflowProgressReporter({
        dryRun: true,
        operation: "ideate-theme",
        slideId: body.slideId
      })
    });
    completeVariantPreview("ideate-theme", body.slideId, result);
    sendVariantPreview(res, result);
  }

  async function handleIdeateDeckStructure(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const result = await ideateDeckStructure({
      candidateCount: body.candidateCount,
      dryRun: body.dryRun !== false,
      onProgress: createWorkflowProgressReporter({
        dryRun: true,
        operation: "ideate-deck-structure"
      })
    });
    updateWorkflowState({
      dryRun: true,
      generation: result.generation,
      message: typeof result.summary === "string" ? result.summary : "Previewed custom layout.",
      ok: true,
      operation: "ideate-deck-structure",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      deckStructureCandidates: result.candidates,
      runtime: serializeRuntimeState(),
      summary: result.summary
    });
  }

  async function handleIdeateStructure(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when ideating structure");
    }

    const result = await ideateStructureSlide(body.slideId, {
      candidateCount: body.candidateCount,
      dryRun: true,
      onProgress: createWorkflowProgressReporter({
        dryRun: true,
        operation: "ideate-structure",
        slideId: body.slideId
      })
    });
    completeVariantPreview("ideate-structure", body.slideId, result);
    sendVariantPreview(res, result);
  }

  async function handleRedoLayout(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when redoing layout");
    }

    const result = await redoLayoutSlide(body.slideId, {
      candidateCount: body.candidateCount,
      dryRun: true,
      onProgress: createWorkflowProgressReporter({
        dryRun: body.dryRun !== false,
        operation: "redo-layout",
        slideId: body.slideId
      })
    });
    completeVariantPreview("redo-layout", body.slideId, result);
    sendVariantPreview(res, result);
  }

  async function handleCustomLayoutPreview(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected slideId when previewing a custom layout");
    }

    const reportProgress = createWorkflowProgressReporter({
      dryRun: true,
      operation: "custom-layout",
      slideId: body.slideId
    });
    reportProgress({
      message: "Validating custom layout definition...",
      stage: "validating-definition"
    });
    const result = await authorCustomLayoutSlide(body.slideId, {
      label: body.label,
      layoutDefinition: body.layoutDefinition,
      layoutTreatment: body.layoutTreatment,
      multiSlidePreview: body.multiSlidePreview === true,
      notes: body.notes
    });
    completeVariantPreview("custom-layout", body.slideId, result);

    createJsonResponse(res, 200, {
      assistant: {
        session: getAssistantSession(),
        suggestions: getAssistantSuggestions()
      },
      generation: result.generation,
      layoutValidation: result.layoutValidation,
      previews: result.previews,
      runtime: serializeRuntimeState(),
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: listAllVariants()
    });
  }

  async function handleCustomLayoutDraft(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const layoutDefinition = createCustomLayoutDraftDefinition({
      minFontSize: body.minFontSize,
      profile: body.profile,
      slideType: body.slideType,
      spacing: body.spacing
    });

    createJsonResponse(res, 200, {
      layoutDefinition
    });
  }

  return {
    handleCustomLayoutDraft,
    handleCustomLayoutPreview,
    handleDrillWording,
    handleIdeateDeckStructure,
    handleIdeateSlide,
    handleIdeateStructure,
    handleIdeateTheme,
    handleRedoLayout,
    handleVariantApply,
    handleVariantCapture
  };
}
