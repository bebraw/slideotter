const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { loadEnvFiles } = require("./services/env");

loadEnvFiles();

const { getAssistantSession, getAssistantSuggestions, handleAssistantMessage } = require("./services/assistant");
const { buildAndRenderDeck, getPreviewManifest } = require("./services/build");
const { getLlmStatus, verifyLlmConnection } = require("./services/llm/client");
const { clientDir, outputDir } = require("./services/paths");
const { ensureState, getDeckContext, updateDeckFields, updateSlideContext } = require("./services/state");
const { getSlide, getSlides, readSlideSource, readSlideSpec, writeSlideSource, writeSlideSpec } = require("./services/slides");
const { drillWordingSlide, ideateSlide, redoLayoutSlide } = require("./services/operations");
const { validateDeck } = require("./services/validate");
const { applyVariant, captureVariant, listAllVariants, listVariantsForSlide } = require("./services/variants");

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
  workflow: null
};

function serializeRuntimeState() {
  const llm = getLlmStatus();
  return {
    ...runtimeState,
    llm: {
      ...llm,
      lastCheck: runtimeState.llmCheck
    }
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
  return {
    assistant: {
      session: getAssistantSession(),
      suggestions: getAssistantSuggestions()
    },
    context: getDeckContext(),
    previews: getPreviewManifest(),
    runtime: serializeRuntimeState(),
    slides: getSlides(),
    variants: listAllVariants()
  };
}

function serializeSlideSpec(slideSpec) {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
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

  createJsonResponse(res, 200, {
    previews: result.previews,
    runtime: serializeRuntimeState()
  });
}

async function handleValidate(req, res) {
  const body = await readJsonBody(req);
  const result = await validateDeck({
    includeRender: body.includeRender === true
  });

  runtimeState.validation = {
    includeRender: body.includeRender === true,
    ok: result.ok,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;
  createJsonResponse(res, 200, result);
}

async function handleLlmCheck(res) {
  const result = await verifyLlmConnection();
  runtimeState.llmCheck = result;
  runtimeState.lastError = null;

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
  const previews = body.rebuild === false ? getPreviewManifest() : (await buildAndRenderDeck()).previews;

  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;
  const structured = describeStructuredSlide(slideId);

  createJsonResponse(res, 200, {
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
  const previews = body.rebuild === false ? getPreviewManifest() : (await buildAndRenderDeck()).previews;

  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;
  const structured = describeStructuredSlide(slideId);

  createJsonResponse(res, 200, {
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
  createJsonResponse(res, 200, { context });
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
  createJsonResponse(res, 200, {
    variant,
    variants: listVariantsForSlide(body.slideId)
  });
}

async function handleVariantApply(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.variantId !== "string" || !body.variantId) {
    throw new Error("Expected variantId when applying a variant");
  }

  const variant = applyVariant(body.variantId);
  const previews = (await buildAndRenderDeck()).previews;
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;

  const structured = describeStructuredSlide(variant.slideId);
  createJsonResponse(res, 200, {
    previews,
    slideSpec: structured.slideSpec,
    source: structured.slideSpec ? serializeSlideSpec(structured.slideSpec) : readSlideSource(variant.slideId),
    slideId: variant.slideId,
    variant
  });
}

async function handleIdeateSlide(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when ideating a slide");
  }

  const result = await ideateSlide(body.slideId, {
    generationMode: body.generationMode,
    dryRun: body.dryRun === true
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.workflow = {
    dryRun: body.dryRun === true,
    generation: result.generation,
    ok: true,
    operation: "ideate-slide",
    slideId: body.slideId,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;

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
    transientVariants: result.dryRun ? result.variants : [],
    variants: listAllVariants()
  });
}

async function handleDrillWording(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when drilling wording");
  }

  const result = await drillWordingSlide(body.slideId, {
    generationMode: body.generationMode,
    dryRun: body.dryRun !== false
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.workflow = {
    dryRun: body.dryRun !== false,
    generation: result.generation,
    ok: true,
    operation: "drill-wording",
    slideId: body.slideId,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;

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
    transientVariants: result.dryRun ? result.variants : [],
    variants: listAllVariants()
  });
}

async function handleRedoLayout(req, res) {
  const body = await readJsonBody(req);
  if (typeof body.slideId !== "string" || !body.slideId) {
    throw new Error("Expected slideId when redoing layout");
  }

  const result = await redoLayoutSlide(body.slideId, {
    generationMode: body.generationMode,
    dryRun: body.dryRun !== false
  });
  runtimeState.build = {
    ok: true,
    updatedAt: new Date().toISOString()
  };
  runtimeState.workflow = {
    dryRun: body.dryRun !== false,
    generation: result.generation,
    ok: true,
    operation: "redo-layout",
    slideId: body.slideId,
    updatedAt: new Date().toISOString()
  };
  runtimeState.lastError = null;

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
    transientVariants: result.dryRun ? result.variants : [],
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
    dryRun: body.dryRun !== false,
    generationMode: body.generationMode,
    message: body.message,
    sessionId: typeof body.sessionId === "string" && body.sessionId ? body.sessionId : "default",
    slideId: typeof body.slideId === "string" && body.slideId ? body.slideId : null
  });

  if (result.action && (result.action.type === "ideate-slide" || result.action.type === "drill-wording" || result.action.type === "redo-layout")) {
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    runtimeState.workflow = {
      dryRun: result.action.dryRun,
      generation: result.action.generation,
      ok: true,
      operation: `assistant-${result.action.type}`,
      slideId: result.action.slideId,
      updatedAt: new Date().toISOString()
    };
  }

  if (result.action && result.action.type === "validate" && result.validation) {
    runtimeState.validation = {
      includeRender: result.action.includeRender,
      ok: result.validation.ok,
      updatedAt: new Date().toISOString()
    };
  }

  runtimeState.lastError = null;

  createJsonResponse(res, 200, {
    action: result.action,
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

  if (req.method === "GET" && url.pathname === "/api/preview/deck") {
    createJsonResponse(res, 200, getPreviewManifest());
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
    runtimeState.lastError = {
      message: error.message,
      updatedAt: new Date().toISOString()
    };
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
