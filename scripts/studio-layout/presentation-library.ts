import assert from "node:assert/strict";
import { requireRect } from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

async function validatePresentationLibrary(page: Page, viewport: ViewportSize): Promise<void> {
  await page.click("#show-presentations-page");
  await page.waitForSelector("#presentation-list .presentation-card", {
    timeout: 30_000
  });
  await page.waitForTimeout(150);

  const presentationMetrics = await page.evaluate(() => {
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
      assistantDrawerHidden: (document.querySelector("#assistant-drawer") as HTMLElement | null)?.hidden,
      assistantDrawerDisplay: window.getComputedStyle(document.querySelector("#assistant-drawer") as HTMLElement).display,
      pageHidden: (document.querySelector("#presentations-page") as HTMLElement | null)?.hidden,
      preview: rectFor(".presentation-card-preview"),
      resultCount: document.querySelector("#presentation-result-count")?.textContent || "",
      search: rectFor("#presentation-search"),
      selectedSlideLabelHidden: (document.querySelector("#selected-slide-label") as HTMLElement | null)?.hidden,
      studioHidden: (document.querySelector("#studio-page") as HTMLElement | null)?.hidden,
      viewportWidth: window.innerWidth
    };
  });

  assert.equal(presentationMetrics.pageHidden, false, "Presentations page should be visible after navigation");
  assert.equal(presentationMetrics.studioHidden, true, "Slide Studio should be hidden while browsing presentations");
  assert.equal(presentationMetrics.selectedSlideLabelHidden, true, "Selected slide title and number should hide outside Slide Studio");
  assert.equal(presentationMetrics.assistantDrawerHidden, true, "Assistant chat should hide while browsing presentations");
  assert.equal(presentationMetrics.assistantDrawerDisplay, "none", "Assistant chat rail should not render on Presentations page");
  assert.ok(presentationMetrics.cardCount > 0, "Presentations page should render at least one presentation card");
  assert.equal(presentationMetrics.activeCardCount, 1, "Presentations page should mark exactly one active presentation");
  assert.ok(presentationMetrics.firstTitle.trim().length > 0, "Presentation cards should show the presentation name");
  assert.ok(presentationMetrics.factCount >= 2, "Presentation cards should show compact metadata facts");
  assert.equal(presentationMetrics.createOpen, false, "Presentation creation constraints should stay collapsed by default");
  await page.evaluate(() => {
    const createDetails = document.querySelector(".presentation-create-details") as HTMLDetailsElement | null;
    const fieldHelp = document.querySelector(".field-help") as HTMLDetailsElement | null;
    if (createDetails) {
      createDetails.open = true;
    }
    if (fieldHelp) {
      fieldHelp.open = true;
    }
  });
  const creationHelpMetrics = await page.evaluate(() => {
    const panel = document.querySelector(".field-help-panel");
    const textarea = document.querySelector("#presentation-constraints");
    const disclosureAction = document.querySelector(".presentation-create-details[open] .disclosure-action");
    const rect = panel ? panel.getBoundingClientRect() : null;
    const textareaRect = textarea ? textarea.getBoundingClientRect() : null;
    function rgbChannels(value: string): [number, number, number, number] | null {
      const match = value.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?/u);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    }
    function linearize(channel: number): number {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }
    function luminance(channels: [number, number, number]): number {
      return (0.2126 * linearize(channels[0])) + (0.7152 * linearize(channels[1])) + (0.0722 * linearize(channels[2]));
    }
    function compositeOverCanvas(channels: [number, number, number, number], canvas: [number, number, number]): [number, number, number] {
      const alpha = Math.max(0, Math.min(1, channels[3]));
      return [
        (channels[0] * alpha) + (canvas[0] * (1 - alpha)),
        (channels[1] * alpha) + (canvas[1] * (1 - alpha)),
        (channels[2] * alpha) + (canvas[2] * (1 - alpha))
      ];
    }
    function contrastRatio(foreground: string, background: string, canvas: string): number {
      const foregroundChannels = rgbChannels(foreground);
      const backgroundChannels = rgbChannels(background);
      const canvasChannels = rgbChannels(canvas);
      if (!foregroundChannels || !backgroundChannels || !canvasChannels) {
        return 0;
      }
      const canvasRgb: [number, number, number] = [canvasChannels[0], canvasChannels[1], canvasChannels[2]];
      const foregroundLum = luminance(compositeOverCanvas(foregroundChannels, canvasRgb));
      const backgroundLum = luminance(compositeOverCanvas(backgroundChannels, canvasRgb));
      const lighter = Math.max(foregroundLum, backgroundLum);
      const darker = Math.min(foregroundLum, backgroundLum);
      return (lighter + 0.05) / (darker + 0.05);
    }
    const disclosureStyle = disclosureAction ? window.getComputedStyle(disclosureAction) : null;
    const canvasStyle = window.getComputedStyle(document.body);
    return {
      disclosureActionContrast: disclosureStyle
        ? contrastRatio(disclosureStyle.color, disclosureStyle.backgroundColor, canvasStyle.backgroundColor)
        : 0,
      helpOpen: Boolean((document.querySelector(".field-help") as HTMLDetailsElement | null)?.open),
      panelPosition: panel ? window.getComputedStyle(panel).position : "",
      panel: rect
        ? {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width
          }
        : null,
      textarea: textareaRect
        ? {
            top: textareaRect.top
          }
        : null,
      text: panel?.textContent || "",
      viewportWidth: window.innerWidth
    };
  });
  assert.equal(creationHelpMetrics.helpOpen, true, "Brief constraints help should open from the compact help affordance");
  assert.ok(
    creationHelpMetrics.disclosureActionContrast >= 4.5,
    `Open presentation form disclosure action should keep readable text contrast (${creationHelpMetrics.disclosureActionContrast.toFixed(2)}:1)`
  );
  assert.match(creationHelpMetrics.text, /Avoid market-size claims/i, "Brief constraints help should show concrete examples");
  const creationHelpPanel = requireRect(creationHelpMetrics.panel, "Brief constraints help should render a popover panel");
  assert.equal(creationHelpMetrics.panelPosition, "absolute", "Brief constraints help should be a popover, not in-flow content");
  assert.ok(
    creationHelpPanel.right <= creationHelpMetrics.viewportWidth + 1,
    `Brief constraints help should stay inside the viewport at ${viewport.width}x${viewport.height}`
  );
  await page.locator(".presentation-create-details > summary").click();
  assert.ok(
    presentationMetrics.documentScrollWidth <= presentationMetrics.documentClientWidth + 1,
    `Presentations page should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
  );
  const presentationCard = requireRect(presentationMetrics.card, "Presentations page should expose a selectable card");
  assert.ok(
    presentationCard.right <= presentationMetrics.viewportWidth + 1,
    `Presentation cards should stay inside the viewport at ${viewport.width}x${viewport.height}`
  );
  const presentationPreview = requireRect(presentationMetrics.preview, "Presentation cards should show a first-slide preview");
  assert.ok(
    presentationPreview.width >= Math.min(260, presentationMetrics.viewportWidth * 0.65),
    `Presentation preview should remain inspectable at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    Math.abs((presentationPreview.width / presentationPreview.height) - (16 / 9)) < 0.08,
    `Presentation preview should preserve a slide-like aspect ratio at ${viewport.width}x${viewport.height}`
  );
  assert.ok(presentationMetrics.cardActions, "Presentation cards should expose select, duplicate, and delete actions");
  assert.ok(presentationMetrics.search, "Presentations page should expose a compact search control");
  assert.ok(
    /presentation/.test(presentationMetrics.resultCount),
    "Presentations page should summarize filtered result count"
  );
  const presentationFacts = requireRect(presentationMetrics.facts, "Presentation cards should expose metadata facts");
  assert.ok(
    presentationFacts.right <= presentationMetrics.viewportWidth + 1,
    `Presentation metadata should stay inside the viewport at ${viewport.width}x${viewport.height}`
  );

  await page.fill("#presentation-search", "__missing_presentation__");
  await page.waitForTimeout(80);
  const filteredMetrics = await page.evaluate(() => ({
    cardCount: document.querySelectorAll(".presentation-card").length,
    emptyText: document.querySelector("#presentation-list .presentation-empty strong")?.textContent || "",
    resultCount: document.querySelector("#presentation-result-count")?.textContent || ""
  }));
  assert.equal(filteredMetrics.cardCount, 0, "Presentation search should filter non-matching cards");
  assert.equal(filteredMetrics.emptyText, "No matching presentations", "Presentation search should explain empty filtered state");
  assert.ok(/^0 of /.test(filteredMetrics.resultCount), "Presentation search should update filtered count");
  await page.fill("#presentation-search", "");
  await page.waitForSelector("#presentation-list .presentation-card", {
    timeout: 30_000
  });
}

export { validatePresentationLibrary };
