import assert from "node:assert/strict";
import { clickDrawerControl, getDrawerShortcut } from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

async function validateCustomLayoutDrawer(page: Page, viewport: ViewportSize): Promise<void> {
  const savedLayoutPlacementMetrics = await page.evaluate(() => ({
    libraryInDrawer: Boolean(document.querySelector("#layout-drawer .layout-library-details")),
    libraryInOperations: Boolean(document.querySelector(".slide-operations-panel .layout-library-details"))
  }));
  assert.equal(savedLayoutPlacementMetrics.libraryInOperations, false, "Saved layouts should not render as a separate slide operation panel");
  assert.equal(savedLayoutPlacementMetrics.libraryInDrawer, true, "Saved layout management should live in the Layout drawer");

  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
  await page.waitForSelector("#custom-layout-live-preview .dom-slide__custom-layout-grid");
  const initialCustomLayoutMetrics = await page.evaluate(() => ({
    activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
    jsonOpen: Boolean((document.querySelector(".custom-layout-json-details") as HTMLDetailsElement | null)?.open),
    layoutDrawerOpen: document.querySelector("#layout-drawer")?.getAttribute("data-open"),
    mapHidden: (document.querySelector("#custom-layout-live-map") as HTMLElement | null)?.hidden,
    slidePreviewHasCustomGrid: Boolean(document.querySelector("#custom-layout-live-preview .dom-slide__custom-layout-grid")),
    slideTabSelected: document.querySelector("#custom-layout-preview-slide-tab")?.getAttribute("aria-selected"),
    validationState: (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || "",
    validationText: document.querySelector("#custom-layout-validation")?.textContent || ""
  }));
  assert.equal(initialCustomLayoutMetrics.layoutDrawerOpen, "true", "Layout drawer should open from the left rail");
  assert.equal(initialCustomLayoutMetrics.activePreviewHasCustomGrid, false, "Opening the layout drawer should preserve the current saved slide");
  assert.equal(initialCustomLayoutMetrics.slidePreviewHasCustomGrid, true, "Custom layout editor should show a current-slide preview by default");
  assert.equal(initialCustomLayoutMetrics.mapHidden, true, "Abstract layout map should stay hidden by default");
  assert.equal(initialCustomLayoutMetrics.jsonOpen, false, "Custom layout JSON should stay behind advanced disclosure by default");
  assert.equal(initialCustomLayoutMetrics.slideTabSelected, "true", "Current-slide custom layout preview tab should be selected by default");
  assert.equal(initialCustomLayoutMetrics.validationState, "draft-unchecked", "Custom layout validation should start in an unchecked draft state");
  assert.match(initialCustomLayoutMetrics.validationText, /Draft unchecked/, "Custom layout validation should name the unchecked state");

  await page.selectOption("#custom-layout-profile", "lead-sidebar");
  await page.waitForFunction(() => {
    const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
    return source.includes("\"sidebar\"");
  });
  const adjustedCustomLayoutMetrics = await page.evaluate(() => ({
    activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
    json: (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "",
    status: document.querySelector("#custom-layout-status")?.textContent || "",
    validationState: (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || ""
  }));
  assert.equal(adjustedCustomLayoutMetrics.activePreviewHasCustomGrid, true, "Changing layout options should keep the active slide in live custom preview");
  assert.match(adjustedCustomLayoutMetrics.json, /"sidebar"/, "Changing layout options should update the generated layout definition");
  assert.equal(adjustedCustomLayoutMetrics.status, "Live preview", "Changing layout options should mark the custom layout as a live preview");
  assert.equal(adjustedCustomLayoutMetrics.validationState, "draft-unchecked", "Changing layout options should mark validation as stale until previewed");

  await page.evaluate(() => {
    const button = document.querySelector("#custom-layout-preview-button") as HTMLButtonElement | null;
    button?.click();
  });
  await page.waitForFunction(() => {
    const state = (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || "";
    return Boolean(state && state !== "draft-unchecked");
  });
  const validatedCustomLayoutMetrics = await page.evaluate(() => ({
    status: document.querySelector("#custom-layout-status")?.textContent || "",
    validationState: (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || "",
    validationText: document.querySelector("#custom-layout-validation")?.textContent || ""
  }));
  assert.equal(validatedCustomLayoutMetrics.status, "Previewable", "Validating a custom layout should create a preview candidate");
  assert.match(
    validatedCustomLayoutMetrics.validationState,
    /^(looks-good|needs-attention|blocked)$/,
    "Validating a custom layout should return current-slide validation state"
  );
  assert.doesNotMatch(validatedCustomLayoutMetrics.validationText, /Draft unchecked/, "Previewed layout should replace the unchecked validation copy");

  await page.selectOption("#custom-layout-profile", "stacked-sequence");
  await page.waitForFunction(() => {
    const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
    return source.includes("\"stacked-sequence\"") || source.includes("\"column\": 7");
  });
  const stackedLayoutMetrics = await page.evaluate(() => {
    const regions = Array.from(document.querySelectorAll("#active-preview .dom-slide__custom-layout-region")) as HTMLElement[];
    return {
      clippedRegions: regions
        .map((region) => ({
          className: region.className,
          clientHeight: region.clientHeight,
          scrollHeight: region.scrollHeight
        }))
        .filter((region) => region.scrollHeight > region.clientHeight + 2),
      panelCount: document.querySelectorAll("#active-preview .dom-slide__custom-layout-region .dom-panel").length
    };
  });
  assert.equal(stackedLayoutMetrics.panelCount, 2, "Stacked sequence should render two readable body panels");
  assert.deepEqual(stackedLayoutMetrics.clippedRegions, [], "Stacked sequence should not clip custom layout regions");

  await page.click("#custom-layout-preview-map-tab");
  await page.waitForFunction(() => {
    const map = document.querySelector("#custom-layout-live-map") as HTMLElement | null;
    return Boolean(map && !map.hidden && map.querySelector(".layout-studio-region"));
  });
  const mapTabMetrics = await page.evaluate(() => ({
    activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
    mapHidden: (document.querySelector("#custom-layout-live-map") as HTMLElement | null)?.hidden,
    mapTabSelected: document.querySelector("#custom-layout-preview-map-tab")?.getAttribute("aria-selected"),
    slideHidden: (document.querySelector("#custom-layout-live-preview") as HTMLElement | null)?.hidden
  }));
  assert.equal(mapTabMetrics.activePreviewHasCustomGrid, true, "Opening the abstract layout map should not stop current-slide live preview");
  assert.equal(mapTabMetrics.mapHidden, false, "Layout map tab should reveal the abstract region map");
  assert.equal(mapTabMetrics.slideHidden, true, "Layout map tab should hide the small current-slide preview");
  assert.equal(mapTabMetrics.mapTabSelected, "true", "Layout map tab should expose selected state");

  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => !document.querySelector("#active-preview .dom-slide__custom-layout-grid"));
  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
  const reopenedLayoutMetrics = await page.evaluate(() => ({
    activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
    status: document.querySelector("#custom-layout-status")?.textContent || ""
  }));
  assert.equal(reopenedLayoutMetrics.activePreviewHasCustomGrid, false, "Reopening layout controls should return to inactive editing mode");
  assert.equal(reopenedLayoutMetrics.status, "Draft", "Reopening layout controls should label the draft as inactive");
  await page.selectOption("#custom-layout-spacing", "loose");
  await page.waitForFunction(() => {
    const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
    return Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid") && source.includes("\"spacing\": \"loose\""));
  });
  const reactivatedLayoutMetrics = await page.evaluate(() => ({
    activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
    loosePanelPadding: window.getComputedStyle(document.querySelector("#active-preview .dom-slide__custom-layout-region--loose .dom-panel") as Element).paddingTop,
    status: document.querySelector("#custom-layout-status")?.textContent || ""
  }));
  assert.equal(reactivatedLayoutMetrics.activePreviewHasCustomGrid, true, "Changing a setting after reopening should reactivate main-slide preview");
  assert.equal(reactivatedLayoutMetrics.loosePanelPadding, "22px", "Changing custom layout spacing should visibly update panel spacing in the live preview");
  assert.equal(reactivatedLayoutMetrics.status, "Live preview", "Changing a setting after reopening should restore live preview status");
  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => !document.querySelector("#active-preview .dom-slide__custom-layout-grid"));

  const coverSlideSelected = await page.evaluate(() => {
    const coverThumb = Array.from(document.querySelectorAll("#thumb-rail .thumb"))
      .find((button) => button.querySelector(".dom-slide--cover")) as HTMLButtonElement | undefined;
    if (!coverThumb) {
      return false;
    }
    coverThumb.click();
    return true;
  });
  assert.equal(coverSlideSelected, true, "Studio validation needs a cover slide for title layout preview checks");
  await page.waitForSelector("#active-preview .dom-slide--cover", {
    timeout: 30_000
  });
  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
  const coverDrawerOpenMetrics = await page.evaluate(() => ({
    activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
    activeSlideLayout: document.querySelector("#active-preview .dom-slide")?.getAttribute("data-slide-layout") || "",
    treatmentValue: (document.querySelector("#custom-layout-treatment") as HTMLSelectElement | null)?.value || ""
  }));
  assert.equal(coverDrawerOpenMetrics.activePreviewHasCustomGrid, false, "Opening layout controls on a cover slide should preserve the saved title layout");
  assert.equal(
    coverDrawerOpenMetrics.treatmentValue,
    coverDrawerOpenMetrics.activeSlideLayout || "standard",
    "Opening layout controls on a cover slide should initialize treatment from the selected title slide"
  );
  const defaultCoverJsonBeforeTreatment = await page.locator("#custom-layout-json").inputValue();
  const initialCoverTreatment = coverDrawerOpenMetrics.treatmentValue || "standard";
  const alternateCoverTreatment = initialCoverTreatment === "identity" ? "proof" : "identity";
  await page.selectOption("#custom-layout-treatment", alternateCoverTreatment);
  await page.waitForFunction((treatment: string) => {
    const slide = document.querySelector("#active-preview .dom-slide");
    return Boolean(
      slide?.classList.contains(`dom-slide--layout-${treatment}`) &&
      slide.getAttribute("data-slide-layout") === treatment &&
      !document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")
    );
  }, alternateCoverTreatment);
  await page.selectOption("#custom-layout-treatment", initialCoverTreatment);
  await page.waitForFunction(({ initialTreatment, alternateTreatment }: { alternateTreatment: string; initialTreatment: string }) => {
    const slide = document.querySelector("#active-preview .dom-slide");
    return Boolean(
      slide?.classList.contains(`dom-slide--layout-${initialTreatment}`) &&
      !slide.classList.contains(`dom-slide--layout-${alternateTreatment}`) &&
      slide.getAttribute("data-slide-layout") === initialTreatment &&
      !document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")
    );
  }, { initialTreatment: initialCoverTreatment, alternateTreatment: alternateCoverTreatment });
  const defaultCoverTreatmentMetrics = await page.evaluate(() => {
    const regions = Array.from(document.querySelectorAll("#active-preview .dom-slide__custom-layout-region")) as HTMLElement[];
    const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";

    return {
      clippedRegions: regions
        .map((region) => ({
          className: region.className,
          clientHeight: region.clientHeight,
          scrollHeight: region.scrollHeight
        }))
        .filter((region) => region.scrollHeight > region.clientHeight + 2),
      hasCoverGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")),
      hasNativeCoverGrid: Boolean(document.querySelector("#active-preview .dom-slide__cover-grid")),
      json: source
    };
  });
  assert.equal(defaultCoverTreatmentMetrics.hasCoverGrid, false, "Treatment-only cover changes should not force the custom layout renderer");
  assert.equal(defaultCoverTreatmentMetrics.hasNativeCoverGrid, true, "Treatment-only cover changes should keep the native title-slide renderer");
  assert.equal(
    defaultCoverTreatmentMetrics.json,
    defaultCoverJsonBeforeTreatment,
    "Default to another cover treatment and back should not rewrite the current layout definition draft"
  );
  assert.deepEqual(
    defaultCoverTreatmentMetrics.clippedRegions,
    [],
    "Default cover treatment should not clip title-slide layout regions after toggling treatment"
  );
  await page.selectOption("#custom-layout-profile", "lead-sidebar");
  await page.waitForFunction(() => Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")));
  const coverJsonBeforeTreatment = await page.locator("#custom-layout-json").inputValue();
  await page.selectOption("#custom-layout-treatment", "proof");
  await page.waitForFunction(() => document.querySelector("#active-preview .dom-slide")?.classList.contains("dom-slide--layout-proof"));
  await page.selectOption("#custom-layout-treatment", "chapter");
  await page.waitForFunction(() => document.querySelector("#active-preview .dom-slide")?.classList.contains("dom-slide--layout-chapter"));
  await page.selectOption("#custom-layout-treatment", "standard");
  await page.waitForFunction(() => {
    const slide = document.querySelector("#active-preview .dom-slide");
    return Boolean(
      slide?.classList.contains("dom-slide--layout-standard") &&
      !slide.classList.contains("dom-slide--layout-chapter") &&
      slide.getAttribute("data-slide-layout") === "standard"
    );
  });
  const coverLayoutMetrics = await page.evaluate(() => {
    const regions = Array.from(document.querySelectorAll("#active-preview .dom-slide__custom-layout-region")) as HTMLElement[];
    const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
    return {
      clippedRegions: regions
        .map((region) => ({
          className: region.className,
          clientHeight: region.clientHeight,
          scrollHeight: region.scrollHeight
        }))
        .filter((region) => region.scrollHeight > region.clientHeight + 2),
      hasCards: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-region--cards .dom-card")),
      hasNote: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-region--note")),
      json: source
    };
  });
  assert.equal(coverLayoutMetrics.json, coverJsonBeforeTreatment, "Changing cover treatment should not discard the current layout definition draft");
  assert.match(coverLayoutMetrics.json, /"cards"/, "Cover layout definitions should include the cards slot");
  assert.match(coverLayoutMetrics.json, /"note"/, "Cover layout definitions should include the note slot");
  assert.equal(coverLayoutMetrics.hasCards, true, "Cover layout preview should render cover cards");
  assert.equal(coverLayoutMetrics.hasNote, true, "Cover layout preview should render the cover note");
  assert.deepEqual(coverLayoutMetrics.clippedRegions, [], "Cover layout preview should not clip custom layout regions");
  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => !document.querySelector("#active-preview .dom-slide__custom-layout-grid"));
}

export { validateCustomLayoutDrawer };
