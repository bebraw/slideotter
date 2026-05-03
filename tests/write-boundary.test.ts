import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
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
const { getPresentationPaths } = require("../studio/server/services/presentations.ts");

type JsonRecord = Record<string, unknown>;
type CoveragePresentationFields = Record<string, unknown>;

type CoveragePresentation = JsonRecord & {
  id: string;
  title?: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: CoveragePresentation[];
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(suffix: string, fields: CoveragePresentationFields = {}): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise high-risk filesystem-backed studio services.",
    title: `Coverage Risk ${Date.now()} ${suffix}`,
    ...fields
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function listCoveragePresentations(): PresentationRegistry {
  return listPresentations();
}

function cleanupCoveragePresentations(): void {
  const current = listCoveragePresentations();
  const knownIds = new Set(current.presentations.map((presentation: CoveragePresentation) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch (error) {
      // Keep cleanup best-effort so the original assertion failure remains visible.
    }
  }

  const afterCleanup = listCoveragePresentations();
  if (afterCleanup.presentations.some((presentation: CoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

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
