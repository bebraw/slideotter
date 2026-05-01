const fs = require("fs");
const http = require("http");
const path = require("path");
const ts = require("typescript");
const { URL } = require("url");
const { loadEnvFiles } = require("./services/env.ts");

loadEnvFiles();

const { getAssistantSession, getAssistantSuggestions, handleAssistantMessage } = require("./services/assistant.ts");
const { buildAndRenderDeck, getPreviewManifest } = require("./services/build.ts");
const { getDomPreviewState, renderDomPreviewDocument, renderPresentationPreviewDocument } = require("./services/dom-preview.ts");
const { writeGenerationErrorDiagnostic } = require("./services/generation-diagnostics.ts");
const { importImageSearchResults, searchImages } = require("./services/image-search.ts");
const {
  assertBaseVersion,
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
  createSlideWorkflowResource,
  getPresentationVersion,
  getSlideVersion
} = require("./services/hypermedia.ts");
const {
  applyLayoutToSlideSpec,
  createCustomLayoutDraftDefinition,
  deleteFavoriteLayout,
  exportDeckLayout,
  exportDeckLayoutPack,
  exportFavoriteLayout,
  exportFavoriteLayoutPack,
  importDeckLayout,
  importDeckLayoutPack,
  importFavoriteLayout,
  importFavoriteLayoutPack,
  readFavoriteLayouts,
  readLayouts,
  saveFavoriteLayout,
  saveFavoriteLayoutFromDeckLayout,
  saveLayoutFromSlideSpec
} = require("./services/layouts.ts");
const { getLlmStatus, verifyLlmConnection } = require("./services/llm/client.ts");
const { createCustomVisual, hydrateCustomVisualSlideSpec, getCustomVisual, listCustomVisuals } = require("./services/custom-visuals.ts");
const { createMaterialFromDataUrl, createMaterialFromRemoteImage, getMaterial, getMaterialFilePath, listMaterials } = require("./services/materials.ts");
const { clientDistDir, outputDir } = require("./services/paths.ts");
const {
  archiveOutlinePlan,
  createPresentation,
  createOutlinePlanFromDeckPlan,
  createOutlinePlanFromPresentation,
  deletePresentation,
  deleteOutlinePlan,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  duplicatePresentation,
  clearPresentationCreationDraft,
  getOutlinePlan,
  getPresentationPaths,
  getPresentationCreationDraft,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  listSavedThemes,
  listPresentations,
  proposeDeckChangesFromOutlinePlan,
  readPresentationDeckContext,
  readPresentationSummary,
  regeneratePresentationSlides,
  savePresentationCreationDraft,
  saveOutlinePlan,
  saveRuntimeTheme,
  setActivePresentation
} = require("./services/presentations.ts");
const {
  generateInitialDeckPlan,
  generateInitialPresentation,
  generatePresentationFromDeckPlan,
  generatePresentationFromDeckPlanIncremental
} = require("./services/presentation-generation.ts");
const { applyDeckStructurePlan, ensureState, getDeckContext, updateDeckFields, updateSlideContext } = require("./services/state.ts");
const { archiveStructuredSlide, getSlide, getSlides, insertStructuredSlide, readSlideSource, readSlideSpec, writeSlideSource, writeSlideSpec } = require("./services/slides.ts");
const { validateSlideSpec } = require("./services/slide-specs/index.ts");
const {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent,
  buildActionDescriptors,
  normalizeSelectionScope
} = require("./services/selection-scope.ts");
const { createSource, deleteSource, listSources } = require("./services/sources.ts");
const { applyDeckLengthPlan, planDeckLengthSemantic, restoreSkippedSlides } = require("./services/deck-length.ts");
const { applyDeckStructureCandidate, authorCustomLayoutSlide, drillSelectionWordingSlide, drillWordingSlide, ideateDeckStructure, ideateStructureSlide, ideateThemeSlide, ideateSlide, remediateCheckIssue, redoLayoutSlide } = require("./services/operations.ts");
const { generateThemeCandidates } = require("./services/theme-candidates.ts");
const { generateThemeFromBrief } = require("./services/theme-generation.ts");
const { validateDeck } = require("./services/validate.ts");
const { validateSlideSpecInDom } = require("./services/dom-validate.ts");
const {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listAllVariants,
  listVariantsForSlide,
  migrateLegacyStructuredVariants
} = require("./services/variants.ts");

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
  type?: unknown;
};

type LayoutImportDocument = JsonObject & {
  kind?: unknown;
  layouts?: unknown;
};

type LayoutPreviewPayload = JsonObject & {
  currentSlideValidation?: unknown;
  mode?: unknown;
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
  onProgress: ((progress: GenerationProgressPayload) => void) | null;
  presentationMaterials: MaterialPayload[];
  presentationSourceText: string;
};

type PlaceholderDeck = {
  slideContexts: JsonObject;
  slideSpecs: SlideSpecPayload[];
};

type ManualSlideInput = {
  targetIndex: number;
  title: unknown;
};

type ManualSystemSlideInput = ManualSlideInput & {
  summary: unknown;
};

type ManualQuoteSlideInput = ManualSlideInput & {
  quote: unknown;
};

type ManualPhotoSlideInput = ManualSlideInput & {
  caption: unknown;
  materialId: unknown;
};

type ManualPhotoGridSlideInput = ManualSlideInput & {
  caption: unknown;
  materialIds: unknown;
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

function isLayoutImportDocument(value: unknown): value is LayoutImportDocument {
  return isJsonObject(value);
}

function isLayoutPreviewPayload(value: unknown): value is LayoutPreviewPayload {
  return isJsonObject(value);
}

function isStarterMaterialPayload(value: unknown): value is StarterMaterialPayload {
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

type LockedOutlineContextOptions = {
  excludeIndex?: number;
};

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
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp"
  };
  const contentType = contentTypes[ext] || "application/octet-stream";

  const stream = fs.createReadStream(fileName);
  res.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType
  });
  stream.pipe(res);
}

function getWorkspaceState() {
  const variantMigration = migrateLegacyStructuredVariants();
  return {
    assistant: {
      actions: buildActionDescriptors(),
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    domPreview: getDomPreviewState(),
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
    variantStorage: {
      ...getVariantStorageStatus(),
      migratedThisLoad: variantMigration.migrated
    },
    variants: listAllVariants()
  };
}

async function handleLayoutSave(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const slideId = typeof body.slideId === "string" ? body.slideId : "";
  if (!slideId) {
    throw new Error("Expected slideId when saving a layout");
  }

  const slideSpec = readSlideSpec(slideId);
  const saved = saveLayoutFromSlideSpec(slideSpec, {
    description: body.description,
    name: body.name
  });
  publishRuntimeState();

  createJsonResponse(res, 200, {
    layout: saved.layout,
    layouts: saved.state.layouts
  });
}

async function handleFavoriteLayoutSave(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  if (!layoutId) {
    throw new Error("Expected layoutId when saving a favorite layout");
  }

  const saved = saveFavoriteLayoutFromDeckLayout(layoutId);
  publishRuntimeState();

  createJsonResponse(res, 200, {
    favoriteLayout: saved.layout,
    favoriteLayouts: saved.state.layouts
  });
}

async function handleLayoutCandidateSave(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const slideSpec = isSlideSpecPayload(body.slideSpec)
    ? body.slideSpec
    : null;
  if (!slideSpec) {
    throw new Error("Expected slideSpec when saving a layout candidate");
  }

  const name = typeof body.name === "string" && body.name.trim()
    ? body.name.trim()
    : `${slideSpec.layout || "standard"} ${slideSpec.type || "slide"}`;
  const description = typeof body.description === "string" && body.description.trim()
    ? body.description.trim()
    : `Saved from generated layout candidate "${name}".`;
  const deckSaved = saveLayoutFromSlideSpec(slideSpec, {
    description,
    definition: body.layoutDefinition,
    name
  });
  let favoriteSaved = null;

  if (body.favorite === true) {
    const layoutPreview = isLayoutPreviewPayload(body.layoutPreview)
      ? body.layoutPreview
      : null;
    if (body.operation === "custom-layout" && (!layoutPreview || layoutPreview.mode !== "multi-slide")) {
      throw new Error("Favorite custom layouts require a multi-slide preview");
    }
    const currentSlideValidation = layoutPreview && isJsonObject(layoutPreview.currentSlideValidation)
      ? layoutPreview.currentSlideValidation
      : null;
    if (
      body.operation === "custom-layout"
      && (!currentSlideValidation || currentSlideValidation.ok !== true)
    ) {
      throw new Error("Favorite custom layouts require a passing current-slide validation preview");
    }
    favoriteSaved = saveFavoriteLayout({
      ...deckSaved.layout,
      id: `favorite-${deckSaved.layout.id}`,
      description: deckSaved.layout.description || description
    });
  }

  publishRuntimeState();
  createJsonResponse(res, 200, {
    favoriteLayout: favoriteSaved ? favoriteSaved.layout : null,
    favoriteLayouts: readFavoriteLayouts().layouts,
    layout: deckSaved.layout,
    layouts: readLayouts().layouts
  });
}

async function handleFavoriteLayoutDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  if (!layoutId) {
    throw new Error("Expected layoutId when deleting a favorite layout");
  }

  const state = deleteFavoriteLayout(layoutId);
  publishRuntimeState();

  createJsonResponse(res, 200, {
    favoriteLayouts: state.layouts
  });
}

