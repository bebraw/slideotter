const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { startServer } = require("../studio/server/index.ts");
const {
  clearPresentationCreationDraft,
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");

const originalFetch = global.fetch;
const originalActivePresentationId = listPresentations().activePresentationId;
const llmEnvKeys = [
  "LMSTUDIO_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createLmStudioStreamResponse(data) {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { content }, finish_reason: null }],
        id: `chatcmpl-progressive-${Date.now()}`,
        model: "progressive-content-run-test"
      })}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200
  });
}

function roleForSlide(index, total) {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  return ["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5];
}

function createDeckPlan(title, slideCount) {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const label = `${title} ${index + 1}`;
    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear generated message.`,
      role: roleForSlide(index, slideCount),
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "Progressive test audience",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should exercise progressive generation.`
  };
}

function createGeneratedPlan(title, slideNumber, total) {
  const absoluteIndex = slideNumber - 1;
  const label = `${title} ${slideNumber}`;
  return {
    outline: `${slideNumber}. ${label}`,
    references: [],
    slides: [
      {
        eyebrow: absoluteIndex === 0 ? "Opening" : absoluteIndex === total - 1 ? "Close" : `Step ${slideNumber}`,
        guardrails: [
          { body: `${label} guardrail one is specific.`, title: `${label} check A` },
          { body: `${label} guardrail two is specific.`, title: `${label} check B` },
          { body: `${label} guardrail three is specific.`, title: `${label} check C` }
        ],
        guardrailsTitle: `${label} checks`,
        keyPoints: [
          { body: `${label} carries generated draft content.`, title: `${label} point A` },
          { body: `${label} adds a second distinct idea.`, title: `${label} point B` },
          { body: `${label} adds a third distinct idea.`, title: `${label} point C` },
          { body: `${label} adds a fourth distinct idea.`, title: `${label} point D` }
        ],
        mediaMaterialId: "",
        note: `${label} has a speaker note.`,
        resources: [
          { body: `${label} resource one.`, title: `${label} resource A` },
          { body: `${label} resource two.`, title: `${label} resource B` }
        ],
        resourcesTitle: `${label} resources`,
        role: roleForSlide(absoluteIndex, total),
        signalsTitle: `${label} points`,
        summary: `${label} summarizes one useful generated idea.`,
        title: label
      }
    ],
    summary: `${label} generated plan`
  };
}

function installLlmMock(handler) {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "progressive-content-run-test";

  global.fetch = async (url, init) => {
    if (!/\/chat\/completions$/.test(String(url))) {
      return originalFetch(url, init);
    }

    const requestBody = JSON.parse(init.body);
    const schemaName = requestBody.response_format && requestBody.response_format.json_schema && requestBody.response_format.json_schema.name;
    if (schemaName === "presentation_semantic_text_repairs") {
      return createLmStudioStreamResponse({ repairs: [] });
    }

    return handler(requestBody);
  };
}

function restoreLlmMock() {
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

async function waitForState(baseUrl, predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    const response = await originalFetch(`${baseUrl}/api/state`);
    latest = await response.json();
    if (predicate(latest)) {
      return latest;
    }
    await delay(25);
  }

  assert.fail(`Timed out waiting for state. Latest: ${JSON.stringify(latest)}`);
}

