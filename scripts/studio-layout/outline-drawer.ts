import assert from "node:assert/strict";
import {
  clickDrawerControl,
  getDrawerShortcut,
  requireRect
} from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type RetiredRouteSelector = {
  key: string;
  selector: string;
};

const retiredPlanningRouteSelectors: RetiredRouteSelector[] = [
  { key: "navButton", selector: "#show-planning-page" },
  { key: "page", selector: "#planning-page" }
];

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

  const metrics = await page.evaluate((retiredSelectors: RetiredRouteSelector[]) => {
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
      retiredPlanningRouteArtifacts: Object.fromEntries(retiredSelectors.map((entry) => [
        entry.key,
        Boolean(document.querySelector(entry.selector))
      ])),
      visiblePanel: Array.from(document.querySelectorAll("[data-outline-mode-panel]"))
        .filter((panel) => !(panel as HTMLElement).hidden)
        .map((panel) => (panel as HTMLElement).dataset.outlineModePanel || ""),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  }, retiredPlanningRouteSelectors);

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
    metrics.retiredPlanningRouteArtifacts,
    { navButton: false, page: false },
    "Retired Deck Planning route artifacts should stay removed from the Studio shell"
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

export { validateOutlineDrawer };
