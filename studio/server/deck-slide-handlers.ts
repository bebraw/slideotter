import * as http from "http";

import { buildAndRenderDeck } from "./services/build.ts";
import { applyDeckLengthPlan, planDeckLengthSemantic, restoreSkippedSlides } from "./services/deck-length.ts";
import { getDomPreviewState } from "./services/dom-preview-state.ts";
import { assertBaseVersion, getPresentationVersion, getSlideVersion } from "./services/hypermedia.ts";
import { recordDerivedSlideset } from "./services/memory.ts";
import {
  createManualDividerSlideSpec,
  createManualPhotoGridSlideSpec,
  createManualPhotoSlideSpec,
  createManualQuoteSlideSpec,
  createManualSystemSlideSpec,
  renumberOutlineWithInsert,
  renumberOutlineWithoutIndex
} from "./services/manual-deck-edits.ts";
import {
  addCoreSlideToNavigation,
  addDetourSlideToNavigation,
  normalizeDeckNavigation,
  removeSlideFromNavigation
} from "./services/navigation.ts";
import { applyDeckStructureCandidate } from "./services/operations.ts";
import { listPresentations } from "./services/presentations.ts";
import { applyDeckStructurePlan, getDeckContext, updateDeckFields, updateSlideContext } from "./services/state.ts";
import { archiveStructuredSlide, getSlide, getSlides, insertStructuredSlide, reorderActiveSlides } from "./services/slides.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSummary = JsonObject & {
  archived?: unknown;
  id?: unknown;
  index?: unknown;
  skipped?: unknown;
  title?: unknown;
};

type NavigableSlide = JsonObject & {
  archived?: unknown;
  id: string;
  index: number;
  skipped?: boolean;
  title?: unknown;
};

type ManualDetourStack = {
  parentId: string;
  slideIds: string[];
};

type ManualDeckNavigation = {
  coreSlideIds: string[];
  detours: ManualDetourStack[];
};

type ManualSlideType = "content" | "divider" | "photo" | "photoGrid" | "quote";
type DeckContextState = ReturnType<typeof getDeckContext>;