async function postJson(baseUrl, pathName, body = {}) {
  const response = await originalFetch(`${baseUrl}${pathName}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return {
    payload,
    status: response.status
  };
}

async function startTestServer() {
  clearPresentationCreationDraft();
  const server = startServer({ port: 0 });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
}

function cleanupGeneratedPresentations() {
  const current = listPresentations();
  current.presentations
    .filter((presentation) => /^progressive content run/i.test(presentation.title || ""))
    .forEach((presentation) => {
      try {
        deletePresentation(presentation.id);
      } catch (error) {
        // Keep cleanup best-effort so assertion failures stay visible.
      }
    });

  if (listPresentations().presentations.some((presentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  restoreLlmMock();
  clearPresentationCreationDraft();
  cleanupGeneratedPresentations();
});

test("draft create exposes completed slides before terminal deck creation", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_plan");
    requestCount += 1;
    const prompt = requestBody.messages.map((message) => message.content).join("\n");
    const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
    assert.ok(targetMatch);
    const slideNumber = Number.parseInt(targetMatch[1], 10);
    const total = Number.parseInt(targetMatch[2], 10);
    if (requestCount === 2) {
      await delay(250);
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run partial", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run partial", 3);
    const response = await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the deck concise.",
        objective: "Verify progressive visibility.",
        targetSlideCount: 3,
        title: "Progressive Content Run Partial",
        tone: "Direct"
      }
    });
    assert.equal(response.status, 202);

    const partial = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft && payload.creationDraft.contentRun;
      return run
        && run.status === "running"
        && run.completed >= 1
        && run.slides[0]
        && run.slides[0].status === "complete"
        && run.slides[0].slideSpec;
    });
    assert.equal(partial.creationDraft.stage, "content");
    assert.equal(partial.creationDraft.createdPresentationId, null);

    const finalState = await waitForState(baseUrl, (payload) => {
      return payload.creationDraft
        && payload.creationDraft.stage === "theme"
        && payload.creationDraft.createdPresentationId
        && Array.isArray(payload.slides)
        && payload.slides.length === 3;
    }, 5000);
    assert.equal(finalState.creationDraft.contentRun, null);
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});

test("failed content runs keep completed slides and retry from the failed slide", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    requestCount += 1;
    const prompt = requestBody.messages.map((message) => message.content).join("\n");
    const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
    assert.ok(targetMatch);
    const slideNumber = Number.parseInt(targetMatch[1], 10);
    const total = Number.parseInt(targetMatch[2], 10);
    if (requestCount === 2) {
      throw new Error("Synthetic slide failure");
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run retry", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run retry", 3);
    await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the deck concise.",
        objective: "Verify retry after failure.",
        targetSlideCount: 3,
        title: "Progressive Content Run Retry",
        tone: "Direct"
      }
    });

    const failed = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft && payload.creationDraft.contentRun;
      return run && run.status === "failed";
    });
    assert.equal(failed.creationDraft.contentRun.completed, 1);
    assert.equal(failed.creationDraft.contentRun.failedSlideIndex, 1);
    assert.equal(failed.creationDraft.contentRun.slides[0].status, "complete");
    assert.equal(failed.creationDraft.contentRun.slides[1].status, "failed");

    const retryResponse = await postJson(baseUrl, "/api/presentations/draft/content/retry", {
      slideIndex: 1
    });
    assert.equal(retryResponse.status, 202);
    assert.equal(retryResponse.payload.creationDraft.contentRun.slides[0].status, "complete");
    assert.equal(retryResponse.payload.creationDraft.contentRun.slides[1].status, "pending");

    const finalState = await waitForState(baseUrl, (payload) => {
      return payload.creationDraft
        && payload.creationDraft.stage === "theme"
        && payload.creationDraft.createdPresentationId
        && Array.isArray(payload.slides)
        && payload.slides.length === 3;
    }, 5000);
    assert.equal(finalState.creationDraft.contentRun, null);
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});

test("stop content run keeps completed slides without writing a deck", async () => {
  const { baseUrl, server } = await startTestServer();
  let requestCount = 0;
  installLlmMock(async (requestBody) => {
    requestCount += 1;
    const prompt = requestBody.messages.map((message) => message.content).join("\n");
    const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
    assert.ok(targetMatch);
    const slideNumber = Number.parseInt(targetMatch[1], 10);
    const total = Number.parseInt(targetMatch[2], 10);
    if (requestCount === 2) {
      await delay(250);
    }
    return createLmStudioStreamResponse(createGeneratedPlan("Progressive content run stopped", slideNumber, total));
  });

  try {
    const deckPlan = createDeckPlan("Progressive content run stopped", 3);
    await postJson(baseUrl, "/api/presentations/draft/create", {
      approvedOutline: true,
      deckPlan,
      fields: {
        audience: "Maintainers",
        constraints: "Keep the deck concise.",
        objective: "Verify stopping generation.",
        targetSlideCount: 3,
        title: "Progressive Content Run Stopped",
        tone: "Direct"
      }
    });

    await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft && payload.creationDraft.contentRun;
      return run && run.status === "running" && run.completed >= 1;
    });
    const stopResponse = await postJson(baseUrl, "/api/presentations/draft/content/stop");
    assert.equal(stopResponse.status, 202);
    assert.equal(stopResponse.payload.creationDraft.contentRun.stopRequested, true);

    const stopped = await waitForState(baseUrl, (payload) => {
      const run = payload.creationDraft && payload.creationDraft.contentRun;
      return run && run.status === "stopped";
    }, 5000);
    assert.equal(stopped.creationDraft.stage, "content");
    assert.equal(stopped.creationDraft.createdPresentationId, null);
    assert.ok(stopped.creationDraft.contentRun.completed >= 1);
    assert.equal(stopped.creationDraft.contentRun.slides[0].status, "complete");
  } finally {
    server.close();
    await once(server, "close");
    restoreLlmMock();
    clearPresentationCreationDraft();
    cleanupGeneratedPresentations();
  }
});
