import assert from "node:assert/strict";
import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { once } from "node:events";
import test from "node:test";

const { startServer } = require("../studio/server/index.ts");
const { listPresentations } = require("../studio/server/services/presentations.ts");
const { recordDerivedSlideset } = require("../studio/server/services/memory.ts");

type HypermediaLink = {
  href: string;
};

type HypermediaLinks = Record<string, HypermediaLink> & {
  activePresentation: HypermediaLink;
  applyTarget: HypermediaLink;
  candidates: HypermediaLink;
  checks: HypermediaLink;
  compare: HypermediaLink;
  claims: HypermediaLink;
  concepts: HypermediaLink;
  dependentSlides: HypermediaLink;
  diagnostics: HypermediaLink;
  derivedSlidesets: HypermediaLink;
  evidence: HypermediaLink;
  exports: HypermediaLink;
  jobs: HypermediaLink;
  logs: HypermediaLink;
  memory: HypermediaLink;
  memoryItem: HypermediaLink;
  pdfPreview: HypermediaLink;
  present: HypermediaLink;
  presentation: HypermediaLink;
  presentations: HypermediaLink;
  preview: HypermediaLink;
  rerun: HypermediaLink;
  result: HypermediaLink;
  schemas: HypermediaLink;
  search: HypermediaLink;
  self: HypermediaLink;
  slide: HypermediaLink;
  slides: HypermediaLink;
  status: HypermediaLink;
  styleNotes: HypermediaLink;
  workflows: HypermediaLink;
};

type HypermediaAction = {
  audience?: string[];
  baseVersion?: string;
  effect?: string;
  href: string;
  id: string;
  input?: string;
  inputFields: [{ id: string }, ...Array<{ id: string }>];
  links: HypermediaLinks;
  method: string;
  scope?: string;
};

type HypermediaSchema = {
  fields: Array<{
    id: string;
    required?: boolean;
  }>;
  id: string;
};

type HypermediaCandidate = {
  links: HypermediaLinks;
};

type HypermediaMemoryItem = {
  confidence?: string;
  evidence?: Array<{ href: string; rel: string; title?: string }>;
  evidenceCount?: number;
  id: string;
  links: HypermediaLinks;
  status?: string;
  summary: string;
  tags?: string[];
  type: string;
  usedBy?: Array<{ href: string; rel: string; title?: string }>;
};

type HypermediaMemorySearchResult = {
  item: HypermediaMemoryItem;
  score: number;
};

type HypermediaDerivedSlideset = {
  links: HypermediaLinks;
  targetLength: number | null;
};

type HypermediaAuthoringFinding = {
  itemId: string;
  repairHref: string;
  rule: string;
};

type HypermediaResource = {
  actions: HypermediaAction[];
  authoringFindings: HypermediaAuthoringFinding[];
  candidates: HypermediaCandidate[];
  code: string;
  derivedSlidesets: HypermediaDerivedSlideset[];
  error: string;
  exports: [{ id: string }, ...Array<{ id: string }>];
  id: string;
  links: HypermediaLinks;
  evidence: Array<{ href: string; rel: string; title?: string }>;
  memoryItem: HypermediaMemoryItem;
  memoryItems: HypermediaMemoryItem[];
  resource: string;
  schemas: HypermediaSchema[];
  searchResults: HypermediaMemorySearchResult[];
  slideSpec: unknown;
  slides: [{ id: string }, ...Array<{ id: string }>];
  state: {
    activePresentationId: string;
    baseVersion: string;
    count: number;
    family: string;
    index: number;
    status: string;
  };
  variants: unknown[];
  version: string;
};

type JsonResponse = {
  body: HypermediaResource;
  status: number;
};

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

