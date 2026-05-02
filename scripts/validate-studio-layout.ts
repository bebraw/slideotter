const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium }: typeof import("playwright") = require("playwright");
const { startServer } = require("../studio/server/index.ts");

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type StudioLayoutValidationOptions = {
  server?: {
    address: () => string | import("node:net").AddressInfo | null;
    close: (callback?: () => void) => void;
    listening?: boolean;
  };
};

type MastheadPage = {
  button: string;
  hash: string;
  label: string;
  page: string;
};

type DrawerShortcut = {
  drawer: string;
  key: string;
  label: string;
  toggle: string;
};

type ScrollAxis = "x" | "y";

type RectMetrics = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type ThumbnailSelectionMetrics = {
  axis: ScrollAxis;
  before: number;
  skipped: boolean;
};

type SectionStackMetrics = {
  label: string;
  rect: RectMetrics;
};

function requireRect(rect: RectMetrics | null, message: string): RectMetrics {
  if (!rect) {
    throw new Error(message);
  }
  return rect;
}

function assertSectionStack(sections: SectionStackMetrics[], message: string): void {
  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1];
    const current = sections[index];
    if (!previous || !current) {
      throw new Error(`${message}: missing section metrics at ${index}`);
    }
    assert.ok(
      previous.rect.bottom <= current.rect.top + 1,
      `${message}: ${previous.label} overlaps ${current.label} (${previous.rect.bottom.toFixed(1)} > ${current.rect.top.toFixed(1)})`
    );
  }
}

const viewports: ViewportSize[] = [
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 }
];

const mastheadPages: MastheadPage[] = [
  {
    button: "#show-presentations-page",
    hash: "#presentations",
    label: "Presentations",
    page: "#presentations-page"
  },
  {
    button: "#show-studio-page",
    hash: "#studio",
    label: "Slide Studio",
    page: "#studio-page"
  }
];

const drawerShortcuts: DrawerShortcut[] = [
  { drawer: "#outline-drawer", key: "1", label: "Outline", toggle: "#outline-drawer-toggle" },
  { drawer: "#context-drawer", key: "2", label: "Context", toggle: "#context-drawer-toggle" },
  { drawer: "#layout-drawer", key: "3", label: "Layout", toggle: "#layout-drawer-toggle" },
  { drawer: "#debug-drawer", key: "4", label: "Diagnostics", toggle: "#debug-drawer-toggle" },
  { drawer: "#structured-draft-drawer", key: "5", label: "Structured Draft", toggle: "#structured-draft-toggle" },
  { drawer: "#theme-drawer", key: "6", label: "Theme", toggle: "#theme-drawer-toggle" },
  { drawer: "#assistant-drawer", key: "7", label: "Assistant", toggle: "#assistant-toggle" }
];

async function closeOpenDrawers(page: Page): Promise<void> {
  for (const shortcut of drawerShortcuts) {
    const isOpen = await page.evaluate((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
    }, shortcut.drawer);
    if (!isOpen) {
      continue;
    }

    await page.click(shortcut.toggle);
    await page.waitForFunction((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") !== "true";
    }, shortcut.drawer);
  }
}

async function validateMastheadPageNavigation(page: Page, viewport: ViewportSize): Promise<void> {
  for (const target of mastheadPages) {
    await page.click(target.button);
    await page.waitForFunction(
      ({ button, hash, page: pageSelector }: MastheadPage) => {
        const navButton = document.querySelector(button);
        const workspacePage = document.querySelector(pageSelector) as HTMLElement | null;

        return Boolean(
          navButton?.classList.contains("active") &&
          navButton.getAttribute("aria-pressed") === "true" &&
          workspacePage &&
          !workspacePage.hidden &&
          window.location.hash === hash
        );
      },
      target,
      { timeout: 3_000 }
    );

    const metrics = await page.evaluate(({ button, hash, page: pageSelector }: MastheadPage) => {
      const navButton = document.querySelector(button);
      const workspacePage = document.querySelector(pageSelector) as HTMLElement | null;

      return {
        active: Boolean(navButton?.classList.contains("active")),
        ariaPressed: navButton?.getAttribute("aria-pressed") || "",
        hash: window.location.hash,
        hidden: workspacePage ? workspacePage.hidden : true
      };
    }, target);

    assert.equal(metrics.hidden, false, `${target.label} nav should reveal ${target.page} at ${viewport.width}x${viewport.height}`);
    assert.equal(metrics.active, true, `${target.label} nav should mark its button active at ${viewport.width}x${viewport.height}`);
    assert.equal(metrics.ariaPressed, "true", `${target.label} nav should expose pressed state at ${viewport.width}x${viewport.height}`);
    assert.equal(metrics.hash, target.hash, `${target.label} nav should update the URL hash at ${viewport.width}x${viewport.height}`);
  }

  await page.click("#show-studio-page");
  await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
    timeout: 30_000
  });
}

async function validateDrawerHoverLabels(page: Page): Promise<void> {
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

    await page.click(shortcut.toggle);
    await page.waitForFunction((drawerSelector: string) => {
      return document.querySelector(drawerSelector)?.getAttribute("data-open") === "true";
    }, shortcut.drawer);
  }

  for (let index = 0; index < drawerShortcuts.length; index += 1) {
    const current = drawerShortcuts[index];
    const next = drawerShortcuts[(index + 1) % drawerShortcuts.length];
    if (!current || !next) {
      throw new Error("Drawer click switching needs adjacent drawer shortcuts");
    }
    const currentShortcut: DrawerShortcut = current;
    const nextShortcut: DrawerShortcut = next;

    await ensureDrawerOpen(currentShortcut);

    await page.click(nextShortcut.toggle);
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

  await page.click("#layout-drawer-toggle");
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

  await page.click("#layout-drawer-toggle");
  await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") !== "true");
}

