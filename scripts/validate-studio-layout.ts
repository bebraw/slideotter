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
            window.localStorage.removeItem("studio.appTheme");
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
              currentSlideLabel: rectFor("#selected-slide-label"),
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              appTheme: document.documentElement.dataset.appTheme,
              llmButton: rectFor("#show-llm-diagnostics"),
              llmPopoverHidden: (document.querySelector("#llm-status-popover") as HTMLElement | null)?.hidden,
              llmStatus: document.querySelector("#llm-nav-status")?.textContent || "",
              llmState: document.querySelector("#llm-nav-status")?.getAttribute("data-state") || "",
              previewFrame: rectFor(".preview-frame"),
              studioTabs: rectFor(".studio-tabs"),
              themeLabel: document.querySelector("#theme-toggle-label")?.textContent || "",
              themePressed: document.querySelector("#theme-toggle")?.getAttribute("aria-pressed"),
              themeToggle: rectFor("#theme-toggle"),
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
          assert.equal(metrics.appTheme, "light", "Studio should default to light theme in a light browser context");
          assert.equal(metrics.themeLabel, "Light", "Theme toggle should show the current light theme");
          assert.equal(metrics.themePressed, "false", "Theme toggle should expose its inactive pressed state in light mode");
          assert.ok(metrics.themeToggle, "Studio should expose an app theme toggle in the masthead");
          assert.ok(metrics.currentSlideLabel, "Studio should expose the current slide label in the masthead");
          if (viewport.width > 1180) {
            const currentSlideCenter = (metrics.currentSlideLabel.left + metrics.currentSlideLabel.right) / 2;
            assert.ok(
              Math.abs(currentSlideCenter - (metrics.viewportWidth / 2)) <= 8,
              `Current slide label should be centered in the masthead at ${viewport.width}x${viewport.height}`
            );
          }
          assert.ok(
            metrics.themeToggle.right <= metrics.viewportWidth + 1,
            `Theme toggle should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          await page.click("#theme-toggle");
          await page.waitForTimeout(80);

          const darkThemeMetrics = await page.evaluate(() => ({
            appTheme: document.documentElement.dataset.appTheme,
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            storedTheme: window.localStorage.getItem("studio.appTheme"),
            themeLabel: document.querySelector("#theme-toggle-label")?.textContent || "",
            themePressed: document.querySelector("#theme-toggle")?.getAttribute("aria-pressed")
          }));

          assert.equal(darkThemeMetrics.appTheme, "dark", "Theme toggle should switch the app into dark mode");
          assert.equal(darkThemeMetrics.storedTheme, "dark", "Theme toggle should persist the chosen app theme");
          assert.equal(darkThemeMetrics.themeLabel, "Dark", "Theme toggle should show the current dark theme");
          assert.equal(darkThemeMetrics.themePressed, "true", "Theme toggle should expose its pressed state in dark mode");
          assert.ok(
            darkThemeMetrics.documentScrollWidth <= darkThemeMetrics.documentClientWidth + 1,
            `Dark mode should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
          );

          assert.ok(metrics.previewFrame, "Slide Studio should render the active preview frame");
          assert.ok(
            metrics.previewFrame.bottom <= metrics.viewportHeight + 1,
            `Active slide preview should fit in the first viewport at ${viewport.width}x${viewport.height} (bottom ${metrics.previewFrame.bottom.toFixed(1)}px > viewport ${metrics.viewportHeight}px)`
          );
          assert.ok(metrics.studioTabs, "Slide Studio should expose Current slide, Slide context, and Variant generation tabs");
          assert.ok(
            metrics.studioTabs.right <= metrics.viewportWidth + 1,
            `Slide Studio tabs should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          const initialTabMetrics = await page.evaluate(() => ({
            currentAriaSelected: document.querySelector("#show-current-slide-tab")?.getAttribute("aria-selected"),
            currentHidden: (document.querySelector("#current-slide-panel") as HTMLElement | null)?.hidden,
            contextAriaSelected: document.querySelector("#show-slide-context-tab")?.getAttribute("aria-selected"),
            contextHidden: (document.querySelector("#slide-context-panel") as HTMLElement | null)?.hidden,
            variantAriaSelected: document.querySelector("#show-variant-generation-tab")?.getAttribute("aria-selected"),
            variantHidden: (document.querySelector("#variant-generation-panel") as HTMLElement | null)?.hidden
          }));
          assert.equal(initialTabMetrics.currentAriaSelected, "true", "Current slide tab should be selected by default");
          assert.equal(initialTabMetrics.contextAriaSelected, "false", "Slide context tab should not be selected by default");
          assert.equal(initialTabMetrics.variantAriaSelected, "false", "Variant generation tab should not be selected by default");
          assert.equal(initialTabMetrics.currentHidden, false, "Current slide panel should be visible by default");
          assert.equal(initialTabMetrics.contextHidden, true, "Slide context panel should be hidden by default");
          assert.equal(initialTabMetrics.variantHidden, true, "Variant generation panel should be hidden by default");

          await page.click("#show-slide-context-tab");
          await page.waitForTimeout(80);
          const contextTabMetrics = await page.evaluate(() => ({
            currentAriaSelected: document.querySelector("#show-current-slide-tab")?.getAttribute("aria-selected"),
            currentHidden: (document.querySelector("#current-slide-panel") as HTMLElement | null)?.hidden,
            contextAriaSelected: document.querySelector("#show-slide-context-tab")?.getAttribute("aria-selected"),
            contextDisclosureCount: document.querySelectorAll("#slide-context-panel details, #slide-context-panel summary").length,
            contextHidden: (document.querySelector("#slide-context-panel") as HTMLElement | null)?.hidden,
            contextHeadingCount: document.querySelectorAll("#slide-context-panel .eyebrow, #slide-context-panel .disclosure-action").length,
            variantAriaSelected: document.querySelector("#show-variant-generation-tab")?.getAttribute("aria-selected"),
            variantHidden: (document.querySelector("#variant-generation-panel") as HTMLElement | null)?.hidden
          }));
          assert.equal(contextTabMetrics.currentAriaSelected, "false", "Current slide tab should deselect when Slide context is selected");
          assert.equal(contextTabMetrics.contextAriaSelected, "true", "Slide context tab should expose selected state");
          assert.equal(contextTabMetrics.variantAriaSelected, "false", "Variant generation tab should remain deselected when Slide context is selected");
          assert.equal(contextTabMetrics.currentHidden, true, "Current slide panel should hide when Slide context is selected");
          assert.equal(contextTabMetrics.contextHidden, false, "Slide context panel should be visible when selected");
          assert.equal(contextTabMetrics.contextDisclosureCount, 0, "Slide context tab should not contain a nested disclosure");
          assert.equal(contextTabMetrics.contextHeadingCount, 0, "Slide context tab should not repeat the tab label as a nested heading or action");
          assert.equal(contextTabMetrics.variantHidden, true, "Variant generation panel should remain hidden when Slide context is selected");

          await page.click("#show-variant-generation-tab");
          await page.waitForTimeout(80);
          const variantTabMetrics = await page.evaluate(() => ({
            currentAriaSelected: document.querySelector("#show-current-slide-tab")?.getAttribute("aria-selected"),
            currentHidden: (document.querySelector("#current-slide-panel") as HTMLElement | null)?.hidden,
            contextAriaSelected: document.querySelector("#show-slide-context-tab")?.getAttribute("aria-selected"),
            contextHidden: (document.querySelector("#slide-context-panel") as HTMLElement | null)?.hidden,
            variantAriaSelected: document.querySelector("#show-variant-generation-tab")?.getAttribute("aria-selected"),
            variantHidden: (document.querySelector("#variant-generation-panel") as HTMLElement | null)?.hidden
          }));
          assert.equal(variantTabMetrics.currentAriaSelected, "false", "Current slide tab should deselect when Variant generation is selected");
          assert.equal(variantTabMetrics.contextAriaSelected, "false", "Slide context tab should deselect when Variant generation is selected");
          assert.equal(variantTabMetrics.variantAriaSelected, "true", "Variant generation tab should expose selected state");
          assert.equal(variantTabMetrics.currentHidden, true, "Current slide panel should hide when Variant generation is selected");
          assert.equal(variantTabMetrics.contextHidden, true, "Current slide context should hide when Variant generation is selected");
          assert.equal(variantTabMetrics.variantHidden, false, "Variant generation panel should be visible when selected");

          await page.click("#show-current-slide-tab");
          await page.waitForTimeout(80);
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });

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
          assert.ok(metrics.llmButton, "Slide Studio should expose LLM status from the masthead");
          assert.ok(metrics.llmStatus.trim().length > 0, "LLM status should show a compact masthead label");
          assert.match(metrics.llmState, /^(idle|ok|warn)$/, "LLM status should expose a known visual state");
          assert.ok(
            metrics.llmButton.right <= metrics.viewportWidth + 1,
            `LLM status should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          await page.click("#show-llm-diagnostics");
          await page.waitForFunction(() => {
            const popover = document.querySelector("#llm-status-popover") as HTMLElement | null;
            return Boolean(popover && !popover.hidden);
          });
          const llmPopoverMetrics = await page.evaluate(() => {
            const popover = document.querySelector("#llm-status-popover") as HTMLElement | null;
            const button = document.querySelector("#show-llm-diagnostics");
            const rect = popover ? popover.getBoundingClientRect() : null;

            return {
              ariaExpanded: button?.getAttribute("aria-expanded") || "",
              hidden: popover ? popover.hidden : true,
              right: rect ? rect.right : 0,
              width: rect ? rect.width : 0
            };
          });
          assert.equal(llmPopoverMetrics.hidden, false, "LLM status should open an in-place popover");
          assert.equal(llmPopoverMetrics.ariaExpanded, "true", "LLM status button should expose popover state");
          assert.ok(llmPopoverMetrics.width > 0, "LLM popover should have visible width");
          assert.ok(
            llmPopoverMetrics.right <= metrics.viewportWidth + 1,
            `LLM popover should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          const thumbnailSelectionMetrics = await page.evaluate(async () => {
            const rail = document.querySelector("#thumb-rail") as HTMLElement | null;
            const thumbnails = Array.from(document.querySelectorAll("#thumb-rail .thumb")) as HTMLButtonElement[];
            if (!rail || thumbnails.length < 10) {
              return {
                after: 0,
                before: 0,
                skipped: true
              };
            }

            thumbnails[9].scrollIntoView({
              block: "nearest",
              inline: "center"
            });
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            const before = rail.scrollLeft;
            thumbnails[9].click();

            return {
              before,
              skipped: false
            };
          });

          if (!thumbnailSelectionMetrics.skipped) {
            await page.waitForFunction(() => {
              return /10\//.test(document.querySelector("#selected-slide-label")?.textContent || "");
            });
            await page.waitForTimeout(120);
            const thumbnailAfterSelection = await page.evaluate(() => ({
              activeLabel: document.querySelector("#selected-slide-label")?.textContent || "",
              after: (document.querySelector("#thumb-rail") as HTMLElement | null)?.scrollLeft || 0
            }));
            assert.ok(
              thumbnailSelectionMetrics.before > 0,
              `Thumbnail rail should scroll to a later slide before selection at ${viewport.width}x${viewport.height}`
            );
            assert.ok(
              thumbnailAfterSelection.after >= thumbnailSelectionMetrics.before - 2,
              `Selecting a later slide should preserve thumbnail rail scroll at ${viewport.width}x${viewport.height} (${thumbnailAfterSelection.after.toFixed(1)}px < ${thumbnailSelectionMetrics.before.toFixed(1)}px)`
            );
            assert.match(
              thumbnailAfterSelection.activeLabel,
              /10\//,
              `Selecting the tenth thumbnail should update the selected slide label at ${viewport.width}x${viewport.height}`
            );
          }

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
              highlightedKeyColor: (() => {
                const token = document.querySelector("#slide-spec-highlight .json-token-key");
                return token ? window.getComputedStyle(token).color : "";
              })(),
              highlightedKeyWeight: (() => {
                const token = document.querySelector("#slide-spec-highlight .json-token-key");
                return token ? window.getComputedStyle(token).fontWeight : "";
              })(),
              highlightSoftTextColor: window.getComputedStyle(document.documentElement).getPropertyValue("--app-soft-text").trim(),
              highlightTokenCount: document.querySelectorAll("#slide-spec-highlight .json-token-key, #slide-spec-highlight .json-token-string, #slide-spec-highlight .json-token-number, #slide-spec-highlight .json-token-literal").length,
              saveButton: rectFor("#save-slide-spec-button"),
              toggle: rectFor("#structured-draft-toggle"),
              toggleLabel: document.querySelector("#structured-draft-toggle")?.textContent?.replace(/\s+/g, " ").trim() || "",
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth
            };
          });

          assert.ok(structuredMetrics.drawer, "Structured draft drawer should open");
          assert.ok(structuredMetrics.editor, "Structured draft drawer should expose the JSON editor");
          assert.ok(structuredMetrics.highlightTokenCount > 4, "Structured draft JSON editor should render syntax tokens");
          assert.notEqual(
            structuredMetrics.highlightedKeyColor,
            structuredMetrics.highlightSoftTextColor,
            "Structured draft JSON token colors should not be overridden by generic field label styling"
          );
          assert.ok(
            Number(structuredMetrics.highlightedKeyWeight) < 600,
            "Structured draft JSON tokens should not inherit field label font weight"
          );
          assert.ok(structuredMetrics.saveButton, "Structured draft drawer should expose the save action");
          assert.ok(structuredMetrics.toggle, "Structured draft drawer should keep its drawer tab visible");
          assert.equal(structuredMetrics.toggleLabel, "Spec", "Structured draft drawer should keep the Spec tab label when open");
          assert.ok(
            structuredMetrics.drawer.left >= -1 && structuredMetrics.drawer.right <= structuredMetrics.viewportWidth + 1,
            `Structured draft drawer should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
          );
          if (viewport.width > 760) {
            assert.ok(
              structuredMetrics.toggle.height > structuredMetrics.toggle.width * 2,
              `Structured draft open tab should keep the same vertical tab pattern as Chat at ${viewport.width}x${viewport.height}`
            );
          }
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