type ManualSlidePlacement = {
  afterSlide: NavigableSlide | null;
  createAsDetour: boolean;
  currentContext: DeckContextState;
  parentSlide: NavigableSlide | null;
  targetIndex: number;
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

type DeckSlideHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function activePresentationIdFromBody(body: JsonObject): string {
  const presentations = listPresentations() as JsonObject & { activePresentationId?: unknown };
  const bodyPresentationId = typeof body.presentationId === "string" ? body.presentationId : "";
  return bodyPresentationId || String(presentations.activePresentationId || "");
}

function sentenceValue(value: unknown, fallback: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function isNavigableSlide(slide: SlideSummary): slide is NavigableSlide {
  return typeof slide.id === "string"
    && typeof slide.index === "number"
    && (slide.skipped == null || typeof slide.skipped === "boolean");
}

function requireNavigableSlides(slides: SlideSummary[]): NavigableSlide[] {
  const navigableSlides = slides.filter(isNavigableSlide);
  if (navigableSlides.length !== slides.length) {
    throw new Error("Expected saved slides to include string ids and numeric indices.");
  }
  return navigableSlides;
}

function resolveManualDetourParentSlideId(navigation: ManualDeckNavigation, selectedSlideId: string): string {
  if (navigation.coreSlideIds.includes(selectedSlideId)) {
    return selectedSlideId;
  }

  const parentDetour = navigation.detours.find((detour: ManualDetourStack) => detour.slideIds.includes(selectedSlideId));
  return parentDetour ? parentDetour.parentId : "";
}

function normalizeManualSlideType(value: unknown): ManualSlideType {
  return value === "divider" || value === "quote" || value === "photo" || value === "photoGrid" ? value : "content";
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

function countSharedDeckUpdates(deckPatch: JsonObject | null): number {
  if (!deckPatch) {
    return 0;
  }

  return Object.keys(deckPatch).reduce((count: number, key: string) => {
    const value = deckPatch[key];
    if (value == null) {
      return count;
    }

    return count + (isJsonObject(value) ? Object.keys(value).length : 1);
  }, 0);
}

function deckStructurePromotionOptions(body: JsonObject): {
  promoteInsertions: boolean;
  promoteIndices: boolean;
  promoteRemovals: boolean;
  promoteReplacements: boolean;
  promoteTitles: boolean;
} {
  return {
    promoteInsertions: body.promoteInsertions !== false,
    promoteIndices: body.promoteIndices !== false,
    promoteRemovals: body.promoteRemovals !== false,
    promoteReplacements: body.promoteReplacements !== false,
    promoteTitles: body.promoteTitles !== false
  };
}

function deckStructureMetric(result: JsonObject, key: string): number {
  const value = result[key];
  return typeof value === "number" ? value : 0;
}

function deckStructureWorkflowMessage(label: unknown, result: JsonObject, sharedDeckUpdates: number): string {
  const prefix = label
    ? `Applied deck plan candidate ${label} to the saved outline, slide plan`
    : "Applied deck plan candidate to the saved outline, slide plan";
  const sharedDeckSuffix = sharedDeckUpdates ? `, and ${plural(sharedDeckUpdates, "shared deck setting")}` : "";
  return `${prefix}, ${plural(deckStructureMetric(result, "insertedSlides"), "inserted slide")}, ${plural(deckStructureMetric(result, "replacedSlides"), "replaced slide")}, ${plural(deckStructureMetric(result, "removedSlides"), "archived slide")}, ${plural(deckStructureMetric(result, "indexUpdates"), "slide order change", "slide order changes")}, ${plural(deckStructureMetric(result, "titleUpdates"), "slide title")}${sharedDeckSuffix}.`;
}

function markRuntimeBuildSucceeded(runtimeState: RuntimeStateAccess): void {
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
}

function createManualSlideSpecForType(params: {
  body: JsonObject;
  slideType: ManualSlideType;
  summary: string;
  targetIndex: number;
  title: string;
}): JsonObject {
  const specByType: Record<ManualSlideType, () => JsonObject> = {
    content: () => createManualSystemSlideSpec({ summary: params.summary, targetIndex: params.targetIndex, title: params.title }),
    divider: () => createManualDividerSlideSpec({ targetIndex: params.targetIndex, title: params.title }),
    photo: () => createManualPhotoSlideSpec({ caption: params.summary, materialId: params.body.materialId, targetIndex: params.targetIndex, title: params.title }),
    photoGrid: () => createManualPhotoGridSlideSpec({ caption: params.summary, materialIds: params.body.materialIds, targetIndex: params.targetIndex, title: params.title }),
    quote: () => createManualQuoteSlideSpec({ quote: params.summary, targetIndex: params.targetIndex, title: params.title })
  };
  return specByType[params.slideType]();
}

function manualSlideContext(params: {
  createAsDetour: boolean;
  parentSlide: SlideSummary | null;
  slideType: ManualSlideType;
  summary: string;
  title: string;
}): JsonObject {
  const contextByType: Record<ManualSlideType, () => JsonObject> = {
    content: () => ({
      title: params.title,
      intent: params.summary,
      mustInclude: "Boundary, signal, owner, feedback loop, and validation check.",
      notes: "Manual system slide created from the Slide Studio panel.",
      layoutHint: "Use the content system-slide layout with concise labels."
    }),
    divider: () => ({
      title: params.title,
      intent: params.createAsDetour
        ? `Use ${params.title} as optional deeper material below ${params.parentSlide?.title || "the parent slide"}.`
        : `Use ${params.title} as a clean section boundary before the following slide cluster.`,
      mustInclude: "One short title that signals the next section clearly.",
      notes: params.createAsDetour ? "Manual detour divider created from the Slide Studio panel." : "Manual divider slide created from the Slide Studio panel.",
      layoutHint: "Keep the divider title-only and centered."
    }),
    photo: () => ({
      title: params.title,
      intent: `Use ${params.title} as a dominant visual evidence slide.`,
      mustInclude: "One attached material, readable alt text, and a compact caption or source line when useful.",
      notes: "Manual photo slide created from the Slide Studio panel.",
      layoutHint: "Keep the image dominant and the caption attached to the visual."
    }),
    photoGrid: () => ({
      title: params.title,
      intent: `Use ${params.title} as a grouped visual evidence slide.`,
      mustInclude: "Two to four attached materials, readable alt text, and compact captions or source lines when useful.",
      notes: "Manual photo grid slide created from the Slide Studio panel.",
      layoutHint: "Keep the image set balanced and captions attached to each visual."
    }),
    quote: () => ({
      title: params.title,
      intent: `Use ${params.title} as a focused quote or authored pull quote.`,
      mustInclude: "One short quote, optional attribution, optional source, and compact context.",
      notes: "Manual quote slide created from the Slide Studio panel.",
      layoutHint: "Keep the quote dominant with attribution and source attached below."
    })
  };
  return contextByType[params.slideType]();
}

function manualSlideWorkflow(slideType: ManualSlideType, title: string, createAsDetour: boolean): { message: string; operation: string } {
  if (createAsDetour) {
    return {
      message: `Added detour slide ${title}.`,
      operation: "add-detour-slide"
    };
  }
  const labels: Record<ManualSlideType, { messageKind: string; operation: string }> = {
    content: { messageKind: "system", operation: "add-system-slide" },
    divider: { messageKind: "divider", operation: "add-divider-slide" },
    photo: { messageKind: "photo", operation: "add-photo-slide" },
    photoGrid: { messageKind: "photo grid", operation: "add-photo-grid-slide" },
    quote: { messageKind: "quote", operation: "add-quote-slide" }
  };
  const label = labels[slideType];
  return {
    message: `Added manual ${label.messageKind} slide ${title}.`,
    operation: label.operation
  };
}

function resolveManualParentSlide(params: {
  activeSlides: NavigableSlide[];
  body: JsonObject;
  createAsDetour: boolean;
  currentNavigation: ManualDeckNavigation;
}): NavigableSlide | null {
  const selectedParentSlideId = typeof params.body.parentSlideId === "string" ? params.body.parentSlideId : "";
  const resolvedParentSlideId = params.createAsDetour
    ? resolveManualDetourParentSlideId(params.currentNavigation, selectedParentSlideId)
    : selectedParentSlideId;
  const parentSlide = params.activeSlides.find((slide: NavigableSlide) => slide.id === resolvedParentSlideId) || null;
  if (params.createAsDetour && (!parentSlide || !params.currentNavigation.coreSlideIds.includes(parentSlide.id))) {
    throw new Error("Choose a core slide or an existing subslide before adding a subslide.");
  }
  return parentSlide;
}

function resolveManualAfterSlide(params: {
  activeSlides: NavigableSlide[];
  body: JsonObject;
  createAsDetour: boolean;
  currentNavigation: ManualDeckNavigation;
  parentSlide: NavigableSlide | null;
}): NavigableSlide | null {
  const parentDetour = params.createAsDetour
    ? params.currentNavigation.detours.find((detour: { parentId: string }) => detour.parentId === params.parentSlide?.id)
    : null;
  const lastDetourSlideId = parentDetour && parentDetour.slideIds.length
    ? parentDetour.slideIds[parentDetour.slideIds.length - 1]
    : "";
  const lastDetourSlide = lastDetourSlideId
    ? params.activeSlides.find((slide: NavigableSlide) => slide.id === lastDetourSlideId) || null
    : null;
  return params.createAsDetour
    ? lastDetourSlide || params.parentSlide
    : params.activeSlides.find((slide: NavigableSlide) => slide.id === params.body.afterSlideId) || null;
}

function resolveManualSlidePlacement(body: JsonObject): ManualSlidePlacement {
  const activeSlides = requireNavigableSlides(getSlides());
  const currentContext = getDeckContext();
  const createAsDetour = body.detour === true;
  const currentNavigation = normalizeDeckNavigation(currentContext.deck && currentContext.deck.navigation, activeSlides);
  const parentSlide = resolveManualParentSlide({ activeSlides, body, createAsDetour, currentNavigation });
  const afterSlide = resolveManualAfterSlide({ activeSlides, body, createAsDetour, currentNavigation, parentSlide });
  const targetIndex = afterSlide && typeof afterSlide.index === "number" ? afterSlide.index + 1 : activeSlides.length + 1;
  return {
    afterSlide,
    createAsDetour,
    currentContext,
    parentSlide,
    targetIndex
  };
}

function createManualSlideNavigation(params: {
  allSlidesAfterInsert: NavigableSlide[];
  createdId: string;
  placement: ManualSlidePlacement;
  title: string;
}): unknown {
  const { allSlidesAfterInsert, createdId, placement, title } = params;
  if (placement.createAsDetour && placement.parentSlide) {
    return addDetourSlideToNavigation(
      placement.currentContext.deck && placement.currentContext.deck.navigation,
      allSlidesAfterInsert,
      placement.parentSlide.id,
      createdId,
      title
    );
  }

  return addCoreSlideToNavigation(
    placement.currentContext.deck && placement.currentContext.deck.navigation,
    allSlidesAfterInsert,
    createdId,
    placement.afterSlide ? placement.afterSlide.id : null
  );
}

function createManualSlideOutline(placement: ManualSlidePlacement, title: string): unknown {
  if (placement.createAsDetour) {
    return placement.currentContext.deck && placement.currentContext.deck.outline;
  }

  return renumberOutlineWithInsert(
    placement.currentContext.deck && placement.currentContext.deck.outline,
    title,
    placement.targetIndex
  );
}

export function createDeckSlideHandlers(deps: DeckSlideHandlerDependencies) {
  const {
    createJsonResponse,
    jsonObjectOrEmpty,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  async function handleDeckContextUpdate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const activePresentationId = activePresentationIdFromBody({});
    assertBaseVersion(getPresentationVersion(activePresentationId), body.baseVersion, "Presentation");
    const context = updateDeckFields(jsonObjectOrEmpty(body.deck));
    publishRuntimeState();
    createJsonResponse(res, 200, { context });
  }

  async function handleDeckStructureApply(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.outline !== "string" || !body.outline.trim()) {
      throw new Error("Expected a non-empty outline when applying a deck plan candidate");
    }

    const deckPatch = body.applyDeckPatch === false || !isJsonObject(body.deckPatch) ? null : body.deckPatch;
    const sharedDeckUpdates = countSharedDeckUpdates(deckPatch);
    const context = applyDeckStructurePlan({
      deckPatch,
      label: body.label,
      outline: body.outline,
      slides: body.slides,
      summary: body.summary
    });
    const result = await applyDeckStructureCandidate({
      deckPatch,
      label: body.label,
      outline: body.outline,
      slides: body.slides,
      summary: body.summary
    }, deckStructurePromotionOptions(body));
    markRuntimeBuildSucceeded(runtimeState);
    updateWorkflowState({
      message: deckStructureWorkflowMessage(body.label, result, sharedDeckUpdates),
      ok: true,
      operation: "apply-deck-structure",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      context,
      insertedSlides: result.insertedSlides,
      previews: result.previews,
      indexUpdates: result.indexUpdates,
      removedSlides: result.removedSlides,
      replacedSlides: result.replacedSlides,
      sharedDeckUpdates,
      runtime: serializeRuntimeState(),
      slides: getSlides(),
      titleUpdates: result.titleUpdates
    });
  }

  async function handleDeckLengthPlan(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    createJsonResponse(res, 200, {
      plan: await planDeckLengthSemantic(body || {})
    });
  }

  async function handleDeckLengthApply(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const presentationId = activePresentationIdFromBody(body);
    const result = applyDeckLengthPlan(body || {});
    recordDerivedSlideset({
      id: `length-${result.lengthProfile.activeCount}-${Date.now()}`,
      purpose: `Scaled active deck to ${result.lengthProfile.activeCount} slide${result.lengthProfile.activeCount === 1 ? "" : "s"}.`,
      resultPresentationId: presentationId,
      sourcePresentationId: presentationId,
      targetLength: result.lengthProfile.activeCount
    }, { presentationId });
    const context = updateDeckFields({
      lengthProfile: result.lengthProfile
    });
    const previews = (await buildAndRenderDeck()).previews;

    markRuntimeBuildSucceeded(runtimeState);
    updateWorkflowState({
      message: `Scaled deck to ${result.lengthProfile.activeCount} active slide${result.lengthProfile.activeCount === 1 ? "" : "s"} with ${result.skippedSlides} skipped, ${result.restoredSlides} restored, and ${result.insertedSlides || 0} inserted.`,
      ok: true,
      operation: "scale-deck-length",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      lengthProfile: result.lengthProfile,
      previews,
      insertedSlides: result.insertedSlides || 0,
      restoredSlides: result.restoredSlides,
      runtime: serializeRuntimeState(),
      skippedSlides: getSlides({ includeSkipped: true }).filter((slide: SlideSummary) => slide.skipped && !slide.archived),
      skippedSlidesChanged: result.skippedSlides,
      slides: result.slides
    });
  }

  async function handleSkippedSlideRestore(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const result = restoreSkippedSlides(body || {});
    const context = updateDeckFields({
      lengthProfile: result.lengthProfile
    });
    const previews = (await buildAndRenderDeck()).previews;

    markRuntimeBuildSucceeded(runtimeState);
    updateWorkflowState({
      message: `Restored ${result.restoredSlides} skipped slide${result.restoredSlides === 1 ? "" : "s"}.`,
      ok: true,
      operation: "restore-skipped-slides",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      lengthProfile: result.lengthProfile,
      previews,
      restoredSlides: result.restoredSlides,
      runtime: serializeRuntimeState(),
      skippedSlides: getSlides({ includeSkipped: true }).filter((slide: SlideSummary) => slide.skipped && !slide.archived),
      slides: result.slides
    });
  }

  async function handleManualSystemSlideCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const activePresentationId = activePresentationIdFromBody({});
    assertBaseVersion(getPresentationVersion(activePresentationId), body.baseVersion, "Presentation");
    const slideType = normalizeManualSlideType(body.slideType);
    const title = sentenceValue(body.title, "New system");
    const summary = sentenceValue(
      body.summary,
      "Describe the system boundary, the signal to watch, and the guardrails that keep the deck workflow repeatable."
    );
    const placement = resolveManualSlidePlacement(body);
    const slideSpec = createManualSlideSpecForType({ body, slideType, summary, targetIndex: placement.targetIndex, title });
    const created = insertStructuredSlide(slideSpec, placement.targetIndex);
    const allSlidesAfterInsert = requireNavigableSlides(getSlides({ includeSkipped: true }));
    const navigation = createManualSlideNavigation({ allSlidesAfterInsert, createdId: created.id, placement, title });
    const outline = createManualSlideOutline(placement, title);

    updateDeckFields({ navigation, outline });
    const context = updateSlideContext(created.id, manualSlideContext({
      createAsDetour: placement.createAsDetour,
      parentSlide: placement.parentSlide,
      slideType,
      summary,
      title
    }));
    const previews = (await buildAndRenderDeck()).previews;

    markRuntimeBuildSucceeded(runtimeState);
    const workflow = manualSlideWorkflow(slideType, title, placement.createAsDetour);
    updateWorkflowState({
      message: workflow.message,
      ok: true,
      operation: workflow.operation,
      slideId: created.id,
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      insertedSlideId: created.id,
      previews,
      runtime: serializeRuntimeState(),
      slide: getSlide(created.id),
      slideSpec: created.slideSpec,
      slides: getSlides()
    });
  }

  async function handleManualSlideDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (typeof body.slideId !== "string" || !body.slideId) {
      throw new Error("Expected a slideId to remove");
    }

    const activePresentationId = activePresentationIdFromBody({});
    assertBaseVersion(getSlideVersion(activePresentationId, body.slideId), body.baseVersion, "Slide");
    const removed = archiveStructuredSlide(body.slideId);
    const currentContext = getDeckContext();
    const navigation = removeSlideFromNavigation(
      currentContext.deck && currentContext.deck.navigation,
      getSlides({ includeArchived: true, includeSkipped: true }),
      removed.id
    );
    const outline = renumberOutlineWithoutIndex(currentContext.deck && currentContext.deck.outline, removed.index);
    const context = updateDeckFields({ navigation, outline });
    const previews = (await buildAndRenderDeck()).previews;
    const remainingSlides = getSlides();
    const selected = remainingSlides[Math.min(Math.max(removed.index - 1, 0), remainingSlides.length - 1)] || remainingSlides[0] || null;

    markRuntimeBuildSucceeded(runtimeState);
    updateWorkflowState({
      message: `Removed slide ${removed.title} from the deck.`,
      ok: true,
      operation: "remove-slide",
      slideId: removed.id,
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      previews,
      removedSlideId: removed.id,
      runtime: serializeRuntimeState(),
      selectedSlideId: selected ? selected.id : null,
      slides: remainingSlides
    });
  }

  async function handleManualSlidesReorder(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const reorderedSlides = reorderActiveSlides(body.slideIds);
    const orderIndex = new Map<string, number>();
    reorderedSlides.forEach((slide: SlideSummary, index: number) => {
      if (typeof slide.id === "string") {
        orderIndex.set(slide.id, index);
      }
    });
    const indexFor = (slideId: string): number => orderIndex.get(slideId) ?? Number.MAX_SAFE_INTEGER;
    const currentContext = getDeckContext();
    const currentNavigation = normalizeDeckNavigation(currentContext.deck && currentContext.deck.navigation, reorderedSlides);
    const navigation = {
      ...currentNavigation,
      coreSlideIds: [...currentNavigation.coreSlideIds].sort((left, right) => indexFor(left) - indexFor(right)),
      detours: currentNavigation.detours.map((detour: { label?: string; parentId: string; slideIds: string[] }) => ({
        ...detour,
        slideIds: [...detour.slideIds].sort((left, right) => indexFor(left) - indexFor(right))
      }))
    };
    const context = updateDeckFields({ navigation });
    const previews = (await buildAndRenderDeck()).previews;
    const selected = typeof body.selectedSlideId === "string"
      ? reorderedSlides.find((slide: SlideSummary) => slide.id === body.selectedSlideId) || reorderedSlides[0] || null
      : reorderedSlides[0] || null;

    markRuntimeBuildSucceeded(runtimeState);
    updateWorkflowState({
      message: "Reordered slides in the active deck.",
      ok: true,
      operation: "reorder-slides",
      slideId: selected ? selected.id : null,
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      context,
      domPreview: getDomPreviewState({ includeDetours: true }),
      previews,
      runtime: serializeRuntimeState(),
      selectedSlideId: selected ? selected.id : null,
      slides: reorderedSlides
    });
  }

  return {
    handleDeckContextUpdate,
    handleDeckLengthApply,
    handleDeckLengthPlan,
    handleDeckStructureApply,
    handleManualSlideDelete,
    handleManualSlidesReorder,
    handleManualSystemSlideCreate,
    handleSkippedSlideRestore
  };
}