async function handleLayoutExport(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  const scope = typeof body.scope === "string" ? body.scope : "deck";
  const pack = body.pack === true;
  if (!layoutId && !pack) {
    throw new Error("Expected layoutId when exporting a layout");
  }

  const document = pack
    ? scope === "favorite"
      ? exportFavoriteLayoutPack()
      : exportDeckLayoutPack()
    : scope === "favorite"
      ? exportFavoriteLayout(layoutId)
      : exportDeckLayout(layoutId);

  createJsonResponse(res, 200, { document });
}

async function handleLayoutImport(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const scope = typeof body.scope === "string" ? body.scope : "deck";
  const document = isLayoutImportDocument(body.document) ? body.document : null;
  if (!document) {
    throw new Error("Expected document when importing a layout");
  }

  const isPack = document.kind === "slideotter.layoutPack" || Array.isArray(document.layouts);
  const saved = scope === "favorite"
    ? isPack
      ? importFavoriteLayoutPack(document, { description: body.description, id: body.id, name: body.name })
      : importFavoriteLayout(document, { description: body.description, id: body.id, name: body.name })
    : isPack
      ? importDeckLayoutPack(document, { description: body.description, id: body.id, name: body.name })
      : importDeckLayout(document, { description: body.description, id: body.id, name: body.name });
  publishRuntimeState();

  createJsonResponse(res, 200, {
    favoriteLayouts: readFavoriteLayouts().layouts,
    layout: saved.layout,
    importedLayouts: Array.isArray(saved.layouts) ? saved.layouts : [saved.layout],
    layouts: readLayouts().layouts
  });
}

async function handleLayoutApply(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const slideId = typeof body.slideId === "string" ? body.slideId : "";
  const layoutId = typeof body.layoutId === "string" ? body.layoutId : "";
  if (!slideId || !layoutId) {
    throw new Error("Expected slideId and layoutId when applying a layout");
  }

  const currentSpec = readSlideSpec(slideId);
  const nextSpec = applyLayoutToSlideSpec(currentSpec, layoutId);
  writeSlideSpec(slideId, nextSpec);
  const structured = describeStructuredSlide(slideId);
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    domPreview: getDomPreviewState(),
    favoriteLayouts: readFavoriteLayouts().layouts,
    layouts: readLayouts().layouts,
    previews: getPreviewManifest(),
    slide: getSlide(slideId),
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
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

async function handleBuild(res: ServerResponse): Promise<void> {
  const result = await buildAndRenderDeck();
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    previews: result.previews,
    runtime: serializeRuntimeState()
  });
}

async function handleValidate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  updateWorkflowState({
    includeRender: body.includeRender === true,
    message: body.includeRender === true
      ? "Running full render validation..."
      : "Running geometry and text validation...",
    ok: false,
    operation: "validate",
    stage: body.includeRender === true ? "validating-render" : "validating-geometry-text",
    status: "running"
  });
  const result = await validateDeck({
    includeRender: body.includeRender === true
  });

  runtimeState.validation = {
    includeRender: body.includeRender === true,
    ok: result.ok,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    includeRender: body.includeRender === true,
    message: result.ok ? "Validation completed without blocking issues." : "Validation completed and found issues.",
    ok: result.ok,
    operation: "validate",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();
  createJsonResponse(res, 200, {
    ...result,
    runtime: serializeRuntimeState()
  });
}

async function handleCheckRemediation(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const slideId = typeof body.slideId === "string" ? body.slideId : "";
  if (!slideId) {
    throw new Error("Expected slideId when creating check remediation candidates");
  }

  const result = await remediateCheckIssue(slideId, {
    blockName: body.blockName,
    issue: body.issue,
    issueIndex: body.issueIndex
  });
  runtimeState.lastError = null;
  publishRuntimeState();
  createJsonResponse(res, 200, {
    ...result,
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    variants: listAllVariants()
  });
}

async function handleLlmCheck(res: ServerResponse): Promise<void> {
  const result = await verifyLlmConnection();
  runtimeState.llmCheck = result;
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    llm: getLlmStatus(),
    result,
    runtime: serializeRuntimeState()
  });
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

async function handlePresentationSelect(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  setActivePresentation(body.presentationId);
  resetPresentationRuntime();
  createJsonResponse(res, 200, createPresentationPayload());
}

