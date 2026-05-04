import assert from "node:assert/strict";
import { smokePresentation } from "./smoke-llm.ts";

type Page = import("playwright").Page;

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function validatePresentationLibraryCleanupPhase(page: Page, createdPresentationId: string): Promise<void> {
  await page.click("#show-presentations-page");
  const createdCard = page.locator(`.presentation-card[data-presentation-id="${createdPresentationId}"]`);
  await createdCard.waitFor({ timeout: 30_000 });
  const duplicateResponse = waitForJsonResponse(page, "/api/v1/presentations/duplicate", 60_000);
  await createdCard.locator(".presentation-duplicate-button").click();
  await duplicateResponse;
  await page.waitForFunction(() => {
    const element = document.querySelector("#studio-page") as HTMLElement | null;
    return element instanceof HTMLElement && !element.hidden;
  });

  await page.click("#show-presentations-page");
  const duplicatedPresentationId = await page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.presentations.activePresentationId;
  });
  const duplicatedCard = page.locator(`.presentation-card[data-presentation-id="${duplicatedPresentationId}"]`);
  await duplicatedCard.waitFor({ timeout: 30_000 });
  const deleteDuplicateResponse = waitForJsonResponse(page, "/api/v1/presentations/delete", 60_000);
  await duplicatedCard.locator(".presentation-delete-button").click();
  await deleteDuplicateResponse;
  await page.waitForFunction((presentationId) => {
    return !document.querySelector(`.presentation-card[data-presentation-id="${presentationId}"]`);
  }, duplicatedPresentationId);

  const refreshedCreatedCard = page.locator(`.presentation-card[data-presentation-id="${createdPresentationId}"]`);
  const deleteCreatedResponse = waitForJsonResponse(page, "/api/v1/presentations/delete", 60_000);
  await refreshedCreatedCard.locator(".presentation-delete-button").click();
  await deleteCreatedResponse;
  await page.waitForFunction((presentationId) => {
    return !document.querySelector(`.presentation-card[data-presentation-id="${presentationId}"]`);
  }, createdPresentationId);

  const remainingSmokeCount = await page.locator(".presentation-card", {
    hasText: smokePresentation.title
  }).count();
  assert.equal(remainingSmokeCount, 0, "temporary workflow decks should be removed through the UI");
}

export { validatePresentationLibraryCleanupPhase };
