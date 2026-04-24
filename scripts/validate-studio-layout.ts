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

          await page.click("#show-presentations-page");
          await page.waitForSelector("#presentation-list .presentation-card", {
            timeout: 30_000
          });
          await page.waitForTimeout(150);

          const presentationMetrics = await page.evaluate(() => {
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

            const firstTitle = document.querySelector(".presentation-card h3")?.textContent || "";

            return {
              activeCardCount: document.querySelectorAll(".presentation-card.active").length,
              card: rectFor(".presentation-card"),
              cardActions: rectFor(".presentation-card-actions"),
              cardCount: document.querySelectorAll(".presentation-card").length,
              createOpen: Boolean((document.querySelector(".presentation-create-details") as HTMLDetailsElement | null)?.open),
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              firstTitle,
              factCount: document.querySelectorAll(".presentation-card:first-child .presentation-card-facts span").length,
              facts: rectFor(".presentation-card:first-child .presentation-card-facts"),
              pageHidden: (document.querySelector("#presentations-page") as HTMLElement | null)?.hidden,
              preview: rectFor(".presentation-card-preview"),
              resultCount: document.querySelector("#presentation-result-count")?.textContent || "",
              search: rectFor("#presentation-search"),
              studioHidden: (document.querySelector("#studio-page") as HTMLElement | null)?.hidden,
              viewportWidth: window.innerWidth
            };
          });

          assert.equal(presentationMetrics.pageHidden, false, "Presentations page should be visible after navigation");
          assert.equal(presentationMetrics.studioHidden, true, "Slide Studio should be hidden while browsing presentations");
          assert.ok(presentationMetrics.cardCount > 0, "Presentations page should render at least one presentation card");
          assert.equal(presentationMetrics.activeCardCount, 1, "Presentations page should mark exactly one active presentation");
          assert.ok(presentationMetrics.firstTitle.trim().length > 0, "Presentation cards should show the presentation name");
          assert.ok(presentationMetrics.factCount >= 2, "Presentation cards should show compact metadata facts");
          assert.equal(presentationMetrics.createOpen, false, "Presentation creation constraints should stay collapsed by default");
          assert.ok(
            presentationMetrics.documentScrollWidth <= presentationMetrics.documentClientWidth + 1,
            `Presentations page should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
          );
          assert.ok(presentationMetrics.card, "Presentations page should expose a selectable card");
          assert.ok(
            presentationMetrics.card.right <= presentationMetrics.viewportWidth + 1,
            `Presentation cards should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.ok(presentationMetrics.preview, "Presentation cards should show a first-slide preview");
          assert.ok(
            presentationMetrics.preview.width >= Math.min(260, presentationMetrics.viewportWidth * 0.65),
            `Presentation preview should remain inspectable at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            Math.abs((presentationMetrics.preview.width / presentationMetrics.preview.height) - (16 / 9)) < 0.08,
            `Presentation preview should preserve a slide-like aspect ratio at ${viewport.width}x${viewport.height}`
          );
          assert.ok(presentationMetrics.cardActions, "Presentation cards should expose select, duplicate, and delete actions");
          assert.ok(presentationMetrics.search, "Presentations page should expose a compact search control");
          assert.ok(
            /presentation/.test(presentationMetrics.resultCount),
            "Presentations page should summarize filtered result count"
          );
          assert.ok(presentationMetrics.facts, "Presentation cards should expose metadata facts");
          assert.ok(
            presentationMetrics.facts.right <= presentationMetrics.viewportWidth + 1,
            `Presentation metadata should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          await page.fill("#presentation-search", "__missing_presentation__");
          await page.waitForTimeout(80);
          const filteredMetrics = await page.evaluate(() => ({
            cardCount: document.querySelectorAll(".presentation-card").length,
            emptyText: document.querySelector(".presentation-empty strong")?.textContent || "",
            resultCount: document.querySelector("#presentation-result-count")?.textContent || ""
          }));
          assert.equal(filteredMetrics.cardCount, 0, "Presentation search should filter non-matching cards");
          assert.equal(filteredMetrics.emptyText, "No matching presentations", "Presentation search should explain empty filtered state");
          assert.ok(/^0 of /.test(filteredMetrics.resultCount), "Presentation search should update filtered count");
          await page.fill("#presentation-search", "");
          await page.waitForSelector("#presentation-list .presentation-card", {
            timeout: 30_000
          });

          await page.click("#show-studio-page");
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          await page.waitForTimeout(120);

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
