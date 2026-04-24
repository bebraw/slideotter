const assert = require("node:assert/strict");
const path = require("node:path");
const { getOutputConfig } = require("../studio/server/services/output-config.ts");
const { listPresentations } = require("../studio/server/services/presentations.ts");

function main() {
  const presentationsState = listPresentations();
  const outputConfig = getOutputConfig();
  const expectedArchive = path.join(path.dirname(outputConfig.archiveFile), `${presentationsState.activePresentationId}.pdf`);
  const expectedBaseline = path.join(path.dirname(outputConfig.baselineDir), presentationsState.activePresentationId);
  const expectedContactSheet = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "contact-sheet.png");
  const expectedPdf = path.join(outputConfig.outputDir, `${presentationsState.activePresentationId}.pdf`);
  const expectedPreviewDir = path.join(outputConfig.outputDir, presentationsState.activePresentationId, "rendered-pages");

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

  process.stdout.write("Output config validation passed.\n");
}

main();