async function getJson(baseUrl: string, pathname: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${pathname}`);
  return {
    body: await response.json() as HypermediaResource,
    status: response.status
  };
}

async function postJson(baseUrl: string, pathname: string, payload: unknown): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return {
    body: await response.json() as HypermediaResource,
    status: response.status
  };
}

function findAction(resource: HypermediaResource, id: string): HypermediaAction | undefined {
  return Array.isArray(resource.actions)
    ? resource.actions.find((entry: HypermediaAction) => entry.id === id)
    : undefined;
}

function requireAction(resource: HypermediaResource, id: string): HypermediaAction {
  const action = findAction(resource, id);
  if (!action) {
    throw new Error(`Expected action ${id}`);
  }
  return action;
}

function requireSchema(resource: HypermediaResource, id: string): HypermediaSchema {
  const schema = resource.schemas.find((entry: HypermediaSchema) => entry.id === id);
  if (!schema) {
    throw new Error(`Expected schema ${id}`);
  }
  return schema;
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
    assert.equal(response.body.links.jobs.href, "/api/v1/jobs/current");
    assert.equal(response.body.links.schemas.href, "/api/v1/schemas");

    const createPresentation = requireAction(response.body, "create-presentation");
    assert.equal(createPresentation.method, "POST");
    assert.equal(createPresentation.href, "/api/v1/presentations");
    assert.equal(createPresentation.effect, "write");
    assert.equal(createPresentation.input, "createPresentationRequest");
    assert.equal(createPresentation.inputFields[0].id, "title");
    assert.deepEqual(createPresentation.audience, ["local", "headless"]);
  } finally {
    server.close();
  }
});

test("unversioned local studio API routes are not exposed", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/state`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not found");
  } finally {
    server.close();
  }
});

test("schema resource exposes compact input field metadata", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const root = await getJson(baseUrl, "/api/v1");
    const response = await getJson(baseUrl, root.body.links.schemas.href);

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "schemaCollection");

    const createPresentation = requireSchema(response.body, "createPresentationRequest");
    assert.ok(createPresentation.fields.some((field: { id: string; required?: boolean }) => field.id === "title" && field.required === true));

    const variantApply = requireSchema(response.body, "variantApplyRequest");
    assert.ok(variantApply.fields.some((field: { id: string }) => field.id === "baseVersion"));
  } finally {
    server.close();
  }
});

test("current runtime job is a stable navigable resource", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const root = await getJson(baseUrl, "/api/v1");
    const response = await getJson(baseUrl, root.body.links.jobs.href);

    assert.equal(response.status, 200);
    assert.equal(response.body.resource, "job");
    assert.equal(response.body.id, "current");
    assert.equal(response.body.links.self.href, "/api/v1/jobs/current");
    assert.equal(response.body.links.status.href, "/api/v1/runtime");
    assert.equal(response.body.links.logs.href, "/api/v1/runtime");
    assert.equal(response.body.links.diagnostics.href, "/api/v1/runtime");
    assert.match(response.body.links.result.href, /^\/api\/v1\/presentations\//);
    assert.ok(["idle", "running", "completed", "failed"].includes(response.body.state.status));
    assert.ok(Array.isArray(response.body.actions));
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
    assert.equal(response.body.links.checks.href, `/api/v1/presentations/${activePresentationId}/checks`);
    assert.equal(response.body.links.exports.href, `/api/v1/presentations/${activePresentationId}/exports`);
    assert.equal(response.body.links.memory.href, `/api/v1/presentations/${activePresentationId}/memory`);
    assert.equal(response.body.links.claims.href, `/api/v1/presentations/${activePresentationId}/memory?type=claim`);
    assert.equal(response.body.links.concepts.href, `/api/v1/presentations/${activePresentationId}/memory?type=concept`);
    assert.equal(response.body.links.styleNotes.href, `/api/v1/presentations/${activePresentationId}/memory?type=styleNote`);
    assert.equal(response.body.links.derivedSlidesets.href, `/api/v1/presentations/${activePresentationId}/memory/derived-slidesets`);
    assert.equal(response.body.links.present.href, `/present/${activePresentationId}`);
    assert.ok(response.body.state.baseVersion);
    assert.ok(Array.isArray(response.body.slides));
    assert.ok(response.body.slides.length > 0);

    const saveContext = requireAction(response.body, "save-deck-context");
    assert.equal(saveContext.effect, "write");
    assert.equal(saveContext.scope, "deck");
    assert.equal(saveContext.baseVersion, response.body.state.baseVersion);

    const exportPdf = requireAction(response.body, "export-pdf");
    assert.equal(exportPdf.effect, "export");
    assert.equal(exportPdf.links.result.href, "/api/v1/preview/deck");

    assert.equal(findAction(response.body, "select-presentation"), undefined);
  } finally {
    server.close();
  }
});

