const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { renderDeckDocument, renderSlideDocument } = require("../../client/slide-dom.ts");
const { clientDir } = require("./paths.ts");
const { getOutputConfig } = require("./output-config.ts");
const { createContactSheet, ensureDir, listPages, resetDir } = require("./page-artifacts.ts");

type Browser = import("playwright").Browser;

type SlideEntry = {
  id?: string;
  index: number | string;
  slideSpec: unknown;
  title?: string;
};

type PreviewState = {
  lang?: string;
  metadata?: unknown;
  slides: SlideEntry[];
  theme?: unknown;
  title?: string;
};

type RenderDeckImageOptions = {
  contactSheetFile?: string | null;
  imageScale?: number;
  targetDir: string;
};

function readInlineStyles(): string {
  const visited = new Set<string>();

  function readCss(filePath: string): string {
    const resolvedPath = path.resolve(filePath);
    if (visited.has(resolvedPath)) {
      return "";
    }
    visited.add(resolvedPath);
    const css = fs.readFileSync(resolvedPath, "utf8");
    return css.replace(/@import\s+["']([^"']+)["'];/gu, (_match: string, importPath: string) => {
      return readCss(path.resolve(path.dirname(resolvedPath), importPath));
    });
  }

  return readCss(path.join(clientDir, "styles.css"));
}

function domExportCss(): string {
  return `
html, body {
  margin: 0;
  padding: 0;
}
body {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.dom-deck-document {
  background: #ffffff;
}
.dom-deck-document__page {
  max-width: none;
  padding: 0;
}
.dom-deck-document__header {
  display: none;
}
.dom-deck-document__slides {
  display: block;
  gap: 0;
}
.dom-deck-document__slides > .dom-slide {
  break-after: auto;
  page-break-after: auto;
}
.dom-slide-document,
.dom-slide-document__page {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
.dom-slide-document__page {
  width: 960px;
  height: 540px;
  overflow: hidden;
}
`;
}

function createStandaloneDeckHtml(previewState: PreviewState): string {
  return renderDeckDocument({
    inlineCss: `${readInlineStyles()}\n${domExportCss()}`,
    lang: previewState.lang,
    metadata: previewState.metadata,
    slides: previewState.slides,
    theme: previewState.theme,
    title: previewState.title
  });
}

function createStandaloneSlideHtml(previewState: PreviewState, slideEntry: SlideEntry): string {
  return renderSlideDocument({
    index: slideEntry.index,
    inlineCss: `${readInlineStyles()}\n${domExportCss()}`,
    lang: previewState.lang,
    metadata: previewState.metadata,
    slideSpec: slideEntry.slideSpec,
    theme: previewState.theme,
    title: slideEntry.title || previewState.title,
    totalSlides: previewState.slides.length
  });
}

async function withBrowser<T>(task: (browser: Browser) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({ headless: true });

  try {
    return await task(browser);
  } finally {
    await browser.close();
  }
}

async function exportDeckPdfFromDom(previewState: PreviewState) {
  const html = createStandaloneDeckHtml(previewState);
  const { pdfFile } = getOutputConfig();
  ensureDir(path.dirname(pdfFile));

  await withBrowser(async (browser: Browser) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });

    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      displayHeaderFooter: false,
      height: "5.625in",
      margin: { bottom: "0in", left: "0in", right: "0in", top: "0in" },
      path: pdfFile,
      printBackground: true,
      preferCSSPageSize: true,
      width: "10in"
    });
    await page.close();
  });

  return {
    pdfFile
  };
}

async function renderDeckImagesFromDom(previewState: PreviewState, options: RenderDeckImageOptions) {
  const imageScale = Number.isFinite(options.imageScale) && options.imageScale ? Math.max(1, options.imageScale) : 1;
  resetDir(options.targetDir);

  await withBrowser(async (browser: Browser) => {
    const page = await browser.newPage({
      deviceScaleFactor: imageScale,
      viewport: {
        height: 540,
        width: 960
      }
    });

    for (let index = 0; index < previewState.slides.length; index += 1) {
      const slideEntry = previewState.slides[index];
      if (!slideEntry) {
        continue;
      }
      const targetPath = path.join(options.targetDir, `page-${String(index).padStart(2, "0")}.png`);
      const html = createStandaloneSlideHtml(previewState, slideEntry);
      await page.setContent(html, { waitUntil: "load" });
      await page.screenshot({
        omitBackground: false,
        path: targetPath,
        type: "png"
      });
    }

    await page.close();
  });

  const pages = listPages(options.targetDir);
  if (options.contactSheetFile) {
    await createContactSheet(pages, options.contactSheetFile);
  }
  return pages;
}

async function renderDeckPreviewImagesFromDom(previewState: PreviewState) {
  const { contactSheetFile, previewDir } = getOutputConfig();
  return renderDeckImagesFromDom(previewState, {
    contactSheetFile,
    imageScale: 1,
    targetDir: previewDir
  });
}

module.exports = {
  createStandaloneDeckHtml,
  createStandaloneSlideHtml,
  exportDeckPdfFromDom,
  renderDeckImagesFromDom,
  renderDeckPreviewImagesFromDom,
  withBrowser
};
