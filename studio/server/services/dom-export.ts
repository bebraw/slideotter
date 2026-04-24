const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { renderDeckDocument, renderSlideDocument } = require("../../client/slide-dom.ts");
const { clientDir } = require("./paths.ts");
const { getOutputConfig } = require("./output-config.ts");
const { createContactSheet, ensureDir, listPages, resetDir } = require("./page-artifacts.ts");

function readInlineStyles() {
  return fs.readFileSync(path.join(clientDir, "styles.css"), "utf8");
}

function domExportCss() {
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
  gap: 0;
}
.dom-deck-document__slides > .dom-slide {
  break-after: page;
  page-break-after: always;
}
.dom-deck-document__slides > .dom-slide:last-child {
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

function createStandaloneDeckHtml(previewState) {
  return renderDeckDocument({
    inlineCss: `${readInlineStyles()}\n${domExportCss()}`,
    lang: previewState.lang,
    metadata: previewState.metadata,
    slides: previewState.slides,
    theme: previewState.theme,
    title: previewState.title
  });
}

function createStandaloneSlideHtml(previewState, slideEntry) {
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

async function withBrowser(task) {
  const browser = await chromium.launch({ headless: true });

  try {
    return await task(browser);
  } finally {
    await browser.close();
  }
}

async function exportDeckPdfFromDom(previewState) {
  const html = createStandaloneDeckHtml(previewState);
  const { pdfFile } = getOutputConfig();
  ensureDir(path.dirname(pdfFile));

  await withBrowser(async (browser) => {
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

async function renderDeckPreviewImagesFromDom(previewState) {
  const { contactSheetFile, previewDir } = getOutputConfig();
  resetDir(previewDir);

  await withBrowser(async (browser) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });

    for (let index = 0; index < previewState.slides.length; index += 1) {
      const slideEntry = previewState.slides[index];
      const targetPath = path.join(previewDir, `page-${String(index).padStart(2, "0")}.png`);
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

  const pages = listPages(previewDir);
  createContactSheet(pages, contactSheetFile);
  return pages;
}

module.exports = {
  createStandaloneDeckHtml,
  createStandaloneSlideHtml,
  exportDeckPdfFromDom,
  renderDeckPreviewImagesFromDom,
  withBrowser
};