async function handlePresentationCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const fields = body;
  const starterSourceText = typeof fields.presentationSourceText === "string"
    ? fields.presentationSourceText.trim()
    : "";
  const starterMaterials = Array.isArray(fields.presentationMaterials)
    ? fields.presentationMaterials.filter(isStarterMaterialPayload)
    : [];
  let presentation = null;
  resetPresentationRuntime();
  const reportProgress = createWorkflowProgressReporter({
    operation: "create-presentation"
  });
  reportProgress({
    message: "Generating initial presentation slides...",
    stage: "generating-slides"
  });
  try {
    presentation = createPresentation({
      ...fields,
      targetSlideCount: fields.targetSlideCount || fields.targetCount
    });

    if (starterSourceText) {
      await createSource({
        text: starterSourceText,
        title: "Starter sources"
      });
    }

    starterMaterials.forEach((material: StarterMaterialPayload) => {
      createMaterialFromDataUrl({
        alt: material.alt || material.title || material.fileName,
        caption: material.caption || "",
        dataUrl: material.dataUrl,
        fileName: material.fileName || material.title || "starter-image",
        title: material.title || material.fileName || "Starter image"
      });
    });

    let imageSearchResult = null;
    if (isImageSearchPayload(fields.imageSearch) && String(fields.imageSearch.query || "").trim()) {
      imageSearchResult = await importImageSearchResults({
          count: fields.imageSearch.count,
          provider: fields.imageSearch.provider,
          query: fields.imageSearch.query,
          restrictions: fields.imageSearch.restrictions
        });
    }

    const generated = await generateInitialPresentation({
      ...fields,
      includeActiveMaterials: true,
      includeActiveSources: true,
      onProgress: reportProgress,
      presentationSourceText: starterSourceText
    });
    presentation = regeneratePresentationSlides(presentation.id, generated.slideSpecs, {
      outline: generated.outline,
      slideContexts: generated.slideContexts,
      targetSlideCount: generated.targetSlideCount
    });
    setActivePresentation(presentation.id);
    updateWorkflowState({
      generation: generated.generation,
      message: [
        generated.summary,
        starterSourceText ? "Starter sources were saved with the new presentation." : "",
        starterMaterials.length ? `${starterMaterials.length} starter image${starterMaterials.length === 1 ? "" : "s"} were saved with the new presentation.` : "",
        imageSearchResult && imageSearchResult.imported.length ? `${imageSearchResult.imported.length} searched image${imageSearchResult.imported.length === 1 ? "" : "s"} were imported from ${imageSearchResult.providerLabel || imageSearchResult.provider}.` : ""
      ].filter(Boolean).join(" "),
      ok: true,
      operation: "create-presentation",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    runtimeState.sourceRetrieval = generated.retrieval || null;
    publishRuntimeState();
    createJsonResponse(res, 200, createPresentationPayload({ presentation }));
  } catch (error) {
    if (presentation && presentation.id) {
      try {
        deletePresentation(presentation.id);
      } catch (_cleanupError) {
        // Leave the original generation failure visible.
      }
    }

    throw error;
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

function normalizeOutlineLocks(value: unknown): Record<string, true> {
  const source = isJsonObject(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([key, locked]) => /^\d+$/.test(key) && locked === true)
    .map(([key]) => [key, true]));
}

function buildDeckPlanOutline(slides: unknown): string {
  return (Array.isArray(slides) ? slides : [])
    .filter(isDeckPlanSlide)
    .map((slide, index) => {
      const title = slide && slide.title ? slide.title : `Slide ${index + 1}`;
      const message = slide && (slide.keyMessage || slide.intent) ? slide.keyMessage || slide.intent : "";
      return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
    })
    .join("\n");
}

function applyLockedOutlineSlides(nextPlan: unknown, previousPlan: unknown, outlineLocks: unknown): DeckPlanPayload {
  const nextDeckPlan = isDeckPlanPayload(nextPlan) ? nextPlan : {};
  const previousDeckPlan = isDeckPlanPayload(previousPlan) ? previousPlan : {};
  const nextSlides = deckPlanSlides(nextDeckPlan);
  const previousSlides = deckPlanSlides(previousDeckPlan);
  const locks = normalizeOutlineLocks(outlineLocks);
  if (!nextSlides.length || !previousSlides.length || !Object.keys(locks).length) {
    return nextDeckPlan;
  }

  const slides = nextSlides.map((slide: DeckPlanSlide, index: number) => {
    const base = locks[String(index)] && previousSlides[index]
      ? { ...previousSlides[index] }
      : slide;

    return {
      ...base,
      sourceNotes: base.sourceNotes || base.sourceText || base.sourceNeed || ""
    };
  });

  return {
    ...nextDeckPlan,
    outline: buildDeckPlanOutline(slides),
    slides
  };
}

function buildLockedOutlineContext(deckPlan: unknown, outlineLocks: unknown, options: LockedOutlineContextOptions = {}): JsonObject[] {
  const slides = deckPlanSlides(deckPlan);
  const locks = normalizeOutlineLocks(outlineLocks);
  return slides
    .map((slide: DeckPlanSlide, index: number) => ({ index, slide }))
    .filter(({ index }) => locks[String(index)] && index !== options.excludeIndex)
    .map(({ index, slide }) => ({
      index,
      intent: slide.intent || "",
      keyMessage: slide.keyMessage || "",
      role: slide.role || "",
      sourceNeed: slide.sourceNeed || "",
      sourceNotes: slide.sourceNotes || slide.sourceText || "",
      title: slide.title || `Slide ${index + 1}`,
      visualNeed: slide.visualNeed || ""
    }));
}

async function handlePresentationDraftSave(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const draft = savePresentationCreationDraft({
    ...current,
    approvedOutline: typeof body.approvedOutline === "boolean" ? body.approvedOutline : current.approvedOutline,
    deckPlan: body.deckPlan || current.deckPlan,
    fields: {
      ...(current.fields || {}),
      ...normalizeCreationFields(isJsonObject(body.fields) ? body.fields : body)
    },
    outlineLocks: body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks,
    outlineDirty: typeof body.outlineDirty === "boolean" ? body.outlineDirty : current.outlineDirty,
    retrieval: body.retrieval || current.retrieval,
    stage: body.stage || current.stage || "brief"
  });

  createJsonResponse(res, 200, {
    creationDraft: draft,
    savedThemes: listSavedThemes()
  });
  publishCreationDraftUpdate(draft);
}

async function handlePresentationDraftOutline(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const fields = normalizeCreationFields(isJsonObject(body.fields) ? body.fields : body);
  if (!fields.title) {
    throw new Error("Expected a presentation title before generating an outline");
  }
  const mergeDeckPlan = (basePlan: unknown, overridePlan: unknown): DeckPlanPayload => {
    const baseDeckPlan = isDeckPlanPayload(basePlan) ? basePlan : {};
    const overrideDeckPlan = isDeckPlanPayload(overridePlan) ? overridePlan : {};
    const baseSlides = deckPlanSlides(baseDeckPlan);
    const overrideSlides = deckPlanSlides(overrideDeckPlan);
    if (!baseSlides.length) {
      return Object.keys(overrideDeckPlan).length ? overrideDeckPlan : baseDeckPlan;
    }
    if (!overrideSlides.length) {
      return baseDeckPlan;
    }

    const maxSlides = Math.max(baseSlides.length, overrideSlides.length);
    const slides = Array.from({ length: maxSlides }, (_unused, index) => ({
      ...(baseSlides[index] || {}),
      ...(overrideSlides[index] || {})
    }));

    return {
      ...baseDeckPlan,
      ...overrideDeckPlan,
      outline: overrideDeckPlan.outline || baseDeckPlan.outline || "",
      slides,
      thesis: overrideDeckPlan.thesis || baseDeckPlan.thesis || "",
      narrativeArc: overrideDeckPlan.narrativeArc || baseDeckPlan.narrativeArc || ""
    };
  };

  const previousDeckPlan = mergeDeckPlan(current.deckPlan, body.deckPlan || current.deckPlan);
  const outlineLocks = normalizeOutlineLocks(body.outlineLocks || current.outlineLocks);
  const lockedSlides = buildLockedOutlineContext(previousDeckPlan, outlineLocks);
  const previousSlides = deckPlanSlides(previousDeckPlan);
  if (previousSlides.length && lockedSlides.length >= previousSlides.length) {
    throw new Error("Unlock at least one outline slide before regenerating.");
  }

  const reportProgress = createWorkflowProgressReporter({
    operation: "plan-presentation-outline"
  });
  reportProgress({
    message: "Planning staged presentation outline...",
    stage: "planning-outline"
  });

  const result = await generateInitialDeckPlan({
    ...fields,
    lockedOutlineSlides: lockedSlides,
    onProgress: reportProgress
  });
  const deckPlan = applyLockedOutlineSlides(result.plan, previousDeckPlan, outlineLocks);
  const deckPlanSlideCount = deckPlanSlides(deckPlan).length;
  const draft = savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan,
    fields,
    outlineLocks,
    outlineDirty: false,
    retrieval: result.retrieval,
    stage: "structure"
  });
  updateWorkflowState({
    generation: result.generation,
    message: `Generated an outline with ${deckPlanSlideCount} slide${deckPlanSlideCount === 1 ? "" : "s"}. Approve it before creating slides.`,
    ok: true,
    operation: "plan-presentation-outline",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  runtimeState.sourceRetrieval = result.retrieval || null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    creationDraft: draft,
    deckPlan,
    retrieval: result.retrieval,
    runtime: serializeRuntimeState()
  });
  publishCreationDraftUpdate(draft);
}

async function handlePresentationDraftOutlineSlide(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const sourceDeckPlan = isDeckPlanPayload(body.deckPlan) ? body.deckPlan : isDeckPlanPayload(current.deckPlan) ? current.deckPlan : {};
  const slides = deckPlanSlides(sourceDeckPlan);
  const slideIndex = Number.parseInt(String(body.slideIndex), 10);
  if (!slides.length || !Number.isFinite(slideIndex) || slideIndex < 0 || slideIndex >= slides.length) {
    throw new Error("Expected a valid outline slide to regenerate");
  }

  const fields = {
    ...normalizeCreationFields({
      ...(current.fields || {}),
      ...(isJsonObject(body.fields) ? body.fields : {})
    }),
    targetSlideCount: slides.length
  };
  if (!fields.title) {
    throw new Error("Expected a presentation title before regenerating an outline slide");
  }

  const reportProgress = createWorkflowProgressReporter({
    operation: "regenerate-outline-slide"
  });
  reportProgress({
    message: `Regenerating outline slide ${slideIndex + 1}...`,
    stage: "planning-outline-slide"
  });

  const keepLocks = Object.fromEntries(slides.map((_slide: DeckPlanSlide, index: number) => [String(index), index !== slideIndex]));
  const result = await generateInitialDeckPlan({
    ...fields,
    lockedOutlineSlides: buildLockedOutlineContext(sourceDeckPlan, keepLocks, { excludeIndex: slideIndex }),
    onProgress: reportProgress
  });
  const generatedSlides = deckPlanSlides(result.plan);
  const replacement = generatedSlides[slideIndex];
  if (!replacement) {
    throw new Error("Regenerated outline did not include the requested slide");
  }

  const nextSlides = slides.map((slide: DeckPlanSlide, index: number) => index === slideIndex ? replacement : slide);
  const deckPlan = {
    ...sourceDeckPlan,
    narrativeArc: result.plan.narrativeArc || sourceDeckPlan.narrativeArc,
    outline: buildDeckPlanOutline(nextSlides),
    slides: nextSlides,
    thesis: result.plan.thesis || sourceDeckPlan.thesis
  };
  const draft = savePresentationCreationDraft({
    ...current,
    approvedOutline: false,
    deckPlan,
    fields,
    outlineDirty: false,
    retrieval: result.retrieval,
    stage: "structure"
  });

  updateWorkflowState({
    generation: result.generation,
    message: `Regenerated outline slide ${slideIndex + 1}.`,
    ok: true,
    operation: "regenerate-outline-slide",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  runtimeState.sourceRetrieval = result.retrieval || null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    creationDraft: draft,
    deckPlan,
    retrieval: result.retrieval,
    runtime: serializeRuntimeState()
  });
  publishCreationDraftUpdate(draft);
}

