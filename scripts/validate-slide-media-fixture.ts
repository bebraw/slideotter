const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/operations.ts");

const baseSlideSpec = {
  type: "content",
  index: 1,
  title: "Material slide",
  eyebrow: "Fixture",
  summary: "A slide with an attached material.",
  signalsTitle: "Signals",
  guardrailsTitle: "Guardrails",
  signals: [
    { id: "signal-1", title: "One", body: "First signal." },
    { id: "signal-2", title: "Two", body: "Second signal." },
    { id: "signal-3", title: "Three", body: "Third signal." },
    { id: "signal-4", title: "Four", body: "Fourth signal." }
  ],
  guardrails: [
    { id: "guardrail-1", title: "One", body: "First guardrail." },
    { id: "guardrail-2", title: "Two", body: "Second guardrail." },
    { id: "guardrail-3", title: "Three", body: "Third guardrail." }
  ],
  media: {
    alt: "Attached material",
    caption: "Source: fixture",
    id: "material-fixture",
    src: "/presentation-materials/fixture/material.png",
    title: "Fixture material"
  }
};

const candidateWithoutMedia = {
  ...baseSlideSpec,
  title: "Candidate without media"
};
delete candidateWithoutMedia.media;

const preserved = _test.applyCandidateSlideDefaults(candidateWithoutMedia, baseSlideSpec);
assert.deepEqual(
  preserved.media,
  baseSlideSpec.media,
  "generated candidates should preserve existing slide media when they do not mention media"
);

const candidateWithExplicitMedia = {
  ...candidateWithoutMedia,
  media: null
};
const explicit = _test.applyCandidateSlideDefaults(candidateWithExplicitMedia, baseSlideSpec);
assert.equal(
  explicit.media,
  null,
  "generated candidates should honor explicit media changes"
);

process.stdout.write("Slide media fixture validation passed.\n");
