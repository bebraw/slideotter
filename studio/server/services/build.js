const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  createContactSheet,
  ensureDir,
  listPages,
  renderPdfPages
} = require("../../../generator/render-utils");
const { pdfFile } = require("../../../generator/output-config");
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
    path.join(repoRoot, "generator"),
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
    path.join(repoRoot, "generator", "render-diagrams.js")
  ], {
    encoding: "utf8"
  });

  if (renderDiagrams.status !== 0) {
    throw new Error(renderDiagrams.stderr || renderDiagrams.stdout || "Failed to regenerate diagrams");
  }

  clearPresentationModuleCache();
  const { createPdfPresentation } = require("../../../generator/pdf-renderer");
  const { pres } = createPdfPresentation();
  ensureDir(path.dirname(pdfFile));
  await pres.writeFile({ fileName: pdfFile });

  return {
    pdfFile
  };
}

function renderDeckPreview() {
  ensureDir(outputDir);
  const pages = renderPdfPages(previewDir);
  createContactSheet(pages, contactSheetFile);
  return getPreviewManifest();
}

async function buildAndRenderDeck() {
  const build = await buildDeck();
  const previews = renderDeckPreview();

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
