import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);

import { once } from "node:events";
import { chromium } from "playwright";
import { validateAssistantSupport } from "./studio-layout/assistant.ts";
import { validateCurrentSlideWorkbench } from "./studio-layout/current-slide-workbench.ts";
import { validateCustomLayoutDrawer } from "./studio-layout/custom-layout.ts";
import { validatePresentationLibrary } from "./studio-layout/presentation-library.ts";
import { validateContextAndStructuredDrawers } from "./studio-layout/side-drawers.ts";
import { validateThemeControls } from "./studio-layout/theme.ts";
import { validateThumbnailRailSelectionScroll } from "./studio-layout/thumbnail-rail.ts";
import {
  validateDrawerClickSwitching,
  validateDrawerHoverLabels,
  validateDrawerKeyboardShortcuts
} from "./studio-layout/drawer-interactions.ts";
import {
  clickDrawerControl,
  getDrawerShortcut,
  requireRect,
  validateInitialDrawerPreferenceConflict,
  validateLayoutDrawerDoesNotSqueezeWorkspace
} from "./studio-layout/drawers.ts";
import { validateOutlineDrawer } from "./studio-layout/outline-drawer.ts";
const { startServer } = require("../studio/server/index.ts");

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type StudioLayoutValidationOptions = {
  server?: {
    address: () => string | import("node:net").AddressInfo | null;
    close: (callback?: () => void) => void;
    listening?: boolean;
  };
};

type MastheadPage = {
  button: string;
  hash: string;
  label: string;
  page: string;
};

const viewports: ViewportSize[] = [
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 }
];

const mastheadPages: MastheadPage[] = [
  {
    button: "#show-presentations-page",
    hash: "#presentations",
    label: "Presentations",
    page: "#presentations-page"
  },
  {
    button: "#show-studio-page",
    hash: "#studio",
    label: "Slide Studio",
    page: "#studio-page"
  }
];

async function validateMastheadPageNavigation(page: Page, viewport: ViewportSize): Promise<void> {
  for (const target of mastheadPages) {
    await page.click(target.button);
    await page.waitForFunction(
      ({ button, hash, page: pageSelector }: MastheadPage) => {
        const navButton = document.querySelector(button);
        const workspacePage = document.querySelector(pageSelector) as HTMLElement | null;

        return Boolean(
          navButton?.classList.contains("active") &&
          navButton.getAttribute("aria-pressed") === "true" &&
          workspacePage &&
          !workspacePage.hidden &&
          window.location.hash === hash
        );
      },
      target,
      { timeout: 3_000 }
    );

    const metrics = await page.evaluate(({ button, page: pageSelector }: MastheadPage) => {
      const navButton = document.querySelector(button);
      const workspacePage = document.querySelector(pageSelector) as HTMLElement | null;

      return {
        active: Boolean(navButton?.classList.contains("active")),
        ariaPressed: navButton?.getAttribute("aria-pressed") || "",
        hash: window.location.hash,
        hidden: workspacePage ? workspacePage.hidden : true
      };
    }, target);

    assert.equal(metrics.hidden, false, `${target.label} nav should reveal ${target.page} at ${viewport.width}x${viewport.height}`);
    assert.equal(metrics.active, true, `${target.label} nav should mark its button active at ${viewport.width}x${viewport.height}`);
    assert.equal(metrics.ariaPressed, "true", `${target.label} nav should expose pressed state at ${viewport.width}x${viewport.height}`);
    assert.equal(metrics.hash, target.hash, `${target.label} nav should update the URL hash at ${viewport.width}x${viewport.height}`);
  }

  await page.click("#show-studio-page");
  await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
    timeout: 30_000
  });
}

