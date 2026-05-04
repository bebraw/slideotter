import assert from "node:assert/strict";
import {
  clickDrawerControl,
  getDrawerShortcut,
  requireRect
} from "./drawers.ts";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type RectMetrics = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type AssistantSupportMetrics = {
  llmButton: RectMetrics | null;
  llmState: string;
  llmStatus: string;
  viewportWidth: number;
};

async function validateAssistantSupport(
  page: Page,
  viewport: ViewportSize,
  metrics: AssistantSupportMetrics
): Promise<void> {
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

  await clickDrawerControl(page, getDrawerShortcut("#assistant-drawer"), viewport);
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

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    return (document.querySelector("#assistant-drawer") as HTMLElement | null)?.dataset.open === "false";
  });
  await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
    timeout: 30_000
  });
}

export { validateAssistantSupport };