async function validateOutlineDrawer(page: Page, viewport: ViewportSize, port: number): Promise<void> {
  await page.goto(`http://127.0.0.1:${port}/#planning`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const studioPage = document.querySelector("#studio-page") as HTMLElement | null;
    return Boolean(
      studioPage &&
      !studioPage.hidden &&
      window.location.hash === "#studio" &&
      document.querySelector("#outline-drawer")?.getAttribute("data-open") === "true" &&
      document.querySelector("#deck-length-target") &&
      document.querySelector("#outline-plan-list") &&
      !document.querySelector("#show-planning-page") &&
      !document.querySelector("#planning-page")
    );
  }, { timeout: 30_000 });
  await page.waitForTimeout(260);

  const metrics = await page.evaluate(() => {
    const drawer = document.querySelector("#outline-drawer") as HTMLElement | null;
    const panel = document.querySelector("#outline-drawer-panel") as HTMLElement | null;
    const sourceDetails = document.querySelector(".source-details") as HTMLDetailsElement | null;
    const drawerRect = drawer ? drawer.getBoundingClientRect() : null;
    const panelRect = panel ? panel.getBoundingClientRect() : null;
    const rectFor = (selector: string) => {
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
    const sectionSelectors = [
      { label: "panel head", selector: ".outline-drawer-panel-head" },
      { label: "planning", selector: ".outline-drawer-panel .planning-console" },
      { label: "length", selector: ".outline-drawer-panel .deck-length-panel" },
      { label: "deck plans", selector: ".outline-drawer-panel .deck-length-panel + .editorial-block" }
    ];
    const controlSelectors = [
      "#save-deck-context-button",
      "#generate-outline-plan-button",
      "#deck-length-target",
      "#deck-length-mode",
      "#deck-length-plan-button",
      "#deck-length-apply-button",
      "#ideate-deck-structure-button"
    ];
    const planActionGrid = document.querySelector(".outline-plan-card__header .button-row") as HTMLElement | null;
    const planActionGridStyle = planActionGrid ? getComputedStyle(planActionGrid) : null;
    const planActionGridRect = planActionGrid ? planActionGrid.getBoundingClientRect() : null;

    return {
      actionGrid: planActionGridRect && planActionGridStyle ? {
        columnCount: planActionGridStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
        rect: {
          bottom: planActionGridRect.bottom,
          height: planActionGridRect.height,
          left: planActionGridRect.left,
          right: planActionGridRect.right,
          top: planActionGridRect.top,
          width: planActionGridRect.width
        }
      } : null,
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
      controls: controlSelectors.map((selector) => ({
        rect: rectFor(selector),
        selector
      })),
      sections: sectionSelectors.map(({ label, selector }) => ({
        label,
        rect: rectFor(selector)
      })),
      sourceDetailsPresent: Boolean(sourceDetails),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });

  const drawer = requireRect(metrics.drawer, "Outline drawer should open from the legacy planning route");
  const panel = requireRect(metrics.panel, "Outline drawer should expose its planning panel");
  assert.ok(
    drawer.left >= -1 && drawer.right <= metrics.viewportWidth + 1,
    `Outline drawer should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    panel.top >= -1 && panel.bottom <= metrics.viewportHeight + 1,
    `Outline drawer panel should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
  );
  assert.equal(metrics.sourceDetailsPresent, true, "Outline drawer should own the source library controls");
  const sections = metrics.sections.map((section) => ({
    label: section.label,
    rect: requireRect(section.rect, `Outline drawer should render ${section.label}`)
  }));
  assertSectionStack(sections, `Outline drawer sections should stack at ${viewport.width}x${viewport.height}`);
  sections.forEach((section) => {
    assert.ok(section.rect.height > 40, `Outline drawer ${section.label} section should keep natural content height`);
  });
  metrics.controls.forEach((control) => {
    const controlRect = requireRect(control.rect, `Outline drawer should render ${control.selector}`);
    assert.ok(
      controlRect.left >= panel.left - 1 && controlRect.right <= panel.right + 1,
      `Outline drawer control ${control.selector} should stay horizontally inside the panel at ${viewport.width}x${viewport.height}`
    );
  });
  const actionGrid = metrics.actionGrid;
  if (!actionGrid) {
    throw new Error("Outline drawer should render compact outline plan actions");
  }
  assert.ok(
    actionGrid.columnCount >= 3,
    `Outline plan actions should use at least three compact columns at ${viewport.width}x${viewport.height}`
  );
  assert.ok(
    actionGrid.rect.height <= 135,
    `Outline plan actions should stay compact at ${viewport.width}x${viewport.height}; measured ${actionGrid.rect.height.toFixed(1)}px tall`
  );
  assert.ok(
    actionGrid.rect.left >= panel.left - 1 && actionGrid.rect.right <= panel.right + 1,
    `Outline plan actions should stay horizontally inside the panel at ${viewport.width}x${viewport.height}`
  );

  await page.click("#outline-drawer-toggle");
  await page.waitForFunction(() => document.querySelector("#outline-drawer")?.getAttribute("data-open") !== "true");
}

async function runStudioLayoutValidation(options: StudioLayoutValidationOptions = {}): Promise<void> {
  const server = options.server || startServer({ port: 0 });
  const ownsServer = !options.server;

  try {
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;
    assert.ok(port, "studio layout validation needs a local server port");

    const browser = await chromium.launch({ headless: true });

    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          colorScheme: "light",
          deviceScaleFactor: 1,
          viewport
        });

        try {
          const appScriptResponse = await page.request.get(`http://127.0.0.1:${port}/app.js`);
          assert.equal(appScriptResponse.ok(), true, "Studio app script should be served to Playwright");
          assert.match(
            appScriptResponse.headers()["cache-control"] || "",
            /no-store/i,
            "Studio app script should bypass browser cache so Chrome does not keep stale layout code"
          );
          await page.addInitScript(() => {
            window.localStorage.removeItem("studio.assistantDrawerOpen");
            window.localStorage.removeItem("studio.contextDrawerOpen");
            window.localStorage.removeItem("studio.structuredDraftDrawerOpen");
            window.localStorage.removeItem("studio.currentPage");
            window.localStorage.removeItem("studio.appTheme");
          });
          await page.goto(`http://127.0.0.1:${port}/#studio`, { waitUntil: "domcontentloaded" });
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          const standaloneLayoutNavPresent = await page.locator("#show-layout-studio-page, #layout-studio-page").count();
          assert.equal(standaloneLayoutNavPresent, 0, "Layout Studio should be integrated into the Slide Studio layout drawer");
          await validateDrawerHoverLabels(page);
          await validateDrawerClickSwitching(page, viewport);
          await validateDrawerKeyboardShortcuts(page, viewport);
          await validateLayoutDrawerDoesNotSqueezeWorkspace(page, viewport);
          await validateOutlineDrawer(page, viewport, port);
          await page.goto(`http://127.0.0.1:${port}/#layout-studio`, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => {
            const studioPage = document.querySelector("#studio-page") as HTMLElement | null;
            return Boolean(
              studioPage &&
              !studioPage.hidden &&
              document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true" &&
              document.querySelector("#layout-studio-list")
            );
          });
          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") !== "true");
          await page.evaluate(() => {
            const url = new URL(window.location.href);
            url.hash = "#studio";
            window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
          });
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          const contentSlideSelected = await page.evaluate(() => {
            const contentThumb = Array.from(document.querySelectorAll("#thumb-rail .thumb"))
              .find((button) => button.querySelector(".dom-slide--content")) as HTMLButtonElement | undefined;
            if (!contentThumb) {
              return false;
            }
            contentThumb.click();
            return true;
          });
          assert.equal(contentSlideSelected, true, "Studio validation needs a content slide for custom layout preview checks");
          await page.waitForSelector("#active-preview .dom-slide--content", {
            timeout: 30_000
          });
          await page.waitForTimeout(250);
          const selectedSlideUrlMetrics = await page.evaluate(() => {
            const selectedThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
            const selectedSlideId = selectedThumb?.dataset.slideId || "";
            return {
              selectedSlideId,
              urlSlideId: new URLSearchParams(window.location.search).get("slide") || ""
            };
          });
          assert.ok(selectedSlideUrlMetrics.selectedSlideId, "Studio validation needs an active thumbnail with a slide id");
          assert.equal(selectedSlideUrlMetrics.urlSlideId, selectedSlideUrlMetrics.selectedSlideId, "Selecting a slide should persist it in the URL query");
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForFunction((slideId: string) => {
            const selectedThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
            return selectedThumb?.dataset.slideId === slideId;
          }, selectedSlideUrlMetrics.selectedSlideId, { timeout: 30_000 });
          await validateMastheadPageNavigation(page, viewport);
          const preservedQuerySlideId = await page.evaluate(() => new URLSearchParams(window.location.search).get("slide") || "");
          assert.equal(preservedQuerySlideId, selectedSlideUrlMetrics.selectedSlideId, "Studio page navigation should preserve the selected slide query");

          const metrics = await page.evaluate(() => {
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
              checksButton: rectFor("#show-validation-page"),
              currentSlideLabel: rectFor("#selected-slide-label"),
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              appTheme: document.documentElement.dataset.appTheme,
              llmButton: rectFor("#show-llm-diagnostics"),
              llmPopoverHidden: (document.querySelector("#llm-status-popover") as HTMLElement | null)?.hidden,
              llmStatus: document.querySelector("#llm-nav-status")?.textContent || "",
              llmState: document.querySelector("#llm-nav-status")?.getAttribute("data-state") || "",
              previewFrame: rectFor(".preview-frame"),
              studioWorkbench: rectFor(".studio-inline-workbench"),
              variantPanel: rectFor("#variant-generation-panel"),
              variantTabsPresent: Boolean(document.querySelector(".studio-tabs, #show-current-slide-tab, #show-variant-generation-tab")),
              workflowStatus: rectFor("#operation-status"),
              workflowStatusInDebug: Boolean(document.querySelector("#debug-drawer #operation-status")),
              workflowStatusInMainPanel: Boolean(document.querySelector("#variant-generation-panel #operation-status")),
              inlineDebugPresent: Boolean(document.querySelector("#variant-generation-panel .workflow-debug-panel")),
              debugDrawerHidden: (document.querySelector("#debug-drawer") as HTMLElement | null)?.hidden,
              debugDrawerOpen: document.querySelector("#debug-drawer")?.getAttribute("data-open"),
              themeLabel: document.querySelector("#theme-toggle-label")?.textContent || "",
              themePressed: document.querySelector("#theme-toggle")?.getAttribute("aria-pressed"),
              themeToggle: rectFor("#theme-toggle"),
              thumbRail: rectFor(".thumb-rail"),
              thumbTextVisible: Array.from(document.querySelectorAll(".thumb strong, .thumb span:not(.thumb-index)")).some((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();

                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 2 && rect.height > 2;
              }),
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth
            };
          });

          assert.ok(
            metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
            `Slide Studio should not create horizontal page overflow at ${viewport.width}x${viewport.height} (${metrics.documentScrollWidth}px > ${metrics.documentClientWidth}px)`
          );
          assert.equal(metrics.appTheme, "light", "Studio should default to light theme in a light browser context");
          assert.equal(metrics.themeLabel, "Light", "Theme toggle should show the current light theme");
          assert.equal(metrics.themePressed, "false", "Theme toggle should expose its inactive pressed state in light mode");
          const themeToggle = requireRect(metrics.themeToggle, "Studio should expose an app theme toggle in the masthead");
          const currentSlideLabel = requireRect(metrics.currentSlideLabel, "Studio should expose the current slide label in the Studio workspace");
          if (viewport.width > 1180) {
            assert.ok(
              currentSlideLabel.width <= 2 && currentSlideLabel.height <= 2,
              `Current slide label should be visually hidden without leaving the accessibility tree at ${viewport.width}x${viewport.height}`
            );
          }
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

          await page.click("#theme-drawer-toggle");
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
          await page.click("#theme-drawer-toggle");
          await page.waitForFunction(() => document.querySelector("#theme-drawer")?.getAttribute("data-open") === "false");
          await page.waitForTimeout(260);

          const previewFrame = requireRect(metrics.previewFrame, "Slide Studio should render the active preview frame");
          assert.ok(metrics.workflowStatus, "Slide Studio should keep live workflow status available in diagnostics");
          assert.equal(metrics.workflowStatusInDebug, true, "Live workflow status should live in the Debug drawer");
          assert.equal(metrics.workflowStatusInMainPanel, false, "Live workflow status should not occupy the main variant panel");
          assert.equal(metrics.inlineDebugPresent, false, "Generation diagnostics should live in the Debug drawer instead of the inline variant panel");
          assert.equal(metrics.debugDrawerHidden, false, "Debug drawer should be available on the Studio page");
          assert.equal(metrics.debugDrawerOpen, "false", "Debug drawer should start collapsed by default");
          assert.ok(
            previewFrame.bottom <= metrics.viewportHeight + 1,
            `Active slide preview should fit in the first viewport at ${viewport.width}x${viewport.height} (bottom ${previewFrame.bottom.toFixed(1)}px > viewport ${metrics.viewportHeight}px)`
          );
          const studioWorkbench = requireRect(metrics.studioWorkbench, "Slide Studio should expose a unified current-slide workbench");
          assert.ok(
            studioWorkbench.right <= metrics.viewportWidth + 1,
            `Slide Studio workbench should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.equal(metrics.variantTabsPresent, false, "Slide Studio should remove the Current/Variant tab switcher");
          assert.ok(metrics.variantPanel, "Inline variant controls should be present in the current-slide workbench");

          const initialWorkbenchMetrics = await page.evaluate(() => ({
            contextAriaExpanded: document.querySelector("#context-drawer-toggle")?.getAttribute("aria-expanded"),
            contextDrawerHidden: (document.querySelector("#context-drawer") as HTMLElement | null)?.hidden,
            contextInsideCurrentPanel: Boolean(document.querySelector("#current-slide-panel #slide-context-panel")),
            contextPanelPresent: Boolean(document.querySelector("#context-drawer #slide-context-panel")),
            contextTabIcon: Boolean(document.querySelector("#context-drawer-toggle .drawer-toggle-icon")),
            drawerToggleAriaLabels: Array.from(document.querySelectorAll("#context-drawer-toggle, #layout-drawer-toggle, #debug-drawer-toggle, #structured-draft-toggle, #theme-drawer-toggle, #assistant-toggle"))
              .map((button) => button.getAttribute("aria-label") || ""),
            drawerToggleIconCount: document.querySelectorAll("#context-drawer-toggle .drawer-toggle-icon, #layout-drawer-toggle .drawer-toggle-icon, #debug-drawer-toggle .drawer-toggle-icon, #structured-draft-toggle .drawer-toggle-icon, #theme-drawer-toggle .drawer-toggle-icon, #assistant-toggle .drawer-toggle-icon").length,
            drawerToggleMinRight: Math.min(
              ...Array.from(document.querySelectorAll("#context-drawer-toggle, #layout-drawer-toggle, #debug-drawer-toggle, #structured-draft-toggle, #theme-drawer-toggle, #assistant-toggle"))
                .map((button) => button.getBoundingClientRect().right)
            ),
            drawerToggleMaxHeight: Math.max(
              ...Array.from(document.querySelectorAll("#context-drawer-toggle, #layout-drawer-toggle, #debug-drawer-toggle, #structured-draft-toggle, #theme-drawer-toggle, #assistant-toggle"))
                .map((button) => button.getBoundingClientRect().height)
            ),
            manualDeleteInOperations: Boolean(document.querySelector(".slide-operations-panel .manual-delete-details")),
            manualSystemInOperations: Boolean(document.querySelector(".slide-operations-panel .manual-system-details")),
            operationPanelWidth: document.querySelector(".slide-operations-panel")?.getBoundingClientRect().width || 0,
            operationDisclosureWidths: Array.from(document.querySelectorAll(".slide-operations-panel > details"))
              .map((details) => details.getBoundingClientRect().width),
            slideRailAddButton: Boolean(document.querySelector(".slide-rail-head #open-manual-system-button")),
            slideRailDeleteButton: Boolean(document.querySelector(".slide-rail-head #open-manual-delete-button")),
            slideRailReorderButton: Boolean(document.querySelector(".slide-rail-head #open-slide-reorder-button")),
            currentHidden: (document.querySelector("#current-slide-panel") as HTMLElement | null)?.hidden,
            legacyContextTabPresent: Boolean(document.querySelector("#show-slide-context-tab")),
            variantControlsHidden: (document.querySelector("#variant-generation-panel") as HTMLElement | null)?.hidden,
            variantDetailsOpen: (document.querySelector(".variant-generation-details") as HTMLDetailsElement | null)?.open,
            variantRailDisplay: window.getComputedStyle(document.querySelector(".variant-rail-panel") as HTMLElement).display
          }));
          assert.equal(initialWorkbenchMetrics.legacyContextTabPresent, false, "Slide context should not return as a separate studio tab");
          assert.equal(initialWorkbenchMetrics.contextDrawerHidden, false, "Slide context drawer should be available on the Studio page");
          assert.equal(initialWorkbenchMetrics.contextPanelPresent, true, "Slide context should live in the left Context drawer");
          assert.equal(initialWorkbenchMetrics.contextInsideCurrentPanel, false, "Slide context should not remain inside the Current slide panel");
          assert.equal(initialWorkbenchMetrics.contextAriaExpanded, "false", "Context drawer should start collapsed by default");
          assert.equal(initialWorkbenchMetrics.manualSystemInOperations, false, "Add slide controls should not render as a full-width operations panel");
          assert.equal(initialWorkbenchMetrics.manualDeleteInOperations, false, "Remove slide controls should not render as a full-width operations panel");
          assert.equal(initialWorkbenchMetrics.slideRailAddButton, true, "Slide rail should expose a compact add-slide control");
          assert.equal(initialWorkbenchMetrics.slideRailDeleteButton, true, "Slide rail should expose a compact remove-slide control");
          assert.equal(initialWorkbenchMetrics.slideRailReorderButton, true, "Slide rail should expose a compact reorder control");
          assert.equal(initialWorkbenchMetrics.contextTabIcon, true, "Context drawer should expose an icon on the left rail");
          assert.equal(initialWorkbenchMetrics.drawerToggleIconCount, 6, "Studio drawers should use icons instead of obscure rail abbreviations");
          assert.deepEqual(
            initialWorkbenchMetrics.drawerToggleAriaLabels,
            [
              "Open theme control",
              "Open slide context",
              "Open layout controls",
              "Open generation diagnostics",
              "Open structured draft editor",
              "Open workflow assistant"
            ],
            "Studio drawer icons should keep descriptive accessible labels"
          );
          assert.ok(
            initialWorkbenchMetrics.drawerToggleMaxHeight <= 60,
            `Studio drawer rail controls should stay compact at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            initialWorkbenchMetrics.drawerToggleMinRight >= metrics.viewportWidth - 1,
            `Studio drawer rail controls should sit on the right viewport edge at ${viewport.width}x${viewport.height}`
          );
          initialWorkbenchMetrics.operationDisclosureWidths.forEach((width: number, index: number) => {
            assert.ok(
              width >= initialWorkbenchMetrics.operationPanelWidth - 2,
              `Slide operation disclosure ${index + 1} should take the full operations panel width at ${viewport.width}x${viewport.height}`
            );
          });
          await page.click("#open-manual-system-button");
          await page.waitForFunction(() => Boolean((document.querySelector("#manual-system-details") as HTMLDetailsElement | null)?.open));
          const manualSystemPlacementMetrics = await page.evaluate(() => ({
            afterValue: (document.querySelector("#manual-system-after") as HTMLSelectElement | null)?.value || "",
            deleteOpen: Boolean((document.querySelector("#manual-delete-details") as HTMLDetailsElement | null)?.open),
            reference: document.querySelector("#manual-system-reference")?.textContent || "",
            systemExpanded: document.querySelector("#open-manual-system-button")?.getAttribute("aria-expanded"),
            titleFocused: document.activeElement?.id === "manual-system-title"
          }));
          assert.equal(manualSystemPlacementMetrics.deleteOpen, false, "Opening compact add-slide controls should keep remove controls closed");
          assert.equal(manualSystemPlacementMetrics.systemExpanded, "true", "Compact add-slide control should expose expanded state");
          assert.equal(manualSystemPlacementMetrics.titleFocused, true, "Opening compact add-slide controls should focus the title field");
          assert.ok(manualSystemPlacementMetrics.afterValue, "Compact add-slide controls should default insertion after the selected slide");
          assert.match(manualSystemPlacementMetrics.reference, /inserted after/i, "Compact add-slide controls should explain the current-slide insertion point");
          const manualSystemScrollMetrics = await page.evaluate(() => {
            const details = document.querySelector("#manual-system-details") as HTMLElement | null;
            const createButton = document.querySelector("#create-system-slide-button") as HTMLElement | null;
            if (!details || !createButton) {
              return null;
            }
            details.scrollTop = details.scrollHeight;
            const detailsRect = details.getBoundingClientRect();
            const buttonRect = createButton.getBoundingClientRect();
            return {
              buttonBottom: buttonRect.bottom,
              buttonTop: buttonRect.top,
              detailsBottom: detailsRect.bottom,
              detailsTop: detailsRect.top,
              viewportBottom: window.innerHeight
            };
          });
          if (!manualSystemScrollMetrics) {
            throw new Error("Manual add-slide form should render with a visible create button");
          }
          assert.ok(
            manualSystemScrollMetrics.detailsBottom <= manualSystemScrollMetrics.viewportBottom + 1,
            `Manual add-slide form should fit within the visible viewport at ${viewport.width}x${viewport.height}: ${JSON.stringify(manualSystemScrollMetrics)}`
          );
          assert.ok(
            manualSystemScrollMetrics.buttonTop >= manualSystemScrollMetrics.detailsTop
              && manualSystemScrollMetrics.buttonBottom <= manualSystemScrollMetrics.detailsBottom + 1,
            `Manual add-slide form should keep the create action reachable after scrolling at ${viewport.width}x${viewport.height}`
          );
          await page.click("#open-manual-delete-button");
          await page.waitForFunction(() => Boolean((document.querySelector("#manual-delete-details") as HTMLDetailsElement | null)?.open));
          const manualDeletePlacementMetrics = await page.evaluate(() => ({
            deleteExpanded: document.querySelector("#open-manual-delete-button")?.getAttribute("aria-expanded"),
            deleteButtonFocused: document.activeElement?.id === "delete-slide-button",
            reference: document.querySelector("#manual-delete-reference")?.textContent || "",
            selectedDeleteValue: (document.querySelector("#manual-delete-slide") as HTMLSelectElement | null)?.value || "",
            systemOpen: Boolean((document.querySelector("#manual-system-details") as HTMLDetailsElement | null)?.open)
          }));
          assert.equal(manualDeletePlacementMetrics.systemOpen, false, "Opening compact remove-slide controls should close add-slide controls");
          assert.equal(manualDeletePlacementMetrics.deleteExpanded, "true", "Compact remove-slide control should expose expanded state");
          assert.equal(manualDeletePlacementMetrics.deleteButtonFocused, true, "Opening compact remove-slide controls should focus the confirmation action");
          assert.ok(manualDeletePlacementMetrics.selectedDeleteValue, "Compact remove-slide controls should target the selected slide");
          assert.match(manualDeletePlacementMetrics.reference, /Ready to remove/i, "Compact remove-slide controls should identify the current slide");
          await page.click("#open-manual-delete-button");
          await page.waitForFunction(() => !((document.querySelector("#manual-delete-details") as HTMLDetailsElement | null)?.open));
          await page.click("#open-slide-reorder-button");
          await page.waitForFunction(() => Boolean((document.querySelector("#slide-reorder-dialog") as HTMLDialogElement | null)?.open));
          const reorderModalMetrics = await page.evaluate(() => ({
            applyPresent: Boolean(document.querySelector("#apply-slide-reorder-button")),
            itemCount: document.querySelectorAll("#slide-reorder-list .slide-reorder-item").length,
            selectedMarked: Boolean(document.querySelector("#slide-reorder-list .slide-reorder-item.active"))
          }));
          assert.equal(reorderModalMetrics.applyPresent, true, "Slide reorder modal should require explicit apply");
          assert.ok(reorderModalMetrics.itemCount >= 1, "Slide reorder modal should list current slides");
          assert.equal(reorderModalMetrics.selectedMarked, true, "Slide reorder modal should mark the selected slide");
          await page.click("#cancel-slide-reorder-button");
          await page.waitForFunction(() => !((document.querySelector("#slide-reorder-dialog") as HTMLDialogElement | null)?.open));
          assert.equal(initialWorkbenchMetrics.currentHidden, false, "Current slide panel should be visible by default");
          assert.equal(initialWorkbenchMetrics.variantControlsHidden, false, "Variant controls should be inline, not hidden in a separate tab panel");
          assert.equal(initialWorkbenchMetrics.variantDetailsOpen, false, "Variant generation controls should start collapsed behind a compact action");
          assert.equal(initialWorkbenchMetrics.variantRailDisplay, "none", "Variant rail should stay hidden until candidates exist");

          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });

          const savedLayoutPlacementMetrics = await page.evaluate(() => ({
            libraryInDrawer: Boolean(document.querySelector("#layout-drawer .layout-library-details")),
            libraryInOperations: Boolean(document.querySelector(".slide-operations-panel .layout-library-details"))
          }));
          assert.equal(savedLayoutPlacementMetrics.libraryInOperations, false, "Saved layouts should not render as a separate slide operation panel");
          assert.equal(savedLayoutPlacementMetrics.libraryInDrawer, true, "Saved layout management should live in the Layout drawer");

          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
          const initialCustomLayoutMetrics = await page.evaluate(() => ({
            activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
            jsonOpen: Boolean((document.querySelector(".custom-layout-json-details") as HTMLDetailsElement | null)?.open),
            layoutDrawerOpen: document.querySelector("#layout-drawer")?.getAttribute("data-open"),
            mapHidden: (document.querySelector("#custom-layout-live-map") as HTMLElement | null)?.hidden,
            slidePreviewHasCustomGrid: Boolean(document.querySelector("#custom-layout-live-preview .dom-slide__custom-layout-grid")),
            slideTabSelected: document.querySelector("#custom-layout-preview-slide-tab")?.getAttribute("aria-selected"),
            validationState: (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || "",
            validationText: document.querySelector("#custom-layout-validation")?.textContent || ""
          }));
          assert.equal(initialCustomLayoutMetrics.layoutDrawerOpen, "true", "Layout drawer should open from the left rail");
          assert.equal(initialCustomLayoutMetrics.activePreviewHasCustomGrid, false, "Opening the layout drawer should preserve the current saved slide");
          assert.equal(initialCustomLayoutMetrics.slidePreviewHasCustomGrid, true, "Custom layout editor should show a current-slide preview by default");
          assert.equal(initialCustomLayoutMetrics.mapHidden, true, "Abstract layout map should stay hidden by default");
          assert.equal(initialCustomLayoutMetrics.jsonOpen, false, "Custom layout JSON should stay behind advanced disclosure by default");
          assert.equal(initialCustomLayoutMetrics.slideTabSelected, "true", "Current-slide custom layout preview tab should be selected by default");
          assert.equal(initialCustomLayoutMetrics.validationState, "draft-unchecked", "Custom layout validation should start in an unchecked draft state");
          assert.match(initialCustomLayoutMetrics.validationText, /Draft unchecked/, "Custom layout validation should name the unchecked state");

          await page.selectOption("#custom-layout-profile", "lead-sidebar");
          await page.waitForFunction(() => {
            const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
            return source.includes("\"sidebar\"");
          });
          const adjustedCustomLayoutMetrics = await page.evaluate(() => ({
            activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
            json: (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "",
            status: document.querySelector("#custom-layout-status")?.textContent || "",
            validationState: (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || ""
          }));
          assert.equal(adjustedCustomLayoutMetrics.activePreviewHasCustomGrid, true, "Changing layout options should keep the active slide in live custom preview");
          assert.match(adjustedCustomLayoutMetrics.json, /"sidebar"/, "Changing layout options should update the generated layout definition");
          assert.equal(adjustedCustomLayoutMetrics.status, "Live preview", "Changing layout options should mark the custom layout as a live preview");
          assert.equal(adjustedCustomLayoutMetrics.validationState, "draft-unchecked", "Changing layout options should mark validation as stale until previewed");

          await page.click("#custom-layout-preview-button");
          await page.waitForFunction(() => {
            const state = (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || "";
            return Boolean(state && state !== "draft-unchecked");
          });
          const validatedCustomLayoutMetrics = await page.evaluate(() => ({
            status: document.querySelector("#custom-layout-status")?.textContent || "",
            validationState: (document.querySelector("#custom-layout-validation") as HTMLElement | null)?.dataset.state || "",
            validationText: document.querySelector("#custom-layout-validation")?.textContent || ""
          }));
          assert.equal(validatedCustomLayoutMetrics.status, "Previewable", "Validating a custom layout should create a preview candidate");
          assert.match(
            validatedCustomLayoutMetrics.validationState,
            /^(looks-good|needs-attention|blocked)$/,
            "Validating a custom layout should return current-slide validation state"
          );
          assert.doesNotMatch(validatedCustomLayoutMetrics.validationText, /Draft unchecked/, "Previewed layout should replace the unchecked validation copy");

          await page.selectOption("#custom-layout-profile", "stacked-sequence");
          await page.waitForFunction(() => {
            const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
            return source.includes("\"stacked-sequence\"") || source.includes("\"column\": 7");
          });
          const stackedLayoutMetrics = await page.evaluate(() => {
            const regions = Array.from(document.querySelectorAll("#active-preview .dom-slide__custom-layout-region")) as HTMLElement[];
            return {
              clippedRegions: regions
                .map((region) => ({
                  className: region.className,
                  clientHeight: region.clientHeight,
                  scrollHeight: region.scrollHeight
                }))
                .filter((region) => region.scrollHeight > region.clientHeight + 2),
              panelCount: document.querySelectorAll("#active-preview .dom-slide__custom-layout-region .dom-panel").length
            };
          });
          assert.equal(stackedLayoutMetrics.panelCount, 2, "Stacked sequence should render two readable body panels");
          assert.deepEqual(stackedLayoutMetrics.clippedRegions, [], "Stacked sequence should not clip custom layout regions");

          await page.click("#custom-layout-preview-map-tab");
          await page.waitForFunction(() => {
            const map = document.querySelector("#custom-layout-live-map") as HTMLElement | null;
            return Boolean(map && !map.hidden && map.querySelector(".layout-studio-region"));
          });
          const mapTabMetrics = await page.evaluate(() => ({
            activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
            mapHidden: (document.querySelector("#custom-layout-live-map") as HTMLElement | null)?.hidden,
            mapTabSelected: document.querySelector("#custom-layout-preview-map-tab")?.getAttribute("aria-selected"),
            slideHidden: (document.querySelector("#custom-layout-live-preview") as HTMLElement | null)?.hidden
          }));
          assert.equal(mapTabMetrics.activePreviewHasCustomGrid, true, "Opening the abstract layout map should not stop current-slide live preview");
          assert.equal(mapTabMetrics.mapHidden, false, "Layout map tab should reveal the abstract region map");
          assert.equal(mapTabMetrics.slideHidden, true, "Layout map tab should hide the small current-slide preview");
          assert.equal(mapTabMetrics.mapTabSelected, "true", "Layout map tab should expose selected state");

          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => !document.querySelector("#active-preview .dom-slide__custom-layout-grid"));
          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
          const reopenedLayoutMetrics = await page.evaluate(() => ({
            activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
            status: document.querySelector("#custom-layout-status")?.textContent || ""
          }));
          assert.equal(reopenedLayoutMetrics.activePreviewHasCustomGrid, false, "Reopening layout controls should return to inactive editing mode");
          assert.equal(reopenedLayoutMetrics.status, "Draft", "Reopening layout controls should label the draft as inactive");
          await page.selectOption("#custom-layout-spacing", "loose");
          await page.waitForFunction(() => {
            const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
            return Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid") && source.includes("\"spacing\": \"loose\""));
          });
          const reactivatedLayoutMetrics = await page.evaluate(() => ({
            activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
            loosePanelPadding: window.getComputedStyle(document.querySelector("#active-preview .dom-slide__custom-layout-region--loose .dom-panel") as Element).paddingTop,
            status: document.querySelector("#custom-layout-status")?.textContent || ""
          }));
          assert.equal(reactivatedLayoutMetrics.activePreviewHasCustomGrid, true, "Changing a setting after reopening should reactivate main-slide preview");
          assert.equal(reactivatedLayoutMetrics.loosePanelPadding, "22px", "Changing custom layout spacing should visibly update panel spacing in the live preview");
          assert.equal(reactivatedLayoutMetrics.status, "Live preview", "Changing a setting after reopening should restore live preview status");
          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => !document.querySelector("#active-preview .dom-slide__custom-layout-grid"));

          const coverSlideSelected = await page.evaluate(() => {
            const coverThumb = Array.from(document.querySelectorAll("#thumb-rail .thumb"))
              .find((button) => button.querySelector(".dom-slide--cover")) as HTMLButtonElement | undefined;
            if (!coverThumb) {
              return false;
            }
            coverThumb.click();
            return true;
          });
          assert.equal(coverSlideSelected, true, "Studio validation needs a cover slide for title layout preview checks");
          await page.waitForSelector("#active-preview .dom-slide--cover", {
            timeout: 30_000
          });
          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => document.querySelector("#layout-drawer")?.getAttribute("data-open") === "true");
          const coverDrawerOpenMetrics = await page.evaluate(() => ({
            activePreviewHasCustomGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid")),
            activeSlideLayout: document.querySelector("#active-preview .dom-slide")?.getAttribute("data-slide-layout") || "",
            treatmentValue: (document.querySelector("#custom-layout-treatment") as HTMLSelectElement | null)?.value || ""
          }));
          assert.equal(coverDrawerOpenMetrics.activePreviewHasCustomGrid, false, "Opening layout controls on a cover slide should preserve the saved title layout");
          assert.equal(
            coverDrawerOpenMetrics.treatmentValue,
            coverDrawerOpenMetrics.activeSlideLayout || "standard",
            "Opening layout controls on a cover slide should initialize treatment from the selected title slide"
          );
          const defaultCoverJsonBeforeTreatment = await page.locator("#custom-layout-json").inputValue();
          const initialCoverTreatment = coverDrawerOpenMetrics.treatmentValue || "standard";
          const alternateCoverTreatment = initialCoverTreatment === "focus" ? "callout" : "focus";
          await page.selectOption("#custom-layout-treatment", alternateCoverTreatment);
          await page.waitForFunction((treatment: string) => {
            const slide = document.querySelector("#active-preview .dom-slide");
            return Boolean(
              slide?.classList.contains(`dom-slide--layout-${treatment}`) &&
              slide.getAttribute("data-slide-layout") === treatment &&
              !document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")
            );
          }, alternateCoverTreatment);
          const nativeCoverTreatmentMetrics = await page.evaluate((treatment: string) => {
            const copy = document.querySelector("#active-preview .dom-slide__cover-copy") as HTMLElement | null;
            const note = document.querySelector("#active-preview .dom-slide__cover-note") as HTMLElement | null;
            const copyStyle = copy ? window.getComputedStyle(copy) : null;
            const noteStyle = note ? window.getComputedStyle(note) : null;

            return {
              borderLeftWidth: copyStyle ? Number.parseFloat(copyStyle.borderLeftWidth || "0") : 0,
              copyBackground: copyStyle ? copyStyle.backgroundColor : "",
              noteBackground: noteStyle ? noteStyle.backgroundColor : "",
              treatment
            };
          }, alternateCoverTreatment);
          if (alternateCoverTreatment === "focus") {
            assert.ok(
              nativeCoverTreatmentMetrics.borderLeftWidth >= 6,
              "Focus treatment should visibly restyle the native title-slide renderer"
            );
          }
          if (alternateCoverTreatment === "callout") {
            assert.notEqual(
              nativeCoverTreatmentMetrics.copyBackground,
              "rgba(0, 0, 0, 0)",
              "Callout treatment should visibly restyle the native title-slide renderer"
            );
          }
          await page.selectOption("#custom-layout-treatment", initialCoverTreatment);
          await page.waitForFunction(({ initialTreatment, alternateTreatment }: { alternateTreatment: string; initialTreatment: string }) => {
            const slide = document.querySelector("#active-preview .dom-slide");
            return Boolean(
              slide?.classList.contains(`dom-slide--layout-${initialTreatment}`) &&
              !slide.classList.contains(`dom-slide--layout-${alternateTreatment}`) &&
              slide.getAttribute("data-slide-layout") === initialTreatment &&
              !document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")
            );
          }, { initialTreatment: initialCoverTreatment, alternateTreatment: alternateCoverTreatment });
          const defaultCoverTreatmentMetrics = await page.evaluate(() => {
            const regions = Array.from(document.querySelectorAll("#active-preview .dom-slide__custom-layout-region")) as HTMLElement[];
            const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";

            return {
              clippedRegions: regions
                .map((region) => ({
                  className: region.className,
                  clientHeight: region.clientHeight,
                  scrollHeight: region.scrollHeight
                }))
                .filter((region) => region.scrollHeight > region.clientHeight + 2),
              hasCoverGrid: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")),
              hasNativeCoverGrid: Boolean(document.querySelector("#active-preview .dom-slide__cover-grid")),
              json: source
            };
          });
          assert.equal(defaultCoverTreatmentMetrics.hasCoverGrid, false, "Treatment-only cover changes should not force the custom layout renderer");
          assert.equal(defaultCoverTreatmentMetrics.hasNativeCoverGrid, true, "Treatment-only cover changes should keep the native title-slide renderer");
          assert.equal(
            defaultCoverTreatmentMetrics.json,
            defaultCoverJsonBeforeTreatment,
            "Default to another cover treatment and back should not rewrite the current layout definition draft"
          );
          assert.deepEqual(
            defaultCoverTreatmentMetrics.clippedRegions,
            [],
            "Default cover treatment should not clip title-slide layout regions after toggling treatment"
          );
          await page.selectOption("#custom-layout-profile", "lead-sidebar");
          await page.waitForFunction(() => Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-grid--cover")));
          const coverJsonBeforeTreatment = await page.locator("#custom-layout-json").inputValue();
          await page.selectOption("#custom-layout-treatment", "focus");
          await page.waitForFunction(() => document.querySelector("#active-preview .dom-slide")?.classList.contains("dom-slide--layout-focus"));
          await page.selectOption("#custom-layout-treatment", "callout");
          await page.waitForFunction(() => document.querySelector("#active-preview .dom-slide")?.classList.contains("dom-slide--layout-callout"));
          await page.selectOption("#custom-layout-treatment", "standard");
          await page.waitForFunction(() => {
            const slide = document.querySelector("#active-preview .dom-slide");
            return Boolean(
              slide?.classList.contains("dom-slide--layout-standard") &&
              !slide.classList.contains("dom-slide--layout-callout") &&
              slide.getAttribute("data-slide-layout") === "standard"
            );
          });
          const coverLayoutMetrics = await page.evaluate(() => {
            const regions = Array.from(document.querySelectorAll("#active-preview .dom-slide__custom-layout-region")) as HTMLElement[];
            const source = (document.querySelector("#custom-layout-json") as HTMLTextAreaElement | null)?.value || "";
            const titleRegion = document.querySelector("#active-preview .dom-slide__custom-layout-region--title") as HTMLElement | null;
            return {
              clippedRegions: regions
                .map((region) => ({
                  className: region.className,
                  clientHeight: region.clientHeight,
                  scrollHeight: region.scrollHeight
                }))
                .filter((region) => region.scrollHeight > region.clientHeight + 2),
              hasCards: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-region--cards .dom-card")),
              hasNote: Boolean(document.querySelector("#active-preview .dom-slide__custom-layout-region--note")),
              json: source
            };
          });
          assert.equal(coverLayoutMetrics.json, coverJsonBeforeTreatment, "Changing cover treatment should not discard the current layout definition draft");
          assert.match(coverLayoutMetrics.json, /"cards"/, "Cover layout definitions should include the cards slot");
          assert.match(coverLayoutMetrics.json, /"note"/, "Cover layout definitions should include the note slot");
          assert.equal(coverLayoutMetrics.hasCards, true, "Cover layout preview should render cover cards");
          assert.equal(coverLayoutMetrics.hasNote, true, "Cover layout preview should render the cover note");
          assert.deepEqual(coverLayoutMetrics.clippedRegions, [], "Cover layout preview should not clip custom layout regions");
          await page.click("#layout-drawer-toggle");
          await page.waitForFunction(() => !document.querySelector("#active-preview .dom-slide__custom-layout-grid"));

          const thumbRail = requireRect(metrics.thumbRail, "Slide Studio should render the thumbnail rail");
          assert.ok(
            thumbRail.width <= metrics.viewportWidth + 1,
            `Thumbnail rail should stay within the page viewport at ${viewport.width}x${viewport.height} (${thumbRail.width.toFixed(1)}px > ${metrics.viewportWidth}px)`
          );
          if (viewport.width > 760) {
            assert.ok(
              thumbRail.height <= metrics.viewportHeight,
              `Desktop thumbnail rail should stay within the viewport at ${viewport.width}x${viewport.height} (${thumbRail.height.toFixed(1)}px > ${metrics.viewportHeight}px)`
            );
          } else {
            assert.ok(
              thumbRail.height <= 112,
              `Mobile thumbnail rail should stay compact at ${viewport.width}x${viewport.height} (${thumbRail.height.toFixed(1)}px > 112px)`
            );
          }
          assert.equal(metrics.thumbTextVisible, false, "Thumbnail rail should not expose title or file labels that can clip");

          assert.ok(metrics.checksButton, "Slide Studio should expose deck checks from the masthead");
          const llmButton = requireRect(metrics.llmButton, "Slide Studio should expose LLM status from the masthead");
          assert.ok(metrics.llmStatus.trim().length > 0, "LLM status should show a compact masthead label");
          assert.match(metrics.llmState, /^(idle|ok|warn)$/, "LLM status should expose a known visual state");
          assert.ok(
            llmButton.right <= metrics.viewportWidth + 1,
            `LLM status should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          await page.click("#show-llm-diagnostics");
          await page.waitForFunction(() => {
            const popover = document.querySelector("#llm-status-popover") as HTMLElement | null;
            return Boolean(popover && !popover.hidden);
          });
          const llmPopoverMetrics = await page.evaluate(() => {
            const popover = document.querySelector("#llm-status-popover") as HTMLElement | null;
            const button = document.querySelector("#show-llm-diagnostics");
            const rect = popover ? popover.getBoundingClientRect() : null;

            return {
              ariaExpanded: button?.getAttribute("aria-expanded") || "",
              hidden: popover ? popover.hidden : true,
              right: rect ? rect.right : 0,
              width: rect ? rect.width : 0
            };
          });
          assert.equal(llmPopoverMetrics.hidden, false, "LLM status should open an in-place popover");
          assert.equal(llmPopoverMetrics.ariaExpanded, "true", "LLM status button should expose popover state");
          assert.ok(llmPopoverMetrics.width > 0, "LLM popover should have visible width");
          assert.ok(
            llmPopoverMetrics.right <= metrics.viewportWidth + 1,
            `LLM popover should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          await page.click("#assistant-toggle");
          await page.waitForFunction(() => {
            const drawer = document.querySelector("#assistant-drawer") as HTMLElement | null;
            return Boolean(drawer && drawer.dataset.open === "true" && drawer.getBoundingClientRect().right <= window.innerWidth + 1);
          });
          const assistantChatMetrics = await page.evaluate(() => {
            const drawer = document.querySelector("#assistant-drawer");
            const drawerRect = drawer ? drawer.getBoundingClientRect() : null;

            return {
              chatHidden: (document.querySelector("#assistant-chat-panel") as HTMLElement | null)?.hidden,
              drawerRight: drawerRect ? drawerRect.right : 0,
              drawerOpen: drawer ? (drawer as HTMLElement).dataset.open : "",
              logTabPresent: Boolean(document.querySelector("#show-assistant-log-tab, #assistant-log-panel")),
              logInChat: Boolean(document.querySelector("#assistant-chat-panel #assistant-log")),
              logInDebug: Boolean(document.querySelector("#debug-drawer #assistant-log")),
              messageField: Boolean(document.querySelector("#assistant-chat-panel #assistant-input")),
              suggestionCount: document.querySelectorAll("#assistant-suggestions .assistant-suggestion").length,
              suggestionLabels: Array.from(document.querySelectorAll("#assistant-suggestions .assistant-suggestion"))
                .map((element) => element.textContent?.trim() || "")
            };
          });
          assert.equal(assistantChatMetrics.drawerOpen, "true", "Assistant drawer should open from its drawer tab");
          assert.ok(assistantChatMetrics.drawerRight <= metrics.viewportWidth + 1, "Assistant drawer should open from the right Studio rail");
          assert.equal(assistantChatMetrics.chatHidden, false, "Assistant Chat panel should be visible by default");
          assert.equal(assistantChatMetrics.logTabPresent, false, "Assistant debug log should move out of the Chat drawer");
          assert.equal(assistantChatMetrics.logInChat, false, "Assistant Chat panel should not include the message log");
          assert.equal(assistantChatMetrics.logInDebug, true, "Assistant message log should live in the Debug drawer");
          assert.equal(assistantChatMetrics.messageField, true, "Assistant Chat panel should keep the message composer");
          assert.equal(assistantChatMetrics.suggestionCount, 8, "Assistant should expose a balanced eight-option workflow grid");
          assert.ok(assistantChatMetrics.suggestionLabels.includes("Render check"), "Assistant should expose a full render validation shortcut");

          await page.click("#assistant-toggle");
          await page.waitForFunction(() => {
            return (document.querySelector("#assistant-drawer") as HTMLElement | null)?.dataset.open === "false";
          });
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });

          const thumbnailSelectionMetrics: ThumbnailSelectionMetrics = await page.evaluate(async () => {
            const rail = document.querySelector("#thumb-rail") as HTMLElement | null;
            const thumbnails = Array.from(document.querySelectorAll("#thumb-rail .thumb")) as HTMLButtonElement[];
            if (!rail || thumbnails.length < 10) {
              return {
                before: 0,
                axis: "x",
                skipped: true
              };
            }

            const targetThumbnail = thumbnails[9];
            if (!targetThumbnail) {
              return {
                before: 0,
                axis: "x",
                skipped: true
              };
            }

            targetThumbnail.scrollIntoView({
              block: "center",
              inline: "center"
            });
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            const axis = rail.scrollHeight > rail.clientHeight + 2 ? "y" : "x";
            const before = axis === "y" ? rail.scrollTop : rail.scrollLeft;
            targetThumbnail.click();

            return {
              axis,
              before,
              skipped: false
            };
          });

          if (!thumbnailSelectionMetrics.skipped) {
            await page.waitForFunction(() => {
              return /10\//.test(document.querySelector("#selected-slide-label")?.textContent || "");
            });
            await page.waitForTimeout(120);
            const thumbnailAfterSelection = await page.evaluate((axis: ScrollAxis) => {
              const rail = document.querySelector("#thumb-rail") as HTMLElement | null;
              return {
                activeLabel: document.querySelector("#selected-slide-label")?.textContent || "",
                after: rail ? (axis === "y" ? rail.scrollTop : rail.scrollLeft) : 0
              };
            }, thumbnailSelectionMetrics.axis);
            assert.ok(
              thumbnailSelectionMetrics.before > 0,
              `Thumbnail rail should scroll on the ${thumbnailSelectionMetrics.axis}-axis before selection at ${viewport.width}x${viewport.height}`
            );
            assert.ok(
              thumbnailAfterSelection.after >= thumbnailSelectionMetrics.before - 2,
              `Selecting a later slide should preserve thumbnail rail scroll at ${viewport.width}x${viewport.height} (${thumbnailAfterSelection.after.toFixed(1)}px < ${thumbnailSelectionMetrics.before.toFixed(1)}px)`
            );
            assert.match(
              thumbnailAfterSelection.activeLabel,
              /10\//,
              `Selecting the tenth thumbnail should update the selected slide label at ${viewport.width}x${viewport.height}`
            );
          }

          await page.click("#show-presentations-page");
          await page.waitForSelector("#presentation-list .presentation-card", {
            timeout: 30_000
          });
          await page.waitForTimeout(150);

          const presentationMetrics = await page.evaluate(() => {
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

            const firstTitle = document.querySelector(".presentation-card h3")?.textContent || "";

            return {
              activeCardCount: document.querySelectorAll(".presentation-card.active").length,
              card: rectFor(".presentation-card"),
              cardActions: rectFor(".presentation-card-actions"),
              cardCount: document.querySelectorAll(".presentation-card").length,
              createOpen: Boolean((document.querySelector(".presentation-create-details") as HTMLDetailsElement | null)?.open),
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              firstTitle,
              factCount: document.querySelectorAll(".presentation-card:first-child .presentation-card-facts span").length,
              facts: rectFor(".presentation-card:first-child .presentation-card-facts"),
              assistantDrawerHidden: (document.querySelector("#assistant-drawer") as HTMLElement | null)?.hidden,
              assistantDrawerDisplay: window.getComputedStyle(document.querySelector("#assistant-drawer") as HTMLElement).display,
              pageHidden: (document.querySelector("#presentations-page") as HTMLElement | null)?.hidden,
              preview: rectFor(".presentation-card-preview"),
              resultCount: document.querySelector("#presentation-result-count")?.textContent || "",
              search: rectFor("#presentation-search"),
              selectedSlideLabelHidden: (document.querySelector("#selected-slide-label") as HTMLElement | null)?.hidden,
              studioHidden: (document.querySelector("#studio-page") as HTMLElement | null)?.hidden,
              viewportWidth: window.innerWidth
            };
          });

          assert.equal(presentationMetrics.pageHidden, false, "Presentations page should be visible after navigation");
          assert.equal(presentationMetrics.studioHidden, true, "Slide Studio should be hidden while browsing presentations");
          assert.equal(presentationMetrics.selectedSlideLabelHidden, true, "Selected slide title and number should hide outside Slide Studio");
          assert.equal(presentationMetrics.assistantDrawerHidden, true, "Assistant chat should hide while browsing presentations");
          assert.equal(presentationMetrics.assistantDrawerDisplay, "none", "Assistant chat rail should not render on Presentations page");
          assert.ok(presentationMetrics.cardCount > 0, "Presentations page should render at least one presentation card");
          assert.equal(presentationMetrics.activeCardCount, 1, "Presentations page should mark exactly one active presentation");
          assert.ok(presentationMetrics.firstTitle.trim().length > 0, "Presentation cards should show the presentation name");
          assert.ok(presentationMetrics.factCount >= 2, "Presentation cards should show compact metadata facts");
          assert.equal(presentationMetrics.createOpen, false, "Presentation creation constraints should stay collapsed by default");
          await page.evaluate(() => {
            const createDetails = document.querySelector(".presentation-create-details") as HTMLDetailsElement | null;
            const fieldHelp = document.querySelector(".field-help") as HTMLDetailsElement | null;
            if (createDetails) {
              createDetails.open = true;
            }
            if (fieldHelp) {
              fieldHelp.open = true;
            }
          });
          const creationHelpMetrics = await page.evaluate(() => {
            const panel = document.querySelector(".field-help-panel");
            const textarea = document.querySelector("#presentation-constraints");
            const rect = panel ? panel.getBoundingClientRect() : null;
            const textareaRect = textarea ? textarea.getBoundingClientRect() : null;
            return {
              helpOpen: Boolean((document.querySelector(".field-help") as HTMLDetailsElement | null)?.open),
              panelPosition: panel ? window.getComputedStyle(panel).position : "",
              panel: rect
                ? {
                    bottom: rect.bottom,
                    height: rect.height,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    width: rect.width
                  }
                : null,
              textarea: textareaRect
                ? {
                    top: textareaRect.top
                  }
                : null,
              text: panel?.textContent || "",
              viewportWidth: window.innerWidth
            };
          });
          assert.equal(creationHelpMetrics.helpOpen, true, "Brief constraints help should open from the compact help affordance");
          assert.match(creationHelpMetrics.text, /Avoid market-size claims/i, "Brief constraints help should show concrete examples");
          const creationHelpPanel = requireRect(creationHelpMetrics.panel, "Brief constraints help should render a popover panel");
          assert.equal(creationHelpMetrics.panelPosition, "absolute", "Brief constraints help should be a popover, not in-flow content");
          assert.ok(
            creationHelpPanel.right <= creationHelpMetrics.viewportWidth + 1,
            `Brief constraints help should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );
          await page.locator(".presentation-create-details > summary").click();
          assert.ok(
            presentationMetrics.documentScrollWidth <= presentationMetrics.documentClientWidth + 1,
            `Presentations page should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
          );
          const presentationCard = requireRect(presentationMetrics.card, "Presentations page should expose a selectable card");
          assert.ok(
            presentationCard.right <= presentationMetrics.viewportWidth + 1,
            `Presentation cards should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );
          const presentationPreview = requireRect(presentationMetrics.preview, "Presentation cards should show a first-slide preview");
          assert.ok(
            presentationPreview.width >= Math.min(260, presentationMetrics.viewportWidth * 0.65),
            `Presentation preview should remain inspectable at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            Math.abs((presentationPreview.width / presentationPreview.height) - (16 / 9)) < 0.08,
            `Presentation preview should preserve a slide-like aspect ratio at ${viewport.width}x${viewport.height}`
          );
          assert.ok(presentationMetrics.cardActions, "Presentation cards should expose select, duplicate, and delete actions");
          assert.ok(presentationMetrics.search, "Presentations page should expose a compact search control");
          assert.ok(
            /presentation/.test(presentationMetrics.resultCount),
            "Presentations page should summarize filtered result count"
          );
          const presentationFacts = requireRect(presentationMetrics.facts, "Presentation cards should expose metadata facts");
          assert.ok(
            presentationFacts.right <= presentationMetrics.viewportWidth + 1,
            `Presentation metadata should stay inside the viewport at ${viewport.width}x${viewport.height}`
          );

          await page.fill("#presentation-search", "__missing_presentation__");
          await page.waitForTimeout(80);
          const filteredMetrics = await page.evaluate(() => ({
            cardCount: document.querySelectorAll(".presentation-card").length,
            emptyText: document.querySelector("#presentation-list .presentation-empty strong")?.textContent || "",
            resultCount: document.querySelector("#presentation-result-count")?.textContent || ""
          }));
          assert.equal(filteredMetrics.cardCount, 0, "Presentation search should filter non-matching cards");
          assert.equal(filteredMetrics.emptyText, "No matching presentations", "Presentation search should explain empty filtered state");
          assert.ok(/^0 of /.test(filteredMetrics.resultCount), "Presentation search should update filtered count");
          await page.fill("#presentation-search", "");
          await page.waitForSelector("#presentation-list .presentation-card", {
            timeout: 30_000
          });

          await page.click("#show-studio-page");
          await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
            timeout: 30_000
          });
          await page.waitForTimeout(120);

          await page.click("#context-drawer-toggle");
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
              specToggle: rectFor("#structured-draft-toggle"),
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

          await page.click("#context-drawer-toggle");
          await page.waitForTimeout(280);

          await page.click("#structured-draft-toggle");
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

          await page.click("#structured-draft-toggle");
          await page.waitForTimeout(280);

          await page.click("#show-validation-page");
          await page.waitForTimeout(100);

          const checksMetrics = await page.evaluate(() => {
            const panel = document.querySelector("#validation-page");
            const studioPage = document.querySelector("#studio-page");
            const rect = panel ? panel.getBoundingClientRect() : null;

            return {
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              expanded: document.querySelector("#show-validation-page")?.getAttribute("aria-expanded"),
              panel: rect ? {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width
              } : null,
              studioHidden: studioPage ? (studioPage as HTMLElement).hidden : true,
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth
            };
          });

          assert.equal(checksMetrics.expanded, "true", "Checks control should expose its expanded state");
          assert.equal(checksMetrics.studioHidden, false, "Opening checks should keep Slide Studio visible");
          const checksPanel = requireRect(checksMetrics.panel, "Checks control should open the checks panel");
          assert.ok(
            checksMetrics.documentScrollWidth <= checksMetrics.documentClientWidth + 1,
            `Checks panel should not create horizontal page overflow at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            checksPanel.left >= -1 && checksPanel.right <= checksMetrics.viewportWidth + 1,
            `Checks panel should stay horizontally inside the viewport at ${viewport.width}x${viewport.height}`
          );
          assert.ok(
            checksPanel.top >= -1 && checksPanel.bottom <= checksMetrics.viewportHeight + 1,
            `Checks panel should stay vertically inside the viewport at ${viewport.width}x${viewport.height}`
          );
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (ownsServer) {
      server.close();
    }
  }

  process.stdout.write("Studio layout validation passed.\n");
}

if (require.main === module) {
  runStudioLayoutValidation().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runStudioLayoutValidation
};