async function handlePresentationDraftApprove(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const outlineLocks = body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks;
  const sourceDeckPlan = isDeckPlanPayload(current.deckPlan) ? current.deckPlan : isDeckPlanPayload(body.deckPlan) ? body.deckPlan : {};
  if (!deckPlanSlides(sourceDeckPlan).length) {
    throw new Error("Expected a generated outline before approval");
  }

  const deckPlan = applyLockedOutlineSlides(sourceDeckPlan, current.deckPlan, outlineLocks);
  const draft = savePresentationCreationDraft({
    ...current,
    approvedOutline: true,
    deckPlan,
    outlineLocks,
    outlineDirty: false,
    stage: "content"
  });

  createJsonResponse(res, 200, {
    creationDraft: draft
  });
  publishCreationDraftUpdate(draft);
}

function activePresentationIdFromBody(body: JsonObject): string {
  const presentations = listPresentations();
  return typeof body.presentationId === "string" && body.presentationId
    ? body.presentationId
    : presentations.activePresentationId;
}

async function handleOutlinePlanGenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  const outlinePlan = createOutlinePlanFromPresentation(presentationId, body);

  createJsonResponse(res, 200, createPresentationPayload({
    outlinePlan,
    outlinePlans: listOutlinePlans(presentationId)
  }));
}

async function handleOutlinePlanSave(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  const outlinePlan = saveOutlinePlan(presentationId, body.outlinePlan || body);

  createJsonResponse(res, 200, createPresentationPayload({
    outlinePlan,
    outlinePlans: listOutlinePlans(presentationId)
  }));
}

async function handleOutlinePlanDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  if (typeof body.planId !== "string" || !body.planId) {
    throw new Error("Expected planId");
  }

  const outlinePlans = deleteOutlinePlan(presentationId, body.planId);
  createJsonResponse(res, 200, createPresentationPayload({
    outlinePlans
  }));
}

async function handleOutlinePlanDuplicate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  if (typeof body.planId !== "string" || !body.planId) {
    throw new Error("Expected planId");
  }

  const outlinePlan = duplicateOutlinePlan(presentationId, body.planId, {
    name: body.name
  });
  createJsonResponse(res, 200, createPresentationPayload({
    outlinePlan,
    outlinePlans: listOutlinePlans(presentationId)
  }));
}

async function handleOutlinePlanArchive(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  if (typeof body.planId !== "string" || !body.planId) {
    throw new Error("Expected planId");
  }

  const outlinePlan = archiveOutlinePlan(presentationId, body.planId);
  createJsonResponse(res, 200, createPresentationPayload({
    outlinePlan,
    outlinePlans: listOutlinePlans(presentationId)
  }));
}

async function handleOutlinePlanPropose(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  if (typeof body.planId !== "string" || !body.planId) {
    throw new Error("Expected planId");
  }

  const candidate = proposeDeckChangesFromOutlinePlan(presentationId, body.planId);
  updateWorkflowState({
    dryRun: true,
    message: candidate.summary,
    ok: true,
    operation: "outline-plan-propose-current-deck",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    deckStructureCandidates: [candidate],
    runtime: serializeRuntimeState(),
    summary: candidate.summary
  });
}

