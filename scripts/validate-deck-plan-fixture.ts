const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/operations.ts");
const { getDeckContext } = require("../studio/server/services/state.ts");

const candidates = _test.createLocalDeckStructureCandidates(getDeckContext());

assert.ok(candidates.length >= 1, "deck-plan fixture should produce candidates");

const missingPatch = candidates.filter((candidate) => !candidate.deckPatch || typeof candidate.deckPatch !== "object");
assert.deepEqual(
  missingPatch.map((candidate) => candidate.label),
  [],
  "every local deck-plan candidate should carry a shared deck-context patch"
);

const missingSharedDiff = candidates.filter((candidate) => {
  const count = candidate.diff && candidate.diff.deck && candidate.diff.deck.count;
  const shared = candidate.planStats && candidate.planStats.shared;
  return !Number.isFinite(count) || count < 1 || !Number.isFinite(shared) || shared < 1;
});
assert.deepEqual(
  missingSharedDiff.map((candidate) => candidate.label),
  [],
  "every local deck-plan candidate should expose shared deck-setting diffs"
);

const missingToggleCue = candidates.filter((candidate) => {
  const cues = candidate.preview && Array.isArray(candidate.preview.deckCues)
    ? candidate.preview.deckCues
    : [];
  return cues.length < 1;
});
assert.deepEqual(
  missingToggleCue.map((candidate) => candidate.label),
  [],
  "every local deck-plan candidate should show shared deck-setting preview cues"
);

const staleTargetPaths = candidates.filter((candidate) => {
  const files = candidate.diff && Array.isArray(candidate.diff.files)
    ? candidate.diff.files
    : [];
  return files.some((file) => !String(file.targetPath || "").startsWith("presentations/"));
});
assert.deepEqual(
  staleTargetPaths.map((candidate) => candidate.label),
  [],
  "deck-plan diffs should report presentation-scoped slide paths"
);

function collectGeneratedContentSpecs(candidate) {
  const slides = Array.isArray(candidate.slides) ? candidate.slides : [];
  return slides
    .flatMap((slide) => [
      slide && slide.scaffold && slide.scaffold.slideSpec,
      slide && slide.replacement && slide.replacement.slideSpec
    ])
    .filter((slideSpec) => slideSpec && slideSpec.type === "content");
}

const metricContentSpecs = candidates.filter((candidate) =>
  collectGeneratedContentSpecs(candidate).some((slideSpec) => {
    const signals = Array.isArray(slideSpec.signals) ? slideSpec.signals : [];
    const guardrails = Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails : [];
    return signals.some((item) => !item.title || !item.body || Object.hasOwn(item, "value")) ||
      guardrails.some((item) => !item.title || !item.body || Object.hasOwn(item, "value"));
  })
);
assert.deepEqual(
  metricContentSpecs.map((candidate) => candidate.label),
  [],
  "generated deck-plan content slides should use title/body evidence items instead of metric-style signal values"
);

process.stdout.write("Deck-plan fixture validation passed.\n");
