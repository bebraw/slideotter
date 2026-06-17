import * as http from "http";

import { getAssistantSession, getAssistantSuggestions } from "./services/assistant.ts";
import { buildAndRenderDeck } from "./services/build.ts";
import { getDomPreviewState } from "./services/dom-preview-state.ts";
import { assertBaseVersion, getPresentationVersion, getSlideVersion } from "./services/hypermedia.ts";
import { createCustomLayoutDraftDefinition } from "./services/layout-drafts.ts";
import {
  authorCustomLayoutSlide,
  drillWordingSlide,
  ideateDeckStructure,
  ideateSlide,
  ideateStructureSlide,
  ideateThemeSlide,
  refineDeckNarration,
  refineSlideNarration,
  redoLayoutSlide
} from "./services/operations.ts";
import { listPresentations } from "./services/presentations.ts";
import {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent
} from "./services/selection-assertions.ts";
import { normalizeSelectionScope } from "./services/selection-normalization.ts";
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

function completeVariantPreview(
  deps: OperationHandlerDependencies,
  operation: string,
  slideId: string,
  result: JsonObject
): void {
  deps.runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  deps.updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: typeof result.summary === "string" ? result.summary : "Previewed custom layout.",
    ok: true,
    operation,
    slideId,
    stage: "completed",
    status: "completed"
  });
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();
}

function sendVariantPreview(deps: OperationHandlerDependencies, res: ServerResponse, result: JsonObject): void {
  deps.createJsonResponse(res, 200, {
    assistant: {
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    generation: result.generation,
    previews: result.previews,
    runtime: deps.serializeRuntimeState(),
    slideId: result.slideId,
    summary: result.summary,
    transientVariants: result.variants,
    variants: listAllVariants()
  });
}

function completeDirectOperation(deps: OperationHandlerDependencies, operation: string, result: JsonObject): void {
  deps.runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  deps.updateWorkflowState({
    dryRun: false,
    generation: result.generation,
    message: typeof result.summary === "string" ? result.summary : "Operation completed.",
    ok: true,
    operation,
    slideId: result.slideId,
    stage: "completed",
    status: "completed"
  });
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();
}

async function handleVariantCaptureRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when capturing a variant");
  }

  let source = typeof body.source === "string" ? body.source : undefined;
  let slideSpec: JsonObject | null = deps.jsonObjectOrEmpty(body.slideSpec);
  if (!Object.keys(slideSpec).length) {
    slideSpec = null;
  }

  if (slideSpec && typeof slideSpec === "object" && !Array.isArray(slideSpec)) {
    source = deps.serializeSlideSpec(slideSpec);
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
  deps.publishRuntimeState();
  deps.createJsonResponse(res, 200, {
    variant,
    variantStorage: getVariantStorageStatus(),
    variants: listVariantsForSlide(body.slideId)
  });
}

async function handleVariantApplyRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.variantId !== "string" || !body.variantId) {
    throw new Error("Expected variantId when applying a variant");
  }

  const storedVariant = listAllVariants().find((entry: JsonObject) => entry.id === body.variantId);
  if (!storedVariant) {
    throw new Error(`Unknown variant: ${body.variantId}`);
  }

  const activePresentationId = activePresentationIdFromBody({});
  assertBaseVersion(getSlideVersion(activePresentationId, storedVariant.slideId), body.baseVersion, "Slide");
  const operationScope = deps.jsonObjectOrEmpty(storedVariant.operationScope);
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
  const context = deps.isVisualThemePayload(variant.visualTheme)
    ? updateDeckFields({ visualTheme: variant.visualTheme })
    : getDeckContext();
  const previews = (await buildAndRenderDeck()).previews;
  deps.runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();

  const structured = deps.describeStructuredSlide(variant.slideId);
  deps.createJsonResponse(res, 200, {
    context,
    domPreview: getDomPreviewState({ includeDetours: true }),
    previews,
    slideSpec: structured.slideSpec,
    source: structured.slideSpec ? deps.serializeSlideSpec(structured.slideSpec) : readSlideSource(variant.slideId),
    slideId: variant.slideId,
    variantStorage: getVariantStorageStatus(),
    variant
  });
}

async function handleIdeateSlideRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when ideating a slide");
  }

  const result = await ideateSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: true,
      operation: "ideate-slide",
      slideId: body.slideId
    })
  });
  completeVariantPreview(deps, "ideate-slide", body.slideId, result);
  sendVariantPreview(deps, res, result);
}

async function handleDrillWordingRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when drilling wording");
  }

  const result = await drillWordingSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: true,
      operation: "drill-wording",
      slideId: body.slideId
    })
  });
  completeVariantPreview(deps, "drill-wording", body.slideId, result);
  sendVariantPreview(deps, res, result);
}

async function handleIdeateThemeRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when ideating a theme");
  }

  const result = await ideateThemeSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: true,
      operation: "ideate-theme",
      slideId: body.slideId
    })
  });
  completeVariantPreview(deps, "ideate-theme", body.slideId, result);
  sendVariantPreview(deps, res, result);
}

async function handleIdeateDeckStructureRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const result = await ideateDeckStructure({
    candidateCount: body.candidateCount,
    dryRun: body.dryRun !== false,
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: true,
      operation: "ideate-deck-structure"
    })
  });
  deps.updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: typeof result.summary === "string" ? result.summary : "Previewed custom layout.",
    ok: true,
    operation: "ideate-deck-structure",
    stage: "completed",
    status: "completed"
  });
  deps.runtimeState.lastError = null;
  deps.publishRuntimeState();

  deps.createJsonResponse(res, 200, {
    deckStructureCandidates: result.candidates,
    runtime: deps.serializeRuntimeState(),
    summary: result.summary
  });
}

