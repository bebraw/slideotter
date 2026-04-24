const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { loadEnvFiles } = require("./services/env");

loadEnvFiles();

const { getAssistantSession, getAssistantSuggestions, handleAssistantMessage } = require("./services/assistant");
const { buildAndRenderDeck, getPreviewManifest } = require("./services/build");
const { getDomPreviewState, renderDomPreviewDocument } = require("./services/dom-preview");
const { getLlmStatus, verifyLlmConnection } = require("./services/llm/client");
const { clientDir, outputDir } = require("./services/paths");
const { applyDeckStructurePlan, ensureState, getDeckContext, updateDeckFields, updateSlideContext } = require("./services/state");
const { archiveStructuredSlide, getSlide, getSlides, insertStructuredSlide, readSlideSource, readSlideSpec, writeSlideSource, writeSlideSpec } = require("./services/slides");
const { applyDeckStructureCandidate, drillWordingSlide, ideateDeckStructure, ideateStructureSlide, ideateThemeSlide, ideateSlide, redoLayoutSlide } = require("./services/operations");
const { validateDeck } = require("./services/validate");
const {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listAllVariants,
  listVariantsForSlide,
  migrateLegacyStructuredVariants
} = require("./services/variants");

const defaultPort = Number(process.env.PORT || 4173);
const defaultHost = process.env.HOST || "127.0.0.1";

const runtimeState = {
  build: {
    ok: false,
    updatedAt: null
  },
  lastError: null,
  llmCheck: null,
  validation: null,
  workflow: null,
  workflowHistory: [],
  workflowSequence: 0
};
const runtimeSubscribers = new Set();

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
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

function sendFile(res, fileName) {
  if (!fs.existsSync(fileName) || !fs.statSync(fileName).isFile()) {
    notFound(res);
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png"
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
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    slides: getSlides(),
    variantStorage: {
      ...getVariantStorageStatus(),
      migratedThisLoad: variantMigration.migrated
    },
    variants: listAllVariants()
  };
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

async function handleManualSystemSlideCreate(req, res) {
  const body = await readJsonBody(req);
  const title = sentenceValue(body.title, "New system");
  const summary = sentenceValue(
    body.summary,
    "Describe the system boundary, the signal to watch, and the guardrails that keep the deck workflow repeatable."
  );
  const activeSlides = getSlides();
  const afterSlide = activeSlides.find((slide) => slide.id === body.afterSlideId) || null;
  const targetIndex = afterSlide ? afterSlide.index + 1 : activeSlides.length + 1;
  const slideSpec = createManualSystemSlideSpec({ summary, targetIndex, title });
  const created = insertStructuredSlide(slideSpec, targetIndex);
  const currentContext = getDeckContext();
  const outline = renumberOutlineWithInsert(currentContext.deck && currentContext.deck.outline, title, targetIndex);

  updateDeckFields({ outline });
  const context = updateSlideContext(created.id, {
    title,
    intent: summary,
    mustInclude: "Boundary, signal, owner, feedback loop, and validation check.",
    notes: "Manual system slide created from the Deck Planning page.",
    layoutHint: "Use the content system-slide layout with concise labels."
  });
  const previews = (await buildAndRenderDeck()).previews;

  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  updateWorkflowState({
    message: `Added manual system slide ${title}.`,
    ok: true,
    operation: "add-system-slide",
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
    generationMode: body.generationMode,
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
    generationMode: body.generationMode,
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
    generationMode: body.generationMode,
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
    generationMode: body.generationMode,
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
    generationMode: body.generationMode,
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
    generationMode: body.generationMode,
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

  if (req.method === "POST" && url.pathname === "/api/context") {
    await handleDeckContextUpdate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/context/deck-structure/apply") {
    await handleDeckStructureApply(req, res);
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

  if (req.method === "GET" && url.pathname === "/deck-preview") {
    createTextResponse(res, 200, renderDomPreviewDocument(), "text/html; charset=utf-8");
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
  if (url.pathname.startsWith("/studio-output/")) {
    const assetPath = path.join(outputDir, url.pathname.replace("/studio-output/", ""));
    sendFile(res, assetPath);
    return;
  }

  const fileName = url.pathname === "/"
    ? path.join(clientDir, "index.html")
    : path.join(clientDir, url.pathname.replace(/^\/+/, ""));

  if (fs.existsSync(fileName) && fs.statSync(fileName).isFile()) {
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

function startServer(options = {}) {
  const host = options.host || defaultHost;
  const port = Number(options.port || defaultPort);

  ensureState();

  const server = http.createServer(requestHandler);
  server.listen(port, host, () => {
    process.stdout.write(`Presentation studio available at http://${host}:${port}\n`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
