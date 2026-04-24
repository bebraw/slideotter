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
