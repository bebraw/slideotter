import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createSmokePresentationFromBrief } from "./presentation-workflow/creation-phase.ts";
import { validateLayoutLibraryAndFavoritesPhase } from "./presentation-workflow/layout-library-phase.ts";
import { validateManualSlideLifecyclePhase } from "./presentation-workflow/manual-slide-phase.ts";
import { validateMaterialAndVariantPhase } from "./presentation-workflow/material-variant-phase.ts";
import { validateOutlineDeckStructurePhase } from "./presentation-workflow/outline-deck-phase.ts";
import { validatePresentationLibraryCleanupPhase } from "./presentation-workflow/presentation-library-cleanup-phase.ts";
import { validatePresentationModePhase } from "./presentation-workflow/presentation-mode-phase.ts";
import {
  installSmokeLlmMock,
  isSmokePresentationId,
  restoreSmokeLlmMock
} from "./presentation-workflow/smoke-llm.ts";
const require = createRequire(import.meta.url);
const { startServer } = require("../studio/server/index.ts");
const { deletePresentation,
  listPresentations,
  setActivePresentation } = require("../studio/server/services/presentations.ts");

const smokeImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC",
  "base64"
);

type Page = import("playwright").Page;
type JsonRecord = Record<string, unknown>;

type PresentationWorkflowValidationOptions = {
  keepServerOpen?: boolean;
};

type PresentationSummary = {
  id: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function isPresentationSummary(value: unknown): value is PresentationSummary {
  return typeof asRecord(value).id === "string";
}

function cleanupSmokePresentations(activePresentationId: string | null | undefined): void {
  const presentations = asRecord(listPresentations()).presentations;
  const existingSmokeIds = (Array.isArray(presentations) ? presentations : [])
    .filter(isPresentationSummary)
    .map((presentation) => presentation.id)
    .filter(isSmokePresentationId);

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

async function waitForPage(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((targetSelector: string) => {
    const element = document.querySelector(targetSelector);
    return element instanceof HTMLElement && !element.hidden;
  }, selector);
}

async function runPresentationWorkflowValidation(options: PresentationWorkflowValidationOptions = {}) {
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
        await page.click("#show-presentations-page");
        await waitForPage(page, "#presentations-page");
        await page.waitForSelector("#presentation-list .presentation-card", {
          timeout: 30_000
        });

        const createdPresentationId = await createSmokePresentationFromBrief(page);
        await page.waitForFunction(() => {
          return document.querySelector("#source-retrieval-list")?.textContent?.includes("browser UI management");
        });
        await page.waitForFunction(() => {
          return /source snippet/.test(document.querySelector("#source-retrieval-summary")?.textContent || "");
        });
        await page.click("#theme-drawer-toggle");
        await page.waitForSelector("#theme-drawer[data-open='false']");

        await validatePresentationModePhase(browser, page, port, createdPresentationId);
        await validateMaterialAndVariantPhase(page, smokeImage);
        await validateLayoutLibraryAndFavoritesPhase(page);
        await validateManualSlideLifecyclePhase(page);
        await validateOutlineDeckStructurePhase(page);
        await validatePresentationLibraryCleanupPhase(page, createdPresentationId);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPresentationWorkflowValidation().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { runPresentationWorkflowValidation };
