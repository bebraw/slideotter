import * as path from "path";
import { archiveDir, baselineRootDir, slidesOutputDir } from "./paths.ts";
import { getActivePresentationId } from "./presentations.ts";

const outputDir = slidesOutputDir;

function getOutputConfig() {
  const outputBaseName = getActivePresentationId();

  return {
    archiveFile: path.join(archiveDir, `${outputBaseName}.pdf`),
    baselineDir: path.join(baselineRootDir, outputBaseName),
    contactSheetFile: path.join(outputDir, outputBaseName, "contact-sheet.png"),
    deckStructurePreviewDir: path.join(outputDir, outputBaseName, "deck-structure-previews"),
    outputBaseName,
    outputDir,
    pdfFile: path.join(outputDir, `${outputBaseName}.pdf`),
    pptxFile: path.join(outputDir, `${outputBaseName}.pptx`),
    pptxPreviewDir: path.join(outputDir, outputBaseName, "pptx-rendered-pages"),
    previewDir: path.join(outputDir, outputBaseName, "rendered-pages"),
    variantPreviewDir: path.join(outputDir, outputBaseName, "variant-previews")
  };
}

export {
  archiveDir,
  getOutputConfig,
  outputDir
};