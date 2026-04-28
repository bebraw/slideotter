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
  applyLayoutToSlideSpec,
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
const { createMaterialFromDataUrl, createMaterialFromRemoteImage, getMaterial, getMaterialFilePath, listMaterials } = require("./services/materials.ts");
const { clientDir, outputDir } = require("./services/paths.ts");
const {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  clearPresentationCreationDraft,
  getPresentationCreationDraft,
  listSavedThemes,
  listPresentations,
  readPresentationDeckContext,
  readPresentationSummary,
  regeneratePresentationSlides,
  savePresentationCreationDraft,
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
const { createSource, deleteSource, listSources } = require("./services/sources.ts");
const { applyDeckLengthPlan, planDeckLengthSemantic, restoreSkippedSlides } = require("./services/deck-length.ts");
const { applyDeckStructureCandidate, drillWordingSlide, ideateDeckStructure, ideateStructureSlide, ideateThemeSlide, ideateSlide, redoLayoutSlide } = require("./services/operations.ts");
const { generateThemeFromBrief } = require("./services/theme-generation.ts");
const { validateDeck } = require("./services/validate.ts");
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

const runtimeState = {
  build: {
    ok: false,
    updatedAt: null
  },
  lastError: null,
  llmCheck: null,
  sourceRetrieval: null,
  validation: null,
  workflow: null,
  workflowHistory: [],
  workflowSequence: 0
};
const runtimeSubscribers: Set<any> = new Set();

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function publishCreationDraftUpdate(draft) {
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

function publishRuntimeState() {
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

function publishWorkflowEvent(event) {
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

function recordWorkflowEvent(workflow) {
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

function updateWorkflowState(nextWorkflow) {
  runtimeState.workflow = {
    ...(runtimeState.workflow || {}),
    ...nextWorkflow,
    updatedAt: new Date().toISOString()
  };
  recordWorkflowEvent(runtimeState.workflow);
  publishRuntimeState();
}

function createWorkflowProgressReporter(baseState) {
  return (progress) => {
    updateWorkflowState({
      ...baseState,
      ok: false,
      status: "running",
      ...progress
    });
  };
}

function serializeRuntimeState() {
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

function createJsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(body);
}

function createTextResponse(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": contentType
  });
  res.end(body);
}

function notFound(res) {
  createTextResponse(res, 404, "Not found");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
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

async function readJsonBody(req) {
  const body = await readBody(req) as string;
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Request body must be valid JSON");
  }
}

function sendFile(res, fileName) {
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
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(output);
      return;
    }
  }

  if (!fs.existsSync(fileName) || !fs.statSync(fileName).isFile()) {
    notFound(res);
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = ({
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
  })[ext] || "application/octet-stream";

  const stream = fs.createReadStream(fileName);
  res.writeHead(200, { "Content-Type": contentType });
  stream.pipe(res);
}

function getWorkspaceState() {
  const variantMigration = migrateLegacyStructuredVariants();
  return {
    assistant: {
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    domPreview: getDomPreviewState(),
    creationDraft: getPresentationCreationDraft(),
    favoriteLayouts: readFavoriteLayouts().layouts,
    layouts: readLayouts().layouts,
    materials: listMaterials(),
    presentations: listPresentations(),
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide) => slide.skipped && !slide.archived),
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

async function handleLayoutSave(req, res) {
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

async function handleFavoriteLayoutSave(req, res) {
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

async function handleLayoutCandidateSave(req, res) {
  const body = await readJsonBody(req);
  const slideSpec = body.slideSpec && typeof body.slideSpec === "object" && !Array.isArray(body.slideSpec)
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

async function handleFavoriteLayoutDelete(req, res) {
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

async function handleLayoutExport(req, res) {
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

async function handleLayoutImport(req, res) {
  const body = await readJsonBody(req);
  const scope = typeof body.scope === "string" ? body.scope : "deck";
  const document = body.document && typeof body.document === "object" ? body.document : null;
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

async function handleLayoutApply(req, res) {
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

function serializeSlideSpec(slideSpec) {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

function isVisualThemePayload(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function describeStructuredSlide(slideId) {
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
      slideSpecError: error.message,
      structured: false
    };
  }
}

async function handleBuild(res) {
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

async function handleValidate(req, res) {
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

async function handleLlmCheck(res) {
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

function resetPresentationRuntime() {
  runtimeState.build = {
    ok: false,
    updatedAt: null
  };
  runtimeState.lastError = null;
  runtimeState.validation = null;
  runtimeState.sourceRetrieval = null;
  runtimeState.workflow = null;
  runtimeState.workflowHistory = [];
  runtimeState.workflowSequence = 0;
  publishRuntimeState();
}

function createPresentationPayload(extra: any = {}) {
  return {
    ...extra,
    ...getWorkspaceState()
  };
}

async function handlePresentationSelect(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  setActivePresentation(body.presentationId);
  resetPresentationRuntime();
  createJsonResponse(res, 200, createPresentationPayload());
}

async function handlePresentationCreate(req, res) {
  const body = await readJsonBody(req);
  const fields = body && typeof body === "object" ? body : {};
  const starterSourceText = typeof fields.presentationSourceText === "string"
    ? fields.presentationSourceText.trim()
    : "";
  const starterMaterials = Array.isArray(fields.presentationMaterials)
    ? fields.presentationMaterials
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

    starterMaterials.forEach((material) => {
      createMaterialFromDataUrl({
        alt: material.alt || material.title || material.fileName,
        caption: material.caption || "",
        dataUrl: material.dataUrl,
        fileName: material.fileName || material.title || "starter-image",
        title: material.title || material.fileName || "Starter image"
      });
    });

    let imageSearchResult = null;
    if (fields.imageSearch && typeof fields.imageSearch === "object" && String(fields.imageSearch.query || "").trim()) {
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

function normalizeCreationFields(body: any = {}) {
  const fields = body && typeof body === "object" ? body : {};

  return {
    audience: String(fields.audience || "").trim(),
    constraints: String(fields.constraints || "").trim(),
    imageSearch: fields.imageSearch && typeof fields.imageSearch === "object"
      ? {
          count: fields.imageSearch.count || 3,
          provider: fields.imageSearch.provider || "openverse",
          query: String(fields.imageSearch.query || "").trim(),
          restrictions: String(fields.imageSearch.restrictions || "").trim()
        }
      : {
          count: 3,
          provider: "openverse",
          query: "",
          restrictions: ""
        },
    objective: String(fields.objective || "").trim(),
    presentationSourceText: String(fields.presentationSourceText || "").trim(),
    sourcingStyle: ["compact-references", "inline-notes", "none"].includes(fields.sourcingStyle)
      ? fields.sourcingStyle
      : "compact-references",
    targetSlideCount: fields.targetSlideCount || fields.targetCount || 5,
    themeBrief: String(fields.themeBrief || "").trim(),
    title: String(fields.title || "").trim(),
    tone: String(fields.tone || "").trim(),
    visualTheme: fields.visualTheme && typeof fields.visualTheme === "object" ? fields.visualTheme : {}
  };
}

function normalizeOutlineLocks(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([key, locked]) => /^\d+$/.test(key) && locked === true)
    .map(([key]) => [key, true]));
}

function buildDeckPlanOutline(slides) {
  return (Array.isArray(slides) ? slides : [])
    .map((slide, index) => {
      const title = slide && slide.title ? slide.title : `Slide ${index + 1}`;
      const message = slide && (slide.keyMessage || slide.intent) ? slide.keyMessage || slide.intent : "";
      return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
    })
    .join("\n");
}

function applyLockedOutlineSlides(nextPlan, previousPlan, outlineLocks) {
  const nextSlides = Array.isArray(nextPlan && nextPlan.slides) ? nextPlan.slides : [];
  const previousSlides = Array.isArray(previousPlan && previousPlan.slides) ? previousPlan.slides : [];
  const locks = normalizeOutlineLocks(outlineLocks);
  if (!nextSlides.length || !previousSlides.length || !Object.keys(locks).length) {
    return nextPlan;
  }

  const slides = nextSlides.map((slide, index) => {
    const base = locks[String(index)] && previousSlides[index]
      ? { ...previousSlides[index] }
      : slide;

    return {
      ...base,
      sourceNotes: base.sourceNotes || base.sourceText || base.sourceNeed || ""
    };
  });

  return {
    ...nextPlan,
    outline: buildDeckPlanOutline(slides),
    slides
  };
}

function buildLockedOutlineContext(deckPlan, outlineLocks, options: any = {}) {
  const slides = Array.isArray(deckPlan && deckPlan.slides) ? deckPlan.slides : [];
  const locks = normalizeOutlineLocks(outlineLocks);
  return slides
    .map((slide, index) => ({ index, slide }))
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

async function handlePresentationDraftSave(req, res) {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const draft = savePresentationCreationDraft({
    ...current,
    approvedOutline: typeof body.approvedOutline === "boolean" ? body.approvedOutline : current.approvedOutline,
    deckPlan: body.deckPlan || current.deckPlan,
    fields: {
      ...(current.fields || {}),
      ...normalizeCreationFields(body.fields || body || {})
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

async function handlePresentationDraftOutline(req, res) {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const fields = normalizeCreationFields(body.fields || body || {});
  if (!fields.title) {
    throw new Error("Expected a presentation title before generating an outline");
  }
  const mergeDeckPlan = (basePlan, overridePlan) => {
    const baseSlides = Array.isArray(basePlan && basePlan.slides) ? basePlan.slides : [];
    const overrideSlides = Array.isArray(overridePlan && overridePlan.slides) ? overridePlan.slides : [];
    if (!baseSlides.length) {
      return overridePlan || basePlan;
    }
    if (!overrideSlides.length) {
      return basePlan;
    }

    const maxSlides = Math.max(baseSlides.length, overrideSlides.length);
    const slides = Array.from({ length: maxSlides }, (_unused, index) => ({
      ...(baseSlides[index] || {}),
      ...(overrideSlides[index] || {})
    }));

    return {
      ...basePlan,
      ...overridePlan,
      outline: overridePlan.outline || basePlan.outline || "",
      slides,
      thesis: overridePlan.thesis || basePlan.thesis || "",
      narrativeArc: overridePlan.narrativeArc || basePlan.narrativeArc || ""
    };
  };

  const previousDeckPlan = mergeDeckPlan(current.deckPlan, body.deckPlan || current.deckPlan);
  const outlineLocks = normalizeOutlineLocks(body.outlineLocks || current.outlineLocks);
  const lockedSlides = buildLockedOutlineContext(previousDeckPlan, outlineLocks);
  const previousSlides = Array.isArray(previousDeckPlan && previousDeckPlan.slides) ? previousDeckPlan.slides : [];
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
    message: `Generated an outline with ${deckPlan.slides.length} slide${deckPlan.slides.length === 1 ? "" : "s"}. Approve it before creating slides.`,
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

async function handlePresentationDraftOutlineSlide(req, res) {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const sourceDeckPlan = body.deckPlan || current.deckPlan;
  const slides = Array.isArray(sourceDeckPlan && sourceDeckPlan.slides) ? sourceDeckPlan.slides : [];
  const slideIndex = Number.parseInt(body.slideIndex, 10);
  if (!slides.length || !Number.isFinite(slideIndex) || slideIndex < 0 || slideIndex >= slides.length) {
    throw new Error("Expected a valid outline slide to regenerate");
  }

  const fields = {
    ...normalizeCreationFields({
      ...(current.fields || {}),
      ...(body.fields || {})
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

  const keepLocks = Object.fromEntries(slides.map((_slide, index) => [String(index), index !== slideIndex]));
  const result = await generateInitialDeckPlan({
    ...fields,
    lockedOutlineSlides: buildLockedOutlineContext(sourceDeckPlan, keepLocks, { excludeIndex: slideIndex }),
    onProgress: reportProgress
  });
  const generatedSlides = Array.isArray(result.plan && result.plan.slides) ? result.plan.slides : [];
  const replacement = generatedSlides[slideIndex];
  if (!replacement) {
    throw new Error("Regenerated outline did not include the requested slide");
  }

  const nextSlides = slides.map((slide, index) => index === slideIndex ? replacement : slide);
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

async function handlePresentationDraftApprove(req, res) {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const outlineLocks = body.outlineLocks ? normalizeOutlineLocks(body.outlineLocks) : current.outlineLocks;
  const sourceDeckPlan = current.deckPlan || body.deckPlan;
  if (!sourceDeckPlan || !Array.isArray(sourceDeckPlan.slides) || !sourceDeckPlan.slides.length) {
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

async function handlePresentationDraftCreate(req, res) {
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
    createdPresentationId: null,
    deckPlan,
    fields,
    outlineDirty: false,
    stage: "content"
  });
  publishCreationDraftUpdate(draft);

  createJsonResponse(res, 202, {
    creationDraft: draft,
    runtime: serializeRuntimeState()
  });

  const slugify = (value, fallback) => {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
    return slug || fallback;
  };

  const starterGenerationMaterials = starterMaterials.map((material, index) => {
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

  const runGeneration = async () => {
    try {
      const contentRunState = (next) => {
        const latest = getPresentationCreationDraft();
        const run = latest && latest.contentRun;
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

      const shouldStop = () => {
        const latest = getPresentationCreationDraft();
        const run = latest && latest.contentRun;
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
      const searchedMaterials = imageSearch && Array.isArray(imageSearch.results)
        ? imageSearch.results.map((result, index) => ({
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

      contentRunState({
        materials: generationMaterials,
        sourceText: starterSourceText
      });

      const draftFields = {
        ...fields,
        includeActiveMaterials: false,
        includeActiveSources: false,
        onProgress: null,
        presentationMaterials: generationMaterials,
        presentationSourceText: starterSourceText
      };

      const setSlideState = (index, next) => {
        const latest = getPresentationCreationDraft();
        const run = latest && latest.contentRun;
        if (!run || run.id !== runId || !Array.isArray(run.slides)) {
          return null;
        }

        const slides = run.slides.map((slide, idx) => idx === index ? { ...slide, ...next } : slide);
        const completed = slides.filter((slide) => slide.status === "complete").length;
        return contentRunState({
          completed,
          slides
        });
      };

      const reportProgressWithRun = (progress) => {
        if (
          progress
          && progress.stage === "drafting-slide"
          && Number.isFinite(Number(progress.slideIndex))
          && Number.isFinite(Number(progress.slideCount))
          && progress.slideIndex >= 1
          && progress.slideIndex <= slideCount
        ) {
          setSlideState(progress.slideIndex - 1, { status: "generating", error: null });
        }

        reportProgress(progress);
      };

      draftFields.onProgress = reportProgressWithRun;

      const generated = await generatePresentationFromDeckPlanIncremental(draftFields, deckPlan, {}, {
        onSlide: async (partial) => {
          const slideIndexZero = partial.slideIndex - 1;
          const validatedSpec = validateSlideSpec(partial.slideSpec);
          const contextKey = `slide-${String(partial.slideIndex).padStart(2, "0")}`;
          setSlideState(slideIndexZero, {
            slideContext: partial.slideContexts && typeof partial.slideContexts === "object" ? partial.slideContexts[contextKey] || null : null,
            slideSpec: validatedSpec,
            status: "complete"
          });
          reportProgress({
            message: `Completed slide ${partial.slideIndex}/${partial.slideCount}.`,
            slideCount: partial.slideCount,
            slideIndex: partial.slideIndex,
            stage: "completed-slide"
          });
        },
        shouldStop
      });

      reportProgress({
        message: "Finalizing generated slides into deck files...",
        stage: "finalizing"
      });

      const presentation = createPresentation({
        ...fields,
        outline: deckPlan.outline || "",
        targetSlideCount: fields.targetSlideCount,
        title: fields.title
      });
      setActivePresentation(presentation.id);

      if (starterSourceText) {
        await createSource({
          text: starterSourceText,
          title: "Starter sources"
        });
      }

      const importedMaterials = [];
      starterGenerationMaterials.forEach((material) => {
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

      const materialUrlById = new Map(importedMaterials.map((material) => [material.id, material.url]));
      const replaceMediaUrls = (spec) => {
        const next = JSON.parse(JSON.stringify(spec));
        if (next.media && typeof next.media === "object") {
          const url = materialUrlById.get(next.media.id);
          if (url) {
            next.media.src = url;
          }
        }
        if (Array.isArray(next.mediaItems)) {
          next.mediaItems = next.mediaItems.map((item) => {
            const url = item && materialUrlById.get(item.id);
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
      };

      const slideSpecs = Array.isArray(generated.slideSpecs) ? generated.slideSpecs.map(replaceMediaUrls) : [];
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
    } catch (error) {
      const latest = getPresentationCreationDraft();
      const run = latest && latest.contentRun && latest.contentRun.id === runId ? latest.contentRun : null;
      if (error && error.code === "CONTENT_RUN_STOPPED") {
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
        const firstIncomplete = run.slides.findIndex((slide) => slide.status !== "complete");
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
        const slides = run.slides.map((slide, index) => {
          if (failedIndex === index) {
            return {
              ...slide,
              error: String(error && error.message ? error.message : error),
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
            slides,
            status: "failed",
            updatedAt: new Date().toISOString()
          }
        });
        publishCreationDraftUpdate(nextDraft);
      }

      updateWorkflowState({
        message: String(error && error.message ? error.message : error),
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

function replaceMaterialUrlsInSlideSpec(spec, materialUrlById) {
  const next = JSON.parse(JSON.stringify(spec));
  if (next.media && typeof next.media === "object") {
    const url = materialUrlById.get(next.media.id);
    if (url) {
      next.media.src = url;
    }
  }
  if (Array.isArray(next.mediaItems)) {
    next.mediaItems = next.mediaItems.map((item) => {
      const url = item && materialUrlById.get(item.id);
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

async function importContentRunArtifacts(run) {
  const generationMaterials = Array.isArray(run && run.materials) ? run.materials : [];
  const importedMaterials = [];
  const starterGenerationMaterials = generationMaterials.filter((material) => material && material.dataUrl);
  starterGenerationMaterials.forEach((material) => {
    importedMaterials.push(createMaterialFromDataUrl({
      alt: material.alt,
      caption: material.caption,
      dataUrl: material.dataUrl,
      fileName: material.fileName,
      id: material.id,
      title: material.title
    }));
  });

  const remoteMaterials = generationMaterials.filter((material) => material && material.url && !material.dataUrl);
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

  if (run && run.sourceText) {
    await createSource({
      text: run.sourceText,
      title: "Starter sources"
    });
  }

  return new Map(importedMaterials.map((material) => [material.id, material.url]));
}

function createSkippedContentRunSlideSpec(planSlide, index, slideCount) {
  const title = String(planSlide && planSlide.title || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`;
  const timestamp = new Date().toISOString();

  return {
    index: index + 1,
    skipMeta: {
      keyMessage: String(planSlide && planSlide.keyMessage || ""),
      operation: "partial-content-acceptance",
      previousIndex: index + 1,
      role: String(planSlide && planSlide.role || ""),
      skippedAt: timestamp,
      sourceNeed: String(planSlide && planSlide.sourceNeed || ""),
      targetCount: slideCount,
      visualNeed: String(planSlide && planSlide.visualNeed || "")
    },
    skipped: true,
    skipReason: "Partial generation accepted before this slide was drafted.",
    title,
    type: "divider"
  };
}

function buildPartialContentRunDeck(run, deckPlan) {
  const planSlides = Array.isArray(deckPlan && deckPlan.slides) ? deckPlan.slides : [];
  const runSlides = Array.isArray(run && run.slides) ? run.slides : [];
  const slideCount = planSlides.length;
  const slideContexts = {};
  const slideSpecs = planSlides.map((planSlide, index) => {
    const runSlide = runSlides[index] || {};
    const contextKey = `slide-${String(index + 1).padStart(2, "0")}`;
    if (runSlide.status === "complete" && runSlide.slideSpec) {
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

async function handlePresentationDraftContentAcceptPartial(res) {
  const current = getPresentationCreationDraft();
  const deckPlan = current.deckPlan;
  const run = current.contentRun;
  const planSlides = Array.isArray(deckPlan && deckPlan.slides) ? deckPlan.slides : [];
  const runSlides = Array.isArray(run && run.slides) ? run.slides : [];

  if (!deckPlan || !planSlides.length) {
    throw new Error("Expected an approved outline before accepting a partial deck");
  }
  if (!run || !runSlides.length) {
    throw new Error("No content run is available to accept");
  }
  if (run.status === "running") {
    throw new Error("Stop generation before accepting a partial deck");
  }
  if (!runSlides.some((slide) => slide && slide.status === "complete" && slide.slideSpec)) {
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

  const fields = normalizeCreationFields(current.fields || {});
  const { slideContexts, slideSpecs } = buildPartialContentRunDeck(run, deckPlan);
  const presentation = createPresentation({
    ...fields,
    outline: deckPlan.outline || "",
    targetSlideCount: planSlides.length,
    title: fields.title || "slideotter"
  });
  setActivePresentation(presentation.id);

  const materialUrlById = await importContentRunArtifacts(run);
  const finalSlideSpecs = slideSpecs.map((slideSpec) => slideSpec.skipped
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

  const skippedCount = finalSlideSpecs.filter((slideSpec) => slideSpec.skipped === true).length;
  updateWorkflowState({
    message: `Accepted ${finalSlideSpecs.length - skippedCount} completed slide${finalSlideSpecs.length - skippedCount === 1 ? "" : "s"} with ${skippedCount} skipped placeholder${skippedCount === 1 ? "" : "s"}.`,
    ok: true,
    operation: "accept-partial-presentation",
    stage: "completed",
    status: "completed"
  });
  runtimeState.lastError = null;
  publishRuntimeState();

  createJsonResponse(res, 200, {
    creationDraft: nextDraft,
    presentation: readPresentationSummary(presentation.id),
    runtime: serializeRuntimeState()
  });
}

async function handlePresentationDraftContentRetry(req, res) {
  const body = await readJsonBody(req);
  const current = getPresentationCreationDraft();
  const deckPlan = current.deckPlan;
  const run = current.contentRun;
  const slideCount = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides.length : 0;

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

  const seedSlides = run.slides.slice(0, startIndex);
  if (!seedSlides.every((slide) => slide && slide.status === "complete" && slide.slideSpec)) {
    throw new Error("Retry slide requires completed slides before the retry point");
  }

  const seedSlideSpecs = seedSlides.map((slide) => slide.slideSpec);
  const collectMediaIds = (spec) => {
    const ids = [];
    if (spec && spec.media && typeof spec.media === "object" && spec.media.id) {
      ids.push(spec.media.id);
    }
    if (spec && Array.isArray(spec.mediaItems)) {
      spec.mediaItems.forEach((item) => {
        if (item && item.id) {
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
  const nextSlides = Array.from({ length: slideCount }, (_unused, index) => {
    if (index < startIndex) {
      const seed = seedSlides[index];
      return {
        error: null,
        slideContext: seed.slideContext || null,
        slideSpec: seed.slideSpec || null,
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
      const generationMaterials = Array.isArray(run.materials) && run.materials.length ? run.materials : [];

      const draftFields = {
        ...normalizeCreationFields(current.fields || {}),
        includeActiveMaterials: false,
        includeActiveSources: false,
        onProgress: null,
        presentationMaterials: generationMaterials,
        presentationSourceText: run.sourceText || ""
      };

      const contentRunState = (next) => {
        const latest = getPresentationCreationDraft();
        const latestRun = latest && latest.contentRun;
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

      const shouldStop = () => {
        const latest = getPresentationCreationDraft();
        const latestRun = latest && latest.contentRun;
        return Boolean(latestRun && latestRun.id === runId && latestRun.stopRequested === true);
      };

      const setSlideState = (index, next) => {
        const latest = getPresentationCreationDraft();
        const latestRun = latest && latest.contentRun;
        if (!latestRun || latestRun.id !== runId || !Array.isArray(latestRun.slides)) {
          return null;
        }

        const slides = latestRun.slides.map((slide, idx) => idx === index ? { ...slide, ...next } : slide);
        const completed = slides.filter((slide) => slide.status === "complete").length;
        return contentRunState({
          completed,
          slides
        });
      };

      const reportProgressWithRun = (progress) => {
        if (
          progress
          && progress.stage === "drafting-slide"
          && Number.isFinite(Number(progress.slideIndex))
          && progress.slideIndex >= 1
          && progress.slideIndex <= slideCount
        ) {
          setSlideState(progress.slideIndex - 1, { status: "generating", error: null });
        }

        reportProgress(progress);
      };
      draftFields.onProgress = reportProgressWithRun;

      const generated = await generatePresentationFromDeckPlanIncremental(draftFields, deckPlan, {}, {
        initialGeneratedPlanSlides: [],
        initialSlideSpecs: seedSlideSpecs,
        onSlide: async (partial) => {
          const slideIndexZero = partial.slideIndex - 1;
          const validatedSpec = validateSlideSpec(partial.slideSpec);
          const contextKey = `slide-${String(partial.slideIndex).padStart(2, "0")}`;
          setSlideState(slideIndexZero, {
            slideContext: partial.slideContexts && typeof partial.slideContexts === "object" ? partial.slideContexts[contextKey] || null : null,
            slideSpec: validatedSpec,
            status: "complete"
          });
          reportProgress({
            message: `Completed slide ${partial.slideIndex}/${partial.slideCount}.`,
            slideCount: partial.slideCount,
            slideIndex: partial.slideIndex,
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
        ...current.fields,
        outline: deckPlan.outline || "",
        targetSlideCount: slideCount,
        title: current.fields && current.fields.title ? current.fields.title : "slideotter"
      });
      setActivePresentation(presentation.id);

      const importedMaterials = [];
      const starterGenerationMaterials = generationMaterials.filter((material) => material && material.dataUrl);
      starterGenerationMaterials.forEach((material) => {
        importedMaterials.push(createMaterialFromDataUrl({
          alt: material.alt,
          caption: material.caption,
          dataUrl: material.dataUrl,
          fileName: material.fileName,
          id: material.id,
          title: material.title
        }));
      });

      const remoteMaterials = generationMaterials.filter((material) => material && material.url && !material.dataUrl);
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

      const materialUrlById = new Map(importedMaterials.map((material) => [material.id, material.url]));
      const replaceMediaUrls = (spec) => {
        const next = JSON.parse(JSON.stringify(spec));
        if (next.media && typeof next.media === "object") {
          const url = materialUrlById.get(next.media.id);
          if (url) {
            next.media.src = url;
          }
        }
        if (Array.isArray(next.mediaItems)) {
          next.mediaItems = next.mediaItems.map((item) => {
            const url = item && materialUrlById.get(item.id);
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
      };

      const slideSpecs = Array.isArray(generated.slideSpecs) ? generated.slideSpecs.map(replaceMediaUrls) : [];
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
    } catch (error) {
      const latest = getPresentationCreationDraft();
      const latestRun = latest && latest.contentRun && latest.contentRun.id === runId ? latest.contentRun : null;
      if (error && error.code === "CONTENT_RUN_STOPPED") {
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
        const firstIncomplete = latestRun.slides.findIndex((slide) => slide.status !== "complete");
        const failedIndexNext = firstIncomplete >= 0 ? firstIncomplete : null;
        const diagnostic = writeGenerationErrorDiagnostic(error, {
          deckTitle: current.fields && current.fields.title ? current.fields.title : "",
          operation: "retry-presentation-slide",
          planSlide: failedIndexNext === null ? null : deckPlan.slides[failedIndexNext] || null,
          runId,
          slideCount,
          slideIndex: failedIndexNext,
          workflow: runtimeState.workflow
        });
        const slides = latestRun.slides.map((slide, index) => {
          if (failedIndexNext === index) {
            return {
              ...slide,
              error: String(error && error.message ? error.message : error),
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
        message: String(error && error.message ? error.message : error),
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

async function handlePresentationDraftContentStop(res) {
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

async function handleRuntimeThemeSave(req, res) {
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

async function handleThemeGenerate(req, res) {
  const body = await readJsonBody(req);
  const result = await generateThemeFromBrief(body, {
    onProgress: (event) => {
      updateWorkflowState({
        detail: event.detail || event.message || "Generating theme from brief.",
        message: event.message || "Generating theme from brief.",
        operation: "theme-generate",
        stage: event.stage || "llm",
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

async function handlePresentationDuplicate(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  const presentation = duplicatePresentation(body.presentationId, {
    title: body.title
  });
  resetPresentationRuntime();
  createJsonResponse(res, 200, createPresentationPayload({ presentation }));
}

async function handlePresentationRegenerate(req, res) {
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

async function handlePresentationDelete(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.presentationId !== "string" || !body.presentationId) {
    throw new Error("Expected presentationId");
  }

  deletePresentation(body.presentationId);
  resetPresentationRuntime();
  createJsonResponse(res, 200, createPresentationPayload());
}

async function handleSlideSourceUpdate(req, res, slideId) {
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

async function handleSlideSpecUpdate(req, res, slideId) {
  const body = await readJsonBody(req);
  if (!body.slideSpec || typeof body.slideSpec !== "object" || Array.isArray(body.slideSpec)) {
    throw new Error("Expected an object field named slideSpec");
  }

  writeSlideSpec(slideId, body.slideSpec);
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

async function handleMaterialUpload(req, res) {
  const body = await readJsonBody(req);
  const material = createMaterialFromDataUrl(body || {});
  publishRuntimeState();

  createJsonResponse(res, 200, {
    material,
    materials: listMaterials()
  });
}

async function handleSourceCreate(req, res) {
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

async function handleSourceDelete(req, res) {
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

async function handleSlideMaterialUpdate(req, res, slideId) {
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

async function handleDeckContextUpdate(req, res) {
  const body = await readJsonBody(req);
  const context = updateDeckFields(body.deck || {});
  publishRuntimeState();
  createJsonResponse(res, 200, { context });
}

async function handleDeckStructureApply(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.outline !== "string" || !body.outline.trim()) {
    throw new Error("Expected a non-empty outline when applying a deck plan candidate");
  }

  const deckPatch = body.applyDeckPatch === false ? null : body.deckPatch;
  const sharedDeckUpdates = deckPatch && typeof deckPatch === "object"
    ? Object.keys(deckPatch).reduce((count, key) => {
      if (deckPatch[key] == null) {
        return count;
      }

      if (typeof deckPatch[key] === "object" && !Array.isArray(deckPatch[key])) {
        return count + Object.keys(deckPatch[key]).length;
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

async function handleDeckLengthPlan(req, res) {
  const body = await readJsonBody(req);
  createJsonResponse(res, 200, {
    plan: await planDeckLengthSemantic(body || {})
  });
}

async function handleDeckLengthApply(req, res) {
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
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide) => slide.skipped && !slide.archived),
    skippedSlidesChanged: result.skippedSlides,
    slides: result.slides
  });
}

async function handleSkippedSlideRestore(req, res) {
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
    skippedSlides: getSlides({ includeSkipped: true }).filter((slide) => slide.skipped && !slide.archived),
    slides: result.slides
  });
}

function sentenceValue(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function slugPart(value, fallback = "system") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || fallback;
}

function renumberOutlineWithInsert(outline, title, targetIndex) {
  const lines = String(outline || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, ""));
  const insertIndex = Math.min(Math.max(Number(targetIndex) - 1, 0), lines.length);
  lines.splice(insertIndex, 0, title);
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function renumberOutlineWithoutIndex(outline, targetIndex) {
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

function createManualSystemSlideSpec({ summary, targetIndex, title }) {
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

function createManualDividerSlideSpec({ targetIndex, title }) {
  return {
    type: "divider",
    index: targetIndex,
    title: sentenceValue(title, "New section")
  };
}

function createManualQuoteSlideSpec({ quote, targetIndex, title }) {
  return {
    type: "quote",
    index: targetIndex,
    title: sentenceValue(title, "Pull quote"),
    quote: sentenceValue(quote, "Add a sourced quote or authored pull quote here.")
  };
}

function createManualPhotoSlideSpec({ caption, materialId, targetIndex, title }) {
  const material = getMaterial(materialId);
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
    title: sentenceValue(title, material.title || "Photo"),
    media,
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

function materialToSlideMedia(material, captionOverride = "") {
  const safeCaption = String(captionOverride || material.caption || "").replace(/\s+/g, " ").trim();
  return {
    alt: String(material.alt || material.title).replace(/\s+/g, " ").trim() || material.title,
    id: material.id,
    src: material.url,
    title: material.title,
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

function createManualPhotoGridSlideSpec({ caption, materialIds, targetIndex, title }) {
  const uniqueMaterialIds = Array.from(new Set(Array.isArray(materialIds) ? materialIds : []))
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  if (uniqueMaterialIds.length < 2) {
    throw new Error("Photo grid slides need 2-4 materials");
  }

  const materials = uniqueMaterialIds.map((materialId) => getMaterial(materialId));
  const safeCaption = String(caption || "").replace(/\s+/g, " ").trim();

  return {
    type: "photoGrid",
    index: targetIndex,
    title: sentenceValue(title, "Photo grid"),
    mediaItems: materials.map((material) => materialToSlideMedia(material)),
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

async function handleManualSystemSlideCreate(req, res) {
  const body = await readJsonBody(req);
  const slideType = ["divider", "quote", "photo", "photoGrid"].includes(body.slideType) ? body.slideType : "content";
  const title = sentenceValue(body.title, "New system");
  const summary = sentenceValue(
    body.summary,
    "Describe the system boundary, the signal to watch, and the guardrails that keep the deck workflow repeatable."
  );
  const activeSlides = getSlides();
  const afterSlide = activeSlides.find((slide) => slide.id === body.afterSlideId) || null;
  const targetIndex = afterSlide ? afterSlide.index + 1 : activeSlides.length + 1;
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

async function handleManualSlideDelete(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected a slideId to remove");
  }

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

async function handleSlideContextUpdate(req, res, slideId) {
  const body = await readJsonBody(req);
  const context = updateSlideContext(slideId, body || {});
  createJsonResponse(res, 200, {
    context,
    slideContext: context.slides[slideId] || {}
  });
}

async function handleVariantCapture(req, res) {
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

async function handleVariantApply(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.variantId !== "string" || !body.variantId) {
    throw new Error("Expected variantId when applying a variant");
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

async function handleIdeateSlide(req, res) {
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

async function handleDrillWording(req, res) {
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

async function handleIdeateTheme(req, res) {
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

async function handleIdeateDeckStructure(req, res) {
  const body = await readJsonBody(req);
  const reportProgress = createWorkflowProgressReporter({
    dryRun: true,
    operation: "ideate-deck-structure"
  });
  const result = await ideateDeckStructure({
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

async function handleIdeateStructure(req, res) {
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

async function handleRedoLayout(req, res) {
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

async function handleAssistantSession(req, res, url) {
  const sessionId = url.searchParams.get("sessionId") || "default";
  createJsonResponse(res, 200, {
    session: getAssistantSession(sessionId),
    suggestions: getAssistantSuggestions()
  });
}

async function handleAssistantSend(req, res) {
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

  if (result.action && (result.action.type === "ideate-slide" || result.action.type === "ideate-structure" || result.action.type === "ideate-theme" || result.action.type === "drill-wording" || result.action.type === "redo-layout")) {
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

async function handleApi(req, res, url) {
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
    const page = previews.pages.find((entry) => entry.index === index) || null;
    createJsonResponse(res, 200, {
      page,
      slide: getSlides().find((entry) => entry.index === index) || null
    });
    return;
  }

  const slideMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)$/);
  if (req.method === "GET" && slideMatch) {
    const slideId = slideMatch[1];
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
    await handleSlideSourceUpdate(req, res, slideSourceMatch[1]);
    return;
  }

  const slideSpecMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/slide-spec$/);
  if (req.method === "POST" && slideSpecMatch) {
    await handleSlideSpecUpdate(req, res, slideSpecMatch[1]);
    return;
  }

  const slideMaterialMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/material$/);
  if (req.method === "POST" && slideMaterialMatch) {
    await handleSlideMaterialUpdate(req, res, slideMaterialMatch[1]);
    return;
  }

  const slideContextMatch = url.pathname.match(/^\/api\/slides\/([a-z0-9-]+)\/context$/);
  if (req.method === "POST" && slideContextMatch) {
    await handleSlideContextUpdate(req, res, slideContextMatch[1]);
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

function handleStatic(req, res, url) {
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
    sendFile(res, getMaterialFilePath(decodeURIComponent(materialMatch[1]), decodeURIComponent(materialMatch[2])));
    return;
  }

  if (url.pathname.startsWith("/studio-output/")) {
    const assetPath = path.join(outputDir, url.pathname.replace("/studio-output/", ""));
    sendFile(res, assetPath);
    return;
  }

  const fileName = url.pathname === "/"
    ? path.join(clientDir, "index.html")
    : path.join(clientDir, url.pathname.replace(/^\/+/, ""));

  const tsClientScript = path.extname(fileName).toLowerCase() === ".js"
    ? `${fileName.slice(0, -3)}.ts`
    : null;

  if (
    (fs.existsSync(fileName) && fs.statSync(fileName).isFile()) ||
    (tsClientScript && fs.existsSync(tsClientScript) && fs.statSync(tsClientScript).isFile())
  ) {
    sendFile(res, fileName);
    return;
  }

  sendFile(res, path.join(clientDir, "index.html"));
}

async function requestHandler(req, res) {
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
        message: error.message,
        ok: false,
        stage: "failed",
        status: "failed"
      });
    }
    runtimeState.lastError = {
      message: error.message,
      updatedAt: new Date().toISOString()
    };
    publishRuntimeState();
    createJsonResponse(res, 500, {
      error: error.message
    });
  }
}

function startServer(options: any = {}) {
  const host = options.host || defaultHost;
  const port = Number(options.port ?? defaultPort);

  ensureState();

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
