import assert from "node:assert/strict";
import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const activeDeckContext = require("../studio/server/services/active-deck-context.ts");
const { getOutputConfig } = require("../studio/server/services/output-config.ts");
const { getActivePresentationPaths, listPresentations } = require("../studio/server/services/presentations.ts");

function main() {
  const presentationsState = listPresentations();
  const outputConfig = getOutputConfig();
  const expectedArchive = path.join(path.dirname(outputConfig.archiveFile), `${presentationsState.activePresentationId}.pdf`);
  const expectedBaseline = path.join(path.dirname(outputConfig.baselineDir), presentationsState.activePresentationId);
  const expectedContactSheet = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "contact-sheet.png");
  const expectedDeckStructurePreviewDir = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "deck-structure-previews");
  const expectedPdf = path.join(outputConfig.outputDir, `${presentationsState.activePresentationId}.pdf`);
  const expectedPptx = path.join(outputConfig.outputDir, `${presentationsState.activePresentationId}.pptx`);
  const expectedPptxPreviewDir = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "pptx-rendered-pages");
  const expectedPreviewDir = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "rendered-pages");
  const expectedVariantPreviewDir = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "variant-previews");

  assert.equal(
    outputConfig.outputBaseName,
    presentationsState.activePresentationId,
    "Output base name should follow the active presentation id"
  );
  assert.equal(
    outputConfig.pdfFile,
    expectedPdf,
    "PDF output path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.pptxFile,
    expectedPptx,
    "PPTX output path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.archiveFile,
    expectedArchive,
    "Archive output path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.baselineDir,
    expectedBaseline,
    "Render baseline path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.contactSheetFile,
    expectedContactSheet,
    "Contact sheet path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.previewDir,
    expectedPreviewDir,
    "Preview image path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.pptxPreviewDir,
    expectedPptxPreviewDir,
    "PPTX preview image path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.deckStructurePreviewDir,
    expectedDeckStructurePreviewDir,
    "Deck-plan preview path should be derived from the active presentation id"
  );
  assert.equal(
    outputConfig.variantPreviewDir,
    expectedVariantPreviewDir,
    "Variant preview path should be derived from the active presentation id"
  );
  assert.equal(
    activeDeckContext._test.getActiveDeckContextFile(),
    getActivePresentationPaths().deckContextFile,
    "Shared deck readers should resolve through the active presentation deck context"
  );

  process.stdout.write("Output config validation passed.\n");
}

main();