async function runStudioLayoutValidation(options: StudioLayoutValidationOptions = {}): Promise<void> {
  const server = options.server || startServer({ port: 0 });
  const ownsServer = !options.server;

  try {
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;
    assert.ok(port, "studio layout validation needs a local server port");

    const browser = await chromium.launch({ headless: true });

    try {
      await validateInitialDrawerPreferenceConflict(browser, port);
      for (const viewport of viewports) {
        const page = await browser.newPage({
          colorScheme: "light",
          deviceScaleFactor: 1,
          viewport
        });

        try {
          const appScriptResponse = await page.request.get(`http://127.0.0.1:${port}/app.js`);
          assert.equal(appScriptResponse.ok(), true, "Studio app script should be served to Playwright");
          assert.match(
            appScriptResponse.headers()["cache-control"] || "",
            /no-store/i,
            "Studio app script should bypass browser cache so Chrome does not keep stale layout code"
          );
          await page.addInitScript(() => {
            window.localStorage.removeItem("studio.assistantDrawerOpen");
            window.localStorage.removeItem("studio.contextDrawerOpen");
            window.localStorage.removeItem("studio.structuredDraftDrawerOpen");
            window.localStorage.removeItem("studio.currentPage");
            window.localStorage.removeItem("studio.appTheme");
          });
          await page.goto(`http://127.0.0.1:${port}/#studio`, { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          const standaloneLayoutNavPresent = await page.locator("#show-layout-studio-page, #layout-studio-page").count();
          assert.equal(standaloneLayoutNavPresent, 0, "Layout Studio should be integrated into the Slide Studio layout drawer");
          await validateDrawerHoverLabels(page);
          await validateDrawerClickSwitching(page, viewport);
          await validateDrawerKeyboardShortcuts(page, viewport);
          await validateLayoutDrawerDoesNotSqueezeWorkspace(page, viewport);
          await validateOutlineDrawer(page, viewport, port);
          await page.goto(`http://127.0.0.1:${port}/#layout-studio`, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => {
            const studioPage = document.querySelector("#studio-page") as HTMLElement | null;
            return Boolean(
              studioPage &&
              !studioPage.hidden &&
              document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true" &&
              document.querySelector("#layout-studio-list")
            );
          });
          await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
          await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") !== "true");
          await page.evaluate(() => {
            const url = new URL(window.location.href);
            url.hash = "#studio";
            window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
          });
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          const contentSlideSelected = await page.evaluate(() => {
            const contentThumb = Array.from(document.querySelectorAll("#thumb-rail .thumb"))
              .find((button) => button.querySelector(".dom-slide--content")) as HTMLButtonElement | undefined;
            if (!contentThumb) {
              return false;
            }
            contentThumb.click();
            return true;
          });
          assert.equal(contentSlideSelected, true, "Studio validation needs a content slide for custom layout preview checks");
          await page.waitForSelector("#active-preview .dom-slide--content", {
            timeout: 30_000
          });
          await page.waitForTimeout(250);
          const selectedSlideUrlMetrics = await page.evaluate(() => {
            const selectedThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
            const selectedSlideId = selectedThumb?.dataset.slideId || "";
            return {
              selectedSlideId,
              urlSlideId: new URLSearchParams(window.location.search).get("slide") || ""
            };
          });
          assert.ok(selectedSlideUrlMetrics.selectedSlideId, "Studio validation needs an active thumbnail with a slide id");
          assert.equal(selectedSlideUrlMetrics.urlSlideId, selectedSlideUrlMetrics.selectedSlideId, "Selecting a slide should persist it in the URL query");
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForFunction((slideId: string) => {
            const selectedThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
            return selectedThumb?.dataset.slideId === slideId;
          }, selectedSlideUrlMetrics.selectedSlideId, { timeout: 30_000 });
          await validateMastheadPageNavigation(page, viewport);
          const preservedQuerySlideId = await page.evaluate(() => new URLSearchParams(window.location.search).get("slide") || "");
          assert.equal(preservedQuerySlideId, selectedSlideUrlMetrics.selectedSlideId, "Studio page navigation should preserve the selected slide query");

          const metrics = await page.evaluate(() => {
            function rectFor(selector: string) {
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
              appTheme: document.documentElement.dataset.appTheme,
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              llmButton: rectFor("#show-llm-diagnostics"),
              llmStatus: document.querySelector("#llm-nav-status")?.textContent || "",
              llmState: document.querySelector("#llm-nav-status")?.getAttribute("data-state") || "",
              previewFrame: rectFor(".preview-frame"),
              studioWorkbench: rectFor(".studio-inline-workbench"),
              taskStrip: rectFor(".current-slide-task-strip"),
              taskStripSlideOperationCount: document.querySelectorAll(".current-slide-task-strip > .slide-operations-panel").length,
              taskStripVariantPanel: Boolean(document.querySelector(".current-slide-task-strip > #variant-generation-panel")),
              taskStripSummaryLabels: Array.from(document.querySelectorAll(".current-slide-task-strip summary strong"))
                .map((element) => element.textContent?.trim() || ""),
              variantPanel: rectFor("#variant-generation-panel"),
              variantTabsPresent: Boolean(document.querySelector(".studio-tabs, #show-current-slide-tab, #show-variant-generation-tab")),
              workflowStatus: rectFor("#operation-status"),
              workflowStatusInDebug: Boolean(document.querySelector("#debug-drawer #operation-status")),
              workflowStatusInMainPanel: Boolean(document.querySelector("#variant-generation-panel #operation-status")),
              inlineDebugPresent: Boolean(document.querySelector("#variant-generation-panel .workflow-debug-panel")),
              debugDrawerHidden: (document.querySelector("#debug-drawer") as HTMLElement | null)?.hidden,
              debugDrawerOpen: document.querySelector("#debug-drawer")?.getAttribute("data-open"),
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

          const currentSlideLabel = requireRect(metrics.currentSlideLabel, "Studio should expose the current slide label in the Studio workspace");
          if (viewport.width > 1180) {
            assert.ok(
              currentSlideLabel.width <= 2 && currentSlideLabel.height <= 2,
              `Current slide label should be visually hidden without leaving the accessibility tree at ${viewport.width}x${viewport.height}`
            );
          }
          await validateThemeControls(page, viewport, metrics);

          const previewFrame = requireRect(metrics.previewFrame, "Slide Studio should render the active preview frame");
          assert.ok(metrics.workflowStatus, "Slide Studio should keep live workflow status available in diagnostics");
          assert.equal(metrics.workflowStatusInDebug, true, "Live workflow status should live in the Debug drawer");
          assert.equal(metrics.workflowStatusInMainPanel, false, "Live workflow status should not occupy the main variant panel");
          assert.equal(metrics.inlineDebugPresent, false, "Generation diagnostics should live in the Debug drawer instead of the inline variant panel");
          assert.equal(metrics.debugDrawerHidden, false, "Debug drawer should be available on the Studio page");
          assert.equal(metrics.debugDrawerOpen, "false", "Debug drawer should start collapsed by default");
          assert.ok(
            previewFrame.bottom <= metrics.viewportHeight + 1,
            `Active slide preview should fit in the first viewport at ${viewport.width}x${viewport.height} (bottom ${previewFrame.bottom.toFixed(1)}px > viewport ${metrics.viewportHeight}px)`
          );
          const studioWorkbench = requireRect(metrics.studioWorkbench, "Slide Studio should expose a unified current-slide workbench");
          assert.ok(
            studioWorkbench.right <= metrics.viewportWidth + 1,
            `Slide Studio workbench should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.equal(metrics.variantTabsPresent, false, "Slide Studio should remove the Current/Variant tab switcher");
          assert.ok(metrics.variantPanel, "Inline variant controls should be present in the current-slide workbench");
          assert.ok(metrics.taskStrip, "Slide Studio should group current-slide actions into one task strip");
          assert.equal(metrics.taskStripVariantPanel, true, "Current-slide task strip should own the Improve controls");
          assert.equal(metrics.taskStripSlideOperationCount, 1, "Current-slide task strip should own the slide media and asset controls");
          assert.deepEqual(
            metrics.taskStripSummaryLabels,
            ["Improve", "Materials", "Custom visuals"],
            "Current-slide task strip should expose one compact action sequence"
          );
          await validateCurrentSlideWorkbench(page, viewport, metrics);

          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });

          await validateCustomLayoutDrawer(page, viewport);

          const thumbRail = requireRect(metrics.thumbRail, "Slide Studio should render the thumbnail rail");
          assert.ok(
            thumbRail.width <= metrics.viewportWidth + 1,
            `Thumbnail rail should stay within the page viewport at ${viewport.width}x${viewport.height} (${thumbRail.width.toFixed(1)}px > ${metrics.viewportWidth}px)`
          );
          if (viewport.width > 760) {
            assert.ok(
              thumbRail.height <= metrics.viewportHeight,
              `Desktop thumbnail rail should stay within the viewport at ${viewport.width}x${viewport.height} (${thumbRail.height.toFixed(1)}px > ${metrics.viewportHeight}px)`
            );
          } else {
            assert.ok(
              thumbRail.height <= 112,
              `Mobile thumbnail rail should stay compact at ${viewport.width}x${viewport.height} (${thumbRail.height.toFixed(1)}px > 112px)`
            );
          }
          assert.equal(metrics.thumbTextVisible, false, "Thumbnail rail should not expose title or file labels that can clip");

          assert.ok(metrics.checksButton, "Slide Studio should expose deck checks from the masthead");
          await validateAssistantSupport(page, viewport, metrics);
          await validateThumbnailRailSelectionScroll(page, viewport);

          await validatePresentationLibrary(page, viewport);

          await page.click("#show-studio-page");
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          await page.waitForTimeout(120);

          await validateContextAndStructuredDrawers(page, viewport);

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
                height: rect.height,
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
          const checksPanel = requireRect(checksMetrics.panel, "Checks control should open the checks panel");
          assert.ok(
            checksMetrics.documentScrollWidth <= checksMetrics.documentClientWidth + 1,
            `Checks panel should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            checksPanel.left >= -1 && checksPanel.right <= checksMetrics.viewportWidth + 1,
            `Checks panel should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            checksPanel.top >= -1 && checksPanel.bottom <= checksMetrics.viewportHeight + 1,
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
    if (ownsServer) {
      server.close();
    }
  }

  process.stdout.write("Studio layout validation passed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStudioLayoutValidation().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { runStudioLayoutValidation };
