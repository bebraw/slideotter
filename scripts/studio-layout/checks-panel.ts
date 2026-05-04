import assert from "node:assert/strict";
import { requireRect } from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

async function validateChecksPanel(page: Page, viewport: ViewportSize): Promise<void> {
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
}

export { validateChecksPanel };
