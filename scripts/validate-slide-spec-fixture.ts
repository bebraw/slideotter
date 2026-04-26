const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { _test: layoutTest } = require("../studio/server/services/layouts.ts");
const { validateSlideSpec } = require("../studio/server/services/slide-specs/index.ts");

const presentationsRoot = path.join(process.cwd(), "presentations");
const knownLayouts = new Set(["callout", "checklist", "focus", "standard", "steps", "strip"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectSlideFiles() {
  if (!fs.existsSync(presentationsRoot)) {
    return [];
  }

  return fs.readdirSync(presentationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const slidesDir = path.join(presentationsRoot, entry.name, "slides");
      if (!fs.existsSync(slidesDir)) {
        return [];
      }

      return fs.readdirSync(slidesDir)
        .filter((fileName) => /^slide-\d+\.json$/.test(fileName))
        .sort()
        .map((fileName) => path.join(slidesDir, fileName));
    });
}

const slideFiles = collectSlideFiles();
assert.ok(slideFiles.length > 0, "Slide spec validation needs at least one presentation slide");

const layouts = new Set();
slideFiles.forEach((filePath) => {
  const slideSpec = validateSlideSpec(readJson(filePath));
  if (slideSpec.layout) {
    layouts.add(slideSpec.layout);
    assert.ok(knownLayouts.has(slideSpec.layout), `${filePath} uses an unknown layout`);
  }
});

assert.ok(layouts.size >= 4, "Fixture deck should exercise several layout treatments");

assert.throws(
  () => validateSlideSpec({
    cards: [
      { id: "one", title: "One", body: "One body" },
      { id: "two", title: "Two", body: "Two body" },
      { id: "three", title: "Three", body: "Three body" }
    ],
    eyebrow: "Fixture",
    layout: "unknown-layout",
    note: "Fixture note.",
    summary: "Fixture summary.",
    title: "Fixture cover",
    type: "cover"
  }),
  /slideSpec\.layout must be one of/,
  "Slide spec validation should reject unknown layout treatments"
);

assert.deepEqual(
  validateSlideSpec({
    attribution: "Fixture author",
    context: "Fixture context should stay attached to the quote.",
    quote: "Structured quote slides keep one excerpt dominant.",
    source: "Fixture source",
    title: "Fixture quote",
    type: "quote"
  }).type,
  "quote",
  "Slide spec validation should accept first-class quote slides"
);

assert.throws(
  () => validateSlideSpec({
    quote: "",
    title: "Broken quote",
    type: "quote"
  }),
  /slideSpec\.quote must be a non-empty string/,
  "Slide spec validation should reject empty quote text"
);

assert.equal(
  validateSlideSpec({
    media: {
      alt: "Fixture image",
      caption: "Source: fixture",
      id: "fixture-material",
      src: "/presentation-materials/fixture/image.png",
      title: "Fixture image"
    },
    caption: "A compact caption stays attached to the dominant photo.",
    title: "Fixture photo",
    type: "photo"
  }).type,
  "photo",
  "Slide spec validation should accept first-class photo slides"
);

assert.throws(
  () => validateSlideSpec({
    title: "Broken photo",
    type: "photo"
  }),
  /slideSpec\.media must be an object/,
  "Slide spec validation should require media on photo slides"
);

assert.deepEqual(
  layoutTest.normalizeLayout({
    id: "fixture-focus",
    name: "Fixture focus",
    supportedTypes: ["content"],
    treatment: "focus"
  }).supportedTypes,
  ["content"],
  "Layout validation should accept known built-in treatments"
);

assert.throws(
  () => layoutTest.normalizeLayout({
    id: "fixture-freeform",
    name: "Fixture freeform",
    supportedTypes: ["content"],
    treatment: "freeform"
  }),
  /Layout treatment must be one of/,
  "Layout validation should reject unknown treatments"
);

assert.equal(
  layoutTest.normalizeLayout({
    id: "fixture-favorite",
    name: "Fixture favorite",
    supportedTypes: ["summary", "unknown"],
    treatment: "checklist"
  }).supportedTypes.length,
  1,
  "Favorite layout validation should keep only supported slide families"
);

process.stdout.write("Slide spec fixture validation passed.\n");
