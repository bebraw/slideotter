import * as http from "http";

import {
  importContentRunArtifacts,
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
import { writeGenerationErrorDiagnostic } from "./services/generation-diagnostics.ts";
import { searchImages } from "./services/image-search.ts";
import { createMaterialFromDataUrl, createMaterialFromRemoteImage } from "./services/materials.ts";
import {
  clearPresentationCreationDraft,
  createOutlinePlanFromDeckPlan,
  createPresentation,
  getPresentationCreationDraft,
  readPresentationSummary,
  regeneratePresentationSlides,
  savePresentationCreationDraft,
  setActivePresentation
} from "./services/presentations.ts";
import { generatePresentationFromDeckPlanIncremental } from "./services/presentation-generation.ts";
import { validateSlideSpec } from "./services/slide-specs/index.ts";
import { createSource } from "./services/sources.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  media?: JsonObject;
  mediaItems?: unknown;
  skipped?: unknown;
  title?: unknown;
};

type StarterMaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  title?: unknown;
};

type MaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  id?: unknown;
  license?: unknown;
  licenseUrl?: unknown;
  provider?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
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

type DeckPlanSlide = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  title?: unknown;
  visualNeed?: unknown;
};

type DeckPlanPayload = JsonObject & {
  outline?: unknown;
  slides?: DeckPlanSlide[];
};

type ContentRunSlide = JsonObject & {
  error?: unknown;
  errorLogPath?: unknown;
  slideContext?: unknown;
  slideSpec?: SlideSpecPayload | null;
  status?: unknown;
};

type ContentRunState = JsonObject & {
  completed?: unknown;
  failedSlideIndex?: unknown;
  id?: unknown;
  materials?: MaterialPayload[];
  slides?: ContentRunSlide[];
  sourceText?: unknown;
  status?: unknown;
  stopRequested?: unknown;
};

type ContentRunPatch = JsonObject & {
  completed?: unknown;
  failedSlideIndex?: unknown;
  slides?: ContentRunSlide[];
  status?: unknown;
};

type GenerationProgressPayload = JsonObject & {
  slideCount?: unknown;
  slideIndex?: unknown;
  stage?: unknown;
};

type GeneratedPartialSlidePayload = JsonObject & {
  slideContexts?: unknown;
  slideCount?: unknown;
  slideIndex?: unknown;
  slideSpec?: unknown;
};

type GenerationDraftFields = CreationFields & {
  includeActiveMaterials: boolean;
  includeActiveSources: boolean;
  onProgress: ((progress: GenerationProgressPayload) => void) | undefined;
  presentationMaterials: MaterialPayload[];
  presentationSourceText: string;
};

type PlaceholderDeck = {
  slideContexts: JsonObject;
  slideSpecs: SlideSpecPayload[];
};

type CreationContentRunHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  errorCode: (error: unknown) => string;
  errorMessage: (error: unknown) => string;
  isJsonObject: (value: unknown) => value is JsonObject;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  normalizeCreationFields: (body?: JsonObject) => CreationFields;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  resetPresentationRuntime: () => void;
  runtimeState: {
    lastError: {
      message?: string;
      updatedAt?: string;
    } | null;
    sourceRetrieval: unknown;
    workflow: JsonObject | null;
  };
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

