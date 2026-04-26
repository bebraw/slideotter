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

assert.equal(
  validateSlideSpec({
    caption: "A compact caption explains why the image set belongs together.",
    mediaItems: [
      {
        alt: "First fixture image",
        caption: "First source",
        id: "fixture-grid-media-1",
        src: "/presentation-materials/fixture/grid-one.png",
        title: "First grid image"
      },
      {
        alt: "Second fixture image",
        caption: "Second source",
        id: "fixture-grid-media-2",
        src: "/presentation-materials/fixture/grid-two.png",
        title: "Second grid image"
      },
      {
        alt: "Third fixture image",
        id: "fixture-grid-media-3",
        src: "/presentation-materials/fixture/grid-three.png"
      }
    ],
    title: "Fixture photo grid",
    type: "photoGrid"
  }).type,
  "photoGrid",
  "Slide spec validation should accept first-class photo grid slides"
);

assert.throws(
  () => validateSlideSpec({
    mediaItems: [
      {
        alt: "Only fixture image",
        id: "fixture-grid-media-one",
        src: "/presentation-materials/fixture/grid-one.png"
      }
    ],
    title: "Broken photo grid",
    type: "photoGrid"
  }),
  /slideSpec\.mediaItems must contain 2-4 items/,
  "Slide spec validation should reject photo grid slides with fewer than two media items"
);

assert.equal(
  validateSlideSpec({
    mediaItems: [
      {
        alt: "First fixture image",
        caption: "First caption",
        id: "fixture-media-1",
        materialId: "material-1",
        source: "Fixture source 1",
        src: "/presentation-materials/fixture/one.png",
        title: "First image"
      },
      {
        alt: "Second fixture image",
        id: "fixture-media-2",
        src: "/presentation-materials/fixture/two.png"
      }
    ],
    title: "Fixture media items",
    type: "divider"
  }).mediaItems.length,
  2,
  "Slide spec validation should accept optional mediaItems"
);

assert.throws(
  () => validateSlideSpec({
    mediaItems: [
      {
        alt: "Missing source path",
        id: "broken-media-item"
      }
    ],
    title: "Broken media items",
    type: "divider"
  }),
  /slideSpec\.mediaItems\[0\]\.src must be a non-empty string/,
  "Slide spec validation should reject mediaItems without src"
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
