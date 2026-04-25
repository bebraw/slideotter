const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

process.stdout.write("Slide spec fixture validation passed.\n");
