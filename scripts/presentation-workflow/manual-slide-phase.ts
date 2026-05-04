import assert from "node:assert/strict";

type Page = import("playwright").Page;

type WorkflowLayout = {
  definition?: {
    arrangement?: string;
    type?: string;
  };
  name?: string;
  supportedTypes?: string[];
};

type WorkspaceSlide = {
  id: string;
  title?: string;
};

type WorkspaceState = {
  slides: WorkspaceSlide[];
};

function requireSlide(slide: WorkspaceSlide | undefined, message: string): WorkspaceSlide {
  if (!slide) {
    throw new Error(message);
  }
  return slide;
}

async function readWorkspaceState(page: Page): Promise<WorkspaceState> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    return response.json();
  });
}

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function deleteManualSlide(page: Page, slide: WorkspaceSlide, title: string): Promise<void> {
  await page.click("#open-manual-delete-button");
  await page.selectOption("#manual-delete-slide", slide.id);
  const deleteSlideResponse = waitForJsonResponse(page, "/api/v1/slides/delete", 120_000);
  await page.click("#delete-slide-button");
  await deleteSlideResponse;
  await page.waitForFunction(async (expectedTitle: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return !payload.slides.some((candidate: WorkspaceSlide) => candidate.title === expectedTitle);
  }, title);
}