async function handleIdeateStructureRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when ideating structure");
  }

  const result = await ideateStructureSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: true,
      operation: "ideate-structure",
      slideId: body.slideId
    })
  });
  completeVariantPreview(deps, "ideate-structure", body.slideId, result);
  sendVariantPreview(deps, res, result);
}

async function handleRedoLayoutRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when redoing layout");
  }

  const result = await redoLayoutSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: body.dryRun !== false,
      operation: "redo-layout",
      slideId: body.slideId
    })
  });
  completeVariantPreview(deps, "redo-layout", body.slideId, result);
  sendVariantPreview(deps, res, result);
}

async function handleRefineNarrationRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when refining narration");
  }

  const activePresentationId = activePresentationIdFromBody(body);
  assertBaseVersion(getSlideVersion(activePresentationId, body.slideId), body.baseVersion, "Slide");
  const result = await refineSlideNarration(body.slideId, {
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: false,
      operation: "refine-narration",
      slideId: body.slideId
    })
  });
  completeDirectOperation(deps, "refine-narration", result);
  const structured = deps.describeStructuredSlide(body.slideId);

  deps.createJsonResponse(res, 200, {
    assistant: {
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    domPreview: getDomPreviewState({ includeDetours: true }),
    generation: result.generation,
    narration: result.narration,
    previews: result.previews,
    rationale: result.rationale,
    runtime: deps.serializeRuntimeState(),
    slideId: body.slideId,
    slideSpec: structured.slideSpec,
    source: structured.slideSpec ? deps.serializeSlideSpec(structured.slideSpec) : readSlideSource(body.slideId),
    summary: result.summary,
    variants: listAllVariants()
  });
}

async function handleRefineDeckNarrationRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const activePresentationId = activePresentationIdFromBody(body);
  assertBaseVersion(getPresentationVersion(activePresentationId), body.baseVersion, "Presentation");
  const result = await refineDeckNarration({
    onProgress: deps.createWorkflowProgressReporter({
      dryRun: false,
      operation: "refine-deck-narration"
    })
  });
  completeDirectOperation(deps, "refine-deck-narration", result);

  deps.createJsonResponse(res, 200, {
    assistant: {
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    domPreview: getDomPreviewState({ includeDetours: true }),
    failures: result.failures,
    generation: result.generation,
    previews: result.previews,
    results: result.results,
    runtime: deps.serializeRuntimeState(),
    summary: result.summary,
    variants: listAllVariants()
  });
}

async function handleCustomLayoutPreviewRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when previewing a custom layout");
  }

  const reportProgress = deps.createWorkflowProgressReporter({
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
  completeVariantPreview(deps, "custom-layout", body.slideId, result);

  deps.createJsonResponse(res, 200, {
    assistant: {
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    generation: result.generation,
    layoutValidation: result.layoutValidation,
    previews: result.previews,
    runtime: deps.serializeRuntimeState(),
    slideId: result.slideId,
    summary: result.summary,
    transientVariants: result.variants,
    variants: listAllVariants()
  });
}

async function handleCustomLayoutDraftRequest(
  deps: OperationHandlerDependencies,
  req: ServerRequest,
  res: ServerResponse
): Promise<void> {
  const body = await deps.readJsonBody(req);
  const layoutDefinition = createCustomLayoutDraftDefinition({
    minFontSize: body.minFontSize,
    profile: body.profile,
    slideType: body.slideType,
    spacing: body.spacing
  });

  deps.createJsonResponse(res, 200, {
    layoutDefinition
  });
}

export function createOperationHandlers(deps: OperationHandlerDependencies) {
  return {
    handleCustomLayoutDraft: (req: ServerRequest, res: ServerResponse) =>
      handleCustomLayoutDraftRequest(deps, req, res),
    handleCustomLayoutPreview: (req: ServerRequest, res: ServerResponse) =>
      handleCustomLayoutPreviewRequest(deps, req, res),
    handleDrillWording: (req: ServerRequest, res: ServerResponse) => handleDrillWordingRequest(deps, req, res),
    handleIdeateDeckStructure: (req: ServerRequest, res: ServerResponse) =>
      handleIdeateDeckStructureRequest(deps, req, res),
    handleIdeateSlide: (req: ServerRequest, res: ServerResponse) => handleIdeateSlideRequest(deps, req, res),
    handleIdeateStructure: (req: ServerRequest, res: ServerResponse) => handleIdeateStructureRequest(deps, req, res),
    handleIdeateTheme: (req: ServerRequest, res: ServerResponse) => handleIdeateThemeRequest(deps, req, res),
    handleRefineDeckNarration: (req: ServerRequest, res: ServerResponse) =>
      handleRefineDeckNarrationRequest(deps, req, res),
    handleRefineNarration: (req: ServerRequest, res: ServerResponse) => handleRefineNarrationRequest(deps, req, res),
    handleRedoLayout: (req: ServerRequest, res: ServerResponse) => handleRedoLayoutRequest(deps, req, res),
    handleVariantApply: (req: ServerRequest, res: ServerResponse) => handleVariantApplyRequest(deps, req, res),
    handleVariantCapture: (req: ServerRequest, res: ServerResponse) => handleVariantCaptureRequest(deps, req, res)
  };
}
