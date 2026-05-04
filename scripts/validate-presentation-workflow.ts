import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);

import { once } from "node:events";
import { chromium } from "playwright";
import { createSmokePresentationFromBrief } from "./presentation-workflow/creation-phase.ts";
import {
  installSmokeLlmMock,
  isSmokePresentationId,
  restoreSmokeLlmMock,
  smokePresentation
} from "./presentation-workflow/smoke-llm.ts";
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

type WorkspaceSlide = {
  id: string;
  title?: string;
};

type WorkflowLayout = {
  definition?: {
    arrangement?: string;
    type?: string;
  };
  name?: string;
  supportedTypes?: string[];
  treatment?: string;
};

type WorkflowSource = {
  title?: string;
};

type PresentationSummary = {
  id: string;
};

type WorkspaceState = {
  presentations: {
    activePresentationId?: string | null;
  };
  slides: WorkspaceSlide[];
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function isPresentationSummary(value: unknown): value is PresentationSummary {
  return typeof asRecord(value).id === "string";
}

function requireSlide(slide: WorkspaceSlide | undefined, message: string): WorkspaceSlide {
  if (!slide) {
    throw new Error(message);
  }
  return slide;
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

async function readWorkspaceState(page: Page): Promise<WorkspaceState> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    return response.json();
  });
}

