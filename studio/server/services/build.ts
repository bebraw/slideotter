import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { exportDeckPdfFromDom, renderDeckPreviewImagesFromDom } from "./dom-export.ts";
import { getDomPreviewState } from "./dom-preview.ts";
import { exportDeckPptxFromDom } from "./pptx-export.ts";
import { ensureDir, listPages } from "./page-artifacts.ts";
import { getOutputConfig } from "./output-config.ts";
import {
  mode,
  repoRoot
} from "./paths.ts";
import { getActivePresentationPaths } from "./presentations.ts";
import { asStudioOutputAssetUrl } from "./studio-output-assets.ts";

function asAssetUrl(fileName: string) {
  return asStudioOutputAssetUrl(fileName);
}

function getPreviewManifest() {
  const { contactSheetFile, previewDir } = getOutputConfig();
  const pages = listPages(previewDir);

  return {
    contactSheetUrl: fs.existsSync(contactSheetFile) ? asAssetUrl(contactSheetFile) : null,
    generatedAt: pages[0] ? fs.statSync(pages[0]).mtime.toISOString() : null,
    pages: pages.map((fileName: string, index: number) => ({
      index: index + 1,
      name: path.basename(fileName),
      url: asAssetUrl(fileName)
    }))
  };
}

function clearPresentationModuleCache() {
  getActivePresentationPaths();
}

async function buildDeck() {
  if (mode === "repo") {
    const renderDiagrams = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts", "render-diagrams.ts")
    ], {
      encoding: "utf8"
    });

    if (renderDiagrams.status !== 0) {
      throw new Error(renderDiagrams.stderr || renderDiagrams.stdout || "Failed to regenerate diagrams");
    }
  }

  clearPresentationModuleCache();
  return exportDeckPdfFromDom(getDomPreviewState());
}

async function exportDeckPptx() {
  clearPresentationModuleCache();
  return exportDeckPptxFromDom();
}

async function renderDeckPreview() {
  ensureDir(getOutputConfig().outputDir);
  await renderDeckPreviewImagesFromDom(getDomPreviewState());
  return getPreviewManifest();
}

async function buildAndRenderDeck() {
  const build = await buildDeck();
  const previews = await renderDeckPreview();

  return {
    build,
    previews
  };
}

export {
  buildAndRenderDeck,
  buildDeck,
  exportDeckPptx,
  getPreviewManifest,
  renderDeckPreview
};
