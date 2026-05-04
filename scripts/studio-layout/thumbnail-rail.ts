import assert from "node:assert/strict";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type ScrollAxis = "x" | "y";

type ThumbnailSelectionMetrics = {
  axis: ScrollAxis;
  before: number;
  skipped: boolean;
};

async function validateThumbnailRailSelectionScroll(page: Page, viewport: ViewportSize): Promise<void> {
  const thumbnailSelectionMetrics: ThumbnailSelectionMetrics = await page.evaluate(async () => {
    const rail = document.querySelector("#thumb-rail") as HTMLElement | null;
    const thumbnails = Array.from(document.querySelectorAll("#thumb-rail .thumb")) as HTMLButtonElement[];
    if (!rail || thumbnails.length < 10) {
      return {
        before: 0,
        axis: "x",
        skipped: true
      };
    }

    const targetThumbnail = thumbnails[9];
    if (!targetThumbnail) {
      return {
        before: 0,
        axis: "x",
        skipped: true
      };
    }

    targetThumbnail.scrollIntoView({
      block: "center",
      inline: "center"
    });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const axis = rail.scrollHeight > rail.clientHeight + 2 ? "y" : "x";
    const before = axis === "y" ? rail.scrollTop : rail.scrollLeft;
    targetThumbnail.click();

    return {
      axis,
      before,
      skipped: false
    };
  });

  if (thumbnailSelectionMetrics.skipped) {
    return;
  }

  await page.waitForFunction(() => {
    return /10\//.test(document.querySelector("#selected-slide-label")?.textContent || "");
  });
  await page.waitForTimeout(120);
  const thumbnailAfterSelection = await page.evaluate((axis: ScrollAxis) => {
    const rail = document.querySelector("#thumb-rail") as HTMLElement | null;
    return {
      activeLabel: document.querySelector("#selected-slide-label")?.textContent || "",
      after: rail ? (axis === "y" ? rail.scrollTop : rail.scrollLeft) : 0
    };
  }, thumbnailSelectionMetrics.axis);
  assert.ok(
    thumbnailSelectionMetrics.before > 0,
    `Thumbnail rail should scroll on the ${thumbnailSelectionMetrics.axis}-axis before selection at ${viewport.width}x${viewport.height}`
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

export { validateThumbnailRailSelectionScroll };
