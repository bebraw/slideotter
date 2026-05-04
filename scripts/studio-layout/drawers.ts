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

async function validateOutlineDrawer(page: Page, viewport: ViewportSize, port: number): Promise<void> {
  await page.goto(`http://127.0.0.1:${port}/#studio`, { waitUntil: "domcontentloaded" });
  await clickDrawerControl(page, getDrawerShortcut("#outline-drawer"), viewport);
  await page.waitForFunction(() => {
    const studioPage = document.querySelector("#studio-page") as HTMLElement | null;
    return Boolean(
      studioPage &&
      !studioPage.hidden &&
      window.location.hash === "#studio" &&
      document.querySelector("#outline-drawer")?.getAttribute("data-open") === "true" &&
      document.querySelector("#deck-length-target") &&
      document.querySelector("#outline-plan-list")
    );
  }, { timeout: 30_000 });
  await page.waitForTimeout(260);

  const metrics = await page.evaluate(() => {
    const drawer = document.querySelector("#outline-drawer") as HTMLElement | null;
    const panel = document.querySelector("#outline-drawer-panel") as HTMLElement | null;
    const drawerRect = drawer ? drawer.getBoundingClientRect() : null;
    const panelRect = panel ? panel.getBoundingClientRect() : null;

    return {
      drawer: drawerRect ? {
        bottom: drawerRect.bottom,
        height: drawerRect.height,
        left: drawerRect.left,
        right: drawerRect.right,
        top: drawerRect.top,
        width: drawerRect.width
      } : null,
      panel: panelRect ? {
        bottom: panelRect.bottom,
        height: panelRect.height,
        left: panelRect.left,
        right: panelRect.right,
        top: panelRect.top,
        width: panelRect.width
      } : null,
      activeTab: document.querySelector("[data-outline-mode].active")?.textContent?.trim() || "",
      modeLabels: Array.from(document.querySelectorAll("[data-outline-mode]"))
        .map((button) => button.textContent?.trim() || ""),
      retiredPlanningArtifacts: {
        navButton: Boolean(document.querySelector("#show-planning-page")),
        page: Boolean(document.querySelector("#planning-page"))
      },
      visiblePanel: Array.from(document.querySelectorAll("[data-outline-mode-panel]"))
        .filter((panel) => !(panel as HTMLElement).hidden)
        .map((panel) => (panel as HTMLElement).dataset.outlineModePanel || ""),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });

  const drawer = requireRect(metrics.drawer, "Outline drawer should open from the drawer rail");
  const panel = requireRect(metrics.panel, "Outline drawer should expose its planning panel");
  assert.ok(
    drawer.left >= -1 && drawer.right <= metrics.viewportWidth + 1,
    `Outline drawer should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    panel.top >= -1 && panel.bottom <= metrics.viewportHeight + 1,
    `Outline drawer panel should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.deepEqual(metrics.modeLabels, ["Brief", "Plans", "Changes", "Length"], "Outline drawer should expose explicit task modes");
  assert.equal(metrics.activeTab, "Brief", "Outline drawer should default to the Brief mode");
  assert.deepEqual(
    metrics.retiredPlanningArtifacts,
    { navButton: false, page: false },
    "Retired Deck Planning page artifacts should stay removed from the Studio shell"
  );
  assert.deepEqual(metrics.visiblePanel, ["brief"], "Outline drawer should show one mode panel at a time");

  const modeChecks = [
    {
      mode: "brief",
      tab: "#outline-mode-brief-tab",
      selectors: ["#save-deck-context-button", "#generate-outline-plan-button", ".source-details", "#deck-title"]
    },
    {
      mode: "plans",
      tab: "#outline-mode-plans-tab",
      selectors: ["#outline-plan-list"]
    },
    {
      mode: "changes",
      tab: "#outline-mode-changes-tab",
      selectors: ["#ideate-deck-structure-button", "#deck-structure-list"]
    },
    {
      mode: "length",
      tab: "#outline-mode-length-tab",
      selectors: ["#deck-length-target", "#deck-length-mode", "#deck-length-plan-button", "#deck-length-apply-button"]
    }
  ];

  for (const modeCheck of modeChecks) {
    await page.click(modeCheck.tab);
    await page.waitForFunction((mode: string) => {
      const activePanel = document.querySelector(`[data-outline-mode-panel="${mode}"]`) as HTMLElement | null;
      return Boolean(activePanel && !activePanel.hidden);
    }, modeCheck.mode);
    const modeMetrics = await page.evaluate(({ mode, selectors }: { mode: string; selectors: string[] }) => {
      const visiblePanels = Array.from(document.querySelectorAll("[data-outline-mode-panel]"))
        .filter((entry) => !(entry as HTMLElement).hidden)
        .map((entry) => (entry as HTMLElement).dataset.outlineModePanel || "");
      const activeTab = document.querySelector("[data-outline-mode].active")?.textContent?.trim() || "";
      const panel = document.querySelector(`[data-outline-mode-panel="${mode}"]`) as HTMLElement | null;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      return {
        activeTab,
        controls: selectors.map((selector) => {
          const element = document.querySelector(selector) as HTMLElement | null;
          const rect = element ? element.getBoundingClientRect() : null;
          return {
            rect: rect ? {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width
            } : null,
            selector
          };
        }),
        panel: panelRect ? {
          bottom: panelRect.bottom,
          height: panelRect.height,
          left: panelRect.left,
          right: panelRect.right,
          top: panelRect.top,
          width: panelRect.width
        } : null,
        visiblePanels
      };
    }, { mode: modeCheck.mode, selectors: modeCheck.selectors });

    assert.deepEqual(modeMetrics.visiblePanels, [modeCheck.mode], `Outline ${modeCheck.mode} mode should be the only visible mode`);
    assert.equal(modeMetrics.activeTab.toLowerCase(), modeCheck.mode, `Outline ${modeCheck.mode} mode should mark its tab active`);
    const modePanel = requireRect(modeMetrics.panel, `Outline ${modeCheck.mode} mode should render a panel`);
    assert.ok(
      modePanel.left >= panel.left - 1 && modePanel.right <= panel.right + 1,
      `Outline ${modeCheck.mode} mode should stay horizontally inside the drawer at ${viewport.width}x${viewport.height}`
    );
    modeMetrics.controls.forEach((control) => {
      const controlRect = requireRect(control.rect, `Outline ${modeCheck.mode} mode should render ${control.selector}`);
      assert.ok(
        controlRect.left >= panel.left - 1 && controlRect.right <= panel.right + 1,
        `Outline ${modeCheck.mode} control ${control.selector} should stay inside the panel at ${viewport.width}x${viewport.height}`
      );
    });
  }

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#outline-drawer")?.getAttribute("data-open") !== "true");
}

export {
  clickDrawerControl,
  getDrawerShortcut,
  isMobileViewport,
  requireRect,
  validateDrawerClickSwitching,
  validateDrawerHoverLabels,
  validateDrawerKeyboardShortcuts,
  validateInitialDrawerPreferenceConflict,
  validateLayoutDrawerDoesNotSqueezeWorkspace,
  validateOutlineDrawer
};
