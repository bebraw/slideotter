import assert from "node:assert/strict";

type Page = import("playwright").Page;

async function setSlideSpecEditor(page: Page, slideSpec: unknown): Promise<void> {
  await page.evaluate((source: string) => {
    const editor = document.querySelector("#slide-spec-editor") as HTMLTextAreaElement | null;
    if (!editor) {
      throw new Error("Slide spec editor is not available");
    }

    editor.value = source;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, `${JSON.stringify(slideSpec, null, 2)}\n`);
}

async function waitForActivePreviewText(page: Page, text: string): Promise<void> {
  await page.waitForFunction((expectedText: string) => {
    return Boolean(document.querySelector("#active-preview")?.textContent?.includes(expectedText));
  }, text);
}

async function waitForJsonResponse<T = unknown>(page: Page, pathPart: string, timeout = 30_000): Promise<T | null> {
  const response = await page.waitForResponse((candidate) => candidate.url().includes(pathPart), {
    timeout
  });
  const responseText = await response.text();
  assert.ok([200, 202].includes(response.status()), `${pathPart} failed: ${responseText}`);
  return responseText ? JSON.parse(responseText) as T : null;
}

async function validateMaterialAndVariantPhase(page: Page, smokeImage: Buffer): Promise<void> {
  const materialTarget = await page.evaluate(async () => {
    const materialCapableTypes = new Set(["content", "cover", "photo", "summary"]);
    const stateResponse = await fetch("/api/v1/state");
    const statePayload = await stateResponse.json();
    const slideSummaries = Array.isArray(statePayload.slides) ? statePayload.slides : [];
    const slideTypes: Array<{ id: string; type: string }> = [];
    for (const slide of slideSummaries) {
      const slideId = typeof slide.id === "string" ? slide.id : "";
      if (!slideId) {
        continue;
      }
      const slideResponse = await fetch(`/api/v1/slides/${slideId}`);
      const slidePayload = await slideResponse.json();
      const slideType = typeof slidePayload.slideSpec?.type === "string" ? slidePayload.slideSpec.type : "";
      slideTypes.push({ id: slideId, type: slideType });
      if (materialCapableTypes.has(slideType)) {
        const targetThumb = document.querySelector(`#thumb-rail .thumb[data-slide-id="${slideId}"]`) as HTMLButtonElement | null;
        targetThumb?.click();
        return {
          selected: Boolean(targetThumb),
          slideId,
          slideTypes
        };
      }
    }

    return {
      selected: false,
      slideId: "",
      slideTypes
    };
  });
  assert.equal(
    materialTarget.selected,
    true,
    `Presentation workflow needs a material-capable slide for attachment; generated slide types: ${materialTarget.slideTypes.map((slide) => `${slide.id}:${slide.type || "unknown"}`).join(", ")}`
  );
  await page.waitForFunction((slideId: string) => {
    const activeThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
    return activeThumb?.dataset.slideId === slideId;
  }, materialTarget.slideId);

  await page.locator(".material-details summary").first().click();
  await page.setInputFiles("#material-file", {
    buffer: smokeImage,
    mimeType: "image/png",
    name: "workflow-material.png"
  });
  await page.fill("#material-alt", "Workflow material");
  await page.fill("#material-caption", "Source: workflow smoke");
  await page.click("#upload-material-button");
  await page.waitForSelector("#material-list .material-card");
  await page.waitForFunction(() => {
    const button = document.querySelector("#material-list .material-card button") as HTMLButtonElement | null;
    return Boolean(button && !button.disabled && button.textContent?.trim() === "Attach");
  });
  await page.locator("#material-list .material-card button", { hasText: "Attach" }).first().click();
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll("#material-list .material-card button"))
      .some((button) => button.textContent?.trim() === "Attached");
  });
  await page.waitForSelector("#active-preview .dom-slide__media img[alt='Workflow material']");
  await page.setInputFiles("#material-file", {
    buffer: smokeImage,
    mimeType: "image/png",
    name: "workflow-material-grid.png"
  });
  await page.fill("#material-alt", "Workflow grid material");
  await page.fill("#material-caption", "Source: workflow grid smoke");
  await page.click("#upload-material-button");
  await page.waitForFunction(async () => {
    const response = await fetch("/api/v1/state");
    const payload = await response.json();
    return Array.isArray(payload.materials) && payload.materials.length >= 2;
  });
  await page.evaluate(() => {
    const slideOneThumb = document.querySelector('#thumb-rail .thumb[data-slide-id="slide-01"]') as HTMLButtonElement | null;
    slideOneThumb?.click();
  });
  await page.waitForFunction(() => {
    const activeThumb = document.querySelector("#thumb-rail .thumb.active") as HTMLElement | null;
    return activeThumb?.dataset.slideId === "slide-01";
  });

  await page.click("#structured-draft-toggle");
  await page.waitForSelector("#slide-spec-editor");
  const baseSpec = JSON.parse(await page.locator("#slide-spec-editor").inputValue());
  const savedTitle = "Workflow saved JSON title";
  await setSlideSpecEditor(page, {
    ...baseSpec,
    title: savedTitle
  });
  await page.waitForFunction(() => {
    return document.querySelector("#slide-spec-status")?.textContent?.includes("Previewing unsaved JSON edits");
  });
  await waitForActivePreviewText(page, savedTitle);
  const saveSlideSpecResponse = waitForJsonResponse(page, "/api/v1/slides/slide-01/slide-spec", 60_000);
  await page.click("#save-slide-spec-button");
  await saveSlideSpecResponse;
  await page.waitForFunction(async (expectedTitle) => {
    const response = await fetch("/api/v1/slides/slide-01");
    const payload = await response.json();
    return payload.slideSpec && payload.slideSpec.title === expectedTitle;
  }, savedTitle);

  const variantTitle = "Workflow applied variant title";
  await setSlideSpecEditor(page, {
    ...baseSpec,
    title: variantTitle
  });
  await waitForActivePreviewText(page, variantTitle);
  await page.locator(".structured-snapshot-details summary").click();
  await page.fill("#variant-label", "Workflow JSON snapshot");
  const captureVariantResponse = waitForJsonResponse(page, "/api/v1/variants/capture", 60_000);
  await page.click("#capture-variant-button");
  await captureVariantResponse;
  await page.click("#structured-draft-toggle");
  await page.waitForFunction(() => {
    return document.querySelector("#structured-draft-drawer")?.getAttribute("data-open") === "false";
  });
  await page.waitForSelector("#variant-list .variant-card:not(.variant-empty-state)");
  await page.waitForSelector("#compare-summary:not([hidden])");
  const applyVariantResponse = waitForJsonResponse(page, "/api/v1/variants/apply", 120_000);
  await page.click("#compare-apply-button");
  await applyVariantResponse;
  await page.waitForFunction(async (expectedTitle) => {
    const response = await fetch("/api/v1/slides/slide-01");
    const payload = await response.json();
    return payload.slideSpec && payload.slideSpec.title === expectedTitle;
  }, variantTitle);
  await page.evaluate(() => {
    const drawer = document.querySelector("#structured-draft-drawer");
    if (drawer?.getAttribute("data-open") === "true") {
      (document.querySelector("#structured-draft-toggle") as HTMLButtonElement | null)?.click();
    }
  });
  await page.waitForFunction(() => {
    return document.querySelector("#structured-draft-drawer")?.getAttribute("data-open") === "false";
  });
}

export { validateMaterialAndVariantPhase };
