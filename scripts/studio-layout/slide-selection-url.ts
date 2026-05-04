import assert from "node:assert/strict";
import { validateMastheadPageNavigation } from "./masthead-navigation.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

async function validateStudioSlideSelectionUrlPersistence(page: Page, viewport: ViewportSize): Promise<void> {
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
}

export { validateStudioSlideSelectionUrlPersistence };
