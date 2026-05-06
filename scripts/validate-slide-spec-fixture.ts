import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { _test: layoutTest } = require("../studio/server/services/layouts.ts");
const { validateSlideSpec } = require("../studio/server/services/slide-specs/index.ts");
const { validateSlideJsonWithSchema } = require("../studio/server/services/slide-specs/schema.ts");

const presentationsRoot = path.join(process.cwd(), "presentations");
const knownLayouts = new Set(["agenda", "callout", "chapter", "checklist", "focus", "identity", "proof", "standard", "statement", "steps", "strip"]);

type FsDirent = import("fs").Dirent;

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectSlideFiles(): string[] {
  if (!fs.existsSync(presentationsRoot)) {
    return [];
  }

  return fs.readdirSync(presentationsRoot, { withFileTypes: true })
    .filter((entry: FsDirent) => entry.isDirectory())
    .flatMap((entry: FsDirent) => {
      const slidesDir = path.join(presentationsRoot, entry.name, "slides");
      if (!fs.existsSync(slidesDir)) {
        return [];
      }

      return fs.readdirSync(slidesDir)
        .filter((fileName: string) => /^slide-\d+\.json$/.test(fileName))
        .sort()
        .map((fileName: string) => path.join(slidesDir, fileName));
    });
}

const slideFiles = collectSlideFiles();
assert.ok(slideFiles.length > 0, "Slide spec validation needs at least one presentation slide");

const layouts = new Set();
slideFiles.forEach((filePath: string) => {
  const rawSlideSpec = readJson(filePath);
  const schemaResult = validateSlideJsonWithSchema(rawSlideSpec, filePath);
  assert.deepEqual(schemaResult.issues, [], `${filePath} should match the slide JSON schema`);
  const slideSpec = validateSlideSpec(rawSlideSpec);
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
  /slideSpec\.mediaItems must contain (?:at least 2 items|2-3 items)/,
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
  /slideSpec\.mediaItems\[0\]\.src (?:is required|must be a non-empty string)/,
  "Slide spec validation should reject mediaItems without src"
);

assert.throws(
  () => validateSlideSpec({
    title: "Broken photo",
    type: "photo"
  }),
  /slideSpec\.media (?:is required|must be an object)/,
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

const normalizedPhotoGridLayout = layoutTest.normalizeLayout({
  definition: {
    arrangement: "comparison",
    captionRole: "comparison",
    mediaOrder: [1, 0, 2],
    type: "photoGridArrangement"
  },
  id: "fixture-photo-grid-layout",
  name: "Fixture photo grid layout",
  supportedTypes: ["photoGrid"],
  treatment: "focus"
});

assert.equal(
  normalizedPhotoGridLayout.definition.arrangement,
  "comparison",
  "Layout validation should keep schema-backed photo-grid arrangement definitions"
);
assert.deepEqual(
  normalizedPhotoGridLayout.definition.mediaOrder,
  [1, 0, 2],
  "Layout validation should preserve bounded photo-grid media order metadata"
);

const exportedLayout = layoutTest.createLayoutExchangeDocument({
  id: "fixture-exchange",
  name: "Fixture exchange",
  description: "Portable fixture layout.",
  supportedTypes: ["content"],
  treatment: "focus"
});

assert.equal(
  exportedLayout.kind,
  "slideotter.layout",
  "Layout exchange documents should use the canonical kind"
);
assert.deepEqual(
  layoutTest.readLayoutFromExchangeDocument(exportedLayout).supportedTypes,
  ["content"],
  "Layout exchange import should read canonical wrapper documents"
);
assert.equal(
  layoutTest.readLayoutFromExchangeDocument({
    id: "fixture-raw-exchange",
    name: "Fixture raw exchange",
    supportedTypes: ["summary"],
    treatment: "strip"
  }).treatment,
  "strip",
  "Layout exchange import should also accept raw layout JSON"
);
assert.equal(
  layoutTest.normalizeLayoutCollectionId(
    { id: "fixture-exchange", name: "Fixture exchange", supportedTypes: ["content"], treatment: "focus" },
    [{ id: "fixture-exchange" }, { id: "fixture-exchange-2" }]
  ).id,
  "fixture-exchange-3",
  "Imported layouts should normalize duplicate ids"
);

const exportedLayoutPack = layoutTest.createLayoutPackExchangeDocument([
  {
    id: "fixture-pack-one",
    name: "Fixture pack one",
    supportedTypes: ["content"],
    treatment: "focus"
  },
  {
    id: "fixture-pack-two",
    name: "Fixture pack two",
    supportedTypes: ["summary"],
    treatment: "strip"
  }
], { name: "Fixture pack" });

assert.equal(
  exportedLayoutPack.kind,
  "slideotter.layoutPack",
  "Layout pack exchange documents should use the canonical kind"
);
assert.equal(
  layoutTest.readLayoutsFromExchangeDocument(exportedLayoutPack).length,
  2,
  "Layout pack exchange import should read all packed layouts"
);
assert.equal(
  layoutTest.readLayoutsFromExchangeDocument(exportedLayout)[0].id,
  "fixture-exchange",
  "Layout pack import helper should also accept single layout documents"
);

assert.throws(
  () => layoutTest.readLayoutFromExchangeDocument({
    kind: "slideotter.layout",
    layout: {
      id: "fixture-broken-exchange",
      name: "Fixture broken exchange",
      supportedTypes: ["content"],
      treatment: "focus"
    },
    schemaVersion: 99
  }),
  /Layout exchange schemaVersion must be/,
  "Layout exchange import should reject unsupported schema versions"
);

assert.throws(
  () => layoutTest.readLayoutsFromExchangeDocument({
    kind: "slideotter.layoutPack",
    layouts: [],
    schemaVersion: 1
  }),
  /Layout pack must contain at least one layout/,
  "Layout pack exchange import should reject empty packs"
);

assert.throws(
  () => layoutTest.readLayoutFromExchangeDocument({
    id: "fixture-broken-treatment",
    name: "Fixture broken treatment",
    supportedTypes: ["content"],
    treatment: "freeform"
  }),
  /Layout treatment must be one of/,
  "Layout exchange import should reject invalid layout documents"
);

assert.throws(
  () => layoutTest.normalizeLayout({
    definition: {
      arrangement: "freeform",
      type: "photoGridArrangement"
    },
    id: "fixture-broken-photo-grid-layout",
    name: "Fixture broken photo grid layout",
    supportedTypes: ["photoGrid"],
    treatment: "focus"
  }),
  /Photo-grid layout arrangement must be one of/,
  "Layout validation should reject unknown photo-grid arrangements"
);

process.stdout.write("Slide spec fixture validation passed.\n");
