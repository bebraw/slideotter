const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { startServer } = require("../studio/server/index.ts");
const { listPresentations } = require("../studio/server/services/presentations.ts");

async function startTestServer() {
  const server = startServer({ port: 0 });
  if (!server.listening) {
    await once(server, "listening");
  }

  const address = server.address();
  const port = address && typeof address === "object" ? address.port : null;
  assert.ok(port, "Hypermedia API tests need a local server port");

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server
  };
}

async function getJson(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return {
    body: await response.json(),
    status: response.status
  };
}

async function postJson(baseUrl, pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return {
    body: await response.json(),
    status: response.status
  };
}

function findAction(resource, id) {
  return Array.isArray(resource.actions)
    ? resource.actions.find((entry) => entry.id === id)
    : null;
}

test("versioned API root exposes stable hypermedia entry points", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const response = await getJson(baseUrl, "/api/v1");

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "studio");
    assert.equal(response.body.version, "v1");
    assert.equal(response.body.links.self.href, "/api/v1");
    assert.equal(response.body.links.presentations.href, "/api/v1/presentations");
    assert.equal(response.body.links.activePresentation.href, `/api/v1/presentations/${response.body.state.activePresentationId}`);
    assert.equal(response.body.links.schemas.href, "/api/v1/schemas");

    const createPresentation = findAction(response.body, "create-presentation");
    assert.equal(createPresentation.method, "POST");
    assert.equal(createPresentation.href, "/api/presentations");
    assert.equal(createPresentation.effect, "write");
    assert.equal(createPresentation.input, "createPresentationRequest");
    assert.deepEqual(createPresentation.audience, ["local", "headless"]);
  } finally {
    server.close();
  }
});

test("presentation resource advertises relation names and versioned write actions", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const response = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "presentation");
    assert.equal(response.body.id, activePresentationId);
    assert.equal(response.body.links.self.href, `/api/v1/presentations/${activePresentationId}`);
    assert.equal(response.body.links.slides.href, `/api/v1/presentations/${activePresentationId}/slides`);
    assert.equal(response.body.links.checks.href, "/api/validate");
    assert.equal(response.body.links.exports.href, "/api/build");
    assert.equal(response.body.links.present.href, `/present/${activePresentationId}`);
    assert.ok(response.body.state.baseVersion);
    assert.ok(Array.isArray(response.body.slides));
    assert.ok(response.body.slides.length > 0);

    const saveContext = findAction(response.body, "save-deck-context");
    assert.equal(saveContext.effect, "write");
    assert.equal(saveContext.scope, "deck");
    assert.equal(saveContext.baseVersion, response.body.state.baseVersion);

    const exportPdf = findAction(response.body, "export-pdf");
    assert.equal(exportPdf.effect, "export");
    assert.equal(exportPdf.links.result.href, "/api/preview/deck");

    assert.equal(findAction(response.body, "select-presentation"), undefined);
  } finally {
    server.close();
  }
});

test("slide resource exposes current affordances without advertising invalid apply actions", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const slideId = presentation.body.slides[0].id;
    const response = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "slide");
    assert.equal(response.body.id, slideId);
    assert.equal(response.body.links.presentation.href, `/api/v1/presentations/${activePresentationId}`);
    assert.equal(response.body.links.workflows.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}/workflows`);
    assert.equal(response.body.links.candidates.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}/candidates`);
    assert.equal(response.body.links.preview.href, `/api/preview/slide/${response.body.state.index}`);
    assert.ok(response.body.state.baseVersion);
    assert.ok(response.body.state.family);

    const saveSlideSpec = findAction(response.body, "save-slide-spec");
    assert.equal(saveSlideSpec.effect, "write");
    assert.equal(saveSlideSpec.scope, "slide");
    assert.equal(saveSlideSpec.baseVersion, response.body.state.baseVersion);

    const wording = findAction(response.body, "generate-wording-candidates");
    assert.equal(wording.effect, "candidate");
    assert.equal(wording.links.result.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);

    const applyCandidate = findAction(response.body, "apply-candidate");
    if (response.body.variants.length) {
      assert.equal(applyCandidate.effect, "write");
      assert.equal(applyCandidate.scope, "candidate");
    } else {
      assert.equal(applyCandidate, undefined);
    }
  } finally {
    server.close();
  }
});

test("candidate collection is a first-class slide resource", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const slideId = presentation.body.slides[0].id;
    const slide = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);
    const response = await getJson(baseUrl, slide.body.links.candidates.href);

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "candidateCollection");
    assert.equal(response.body.links.self.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}/candidates`);
    assert.equal(response.body.links.slide.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);
    assert.equal(response.body.links.compare.href, `/api/slides/${slideId}`);
    assert.equal(response.body.links.preview.href, slide.body.links.preview.href);
    assert.equal(response.body.state.baseVersion, slide.body.state.baseVersion);
    assert.ok(Array.isArray(response.body.candidates));

    response.body.candidates.forEach((candidate) => {
      assert.equal(candidate.links.applyTarget.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);
      assert.match(candidate.links.self.href, new RegExp(`^/api/v1/presentations/${activePresentationId}/slides/${slideId}/candidates/`));
    });
  } finally {
    server.close();
  }
});

test("slide workflow collection exposes only candidate-producing actions", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const slideId = presentation.body.slides[0].id;
    const response = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}/slides/${slideId}/workflows`);

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "slideWorkflowCollection");
    assert.equal(response.body.links.slide.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);
    assert.ok(response.body.actions.length >= 3);
    response.body.actions.forEach((entry) => {
      assert.equal(entry.effect, "candidate");
      assert.equal(entry.scope, "slide");
      assert.equal(entry.baseVersion, response.body.state.baseVersion);
    });
  } finally {
    server.close();
  }
});

test("write actions reject stale advertised presentation versions", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const saveContext = findAction(presentation.body, "save-deck-context");

    assert.ok(saveContext.baseVersion);

    const staleResponse = await postJson(baseUrl, saveContext.href, {
      baseVersion: `${saveContext.baseVersion}:stale`,
      deck: {}
    });

    assert.equal(staleResponse.status, 409);
    assert.equal(staleResponse.body.code, "STALE_RESOURCE_VERSION");
    assert.match(staleResponse.body.error, /Presentation changed/);
  } finally {
    server.close();
  }
});

test("write actions reject stale advertised slide versions", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const slideId = presentation.body.slides[0].id;
    const slide = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);
    const saveSlideSpec = findAction(slide.body, "save-slide-spec");

    assert.ok(saveSlideSpec.baseVersion);

    const staleResponse = await postJson(baseUrl, saveSlideSpec.href, {
      baseVersion: `${saveSlideSpec.baseVersion}:stale`,
      rebuild: false,
      slideSpec: slide.body.slideSpec
    });

    assert.equal(staleResponse.status, 409);
    assert.equal(staleResponse.body.code, "STALE_RESOURCE_VERSION");
    assert.match(staleResponse.body.error, /Slide changed/);
  } finally {
    server.close();
  }
});
