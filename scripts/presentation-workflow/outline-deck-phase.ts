import assert from "node:assert/strict";

type Page = import("playwright").Page;

type WorkflowSource = {
  title?: string;
};

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function validateOutlineDeckStructurePhase(page: Page): Promise<void> {
  await page.click("#show-studio-page");
  await page.waitForFunction(() => {
    const element = document.querySelector("#studio-page") as HTMLElement | null;
    return element instanceof HTMLElement && !element.hidden;
  });
  await page.click("#outline-drawer-toggle");
  await page.waitForSelector("#outline-drawer[data-open='true']");
  await page.locator(".source-details summary").click();
  await page.fill("#source-title", "Workflow follow-up source");
  await page.fill("#source-text", "Follow-up source material verifies that the Outline drawer can add grounded notes after presentation creation.");
  const addSourceResponse = waitForJsonResponse(page, "/api/v1/sources", 60_000);
  await page.click("#add-source-button");
  await addSourceResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.sources.length === 2
      && payload.sources.some((source: WorkflowSource) => source.title === "Workflow follow-up source");
  });
  await page.waitForSelector("#source-list .source-card");

  await page.click("#outline-mode-length-tab");
  await page.waitForFunction(() => {
    const lengthPanel = document.querySelector("#outline-mode-length") as HTMLElement | null;
    return Boolean(lengthPanel && !lengthPanel.hidden);
  });
  await page.fill("#deck-length-target", "2");
  const lengthPlanResponse = waitForJsonResponse(page, "/api/v1/deck/scale-length/plan", 60_000);
  await page.click("#deck-length-plan-button");
  await lengthPlanResponse;
  await page.waitForSelector("#deck-length-plan-list .variant-card");
  const applyLengthResponse = waitForJsonResponse(page, "/api/v1/deck/scale-length/apply", 120_000);
  await page.click("#deck-length-apply-button");
  await applyLengthResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.length === 2 && payload.skippedSlides.length === 5;
  });
  await page.waitForSelector("#deck-length-restore-list [data-action='restore-all']", {
    timeout: 30_000
  });
  const restoreSkippedResponse = waitForJsonResponse(page, "/api/v1/slides/restore-skipped", 120_000);
  await page.click("#deck-length-restore-list [data-action='restore-all']");
  await restoreSkippedResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.slides.length === 7 && payload.skippedSlides.length === 0;
  });

  await page.click("#outline-mode-changes-tab");
  await page.waitForFunction(() => {
    const changesPanel = document.querySelector("#outline-mode-changes") as HTMLElement | null;
    return Boolean(changesPanel && !changesPanel.hidden);
  });
  const deckPlanResponse = waitForJsonResponse(page, "/api/v1/operations/ideate-deck-structure", 120_000);
  await page.click("#ideate-deck-structure-button");
  await deckPlanResponse;
  await page.waitForSelector("#deck-structure-list .deck-plan-card");
  const applyDeckPlanResponse = waitForJsonResponse(page, "/api/v1/context/deck-structure/apply", 120_000);
  await page.locator("#deck-structure-list .deck-plan-card").first().locator("[data-action='apply']").click();
  await applyDeckPlanResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Boolean(payload.context && payload.context.deck && payload.context.deck.structureLabel);
  });
}

export { validateOutlineDeckStructurePhase };
