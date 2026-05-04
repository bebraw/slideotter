import * as http from "http";

import { buildAndRenderDeck } from "./services/build.ts";
import { applyDeckLengthPlan, planDeckLengthSemantic, restoreSkippedSlides } from "./services/deck-length.ts";
import { getDomPreviewState } from "./services/dom-preview.ts";
import { assertBaseVersion, getPresentationVersion, getSlideVersion } from "./services/hypermedia.ts";
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

type ManualDetourStack = {
  parentId: string;
  slideIds: string[];
};

type ManualDeckNavigation = {
  coreSlideIds: string[];
  detours: ManualDetourStack[];
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

function resolveManualDetourParentSlideId(navigation: ManualDeckNavigation, selectedSlideId: string): string {
  if (navigation.coreSlideIds.includes(selectedSlideId)) {
    return selectedSlideId;
  }

  const parentDetour = navigation.detours.find((detour: ManualDetourStack) => detour.slideIds.includes(selectedSlideId));
  return parentDetour ? parentDetour.parentId : "";
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
    const sharedDeckUpdates = deckPatch
      ? Object.keys(deckPatch).reduce((count: number, key: string) => {
        const value = deckPatch[key];
        if (value == null) {
          return count;
        }

        if (isJsonObject(value)) {
          return count + Object.keys(value).length;
        }

        return count + 1;
      }, 0)
      : 0;

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
    }, {
      promoteInsertions: body.promoteInsertions !== false,
      promoteIndices: body.promoteIndices !== false,
      promoteRemovals: body.promoteRemovals !== false,
      promoteReplacements: body.promoteReplacements !== false,
      promoteTitles: body.promoteTitles !== false
    });
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    updateWorkflowState({
      message: body.label
        ? `Applied deck plan candidate ${body.label} to the saved outline, slide plan, ${result.insertedSlides} inserted slide${result.insertedSlides === 1 ? "" : "s"}, ${result.replacedSlides} replaced slide${result.replacedSlides === 1 ? "" : "s"}, ${result.removedSlides} archived slide${result.removedSlides === 1 ? "" : "s"}, ${result.indexUpdates} slide order change${result.indexUpdates === 1 ? "" : "s"}, ${result.titleUpdates} slide title${result.titleUpdates === 1 ? "" : "s"}${sharedDeckUpdates ? `, and ${sharedDeckUpdates} shared deck setting${sharedDeckUpdates === 1 ? "" : "s"}` : ""}.`
        : `Applied deck plan candidate to the saved outline, slide plan, ${result.insertedSlides} inserted slide${result.insertedSlides === 1 ? "" : "s"}, ${result.replacedSlides} replaced slide${result.replacedSlides === 1 ? "" : "s"}, ${result.removedSlides} archived slide${result.removedSlides === 1 ? "" : "s"}, ${result.indexUpdates} slide order change${result.indexUpdates === 1 ? "" : "s"}, ${result.titleUpdates} slide title${result.titleUpdates === 1 ? "" : "s"}${sharedDeckUpdates ? `, and ${sharedDeckUpdates} shared deck setting${sharedDeckUpdates === 1 ? "" : "s"}` : ""}.`,
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
    const result = applyDeckLengthPlan(body || {});
    const context = updateDeckFields({
      lengthProfile: result.lengthProfile
    });
    const previews = (await buildAndRenderDeck()).previews;

    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
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

    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
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
    const requestedSlideType = typeof body.slideType === "string" ? body.slideType : "";
    const slideType = ["divider", "quote", "photo", "photoGrid"].includes(requestedSlideType) ? requestedSlideType : "content";
    const title = sentenceValue(body.title, "New system");
    const summary = sentenceValue(
      body.summary,
      "Describe the system boundary, the signal to watch, and the guardrails that keep the deck workflow repeatable."
    );
    const activeSlides = getSlides();
    const currentContext = getDeckContext();
    const createAsDetour = body.detour === true;
    const currentNavigation = normalizeDeckNavigation(currentContext.deck && currentContext.deck.navigation, activeSlides);
    const selectedParentSlideId = typeof body.parentSlideId === "string" ? body.parentSlideId : "";
    const resolvedParentSlideId = createAsDetour
      ? resolveManualDetourParentSlideId(currentNavigation, selectedParentSlideId)
      : selectedParentSlideId;
    const parentSlide = activeSlides.find((slide: SlideSummary) => slide.id === resolvedParentSlideId) || null;
    if (createAsDetour && (!parentSlide || !currentNavigation.coreSlideIds.includes(parentSlide.id))) {
      throw new Error("Choose a core slide or an existing subslide before adding a subslide.");
    }
    const parentDetour = createAsDetour
      ? currentNavigation.detours.find((detour: { parentId: string }) => detour.parentId === parentSlide?.id)
      : null;
    const lastDetourSlideId = parentDetour && parentDetour.slideIds.length
      ? parentDetour.slideIds[parentDetour.slideIds.length - 1]
      : "";
    const lastDetourSlide = lastDetourSlideId
      ? activeSlides.find((slide: SlideSummary) => slide.id === lastDetourSlideId) || null
      : null;
    const afterSlide = createAsDetour
      ? lastDetourSlide || parentSlide
      : activeSlides.find((slide: SlideSummary) => slide.id === body.afterSlideId) || null;
    const targetIndex = afterSlide && typeof afterSlide.index === "number" ? afterSlide.index + 1 : activeSlides.length + 1;
    const slideSpec = slideType === "divider"
      ? createManualDividerSlideSpec({ targetIndex, title })
      : slideType === "quote"
        ? createManualQuoteSlideSpec({ quote: summary, targetIndex, title })
        : slideType === "photo"
          ? createManualPhotoSlideSpec({ caption: summary, materialId: body.materialId, targetIndex, title })
          : slideType === "photoGrid"
            ? createManualPhotoGridSlideSpec({ caption: summary, materialIds: body.materialIds, targetIndex, title })
            : createManualSystemSlideSpec({ summary, targetIndex, title });
    const created = insertStructuredSlide(slideSpec, targetIndex);
    const allSlidesAfterInsert = getSlides({ includeSkipped: true });
    const navigation = createAsDetour && parentSlide
      ? addDetourSlideToNavigation(
        currentContext.deck && currentContext.deck.navigation,
        allSlidesAfterInsert,
        parentSlide.id,
        created.id,
        title
      )
      : addCoreSlideToNavigation(
        currentContext.deck && currentContext.deck.navigation,
        allSlidesAfterInsert,
        created.id,
        afterSlide ? afterSlide.id : null
      );
    const outline = createAsDetour
      ? currentContext.deck && currentContext.deck.outline
      : renumberOutlineWithInsert(currentContext.deck && currentContext.deck.outline, title, targetIndex);

    updateDeckFields({ navigation, outline });
    const context = updateSlideContext(created.id, slideType === "divider"
      ? {
          title,
          intent: createAsDetour
            ? `Use ${title} as optional deeper material below ${parentSlide?.title || "the parent slide"}.`
            : `Use ${title} as a clean section boundary before the following slide cluster.`,
          mustInclude: "One short title that signals the next section clearly.",
          notes: createAsDetour ? "Manual detour divider created from the Slide Studio panel." : "Manual divider slide created from the Slide Studio panel.",
          layoutHint: "Keep the divider title-only and centered."
        }
      : slideType === "quote"
        ? {
            title,
            intent: `Use ${title} as a focused quote or authored pull quote.`,
            mustInclude: "One short quote, optional attribution, optional source, and compact context.",
            notes: "Manual quote slide created from the Slide Studio panel.",
            layoutHint: "Keep the quote dominant with attribution and source attached below."
          }
        : slideType === "photo"
          ? {
              title,
              intent: `Use ${title} as a dominant visual evidence slide.`,
              mustInclude: "One attached material, readable alt text, and a compact caption or source line when useful.",
              notes: "Manual photo slide created from the Slide Studio panel.",
              layoutHint: "Keep the image dominant and the caption attached to the visual."
            }
          : slideType === "photoGrid"
            ? {
                title,
                intent: `Use ${title} as a grouped visual evidence slide.`,
                mustInclude: "Two to four attached materials, readable alt text, and compact captions or source lines when useful.",
                notes: "Manual photo grid slide created from the Slide Studio panel.",
                layoutHint: "Keep the image set balanced and captions attached to each visual."
              }
            : {
                title,
                intent: summary,
                mustInclude: "Boundary, signal, owner, feedback loop, and validation check.",
                notes: "Manual system slide created from the Slide Studio panel.",
                layoutHint: "Use the content system-slide layout with concise labels."
              });
    const previews = (await buildAndRenderDeck()).previews;

    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    updateWorkflowState({
      message: createAsDetour
        ? `Added detour slide ${title}.`
        : slideType === "divider"
          ? `Added manual divider slide ${title}.`
          : slideType === "quote"
            ? `Added manual quote slide ${title}.`
            : slideType === "photo"
              ? `Added manual photo slide ${title}.`
              : slideType === "photoGrid"
                ? `Added manual photo grid slide ${title}.`
                : `Added manual system slide ${title}.`,
      ok: true,
      operation: createAsDetour
        ? "add-detour-slide"
        : slideType === "divider"
          ? "add-divider-slide"
          : slideType === "quote"
            ? "add-quote-slide"
            : slideType === "photo"
              ? "add-photo-slide"
              : slideType === "photoGrid"
                ? "add-photo-grid-slide"
                : "add-system-slide",
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

    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
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

    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
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