export function createCreationContentRunHandlers(deps: CreationContentRunHandlerDependencies) {
  const {
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
  } = deps;

  function isSlideSpecPayload(value: unknown): value is SlideSpecPayload {
    return isJsonObject(value);
  }

  function isMaterialPayload(value: unknown): value is MaterialPayload {
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

  function isContentRunSlide(value: unknown): value is ContentRunSlide {
    return isJsonObject(value);
  }

  function isContentRunState(value: unknown): value is ContentRunState {
    return isJsonObject(value);
  }

  function slugify(value: unknown, fallback: string): string {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
    return slug || fallback;
  }

  async function handlePresentationDraftCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const fields = normalizeCreationFields({
      ...(current.fields || {}),
      ...(body.fields || {})
    });
    const deckPlan = jsonObjectOrEmpty(body.deckPlan || current.deckPlan);
    const approvedOutline = body.approvedOutline === true || current.approvedOutline === true;
    const starterSourceText = fields.presentationSourceText;
    const starterMaterials = Array.isArray(body.presentationMaterials) ? body.presentationMaterials : [];

    if (!fields.title) {
      throw new Error("Expected a presentation title before creating slides");
    }
    if (!approvedOutline) {
      throw new Error("Approve the generated outline before creating slides");
    }
    if (current.outlineDirty) {
      throw new Error("Regenerate the outline after changing the brief before creating slides");
    }
    if (!deckPlan || !Array.isArray(deckPlan.slides) || !deckPlan.slides.length) {
      throw new Error("Expected an approved outline before creating slides");
    }

    const currentContentRun = jsonObjectOrEmpty(current.contentRun);
    if (currentContentRun.status === "running") {
      createJsonResponse(res, 200, {
        creationDraft: current,
        runtime: serializeRuntimeState()
      });
      return;
    }

    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "create-presentation-from-outline"
    });
    reportProgress({
      message: "Drafting slides from approved outline...",
      stage: "drafting-slides"
    });

    const timestamp = new Date().toISOString();
    const slideCount = deckPlan.slides.length;
    const runId = `content-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runSlides = Array.from({ length: slideCount }, () => ({
      error: null,
      slideContext: null,
      slideSpec: null,
      status: "pending"
    }));

    const livePlaceholderDeck = createLiveContentRunPlaceholderDeck(deckPlan);
    const presentation = createPresentation({
      ...fields,
      initialSlideSpecs: livePlaceholderDeck.slideSpecs,
      outline: deckPlan.outline || "",
      targetSlideCount: fields.targetSlideCount || slideCount,
      title: fields.title
    });
    createOutlinePlanFromDeckPlan(presentation.id, deckPlan, {
      audience: fields.audience,
      name: "Approved creation outline",
      objective: fields.objective,
      purpose: fields.objective,
      targetSlideCount: slideCount,
      title: fields.title,
      tone: fields.tone
    });
    setActivePresentation(presentation.id);
    regeneratePresentationSlides(presentation.id, livePlaceholderDeck.slideSpecs, {
      outline: deckPlan.outline || "",
      slideContexts: livePlaceholderDeck.slideContexts,
      targetSlideCount: slideCount
    });

    const draft = savePresentationCreationDraft({
      ...current,
      approvedOutline: true,
      contentRun: {
        completed: 0,
        failedSlideIndex: null,
        id: runId,
        slideCount,
        slides: runSlides,
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp
      },
      createdPresentationId: presentation.id,
      deckPlan,
      fields,
      outlineDirty: false,
      stage: "content"
    });
    publishCreationDraftUpdate(draft);

    createJsonResponse(res, 202, {
      creationDraft: draft,
      presentation: readPresentationSummary(presentation.id),
      runtime: serializeRuntimeState()
    });

    const starterGenerationMaterials: MaterialPayload[] = starterMaterials.map((material: StarterMaterialPayload, index: number) => {
      const title = String(material.title || material.fileName || `Starter image ${index + 1}`).trim() || `Starter image ${index + 1}`;
      const id = `material-starter-${slugify(material.fileName || title, `image-${index + 1}`)}`;
      return {
        alt: material.alt || title,
        caption: material.caption || "",
        dataUrl: material.dataUrl,
        fileName: material.fileName || title,
        id,
        title,
        url: material.dataUrl
      };
    });

    const runGeneration = async (): Promise<void> => {
      try {
        const contentRunState = (next: ContentRunPatch): unknown => {
          const latest = getPresentationCreationDraft();
          const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!run || run.id !== runId) {
            return null;
          }

          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...run,
              ...next,
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
          return nextDraft;
        };

        const shouldStop = (): boolean => {
          const latest = getPresentationCreationDraft();
          const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          return Boolean(run && run.id === runId && run.stopRequested === true);
        };

        const imageSearchQuery = fields.imageSearch && String(fields.imageSearch.query || "").trim();
        const imageSearch = imageSearchQuery
          ? await searchImages({
              count: fields.imageSearch.count,
              provider: fields.imageSearch.provider,
              query: imageSearchQuery,
              restrictions: fields.imageSearch.restrictions
            })
          : null;
        const searchedMaterials: MaterialPayload[] = imageSearch && Array.isArray(imageSearch.results)
          ? imageSearch.results.filter(isMaterialPayload).map((result: MaterialPayload, index: number) => ({
              alt: result.alt || result.title || `Search image ${index + 1}`,
              caption: result.caption || result.sourceUrl || "",
              creator: result.creator || "",
              id: `material-search-${slugify(result.provider || "search", "search")}-${index + 1}`,
              license: result.license || "",
              licenseUrl: result.licenseUrl || "",
              provider: result.provider,
              sourceUrl: result.sourceUrl || "",
              title: result.title || `Search image ${index + 1}`,
              url: result.url
            }))
          : [];

        const generationMaterials = [
          ...starterGenerationMaterials,
          ...searchedMaterials
        ];

        if (starterSourceText) {
          await createSource({
            text: starterSourceText,
            title: "Starter sources"
          });
        }

        const importedMaterials: MaterialPayload[] = [];
        starterGenerationMaterials.forEach((material: MaterialPayload) => {
          if (!material.dataUrl) {
            return;
          }
          importedMaterials.push(createMaterialFromDataUrl({
            alt: material.alt,
            caption: material.caption,
            dataUrl: material.dataUrl,
            fileName: material.fileName,
            id: material.id,
            title: material.title
          }));
        });

        for (const material of searchedMaterials) {
          try {
            importedMaterials.push(await createMaterialFromRemoteImage({
              alt: material.alt,
              caption: material.caption,
              creator: material.creator,
              id: material.id,
              license: material.license,
              licenseUrl: material.licenseUrl,
              provider: material.provider,
              sourceUrl: material.sourceUrl,
              title: material.title,
              url: material.url
            }));
          } catch (error) {
            // Continue with other search images.
          }
        }

        const materialUrlById = new Map(importedMaterials.map((material: MaterialPayload) => [String(material.id || ""), material.url]));
        const liveSlideSpecs = livePlaceholderDeck.slideSpecs.map((slideSpec: SlideSpecPayload) => ({ ...slideSpec }));
        const liveSlideContexts: JsonObject = { ...livePlaceholderDeck.slideContexts };
        const publishLiveDeck = (): void => {
          regeneratePresentationSlides(presentation.id, liveSlideSpecs.map((slideSpec) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById)), {
            outline: deckPlan.outline || "",
            slideContexts: liveSlideContexts,
            targetSlideCount: slideCount
          });
        };

        contentRunState({
          materials: generationMaterials,
          sourceText: starterSourceText
        });

        const draftFields: GenerationDraftFields = {
          ...fields,
          includeActiveMaterials: false,
          includeActiveSources: false,
          onProgress: undefined,
          presentationMaterials: generationMaterials,
          presentationSourceText: starterSourceText
        };

        const setSlideState = (index: number, next: ContentRunSlide): unknown => {
          const latest = getPresentationCreationDraft();
          const run = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!run || run.id !== runId || !Array.isArray(run.slides)) {
            return null;
          }

          const slides = run.slides.filter(isContentRunSlide).map((slide: ContentRunSlide, idx: number) => idx === index ? { ...slide, ...next } : slide);
          const completed = slides.filter((slide: ContentRunSlide) => slide.status === "complete").length;
          return contentRunState({
            completed,
            slides
          });
        };

        const reportProgressWithRun = (progress: GenerationProgressPayload): void => {
          const slideIndex = Number(progress.slideIndex);
          if (
            progress
            && progress.stage === "drafting-slide"
            && Number.isFinite(slideIndex)
            && Number.isFinite(Number(progress.slideCount))
            && slideIndex >= 1
            && slideIndex <= slideCount
          ) {
            setSlideState(slideIndex - 1, { status: "generating", error: null });
          }

          reportProgress({
            ...progress,
            stage: typeof progress.stage === "string" ? progress.stage : "running"
          });
        };

        draftFields.onProgress = reportProgressWithRun;

        const generated = await generatePresentationFromDeckPlanIncremental(draftFields, deckPlan, {}, {
          onSlide: async (payload: unknown): Promise<void> => {
            const partial = jsonObjectOrEmpty(payload) as GeneratedPartialSlidePayload;
            const slideIndex = Number(partial.slideIndex);
            const slideCountProgress = Number(partial.slideCount);
            const slideIndexZero = slideIndex - 1;
            const validatedSpec = jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
            const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
            const partialContexts = isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
            const partialContext = partialContexts[contextKey] || null;
            liveSlideSpecs[slideIndexZero] = validatedSpec;
            liveSlideContexts[contextKey] = partialContext || liveSlideContexts[contextKey] || {};
            publishLiveDeck();
            setSlideState(slideIndexZero, {
              slideContext: partialContext,
              slideSpec: validatedSpec,
              status: "complete"
            });
            reportProgress({
              message: `Completed slide ${slideIndex}/${slideCountProgress}.`,
              slideCount: slideCountProgress,
              slideIndex,
              stage: "completed-slide"
            });
          },
          shouldStop
        });

        reportProgress({
          message: "Finalizing generated slides into deck files...",
          stage: "finalizing"
        });

        setActivePresentation(presentation.id);
        const slideSpecs = Array.isArray(generated.slideSpecs)
          ? generated.slideSpecs.map((slideSpec: unknown) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById))
          : [];
        regeneratePresentationSlides(presentation.id, slideSpecs, {
          outline: generated.outline,
          slideContexts: generated.slideContexts,
          targetSlideCount: generated.targetSlideCount
        });

        const nextDraft = savePresentationCreationDraft({
          ...getPresentationCreationDraft(),
          contentRun: null,
          createdPresentationId: presentation.id,
          stage: "structure"
        });
        publishCreationDraftUpdate(nextDraft);

        updateWorkflowState({
          generation: generated.generation,
          message: [
            generated.summary,
            "Created from an approved outline."
          ].filter(Boolean).join(" "),
          ok: true,
          operation: "create-presentation-from-outline",
          stage: "completed",
          status: "completed"
        });
        runtimeState.lastError = null;
        runtimeState.sourceRetrieval = generated.retrieval || null;
        publishRuntimeState();
        const resetDraft = clearPresentationCreationDraft();
        publishCreationDraftUpdate(resetDraft);
      } catch (error) {
        const latest = getPresentationCreationDraft();
        const run = isJsonObject(latest) && isContentRunState(latest.contentRun) && latest.contentRun.id === runId ? latest.contentRun : null;
        if (errorCode(error) === "CONTENT_RUN_STOPPED") {
          if (run && Array.isArray(run.slides)) {
            const nextDraft = savePresentationCreationDraft({
              ...latest,
              contentRun: {
                ...run,
                status: "stopped",
                stopRequested: false,
                updatedAt: new Date().toISOString()
              }
            });
            publishCreationDraftUpdate(nextDraft);
          }

          updateWorkflowState({
            message: "Slide generation stopped. Completed slides are kept.",
            ok: false,
            operation: "create-presentation-from-outline",
            stage: "stopped",
            status: "stopped"
          });
          publishRuntimeState();
          return;
        }

        if (run && Array.isArray(run.slides)) {
          const slides = run.slides.filter(isContentRunSlide);
          const firstIncomplete = slides.findIndex((slide: ContentRunSlide) => slide.status !== "complete");
          const failedIndex = firstIncomplete >= 0 ? firstIncomplete : null;
          const diagnostic = writeGenerationErrorDiagnostic(error, {
            deckTitle: fields.title,
            operation: "create-presentation-from-outline",
            planSlide: failedIndex === null || !Array.isArray(deckPlan.slides) ? null : deckPlan.slides[failedIndex] || null,
            runId,
            slideCount,
            slideIndex: failedIndex,
            workflow: runtimeState.workflow
          });
          const nextSlides = slides.map((slide: ContentRunSlide, index: number) => {
            if (failedIndex === index) {
              return {
                ...slide,
                error: errorMessage(error),
                errorLogPath: diagnostic.filePath,
                status: "failed"
              };
            }
            return slide;
          });

          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...run,
              failedSlideIndex: failedIndex,
              slides: nextSlides,
              status: "failed",
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
        }

        updateWorkflowState({
          message: errorMessage(error),
          ok: false,
          operation: "create-presentation-from-outline",
          stage: "failed",
          status: "failed"
        });
        publishRuntimeState();
      }
    };

    runGeneration();
  }

  function createSkippedContentRunSlideSpec(planSlide: DeckPlanSlide, index: number, slideCount: number): SlideSpecPayload {
    const title = String(planSlide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`;
    const timestamp = new Date().toISOString();

    return {
      index: index + 1,
      skipMeta: {
        keyMessage: String(planSlide.keyMessage || ""),
        operation: "partial-content-acceptance",
        previousIndex: index + 1,
        role: String(planSlide.role || ""),
        skippedAt: timestamp,
        sourceNeed: String(planSlide.sourceNeed || ""),
        targetCount: slideCount,
        visualNeed: String(planSlide.visualNeed || "")
      },
      skipped: true,
      skipReason: "Partial generation accepted before this slide was drafted.",
      title,
      type: "divider"
    };
  }

  function createLiveContentRunPlaceholderSlideSpec(planSlide: DeckPlanSlide, index: number, slideCount: number): SlideSpecPayload {
    const title = String(planSlide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`;
    const intent = String(planSlide.intent || "").trim();
    const keyMessage = String(planSlide.keyMessage || intent || "Draft this slide from the approved outline.").trim();
    const sourceNeed = String(planSlide.sourceNeed || "Use supplied context when relevant.").trim();
    const visualNeed = String(planSlide.visualNeed || "Use a simple readable layout.").trim();
    const role = String(planSlide.role || "").trim();

    if (index === 0) {
      return {
        type: "cover",
        title,
        logo: "slideotter",
        eyebrow: "Pending",
        summary: keyMessage,
        note: intent || "Waiting for slide generation.",
        cards: [
          {
            id: "pending-intent",
            title: "Intent",
            body: intent || "Draft this opening slide from the approved outline."
          },
          {
            id: "pending-source",
            title: "Source",
            body: sourceNeed
          },
          {
            id: "pending-visual",
            title: "Visual",
            body: visualNeed
          }
        ],
        generationStatus: "pending"
      };
    }

    if (index === slideCount - 1) {
      return {
        type: "summary",
        title,
        eyebrow: "Pending",
        summary: keyMessage,
        resourcesTitle: "Outline context",
        bullets: [
          {
            id: "pending-intent",
            title: "Intent",
            body: intent || "Close the deck from the approved outline."
          },
          {
            id: "pending-message",
            title: "Message",
            body: keyMessage
          },
          {
            id: "pending-visual",
            title: "Visual",
            body: visualNeed
          }
        ],
        resources: [
          {
            id: "pending-source",
            title: "Source need",
            body: sourceNeed
          },
          {
            id: "pending-role",
            title: "Role",
            body: role || "Final slide"
          }
        ],
        generationStatus: "pending"
      };
    }

    return {
      type: "content",
      title,
      eyebrow: "Pending",
      summary: keyMessage,
      signalsTitle: "Outline context",
      guardrailsTitle: "Generation notes",
      signals: [
        {
          id: "pending-intent",
          title: "Intent",
          body: intent || "Draft this slide from the approved outline."
        },
        {
          id: "pending-message",
          title: "Key message",
          body: keyMessage
        },
        {
          id: "pending-source",
          title: "Source need",
          body: sourceNeed
        },
        {
          id: "pending-visual",
          title: "Visual need",
          body: visualNeed
        }
      ],
      guardrails: [
        {
          id: "pending-status",
          title: "Status",
          body: "Waiting for generation."
        },
        {
          id: "pending-role",
          title: "Role",
          body: role || "Outline slide"
        },
        {
          id: "pending-apply",
          title: "Boundary",
          body: "Generated content will replace this placeholder after validation."
        }
      ],
      generationStatus: "pending"
    };
  }

  function createLiveContentRunPlaceholderDeck(deckPlan: unknown): PlaceholderDeck {
    const planSlides = deckPlanSlides(deckPlan);
    const slideCount = planSlides.length;
    const slideContexts: JsonObject = {};
    const slideSpecs = planSlides.map((planSlide: DeckPlanSlide, index: number) => {
      const contextKey = `slide-${String(index + 1).padStart(2, "0")}`;
      slideContexts[contextKey] = {
        intent: planSlide.intent || "",
        layoutHint: planSlide.visualNeed || "",
        mustInclude: planSlide.keyMessage || "",
        notes: planSlide.sourceNeed || "",
        title: planSlide.title || `Slide ${index + 1}`
      };
      return createLiveContentRunPlaceholderSlideSpec(planSlide, index, slideCount);
    });

    return {
      slideContexts,
      slideSpecs: slideSpecs.filter(isSlideSpecPayload)
    };
  }

  function buildPartialContentRunDeck(run: ContentRunState, deckPlan: unknown): PlaceholderDeck {
    const planSlides = deckPlanSlides(deckPlan);
    const runSlides = Array.isArray(run.slides) ? run.slides.filter(isContentRunSlide) : [];
    const slideCount = planSlides.length;
    const slideContexts: JsonObject = {};
    const slideSpecs = planSlides.map((planSlide: DeckPlanSlide, index: number) => {
      const runSlide = runSlides[index] || {};
      const contextKey = `slide-${String(index + 1).padStart(2, "0")}`;
      if (runSlide.status === "complete" && isSlideSpecPayload(runSlide.slideSpec)) {
        slideContexts[contextKey] = runSlide.slideContext || {
          intent: planSlide.intent || "",
          layoutHint: planSlide.visualNeed || "",
          mustInclude: planSlide.keyMessage || "",
          notes: planSlide.sourceNeed || "",
          title: planSlide.title || runSlide.slideSpec.title || ""
        };
        return validateSlideSpec({
          ...runSlide.slideSpec,
          index: index + 1
        });
      }

      slideContexts[contextKey] = {
        intent: planSlide.intent || "",
        layoutHint: planSlide.visualNeed || "",
        mustInclude: planSlide.keyMessage || "",
        notes: planSlide.sourceNeed || "",
        title: planSlide.title || `Slide ${index + 1}`
      };
      return createSkippedContentRunSlideSpec(planSlide, index, slideCount);
    });

    return {
      slideContexts,
      slideSpecs: slideSpecs.filter(isSlideSpecPayload)
    };
  }

  async function handlePresentationDraftContentAcceptPartial(res: ServerResponse): Promise<void> {
    const current = getPresentationCreationDraft();
    const deckPlan = isJsonObject(current) && isDeckPlanPayload(current.deckPlan) ? current.deckPlan : null;
    const run = isJsonObject(current) && isContentRunState(current.contentRun) ? current.contentRun : null;
    const planSlides = deckPlanSlides(deckPlan);
    const runSlides = run && Array.isArray(run.slides) ? run.slides.filter(isContentRunSlide) : [];

    if (!deckPlan || !planSlides.length) {
      throw new Error("Expected an approved outline before accepting a partial deck");
    }
    if (!run || !runSlides.length) {
      throw new Error("No content run is available to accept");
    }
    if (run.status === "running") {
      throw new Error("Stop generation before accepting a partial deck");
    }
    if (!runSlides.some((slide: ContentRunSlide) => slide.status === "complete" && isSlideSpecPayload(slide.slideSpec))) {
      throw new Error("Accepting a partial deck requires at least one completed slide");
    }

    resetPresentationRuntime();
    updateWorkflowState({
      message: "Accepting completed slides and creating skipped placeholders...",
      ok: false,
      operation: "accept-partial-presentation",
      stage: "accepting-partial",
      status: "running"
    });

    const fields = normalizeCreationFields(isJsonObject(current) ? jsonObjectOrEmpty(current.fields) : {});
    const { slideContexts, slideSpecs } = buildPartialContentRunDeck(run, deckPlan);
    const presentation = createPresentation({
      ...fields,
      outline: deckPlan.outline || "",
      targetSlideCount: planSlides.length,
      title: fields.title || "slideotter"
    });
    createOutlinePlanFromDeckPlan(presentation.id, deckPlan, {
      audience: fields.audience,
      name: "Approved partial creation outline",
      objective: fields.objective,
      purpose: fields.objective,
      targetSlideCount: planSlides.length,
      title: fields.title,
      tone: fields.tone
    });
    setActivePresentation(presentation.id);

    const materialUrlById = await importContentRunArtifacts(run, {
      createMaterialFromDataUrl,
      createMaterialFromRemoteImage,
      createSource
    });
    const finalSlideSpecs = slideSpecs.map((slideSpec: SlideSpecPayload) => slideSpec.skipped
      ? slideSpec
      : replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById));
    regeneratePresentationSlides(presentation.id, finalSlideSpecs, {
      outline: deckPlan.outline || "",
      slideContexts,
      targetSlideCount: planSlides.length
    });

    const nextDraft = savePresentationCreationDraft({
      ...getPresentationCreationDraft(),
      contentRun: null,
      createdPresentationId: presentation.id,
      stage: "content"
    });
    publishCreationDraftUpdate(nextDraft);

    const skippedCount = finalSlideSpecs.filter((slideSpec: SlideSpecPayload) => slideSpec.skipped === true).length;
    updateWorkflowState({
      message: `Accepted ${finalSlideSpecs.length - skippedCount} completed slide${finalSlideSpecs.length - skippedCount === 1 ? "" : "s"} with ${skippedCount} skipped placeholder${skippedCount === 1 ? "" : "s"}.`,
      ok: true,
      operation: "accept-partial-presentation",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();
    const resetDraft = clearPresentationCreationDraft();
    publishCreationDraftUpdate(resetDraft);

    createJsonResponse(res, 200, {
      creationDraft: resetDraft,
      presentation: readPresentationSummary(presentation.id),
      runtime: serializeRuntimeState()
    });
  }

  async function handlePresentationDraftContentRetry(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const current = getPresentationCreationDraft();
    const deckPlan = isJsonObject(current) && isDeckPlanPayload(current.deckPlan) ? current.deckPlan : null;
    const run = isJsonObject(current) && isContentRunState(current.contentRun) ? current.contentRun : null;
    const planSlides = deckPlanSlides(deckPlan);
    const slideCount = planSlides.length;

    if (!deckPlan || !slideCount) {
      throw new Error("Expected an approved outline before retrying a slide");
    }
    if (!run || !Array.isArray(run.slides) || run.id === "") {
      throw new Error("No content run is available to retry");
    }
    if (run.status === "running") {
      throw new Error("Generation is already running");
    }

    const requestedIndex = Number.isFinite(Number(body.slideIndex)) ? Number(body.slideIndex) : null;
    const failedIndex = run.failedSlideIndex === null || run.failedSlideIndex === undefined ? null : Number(run.failedSlideIndex);
    const startIndex = requestedIndex !== null
      ? Math.max(0, Math.min(slideCount - 1, requestedIndex))
      : failedIndex !== null
        ? Math.max(0, Math.min(slideCount - 1, failedIndex))
        : 0;

    const runSlides = run.slides.filter(isContentRunSlide);
    const seedSlides = runSlides.slice(0, startIndex);
    if (!seedSlides.every((slide: ContentRunSlide) => slide.status === "complete" && isSlideSpecPayload(slide.slideSpec))) {
      throw new Error("Retry slide requires completed slides before the retry point");
    }

    const seedSlideSpecs = seedSlides.map((slide: ContentRunSlide) => slide.slideSpec).filter(isSlideSpecPayload);
    const collectMediaIds = (spec: SlideSpecPayload): string[] => {
      const ids: string[] = [];
      if (isJsonObject(spec.media) && typeof spec.media.id === "string") {
        ids.push(spec.media.id);
      }
      if (Array.isArray(spec.mediaItems)) {
        spec.mediaItems.forEach((item: unknown) => {
          if (isJsonObject(item) && typeof item.id === "string") {
            ids.push(item.id);
          }
        });
      }
      return ids;
    };
    const usedMaterialIds = seedSlideSpecs.flatMap(collectMediaIds).filter(Boolean);

    resetPresentationRuntime();
    const reportProgress = createWorkflowProgressReporter({
      operation: "retry-presentation-slide"
    });
    reportProgress({
      message: `Retrying slide ${startIndex + 1}/${slideCount}...`,
      stage: "retrying-slide"
    });

    const timestamp = new Date().toISOString();
    const runId = `content-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextSlides: ContentRunSlide[] = Array.from({ length: slideCount }, (_unused: unknown, index: number) => {
      if (index < startIndex) {
        const seed = seedSlides[index];
        return {
          error: null,
          slideContext: seed ? seed.slideContext || null : null,
          slideSpec: seed && isSlideSpecPayload(seed.slideSpec) ? seed.slideSpec : null,
          status: "complete"
        };
      }
      return {
        error: null,
        slideContext: null,
        slideSpec: null,
        status: "pending"
      };
    });

    const draft = savePresentationCreationDraft({
      ...current,
      contentRun: {
        completed: startIndex,
        failedSlideIndex: null,
        id: runId,
        materials: run.materials || [],
        sourceText: run.sourceText || "",
        slideCount,
        slides: nextSlides,
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp
      },
      stage: "content"
    });
    publishCreationDraftUpdate(draft);

    createJsonResponse(res, 202, {
      creationDraft: draft,
      runtime: serializeRuntimeState()
    });

    const runGeneration = async (): Promise<void> => {
      try {
        const generationMaterials = Array.isArray(run.materials) && run.materials.length ? run.materials.filter(isMaterialPayload) : [];

        const draftFields: GenerationDraftFields = {
          ...normalizeCreationFields(isJsonObject(current) ? jsonObjectOrEmpty(current.fields) : {}),
          includeActiveMaterials: false,
          includeActiveSources: false,
          onProgress: undefined,
          presentationMaterials: generationMaterials,
          presentationSourceText: String(run.sourceText || "")
        };

        const contentRunState = (next: ContentRunPatch): unknown => {
          const latest = getPresentationCreationDraft();
          const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!latestRun || latestRun.id !== runId) {
            return null;
          }

          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...latestRun,
              ...next,
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
          return nextDraft;
        };

        const shouldStop = (): boolean => {
          const latest = getPresentationCreationDraft();
          const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          return Boolean(latestRun && latestRun.id === runId && latestRun.stopRequested === true);
        };

        const setSlideState = (index: number, next: ContentRunSlide): unknown => {
          const latest = getPresentationCreationDraft();
          const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) ? latest.contentRun : null;
          if (!latestRun || latestRun.id !== runId || !Array.isArray(latestRun.slides)) {
            return null;
          }

          const slides = latestRun.slides.filter(isContentRunSlide).map((slide: ContentRunSlide, idx: number) => idx === index ? { ...slide, ...next } : slide);
          const completed = slides.filter((slide: ContentRunSlide) => slide.status === "complete").length;
          return contentRunState({
            completed,
            slides
          });
        };

        const reportProgressWithRun = (progress: GenerationProgressPayload): void => {
          const slideIndex = Number(progress.slideIndex);
          if (
            progress
            && progress.stage === "drafting-slide"
            && Number.isFinite(slideIndex)
            && slideIndex >= 1
            && slideIndex <= slideCount
          ) {
            setSlideState(slideIndex - 1, { status: "generating", error: null });
          }

          reportProgress({
            ...progress,
            stage: typeof progress.stage === "string" ? progress.stage : "running"
          });
        };
        draftFields.onProgress = reportProgressWithRun;

        const generated = await generatePresentationFromDeckPlanIncremental(draftFields, deckPlan, {}, {
          initialGeneratedPlanSlides: [],
          initialSlideSpecs: seedSlideSpecs,
          onSlide: async (payload: unknown): Promise<void> => {
            const partial = jsonObjectOrEmpty(payload) as GeneratedPartialSlidePayload;
            const slideIndex = Number(partial.slideIndex);
            const slideCountProgress = Number(partial.slideCount);
            const slideIndexZero = slideIndex - 1;
            const validatedSpec = jsonObjectOrEmpty(validateSlideSpec(partial.slideSpec));
            const contextKey = `slide-${String(slideIndex).padStart(2, "0")}`;
            const partialContexts = isJsonObject(partial.slideContexts) ? partial.slideContexts : {};
            setSlideState(slideIndexZero, {
              slideContext: partialContexts[contextKey] || null,
              slideSpec: validatedSpec,
              status: "complete"
            });
            reportProgress({
              message: `Completed slide ${slideIndex}/${slideCountProgress}.`,
              slideCount: slideCountProgress,
              slideIndex,
              stage: "completed-slide"
            });
          },
          startIndex,
          usedMaterialIds: new Set(usedMaterialIds),
          shouldStop
        });

        reportProgress({
          message: "Finalizing generated slides into deck files...",
          stage: "finalizing"
        });

        const presentation = createPresentation({
          ...(isJsonObject(current) && isJsonObject(current.fields) ? current.fields : {}),
          outline: deckPlan.outline || "",
          targetSlideCount: slideCount,
          title: isJsonObject(current) && isJsonObject(current.fields) && current.fields.title ? current.fields.title : "slideotter"
        });
        createOutlinePlanFromDeckPlan(presentation.id, deckPlan, {
          audience: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.audience : undefined,
          name: "Approved retried creation outline",
          objective: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.objective : undefined,
          purpose: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.objective : undefined,
          targetSlideCount: slideCount,
          title: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.title : undefined,
          tone: isJsonObject(current) && isJsonObject(current.fields) ? current.fields.tone : undefined
        });
        setActivePresentation(presentation.id);

        const importedMaterials: MaterialPayload[] = [];
        const starterGenerationMaterials = generationMaterials.filter((material: MaterialPayload) => material.dataUrl);
        starterGenerationMaterials.forEach((material: MaterialPayload) => {
          importedMaterials.push(createMaterialFromDataUrl({
            alt: material.alt,
            caption: material.caption,
            dataUrl: material.dataUrl,
            fileName: material.fileName,
            id: material.id,
            title: material.title
          }));
        });

        const remoteMaterials = generationMaterials.filter((material: MaterialPayload) => material.url && !material.dataUrl);
        for (const material of remoteMaterials) {
          try {
            importedMaterials.push(await createMaterialFromRemoteImage({
              alt: material.alt,
              caption: material.caption,
              creator: material.creator,
              id: material.id,
              license: material.license,
              licenseUrl: material.licenseUrl,
              provider: material.provider,
              sourceUrl: material.sourceUrl,
              title: material.title,
              url: material.url
            }));
          } catch (error) {
            // Ignore import failures.
          }
        }

        if (run.sourceText) {
          await createSource({
            text: run.sourceText,
            title: "Starter sources"
          });
        }

        const materialUrlById = new Map(importedMaterials.map((material: MaterialPayload) => [String(material.id || ""), material.url]));
        const slideSpecs = Array.isArray(generated.slideSpecs)
          ? generated.slideSpecs.map((slideSpec: unknown) => replaceMaterialUrlsInSlideSpec(slideSpec, materialUrlById))
          : [];
        regeneratePresentationSlides(presentation.id, slideSpecs, {
          outline: generated.outline,
          slideContexts: generated.slideContexts,
          targetSlideCount: generated.targetSlideCount
        });

        const nextDraft = savePresentationCreationDraft({
          ...getPresentationCreationDraft(),
          contentRun: null,
          createdPresentationId: presentation.id,
          stage: "content"
        });
        publishCreationDraftUpdate(nextDraft);

        updateWorkflowState({
          generation: generated.generation,
          message: generated.summary,
          ok: true,
          operation: "retry-presentation-slide",
          stage: "completed",
          status: "completed"
        });
        runtimeState.lastError = null;
        runtimeState.sourceRetrieval = generated.retrieval || null;
        publishRuntimeState();
        const resetDraft = clearPresentationCreationDraft();
        publishCreationDraftUpdate(resetDraft);
      } catch (error) {
        const latest = getPresentationCreationDraft();
        const latestRun = isJsonObject(latest) && isContentRunState(latest.contentRun) && latest.contentRun.id === runId ? latest.contentRun : null;
        if (errorCode(error) === "CONTENT_RUN_STOPPED") {
          if (latestRun && Array.isArray(latestRun.slides)) {
            const nextDraft = savePresentationCreationDraft({
              ...latest,
              contentRun: {
                ...latestRun,
                status: "stopped",
                stopRequested: false,
                updatedAt: new Date().toISOString()
              }
            });
            publishCreationDraftUpdate(nextDraft);
          }

          updateWorkflowState({
            message: "Slide generation stopped. Completed slides are kept.",
            ok: false,
            operation: "retry-presentation-slide",
            stage: "stopped",
            status: "stopped"
          });
          publishRuntimeState();
          return;
        }

        if (latestRun && Array.isArray(latestRun.slides)) {
          const latestSlides = latestRun.slides.filter(isContentRunSlide);
          const firstIncomplete = latestSlides.findIndex((slide: ContentRunSlide) => slide.status !== "complete");
          const failedIndexNext = firstIncomplete >= 0 ? firstIncomplete : null;
          const diagnostic = writeGenerationErrorDiagnostic(error, {
            deckTitle: isJsonObject(current) && isJsonObject(current.fields) && current.fields.title ? current.fields.title : "",
            operation: "retry-presentation-slide",
            planSlide: failedIndexNext === null ? null : planSlides[failedIndexNext] || null,
            runId,
            slideCount,
            slideIndex: failedIndexNext,
            workflow: runtimeState.workflow
          });
          const slides = latestSlides.map((slide: ContentRunSlide, index: number) => {
            if (failedIndexNext === index) {
              return {
                ...slide,
                error: errorMessage(error),
                errorLogPath: diagnostic.filePath,
                status: "failed"
              };
            }
            return slide;
          });
          const nextDraft = savePresentationCreationDraft({
            ...latest,
            contentRun: {
              ...latestRun,
              failedSlideIndex: failedIndexNext,
              slides,
              status: "failed",
              updatedAt: new Date().toISOString()
            }
          });
          publishCreationDraftUpdate(nextDraft);
        }

        updateWorkflowState({
          message: errorMessage(error),
          ok: false,
          operation: "retry-presentation-slide",
          stage: "failed",
          status: "failed"
        });
        publishRuntimeState();
      }
    };

    runGeneration();
  }

  async function handlePresentationDraftContentStop(res: ServerResponse): Promise<void> {
    const current = getPresentationCreationDraft();
    const run = jsonObjectOrEmpty(current && current.contentRun);
    if (!run || run.status !== "running") {
      createJsonResponse(res, 200, {
        creationDraft: current,
        runtime: serializeRuntimeState()
      });
      return;
    }

    const nextDraft = savePresentationCreationDraft({
      ...current,
      contentRun: {
        ...run,
        stopRequested: true,
        updatedAt: new Date().toISOString()
      }
    });
    publishCreationDraftUpdate(nextDraft);
    updateWorkflowState({
      message: "Stopping slide generation after the current slide...",
      ok: false,
      operation: runtimeState.workflow && runtimeState.workflow.operation || "create-presentation-from-outline",
      stage: "stopping",
      status: "running"
    });

    createJsonResponse(res, 202, {
      creationDraft: nextDraft,
      runtime: serializeRuntimeState()
    });
  }

  return {
    handlePresentationDraftContentAcceptPartial,
    handlePresentationDraftContentRetry,
    handlePresentationDraftContentStop,
    handlePresentationDraftCreate
  };
}
