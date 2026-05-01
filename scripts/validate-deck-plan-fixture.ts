const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

type EvidenceItem = {
  body?: string;
  title?: string;
  value?: unknown;
};

type ContentSlideSpec = {
  guardrails?: EvidenceItem[];
  signals?: EvidenceItem[];
  type?: string;
};

type GeneratedSlide = {
  replacement?: {
    slideSpec?: ContentSlideSpec;
  };
  scaffold?: {
    slideSpec?: ContentSlideSpec;
  };
};

type DeckPlanCandidate = {
  deckPatch?: Record<string, unknown>;
  diff?: {
    deck?: {
      count?: number;
    };
    files?: Array<{
      targetPath?: string;
    }>;
  };
  label?: string;
  planStats?: {
    shared?: number;
  };
  preview?: {
    deckCues?: unknown[];
  };
  slides?: GeneratedSlide[];
};

type RuntimeConfigService = {
  initializeUserData(options?: { userDataRoot?: string }): unknown;
};

type StateService = {
  getDeckContext(): unknown;
};

type OperationsService = {
  _test: {
    createLocalDeckStructureCandidates(deckContext: unknown): DeckPlanCandidate[];
  };
};

const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), "slideotter-deck-plan-fixture-"));
process.env.SLIDEOTTER_HOME = fixtureHome;
process.once("exit", () => {
  fs.rmSync(fixtureHome, { force: true, recursive: true });
});

const { initializeUserData } = require("../studio/server/services/runtime-config.ts") as RuntimeConfigService;
initializeUserData({ userDataRoot: fixtureHome });

const { _test } = require("../studio/server/services/operations.ts") as OperationsService;
const { getDeckContext } = require("../studio/server/services/state.ts") as StateService;

const candidates = _test.createLocalDeckStructureCandidates(getDeckContext());

assert.ok(candidates.length >= 1, "deck-plan fixture should produce candidates");

const missingPatch = candidates.filter((candidate: DeckPlanCandidate) => !candidate.deckPatch || typeof candidate.deckPatch !== "object");
assert.deepEqual(
  missingPatch.map((candidate: DeckPlanCandidate) => candidate.label),
  [],
  "every local deck-plan candidate should carry a shared deck-context patch"
);

const missingSharedDiff = candidates.filter((candidate: DeckPlanCandidate) => {
  const count = candidate.diff?.deck?.count ?? 0;
  const shared = candidate.planStats?.shared ?? 0;
  return !Number.isFinite(count) || count < 1 || !Number.isFinite(shared) || shared < 1;
});
assert.deepEqual(
  missingSharedDiff.map((candidate: DeckPlanCandidate) => candidate.label),
  [],
  "every local deck-plan candidate should expose shared deck-setting diffs"
);

const missingToggleCue = candidates.filter((candidate: DeckPlanCandidate) => {
  const cues = candidate.preview && Array.isArray(candidate.preview.deckCues)
    ? candidate.preview.deckCues
    : [];
  return cues.length < 1;
});
assert.deepEqual(
  missingToggleCue.map((candidate: DeckPlanCandidate) => candidate.label),
  [],
  "every local deck-plan candidate should show shared deck-setting preview cues"
);

const staleTargetPaths = candidates.filter((candidate: DeckPlanCandidate) => {
  const files = candidate.diff && Array.isArray(candidate.diff.files)
    ? candidate.diff.files
    : [];
  return files.some((file: { targetPath?: string }) => !String(file.targetPath || "").startsWith("presentations/"));
});
assert.deepEqual(
  staleTargetPaths.map((candidate: DeckPlanCandidate) => candidate.label),
  [],
  "deck-plan diffs should report presentation-scoped slide paths"
);

function collectTextValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectTextValues);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectTextValues);
  }

  return [];
}

const staleStateReferences = candidates.filter((candidate: DeckPlanCandidate) =>
  collectTextValues(candidate).some((value: string) => value.includes("studio/state/deck-context.json"))
);
assert.deepEqual(
  staleStateReferences.map((candidate: DeckPlanCandidate) => candidate.label),
  [],
  "deck-plan candidates should reference presentation-scoped deck context paths"
);

function collectGeneratedContentSpecs(candidate: DeckPlanCandidate): ContentSlideSpec[] {
  const slides = Array.isArray(candidate.slides) ? candidate.slides : [];
  return slides
    .flatMap((slide: GeneratedSlide) => [
      slide && slide.scaffold && slide.scaffold.slideSpec,
      slide && slide.replacement && slide.replacement.slideSpec
    ])
    .filter((slideSpec: ContentSlideSpec | undefined): slideSpec is ContentSlideSpec => Boolean(slideSpec && slideSpec.type === "content"));
}

const metricContentSpecs = candidates.filter((candidate: DeckPlanCandidate) =>
  collectGeneratedContentSpecs(candidate).some((slideSpec: ContentSlideSpec) => {
    const signals = Array.isArray(slideSpec.signals) ? slideSpec.signals : [];
    const guardrails = Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails : [];
    return signals.some((item: EvidenceItem) => !item.title || !item.body || Object.hasOwn(item, "value")) ||
      guardrails.some((item: EvidenceItem) => !item.title || !item.body || Object.hasOwn(item, "value"));
  })
);
assert.deepEqual(
  metricContentSpecs.map((candidate: DeckPlanCandidate) => candidate.label),
  [],
  "generated deck-plan content slides should use title/body evidence items instead of metric-style signal values"
);

process.stdout.write("Deck-plan fixture validation passed.\n");