test("memory resources expose typed items, actions, search, and stale write protection", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const memory = await getJson(baseUrl, presentation.body.links.memory.href);

    assert.equal(memory.status, 200);
    assert.equal(memory.body.resource, "memoryCollection");
    assert.equal(memory.body.links.presentation.href, `/api/v1/presentations/${activePresentationId}`);
    assert.equal(memory.body.links.search.href, `/api/v1/presentations/${activePresentationId}/memory/search`);
    assert.ok(Array.isArray(memory.body.memoryItems));

    const createMemory = requireAction(memory.body, "create-memory-item");
    assert.equal(createMemory.effect, "write");
    assert.equal(createMemory.scope, "memory");
    assert.equal(createMemory.baseVersion, memory.body.state.baseVersion);

    const created = await postJson(baseUrl, createMemory.href, {
      baseVersion: createMemory.baseVersion,
      confidence: "high",
      detail: "Used to drive a derived short talk.",
      evidence: [
        {
          href: `/api/v1/presentations/${activePresentationId}/slides/slide-01`,
          rel: "slide",
          title: "Opening slide"
        }
      ],
      status: "accepted",
      summary: "Hypermedia memory keeps derived slidesets inspectable.",
      tags: ["hypermedia", "memory"],
      type: "claim"
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.resource, "memoryItem");
    assert.equal(created.body.memoryItem.type, "claim");
    assert.equal(created.body.memoryItem.status, "accepted");
    assert.equal(created.body.links.evidence.href, `/api/v1/presentations/${activePresentationId}/memory/${created.body.id}/evidence`);

    const staleUpdate = await postJson(baseUrl, created.body.links.self.href, {
      baseVersion: `${created.body.state.baseVersion}:stale`,
      summary: "This stale write should fail."
    });
    assert.equal(staleUpdate.status, 409);
    assert.equal(staleUpdate.body.code, "STALE_RESOURCE_VERSION");
    assert.match(staleUpdate.body.error, /Memory changed/);

    const fresh = await getJson(baseUrl, created.body.links.self.href);
    const updateMemory = requireAction(fresh.body, "update-memory-item");
    const updated = await postJson(baseUrl, updateMemory.href, {
      baseVersion: updateMemory.baseVersion,
      status: "stale",
      summary: "Hypermedia memory keeps derived slidesets inspectable and updateable."
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.memoryItem.status, "stale");
    assert.match(updated.body.memoryItem.summary, /updateable/);

    const linkEvidence = requireAction(updated.body, "link-memory-evidence");
    const linked = await postJson(baseUrl, linkEvidence.href, {
      baseVersion: linkEvidence.baseVersion,
      evidence: [
        {
          href: "/api/v1/sources/source-1",
          rel: "source",
          title: "Source note"
        }
      ]
    });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.memoryItem.evidence?.length, 2);

    const search = await postJson(baseUrl, memory.body.links.search.href, {
      query: "derived inspectable"
    });
    assert.equal(search.status, 200);
    assert.equal(search.body.resource, "memoryCollection");
    assert.ok(search.body.searchResults.some((result: HypermediaMemorySearchResult) => result.item.id === created.body.id));

    recordDerivedSlideset({
      memoryIds: [created.body.id],
      purpose: "Create a five-slide executive variant.",
      resultPresentationId: activePresentationId,
      sourcePresentationId: activePresentationId,
      targetLength: 5
    }, { presentationId: activePresentationId });
    const derivedSlidesets = await getJson(baseUrl, memory.body.links.derivedSlidesets.href);
    assert.equal(derivedSlidesets.status, 200);
    assert.equal(derivedSlidesets.body.resource, "derivedSlidesetCollection");
    assert.equal(derivedSlidesets.body.derivedSlidesets.length, 1);
    const derivedSlideset = derivedSlidesets.body.derivedSlidesets[0];
    assert.ok(derivedSlideset);
    assert.equal(derivedSlideset.targetLength, 5);
    assert.ok(derivedSlideset.links.sourcePresentation);
    assert.equal(derivedSlideset.links.sourcePresentation.href, `/api/v1/presentations/${activePresentationId}`);

    const checksWithStaleMemory = await getJson(baseUrl, presentation.body.links.checks.href);
    assert.ok(checksWithStaleMemory.body.authoringFindings.some((finding: { itemId: string; rule: string }) => (
      finding.itemId === created.body.id && finding.rule === "stale-used"
    )));

    const evidence = await getJson(baseUrl, linked.body.links.evidence.href);
    assert.equal(evidence.status, 200);
    assert.equal(evidence.body.resource, "memoryEvidenceCollection");
    assert.equal(evidence.body.evidence.length, 2);

    const dependentSlides = await getJson(baseUrl, linked.body.links.dependentSlides.href);
    assert.equal(dependentSlides.status, 200);
    assert.equal(dependentSlides.body.resource, "memoryDependentSlides");

    const afterDerived = await getJson(baseUrl, linked.body.links.self.href);
    const retire = requireAction(afterDerived.body, "retire-memory-item");
    const retired = await postJson(baseUrl, retire.href, {
      baseVersion: retire.baseVersion
    });
    assert.equal(retired.status, 200);
    assert.equal(retired.body.memoryItem.status, "retired");
    assert.equal(findAction(retired.body, "derive-slide-from-memory"), undefined);

    const checksWithRetiredMemory = await getJson(baseUrl, presentation.body.links.checks.href);
    assert.ok(checksWithRetiredMemory.body.authoringFindings.some((finding: { itemId: string; repairHref: string; rule: string }) => (
      finding.itemId === created.body.id
      && finding.rule === "retired-used"
      && finding.repairHref === `/api/v1/presentations/${activePresentationId}/memory/${created.body.id}`
    )));
  } finally {
    server.close();
  }
});