async function handleOutlinePlanStageCreation(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  if (typeof body.planId !== "string" || !body.planId) {
    throw new Error("Expected planId");
  }

  const outlinePlan = getOutlinePlan(presentationId, body.planId);
  if (!isOutlinePlanPayload(outlinePlan)) {
    throw new Error("Expected outline plan");
  }
  if (outlinePlan.archivedAt) {
    throw new Error("Archived outline plans cannot start live deck generation.");
  }

  const sourceContext = readPresentationDeckContext(presentationId);
  const sourceDeck = isJsonObject(sourceContext) && isJsonObject(sourceContext.deck) ? sourceContext.deck : {};
  const deckPlan = outlinePlanToDeckPlan(outlinePlan);
  const deckPlanSlideCount = deckPlanSlides(deckPlan).length;
  const fields = normalizeCreationFields({
    audience: outlinePlan.audience || sourceDeck.audience || "",
    constraints: body.copyDeckContext === false ? "" : sourceDeck.constraints || "",
    objective: outlinePlan.objective || outlinePlan.purpose || sourceDeck.objective || "",
    presentationSourceText: body.copySources === true ? buildCompactPresentationSourceText(presentationId) : "",
    targetSlideCount: deckPlanSlideCount,
    themeBrief: body.copyDeckContext === false ? "" : sourceDeck.themeBrief || "",
    title: body.title || `${outlinePlan.name} deck`,
    tone: outlinePlan.tone || sourceDeck.tone || "",
    visualTheme: body.copyTheme === false ? {} : sourceDeck.visualTheme || {}
  });
  const draft = savePresentationCreationDraft({
    approvedOutline: true,
    contentRun: null,
    createdPresentationId: null,
    deckPlan,
    fields,
    outlineDirty: false,
    outlineLocks: {},
    retrieval: null,
    stage: "content"
  });
  publishCreationDraftUpdate(draft);

  updateWorkflowState({
    dryRun: true,
    message: `Staged "${outlinePlan.name}" as an approved outline for live deck generation.`,
    ok: true,
    operation: "outline-plan-stage-creation",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, createPresentationPayload({
    creationDraft: draft,
    outlinePlan
  }));
}

async function handleOutlinePlanDerive(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const presentationId = activePresentationIdFromBody(body);
  if (typeof body.planId !== "string" || !body.planId) {
    throw new Error("Expected planId");
  }

  resetPresentationRuntime();
  const result = derivePresentationFromOutlinePlan(presentationId, body.planId, {
    copyDeckContext: body.copyDeckContext !== false,
    copyMaterials: body.copyMaterials === true,
    copySources: body.copySources === true,
    copyTheme: body.copyTheme !== false,
    title: body.title
  });
  updateWorkflowState({
    message: `Derived "${result.presentation.title}" from outline plan "${result.outlinePlan.name}".`,
    ok: true,
    operation: "derive-presentation-from-outline-plan",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, createPresentationPayload(result));
}

async function handlePresentationDraftCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const fields = normalizeCreationFields({
    ...(current.fields || {}),
    ...(body.fields || {})
  });
  const deckPlan = body.deckPlan || current.deckPlan;
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

  if (current.contentRun && current.contentRun.status === "running") {
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
        onProgress: null,
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
        onSlide: async (partial: GeneratedPartialSlidePayload): Promise<void> => {
          const slideIndex = Number(partial.slideIndex);
          const slideCountProgress = Number(partial.slideCount);
          const slideIndexZero = slideIndex - 1;
          const validatedSpec = validateSlideSpec(partial.slideSpec);
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
          planSlide: failedIndex === null ? null : deckPlan.slides[failedIndex] || null,
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

function replaceMaterialUrlsInSlideSpec(spec: unknown, materialUrlById: Map<string, unknown>): SlideSpecPayload {
  const next = JSON.parse(JSON.stringify(isJsonObject(spec) ? spec : {}));
  if (isJsonObject(next.media)) {
    const mediaId = typeof next.media.id === "string" ? next.media.id : "";
    const url = materialUrlById.get(mediaId);
    if (url) {
      next.media.src = url;
    }
  }
  if (Array.isArray(next.mediaItems)) {
    next.mediaItems = next.mediaItems.map((item: unknown) => {
      if (!isJsonObject(item)) {
        return item;
      }
      const itemId = typeof item.id === "string" ? item.id : "";
      const url = materialUrlById.get(itemId);
      if (!url) {
        return item;
      }
      return {
        ...item,
        src: url
      };
    });
  }
  return next;
}

async function importContentRunArtifacts(run: ContentRunState): Promise<Map<string, unknown>> {
  const generationMaterials = Array.isArray(run.materials) ? run.materials.filter(isMaterialPayload) : [];
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
      // Keep accepting the partial deck even if a searched image is unavailable.
    }
  }

  if (run.sourceText) {
    await createSource({
      text: run.sourceText,
      title: "Starter sources"
    });
  }

  return new Map(importedMaterials.map((material: MaterialPayload) => [String(material.id || ""), material.url]));
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
    slideSpecs
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
    slideSpecs
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

  const materialUrlById = await importContentRunArtifacts(run);
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
        onProgress: null,
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
        onSlide: async (partial: GeneratedPartialSlidePayload): Promise<void> => {
          const slideIndex = Number(partial.slideIndex);
          const slideCountProgress = Number(partial.slideCount);
          const slideIndexZero = slideIndex - 1;
          const validatedSpec = validateSlideSpec(partial.slideSpec);
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
        usedMaterialIds,
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
  const run = current && current.contentRun;
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

async function handleRuntimeThemeSave(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const savedTheme = saveRuntimeTheme({
    name: body.name,
    theme: body.theme || body.visualTheme
  });

  createJsonResponse(res, 200, {
    savedTheme,
    savedThemes: listSavedThemes()
  });
}

async function handleThemeGenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const result = await generateThemeFromBrief(body, {
    onProgress: (event: JsonObject) => {
      const message = typeof event.message === "string" ? event.message : "Generating theme from brief.";
      updateWorkflowState({
        detail: typeof event.detail === "string" ? event.detail : message,
        message,
        operation: "theme-generate",
        stage: typeof event.stage === "string" ? event.stage : "llm",
        status: "running"
      });
    }
  });
  updateWorkflowState({
    message: result.source === "llm" ? "Generated theme from brief." : "Generated fallback theme from brief.",
    operation: "theme-generate",
    stage: "completed",
    status: "completed"
  });
  createJsonResponse(res, 200, result);
}

async function handleThemeCandidates(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const result = await generateThemeCandidates(body, {
    onProgress: (event: JsonObject) => {
      const message = typeof event.message === "string" ? event.message : "Generating theme candidates from brief.";
      updateWorkflowState({
        detail: typeof event.detail === "string" ? event.detail : message,
        message,
        operation: "theme-candidates",
        stage: typeof event.stage === "string" ? event.stage : "llm",
        status: "running"
      });
    }
  });
  updateWorkflowState({
    message: "Generated theme candidates.",
    operation: "theme-candidates",
    stage: "completed",
    status: "completed"
  });
  createJsonResponse(res, 200, result);
}

async function handlePresentationDuplicate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  assertBaseVersion(getPresentationVersion(body.presentationId), body.baseVersion, "Presentation");
  const presentation = duplicatePresentation(body.presentationId, {
    title: body.title
  });
  resetPresentationRuntime();
  createJsonResponse(res, 200, createPresentationPayload({ presentation }));
}

async function handlePresentationRegenerate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  const context = readPresentationDeckContext(body.presentationId);
  const deck = context && context.deck ? context.deck : {};
  const targetSlideCount = body.targetSlideCount
    ?? (deck.lengthProfile && deck.lengthProfile.targetCount)
    ?? body.targetCount;
  setActivePresentation(body.presentationId);
  resetPresentationRuntime();
  const reportProgress = createWorkflowProgressReporter({
    operation: "regenerate-presentation"
  });
  reportProgress({
    message: "Regenerating presentation slides from saved context...",
    stage: "generating-slides"
  });
  const generated = await generateInitialPresentation({
    ...deck,
    onProgress: reportProgress,
    targetSlideCount
  });
  const presentation = regeneratePresentationSlides(body.presentationId, generated.slideSpecs, {
    outline: generated.outline,
    slideContexts: generated.slideContexts,
    targetSlideCount: generated.targetSlideCount
  });
  updateWorkflowState({
    generation: generated.generation,
    message: `Regenerated ${generated.slideSpecs.length} slide${generated.slideSpecs.length === 1 ? "" : "s"} from the saved presentation context.`,
    ok: true,
    operation: "regenerate-presentation",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  runtimeState.sourceRetrieval = generated.retrieval || null;
  publishRuntimeState();
  createJsonResponse(res, 200, createPresentationPayload({ presentation }));
}

async function handlePresentationDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  assertBaseVersion(getPresentationVersion(body.presentationId), body.baseVersion, "Presentation");
  deletePresentation(body.presentationId);
  resetPresentationRuntime();
  createJsonResponse(res, 200, createPresentationPayload());
}

async function handleSlideSourceUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.source !== "string") {
    throw new Error("Expected a string field named source");
  }

  const slide = getSlide(slideId);
  if (slide.structured) {
    throw new Error("Raw source editing is disabled for structured JSON slides.");
  }

  writeSlideSource(slideId, body.source);
  const context = isVisualThemePayload(body.visualTheme)
    ? updateDeckFields({ visualTheme: body.visualTheme })
    : getDeckContext();
  const previews = body.rebuild === false ? getPreviewManifest() : (await buildAndRenderDeck()).previews;

  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;
  publishRuntimeState();
  const structured = describeStructuredSlide(slideId);

  createJsonResponse(res, 200, {
    context,
    domPreview: getDomPreviewState(),
    previews,
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    structured: structured.structured,
    slide: getSlide(slideId),
    source: readSlideSource(slideId)
  });
}

async function handleSlideSpecUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
  const body = await readJsonBody(req);
  if (!body.slideSpec || typeof body.slideSpec !== "object" || Array.isArray(body.slideSpec)) {
    throw new Error("Expected an object field named slideSpec");
  }

  const activePresentationId = listPresentations().activePresentationId;
  assertBaseVersion(getSlideVersion(activePresentationId, slideId), body.baseVersion, "Slide");
  const currentSlideSpec = readSlideSpec(slideId);
  const selectionScope = normalizeSelectionScope(body.selectionScope, {
    slideId,
    slideSpec: currentSlideSpec
  });
  if (selectionScope) {
    assertSelectionAnchorsCurrent(currentSlideSpec, selectionScope);
    const requestedSelectionScope = isJsonObject(body.selectionScope) ? body.selectionScope : {};
    if (!requestedSelectionScope.allowFamilyChange) {
      assertPatchWithinSelectionScope(currentSlideSpec, body.slideSpec, selectionScope);
    }
  }

  writeSlideSpec(slideId, body.slideSpec, { preservePlacement: body.preserveSlidePosition === true });
  const context = isVisualThemePayload(body.visualTheme)
    ? updateDeckFields({ visualTheme: body.visualTheme })
    : getDeckContext();
  const shouldRebuild = body.rebuild !== false;
  const previews = shouldRebuild ? (await buildAndRenderDeck()).previews : getPreviewManifest();

  if (shouldRebuild) {
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
  }
  runtimeState.lastError = null;
  publishRuntimeState();
  const structured = describeStructuredSlide(slideId);

  createJsonResponse(res, 200, {
    context,
    domPreview: getDomPreviewState(),
    previews,
    slide: getSlide(slideId),
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
}

async function handleSlideCurrentValidation(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
  const body = await readJsonBody(req);
  const slide = getSlide(slideId);
  const slideSpec = isSlideSpecPayload(body.slideSpec)
    ? body.slideSpec
    : readSlideSpec(slideId);
  const validation = await validateSlideSpecInDom({
    id: slide.id,
    index: slide.index,
    slideSpec,
    title: slide.title
  });

  createJsonResponse(res, 200, {
    slideId,
    validation
  });
}

async function handleMaterialUpload(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const material = createMaterialFromDataUrl(body || {});
  publishRuntimeState();

  createJsonResponse(res, 200, {
    material,
    materials: listMaterials()
  });
}

async function handleCustomVisualCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const customVisual = createCustomVisual(body || {});
  publishRuntimeState();

  createJsonResponse(res, 200, {
    customVisual,
    customVisuals: listCustomVisuals()
  });
}

