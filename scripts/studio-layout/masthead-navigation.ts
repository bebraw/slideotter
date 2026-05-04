import assert from "node:assert/strict";

type Page = import("playwright").Page;
type ViewportSize = import("playwright").ViewportSize;

type MastheadPage = {
  button: string;
  hash: string;
  label: string;
  page: string;
};

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

    const metrics = await page.evaluate(({ button, page: pageSelector }: MastheadPage) => {
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

export { validateMastheadPageNavigation };
