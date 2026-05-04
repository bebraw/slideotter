import assert from "node:assert/strict";

type Browser = import("playwright").Browser;
type Page = import("playwright").Page;

async function validatePresentationModePhase(
  browser: Browser,
  page: Page,
  port: number,
  presentationId: string
): Promise<void> {
  assert.equal(
    await page.locator("#open-presentation-mode-button").isDisabled(),
    false,
    "presentation mode button should be enabled for the active deck"
  );
  const presentationPage = await browser.newPage({
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 800 }
  });
  presentationPage.on("pageerror", (error) => {
    console.error("Presentation page error:", error.message);
  });
  presentationPage.on("console", (message) => {
    if (message.type() === "error") {
      console.error("Presentation console error:", message.text());
    }
  });
  const presentationResponse = await presentationPage.goto(`http://127.0.0.1:${port}/present/${presentationId}#x=1`, {
    waitUntil: "domcontentloaded"
  });
  assert.equal(presentationResponse && presentationResponse.status(), 200, "presentation route should respond successfully");
  await presentationPage.waitForFunction(() => {
    const activeSlide = document.querySelector(".dom-presentation-document__slides .dom-slide.is-active") as HTMLElement | null;
    if (!activeSlide || document.body.dataset.presentationIndex !== "1") {
      return false;
    }

    const rect = activeSlide.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && getComputedStyle(activeSlide).display !== "none";
  }, {
    timeout: 30_000
  });
  const presentationMetrics = await presentationPage.evaluate(() => {
    const activeSlide = document.querySelector(".dom-presentation-document__slides .dom-slide.is-active") as HTMLElement | null;
    const stage = document.querySelector(".dom-presentation-document__slides") as HTMLElement | null;
    const rect = activeSlide ? activeSlide.getBoundingClientRect() : null;
    const stageRect = stage ? stage.getBoundingClientRect() : null;
    const activeStyle = activeSlide ? window.getComputedStyle(activeSlide) : null;
    const stageStyle = stage ? window.getComputedStyle(stage) : null;
    return {
      slideDisplay: activeStyle ? activeStyle.display : "",
      slideHeight: rect ? rect.height : 0,
      slideTransform: activeStyle ? activeStyle.transform : "",
      slideWidth: rect ? rect.width : 0,
      stageHeight: stageRect ? stageRect.height : 0,
      stageInlineHeight: stage ? stage.style.height : "",
      stageInlineWidth: stage ? stage.style.width : "",
      stageTransform: stageStyle ? stageStyle.transform : "",
      stageWidth: stageRect ? stageRect.width : 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });
  const expectedSlideWidth = Math.min(
    presentationMetrics.viewportWidth,
    presentationMetrics.viewportHeight * (16 / 9)
  );
  const expectedSlideHeight = Math.min(
    presentationMetrics.viewportHeight,
    presentationMetrics.viewportWidth * (9 / 16)
  );
  assert.ok(
    Math.abs(presentationMetrics.slideWidth - expectedSlideWidth) <= 2,
    [
      `presentation slide should use the full available width (${presentationMetrics.slideWidth} vs ${expectedSlideWidth})`,
      `viewport=${presentationMetrics.viewportWidth}x${presentationMetrics.viewportHeight}`,
      `stage=${presentationMetrics.stageWidth}x${presentationMetrics.stageHeight}`,
      `stageInline=${presentationMetrics.stageInlineWidth || "unset"}x${presentationMetrics.stageInlineHeight || "unset"}`,
      `slide=${presentationMetrics.slideWidth}x${presentationMetrics.slideHeight}`,
      `slideDisplay=${presentationMetrics.slideDisplay || "unset"}`,
      `slideTransform=${presentationMetrics.slideTransform || "unset"}`,
      `stageTransform=${presentationMetrics.stageTransform || "unset"}`
    ].join("; ")
  );
  assert.ok(
    Math.abs(presentationMetrics.slideHeight - expectedSlideHeight) <= 2,
    [
      `presentation slide should use the full available height (${presentationMetrics.slideHeight} vs ${expectedSlideHeight})`,
      `viewport=${presentationMetrics.viewportWidth}x${presentationMetrics.viewportHeight}`,
      `stage=${presentationMetrics.stageWidth}x${presentationMetrics.stageHeight}`,
      `stageInline=${presentationMetrics.stageInlineWidth || "unset"}x${presentationMetrics.stageInlineHeight || "unset"}`,
      `slide=${presentationMetrics.slideWidth}x${presentationMetrics.slideHeight}`,
      `slideDisplay=${presentationMetrics.slideDisplay || "unset"}`,
      `slideTransform=${presentationMetrics.slideTransform || "unset"}`,
      `stageTransform=${presentationMetrics.stageTransform || "unset"}`
    ].join("; ")
  );
  assert.match(presentationPage.url(), new RegExp(`/present/${presentationId}#x=1$`));
  await presentationPage.keyboard.press("ArrowRight");
  await presentationPage.waitForFunction(() => window.location.hash === "#x=2");
  await presentationPage.waitForFunction(() => {
    return document.body.dataset.presentationIndex === "2";
  });
  await presentationPage.keyboard.press("ArrowLeft");
  await presentationPage.waitForFunction(() => window.location.hash === "#x=1");
  await presentationPage.keyboard.press("Escape");
  await presentationPage.waitForURL(new RegExp(`http://127\\.0\\.0\\.1:${port}/#studio$`));
  await presentationPage.close();
  await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
    timeout: 30_000
  });
}

export { validatePresentationModePhase };