test("presentation checks and exports are navigable resources", async () => {
  const { baseUrl, server } = await startTestServer();

  try {
    const activePresentationId = listPresentations().activePresentationId;
    const presentation = await getJson(baseUrl, `/api/v1/presentations/${activePresentationId}`);
    const checks = await getJson(baseUrl, presentation.body.links.checks.href);
    const exports = await getJson(baseUrl, presentation.body.links.exports.href);

    assert.equal(checks.status, 200);
    assert.equal(checks.body.resource, "checkReport");
    assert.equal(checks.body.links.presentation.href, `/api/v1/presentations/${activePresentationId}`);
    assert.equal(checks.body.links.memory.href, `/api/v1/presentations/${activePresentationId}/memory`);
    assert.equal(checks.body.links.rerun.href, "/api/v1/validate");
    assert.ok(Array.isArray(checks.body.authoringFindings));
    const runValidation = requireAction(checks.body, "run-validation");
    assert.equal(runValidation.href, "/api/v1/validate");
    assert.equal(runValidation.links.result.href, checks.body.links.self.href);

    assert.equal(exports.status, 200);
    assert.equal(exports.body.resource, "exportCollection");
    assert.equal(exports.body.links.presentation.href, `/api/v1/presentations/${activePresentationId}`);
    assert.equal(exports.body.links.pdfPreview.href, "/api/v1/preview/deck");
    assert.equal(exports.body.exports[0].id, "pdf");
    const exportPdf = requireAction(exports.body, "export-pdf");
    assert.equal(exportPdf.href, "/api/v1/build");
    assert.equal(exportPdf.links.result.href, "/api/v1/preview/deck");
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
    assert.equal(response.body.links.preview.href, `/api/v1/preview/slide/${response.body.state.index}`);
    assert.ok(response.body.state.baseVersion);
    assert.ok(response.body.state.family);

    const saveSlideSpec = requireAction(response.body, "save-slide-spec");
    assert.equal(saveSlideSpec.effect, "write");
    assert.equal(saveSlideSpec.scope, "slide");
    assert.equal(saveSlideSpec.baseVersion, response.body.state.baseVersion);

    const wording = requireAction(response.body, "generate-wording-candidates");
    assert.equal(wording.effect, "candidate");
    assert.equal(wording.links.result.href, `/api/v1/presentations/${activePresentationId}/slides/${slideId}`);

    const applyCandidate = findAction(response.body, "apply-candidate");
    if (response.body.variants.length) {
      if (!applyCandidate) {
        throw new Error("Expected apply-candidate action");
      }
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
    assert.equal(response.body.links.compare.href, `/api/v1/slides/${slideId}`);
    assert.equal(response.body.links.preview.href, slide.body.links.preview.href);
    assert.equal(response.body.state.baseVersion, slide.body.state.baseVersion);
    assert.ok(Array.isArray(response.body.candidates));

    response.body.candidates.forEach((candidate: HypermediaCandidate) => {
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
    response.body.actions.forEach((entry: HypermediaAction) => {
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
    const saveContext = requireAction(presentation.body, "save-deck-context");

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
    const saveSlideSpec = requireAction(slide.body, "save-slide-spec");

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
