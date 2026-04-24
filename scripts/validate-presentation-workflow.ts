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
const smokeImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC",
  "base64"
);

function cleanupSmokePresentations(activePresentationId) {
  for (const id of smokeIds) {
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

async function main() {
  const before = listPresentations();
  cleanupSmokePresentations(before.activePresentationId);
  const server = startServer({ port: 0 });

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

        await page.locator(".presentation-create-details summary").click();
        await page.fill("#presentation-title", smokeTitle);
        await page.fill("#presentation-audience", "Workflow validation");
        await page.fill("#presentation-objective", "Verify presentation management through the browser UI.");
        await page.fill("#presentation-constraints", "Clean up all smoke decks after the run.");
        await page.click("#create-presentation-button");
        await waitForPage(page, "#studio-page");
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
        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/slides/slide-01/slide-spec") && response.status() === 200),
          page.click("#save-slide-spec-button")
        ]);
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
        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/variants/capture") && response.status() === 200),
          page.click("#capture-variant-button")
        ]);
        await page.waitForSelector("#variant-list .variant-card:not(.variant-empty-state)");
        await page.waitForSelector("#compare-summary:not([hidden])");
        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/variants/apply") && response.status() === 200),
          page.click("#compare-apply-button")
        ]);
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
        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/slides/system") && response.status() === 200),
          page.click("#create-system-slide-button")
        ]);
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
        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/slides/delete") && response.status() === 200),
          page.click("#delete-slide-button")
        ]);
        await page.waitForFunction(async () => {
          const response = await fetch("/api/state");
          const payload = await response.json();
          return !payload.slides.some((slide) => slide.title === "Workflow system boundary");
        });

        await page.click("#show-planning-page");
        await waitForPage(page, "#planning-page");
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
        const createdCard = page.locator(".presentation-card", {
          has: page.getByRole("heading", { name: smokeTitle })
        });
        await createdCard.waitFor({ timeout: 30_000 });
        await createdCard.locator(".presentation-duplicate-button").click();
        await waitForPage(page, "#studio-page");

        await page.click("#show-presentations-page");
        const duplicatedCard = page.locator(".presentation-card", {
          has: page.getByRole("heading", { name: smokeCopyTitle })
        });
        await duplicatedCard.waitFor({ timeout: 30_000 });
        await duplicatedCard.locator(".presentation-delete-button").click();
        await page.waitForFunction((title) => {
          return !Array.from(document.querySelectorAll(".presentation-card h3"))
            .some((element) => element.textContent && element.textContent.trim() === title);
        }, smokeCopyTitle);

        await createdCard.locator(".presentation-delete-button").click();
        await page.waitForFunction((title) => {
          return !Array.from(document.querySelectorAll(".presentation-card h3"))
            .some((element) => element.textContent && element.textContent.trim() === title);
        }, smokeTitle);

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
  } finally {
    server.close();
    cleanupSmokePresentations(before.activePresentationId);
  }

  process.stdout.write("Presentation workflow validation passed.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
