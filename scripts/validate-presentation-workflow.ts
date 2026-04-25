const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright");
const { startServer } = require("../studio/server/index.ts");
const {
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");

const smokeTitle = "Temporary workflow smoke";
const smokeCopyTitle = `${smokeTitle} copy`;
const smokeIds = [
  "temporary-workflow-smoke-copy",
  "temporary-workflow-smoke"
];
const originalFetch = global.fetch;
const llmEnvKeys = [
  "LMSTUDIO_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
const smokeImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC",
  "base64"
);

function createLmStudioStreamResponse(data) {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { content }, finish_reason: null }],
        id: "chatcmpl-workflow-smoke",
        model: "workflow-smoke-model"
      })}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200
  });
}

function roleForSmokeSlide(index, total) {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  return ["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5];
}

function createSmokeDeckPlan(slideCount) {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const label = `Workflow smoke ${index + 1}`;

    return {
      intent: `${label} validates one browser workflow step.`,
      keyMessage: `${label} keeps the smoke deck grounded and distinct.`,
      role: roleForSmokeSlide(index, slideCount),
      sourceNeed: `${label} should use the workflow validation source when useful.`,
      title: label,
      visualNeed: `${label} can use the uploaded workflow material when useful.`
    };
  });

  return {
    audience: "Workflow validation",
    language: "English",
    narrativeArc: "Move from workflow purpose to browser actions and cleanup.",
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: "The browser workflow can create, edit, ground, and clean up a presentation."
  };
}

function createSmokeSlidePlan(slideCount, options: any = {}) {
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const total = Number.isFinite(Number(options.total)) ? Number(options.total) : slideCount;
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const absoluteIndex = startIndex + index;
    const label = `Workflow smoke ${absoluteIndex + 1}`;
    const sourceBody = absoluteIndex === 1
      ? "Workflow validation source confirms browser UI management and grounded generation diagnostics."
      : `${label} verifies a distinct part of the browser workflow.`;

    return {
      eyebrow: absoluteIndex === 0 ? "Opening" : absoluteIndex === total - 1 ? "Close" : `Step ${absoluteIndex + 1}`,
      guardrails: [
        { body: `${label} keeps the smoke check focused.`, title: `${label} focus` },
        { body: `${label} avoids unrelated workflow edits.`, title: `${label} scope` },
        { body: `${label} leaves cleanup visible.`, title: `${label} cleanup` }
      ],
      guardrailsTitle: `${label} checks`,
      keyPoints: [
        { body: sourceBody, title: `${label} source` },
        { body: `${label} confirms slide creation remains functional.`, title: `${label} create` },
        { body: `${label} confirms editing remains functional.`, title: `${label} edit` },
        { body: `${label} confirms cleanup remains functional.`, title: `${label} clean` }
      ],
      mediaMaterialId: "",
      note: `${label} supports workflow smoke validation.`,
      resources: [
        { body: `${label} source note.`, title: `${label} source` },
        { body: `${label} cleanup note.`, title: `${label} cleanup` }
      ],
      resourcesTitle: `${label} resources`,
      role: roleForSmokeSlide(absoluteIndex, total),
      signalsTitle: `${label} points`,
      summary: `${label} checks one complete browser workflow step.`,
      title: label
    };
  });

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: [],
    slides,
    summary: "Workflow smoke generated plan"
  };
}

function installSmokeLlmMock() {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "workflow-smoke-model";

  global.fetch = async (url, init) => {
    const urlText = String(url);
    if (!/\/chat\/completions$/.test(urlText)) {
      return originalFetch(url, init);
    }

    const requestBody = JSON.parse(init.body);
    const schemaName = requestBody.response_format?.json_schema?.name;
    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createSmokeDeckPlan(7));
    }

    if (schemaName === "initial_presentation_plan") {
      const prompt = String(requestBody.messages?.map((message) => message.content).join("\n") || "");
      const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
      if (targetMatch) {
        const slideNumber = Number.parseInt(targetMatch[1], 10);
        const total = Number.parseInt(targetMatch[2], 10);
        return createLmStudioStreamResponse(createSmokeSlidePlan(1, {
          startIndex: slideNumber - 1,
          total
        }));
      }

      return createLmStudioStreamResponse(createSmokeSlidePlan(7));
    }

    return originalFetch(url, init);
  };
}

