import assert from "node:assert/strict";
import * as fs from "node:fs";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { createPresentation,
  deletePresentation,
  getPresentationPaths,
  listPresentations,
  setActivePresentation } = require("../studio/server/services/presentations.ts");
const { getSlides,
  writeSlideSpec } = require("../studio/server/services/slides.ts");
const { createCustomVisual,
  getCustomVisual,
  hydrateCustomVisualSlideSpec,
  listCustomVisuals,
  sanitizeSvg } = require("../studio/server/services/custom-visuals.ts");
const { validateSlideSpec } = require("../studio/server/services/slide-specs/index.ts");
const { renderSlideMarkup } = require("../studio/rendering/slide-dom.ts");
const { assertAllowedWriteTarget } = require("../studio/server/services/write-boundary.ts");

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

test("custom visual references hydrate into DOM-rendered slide specs", () => {
  const presentation = createCoveragePresentation();
  const paths = getPresentationPaths(presentation.id);
  const customVisual = createCustomVisual({
    content: "<svg viewBox=\"0 0 100 40\"><rect x=\"0\" y=\"0\" width=\"100\" height=\"40\" fill=\"#ffffff\" /><text x=\"50\" y=\"24\" text-anchor=\"middle\">System map</text></svg>",
    description: "A compact system map.",
    role: "diagram",
    title: "System map"
  });
  const slideSpec = validateSlideSpec({
    customVisual: {
      id: customVisual.id,
      role: customVisual.role,
      title: customVisual.title
    },
    eyebrow: "Architecture",
    guardrails: [
      { id: "guardrail-1", title: "Validate", body: "Server sanitizes the artifact." },
      { id: "guardrail-2", title: "Preview", body: "DOM preview renders the same content." },
      { id: "guardrail-3", title: "Apply", body: "Slides keep an explicit artifact reference." }
    ],
    guardrailsTitle: "Rules",
    signals: [
      { id: "signal-1", title: "Artifact", body: "Stored once per presentation." },
      { id: "signal-2", title: "Reference", body: "Slide specs point at the artifact id." },
      { id: "signal-3", title: "Sanitizer", body: "Unsafe SVG is rejected." },
      { id: "signal-4", title: "Renderer", body: "Shared DOM output stays canonical." }
    ],
    signalsTitle: "Flow",
    summary: "Custom visuals render through the same DOM path as other slide content.",
    title: "Custom SVG visual",
    type: "content"
  });
  const hydrated = hydrateCustomVisualSlideSpec(slideSpec);
  const markup = renderSlideMarkup(hydrated, { index: 1, totalSlides: 1 });

  assert.equal(hydrated.customVisual.id, customVisual.id);
  assert.equal(hydrated.customVisual.content, customVisual.content);
  assert.match(markup, /dom-slide__custom-visual/);
  assert.match(markup, /System map/);

  const firstSlide = getSlides()[0];
  writeSlideSpec(firstSlide.id, hydrated);
  const stored = JSON.parse(fs.readFileSync(paths.slidesDir + "/slide-01.json", "utf8"));
  assert.equal(stored.customVisual.id, customVisual.id);
  assert.equal(stored.customVisual.content, undefined);
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

test("slide spec validation rejects inline executable custom visual content", () => {
  assert.throws(
    () => validateSlideSpec({
      customVisual: {
        content: "<svg viewBox=\"0 0 10 10\"><script>alert(1)</script></svg>",
        id: "unsafe-custom-visual",
        title: "Unsafe custom visual"
      },
      eyebrow: "Architecture",
      guardrails: [
        { id: "guardrail-1", title: "Validate", body: "Reject executable SVG content." },
        { id: "guardrail-2", title: "Preview", body: "Keep preview markup inert." },
        { id: "guardrail-3", title: "Apply", body: "Store references only." }
      ],
      guardrailsTitle: "Rules",
      signals: [
        { id: "signal-1", title: "Artifact", body: "Sanitized content comes from artifact storage." },
        { id: "signal-2", title: "Reference", body: "Slides point at artifact ids." },
        { id: "signal-3", title: "Sanitizer", body: "Executable markup is rejected." },
        { id: "signal-4", title: "Renderer", body: "DOM output remains shared." }
      ],
      signalsTitle: "Flow",
      summary: "Inline custom visual content must pass the same SVG sanitizer as stored artifacts.",
      title: "Unsafe custom SVG visual",
      type: "content"
    }),
    /unsupported executable/
  );
});

test("DOM slide rendering refuses unsafe inline custom visual content", () => {
  const markup = renderSlideMarkup({
    customVisual: {
      content: "<svg viewBox=\"0 0 10 10\"><script>window.__unsafe = true</script></svg>",
      id: "unsafe-custom-visual",
      title: "Unsafe custom visual"
    },
    eyebrow: "Architecture",
    guardrails: [
      { id: "guardrail-1", title: "Validate", body: "Reject executable SVG content." },
      { id: "guardrail-2", title: "Preview", body: "Keep preview markup inert." },
      { id: "guardrail-3", title: "Apply", body: "Store references only." }
    ],
    guardrailsTitle: "Rules",
    signals: [
      { id: "signal-1", title: "Artifact", body: "Sanitized content comes from artifact storage." },
      { id: "signal-2", title: "Reference", body: "Slides point at artifact ids." },
      { id: "signal-3", title: "Sanitizer", body: "Executable markup is rejected." },
      { id: "signal-4", title: "Renderer", body: "DOM output remains shared." }
    ],
    signalsTitle: "Flow",
    summary: "Unsafe custom visual content should not render during local JSON preview.",
    title: "Unsafe custom SVG visual",
    type: "content"
  });

  assert.doesNotMatch(markup, /<script/i);
  assert.doesNotMatch(markup, /dom-slide__custom-visual/);
});
