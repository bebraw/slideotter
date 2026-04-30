const assert = require("node:assert/strict");
const { _test } = require("../studio/server/services/operations.ts");
const { buildRedoLayoutPrompts } = require("../studio/server/services/llm/prompts.ts");
const { getRedoLayoutResponseSchema } = require("../studio/server/services/llm/schemas.ts");

type FixtureMedia = {
  alt: string;
  caption?: string;
  id: string;
  materialId?: string;
  source?: string;
  src: string;
  title?: string;
};

type FixtureSlideSpec = {
  [key: string]: unknown;
  caption?: string;
  cards?: Array<{ body: string; id: string; title: string }>;
  eyebrow?: string;
  guardrails?: Array<{ body: string; id: string; title: string }>;
  guardrailsTitle?: string;
  index: number;
  logo?: string;
  media?: FixtureMedia | null;
  mediaItems?: FixtureMedia[];
  note?: string;
  quote?: string;
  signals?: Array<{ body: string; id: string; title: string }>;
  signalsTitle?: string;
  summary?: string;
  title: string;
  type: string;
};

type FamilyChangeCandidate = {
  changeSummary: string[];
  slideSpec: FixtureSlideSpec;
};

const fixtureMedia: FixtureMedia = {
  alt: "Attached material",
  caption: "Source: fixture",
  id: "material-fixture",
  src: "/presentation-materials/fixture/material.png",
  title: "Fixture material"
};

const fixtureMediaItems: FixtureMedia[] = [
  {
    alt: "Attached material one",
    caption: "Source: fixture one",
    id: "material-fixture-one",
    materialId: "material-fixture-one",
    src: "/presentation-materials/fixture/material-one.png",
    title: "Fixture material one"
  },
  {
    alt: "Attached material two",
    id: "material-fixture-two",
    src: "/presentation-materials/fixture/material-two.png"
  }
];

const baseSlideSpec: FixtureSlideSpec = {
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
  media: fixtureMedia,
  mediaItems: fixtureMediaItems
};

