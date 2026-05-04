import assert from "node:assert/strict";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type StudioViewportMetrics = {
  viewportHeight: number;
  viewportWidth: number;
};

function isMobileViewport(viewport: ViewportSize): boolean {
  return viewport.width <= 760;
}

async function validateCurrentSlideWorkbench(
  page: Page,
  viewport: ViewportSize,
  metrics: StudioViewportMetrics
): Promise<void> {
  const initialWorkbenchMetrics = await page.evaluate(() => ({
    contextAriaExpanded: document.querySelector("#context-drawer-toggle")?.getAttribute("aria-expanded"),
    contextDrawerHidden: (document.querySelector("#context-drawer") as HTMLElement | null)?.hidden,
    contextInsideCurrentPanel: Boolean(document.querySelector("#current-slide-panel #slide-context-panel")),
    contextPanelPresent: Boolean(document.querySelector("#context-drawer #slide-context-panel")),
    contextTabIcon: Boolean(document.querySelector("#context-drawer-toggle .drawer-toggle-icon")),
    drawerToggleAriaLabels: Array.from(document.querySelectorAll("#context-drawer-toggle, #layout-drawer-toggle, #debug-drawer-toggle, #structured-draft-toggle, #theme-drawer-toggle, #assistant-toggle"))
      .map((button) => button.getAttribute("aria-label") || ""),
    drawerToggleIconCount: document.querySelectorAll("#context-drawer-toggle .drawer-toggle-icon, #layout-drawer-toggle .drawer-toggle-icon, #debug-drawer-toggle .drawer-toggle-icon, #structured-draft-toggle .drawer-toggle-icon, #theme-drawer-toggle .drawer-toggle-icon, #assistant-toggle .drawer-toggle-icon").length,
    drawerToggleMaxRight: Math.max(
      ...Array.from(document.querySelectorAll("#context-drawer-toggle, #layout-drawer-toggle, #debug-drawer-toggle, #structured-draft-toggle, #theme-drawer-toggle, #assistant-toggle"))
        .map((button) => button.getBoundingClientRect().right)
    ),
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
    separateContextTabPresent: Boolean(document.querySelector("#show-slide-context-tab")),
    mobileToolsButton: (() => {
      const button = document.querySelector("#mobile-tools-toggle") as HTMLElement | null;
      if (!button) {
        return null;
      }
      const rect = button.getBoundingClientRect();
      return {
        ariaExpanded: button.getAttribute("aria-expanded") || "",
        bottom: rect.bottom,
        hidden: (document.querySelector("#mobile-tools") as HTMLElement | null)?.hidden,
        right: rect.right,
        width: rect.width
      };
    })(),
    variantControlsHidden: (document.querySelector("#variant-generation-panel") as HTMLElement | null)?.hidden,
    variantDetailsOpen: (document.querySelector(".variant-generation-details") as HTMLDetailsElement | null)?.open,
    variantRailDisplay: window.getComputedStyle(document.querySelector(".variant-rail-panel") as HTMLElement).display
  }));
  assert.equal(initialWorkbenchMetrics.separateContextTabPresent, false, "Slide context should not return as a separate studio tab");
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
  if (isMobileViewport(viewport)) {
    const mobileToolsButton = initialWorkbenchMetrics.mobileToolsButton;
    if (!mobileToolsButton) {
      throw new Error("Mobile Studio should expose a single Tools handle");
    }
    assert.equal(mobileToolsButton.hidden, false, "Mobile Studio should show the Tools handle on the Studio page");
    assert.equal(mobileToolsButton.ariaExpanded, "false", "Mobile Tools handle should start collapsed");
    assert.ok(mobileToolsButton.width > 0, "Mobile Tools handle should have visible width");
    assert.ok(
      mobileToolsButton.right <= metrics.viewportWidth + 1 && mobileToolsButton.bottom <= metrics.viewportHeight + 1,
      `Mobile Tools handle should stay inside the viewport at ${viewport.width}x${viewport.height}`
    );
  } else {
    assert.ok(
      initialWorkbenchMetrics.drawerToggleMaxRight >= metrics.viewportWidth - 16
        && initialWorkbenchMetrics.drawerToggleMaxRight <= metrics.viewportWidth + 16
        && initialWorkbenchMetrics.drawerToggleMaxRight - initialWorkbenchMetrics.drawerToggleMinRight <= 2,
      `Studio drawer rail controls should stay aligned near the right viewport edge at ${viewport.width}x${viewport.height}`
    );
  }
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
}

export { validateCurrentSlideWorkbench };
