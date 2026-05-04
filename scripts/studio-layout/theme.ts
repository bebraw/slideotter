import assert from "node:assert/strict";
import {
  clickDrawerControl,
  getDrawerShortcut,
  requireRect
} from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type ThemeRectMetrics = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type InitialThemeMetrics = {
  appTheme: string | undefined;
  documentClientWidth: number;
  documentScrollWidth: number;
  themeLabel: string;
  themePressed: string | null | undefined;
  themeToggle: ThemeRectMetrics | null;
  viewportWidth: number;
};

async function validateThemeControls(
  page: Page,
  viewport: ViewportSize,
  metrics: InitialThemeMetrics
): Promise<void> {
  assert.ok(
    metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
    `Slide Studio should not create horizontal page overflow at ${viewport.width}x${viewport.height} (${metrics.documentScrollWidth}px > ${metrics.documentClientWidth}px)`
  );
  assert.equal(metrics.appTheme, "light", "Studio should default to light theme in a light browser context");
  assert.equal(metrics.themeLabel, "Light", "Theme toggle should show the current light theme");
  assert.equal(metrics.themePressed, "false", "Theme toggle should expose its inactive pressed state in light mode");
  const themeToggle = requireRect(metrics.themeToggle, "Studio should expose an app theme toggle in the masthead");
  assert.ok(
    themeToggle.right <= metrics.viewportWidth + 1,
    `Theme toggle should stay inside the viewport at ${viewport.width}x${viewport.height}`
  );

  await page.click("#theme-toggle");
  await page.waitForTimeout(80);

  const darkThemeMetrics = await page.evaluate(() => ({
    appTheme: document.documentElement.dataset.appTheme,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    storedTheme: window.localStorage.getItem("studio.appTheme"),
    themeLabel: document.querySelector("#theme-toggle-label")?.textContent || "",
    themePressed: document.querySelector("#theme-toggle")?.getAttribute("aria-pressed")
  }));

  assert.equal(darkThemeMetrics.appTheme, "dark", "Theme toggle should switch the app into dark mode");
  assert.equal(darkThemeMetrics.storedTheme, "dark", "Theme toggle should persist the chosen app theme");
  assert.equal(darkThemeMetrics.themeLabel, "Dark", "Theme toggle should show the current dark theme");
  assert.equal(darkThemeMetrics.themePressed, "true", "Theme toggle should expose its pressed state in dark mode");
  assert.ok(
    darkThemeMetrics.documentScrollWidth <= darkThemeMetrics.documentClientWidth + 1,
    `Dark mode should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
  );

  await clickDrawerControl(page, getDrawerShortcut("#theme-drawer"), viewport);
  await page.waitForFunction(() => document.querySelector("#theme-drawer")?.getAttribute("data-open") === "true");
  await page.waitForTimeout(260);
  const themeDrawerMetrics = await page.evaluate(() => {
    const drawer = document.querySelector("#theme-drawer") as HTMLElement | null;
    const colorGrid = document.querySelector(".theme-drawer-color-grid") as HTMLElement | null;
    const labelOverflows = Array.from(document.querySelectorAll(".theme-drawer-color-grid .color-field span"))
      .map((label) => {
        const element = label as HTMLElement;
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          text: element.textContent || ""
        };
      })
      .filter((label) => label.scrollWidth > label.clientWidth + 1);
    const drawerRect = drawer ? drawer.getBoundingClientRect() : null;
    const gridStyle = colorGrid ? window.getComputedStyle(colorGrid) : null;

    return {
      drawer: drawerRect ? {
        left: drawerRect.left,
        right: drawerRect.right
      } : null,
      gridColumns: gridStyle ? gridStyle.gridTemplateColumns.split(" ").length : 0,
      labelOverflows,
      viewportWidth: window.innerWidth
    };
  });
  const themeDrawer = requireRect(
    themeDrawerMetrics.drawer ? {
      bottom: 0,
      height: 0,
      left: themeDrawerMetrics.drawer.left,
      right: themeDrawerMetrics.drawer.right,
      top: 0,
      width: themeDrawerMetrics.drawer.right - themeDrawerMetrics.drawer.left
    } : null,
    "Theme drawer should open for color control checks"
  );
  assert.ok(
    themeDrawer.left >= -1 && themeDrawer.right <= themeDrawerMetrics.viewportWidth + 1,
    `Theme drawer should stay inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.deepEqual(
    themeDrawerMetrics.labelOverflows,
    [],
    `Theme drawer color labels should fit at ${viewport.width}x${viewport.height}`
  );
  if (viewport.width <= 760) {
    assert.ok(themeDrawerMetrics.gridColumns <= 2, "Theme drawer color grid should use at most two columns on mobile");
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#theme-drawer")?.getAttribute("data-open") === "false");
  await page.waitForTimeout(260);
}

export { validateThemeControls };
