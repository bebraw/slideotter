const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  createPresentation,
  deletePresentation,
  getPresentationPaths,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  createCustomVisual,
  getCustomVisual,
  listCustomVisuals,
  sanitizeSvg
} = require("../studio/server/services/custom-visuals.ts");
const {
  assertAllowedWriteTarget
} = require("../studio/server/services/write-boundary.ts");

type CoveragePresentation = {
  id: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Custom visual tests",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise custom SVG artifact storage.",
    title: `Custom Visual Coverage ${Date.now()}`
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

  if (listPresentations().presentations.some((presentation: CoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
});

test("custom visual artifacts are sanitized and stored presentation-scoped", () => {
  const presentation = createCoveragePresentation();
  const paths = getPresentationPaths(presentation.id);
  const customVisual = createCustomVisual({
    content: "<svg viewBox=\"0 0 100 50\"><title>Flow</title><rect x=\"4\" y=\"4\" width=\"92\" height=\"42\" fill=\"#ffffff\" stroke=\"#183153\" /><text x=\"50\" y=\"28\" text-anchor=\"middle\">Render path</text></svg>",
    description: "A static architecture label.",
    role: "diagram",
    title: "Render path diagram"
  });

  assert.equal(customVisual.kind, "customVisual");
  assert.equal(customVisual.format, "svg");
  assert.equal(customVisual.role, "diagram");
  assert.equal(customVisual.sanitizerVersion, 1);
  assert.match(customVisual.content, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(!customVisual.content.includes("<script"));
  assert.deepEqual(getCustomVisual(customVisual.id), customVisual);
  assert.equal(listCustomVisuals()[0]?.id, customVisual.id);
  assert.ok(fs.existsSync(paths.customVisualsFile));
  assert.doesNotThrow(() => assertAllowedWriteTarget(paths.customVisualsFile));
});

test("custom SVG sanitizer rejects executable and external content", () => {
  assert.throws(
    () => sanitizeSvg("<svg viewBox=\"0 0 10 10\"><script>alert(1)</script></svg>"),
    /unsupported executable/,
    "script tags should be rejected"
  );
  assert.throws(
    () => sanitizeSvg("<svg viewBox=\"0 0 10 10\"><rect onclick=\"alert(1)\" width=\"10\" height=\"10\" /></svg>"),
    /attribute is not allowed: onclick/,
    "event attributes should be rejected"
  );
  assert.throws(
    () => sanitizeSvg("<svg viewBox=\"0 0 10 10\"><image href=\"https://example.com/a.png\" /></svg>"),
    /element is not allowed: image/,
    "external image elements should be rejected"
  );
  assert.throws(
    () => sanitizeSvg("<svg viewBox=\"0 0 10 10\"><rect fill=\"url(https://example.com/pattern)\" width=\"10\" height=\"10\" /></svg>"),
    /unsafe value: fill/,
    "external paint servers should be rejected"
  );
});
