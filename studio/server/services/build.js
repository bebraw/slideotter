const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { exportDeckPdfFromDom, renderDeckPreviewImagesFromDom } = require("./dom-export");
const { getDomPreviewState } = require("./dom-preview");
const { ensureDir, listPages } = require("./page-artifacts");
const {
  contactSheetFile,
  outputDir,
  previewDir,
  repoRoot,
  slidesDir
} = require("./paths");

function asAssetUrl(fileName) {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function getPreviewManifest() {
  const pages = listPages(previewDir);

  return {
    contactSheetUrl: fs.existsSync(contactSheetFile) ? asAssetUrl(contactSheetFile) : null,
    generatedAt: pages.length ? fs.statSync(pages[0]).mtime.toISOString() : null,
    pages: pages.map((fileName, index) => ({
      index: index + 1,
      name: path.basename(fileName),
      url: asAssetUrl(fileName)
    }))
  };
}

function clearPresentationModuleCache() {
  const roots = [
    path.join(repoRoot, "studio"),
    slidesDir
  ];

  Object.keys(require.cache).forEach((modulePath) => {
    if (roots.some((root) => modulePath.startsWith(root))) {
      delete require.cache[modulePath];
    }
  });
}

async function buildDeck() {
  const renderDiagrams = spawnSync(process.execPath, [
    path.join(repoRoot, "scripts", "render-diagrams.js")
  ], {
    encoding: "utf8"
  });

  if (renderDiagrams.status !== 0) {
    throw new Error(renderDiagrams.stderr || renderDiagrams.stdout || "Failed to regenerate diagrams");
  }

  clearPresentationModuleCache();
  return exportDeckPdfFromDom(getDomPreviewState());
}

async function renderDeckPreview() {
  ensureDir(outputDir);
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

module.exports = {
  buildAndRenderDeck,
  buildDeck,
  getPreviewManifest,
  renderDeckPreview
};
