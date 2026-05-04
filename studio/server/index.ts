import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as ts from "typescript";
import { URL } from "url";
import { fileURLToPath } from "url";
import { loadEnvFiles } from "./services/env.ts";

loadEnvFiles();

import { getAssistantSession, getAssistantSuggestions } from "./services/assistant.ts";
import { getPreviewManifest } from "./services/build.ts";
import {
  importContentRunArtifacts,
  replaceMaterialUrlsInSlideSpec
} from "./services/content-run-artifacts.ts";
import { getDomPreviewState, renderDomPreviewDocument, renderPresentationPreviewDocument } from "./services/dom-preview.ts";
import { writeGenerationErrorDiagnostic } from "./services/generation-diagnostics.ts";
import { searchImages } from "./services/image-search.ts";
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
  readFavoriteLayouts,
  readLayouts
} from "./services/layouts.ts";
import { getLlmStatus } from "./services/llm/client.ts";
import { listCustomVisuals } from "./services/custom-visuals.ts";
import { createMaterialFromDataUrl, createMaterialFromRemoteImage, getMaterialFilePath, listMaterials } from "./services/materials.ts";
import { clientDistDir, outputDir } from "./services/paths.ts";
import {
  createPresentation,
  createOutlinePlanFromDeckPlan,
  clearPresentationCreationDraft,
  getPresentationPaths,
  getPresentationCreationDraft,
  listOutlinePlans,
  listSavedThemes,
  listPresentations,
  readPresentationSummary,
  regeneratePresentationSlides,
  savePresentationCreationDraft,
  setActivePresentation
} from "./services/presentations.ts";
import {
  generatePresentationFromDeckPlanIncremental
} from "./services/presentation-generation.ts";
import { ensureState, getDeckContext } from "./services/state.ts";
import { getSlide, getSlides, readSlideSource, readSlideSpec } from "./services/slides.ts";
import { validateSlideSpec } from "./services/slide-specs/index.ts";
import { createBuildValidationHandlers } from "./build-validation-handlers.ts";
import { createBuildValidationApiRoutes } from "./build-validation-routes.ts";
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
import { buildActionDescriptors } from "./services/selection-scope.ts";
import { createSource, listSources } from "./services/sources.ts";
import { createThemeHandlers } from "./theme-handlers.ts";
import { createOperationHandlers } from "./operation-handlers.ts";
import { createOutlinePlanHandlers } from "./outline-plan-handlers.ts";
import { createSlideEditHandlers } from "./slide-edit-handlers.ts";
import { createAssistantHandlers } from "./assistant-handlers.ts";
import {
  getVariantStorageStatus,
  listAllVariants,
  listVariantsForSlide
} from "./services/variants.ts";

const defaultPort = Number(process.env.PORT || 4173);
const defaultHost = process.env.HOST || "127.0.0.1";

type SseSubscriber = {
  end: () => unknown;
  write: (chunk: string) => unknown;
};

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSummary = JsonObject & {
  archived?: unknown;
  id?: unknown;
  index?: unknown;
  skipped?: unknown;
};