async function validateManualSlideLifecyclePhase(page: Page): Promise<void> {
  await page.click("#open-manual-system-button");
  await page.fill("#manual-system-title", "Workflow system boundary");
  await page.fill("#manual-system-summary", "Verify manual slide creation and removal through the browser workflow.");
  await page.selectOption("#manual-system-after", "slide-01");
  const createSystemSlideResponse = waitForJsonResponse(page, "/api/v1/slides/system", 120_000);
  await page.click("#create-system-slide-button");
  await createSystemSlideResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow system boundary");
  });
  const stateAfterInsert = await readWorkspaceState(page);
  const insertedSlide = requireSlide(
    stateAfterInsert.slides.find((slide) => slide.title === "Workflow system boundary"),
    "manual slide creation should add a selectable slide"
  );
  await deleteManualSlide(page, insertedSlide, "Workflow system boundary");

  await page.click("#open-manual-system-button");
  await page.selectOption("#manual-system-type", "divider");
  await page.fill("#manual-system-title", "Workflow section divider");
  await page.selectOption("#manual-system-after", "slide-01");
  const createDividerSlideResponse = waitForJsonResponse(page, "/api/v1/slides/system", 120_000);
  await page.click("#create-system-slide-button");
  await createDividerSlideResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow section divider");
  });
  const stateAfterDividerInsert = await readWorkspaceState(page);
  const insertedDividerSlide = requireSlide(
    stateAfterDividerInsert.slides.find((slide) => slide.title === "Workflow section divider"),
    "manual divider creation should add a selectable slide"
  );
  await page.waitForFunction(async (slideId: string) => {
    const response = await fetch(`/api/v1/slides/${slideId}`);
    const payload = await response.json();
    return payload.slideSpec && payload.slideSpec.type === "divider";
  }, insertedDividerSlide.id);
  await deleteManualSlide(page, insertedDividerSlide, "Workflow section divider");

  await page.click("#open-manual-system-button");
  await page.selectOption("#manual-system-type", "quote");
  await page.fill("#manual-system-title", "Workflow quote slide");
  await page.fill("#manual-system-summary", "A structured quote slide keeps one excerpt dominant.");
  await page.selectOption("#manual-system-after", "slide-01");
  const createQuoteSlideResponse = waitForJsonResponse(page, "/api/v1/slides/system", 120_000);
  await page.click("#create-system-slide-button");
  await createQuoteSlideResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow quote slide");
  });
  const stateAfterQuoteInsert = await readWorkspaceState(page);
  const insertedQuoteSlide = requireSlide(
    stateAfterQuoteInsert.slides.find((slide) => slide.title === "Workflow quote slide"),
    "manual quote creation should add a selectable slide"
  );
  await page.waitForFunction(async (slideId: string) => {
    const response = await fetch(`/api/v1/slides/${slideId}`);
    const payload = await response.json();
    return payload.slideSpec
      && payload.slideSpec.type === "quote"
      && payload.slideSpec.quote === "A structured quote slide keeps one excerpt dominant.";
  }, insertedQuoteSlide.id);
  await deleteManualSlide(page, insertedQuoteSlide, "Workflow quote slide");

  await page.click("#open-manual-system-button");
  await page.selectOption("#manual-system-type", "photo");
  await page.fill("#manual-system-title", "Workflow photo slide");
  await page.fill("#manual-system-summary", "Source: workflow smoke photo");
  await page.selectOption("#manual-system-after", "slide-01");
  const createPhotoSlideResponse = waitForJsonResponse(page, "/api/v1/slides/system", 120_000);
  await page.click("#create-system-slide-button");
  await createPhotoSlideResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow photo slide");
  });
  const stateAfterPhotoInsert = await readWorkspaceState(page);
  const insertedPhotoSlide = requireSlide(
    stateAfterPhotoInsert.slides.find((slide) => slide.title === "Workflow photo slide"),
    "manual photo creation should add a selectable slide"
  );
  await page.waitForFunction(async (slideId: string) => {
    const response = await fetch(`/api/v1/slides/${slideId}`);
    const payload = await response.json();
    return payload.slideSpec
      && payload.slideSpec.type === "photo"
      && payload.slideSpec.media
      && payload.slideSpec.media.alt === "Workflow material";
  }, insertedPhotoSlide.id);
  await deleteManualSlide(page, insertedPhotoSlide, "Workflow photo slide");

  await page.click("#open-manual-system-button");
  await page.selectOption("#manual-system-type", "photoGrid");
  await page.fill("#manual-system-title", "Workflow photo grid slide");
  await page.fill("#manual-system-summary", "Source: workflow smoke photo grid");
  await page.selectOption("#manual-system-after", "slide-01");
  const gridMaterialValues = await page.locator("#manual-system-material option").evaluateAll((options) => options.slice(0, 2).map((option) => (option as HTMLOptionElement).value));
  assert.equal(gridMaterialValues.length, 2, "Workflow should have at least two materials for photo grid creation");
  await page.selectOption("#manual-system-material", gridMaterialValues);
  const createPhotoGridSlideResponse = waitForJsonResponse(page, "/api/v1/slides/system", 120_000);
  await page.click("#create-system-slide-button");
  await createPhotoGridSlideResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow photo grid slide");
  });
  const stateAfterPhotoGridInsert = await readWorkspaceState(page);
  const insertedPhotoGridSlide = requireSlide(
    stateAfterPhotoGridInsert.slides.find((slide) => slide.title === "Workflow photo grid slide"),
    "manual photo-grid creation should add a selectable slide"
  );
  await page.waitForFunction(async (slideId: string) => {
    const response = await fetch(`/api/v1/slides/${slideId}`);
    const payload = await response.json();
    return payload.slideSpec
      && payload.slideSpec.type === "photoGrid"
      && Array.isArray(payload.slideSpec.mediaItems)
      && payload.slideSpec.mediaItems.length >= 2;
  }, insertedPhotoGridSlide.id);
  const photoGridSlideAlreadyActive = await page.evaluate(() => {
    const activeThumb = document.querySelector(".thumb.active");
    return Boolean(activeThumb && /Workflow photo grid slide/.test(activeThumb.textContent || ""));
  });
  if (!photoGridSlideAlreadyActive) {
    await page.locator(".thumb", { hasText: "Workflow photo grid slide" }).click();
  }
  await page.waitForFunction(() => {
    const activeThumb = document.querySelector(".thumb.active");
    return activeThumb && /Workflow photo grid slide/.test(activeThumb.textContent || "");
  });
  await page.evaluate(() => {
    const toggle = document.querySelector("#layout-drawer-toggle") as HTMLButtonElement | null;
    const drawer = document.querySelector("#layout-drawer") as HTMLElement | null;
    if (toggle && drawer?.dataset.open === "true") {
      toggle.click();
    }
  });
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "false");
  await page.click("#redo-layout-button");
  await page.waitForSelector("#variant-list .variant-card:not(.variant-empty-state)", { timeout: 120_000 });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/candidates/save", 60_000),
    page.locator("#variant-list .variant-card", { hasText: "Lead image grid" }).first().locator("button", { hasText: "Save layout" }).click()
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.layouts)
      && payload.layouts.some((layout: WorkflowLayout) => layout.name === "Lead image grid"
        && Array.isArray(layout.supportedTypes)
        && layout.supportedTypes.includes("photoGrid")
        && layout.definition
        && layout.definition.type === "photoGridArrangement"
        && layout.definition.arrangement === "lead-image");
  });
  await page.click("#exit-variant-review-button");
  await page.waitForFunction(() => document.querySelector("#variant-review-workspace")?.classList.contains("is-empty"));
  await page.waitForSelector(".slide-rail-panel", { state: "visible" });
  await deleteManualSlide(page, insertedPhotoGridSlide, "Workflow photo grid slide");
}

export { validateManualSlideLifecyclePhase };
