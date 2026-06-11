import assert from "node:assert/strict";
import * as fs from "node:fs";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  getPresentationPaths,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  createMemoryItem,
  getMemoryItem,
  getMemoryStore,
  linkMemoryEvidence,
  normalizeMemoryStore,
  retireMemoryItem,
  saveMemoryStore,
  searchMemoryItems,
  updateMemoryItem
} = require("../studio/server/services/memory.ts");
const { assertAllowedWriteTarget } = require("../studio/server/services/write-boundary.ts");

type MemoryCoveragePresentation = {
  id: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createMemoryCoveragePresentation(): MemoryCoveragePresentation {
  const presentation = createPresentation({
    audience: "Memory tests",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise hypermedia memory storage.",
    title: `Memory Coverage ${Date.now()}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

test.after(() => {
  for (const id of createdPresentationIds) {
    try {
      deletePresentation(id);
    } catch (error) {
      // Cleanup is best effort so the original test failure remains visible.
    }
  }

  if (listPresentations().presentations.some((presentation: MemoryCoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
});

test("memory store initializes presentation-scoped state", () => {
  const presentation = createMemoryCoveragePresentation();
  const paths = getPresentationPaths(presentation.id);
  const store = getMemoryStore();

  assert.deepEqual(store, {
    derivedSets: [],
    items: [],
    links: []
  });
  assert.ok(fs.existsSync(paths.memoryFile));
  assert.doesNotThrow(() => assertAllowedWriteTarget(paths.memoryFile));
});

test("memory item lifecycle stores claims, evidence, and style notes", () => {
  const presentation = createMemoryCoveragePresentation();
  const claim = createMemoryItem({
    confidence: "high",
    detail: "This claim should be reused when deriving a shorter talk.",
    evidence: [
      {
        href: `/api/v1/presentations/${presentation.id}/sources/source-1`,
        rel: "source",
        title: "Source note"
      }
    ],
    status: "accepted",
    summary: "Hypermedia memory keeps reusable claims inspectable.",
    tags: ["Agents", "Hypermedia", "Agents"],
    type: "claim"
  });
  const evidence = createMemoryItem({
    summary: "The existing API already advertises links and actions.",
    type: "evidence"
  });
  const styleNote = createMemoryItem({
    summary: "Keep derived slides short and presentation-scale.",
    type: "style-note"
  });

  assert.equal(claim.type, "claim");
  assert.equal(claim.status, "accepted");
  assert.equal(claim.confidence, "high");
  assert.deepEqual(claim.tags, ["agents", "hypermedia"]);
  assert.equal(claim.evidence.length, 1);
  assert.equal(evidence.type, "evidence");
  assert.equal(styleNote.type, "styleNote");
  assert.equal(getMemoryStore().items.length, 3);

  const updated = updateMemoryItem(claim.id, {
    status: "stale",
    summary: "Hypermedia memory keeps reusable claims inspectable and updateable."
  });
  assert.equal(updated.status, "stale");
  assert.match(updated.summary, /updateable/);
  assert.notEqual(updated.updatedAt, claim.updatedAt);

  const linked = linkMemoryEvidence(claim.id, {
    evidence: [
      {
        href: `/api/v1/presentations/${presentation.id}/slides/slide-01`,
        rel: "slide",
        title: "Opening slide"
      }
    ]
  });
  assert.equal(linked.evidence.length, 2);

  const retired = retireMemoryItem(claim.id);
  assert.equal(retired.status, "retired");
  assert.equal(getMemoryItem(claim.id).status, "retired");
});

test("memory normalization drops malformed entries and keeps ids unique", () => {
  const normalized = normalizeMemoryStore({
    derivedSets: [
      {
        id: "Short Talk",
        memoryIds: ["claim-one", "", "style-note"],
        purpose: "Create a shorter talk.",
        sourcePresentationId: "source-deck",
        targetLength: "5"
      },
      {
        id: "missing-source"
      }
    ],
    items: [
      {
        id: "claim-one",
        status: "accepted",
        summary: "A reusable claim.",
        type: "claim"
      },
      {
        id: "claim-one",
        summary: "A second claim with the same requested id.",
        type: "claim"
      },
      {
        summary: "Unsupported item.",
        type: "audience"
      },
      {
        type: "claim"
      }
    ],
    links: [
      {
        from: "claim-one",
        href: "/api/v1/sources/source-1",
        rel: "source",
        to: "evidence-one"
      },
      {
        from: "",
        href: "/api/v1/sources/source-2",
        rel: "source",
        to: "evidence-two"
      }
    ]
  });

  assert.equal(normalized.items.length, 2);
  assert.equal(normalized.items[0].id, "claim-one");
  assert.equal(normalized.items[1].id, "claim-one-2");
  assert.equal(normalized.derivedSets.length, 1);
  assert.equal(normalized.derivedSets[0]?.targetLength, 5);
  assert.equal(normalized.links.length, 1);
});

test("memory search is bounded, keyword based, and skips retired items", () => {
  createMemoryCoveragePresentation();
  const claim = createMemoryItem({
    status: "accepted",
    summary: "Hypermedia memory supports derived conference talks.",
    tags: ["conference"],
    type: "claim"
  });
  createMemoryItem({
    summary: "Use a quiet working visual language.",
    tags: ["visual-style"],
    type: "styleNote"
  });
  const retired = createMemoryItem({
    status: "retired",
    summary: "Old conference framing that should not be retrieved.",
    tags: ["conference"],
    type: "claim"
  });

  const results = searchMemoryItems("conference derived", { limit: 5 });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.item.id, claim.id);
  assert.ok(results[0]?.score);
  assert.equal(results.some((result: { item: { id: string } }) => result.item.id === retired.id), false);
});

test("memory store remains presentation scoped", () => {
  const first = createMemoryCoveragePresentation();
  const firstClaim = createMemoryItem({
    summary: "First presentation claim.",
    type: "claim"
  });
  const firstStore = getMemoryStore({ presentationId: first.id });

  const second = createMemoryCoveragePresentation();
  createMemoryItem({
    summary: "Second presentation claim.",
    type: "claim"
  });
  const secondStore = getMemoryStore({ presentationId: second.id });

  assert.equal(firstStore.items.length, 1);
  assert.equal(secondStore.items.length, 1);
  assert.equal(firstStore.items[0]?.id, firstClaim.id);
  assert.notEqual(firstStore.items[0]?.summary, secondStore.items[0]?.summary);

  saveMemoryStore({
    ...firstStore,
    links: [
      {
        from: firstClaim.id,
        href: "/api/v1/sources/source-1",
        rel: "source",
        to: "evidence-one"
      }
    ]
  }, { presentationId: first.id });
  assert.equal(getMemoryStore({ presentationId: first.id }).links.length, 1);
  assert.equal(getMemoryStore({ presentationId: second.id }).links.length, 0);
});
