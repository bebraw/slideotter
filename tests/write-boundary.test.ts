import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createPresentationLifecycleFixture } from "./helpers/presentation-lifecycle-fixture.ts";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { readSlideSpec } = require("../studio/server/services/slides.ts");
const {
  assertAllowedWriteTarget,
  copyAllowedFile,
  ensureAllowedDir,
  removeAllowedPath,
  writeAllowedBinary,
  writeAllowedJson
} = require("../studio/server/services/write-boundary.ts");
const { outputDir } = require("../studio/server/services/paths.ts");
const { getPresentationPaths } = require("../studio/server/services/presentation-paths.ts");

const {
  cleanupCoveragePresentations,
  createCoveragePresentation
} = createPresentationLifecycleFixture();

test.after(() => {
  cleanupCoveragePresentations();
});

test("write boundary blocks paths outside presentation, state, slides, and output roots", () => {
  const presentation = createCoveragePresentation("write-boundary");
  const paths = getPresentationPaths(presentation.id);
  const allowedStateFile = path.join(paths.stateDir, "deck-context.json");
  const allowedSourcesFile = path.join(paths.stateDir, "sources.json");

  assert.equal(assertAllowedWriteTarget(allowedStateFile), path.resolve(allowedStateFile));
  writeAllowedJson(allowedStateFile, readSlideSpec("slide-01") ? { deck: { title: presentation.title }, slides: {} } : {});
  assert.equal(assertAllowedWriteTarget(allowedSourcesFile), path.resolve(allowedSourcesFile));

  const allowedMaterialFile = path.join(paths.materialsDir, "coverage-boundary.bin");
  const copiedMaterialFile = path.join(paths.materialsDir, "coverage-boundary-copy.bin");
  writeAllowedBinary(allowedMaterialFile, Buffer.from("coverage"));
  copyAllowedFile(allowedMaterialFile, copiedMaterialFile);
  assert.equal(fs.readFileSync(copiedMaterialFile, "utf8"), "coverage", "copy should work inside allowed material roots");
  removeAllowedPath(copiedMaterialFile, { force: true });
  assert.equal(fs.existsSync(copiedMaterialFile), false, "remove should work inside allowed material roots");

  const slideOutputFile = path.join(outputDir, "coverage-boundary.bin");
  writeAllowedBinary(slideOutputFile, Buffer.from("coverage-output"));
  assert.equal(fs.readFileSync(slideOutputFile, "utf8"), "coverage-output", "writes should work inside configured slide output roots");
  removeAllowedPath(slideOutputFile, { force: true });

  assert.throws(
    () => assertAllowedWriteTarget(path.join(process.cwd(), "package.json")),
    /outside the studio write boundary/,
    "write boundary should reject repo files outside allowed roots"
  );
  assert.throws(
    () => ensureAllowedDir(path.join(process.cwd(), "..", "slideotter-outside")),
    /outside the studio write boundary/,
    "directory creation should be blocked outside allowed roots"
  );
});