const candidateWithoutMedia: FixtureSlideSpec = {
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
assert.deepEqual(
  preserved.mediaItems,
  baseSlideSpec.mediaItems,
  "generated candidates should preserve existing mediaItems when they do not mention mediaItems"
);

const candidateWithExplicitMedia: FixtureSlideSpec = {
  ...candidateWithoutMedia,
  media: null,
  mediaItems: []
};
const explicit = _test.applyCandidateSlideDefaults(candidateWithExplicitMedia, baseSlideSpec);
assert.equal(
  explicit.media,
  null,
  "generated candidates should honor explicit media changes"
);
assert.deepEqual(
  explicit.mediaItems,
  [],
  "generated candidates should honor explicit mediaItems changes"
);

const photoBaseSlideSpec: FixtureSlideSpec = {
  type: "photo",
  index: 1,
  title: "Photo material slide",
  caption: "Source: fixture",
  media: fixtureMedia
};

const photoCandidateWithoutMedia: FixtureSlideSpec = {
  type: "photo",
  index: 1,
  title: "Photo candidate",
  caption: "Tighter visual evidence."
};

const preservedPhoto = _test.applyCandidateSlideDefaults(photoCandidateWithoutMedia, photoBaseSlideSpec);
assert.deepEqual(
  preservedPhoto.media,
  photoBaseSlideSpec.media,
  "generated photo candidates should preserve existing slide media when they do not mention media"
);

const photoGridBaseSlideSpec: FixtureSlideSpec = {
  type: "photoGrid",
  index: 1,
  title: "Photo grid material slide",
  caption: "Source: fixture set",
  mediaItems: fixtureMediaItems
};

const photoGridCandidateWithoutMediaItems: FixtureSlideSpec = {
  type: "photoGrid",
  index: 1,
  title: "Photo grid candidate",
  caption: "Tighter grouped visual evidence."
};

const preservedPhotoGrid = _test.applyCandidateSlideDefaults(photoGridCandidateWithoutMediaItems, photoGridBaseSlideSpec);
assert.deepEqual(
  preservedPhotoGrid.mediaItems,
  photoGridBaseSlideSpec.mediaItems,
  "generated photo grid candidates should preserve existing mediaItems when they do not mention mediaItems"
);

const coverCards = [
  { id: "cover-source", title: "Structured source", body: "Slides stay inspectable." },
  { id: "cover-loop", title: "Live workbench", body: "Preview and compare variants." },
  { id: "cover-output", title: "Guarded output", body: "Validate before sharing." }
];

const coverBaseSlideSpec: FixtureSlideSpec = {
  type: "cover",
  index: 1,
  title: "slideotter",
  eyebrow: "Project overview",
  summary: "A local workbench for structured presentations.",
  note: "Use the tour to orient new users.",
  logo: "slideotter",
  cards: coverCards
};

const coverCandidateWithoutLogo: FixtureSlideSpec = {
  type: "cover",
  index: 1,
  title: "slideotter",
  eyebrow: "Project overview",
  summary: "A clearer local workbench summary.",
  note: "Use the tour to orient new users.",
  cards: coverCards
};

const preservedCover = _test.applyCandidateSlideDefaults(coverCandidateWithoutLogo, coverBaseSlideSpec);
assert.equal(
  preservedCover.logo,
  "slideotter",
  "generated cover candidates should preserve built-in logo markers when they do not mention logo"
);

const familyContext = {
  audience: "fixture reviewer",
  currentTitle: "Material slide",
  intent: "Show the attached material as visual evidence.",
  layoutHint: "Use one clear reading path.",
  mustInclude: "The material remains inspectable.",
  nextTitle: "Next fixture slide",
  note: "Compare before apply.",
  objective: "Keep generated candidates reviewable.",
  outlineCurrent: "Material evidence",
  outlineNext: "Validation",
  previousTitle: "Previous fixture slide",
  themeBrief: "Quiet and practical.",
  tone: "direct"
};

const familyChangeCandidates = _test.createLocalFamilyChangeCandidates(baseSlideSpec, familyContext);
const familyChangeTypes = familyChangeCandidates.map((candidate: FamilyChangeCandidate) => candidate.slideSpec.type);

assert.ok(
  familyChangeTypes.includes("quote"),
  "family-changing candidates should include quote conversion for text-heavy slides"
);
assert.ok(
  familyChangeTypes.includes("photo"),
  "family-changing candidates should include photo conversion when media exists"
);
assert.ok(
  familyChangeTypes.includes("photoGrid"),
  "family-changing candidates should include photoGrid conversion when multiple media items exist"
);

const photoGridFamilyCandidate = familyChangeCandidates.find((candidate: FamilyChangeCandidate) => candidate.slideSpec.type === "photoGrid");
assert.ok(photoGridFamilyCandidate, "family-changing candidates should include a photoGrid candidate");
assert.deepEqual(
  photoGridFamilyCandidate.slideSpec.mediaItems,
  baseSlideSpec.mediaItems,
  "photoGrid family conversion should preserve existing mediaItems"
);
assert.match(
  photoGridFamilyCandidate.changeSummary.join(" "),
  /Changed slide family from content to photoGrid/,
  "family-changing candidates should make the type change explicit"
);

const redoLayoutPrompts = buildRedoLayoutPrompts({
  candidateCount: 2,
  context: {
    deck: { objective: "Fixture objective" },
    slides: {
      "slide-fixture": {
        intent: "Fixture intent"
      }
    }
  },
  slide: {
    id: "slide-fixture",
    title: "Fixture slide"
  },
  slideType: "content",
  source: JSON.stringify(baseSlideSpec)
});

assert.match(
  redoLayoutPrompts.userPrompt,
  /targetFamily, droppedFields, preservedFields, emphasis, and rationale/,
  "LLM redo-layout prompts should require intent-only review metadata"
);
assert.match(
  redoLayoutPrompts.userPrompt,
  /Allowed slide families/,
  "LLM redo-layout prompts should name the allowed family choices"
);

const redoLayoutSchema = getRedoLayoutResponseSchema(2);
const redoLayoutIntentSchema = redoLayoutSchema.properties.candidates.items;
assert.equal(
  redoLayoutIntentSchema.properties.targetFamily.enum.length,
  8,
  "LLM redo-layout intent schema should allow every structured target family"
);
assert.ok(
  !Object.hasOwn(redoLayoutIntentSchema.properties, "slideSpec")
    && redoLayoutIntentSchema.required.includes("targetFamily")
    && redoLayoutIntentSchema.required.includes("droppedFields")
    && redoLayoutIntentSchema.required.includes("preservedFields")
    && redoLayoutIntentSchema.required.includes("emphasis")
    && redoLayoutIntentSchema.required.includes("rationale"),
  "LLM redo-layout schema should require intent fields without accepting slide specs"
);

process.stdout.write("Slide media fixture validation passed.\n");
