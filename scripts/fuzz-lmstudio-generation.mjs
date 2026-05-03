const lmStudioBaseUrl = (process.env.LMSTUDIO_BASE_URL || process.env.STUDIO_LLM_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/+$/, "");

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Expected JSON from LM Studio, received: ${text.slice(0, 200)}`);
  }
}

async function discoverModel() {
  const configuredModel = process.env.STUDIO_LLM_MODEL || process.env.LMSTUDIO_MODEL || "";
  if (configuredModel) {
    return configuredModel;
  }

  const response = await fetch(`${lmStudioBaseUrl}/models`);
  if (!response.ok) {
    throw new Error(`LM Studio model discovery failed with status ${response.status}`);
  }

  const data = await readJson(response);
  const firstModel = Array.isArray(data.data) ? data.data.find((model) => model && typeof model.id === "string") : null;
  if (!firstModel) {
    throw new Error("LM Studio did not report any loaded models. Load a model or set LMSTUDIO_MODEL.");
  }

  return firstModel.id;
}

function material(id, title) {
  return {
    alt: title,
    id,
    title,
    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC"
  };
}

function slideSummary(slide) {
  return {
    media: Boolean(slide.media),
    mediaItems: Array.isArray(slide.mediaItems) ? slide.mediaItems.length : 0,
    title: slide.title,
    type: slide.type
  };
}

async function runScenario(generation, scenario) {
  const outline = await generation.generateInitialDeckPlan(scenario.fields);
  const outlineTypes = (outline.plan.slides || []).map((slide, index) => ({
    index: index + 1,
    title: slide.title,
    type: slide.type
  }));
  const drafted = await generation.generatePresentationFromDeckPlan(scenario.fields, outline.plan, outline);
  const draftedSlides = drafted.slideSpecs.map(slideSummary);
  const photoGridCount = draftedSlides.filter((slide) => slide.type === "photoGrid").length;

  if (scenario.expectPhotoGrid && photoGridCount < 1) {
    throw new Error(`${scenario.name} expected at least one drafted photoGrid slide; drafted types: ${draftedSlides.map((slide) => slide.type).join(", ")}`);
  }

  return {
    draftedSlides,
    outlineTypes,
    photoGridCount,
    scenario: scenario.name
  };
}

const model = await discoverModel();
process.env.STUDIO_LLM_PROVIDER = "lmstudio";
process.env.LMSTUDIO_BASE_URL = lmStudioBaseUrl;
process.env.LMSTUDIO_MODEL = model;

const generation = await import("../studio/server/services/presentation-generation.ts");
const scenarios = [
  {
    expectPhotoGrid: true,
    fields: {
      audience: "Slideotter maintainers",
      constraints: "Draft four slides. Include exactly one photoGrid slide that compares the supplied images.",
      objective: "Fuzz media-heavy outline and draft generation with real LM Studio output.",
      presentationMaterials: [
        material("field-signal", "Field signal screenshot"),
        material("baseline", "Baseline screenshot"),
        material("detail", "Detail screenshot")
      ],
      targetSlideCount: 4,
      title: "Photo grid generation fuzz",
      tone: "Direct"
    },
    name: "photo-grid-outline"
  }
];

const results = [];
for (const scenario of scenarios) {
  results.push(await runScenario(generation, scenario));
}

console.log(JSON.stringify({
  baseUrl: lmStudioBaseUrl,
  model,
  results
}, null, 2));
