import assert from "node:assert/strict";

type Page = import("playwright").Page;

type WorkflowLayout = {
  definition?: {
    arrangement?: string;
    type?: string;
  };
  name?: string;
  supportedTypes?: string[];
  treatment?: string;
};

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function validateLayoutLibraryAndFavoritesPhase(page: Page): Promise<void> {
  await page.click("#layout-drawer-toggle");
  await page.waitForFunction(() => {
    return document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true";
  });
  await page.locator("#layout-drawer .layout-library-details > summary").click();
  await page.fill("#layout-save-name", "Workflow saved layout");
  const saveLayoutResponse = waitForJsonResponse(page, "/api/v1/layouts/save", 60_000);
  await page.click("#save-layout-button");
  await saveLayoutResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.layouts)
      && payload.layouts.some((layout: WorkflowLayout) => layout.name === "Workflow saved layout" && layout.treatment === "standard");
  });
  const savedLayoutOption = await page.locator("#layout-library-select option", { hasText: "Workflow saved layout" }).first().getAttribute("value");
  await page.selectOption("#layout-library-select", savedLayoutOption);
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/export", 60_000),
    page.click("#copy-layout-json-button")
  ]);
  await page.waitForFunction(() => {
    const value = (document.querySelector("#layout-exchange-json") as HTMLTextAreaElement).value;
    const importButton = document.querySelector("#import-layout-deck-button") as HTMLButtonElement | null;
    return value.includes("\"kind\": \"slideotter.layout\"")
      && value.includes("\"name\": \"Workflow saved layout\"")
      && importButton
      && !importButton.disabled;
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/import", 60_000),
    page.click("#import-layout-deck-button")
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.layouts)
      && payload.layouts.filter((layout: WorkflowLayout) => layout.name === "Workflow saved layout").length >= 2;
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/export", 60_000),
    page.click("#copy-deck-layout-pack-button")
  ]);
  await page.waitForFunction(() => {
    const value = (document.querySelector("#layout-exchange-json") as HTMLTextAreaElement).value;
    const importButton = document.querySelector("#import-layout-deck-button") as HTMLButtonElement | null;
    return value.includes("\"kind\": \"slideotter.layoutPack\"")
      && value.includes("\"layouts\"")
      && value.includes("\"name\": \"Workflow saved layout\"")
      && importButton
      && !importButton.disabled;
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/import", 60_000),
    page.click("#import-layout-deck-button")
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.layouts)
      && payload.layouts.filter((layout: WorkflowLayout) => layout.name === "Workflow saved layout").length >= 4;
  });
  await page.selectOption("#layout-library-select", savedLayoutOption);
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/favorites/save", 60_000),
    page.click("#favorite-layout-button")
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.favoriteLayouts)
      && payload.favoriteLayouts.some((layout: WorkflowLayout) => layout.name === "Workflow saved layout" && layout.treatment === "standard");
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/import", 60_000),
    page.click("#import-layout-favorite-button")
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.favoriteLayouts)
      && payload.favoriteLayouts.filter((layout: WorkflowLayout) => layout.name === "Workflow saved layout").length >= 2;
  });
  await page.selectOption("#layout-library-select", await page.locator("#layout-library-select option", { hasText: "Favorite: Workflow saved layout" }).first().getAttribute("value"));
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/apply", 60_000),
    page.click("#apply-layout-button")
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/slides/slide-01");
    const payload = await response.json();
    return payload.slideSpec && payload.slideSpec.layout === "standard";
  });
  await page.click("#layout-drawer-toggle");
  await page.waitForFunction(() => {
    return document.querySelector("#layout-drawer")?.getAttribute("data-open") === "false";
  });
  await page.click("#redo-layout-button");
  await page.waitForSelector("#variant-list .variant-card:not(.variant-empty-state)", { timeout: 120_000 });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/candidates/save", 60_000),
    page.locator("#variant-list .variant-card", { has: page.locator("button", { hasText: "Save layout" }) }).first().locator("button", { hasText: "Save layout" }).click()
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.layouts) && payload.layouts.length >= 2;
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/candidates/save", 60_000),
    page.locator("#variant-list .variant-card", { has: page.locator("button", { hasText: "Save favorite" }) }).first().locator("button", { hasText: "Save favorite" }).click()
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.favoriteLayouts) && payload.favoriteLayouts.length >= 3;
  });
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll("#variant-list .variant-card"))
      .some((card) => /Use favorite layout: Workflow saved layout/.test(card.textContent || ""));
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/slides/slide-01/slide-spec", 120_000),
    page.locator("#variant-list .variant-card", { hasText: "Use favorite layout: Workflow saved layout" }).first().locator("button", { hasText: "Apply variant" }).click()
  ]);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/slides/slide-01");
    const payload = await response.json();
    return payload.slideSpec && payload.slideSpec.layout === "standard";
  });
  await page.click("#layout-drawer-toggle");
  await page.waitForFunction(() => {
    return document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true";
  });
  await Promise.all([
    waitForJsonResponse(page, "/api/v1/layouts/favorites/delete", 60_000),
    page.click("#delete-favorite-layout-button")
  ]);
  for (let cleanupIndex = 0; cleanupIndex < 6; cleanupIndex += 1) {
    const remainingFavoriteOption = await page.locator("#layout-library-select option", { hasText: "Favorite: Workflow saved layout" }).first();
    if (!(await remainingFavoriteOption.count())) {
      break;
    }
    await page.selectOption("#layout-library-select", await remainingFavoriteOption.getAttribute("value"));
    await Promise.all([
      waitForJsonResponse(page, "/api/v1/layouts/favorites/delete", 60_000),
      page.click("#delete-favorite-layout-button")
    ]);
  }
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return !Array.isArray(payload.favoriteLayouts)
      || !payload.favoriteLayouts.some((layout: WorkflowLayout) => layout.name === "Workflow saved layout");
  });
}

export { validateLayoutLibraryAndFavoritesPhase };