function restoreSmokeLlmMock() {
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

function cleanupSmokePresentations(activePresentationId) {
  const existingSmokeIds = listPresentations().presentations
    .map((presentation) => presentation.id)
    .filter((id) => smokeIds.includes(id) || /^temporary-workflow-smoke(?:-\d+|-copy.*)?$/.test(id));

  for (const id of existingSmokeIds) {
    try {
      deletePresentation(id);
    } catch (error) {
      // The fixture may not exist if the test failed before creating it.
    }
  }

  if (activePresentationId) {
    try {
      setActivePresentation(activePresentationId);
    } catch (error) {
      // Leave the registry-selected fallback if the original deck disappeared.
    }
  }
}

async function waitForPage(page, selector) {
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return element && !element.hidden;
  }, selector);
}

async function readWorkspaceState(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/state");
    return response.json();
  });
}

async function setSlideSpecEditor(page, slideSpec) {
  await page.evaluate((source) => {
    const editor = document.querySelector("#slide-spec-editor") as HTMLTextAreaElement | null;
    if (!editor) {
      throw new Error("Slide spec editor is not available");
    }

    editor.value = source;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, `${JSON.stringify(slideSpec, null, 2)}\n`);
}

async function waitForActivePreviewText(page, text) {
  await page.waitForFunction((expectedText) => {
    return Boolean(document.querySelector("#active-preview")?.textContent?.includes(expectedText));
  }, text);
}

async function waitForJsonResponse(page, pathPart, timeout = 30_000) {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.equal(response.status(), 200, `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) : null;
}

async function runPresentationWorkflowValidation(options: any = {}) {
  const keepServerOpen = options.keepServerOpen === true;
  const before = listPresentations();
  cleanupSmokePresentations(before.activePresentationId);
  installSmokeLlmMock();
  const server = startServer({ port: 0 });
  let completed = false;

  try {
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;
    assert.ok(port, "presentation workflow validation needs a local server port");

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        colorScheme: "light",
        deviceScaleFactor: 1,
        viewport: { width: 1280, height: 800 }
      });

      try {
        page.on("dialog", (dialog) => dialog.accept());
        await page.addInitScript(() => {
          window.localStorage.removeItem("studio.currentPage");
        });
        await page.goto(`http://127.0.0.1:${port}/#presentations`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#presentation-list .presentation-card", {
          timeout: 30_000
        });

        await page.locator(".presentation-create-details > summary").click();
        await page.click("[data-creation-stage='brief']");
        await page.fill("#presentation-title", smokeTitle);
        await page.fill("#presentation-audience", "Workflow validation");
        await page.fill("#presentation-target-slides", "7");
        await page.fill("#presentation-objective", "Verify presentation management through the browser UI.");
        await page.fill("#presentation-constraints", "Clean up all smoke decks after the run.");
        await page.evaluate(() => {
          ["#presentation-source-text", "#presentation-outline-source-text"].forEach((selector) => {
            const element = document.querySelector(selector) as HTMLTextAreaElement | null;
            if (element) {
              element.value = "";
              element.dispatchEvent(new Event("input", { bubbles: true }));
            }
          });
        });
        await page.click("#generate-presentation-outline-button");
        await page.waitForSelector("#presentation-outline-list .creation-outline-item", {
          timeout: 60_000
        });
        await page.waitForFunction(() => {
          return /No source snippets used/i.test(document.querySelector("#presentation-source-evidence")?.textContent || "");
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
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.creationDraft
            && payload.creationDraft.outlineLocks
            && payload.creationDraft.outlineLocks["0"] === true;
        });
        const lockedRegenerateResponse = waitForJsonResponse(page, "/api/presentations/draft/outline", 60_000);
        await page.click("#regenerate-presentation-outline-button");
        const lockedRegeneratedPayload = await lockedRegenerateResponse;
        assert.ok(lockedRegeneratedPayload.creationDraft.deckPlan.slides[0].title);
        assert.ok(lockedRegeneratedPayload.creationDraft.deckPlan.slides[0].sourceNotes);
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.creationDraft
            && payload.creationDraft.outlineLocks
            && payload.creationDraft.outlineLocks["0"] === true;
        });

        await page.fill("[data-outline-slide-index='1'][data-outline-slide-field='title']", "Needs focused regeneration");
        const slideRegenerateResponse = waitForJsonResponse(page, "/api/presentations/draft/outline/slide", 60_000);
        await page.click("[data-outline-regenerate-slide-index='1']");
        const slideRegeneratedPayload = await slideRegenerateResponse;
        assert.ok(slideRegeneratedPayload.creationDraft.deckPlan.slides[0].title);
        assert.ok(slideRegeneratedPayload.creationDraft.deckPlan.slides[1].title);
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.creationDraft
            && payload.creationDraft.outlineLocks
            && payload.creationDraft.outlineLocks["0"] === true;
        });

        const approveOutlineResponse = waitForJsonResponse(page, "/api/presentations/draft/approve", 60_000);
        const createPresentationResponse = waitForJsonResponse(page, "/api/presentations/draft/create", 120_000);
        await page.click("#approve-presentation-outline-button");
        const approvedPayload = await approveOutlineResponse;
        await createPresentationResponse;
        const approvedDraft = approvedPayload.creationDraft;
        assert.equal(approvedDraft.deckPlan.slides[0].title, "Edited workflow opener");
        assert.equal(approvedDraft.deckPlan.slides[0].intent, "Edited workflow opener validates custom outline wording.");
        assert.equal(approvedDraft.deckPlan.slides[0].sourceNotes, "Slide-specific source: the opener should cite the workflow smoke source only for this outline beat.");
        await waitForPage(page, "#presentations-page");
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.creationDraft
            && payload.creationDraft.stage === "theme"
            && Array.isArray(payload.slides)
            && payload.slides.length === 7;
        }, { timeout: 120_000 });
        await page.waitForSelector("#creation-stage-theme:not([hidden]) #presentation-theme-preview .dom-slide", {
          timeout: 120_000
        });
        await page.click("[data-creation-theme-variant='dark']");
        await page.waitForFunction(() => {
          return /--dom-bg:#000000/.test(document.querySelector("#presentation-theme-preview .dom-slide")?.getAttribute("style") || "");
        });
        const applyThemeResponse = waitForJsonResponse(page, "/api/context", 60_000);
        await page.click("#apply-presentation-theme-button");
        await applyThemeResponse;
        await page.click("#show-studio-page");
        await waitForPage(page, "#studio-page");
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.context
            && payload.context.deck
            && payload.context.deck.lengthProfile
            && payload.context.deck.lengthProfile.targetCount === 7
            && payload.slides.length === 7
            && payload.sources.length === 1
            && payload.runtime
            && payload.runtime.sourceRetrieval
            && payload.runtime.sourceRetrieval.snippets.some((snippet) => /browser UI management/i.test(snippet.text || ""));
        });
        const createdPresentationIdAfterCreate = await page.evaluate(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.presentations.activePresentationId;
        });
        assert.match(createdPresentationIdAfterCreate, /^temporary-workflow-smoke(?:-\d+)?$/, "staged creation should activate the new presentation");
        await page.waitForFunction(() => {
          return document.querySelector("#source-retrieval-list")?.textContent?.includes("browser UI management");
        });
        await page.waitForFunction(() => {
          return /source snippet/.test(document.querySelector("#source-retrieval-summary")?.textContent || "");
        });

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
        const presentationResponse = await presentationPage.goto(`http://127.0.0.1:${port}/present/${createdPresentationIdAfterCreate}#x=1`, {
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
          const rect = activeSlide ? activeSlide.getBoundingClientRect() : null;
          return {
            slideHeight: rect ? rect.height : 0,
            slideWidth: rect ? rect.width : 0,
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
          `presentation slide should use the full available width (${presentationMetrics.slideWidth} vs ${expectedSlideWidth})`
        );
        assert.ok(
          Math.abs(presentationMetrics.slideHeight - expectedSlideHeight) <= 2,
          `presentation slide should use the full available height (${presentationMetrics.slideHeight} vs ${expectedSlideHeight})`
        );
        assert.match(presentationPage.url(), new RegExp(`/present/${createdPresentationIdAfterCreate}#x=1$`));
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

        await page.locator(".material-details summary").click();
        await page.setInputFiles("#material-file", {
          buffer: smokeImage,
          mimeType: "image/png",
          name: "workflow-material.png"
        });
        await page.fill("#material-alt", "Workflow material");
        await page.fill("#material-caption", "Source: workflow smoke");
        await page.click("#upload-material-button");
        await page.waitForSelector("#material-list .material-card");
        await page.locator("#material-list .material-card button").first().click();
        await page.waitForSelector("#active-preview .dom-slide__media img[alt='Workflow material']");

        await page.click("#structured-draft-toggle");
        await page.waitForSelector("#slide-spec-editor");
        const baseSpec = JSON.parse(await page.locator("#slide-spec-editor").inputValue());
        const savedTitle = "Workflow saved JSON title";
        await setSlideSpecEditor(page, {
          ...baseSpec,
          title: savedTitle
        });
        await page.waitForFunction(() => {
          return document.querySelector("#slide-spec-status")?.textContent?.includes("Previewing unsaved JSON edits");
        });
        await waitForActivePreviewText(page, savedTitle);
        const saveSlideSpecResponse = waitForJsonResponse(page, "/api/slides/slide-01/slide-spec", 60_000);
        await page.click("#save-slide-spec-button");
        await saveSlideSpecResponse;
        await page.waitForFunction(async (expectedTitle) => {
          const response = await fetch("/api/slides/slide-01");
          const payload = await response.json();
          return payload.slideSpec && payload.slideSpec.title === expectedTitle;
        }, savedTitle);

        const variantTitle = "Workflow applied variant title";
        await setSlideSpecEditor(page, {
          ...baseSpec,
          title: variantTitle
        });
        await waitForActivePreviewText(page, variantTitle);
        await page.locator(".structured-snapshot-details summary").click();
        await page.fill("#variant-label", "Workflow JSON snapshot");
        const captureVariantResponse = waitForJsonResponse(page, "/api/variants/capture", 60_000);
        await page.click("#capture-variant-button");
        await captureVariantResponse;
        await page.waitForSelector("#variant-list .variant-card:not(.variant-empty-state)");
        await page.waitForSelector("#compare-summary:not([hidden])");
        const applyVariantResponse = waitForJsonResponse(page, "/api/variants/apply", 120_000);
        await page.click("#compare-apply-button");
        await applyVariantResponse;
        await page.waitForFunction(async (expectedTitle) => {
          const response = await fetch("/api/slides/slide-01");
          const payload = await response.json();
          return payload.slideSpec && payload.slideSpec.title === expectedTitle;
        }, variantTitle);
        await page.click("#structured-draft-toggle");

        await page.locator(".manual-system-details summary").click();
        await page.fill("#manual-system-title", "Workflow system boundary");
        await page.fill("#manual-system-summary", "Verify manual slide creation and removal through the browser workflow.");
        await page.selectOption("#manual-system-after", "slide-01");
        const createSystemSlideResponse = waitForJsonResponse(page, "/api/slides/system", 120_000);
        await page.click("#create-system-slide-button");
        await createSystemSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.slides.some((slide) => slide.title === "Workflow system boundary");
        });
        const stateAfterInsert = await readWorkspaceState(page);
        const insertedSlide = stateAfterInsert.slides.find((slide) => slide.title === "Workflow system boundary");
        assert.ok(insertedSlide, "manual slide creation should add a selectable slide");

        await page.locator(".manual-delete-details summary").click();
        await page.selectOption("#manual-delete-slide", insertedSlide.id);
        const deleteSlideResponse = waitForJsonResponse(page, "/api/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deleteSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return !payload.slides.some((slide) => slide.title === "Workflow system boundary");
        });

        await page.selectOption("#manual-system-type", "divider");
        await page.fill("#manual-system-title", "Workflow section divider");
        await page.selectOption("#manual-system-after", "slide-01");
        const createDividerSlideResponse = waitForJsonResponse(page, "/api/slides/system", 120_000);
        await page.click("#create-system-slide-button");
        await createDividerSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.slides.some((slide) => slide.title === "Workflow section divider");
        });
        const stateAfterDividerInsert = await readWorkspaceState(page);
        const insertedDividerSlide = stateAfterDividerInsert.slides.find((slide) => slide.title === "Workflow section divider");
        assert.ok(insertedDividerSlide, "manual divider creation should add a selectable slide");
        await page.waitForFunction(async (slideId) => {
          const response = await fetch(`/api/slides/${slideId}`);
          const payload = await response.json();
          return payload.slideSpec && payload.slideSpec.type === "divider";
        }, insertedDividerSlide.id);

        await page.selectOption("#manual-delete-slide", insertedDividerSlide.id);
        const deleteDividerSlideResponse = waitForJsonResponse(page, "/api/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deleteDividerSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return !payload.slides.some((slide) => slide.title === "Workflow section divider");
        });

        await page.click("#show-planning-page");
        await waitForPage(page, "#planning-page");
        await page.locator(".source-details summary").click();
        await page.fill("#source-title", "Workflow follow-up source");
        await page.fill("#source-text", "Follow-up source material verifies that Deck Planning can add grounded notes after presentation creation.");
        const addSourceResponse = waitForJsonResponse(page, "/api/sources", 60_000);
        await page.click("#add-source-button");
        await addSourceResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.sources.length === 2
            && payload.sources.some((source) => source.title === "Workflow follow-up source");
        });
        await page.waitForSelector("#source-list .source-card");

        await page.fill("#deck-length-target", "2");
        const lengthPlanResponse = waitForJsonResponse(page, "/api/deck/scale-length/plan", 60_000);
        await page.click("#deck-length-plan-button");
        await lengthPlanResponse;
        await page.waitForSelector("#deck-length-plan-list .variant-card");
        const applyLengthResponse = waitForJsonResponse(page, "/api/deck/scale-length/apply", 120_000);
        await page.click("#deck-length-apply-button");
        await applyLengthResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.slides.length === 2 && payload.skippedSlides.length === 5;
        });
        await page.waitForSelector("#deck-length-restore-list [data-action='restore-all']", {
          timeout: 30_000
        });
        const restoreSkippedResponse = waitForJsonResponse(page, "/api/slides/restore-skipped", 120_000);
        await page.click("#deck-length-restore-list [data-action='restore-all']");
        await restoreSkippedResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.slides.length === 7 && payload.skippedSlides.length === 0;
        });

        const deckPlanResponse = waitForJsonResponse(page, "/api/operations/ideate-deck-structure", 120_000);
        await page.click("#ideate-deck-structure-button");
        await deckPlanResponse;
        await page.waitForSelector("#deck-structure-list .deck-plan-card");
        const applyDeckPlanResponse = waitForJsonResponse(page, "/api/context/deck-structure/apply", 120_000);
        await page.locator("#deck-structure-list .deck-plan-card").first().locator("[data-action='apply']").click();
        await applyDeckPlanResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return Boolean(payload.context && payload.context.deck && payload.context.deck.structureLabel);
        });

        await page.click("#show-presentations-page");
        const createdPresentationId = createdPresentationIdAfterCreate;
        const createdCard = page.locator(`.presentation-card[data-presentation-id="${createdPresentationId}"]`);
        await createdCard.waitFor({ timeout: 30_000 });
        const duplicateResponse = waitForJsonResponse(page, "/api/presentations/duplicate", 60_000);
        await createdCard.locator(".presentation-duplicate-button").click();
        await duplicateResponse;
        await waitForPage(page, "#studio-page");

        await page.click("#show-presentations-page");
        const duplicatedPresentationId = await page.evaluate(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return payload.presentations.activePresentationId;
        });
        const duplicatedCard = page.locator(`.presentation-card[data-presentation-id="${duplicatedPresentationId}"]`);
        await duplicatedCard.waitFor({ timeout: 30_000 });
        const deleteDuplicateResponse = waitForJsonResponse(page, "/api/presentations/delete", 60_000);
        await duplicatedCard.locator(".presentation-delete-button").click();
        await deleteDuplicateResponse;
        await page.waitForFunction((presentationId) => {
          return !document.querySelector(`.presentation-card[data-presentation-id="${presentationId}"]`);
        }, duplicatedPresentationId);

        const refreshedCreatedCard = page.locator(`.presentation-card[data-presentation-id="${createdPresentationId}"]`);
        const deleteCreatedResponse = waitForJsonResponse(page, "/api/presentations/delete", 60_000);
        await refreshedCreatedCard.locator(".presentation-delete-button").click();
        await deleteCreatedResponse;
        await page.waitForFunction((presentationId) => {
          return !document.querySelector(`.presentation-card[data-presentation-id="${presentationId}"]`);
        }, createdPresentationId);

        const remainingSmokeCount = await page.locator(".presentation-card", {
          hasText: "Temporary workflow smoke"
        }).count();
        assert.equal(remainingSmokeCount, 0, "temporary workflow decks should be removed through the UI");
      } finally {
        await page.close();
      }
    } finally {
      await browser.close();
    }
    process.stdout.write("Presentation workflow validation passed.\n");
    completed = true;
    return { server };
  } finally {
    if (!keepServerOpen || !completed) {
      server.close();
    }
    restoreSmokeLlmMock();
    cleanupSmokePresentations(before.activePresentationId);
  }

}

if (require.main === module) {
  runPresentationWorkflowValidation().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runPresentationWorkflowValidation
};
