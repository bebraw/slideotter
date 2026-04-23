const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/operations");
const { getDeckContext } = require("../studio/server/services/state");

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

process.stdout.write("Deck-plan fixture validation passed.\n");