type SlideSpecPayload = JsonObject & {
  layout?: unknown;
  media?: JsonObject;
  type?: unknown;
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

type WorkflowEvent = JsonObject & {
  id?: number;
  message?: string;
  operation?: string;
  slideId?: string | null;
  stage?: string;
  status?: string;
  updatedAt?: string;
};

type WorkflowProgress = JsonObject & {
  llm?: {
    promptBudget?: JsonObject;
  };
  message?: string;
  operation?: string;
  slideId?: string | null;
  stage?: string;
  status?: string;
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

type RuntimeState = {
  build: {
    ok: boolean;
    updatedAt: string | null;
  };
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  llmCheck: unknown;
  promptBudget: JsonObject | null;
  sourceRetrieval: unknown;
  validation: JsonObject | null;
  workflow: WorkflowEvent | null;
  workflowHistory: WorkflowEvent[];
  workflowSequence: number;
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

function isMaterialPayload(value: unknown): value is MaterialPayload {
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

function isContentRunSlide(value: unknown): value is ContentRunSlide {
  return isJsonObject(value);
}

function isContentRunState(value: unknown): value is ContentRunState {
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

const runtimeState: RuntimeState = {
  build: {
    ok: false,
    updatedAt: null
  },
  lastError: null,
  llmCheck: null,
  promptBudget: null,
  sourceRetrieval: null,
  validation: null,
  workflow: null,
  workflowHistory: [],
  workflowSequence: 0
};
const runtimeSubscribers: Set<SseSubscriber> = new Set();

function writeSseEvent(res: SseSubscriber, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function publishCreationDraftUpdate(draft: unknown): void {
  const payload = {
    creationDraft: draft
  };

  for (const subscriber of runtimeSubscribers) {
    try {
      writeSseEvent(subscriber, "creationDraft", payload);
    } catch (error) {
      runtimeSubscribers.delete(subscriber);
      try {
        subscriber.end();
      } catch (endError) {
        // Ignore subscriber cleanup failures.
      }
    }
  }
}

function publishRuntimeState(): void {
  const payload = {
    runtime: serializeRuntimeState()
  };

  for (const subscriber of runtimeSubscribers) {
    try {
      writeSseEvent(subscriber, "runtime", payload);
    } catch (error) {
      runtimeSubscribers.delete(subscriber);
      try {
        subscriber.end();
      } catch (endError) {
        // Ignore subscriber cleanup failures.
      }
    }
  }
}

function publishWorkflowEvent(event: WorkflowEvent): void {
  const payload = {
    workflowEvent: event
  };

  for (const subscriber of runtimeSubscribers) {
    try {
      writeSseEvent(subscriber, "workflow", payload);
    } catch (error) {
      runtimeSubscribers.delete(subscriber);
      try {
        subscriber.end();
      } catch (endError) {
        // Ignore subscriber cleanup failures.
      }
    }
  }
}

function recordWorkflowEvent(workflow: WorkflowEvent | null): void {
  if (!workflow || !workflow.status) {
    return;
  }

  const previous = runtimeState.workflowHistory[runtimeState.workflowHistory.length - 1] || null;
  const nextEvent = {
    id: ++runtimeState.workflowSequence,
    message: workflow.message || "",
    operation: workflow.operation || "",
    slideId: workflow.slideId || null,
    stage: workflow.stage || "",
    status: workflow.status,
    updatedAt: workflow.updatedAt || new Date().toISOString()
  };

  if (
    previous
    && previous.message === nextEvent.message
    && previous.operation === nextEvent.operation
    && previous.slideId === nextEvent.slideId
    && previous.stage === nextEvent.stage
    && previous.status === nextEvent.status
  ) {
    return;
  }

  runtimeState.workflowHistory = [
    ...runtimeState.workflowHistory.slice(-11),
    nextEvent
  ];
  publishWorkflowEvent(nextEvent);
}

function updateWorkflowState(nextWorkflow: WorkflowEvent): void {
  runtimeState.workflow = {
    ...(runtimeState.workflow || {}),
    ...nextWorkflow,
    updatedAt: new Date().toISOString()
  };
  recordWorkflowEvent(runtimeState.workflow);
  publishRuntimeState();
}

function createWorkflowProgressReporter(baseState: WorkflowEvent): (progress: WorkflowProgress) => void {
  return (progress: WorkflowProgress): void => {
    if (progress && progress.llm && progress.llm.promptBudget) {
      runtimeState.promptBudget = {
        ...progress.llm.promptBudget,
        updatedAt: new Date().toISOString()
      };
    }

    updateWorkflowState({
      ...baseState,
      ok: false,
      status: "running",
      ...progress
    });
  };
}

function serializeRuntimeState(): JsonObject {
  const llm = getLlmStatus();
  return {
    ...runtimeState,
    llm: {
      ...llm,
      lastCheck: runtimeState.llmCheck
    },
    workflowHistory: runtimeState.workflowHistory
  };
}

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

function getWorkspaceState() {
  return {
    assistant: {
      actions: buildActionDescriptors(),
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    domPreview: getStudioDomPreviewState(),
    creationDraft: getPresentationCreationDraft(),
    favoriteLayouts: readFavoriteLayouts().layouts,
    layouts: readLayouts().layouts,
    materials: listMaterials(),
    customVisuals: listCustomVisuals(),
    outlinePlans: listOutlinePlans(),
    presentations: listPresentations(),
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide: SlideSummary) => slide.skipped && !slide.archived),
    slides: getSlides(),
    sources: listSources(),
    savedThemes: listSavedThemes(),
    variantStorage: getVariantStorageStatus(),
    variants: listAllVariants()
  };
}

function getStudioDomPreviewState() {
  return getDomPreviewState({ includeDetours: true });
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

function resetPresentationRuntime(): void {
  runtimeState.build = {
    ok: false,
    updatedAt: null
  };
  runtimeState.lastError = null;
  runtimeState.validation = null;
  runtimeState.sourceRetrieval = null;
  runtimeState.promptBudget = null;
  runtimeState.workflow = null;
  runtimeState.workflowHistory = [];
  runtimeState.workflowSequence = 0;
  publishRuntimeState();
}

function createPresentationPayload(extra: JsonObject = {}): JsonObject {
  return {
    ...extra,
    ...getWorkspaceState()
  };
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

  const slugify = (value: unknown, fallback: string): string => {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
    return slug || fallback;
  };

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

  const runGeneration = async () => {
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
    handlePresentationDraftContentAcceptPartial: (_req, res) => handlePresentationDraftContentAcceptPartial(res),
    handlePresentationDraftContentRetry,
    handlePresentationDraftContentStop: (_req, res) => handlePresentationDraftContentStop(res),
    handlePresentationDraftCreate,
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
    res.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8"
    });
    res.write("retry: 1000\n\n");
    runtimeSubscribers.add(res);
    writeSseEvent(res, "runtime", {
      runtime: serializeRuntimeState()
    });
    writeSseEvent(res, "creationDraft", {
      creationDraft: getPresentationCreationDraft()
    });
    const heartbeat = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      runtimeSubscribers.delete(res);
    });
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
