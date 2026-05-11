import assert from "node:assert/strict";
import {
  createdSmokePresentationIdPattern,
  smokePresentation
} from "./smoke-llm.ts";

type Page = import("playwright").Page;

type WorkflowSnippet = {
  text?: string;
};

const starterImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC",
  "base64"
);

type CreationDraftResponse = {
  creationDraft: {
    deckPlan: {
      slides: Array<Record<string, unknown>>;
    };
    fields: {
      presentationDensity?: string;
      targetSlideCount?: number;
    };
  };
};

type CreationCreateResponse = {
  creationDraft?: {
    createdPresentationId?: string | null;
  };
  presentation?: {
    id?: string | null;
  };
};

type BuildResponse = {
  previews?: {
    pages?: unknown[];
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

async function openPresentationCreationDetails(page: Page): Promise<void> {
  await page.evaluate(() => {
    const details = document.querySelector(".presentation-create-details") as HTMLDetailsElement | null;
    if (details) {
      details.open = true;
    }
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

async function createSmokePresentationFromBrief(page: Page): Promise<string> {
  await page.locator(".presentation-create-details > summary").click();
  await page.click("[data-creation-stage='brief']");
  await page.fill("#presentation-title", smokePresentation.title);
  await page.fill("#presentation-audience", "Workflow validation");
  await page.fill("#presentation-target-slides", "7");
  await page.selectOption("#presentation-density", "dense");
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
  await page.fill("#presentation-source-urls", "https://example.com/workflow-brief-source");
  await page.waitForFunction(() => {
    const briefUrls = document.querySelector("#presentation-source-urls") as HTMLTextAreaElement | null;
    const outlineUrls = document.querySelector("#presentation-outline-source-urls") as HTMLTextAreaElement | null;
    return outlineUrls?.value === briefUrls?.value && /workflow-brief-source/.test(outlineUrls?.value || "");
  });
  await page.fill("#presentation-source-urls", "");
  await page.fill("#presentation-source-text", "Initial workflow source: first outline generation can use pasted source material from the brief.");
  await page.waitForFunction(() => {
    const briefText = document.querySelector("#presentation-source-text") as HTMLTextAreaElement | null;
    const outlineText = document.querySelector("#presentation-outline-source-text") as HTMLTextAreaElement | null;
    return outlineText?.value === briefText?.value && /first outline generation/.test(outlineText?.value || "");
  });
  await page.click("#generate-presentation-outline-button");
  await page.waitForSelector("#presentation-outline-list .creation-outline-item", {
    timeout: 60_000
  });
  await page.waitForFunction(() => {
    return /first outline generation/i.test(document.querySelector("#presentation-source-evidence")?.textContent || "");
  });
  await page.fill("#presentation-outline-source-urls", "https://example.com/workflow-outline-source");
  await page.waitForFunction(() => {
    const briefUrls = document.querySelector("#presentation-source-urls") as HTMLTextAreaElement | null;
    const outlineUrls = document.querySelector("#presentation-outline-source-urls") as HTMLTextAreaElement | null;
    return briefUrls?.value === outlineUrls?.value && /workflow-outline-source/.test(briefUrls?.value || "");
  });
  await page.fill("#presentation-outline-source-urls", "");
  await page.fill("#presentation-outline-source-text", "Workflow validation source: browser UI management should cover presentation creation, source persistence, and grounded generation diagnostics.");
  await page.setInputFiles("#presentation-material-file", {
    buffer: starterImage,
    mimeType: "image/png",
    name: "workflow-starter-material.png"
  });
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
  const changedBriefOutlineResponse = waitForJsonResponse<CreationDraftResponse>(page, "/api/v1/presentations/draft/outline", 60_000);
  await page.click("#generate-presentation-outline-button");
  const changedBriefOutlinePayload = requireValue(
    await changedBriefOutlineResponse,
    "changed brief outline generation should return a draft payload"
  );
  assert.equal(changedBriefOutlinePayload.creationDraft.fields.targetSlideCount, 7);
  assert.equal(changedBriefOutlinePayload.creationDraft.fields.presentationDensity, "dense");
  assert.equal(changedBriefOutlinePayload.creationDraft.deckPlan.slides.length, 7);
  await page.waitForFunction(() => {
    const approve = document.querySelector("#approve-presentation-outline-button") as HTMLButtonElement | null;
    const status = document.querySelector("#presentation-creation-status")?.textContent || "";
    return approve && approve.disabled === false && /approve it to create slides/i.test(status);
  }, undefined, { timeout: 60_000 });
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click("#show-presentations-page");
  await waitForPage(page, "#presentations-page");
  await openPresentationCreationDetails(page);
  await page.waitForFunction(() => {
    const outlineItems = document.querySelectorAll("#presentation-outline-list .creation-outline-item").length;
    const lockButton = document.querySelector("[data-outline-lock-slide-index='0']");
    const titleInput = document.querySelector("[data-outline-slide-index='0'][data-outline-slide-field='title']") as HTMLTextAreaElement | null;
    const approve = document.querySelector("#approve-presentation-outline-button") as HTMLButtonElement | null;
    const activeStage = document.querySelector("[data-creation-stage='structure'].active");
    const status = document.querySelector("#presentation-creation-status")?.textContent || "";
    return outlineItems === 7
      && lockButton?.getAttribute("aria-pressed") === "true"
      && titleInput?.value === "Edited workflow opener"
      && approve?.disabled === false
      && activeStage
      && /approve it to create slides/i.test(status);
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
  const createPresentationResponse = waitForJsonResponse<CreationCreateResponse>(page, "/api/v1/presentations/draft/create", 120_000);
  await page.click("#approve-presentation-outline-button");
  await approveOutlineResponse;
  const createPresentationPayload = requireValue(
    await createPresentationResponse,
    "presentation creation should return a payload"
  );
  const createdPresentationId = requireValue(
    createPresentationPayload.creationDraft?.createdPresentationId || createPresentationPayload.presentation?.id,
    "presentation creation should return the created presentation id"
  );
  assert.match(createdPresentationId, createdSmokePresentationIdPattern, "staged creation should activate a smoke presentation");
  await page.waitForFunction(async (presentationId: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const draft = payload.creationDraft;
    const run = draft?.createdPresentationId === presentationId ? draft.contentRun : null;
    const liveDraft = run
      && run.status === "running"
      && typeof run.completed === "number"
      && run.completed >= 1;
    const completedDeck = payload.presentations?.activePresentationId === presentationId
      && Array.isArray(payload.slides)
      && payload.slides.length === 7
      && payload.runtime?.workflow?.operation === "create-presentation-from-outline"
      && payload.runtime.workflow.status === "completed";
    return Boolean(liveDraft || completedDeck);
  }, createdPresentationId, { timeout: 120_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click("#show-presentations-page");
  await waitForPage(page, "#presentations-page");
  await openPresentationCreationDetails(page);
  await page.waitForFunction(async (presentationId: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const draft = payload.creationDraft;
    const liveDraft = draft
      && draft.createdPresentationId === presentationId
      && draft.contentRun
      && typeof draft.contentRun.slideCount === "number"
      && draft.contentRun.slideCount === 7;
    const completedDeck = payload.presentations
      && payload.presentations.activePresentationId === presentationId
      && Array.isArray(payload.slides)
      && payload.slides.length === 7;
    return Boolean(liveDraft || completedDeck);
  }, createdPresentationId, { timeout: 120_000 });
  const hasLiveCreationDraft = await page.evaluate(async (presentationId: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Boolean(
      payload.creationDraft
      && payload.creationDraft.createdPresentationId === presentationId
      && payload.creationDraft.contentRun
      && typeof payload.creationDraft.contentRun.slideCount === "number"
      && payload.creationDraft.contentRun.slideCount === 7
    );
  }, createdPresentationId);
  if (hasLiveCreationDraft) {
    await page.waitForFunction(() => {
      const contentStage = document.querySelector("#creation-stage-content") as HTMLElement | null;
      const summary = document.querySelector("#content-run-summary")?.textContent || "";
      return contentStage
        && !contentStage.hidden
        && !/No slides generated yet/i.test(summary);
    });
  }
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const slide = payload.creationDraft && payload.creationDraft.deckPlan && payload.creationDraft.deckPlan.slides
      ? payload.creationDraft.deckPlan.slides[0]
      : null;
    const draftOutlineMatches = payload.creationDraft
      && slide
      && slide.title === "Edited workflow opener"
      && slide.intent === "Edited workflow opener validates custom outline wording."
      && slide.sourceNotes === "Slide-specific source: the opener should cite the workflow smoke source only for this outline beat.";
    const activeOutlinePlan = Array.isArray(payload.outlinePlans)
      ? payload.outlinePlans.find((plan: { id?: string }) => plan.id === payload.activeOutlinePlanId)
      : null;
    const activeOutlineSlide = activeOutlinePlan
      && Array.isArray(activeOutlinePlan.sections)
      && activeOutlinePlan.sections[0]
      && Array.isArray(activeOutlinePlan.sections[0].slides)
      ? activeOutlinePlan.sections[0].slides[0]
      : null;
    const persistedOutlineMatches = activeOutlineSlide
      && activeOutlineSlide.workingTitle === "Edited workflow opener"
      && activeOutlineSlide.intent === "Edited workflow opener validates custom outline wording.";
    return Boolean(draftOutlineMatches || persistedOutlineMatches);
  }, { timeout: 60_000 });
  await page.click("#show-studio-page");
  await waitForPage(page, "#studio-page");
  await page.waitForFunction(async (presentationId: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.presentations
      && payload.presentations.activePresentationId === presentationId
      && Array.isArray(payload.slides)
      && payload.slides.length === 7;
  }, createdPresentationId, { timeout: 120_000 });
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const snippets = payload.runtime && payload.runtime.sourceRetrieval && payload.runtime.sourceRetrieval.snippets;
    return Array.isArray(snippets) && snippets.some((snippet: WorkflowSnippet) => /browser UI management/i.test(snippet.text || ""));
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
      && Array.isArray(payload.materials)
      && payload.materials.some((material: { title?: string }) => material.title === "workflow-starter-material.png")
      && payload.outlinePlans.some((plan: { id?: string; presentationDensity?: string; sections?: Array<{ slides?: unknown[] }>; targetSlideCount?: number }) => plan.id === payload.activeOutlinePlanId
        && plan.presentationDensity === "dense"
        && plan.targetSlideCount === 7
        && plan.sections?.some((section) => Array.isArray(section.slides) && section.slides.length === 7))
      && payload.runtime
      && payload.runtime.sourceRetrieval
      && payload.runtime.sourceRetrieval.snippets.some((snippet: WorkflowSnippet) => /browser UI management/i.test(snippet.text || ""));
  });
  const createdPresentationIdAfterCreate = await page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.presentations.activePresentationId;
  });
  assert.equal(createdPresentationIdAfterCreate, createdPresentationId, "staged creation should keep the new presentation active");
  await page.waitForFunction(async (presentationId: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    const run = payload.creationDraft?.createdPresentationId === presentationId
      ? payload.creationDraft.contentRun
      : null;
    const workflowComplete = payload.runtime?.workflow?.operation === "create-presentation-from-outline"
      && payload.runtime.workflow.status === "completed";
    const runComplete = (!run || run.status !== "running") && workflowComplete;
    return payload.presentations?.activePresentationId === presentationId
      && Array.isArray(payload.slides)
      && payload.slides.length === 7
      && runComplete;
  }, createdPresentationId, { timeout: 120_000 });
  const buildResponse = await page.evaluate(async () => {
    const response = await fetch("/api/v1/build", {
      method: "POST"
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(responseText);
    }
    return responseText ? JSON.parse(responseText) as BuildResponse : {};
  });
  assert.equal(buildResponse.previews?.pages?.length, 7, "created smoke deck should have rendered preview pages");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click("#show-studio-page");
  await waitForPage(page, "#studio-page");
  await page.waitForFunction(async (presentationId: string) => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return payload.presentations?.activePresentationId === presentationId
      && Array.isArray(payload.slides)
      && payload.slides.length === 7;
  }, createdPresentationId);
  if (await page.locator("#theme-drawer[data-open='true']").count() === 0) {
    await page.click("#theme-drawer-toggle");
    await page.waitForSelector("#theme-drawer[data-open='true']");
  }

  return createdPresentationIdAfterCreate;
}

export { createSmokePresentationFromBrief };
