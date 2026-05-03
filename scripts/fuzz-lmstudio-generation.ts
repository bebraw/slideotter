import { formatFuzzHelp, selectedScenarioNames, selectScenarios } from "./fuzz-lmstudio-generation-helpers.ts";
import type { FuzzScenario as NamedFuzzScenario } from "./fuzz-lmstudio-generation-helpers.ts";

const lmStudioBaseUrl = (process.env.LMSTUDIO_BASE_URL || process.env.STUDIO_LLM_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/+$/, "");

type JsonObject = Record<string, unknown>;

type FuzzMaterial = {
  alt: string;
  id: string;
  title: string;
  url: string;
};

type FuzzFields = JsonObject & {
  audience: string;
  constraints: string;
  objective: string;
  presentationMaterials?: FuzzMaterial[];
  presentationSources?: Array<JsonObject & {
    id: string;
    text: string;
    title: string;
    url: string;
  }>;
  targetSlideCount: number;
  title: string;
  tone: string;
};

type DeckPlanSlide = JsonObject & {
  title?: unknown;
  type?: unknown;
};

type DeckPlan = JsonObject & {
  slides?: DeckPlanSlide[];
};

type DeckPlanResponse = JsonObject & {
  plan?: DeckPlan | undefined;
};

type SlideSpec = JsonObject & {
  media?: unknown;
  mediaItems?: unknown;
  title?: unknown;
  type?: unknown;
};

type DraftedPresentation = JsonObject & {
  retrieval?: {
    snippets?: unknown;
  };
  slideSpecs: SlideSpec[];
};

type GenerationModule = {
  generateInitialDeckPlan: (fields: FuzzFields) => Promise<DeckPlanResponse>;
  generatePresentationFromDeckPlan: (fields: FuzzFields, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse) => Promise<DraftedPresentation>;
  generatePresentationFromDeckPlanIncremental: (fields: FuzzFields, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse) => Promise<DraftedPresentation>;
};

type LmStudioModelsResponse = JsonObject & {
  data?: Array<JsonObject & {
    id?: unknown;
  }>;
};

type FuzzScenario = NamedFuzzScenario & {
  expectPhotoGrid?: boolean;
  expectSourceSnippets?: boolean;
  fields: FuzzFields;
  incremental?: boolean;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readJson(response: Response): Promise<JsonObject> {
  const text = await response.text();
  try {
    const parsed: unknown = text ? JSON.parse(text) : {};
    return isJsonObject(parsed) ? parsed : {};
  } catch (error) {
    throw new Error(`Expected JSON from LM Studio, received: ${text.slice(0, 200)}`);
  }
}

async function discoverModel(): Promise<string> {
  const configuredModel = process.env.STUDIO_LLM_MODEL || process.env.LMSTUDIO_MODEL || "";
  if (configuredModel) {
    return configuredModel;
  }

  const response = await fetch(`${lmStudioBaseUrl}/models`);
  if (!response.ok) {
    throw new Error(`LM Studio model discovery failed with status ${response.status}`);
  }

  const data = await readJson(response) as LmStudioModelsResponse;
  const firstModel = Array.isArray(data.data) ? data.data.find((model) => model && typeof model.id === "string") : null;
  if (!firstModel) {
    throw new Error("LM Studio did not report any loaded models. Load a model or set LMSTUDIO_MODEL.");
  }

  return String(firstModel.id);
}

function material(id: string, title: string): FuzzMaterial {
  return {
    alt: title,
    id,
    title,
    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC"
  };
}

function slideSummary(slide: SlideSpec): JsonObject & { media: boolean; mediaItems: number; title: unknown; type: unknown } {
  return {
    media: Boolean(slide.media),
    mediaItems: Array.isArray(slide.mediaItems) ? slide.mediaItems.length : 0,
    title: slide.title,
    type: slide.type
  };
}

async function runScenario(generation: GenerationModule, scenario: FuzzScenario): Promise<JsonObject> {
  console.error(`Running ${scenario.name}...`);
  const outline = await generation.generateInitialDeckPlan(scenario.fields);
  const deckPlan = outline.plan || { slides: [] };
  const outlineTypes = (deckPlan.slides || []).map((slide, index) => ({
    index: index + 1,
    title: slide.title,
    type: slide.type
  }));
  const drafted = scenario.incremental
    ? await generation.generatePresentationFromDeckPlanIncremental(scenario.fields, deckPlan, outline)
    : await generation.generatePresentationFromDeckPlan(scenario.fields, deckPlan, outline);
  const draftedSlides = drafted.slideSpecs.map(slideSummary);
  const photoGridCount = draftedSlides.filter((slide) => slide.type === "photoGrid").length;
  const sourceSnippetCount = Array.isArray(drafted.retrieval?.snippets) ? drafted.retrieval.snippets.length : 0;

  if (scenario.expectPhotoGrid && photoGridCount < 1) {
    throw new Error(`${scenario.name} expected at least one drafted photoGrid slide; drafted types: ${draftedSlides.map((slide) => slide.type).join(", ")}`);
  }

  if (scenario.expectSourceSnippets && sourceSnippetCount < 1) {
    throw new Error(`${scenario.name} expected retrieved source snippets.`);
  }

  return {
    draftedSlides,
    outlineTypes,
    photoGridCount,
    scenario: scenario.name,
    sourceSnippetCount
  };
}

const scenarios: FuzzScenario[] = [
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
  },
  {
    expectSourceSnippets: true,
    fields: {
      audience: "Tuotetiimi",
      constraints: "Kirjoita näkyvä diojen teksti suomeksi. Käytä lähdemateriaalia, mutta pidä diojen teksti lyhyenä.",
      objective: "Selitä lähdepohjainen luonnostelu ja tarkistuspolku ylläpitäjille.",
      presentationSources: [
        {
          id: "source-grounded-flow",
          text: [
            "Lähdepohjainen luonnostelu pitää mallin tuotoksen tarkistettavana ja sidottuna esityksen omiin lähteisiin.",
            "Tarkistuspolku säilyy selkeänä, kun ehdokkaat esikatsellaan, validoidaan ja hyväksytään erikseen.",
            "Slideotter keeps generation reviewable by turning model output into structured slide proposals.",
            "The server retrieves presentation-scoped source snippets before drafting so generated slides can stay grounded.",
            "Candidates remain proposals until the author previews, validates, and applies them explicitly."
          ].join(" "),
          title: "Source-grounded workflow note",
          url: "https://example.com/slideotter/source-grounded-workflow"
        }
      ],
      targetSlideCount: 4,
      title: "Lähdepohjainen luonnostelu",
      tone: "Selkeä"
    },
    incremental: true,
    name: "source-grounded-finnish"
  }
];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(formatFuzzHelp(scenarios));
  process.exit(0);
}

const model = await discoverModel();
process.env.STUDIO_LLM_PROVIDER = "lmstudio";
process.env.LMSTUDIO_BASE_URL = lmStudioBaseUrl;
process.env.LMSTUDIO_MODEL = model;

const generation: GenerationModule = await import("../studio/server/services/presentation-generation.ts");
const selectedNames = selectedScenarioNames();
const selectedScenarios = selectScenarios(scenarios, selectedNames);

const results = [];
for (const scenario of selectedScenarios) {
  results.push(await runScenario(generation, scenario));
}

console.log(JSON.stringify({
  baseUrl: lmStudioBaseUrl,
  model,
  selectedScenarios: selectedScenarios.map((scenario) => scenario.name),
  results
}, null, 2));
