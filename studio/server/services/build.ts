import * as path from "path";
import { spawnSync } from "child_process";
import { exportDeckPdfFromDom, renderDeckPreviewImagesFromDom } from "./dom-export.ts";
import { getDomPreviewState } from "./dom-preview.ts";
import { exportDeckPptxFromDom } from "./pptx-export.ts";
import { ensureDir } from "./page-artifacts.ts";
import { getOutputConfig } from "./output-config.ts";
import { getPreviewManifest } from "./preview-manifest.ts";
import {
  mode,
  repoRoot
} from "./paths.ts";
import { getActivePresentationPaths } from "./presentations.ts";

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
  renderDeckPreview
};
