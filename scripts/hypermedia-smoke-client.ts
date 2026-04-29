const assert = require("node:assert/strict");

function resolveHref(baseUrl, href) {
  return new URL(href, baseUrl).toString();
}

async function readJson(baseUrl, href) {
  const response = await fetch(resolveHref(baseUrl, href));
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`GET ${href} failed with ${response.status}: ${body.error || response.statusText}`);
  }
  return body;
}

async function postJson(baseUrl, href, payload) {
  const response = await fetch(resolveHref(baseUrl, href), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`POST ${href} failed with ${response.status}: ${body.error || response.statusText}`);
  }
  return body;
}

function requireLink(resource, relation) {
  const link = resource && resource.links ? resource.links[relation] : null;
  assert.ok(link && typeof link.href === "string" && link.href, `Expected ${resource.resource || "resource"} link ${relation}`);
  return link.href;
}

function requireAction(resource, actionId) {
  const action = Array.isArray(resource.actions)
    ? resource.actions.find((entry) => entry.id === actionId)
    : null;
  assert.ok(action, `Expected ${resource.resource || "resource"} action ${actionId}`);
  assert.equal(typeof action.href, "string");
  assert.equal(typeof action.method, "string");
  return action;
}

async function runHypermediaSmokeClient(options: any = {}) {
  const baseUrl = options.baseUrl || process.env.SLIDEOTTER_SMOKE_BASE_URL;
  assert.ok(baseUrl, "Expected baseUrl or SLIDEOTTER_SMOKE_BASE_URL");

  const root = await readJson(baseUrl, "/api/v1");
  assert.equal(root.resource, "studio");
  assert.equal(root.version, "v1");

  const presentation = await readJson(baseUrl, requireLink(root, "activePresentation"));
  assert.equal(presentation.resource, "presentation");
  assert.ok(Array.isArray(presentation.slides) && presentation.slides.length > 0, "Expected at least one slide");
  requireAction(presentation, "save-deck-context");

  const selectedSlideHref = requireLink(presentation, "selectedSlide");
  const slide = await readJson(baseUrl, selectedSlideHref);
  assert.equal(slide.resource, "slide");
  assert.ok(slide.slideSpec && typeof slide.slideSpec === "object", "Expected slide spec");

  const workflows = await readJson(baseUrl, requireLink(slide, "workflows"));
  assert.equal(workflows.resource, "slideWorkflowCollection");
  assert.ok(workflows.actions.every((entry) => entry.effect === "candidate"), "Expected only candidate workflow actions");

  const saveSlideSpec = requireAction(slide, "save-slide-spec");
  assert.equal(saveSlideSpec.effect, "write");
  assert.ok(saveSlideSpec.baseVersion, "Expected write action baseVersion");

  const saved = await postJson(baseUrl, saveSlideSpec.href, {
    baseVersion: saveSlideSpec.baseVersion,
    rebuild: false,
    slideSpec: slide.slideSpec
  });
  assert.ok(saved.slideSpec, "Expected save action to return a slide spec");

  const refreshedSlide = await readJson(baseUrl, selectedSlideHref);
  assert.equal(refreshedSlide.resource, "slide");
  assert.ok(refreshedSlide.state.baseVersion, "Expected refreshed slide baseVersion");

  return {
    presentationId: presentation.id,
    slideId: slide.id
  };
}

async function main() {
  try {
    const result = await runHypermediaSmokeClient();
    process.stdout.write(`Hypermedia smoke passed for ${result.presentationId}/${result.slideId}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runHypermediaSmokeClient
};
