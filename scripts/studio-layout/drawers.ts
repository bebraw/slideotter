import assert from "node:assert/strict";

type Page = import("playwright").Page;
type Browser = import("playwright").Browser;
type ViewportSize = import("playwright").ViewportSize;

type DrawerShortcut = {
  drawer: string;
  key: string;
  label: string;
  toggle: string;
};

type RectMetrics = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

function requireRect(rect: RectMetrics | null, message: string): RectMetrics {
  if (!rect) {
    throw new Error(message);
  }
  return rect;
}

const drawerShortcuts: DrawerShortcut[] = [
  { drawer: "#outline-drawer", key: "1", label: "Outline", toggle: "#outline-drawer-toggle" },
  { drawer: "#context-drawer", key: "2", label: "Context", toggle: "#context-drawer-toggle" },
  { drawer: "#layout-drawer", key: "3", label: "Layout", toggle: "#layout-drawer-toggle" },
  { drawer: "#debug-drawer", key: "4", label: "Diagnostics", toggle: "#debug-drawer-toggle" },
  { drawer: "#structured-draft-drawer", key: "5", label: "Structured Draft", toggle: "#structured-draft-toggle" },
  { drawer: "#theme-drawer", key: "6", label: "Theme", toggle: "#theme-drawer-toggle" },
  { drawer: "#assistant-drawer", key: "7", label: "Assistant", toggle: "#assistant-toggle" }
];

function isMobileViewport(viewport: ViewportSize): boolean {
  return viewport.width <= 760;
}

function getDrawerShortcut(drawer: string): DrawerShortcut {
  const shortcut = drawerShortcuts.find((entry) => entry.drawer === drawer);
  if (!shortcut) {
    throw new Error(`Unknown drawer shortcut: ${drawer}`);
  }
  return shortcut;
}

async function clickDrawerControl(page: Page, shortcut: DrawerShortcut, viewport: ViewportSize): Promise<void> {
  if (!isMobileViewport(viewport)) {
    await page.click(shortcut.toggle);
    return;
  }

  await page.click("#mobile-tools-toggle");
  await page.waitForFunction(() => {
    const panel = document.querySelector("#mobile-tools-panel") as HTMLElement | null;
    return Boolean(panel && !panel.hidden);
  });
  const toolKey = shortcut.drawer
    .replace(/^#/u, "")
    .replace(/-drawer$/u, "")
    .replace(/^structured-draft$/u, "structuredDraft");
  await page.click(`[data-mobile-drawer-tool="${toolKey}"]`);
}

async function validateInitialDrawerPreferenceConflict(browser: Browser, port: number): Promise<void> {
  const page = await browser.newPage({
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 800 }
  });

  try {
    await page.addInitScript(() => {
      window.localStorage.setItem("studio.assistantDrawerOpen", "true");
      window.localStorage.setItem("studio.contextDrawerOpen", "true");
      window.localStorage.setItem("studio.structuredDraftDrawerOpen", "true");
      window.localStorage.setItem("studio.currentPage", "studio");
    });
    await page.goto(`http://127.0.0.1:${port}/#studio`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
      timeout: 30_000
    });

    const openDrawers = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(
        "#outline-drawer, #context-drawer, #layout-drawer, #debug-drawer, #structured-draft-drawer, #theme-drawer, #assistant-drawer"
      ))
        .filter((drawer) => drawer.getAttribute("data-open") === "true")
        .map((drawer) => drawer.id);
    });

    assert.deepEqual(openDrawers, ["assistant-drawer"], "Persisted drawer preferences should normalize to one open drawer on startup");
  } finally {
    await page.close();
  }
}

async function validateLayoutDrawerDoesNotSqueezeWorkspace(page: Page, viewport: ViewportSize): Promise<void> {
  const before = await page.evaluate(() => {
    const rectFor = (selector: string): RectMetrics | null => {
      const element = document.querySelector(selector) as HTMLElement | null;
      const rect = element ? element.getBoundingClientRect() : null;
      return rect ? {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width
      } : null;
    };

    return {
      activePreview: rectFor("#active-preview"),
      studioPage: rectFor("#studio-page"),
      studioWorkbench: rectFor(".studio-inline-workbench"),
      thumbRail: rectFor(".thumb-rail")
    };
  });

  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
  await page.waitForTimeout(260);

  const after = await page.evaluate(() => {
    const rectFor = (selector: string): RectMetrics | null => {
      const element = document.querySelector(selector) as HTMLElement | null;
      const rect = element ? element.getBoundingClientRect() : null;
      return rect ? {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width
      } : null;
    };

    return {
      activePreview: rectFor("#active-preview"),
      studioPage: rectFor("#studio-page"),
      studioWorkbench: rectFor(".studio-inline-workbench"),
      thumbRail: rectFor(".thumb-rail")
    };
  });

  const beforePreview = requireRect(before.activePreview, "Studio should render the active preview before opening the Layout drawer");
  const afterPreview = requireRect(after.activePreview, "Studio should keep the active preview while opening the Layout drawer");
  const beforePage = requireRect(before.studioPage, "Studio should render the page before opening the Layout drawer");
  const afterPage = requireRect(after.studioPage, "Studio should keep the page width while opening the Layout drawer");
  const beforeWorkbench = requireRect(before.studioWorkbench, "Studio should render the workbench before opening the Layout drawer");
  const afterWorkbench = requireRect(after.studioWorkbench, "Studio should keep the workbench while opening the Layout drawer");
  const beforeRail = requireRect(before.thumbRail, "Studio should render the thumbnail rail before opening the Layout drawer");
  const afterRail = requireRect(after.thumbRail, "Studio should keep the thumbnail rail while opening the Layout drawer");

  assert.ok(
    afterPage.width >= beforePage.width - 1,
    `Opening Current Slide Layout should not squeeze the Studio page at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    afterWorkbench.width >= beforeWorkbench.width - 1,
    `Opening Current Slide Layout should not squeeze the Studio workbench at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    afterPreview.width >= beforePreview.width - 1,
    `Opening Current Slide Layout should not squeeze the active preview at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    afterRail.width >= beforeRail.width - 1,
    `Opening Current Slide Layout should not squeeze the slide rail at ${viewport.width}x${viewport.height}`
  );

  await clickDrawerControl(page, getDrawerShortcut("#layout-drawer"), viewport);
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") !== "true");
}

export {
  clickDrawerControl,
  drawerShortcuts,
  getDrawerShortcut,
  isMobileViewport,
  requireRect,
  validateInitialDrawerPreferenceConflict,
  validateLayoutDrawerDoesNotSqueezeWorkspace
};

export type { DrawerShortcut };