async function handleSlideCustomVisualUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
  const body = await readJsonBody(req);
  const currentSpec = readSlideSpec(slideId);
  const nextSpec = { ...currentSpec };
  const customVisualId = typeof body.customVisualId === "string" ? body.customVisualId : "";

  if (!customVisualId) {
    delete nextSpec.customVisual;
  } else {
    const customVisual = getCustomVisual(customVisualId);
    nextSpec.customVisual = {
      id: customVisual.id,
      role: customVisual.role,
      title: customVisual.title
    };
  }

  writeSlideSpec(slideId, nextSpec);
  const structured = describeStructuredSlide(slideId);
  const hydratedSlideSpec = structured.slideSpec
    ? hydrateCustomVisualSlideSpec(structured.slideSpec)
    : structured.slideSpec;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    customVisuals: listCustomVisuals(),
    slide: getSlide(slideId),
    slideSpec: hydratedSlideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
}

async function handleSourceCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const source = await createSource(body || {});
  updateWorkflowState({
    message: `Added source ${source.title}.`,
    ok: true,
    operation: "add-source",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    runtime: serializeRuntimeState(),
    source,
    sources: listSources()
  });
}

async function handleSourceDelete(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.sourceId !== "string" || !body.sourceId) {
    throw new Error("Expected sourceId");
  }

  const sources = deleteSource(body.sourceId);
  updateWorkflowState({
    message: "Removed presentation source.",
    ok: true,
    operation: "delete-source",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    runtime: serializeRuntimeState(),
    sources
  });
}

async function handleSlideMaterialUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
  const body = await readJsonBody(req);
  const currentSpec = readSlideSpec(slideId);
  const materialId = typeof body.materialId === "string" ? body.materialId : "";
  const nextSpec = { ...currentSpec };

  if (!materialId) {
    delete nextSpec.media;
  } else {
    const material = getMaterial(materialId);
    const caption = String(body.caption || material.caption || "").replace(/\s+/g, " ").trim();
    nextSpec.media = {
      alt: String(body.alt || material.alt || material.title).replace(/\s+/g, " ").trim() || material.title,
      fit: currentSpec.type === "photo" ? "cover" : "contain",
      focalPoint: "center",
      id: material.id,
      src: material.url,
      title: material.title
    };
    if (caption) {
      nextSpec.media.caption = caption;
    }
  }

  writeSlideSpec(slideId, nextSpec);
  const structured = describeStructuredSlide(slideId);
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    domPreview: getDomPreviewState(),
    materials: listMaterials(),
    slide: getSlide(slideId),
    slideSpec: structured.slideSpec,
    slideSpecError: structured.slideSpecError,
    source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(slideId),
    structured: structured.structured
  });
}

async function handleDeckContextUpdate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const activePresentationId = listPresentations().activePresentationId;
  assertBaseVersion(getPresentationVersion(activePresentationId), body.baseVersion, "Presentation");
  const context = updateDeckFields(body.deck || {});
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
    runtime: serializeRuntimeState()
    ,
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
    domPreview: getDomPreviewState(),
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
    domPreview: getDomPreviewState(),
    lengthProfile: result.lengthProfile,
    previews,
    restoredSlides: result.restoredSlides,
    runtime: serializeRuntimeState(),
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide: SlideSummary) => slide.skipped && !slide.archived),
    slides: result.slides
  });
}

