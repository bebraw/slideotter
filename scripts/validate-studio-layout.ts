const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright");
const { startServer } = require("../studio/server/index.ts");

const viewports = [
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 }
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const server = startServer({ port: 0 });

  try {
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;
    assert.ok(port, "studio layout validation needs a local server port");

    const browser = await chromium.launch({ headless: true });

    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          colorScheme: "light",
          deviceScaleFactor: 1,
          viewport
        });

        try {
          await page.addInitScript(() => {
            window.localStorage.removeItem("studio.assistantDrawerOpen");
            window.localStorage.removeItem("studio.structuredDraftDrawerOpen");
            window.localStorage.removeItem("studio.currentPage");
          });
          await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          await page.waitForTimeout(250);

          const metrics = await page.evaluate(() => {
            function rectFor(selector) {
              const element = document.querySelector(selector);
              if (!element) {
                return null;
              }

              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width
              };
            }

            return {
              checksButton: rectFor("#show-validation-page"),
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              previewFrame: rectFor(".preview-frame"),
              thumbRail: rectFor(".thumb-rail"),
              thumbTextVisible: Array.from(document.querySelectorAll(".thumb strong, .thumb span:not(.thumb-index)")).some((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();

                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 2 && rect.height > 2;
              }),
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth
            };
          });

          assert.ok(
            metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
            `Slide Studio should not create horizontal page overflow at ${viewport.width}x${viewport.height} (${metrics.documentScrollWidth}px > ${metrics.documentClientWidth}px)`
          );

          assert.ok(metrics.previewFrame, "Slide Studio should render the active preview frame");
          assert.ok(
            metrics.previewFrame.bottom <= metrics.viewportHeight + 1,
            `Active slide preview should fit in the first viewport at ${viewport.width}x${viewport.height} (bottom ${metrics.previewFrame.bottom.toFixed(1)}px > viewport ${metrics.viewportHeight}px)`
          );

          assert.ok(metrics.thumbRail, "Slide Studio should render the thumbnail rail");
          assert.ok(
            metrics.thumbRail.width <= metrics.viewportWidth + 1,
            `Thumbnail rail should stay within the page viewport at ${viewport.width}x${viewport.height} (${metrics.thumbRail.width.toFixed(1)}px > ${metrics.viewportWidth}px)`
          );
          assert.ok(
            metrics.thumbRail.height <= 112,
            `Thumbnail rail should stay compact at ${viewport.width}x${viewport.height} (${metrics.thumbRail.height.toFixed(1)}px > 112px)`
          );
          assert.equal(metrics.thumbTextVisible, false, "Thumbnail rail should not expose title or file labels that can clip");

          assert.ok(metrics.checksButton, "Slide Studio should expose deck checks from the masthead");
          await page.click("#structured-draft-toggle");
          await page.waitForTimeout(280);

          const structuredMetrics = await page.evaluate(() => {
            function rectFor(selector) {
              const element = document.querySelector(selector);
              if (!element) {
                return null;
              }

              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width
              };
            }

            return {
              drawer: rectFor("#structured-draft-drawer"),
              editor: rectFor("#slide-spec-editor"),
              saveButton: rectFor("#save-slide-spec-button"),
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth
            };
          });

          assert.ok(structuredMetrics.drawer, "Structured draft drawer should open");
          assert.ok(structuredMetrics.editor, "Structured draft drawer should expose the JSON editor");
          assert.ok(structuredMetrics.saveButton, "Structured draft drawer should expose the save action");
          assert.ok(
            structuredMetrics.drawer.left >= -1 && structuredMetrics.drawer.right <= structuredMetrics.viewportWidth + 1,
            `Structured draft drawer should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            structuredMetrics.drawer.top >= -1 && structuredMetrics.drawer.bottom <= structuredMetrics.viewportHeight + 1,
            `Structured draft drawer should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            structuredMetrics.editor.height >= Math.min(220, structuredMetrics.viewportHeight * 0.28),
            `Structured draft JSON editor should remain usable at ${viewport.width}x${viewport.height} (${structuredMetrics.editor.height.toFixed(1)}px tall)`
          );
          assert.ok(
            structuredMetrics.saveButton.bottom <= structuredMetrics.viewportHeight + 1,
            `Structured draft save action should stay visible at ${viewport.width}x${viewport.height}`
          );

          await page.click("#structured-draft-toggle");
          await page.waitForTimeout(280);

          await page.click("#show-validation-page");
          await page.waitForTimeout(100);

          const checksMetrics = await page.evaluate(() => {
            const panel = document.querySelector("#validation-page");
            const studioPage = document.querySelector("#studio-page");
            const rect = panel ? panel.getBoundingClientRect() : null;

            return {
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              expanded: document.querySelector("#show-validation-page")?.getAttribute("aria-expanded"),
              panel: rect ? {
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width
              } : null,
              studioHidden: studioPage ? (studioPage as HTMLElement).hidden : true,
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth
            };
          });

          assert.equal(checksMetrics.expanded, "true", "Checks control should expose its expanded state");
          assert.equal(checksMetrics.studioHidden, false, "Opening checks should keep Slide Studio visible");
          assert.ok(checksMetrics.panel, "Checks control should open the checks panel");
          assert.ok(
            checksMetrics.documentScrollWidth <= checksMetrics.documentClientWidth + 1,
            `Checks panel should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            checksMetrics.panel.left >= -1 && checksMetrics.panel.right <= checksMetrics.viewportWidth + 1,
            `Checks panel should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            checksMetrics.panel.top >= -1 && checksMetrics.panel.bottom <= checksMetrics.viewportHeight + 1,
            `Checks panel should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
          );
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }

  process.stdout.write("Studio layout validation passed.\n");
}
