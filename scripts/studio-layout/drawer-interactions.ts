import assert from "node:assert/strict";
import {
  clickDrawerControl,
  drawerShortcuts,
  type DrawerShortcut
} from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

async function closeOpenDrawers(page: Page): Promise<void> {
  for (const shortcut of drawerShortcuts) {
    const isOpen = await page.evaluate((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
    }, shortcut.drawer);
    if (!isOpen) {
      continue;
    }

    await page.keyboard.press("Escape");
    await page.waitForFunction((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") !== "true";
    }, shortcut.drawer);
  }
}

async function validateDrawerHoverLabels(page: Page): Promise<void> {
  const mobileToolsVisible = await page.evaluate(() => {
    const mobileTools = document.querySelector("#mobile-tools") as HTMLElement | null;
    return Boolean(mobileTools && !mobileTools.hidden && window.getComputedStyle(mobileTools).display !== "none");
  });
  if (mobileToolsVisible) {
    return;
  }

  const drawerToggles = [
    { label: "Theme", selector: "#theme-drawer-toggle" },
    ...drawerShortcuts.filter((shortcut) => shortcut.label !== "Theme").map((shortcut) => ({
      label: shortcut.label,
      selector: shortcut.toggle
    }))
  ];

  for (const toggle of drawerToggles) {
    await page.hover(toggle.selector);
    await page.waitForFunction((selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return false;
      }
      const after = window.getComputedStyle(element, "::after");
      return Number.parseFloat(after.opacity || "0") > 0.9;
    }, toggle.selector);
    const metrics = await page.evaluate((selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const after = window.getComputedStyle(element, "::after");
      return {
        content: after.content,
        transition: after.transition
      };
    }, toggle.selector);
    if (!metrics) {
      throw new Error(`${toggle.label} drawer toggle should exist`);
    }
    assert.equal(metrics.content, `"${toggle.label}"`, `${toggle.label} drawer toggle should expose a section hover label`);
    assert.match(metrics.transition, /opacity/, `${toggle.label} drawer hover label should animate opacity`);
    assert.match(metrics.transition, /transform/, `${toggle.label} drawer hover label should animate horizontal motion`);
  }

  await page.click("#structured-draft-toggle");
  await page.waitForFunction(() => document.querySelector("#structured-draft-drawer")?.getAttribute("data-open") === "true");
  await page.hover("#structured-draft-toggle");
  const openDrawerLabelOpacity = await page.evaluate(() => {
    const element = document.querySelector("#structured-draft-toggle");
    return element ? window.getComputedStyle(element, "::after").opacity : "";
  });
  assert.equal(openDrawerLabelOpacity, "0", "Open drawer rail icons should not show hover labels");
  await page.click("#structured-draft-toggle");
  await page.waitForFunction(() => document.querySelector("#structured-draft-drawer")?.getAttribute("data-open") !== "true");
}

async function validateDrawerClickSwitching(page: Page, viewport: ViewportSize): Promise<void> {
  async function ensureDrawerOpen(shortcut: DrawerShortcut): Promise<void> {
    const isOpen = await page.evaluate((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
    }, shortcut.drawer);
    if (isOpen) {
      return;
    }

    await clickDrawerControl(page, shortcut, viewport);
    await page.waitForFunction((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
    }, shortcut.drawer);
  }

  for (const currentShortcut of drawerShortcuts) {
    for (const nextShortcut of drawerShortcuts) {
      if (currentShortcut.drawer === nextShortcut.drawer) {
        continue;
      }

      await ensureDrawerOpen(currentShortcut);

      await clickDrawerControl(page, nextShortcut, viewport);
      await page.waitForFunction((drawerSelector: string) => {
        return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
      }, nextShortcut.drawer);

      const metrics = await page.evaluate((activeShortcut: DrawerShortcut) => {
        return Array.from(document.querySelectorAll(
          "#outline-drawer, #context-drawer, #layout-drawer, #debug-drawer, #structured-draft-drawer, #theme-drawer, #assistant-drawer"
        )).map((drawer) => ({
          id: drawer.id,
          open: drawer.getAttribute("data-open"),
          active: drawer.id === activeShortcut.drawer.slice(1)
        }));
      }, nextShortcut);

      metrics.forEach((drawerState) => {
        const expectedOpen = drawerState.active ? "true" : "false";
        assert.equal(
          drawerState.open,
          expectedOpen,
          `${currentShortcut.label} drawer should switch to ${nextShortcut.label} by click at ${viewport.width}x${viewport.height}`
        );
      });
    }
  }
}

async function validateDrawerKeyboardShortcuts(page: Page, viewport: ViewportSize): Promise<void> {
  await closeOpenDrawers(page);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  for (const shortcut of drawerShortcuts) {
    await page.keyboard.press(shortcut.key);
    await page.waitForFunction((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
    }, shortcut.drawer);

    const metrics = await page.evaluate((activeShortcut: DrawerShortcut) => {
      return {
        activeExpanded: document.querySelector(activeShortcut.toggle)?.getAttribute("aria-expanded") || "",
        drawerStates: Array.from(document.querySelectorAll(
          "#outline-drawer, #context-drawer, #layout-drawer, #debug-drawer, #structured-draft-drawer, #theme-drawer, #assistant-drawer"
        )).map((drawer) => ({
          id: drawer.id,
          open: drawer.getAttribute("data-open")
        }))
      };
    }, shortcut);

    assert.equal(metrics.activeExpanded, "true", `${shortcut.label} drawer shortcut should set aria-expanded at ${viewport.width}x${viewport.height}`);
    metrics.drawerStates.forEach((drawerState) => {
      const expectedOpen = drawerState.id === shortcut.drawer.slice(1) ? "true" : "false";
      assert.equal(
        drawerState.open,
        expectedOpen,
        `${shortcut.label} drawer shortcut should leave ${drawerState.id} ${expectedOpen === "true" ? "open" : "closed"} at ${viewport.width}x${viewport.height}`
      );
    });
  }

  await page.focus("#deck-title");
  await page.keyboard.press("1");
  const editableTargetMetrics = await page.evaluate(() => ({
    activeElementId: document.activeElement?.id || "",
    outlineOpen: document.querySelector("#outline-drawer")?.getAttribute("data-open"),
    value: (document.querySelector("#deck-title") as HTMLInputElement | null)?.value || ""
  }));
  assert.equal(editableTargetMetrics.activeElementId, "deck-title", "Drawer shortcuts should not steal focus from editable fields");
  assert.equal(editableTargetMetrics.outlineOpen, "false", "Drawer shortcuts should be ignored while typing in editable fields");
  assert.match(editableTargetMetrics.value, /1/u, "Number keys should still type into editable fields");

  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press("7");
  await page.waitForFunction(() => document.querySelector("#assistant-drawer")?.getAttribute("data-open") === "false");
}

export {
  validateDrawerClickSwitching,
  validateDrawerHoverLabels,
  validateDrawerKeyboardShortcuts
};