function sentenceValue(value: unknown, fallback: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function slugPart(value: unknown, fallback = "system"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || fallback;
}

function renumberOutlineWithInsert(outline: unknown, title: string, targetIndex: number): string {
  const lines = String(outline || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, ""));
  const insertIndex = Math.min(Math.max(Number(targetIndex) - 1, 0), lines.length);
  lines.splice(insertIndex, 0, title);
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function renumberOutlineWithoutIndex(outline: unknown, targetIndex: number): string {
  const lines = String(outline || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, ""));
  const removeIndex = Math.min(Math.max(Number(targetIndex) - 1, 0), lines.length - 1);
  if (removeIndex >= 0) {
    lines.splice(removeIndex, 1);
  }
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function createManualSystemSlideSpec({ summary, targetIndex, title }: ManualSystemSlideInput): SlideSpecPayload {
  const safeTitle = sentenceValue(title, "New system");
  const safeSummary = sentenceValue(
    summary,
    "Describe the system boundary, the signal to watch, and the guardrails that keep the deck workflow repeatable."
  );
  const idBase = slugPart(safeTitle);

  return {
    type: "content",
    index: targetIndex,
    title: safeTitle,
    eyebrow: "System",
    summary: safeSummary,
    signalsTitle: "System signals",
    guardrailsTitle: "Guardrails",
    signals: [
      { id: `${idBase}-signal-boundary`, label: "Boundary", value: 0.9 },
      { id: `${idBase}-signal-flow`, label: "Flow", value: 0.84 },
      { id: `${idBase}-signal-feedback`, label: "Feedback", value: 0.88 },
      { id: `${idBase}-signal-fit`, label: "Fit", value: 0.82 }
    ],
    guardrails: [
      { id: `${idBase}-guardrail-owner`, label: "owner", value: "1" },
      { id: `${idBase}-guardrail-loop`, label: "loop", value: "1" },
      { id: `${idBase}-guardrail-check`, label: "check", value: "1" }
    ]
  };
}

function createManualDividerSlideSpec({ targetIndex, title }: ManualSlideInput): SlideSpecPayload {
  return {
    type: "divider",
    index: targetIndex,
    title: sentenceValue(title, "New section")
  };
}

function createManualQuoteSlideSpec({ quote, targetIndex, title }: ManualQuoteSlideInput): SlideSpecPayload {
  return {
    type: "quote",
    index: targetIndex,
    title: sentenceValue(title, "Pull quote"),
    quote: sentenceValue(quote, "Add a sourced quote or authored pull quote here.")
  };
}

function createManualPhotoSlideSpec({ caption, materialId, targetIndex, title }: ManualPhotoSlideInput): SlideSpecPayload {
  const material: MaterialPayload = getMaterial(String(materialId || ""));
  const safeCaption = String(caption || material.caption || "").replace(/\s+/g, " ").trim();
  const media = {
    alt: String(material.alt || material.title).replace(/\s+/g, " ").trim() || material.title,
    id: material.id,
    src: material.url,
    title: material.title,
    ...(safeCaption ? { caption: safeCaption } : {})
  };

  return {
    type: "photo",
    index: targetIndex,
    title: sentenceValue(title, String(material.title || "Photo")),
    media,
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

function materialToSlideMedia(material: MaterialPayload, captionOverride = ""): JsonObject {
  const safeCaption = String(captionOverride || material.caption || "").replace(/\s+/g, " ").trim();
  return {
    alt: String(material.alt || material.title).replace(/\s+/g, " ").trim() || material.title,
    id: material.id,
    src: material.url,
    title: material.title,
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

function createManualPhotoGridSlideSpec({ caption, materialIds, targetIndex, title }: ManualPhotoGridSlideInput): SlideSpecPayload {
  const uniqueMaterialIds = Array.from(new Set(Array.isArray(materialIds) ? materialIds : []))
    .map((id: unknown) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  if (uniqueMaterialIds.length < 2) {
    throw new Error("Photo grid slides need 2-4 materials");
  }

  const materials: MaterialPayload[] = uniqueMaterialIds.map((materialId: string) => getMaterial(materialId));
  const safeCaption = String(caption || "").replace(/\s+/g, " ").trim();

  return {
    type: "photoGrid",
    index: targetIndex,
    title: sentenceValue(title, "Photo grid"),
    mediaItems: materials.map((material: MaterialPayload) => materialToSlideMedia(material)),
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

async function handleManualSystemSlideCreate(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const activePresentationId = listPresentations().activePresentationId;
  assertBaseVersion(getPresentationVersion(activePresentationId), body.baseVersion, "Presentation");
  const requestedSlideType = typeof body.slideType === "string" ? body.slideType : "";
  const slideType = ["divider", "quote", "photo", "photoGrid"].includes(requestedSlideType) ? requestedSlideType : "content";
  const title = sentenceValue(body.title, "New system");
  const summary = sentenceValue(
    body.summary,
    "Describe the system boundary, the signal to watch, and the guardrails that keep the deck workflow repeatable."
  );
  const activeSlides = getSlides();
  const afterSlide = activeSlides.find((slide: SlideSummary) => slide.id === body.afterSlideId) || null;
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
  const currentContext = getDeckContext();
  const outline = renumberOutlineWithInsert(currentContext.deck && currentContext.deck.outline, title, targetIndex);

  updateDeckFields({ outline });
  const context = updateSlideContext(created.id, slideType === "divider"
    ? {
        title,
        intent: `Use ${title} as a clean section boundary before the following slide cluster.`,
        mustInclude: "One short title that signals the next section clearly.",
        notes: "Manual divider slide created from the Slide Studio panel.",
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
    message: slideType === "divider"
      ? `Added manual divider slide ${title}.`
      : slideType === "quote"
        ? `Added manual quote slide ${title}.`
        : slideType === "photo"
          ? `Added manual photo slide ${title}.`
          : slideType === "photoGrid"
            ? `Added manual photo grid slide ${title}.`
      : `Added manual system slide ${title}.`,
    ok: true,
    operation: slideType === "divider"
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
    domPreview: getDomPreviewState(),
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

  const activePresentationId = listPresentations().activePresentationId;
  assertBaseVersion(getSlideVersion(activePresentationId, body.slideId), body.baseVersion, "Slide");
  const removed = archiveStructuredSlide(body.slideId);
  const currentContext = getDeckContext();
  const outline = renumberOutlineWithoutIndex(currentContext.deck && currentContext.deck.outline, removed.index);
  const context = updateDeckFields({ outline });
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
    domPreview: getDomPreviewState(),
    previews,
    removedSlideId: removed.id,
    runtime: serializeRuntimeState(),
    selectedSlideId: selected ? selected.id : null,
    slides: remainingSlides
  });
}

async function handleSlideContextUpdate(req: ServerRequest, res: ServerResponse, slideId: string): Promise<void> {
  const body = await readJsonBody(req);
  const context = updateSlideContext(slideId, body || {});
  createJsonResponse(res, 200, {
    context,
    slideContext: context.slides[slideId] || {}
  });
}

async function handleVariantCapture(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when capturing a variant");
  }

  let source = typeof body.source === "string" ? body.source : undefined;
  let slideSpec = body.slideSpec || null;

  if (slideSpec && typeof slideSpec === "object" && !Array.isArray(slideSpec)) {
    source = serializeSlideSpec(slideSpec);
  }

  const variant = captureVariant({
    ...body,
    slideSpec,
    source
  });
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

  const activePresentationId = listPresentations().activePresentationId;
  assertBaseVersion(getSlideVersion(activePresentationId, storedVariant.slideId), body.baseVersion, "Slide");
  if (storedVariant.operationScope) {
    const currentSlideSpec = readSlideSpec(storedVariant.slideId);
    const selectionScope = normalizeSelectionScope(storedVariant.operationScope, {
      slideId: storedVariant.slideId,
      slideSpec: currentSlideSpec
    });
    if (selectionScope) {
      assertSelectionAnchorsCurrent(currentSlideSpec, selectionScope);
      if (!storedVariant.operationScope.allowFamilyChange) {
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
    domPreview: getDomPreviewState(),
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

  const reportProgress = createWorkflowProgressReporter({
    dryRun: true,
    operation: "ideate-slide",
    slideId: body.slideId
  });
  const result = await ideateSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: reportProgress
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: result.summary,
    ok: true,
    operation: "ideate-slide",
    slideId: body.slideId,
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

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

async function handleDrillWording(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when drilling wording");
  }

  const reportProgress = createWorkflowProgressReporter({
    dryRun: true,
    operation: "drill-wording",
    slideId: body.slideId
  });
  const result = await drillWordingSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: reportProgress
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: result.summary,
    ok: true,
    operation: "drill-wording",
    slideId: body.slideId,
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

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

async function handleIdeateTheme(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when ideating a theme");
  }

  const reportProgress = createWorkflowProgressReporter({
    dryRun: true,
    operation: "ideate-theme",
    slideId: body.slideId
  });
  const result = await ideateThemeSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: reportProgress
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: result.summary,
    ok: true,
    operation: "ideate-theme",
    slideId: body.slideId,
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

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

async function handleIdeateDeckStructure(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const reportProgress = createWorkflowProgressReporter({
    dryRun: true,
    operation: "ideate-deck-structure"
  });
  const result = await ideateDeckStructure({
    candidateCount: body.candidateCount,
    dryRun: body.dryRun !== false,
    onProgress: reportProgress
  });
  updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: result.summary,
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

  const reportProgress = createWorkflowProgressReporter({
    dryRun: true,
    operation: "ideate-structure",
    slideId: body.slideId
  });
  const result = await ideateStructureSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: reportProgress
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: result.summary,
    ok: true,
    operation: "ideate-structure",
    slideId: body.slideId,
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

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

async function handleRedoLayout(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when redoing layout");
  }

  const reportProgress = createWorkflowProgressReporter({
    dryRun: body.dryRun !== false,
    operation: "redo-layout",
    slideId: body.slideId
  });
  const result = await redoLayoutSlide(body.slideId, {
    candidateCount: body.candidateCount,
    dryRun: true,
    onProgress: reportProgress
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: body.dryRun !== false,
    generation: result.generation,
    message: result.summary,
    ok: true,
    operation: "redo-layout",
    slideId: body.slideId,
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

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
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    dryRun: true,
    generation: result.generation,
    message: result.summary,
    ok: true,
    operation: "custom-layout",
    slideId: body.slideId,
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

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

async function handleAssistantSession(req: ServerRequest, res: ServerResponse, url: URL): Promise<void> {
  const sessionId = url.searchParams.get("sessionId") || "default";
  createJsonResponse(res, 200, {
    actions: buildActionDescriptors(),
    session: getAssistantSession(sessionId),
    suggestions: getAssistantSuggestions()
  });
}

async function handleAssistantSend(req: ServerRequest, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body.message !== "string") {
    throw new Error("Expected message when sending to assistant");
  }

  const result = await handleAssistantMessage({
    candidateCount: body.candidateCount,
    dryRun: body.dryRun !== false,
    message: body.message,
    onProgress: createWorkflowProgressReporter({
      dryRun: body.dryRun !== false,
      operation: "assistant-workflow",
      slideId: typeof body.slideId === "string" && body.slideId ? body.slideId : null
    }),
    selection: body.selection && typeof body.selection === "object" ? body.selection : null,
    sessionId: typeof body.sessionId === "string" && body.sessionId ? body.sessionId : "default",
    slideId: typeof body.slideId === "string" && body.slideId ? body.slideId : null
  });

  if (result.action && (result.action.type === "ideate-slide" || result.action.type === "ideate-structure" || result.action.type === "ideate-theme" || result.action.type === "drill-wording" || result.action.type === "redo-layout" || result.action.type === "selection-command")) {
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    updateWorkflowState({
      dryRun: result.action.dryRun,
      generation: result.action.generation,
      message: result.reply && result.reply.content ? result.reply.content : "Assistant workflow completed.",
      ok: true,
      operation: `assistant-${result.action.type}`,
      slideId: result.action.slideId,
      stage: "completed",
      status: "completed"
    });
  }

  if (result.action && result.action.type === "ideate-deck-structure") {
    updateWorkflowState({
      dryRun: result.action.dryRun,
      generation: result.action.generation,
      message: result.reply && result.reply.content ? result.reply.content : "Assistant deck-structure workflow completed.",
      ok: true,
      operation: "assistant-ideate-deck-structure",
      stage: "completed",
      status: "completed"
    });
  }

  if (result.action && result.action.type === "validate" && result.validation) {
    runtimeState.validation = {
      includeRender: result.action.includeRender,
      ok: result.validation.ok,
      updatedAt: new Date().toISOString()
    };
    updateWorkflowState({
      includeRender: result.action.includeRender,
      message: result.validation.ok ? "Assistant validation completed without blocking issues." : "Assistant validation completed and found issues.",
      ok: result.validation.ok,
      operation: "assistant-validate",
      stage: "completed",
      status: "completed"
    });
  }

  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    action: result.action,
    actions: buildActionDescriptors(),
    context: result.context || getDeckContext(),
    deckStructureCandidates: Array.isArray(result.deckStructureCandidates) ? result.deckStructureCandidates : [],
    previews: result.previews || getPreviewManifest(),
    reply: result.reply,
    runtime: serializeRuntimeState(),
    session: result.session,
    suggestions: getAssistantSuggestions(),
    transientVariants: Array.isArray(result.transientVariants) ? result.transientVariants : [],
    validation: result.validation || null,
    variants: listAllVariants()
  });
}

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

  const hypermediaChecksMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/checks$/);
  if (req.method === "GET" && hypermediaChecksMatch) {
    createJsonResponse(res, 200, createCheckReportResource(hypermediaChecksMatch[1]));
    return;
  }

  const hypermediaExportsMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/exports$/);
  if (req.method === "GET" && hypermediaExportsMatch) {
    createJsonResponse(res, 200, createExportCollectionResource(hypermediaExportsMatch[1]));
    return;
  }

  const hypermediaSlidesMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides$/);
  if (req.method === "GET" && hypermediaSlidesMatch) {
    createJsonResponse(res, 200, createSlideCollectionResource(hypermediaSlidesMatch[1]));
    return;
  }

  const hypermediaSlideWorkflowsMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/workflows$/);
  if (req.method === "GET" && hypermediaSlideWorkflowsMatch) {
    createJsonResponse(res, 200, createSlideWorkflowResource(hypermediaSlideWorkflowsMatch[1], hypermediaSlideWorkflowsMatch[2]));
    return;
  }

  const hypermediaCandidateMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/candidates\/([a-z0-9-]+)$/);
  if (req.method === "GET" && hypermediaCandidateMatch) {
    createJsonResponse(res, 200, createCandidateResource(hypermediaCandidateMatch[1], hypermediaCandidateMatch[2], hypermediaCandidateMatch[3]));
    return;
  }

  const hypermediaCandidatesMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)\/candidates$/);
  if (req.method === "GET" && hypermediaCandidatesMatch) {
    createJsonResponse(res, 200, createCandidateCollectionResource(hypermediaCandidatesMatch[1], hypermediaCandidatesMatch[2]));
    return;
  }

  const hypermediaSlideMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)\/slides\/([a-z0-9-]+)$/);
  if (req.method === "GET" && hypermediaSlideMatch) {
    createJsonResponse(res, 200, createSlideResource(hypermediaSlideMatch[1], hypermediaSlideMatch[2]));
    return;
  }

  const hypermediaPresentationMatch = url.pathname.match(/^\/api\/v1\/presentations\/([a-z0-9-]+)$/);
  if (req.method === "GET" && hypermediaPresentationMatch) {
    createJsonResponse(res, 200, createPresentationResource(hypermediaPresentationMatch[1]));
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

  if (req.method === "POST" && url.pathname === "/api/build") {
    await handleBuild(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/validate") {
    await handleValidate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/checks/remediate") {
    await handleCheckRemediation(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/llm/check") {
    await handleLlmCheck(res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/presentations") {
    createJsonResponse(res, 200, listPresentations());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/select") {
    await handlePresentationSelect(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations") {
    await handlePresentationCreate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft") {
    await handlePresentationDraftSave(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/outline") {
    await handlePresentationDraftOutline(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/outline/slide") {
    await handlePresentationDraftOutlineSlide(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/approve") {
    await handlePresentationDraftApprove(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/create") {
    await handlePresentationDraftCreate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/generate") {
    await handleOutlinePlanGenerate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans") {
    await handleOutlinePlanSave(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/delete") {
    await handleOutlinePlanDelete(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/duplicate") {
    await handleOutlinePlanDuplicate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/archive") {
    await handleOutlinePlanArchive(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/propose") {
    await handleOutlinePlanPropose(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/stage-creation") {
    await handleOutlinePlanStageCreation(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outline-plans/derive") {
    await handleOutlinePlanDerive(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/content/retry") {
    await handlePresentationDraftContentRetry(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/content/accept-partial") {
    await handlePresentationDraftContentAcceptPartial(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/draft/content/stop") {
    await handlePresentationDraftContentStop(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/themes/save") {
    await handleRuntimeThemeSave(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/themes/generate") {
    await handleThemeGenerate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/themes/candidates") {
    await handleThemeCandidates(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/layouts") {
    createJsonResponse(res, 200, { layouts: readLayouts().layouts });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/save") {
    await handleLayoutSave(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/favorites/save") {
    await handleFavoriteLayoutSave(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/candidates/save") {
    await handleLayoutCandidateSave(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/favorites/delete") {
    await handleFavoriteLayoutDelete(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/export") {
    await handleLayoutExport(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/import") {
    await handleLayoutImport(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/apply") {
    await handleLayoutApply(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/duplicate") {
    await handlePresentationDuplicate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/regenerate") {
    await handlePresentationRegenerate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/presentations/delete") {
    await handlePresentationDelete(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/context") {
    await handleDeckContextUpdate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/context/deck-structure/apply") {
    await handleDeckStructureApply(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/deck/scale-length/plan") {
    await handleDeckLengthPlan(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/deck/scale-length/apply") {
    await handleDeckLengthApply(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/slides/restore-skipped") {
    await handleSkippedSlideRestore(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/slides/system") {
    await handleManualSystemSlideCreate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/slides/delete") {
    await handleManualSlideDelete(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/preview/deck") {
    createJsonResponse(res, 200, getPreviewManifest());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/dom-preview/deck") {
    createJsonResponse(res, 200, getDomPreviewState());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/materials") {
    createJsonResponse(res, 200, { materials: listMaterials() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/materials") {
    await handleMaterialUpload(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/custom-visuals") {
    createJsonResponse(res, 200, { customVisuals: listCustomVisuals() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/custom-visuals") {
    await handleCustomVisualCreate(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/sources") {
    createJsonResponse(res, 200, { sources: listSources() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sources") {
    await handleSourceCreate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sources/delete") {
    await handleSourceDelete(req, res);
    return;
  }

  const slidePreviewMatch = url.pathname.match(/^\/api\/preview\/slide\/(\d+)$/);
  if (req.method === "GET" && slidePreviewMatch) {
    const index = Number(slidePreviewMatch[1]);
    const previews = getPreviewManifest();
    const page = previews.pages.find((entry: JsonObject) => entry.index === index) || null;
    createJsonResponse(res, 200, {
      page,
      slide: getSlides().find((entry: JsonObject) => entry.index === index) || null
    });
    return;
  }

  const slideMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)$/);
  if (req.method === "GET" && slideMatch) {
    const slideId = slideMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
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
    return;
  }

  const slideSourceMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/source$/);
  if (req.method === "POST" && slideSourceMatch) {
    const slideId = slideSourceMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
    await handleSlideSourceUpdate(req, res, slideId);
    return;
  }

  const slideSpecMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/slide-spec$/);
  if (req.method === "POST" && slideSpecMatch) {
    const slideId = slideSpecMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
    await handleSlideSpecUpdate(req, res, slideId);
    return;
  }

  const slideMaterialMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/material$/);
  if (req.method === "POST" && slideMaterialMatch) {
    const slideId = slideMaterialMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
    await handleSlideMaterialUpdate(req, res, slideId);
    return;
  }

  const slideCustomVisualMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/custom-visual$/);
  if (req.method === "POST" && slideCustomVisualMatch) {
    const slideId = slideCustomVisualMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
    await handleSlideCustomVisualUpdate(req, res, slideId);
    return;
  }

  const slideCurrentValidationMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/validate-current$/);
  if (req.method === "POST" && slideCurrentValidationMatch) {
    const slideId = slideCurrentValidationMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
    await handleSlideCurrentValidation(req, res, slideId);
    return;
  }

  const slideContextMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/context$/);
  if (req.method === "POST" && slideContextMatch) {
    const slideId = slideContextMatch[1];
    if (!slideId) {
      notFound(res);
      return;
    }
    await handleSlideContextUpdate(req, res, slideId);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/variants/capture") {
    await handleVariantCapture(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/variants/apply") {
    await handleVariantApply(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/operations/ideate-slide") {
    await handleIdeateSlide(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/operations/drill-wording") {
    await handleDrillWording(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/operations/ideate-theme") {
    await handleIdeateTheme(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/operations/ideate-deck-structure") {
    await handleIdeateDeckStructure(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/operations/ideate-structure") {
    await handleIdeateStructure(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/operations/redo-layout") {
    await handleRedoLayout(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/custom/preview") {
    await handleCustomLayoutPreview(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layouts/custom/draft") {
    await handleCustomLayoutDraft(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/assistant/session") {
    await handleAssistantSession(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assistant/message") {
    await handleAssistantSend(req, res);
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
    createTextResponse(res, 200, renderPresentationPreviewDocument({
      presentationId: presentationPreviewMatch[1]
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
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

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

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
