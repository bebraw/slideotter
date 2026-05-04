import assert from "node:assert/strict";
import {
  createdSmokePresentationIdPattern,
  smokePresentation
} from "./smoke-llm.ts";

type Page = import("playwright").Page;

type WorkflowSnippet = {
  text?: string;
};

type CreationDraftResponse = {
  creationDraft: {
    deckPlan: {
      slides: Array<Record<string, unknown>>;
    };
  };
};

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

async function waitForPage(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((targetSelector: string) => {
    const element = document.querySelector(targetSelector);
    return element instanceof HTMLElement && !element.hidden;
  }, selector);
}

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function createSmokePresentationFromBrief(page: Page): Promise<string> {
  await page.locator(".presentation-create-details > summary").click();
  await page.click("[data-creation-stage='brief']");
  await page.fill("#presentation-title", smokePresentation.title);
  await page.fill("#presentation-audience", "Workflow validation");
  await page.fill("#presentation-target-slides", "7");
  await page.fill("#presentation-objective", "Verify presentation management through the browser UI.");
  await page.fill("#presentation-constraints", "Clean up all smoke decks after the run.");
  await page.evaluate(() => {
    ["#presentation-source-urls", "#presentation-outline-source-urls", "#presentation-source-text", "#presentation-outline-source-text"].forEach((selector) => {
      const element = document.querySelector(selector) as HTMLTextAreaElement | null;
      if (element) {
        element.value = "";
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
  await page.fill("#presentation-source-text", "Initial workflow source: first outline generation can use pasted source material from the brief.");
  await page.click("#generate-presentation-outline-button");
  await page.waitForSelector("#presentation-outline-list .creation-outline-item", {
    timeout: 60_000
  });
  await page.waitForFunction(() => {
    return /first outline generation/i.test(document.querySelector("#presentation-source-evidence")?.textContent || "");
  });
  await page.fill("#presentation-outline-source-text", "Workflow validation source: browser UI management should cover presentation creation, source persistence, and grounded generation diagnostics.");
  await page.click("#regenerate-presentation-outline-with-sources-button");
  await page.waitForFunction(() => {
    return /browser UI management/i.test(document.querySelector("#presentation-source-evidence")?.textContent || "");
  });
  await page.click("[data-creation-stage='brief']");
  await page.fill("#presentation-constraints", "Clean up all smoke decks after the run. Regenerate after this changed brief.");
  await page.waitForFunction(() => {
    const status = document.querySelector("#presentation-creation-status")?.textContent || "";
    const approve = document.querySelector("#approve-presentation-outline-button") as HTMLButtonElement | null;
    const create = document.querySelector("#create-presentation-button") as HTMLButtonElement | null;
    return /Brief changed/i.test(status) && approve?.disabled === true && create?.disabled === true;
  });
  await page.click("#generate-presentation-outline-button");
  await page.waitForFunction(() => {
    const approve = document.querySelector("#approve-presentation-outline-button") as HTMLButtonElement | null;
    const status = document.querySelector("#presentation-creation-status")?.textContent || "";
    return approve && approve.disabled === false && /approve it to create slides/i.test(status);
  });
  await page.fill("[data-outline-slide-index='0'][data-outline-slide-field='title']", "Edited workflow opener");
  await page.fill("[data-outline-slide-index='0'][data-outline-slide-field='intent']", "Edited workflow opener validates custom outline wording.");
  await page.fill("[data-outline-slide-index='0'][data-outline-slide-field='sourceNotes']", "Slide-specific source: the opener should cite the workflow smoke source only for this outline beat.");
  await page.waitForFunction(() => {
    const sourceOutline = document.querySelector("#presentation-source-outline")?.textContent || "";
    return /Edited workflow opener/.test(sourceOutline) && /Slide-specific source/.test(sourceOutline);
  });
  await page.click("[data-outline-lock-slide-index='0']");
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const slide = payload.creationDraft && payload.creationDraft.deckPlan && payload.creationDraft.deckPlan.slides
      ? payload.creationDraft.deckPlan.slides[0]
      : null;
    return payload.creationDraft
      && payload.creationDraft.outlineLocks
      && payload.creationDraft.outlineLocks["0"] === true
      && slide
      && slide.title === "Edited workflow opener"
      && slide.intent === "Edited workflow opener validates custom outline wording."
      && typeof slide.sourceNotes === "string"
      && /Slide-specific source/.test(slide.sourceNotes);
  });
  const lockedRegenerateResponse = waitForJsonResponse<CreationDraftResponse>(page, "/api/v1/presentations/draft/outline", 60_000);
  await page.click("#regenerate-presentation-outline-button");
  const lockedRegeneratedPayload = requireValue(
    await lockedRegenerateResponse,
    "locked outline regeneration should return a draft payload"
  );
  const lockedRegeneratedSlide = requireValue(
    lockedRegeneratedPayload.creationDraft.deckPlan.slides[0],
    "locked outline regeneration should include the first slide"
  );
  assert.ok(lockedRegeneratedSlide.title);
  assert.ok(lockedRegeneratedSlide.sourceNotes || lockedRegeneratedSlide.sourceText || lockedRegeneratedSlide.sourceNeed);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.creationDraft
      && payload.creationDraft.outlineLocks
      && payload.creationDraft.outlineLocks["0"] === true;
  });

  await page.fill("[data-outline-slide-index='1'][data-outline-slide-field='title']", "Needs focused regeneration");
  const slideRegenerateResponse = waitForJsonResponse<CreationDraftResponse>(page, "/api/v1/presentations/draft/outline/slide", 60_000);
  await page.click("[data-outline-regenerate-slide-index='1']");
  const slideRegeneratedPayload = requireValue(
    await slideRegenerateResponse,
    "slide outline regeneration should return a draft payload"
  );
  assert.ok(requireValue(slideRegeneratedPayload.creationDraft.deckPlan.slides[0], "slide regeneration should include slide 1").title);
  assert.ok(requireValue(slideRegeneratedPayload.creationDraft.deckPlan.slides[1], "slide regeneration should include slide 2").title);
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.creationDraft
      && payload.creationDraft.outlineLocks
      && payload.creationDraft.outlineLocks["0"] === true;
  });

  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const slide = payload.creationDraft && payload.creationDraft.deckPlan && payload.creationDraft.deckPlan.slides
      ? payload.creationDraft.deckPlan.slides[0]
      : null;
    return payload.creationDraft
      && payload.creationDraft.outlineLocks
      && payload.creationDraft.outlineLocks["0"] === true
      && slide
      && slide.title === "Edited workflow opener"
      && slide.intent === "Edited workflow opener validates custom outline wording."
      && slide.sourceNotes === "Slide-specific source: the opener should cite the workflow smoke source only for this outline beat.";
  }, { timeout: 60_000 });

  const approveOutlineResponse = waitForJsonResponse(page, "/api/v1/presentations/draft/approve", 60_000);
  const createPresentationResponse = waitForJsonResponse(page, "/api/v1/presentations/draft/create", 120_000);
  await page.click("#approve-presentation-outline-button");
  await approveOutlineResponse;
  await createPresentationResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const draft = payload.creationDraft;
    if (!draft) {
      return false;
    }

    if (draft.createdPresentationId) {
      return true;
    }

    const run = draft.contentRun;
    return run && typeof run.completed === "number" && run.completed >= 1;
  }, { timeout: 120_000 });
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const slide = payload.creationDraft && payload.creationDraft.deckPlan && payload.creationDraft.deckPlan.slides
      ? payload.creationDraft.deckPlan.slides[0]
      : null;
    return payload.creationDraft
      && slide
      && slide.title === "Edited workflow opener"
      && slide.intent === "Edited workflow opener validates custom outline wording."
      && slide.sourceNotes === "Slide-specific source: the opener should cite the workflow smoke source only for this outline beat.";
  }, { timeout: 60_000 });
  await waitForPage(page, "#studio-page");
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.creationDraft
      && payload.creationDraft.createdPresentationId
      && Array.isArray(payload.slides)
      && payload.slides.length === 7;
  }, { timeout: 120_000 });
  await page.click("#theme-drawer-toggle");
  await page.waitForSelector("#theme-drawer[data-open='true'] #presentation-theme-preview .dom-slide", {
    timeout: 120_000
  });
  await page.click("#generate-theme-candidates-button");
  const applyThemeResponse = Promise.all([
    waitForJsonResponse(page, "/api/v1/context", 60_000),
    page.click("[data-creation-theme-variant='dark']")
  ]);
  await page.waitForFunction(() => {
    return /--dom-bg:#000000/.test(document.querySelector("#presentation-theme-preview .dom-slide")?.getAttribute("style") || "");
  });
  await applyThemeResponse;
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.context
      && payload.context.deck
      && payload.context.deck.lengthProfile
      && payload.context.deck.lengthProfile.targetCount === 7
      && payload.slides.length === 7
      && payload.sources.length === 1
      && payload.runtime
      && payload.runtime.sourceRetrieval
      && payload.runtime.sourceRetrieval.snippets.some((snippet: WorkflowSnippet) => /browser UI management/i.test(snippet.text || ""));
  });
  const createdPresentationIdAfterCreate = await page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.presentations.activePresentationId;
  });
  assert.match(createdPresentationIdAfterCreate, createdSmokePresentationIdPattern, "staged creation should activate the new presentation");

  return createdPresentationIdAfterCreate;
}

export { createSmokePresentationFromBrief };
