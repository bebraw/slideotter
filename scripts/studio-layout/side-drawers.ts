import assert from "node:assert/strict";
import {
  clickDrawerControl,
  getDrawerShortcut,
  requireRect
} from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

async function validateContextAndStructuredDrawers(page: Page, viewport: ViewportSize): Promise<void> {
  await clickDrawerControl(page, getDrawerShortcut("#context-drawer"), viewport);
  await page.waitForTimeout(280);

  const contextDrawerMetrics = await page.evaluate(() => {
    function rectFor(selector: string) {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width
      };
    }

    return {
      drawer: rectFor("#context-drawer"),
      intent: rectFor("#slide-intent"),
      saveButton: rectFor("#save-slide-context-button"),
      specOpen: document.querySelector("#structured-draft-drawer")?.getAttribute("data-open"),
      toggle: rectFor("#context-drawer-toggle"),
      toggleIcon: Boolean(document.querySelector("#context-drawer-toggle .drawer-toggle-icon")),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });

  const contextDrawer = requireRect(contextDrawerMetrics.drawer, "Context drawer should open");
  assert.ok(contextDrawerMetrics.intent, "Context drawer should expose the slide intent field");
  const contextSaveButton = requireRect(contextDrawerMetrics.saveButton, "Context drawer should expose the save action");
  const contextToggle = requireRect(contextDrawerMetrics.toggle, "Context drawer should keep its drawer tab visible");
  assert.equal(contextDrawerMetrics.toggleIcon, true, "Context drawer should keep its icon tab when open");
  assert.equal(contextDrawerMetrics.specOpen, "false", "Opening Context should leave the Spec drawer closed");
  assert.ok(
    contextDrawer.left >= -1 && contextDrawer.right <= contextDrawerMetrics.viewportWidth + 1,
    `Context drawer should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    contextDrawer.top >= -1 && contextDrawer.bottom <= contextDrawerMetrics.viewportHeight + 1,
    `Context drawer should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    contextSaveButton.bottom <= contextDrawerMetrics.viewportHeight + 1,
    `Context drawer save action should stay visible at ${viewport.width}x${viewport.height}`
  );
  if (viewport.width > 760) {
    assert.ok(
      contextToggle.height <= 60,
      `Context open tab should stay compact at ${viewport.width}x${viewport.height}`
    );
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(280);

  await clickDrawerControl(page, getDrawerShortcut("#structured-draft-drawer"), viewport);
  await page.waitForTimeout(280);

  const structuredMetrics = await page.evaluate(() => {
    function rectFor(selector: string) {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width
      };
    }

    return {
      contextOpen: document.querySelector("#context-drawer")?.getAttribute("data-open"),
      drawer: rectFor("#structured-draft-drawer"),
      editor: rectFor("#slide-spec-editor"),
      highlightedKeyColor: (() => {
        const token = document.querySelector("#slide-spec-highlight .json-token-key");
        return token ? window.getComputedStyle(token).color : "";
      })(),
      highlightedKeyWeight: (() => {
        const token = document.querySelector("#slide-spec-highlight .json-token-key");
        return token ? window.getComputedStyle(token).fontWeight : "";
      })(),
      highlightSoftTextColor: window.getComputedStyle(document.documentElement).getPropertyValue("--app-soft-text").trim(),
      highlightTokenCount: document.querySelectorAll("#slide-spec-highlight .json-token-key, #slide-spec-highlight .json-token-string, #slide-spec-highlight .json-token-number, #slide-spec-highlight .json-token-literal").length,
      saveButton: rectFor("#save-slide-spec-button"),
      toggle: rectFor("#structured-draft-toggle"),
      toggleIcon: Boolean(document.querySelector("#structured-draft-toggle .drawer-toggle-icon")),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });

  const structuredDrawer = requireRect(structuredMetrics.drawer, "Structured draft drawer should open");
  assert.equal(structuredMetrics.contextOpen, "false", "Opening Spec should leave the Context drawer closed");
  const structuredEditor = requireRect(structuredMetrics.editor, "Structured draft drawer should expose the JSON editor");
  assert.ok(structuredMetrics.highlightTokenCount > 4, "Structured draft JSON editor should render syntax tokens");
  assert.notEqual(
    structuredMetrics.highlightedKeyColor,
    structuredMetrics.highlightSoftTextColor,
    "Structured draft JSON token colors should not be overridden by generic field label styling"
  );
  assert.ok(
    Number(structuredMetrics.highlightedKeyWeight) < 600,
    "Structured draft JSON tokens should not inherit field label font weight"
  );
  const structuredSaveButton = requireRect(structuredMetrics.saveButton, "Structured draft drawer should expose the save action");
  const structuredToggle = requireRect(structuredMetrics.toggle, "Structured draft drawer should keep its drawer tab visible");
  assert.equal(structuredMetrics.toggleIcon, true, "Structured draft drawer should keep its icon tab when open");
  assert.ok(
    structuredDrawer.left >= -1 && structuredDrawer.right <= structuredMetrics.viewportWidth + 1,
    `Structured draft drawer should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
  );
  if (viewport.width > 760) {
    assert.ok(
      structuredToggle.height <= 60,
      `Structured draft open tab should stay compact at ${viewport.width}x${viewport.height}`
    );
  }
  assert.ok(
    structuredDrawer.top >= -1 && structuredDrawer.bottom <= structuredMetrics.viewportHeight + 1,
    `Structured draft drawer should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    structuredEditor.height >= Math.min(220, structuredMetrics.viewportHeight * 0.28),
    `Structured draft JSON editor should remain usable at ${viewport.width}x${viewport.height} (${structuredEditor.height.toFixed(1)}px tall)`
  );
  assert.ok(
    structuredSaveButton.bottom <= structuredMetrics.viewportHeight + 1,
    `Structured draft save action should stay visible at ${viewport.width}x${viewport.height}`
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(280);
}

export { validateContextAndStructuredDrawers };