async function setSlideSpecEditor(page: Page, slideSpec: unknown): Promise<void> {
  await page.evaluate((source: string) => {
    const editor = document.querySelector("#slide-spec-editor") as HTMLTextAreaElement | null;
    if (!editor) {
      throw new Error("Slide spec editor is not available");
    }

    editor.value = source;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, `${JSON.stringify(slideSpec, null, 2)}\n`);
}

async function waitForActivePreviewText(page: Page, text: string): Promise<void> {
  await page.waitForFunction((expectedText: string) => {
    return Boolean(document.querySelector("#active-preview")?.textContent?.includes(expectedText));
  }, text);
}

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
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

        const createdPresentationIdAfterCreate = await createSmokePresentationFromBrief(page);
        await page.waitForFunction(() => {
          return document.querySelector("#source-retrieval-list")?.textContent?.includes("browser UI management");
        });
        await page.waitForFunction(() => {
          return /source snippet/.test(document.querySelector("#source-retrieval-summary")?.textContent || "");
        });
        await page.click("#theme-drawer-toggle");
        await page.waitForSelector("#theme-drawer[data-open='false']");

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
          const stage = document.querySelector(".dom-presentation-document__slides") as HTMLElement | null;
          const rect = activeSlide ? activeSlide.getBoundingClientRect() : null;
          const stageRect = stage ? stage.getBoundingClientRect() : null;
          const activeStyle = activeSlide ? window.getComputedStyle(activeSlide) : null;
          const stageStyle = stage ? window.getComputedStyle(stage) : null;
          return {
            slideDisplay: activeStyle ? activeStyle.display : "",
            slideHeight: rect ? rect.height : 0,
            slideTransform: activeStyle ? activeStyle.transform : "",
            slideWidth: rect ? rect.width : 0,
            stageHeight: stageRect ? stageRect.height : 0,
            stageInlineHeight: stage ? stage.style.height : "",
            stageInlineWidth: stage ? stage.style.width : "",
            stageTransform: stageStyle ? stageStyle.transform : "",
            stageWidth: stageRect ? stageRect.width : 0,
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
          [
            `presentation slide should use the full available width (${presentationMetrics.slideWidth} vs ${expectedSlideWidth})`,
            `viewport=${presentationMetrics.viewportWidth}x${presentationMetrics.viewportHeight}`,
            `stage=${presentationMetrics.stageWidth}x${presentationMetrics.stageHeight}`,
            `stageInline=${presentationMetrics.stageInlineWidth || "unset"}x${presentationMetrics.stageInlineHeight || "unset"}`,
            `slide=${presentationMetrics.slideWidth}x${presentationMetrics.slideHeight}`,
            `slideDisplay=${presentationMetrics.slideDisplay || "unset"}`,
            `slideTransform=${presentationMetrics.slideTransform || "unset"}`,
            `stageTransform=${presentationMetrics.stageTransform || "unset"}`
          ].join("; ")
        );
        assert.ok(
          Math.abs(presentationMetrics.slideHeight - expectedSlideHeight) <= 2,
          [
            `presentation slide should use the full available height (${presentationMetrics.slideHeight} vs ${expectedSlideHeight})`,
            `viewport=${presentationMetrics.viewportWidth}x${presentationMetrics.viewportHeight}`,
            `stage=${presentationMetrics.stageWidth}x${presentationMetrics.stageHeight}`,
            `stageInline=${presentationMetrics.stageInlineWidth || "unset"}x${presentationMetrics.stageInlineHeight || "unset"}`,
            `slide=${presentationMetrics.slideWidth}x${presentationMetrics.slideHeight}`,
            `slideDisplay=${presentationMetrics.slideDisplay || "unset"}`,
            `slideTransform=${presentationMetrics.slideTransform || "unset"}`,
            `stageTransform=${presentationMetrics.stageTransform || "unset"}`
          ].join("; ")
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
        await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
          timeout: 30_000
        });
        const materialTarget = await page.evaluate(async () => {
          const materialCapableTypes = new Set(["content", "cover", "photo", "summary"]);
          const stateResponse = await fetch("/api/v1/state");
          const statePayload = await stateResponse.json();
          const slideSummaries = Array.isArray(statePayload.slides) ? statePayload.slides : [];
          const slideTypes: Array<{ id: string; type: string }> = [];
          for (const slide of slideSummaries) {
            const slideId = typeof slide.id === "string" ? slide.id : "";
            if (!slideId) {
              continue;
            }
            const slideResponse = await fetch(`/api/v1/slides/${slideId}`);
            const slidePayload = await slideResponse.json();
            const slideType = typeof slidePayload.slideSpec?.type === "string" ? slidePayload.slideSpec.type : "";
            slideTypes.push({ id: slideId, type: slideType });
            if (materialCapableTypes.has(slideType)) {
              const targetThumb = document.querySelector(`#thumb-rail .thumb[data-slide-id="${slideId}"]`) as HTMLButtonElement | null;
              targetThumb?.click();
              return {
                selected: Boolean(targetThumb),
                slideId,
                slideTypes
              };
            }
          }

          return {
            selected: false,
            slideId: "",
            slideTypes
          };
        });
        assert.equal(
          materialTarget.selected,
          true,
          `Presentation workflow needs a material-capable slide for attachment; generated slide types: ${materialTarget.slideTypes.map((slide) => `${slide.id}:${slide.type || "unknown"}`).join(", ")}`
        );
        await page.waitForFunction((slideId: string) => {
          const activeThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
          return activeThumb?.dataset.slideId === slideId;
        }, materialTarget.slideId);

        await page.locator(".material-details summary").first().click();
        await page.setInputFiles("#material-file", {
          buffer: smokeImage,
          mimeType: "image/png",
          name: "workflow-material.png"
        });
        await page.fill("#material-alt", "Workflow material");
        await page.fill("#material-caption", "Source: workflow smoke");
        await page.click("#upload-material-button");
        await page.waitForSelector("#material-list .material-card");
        await page.waitForFunction(() => {
          const button = document.querySelector("#material-list .material-card button") as HTMLButtonElement | null;
          return Boolean(button && !button.disabled && button.textContent?.trim() === "Attach");
        });
        await page.locator("#material-list .material-card button", { hasText: "Attach" }).first().click();
        await page.waitForFunction(() => {
          return Array.from(document.querySelectorAll("#material-list .material-card button"))
            .some((button) => button.textContent?.trim() === "Attached");
        });
        await page.waitForSelector("#active-preview .dom-slide__media img[alt='Workflow material']");
        await page.setInputFiles("#material-file", {
          buffer: smokeImage,
          mimeType: "image/png",
          name: "workflow-material-grid.png"
        });
        await page.fill("#material-alt", "Workflow grid material");
        await page.fill("#material-caption", "Source: workflow grid smoke");
        await page.click("#upload-material-button");
        await page.waitForFunction(async () => {
          const response = await fetch("/api/v1/state");
          const payload = await response.json();
          return Array.isArray(payload.materials) && payload.materials.length >= 2;
        });
        await page.evaluate(() => {
          const slideOneThumb = document.querySelector('#thumb-rail .thumb[data-slide-id="slide-01"]') as HTMLButtonElement | null;
          slideOneThumb?.click();
        });
        await page.waitForFunction(() => {
          const activeThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
          return activeThumb?.dataset.slideId === "slide-01";
        });

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
        const saveSlideSpecResponse = waitForJsonResponse(page, "/api/v1/slides/slide-01/slide-spec", 60_000);
        await page.click("#save-slide-spec-button");
        await saveSlideSpecResponse;
        await page.waitForFunction(async (expectedTitle) => {
          const response = await fetch("/api/v1/slides/slide-01");
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
        const captureVariantResponse = waitForJsonResponse(page, "/api/v1/variants/capture", 60_000);
        await page.click("#capture-variant-button");
        await captureVariantResponse;
        await page.click("#structured-draft-toggle");
        await page.waitForFunction(() => {
          return document.querySelector("#structured-draft-drawer")?.getAttribute("data-open") === "false";
        });
        await page.waitForSelector("#variant-list .variant-card:not(.variant-empty-state)");
        await page.waitForSelector("#compare-summary:not([hidden])");
        const applyVariantResponse = waitForJsonResponse(page, "/api/v1/variants/apply", 120_000);
        await page.click("#compare-apply-button");
        await applyVariantResponse;
        await page.waitForFunction(async (expectedTitle) => {
          const response = await fetch("/api/v1/slides/slide-01");
          const payload = await response.json();
          return payload.slideSpec && payload.slideSpec.title === expectedTitle;
        }, variantTitle);
        await page.evaluate(() => {
          const drawer = document.querySelector("#structured-draft-drawer");
          if (drawer?.getAttribute("data-open") === "true") {
            (document.querySelector("#structured-draft-toggle") as HTMLButtonElement | null)?.click();
          }
        });
        await page.waitForFunction(() => {
          return document.querySelector("#structured-draft-drawer")?.getAttribute("data-open") === "false";
        });

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

        await page.click("#open-manual-delete-button");
        await page.selectOption("#manual-delete-slide", insertedSlide.id);
        const deleteSlideResponse = waitForJsonResponse(page, "/api/v1/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deleteSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/v1/state");
          const payload = await response.json();
          return !payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow system boundary");
        });

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

        await page.click("#open-manual-delete-button");
        await page.selectOption("#manual-delete-slide", insertedDividerSlide.id);
        const deleteDividerSlideResponse = waitForJsonResponse(page, "/api/v1/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deleteDividerSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/v1/state");
          const payload = await response.json();
          return !payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow section divider");
        });

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

        await page.click("#open-manual-delete-button");
        await page.selectOption("#manual-delete-slide", insertedQuoteSlide.id);
        const deleteQuoteSlideResponse = waitForJsonResponse(page, "/api/v1/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deleteQuoteSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/v1/state");
          const payload = await response.json();
          return !payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow quote slide");
        });

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

        await page.click("#open-manual-delete-button");
        await page.selectOption("#manual-delete-slide", insertedPhotoSlide.id);
        const deletePhotoSlideResponse = waitForJsonResponse(page, "/api/v1/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deletePhotoSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/v1/state");
          const payload = await response.json();
          return !payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow photo slide");
        });

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
        await page.click("#open-manual-delete-button");
        await page.selectOption("#manual-delete-slide", insertedPhotoGridSlide.id);
        const deletePhotoGridSlideResponse = waitForJsonResponse(page, "/api/v1/slides/delete", 120_000);
        await page.click("#delete-slide-button");
        await deletePhotoGridSlideResponse;
        await page.waitForFunction(async () => {
          const response = await fetch("/api/v1/state");
          const payload = await response.json();
          return !payload.slides.some((slide: WorkspaceSlide) => slide.title === "Workflow photo grid slide");
        });

        await page.click("#show-studio-page");
        await waitForPage(page, "#studio-page");
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

        await page.click("#show-presentations-page");
        const createdPresentationId = createdPresentationIdAfterCreate;
        const createdCard = page.locator(`.presentation-card[data-presentation-id="${createdPresentationId}"]`);
        await createdCard.waitFor({ timeout: 30_000 });
        const duplicateResponse = waitForJsonResponse(page, "/api/v1/presentations/duplicate", 60_000);
        await createdCard.locator(".presentation-duplicate-button").click();
        await duplicateResponse;
        await waitForPage(page, "#studio-page");

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
