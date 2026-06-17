import * as path from "path";
import {
  createSlug,
  normalizeTargetSlideCount
} from "./compact-text.ts";
import { stateDir } from "./paths.ts";
import {
  assertPresentationId,
  defaultPresentationId
} from "./presentation-paths.ts";
import {
  defaultDesignConstraints,
  normalizeDesignConstraints
} from "./design-constraints.ts";
import {
  defaultValidationSettings,
  normalizeValidationSettings
} from "./validation-settings.ts";
import {
  deckMeta,
  defaultDeckLanguage,
  normalizeVisualTheme,
  theme as defaultVisualTheme
} from "./deck-theme.ts";

const presentationsRegistryFile = path.join(stateDir, "presentations.json");

type JsonObject = Record<string, unknown>;

type RegistryEntry = JsonObject & {
  id: string;
  title: string;
};

type PresentationsRegistry = {
  presentations: RegistryEntry[];
};

type RuntimeState = {
  activePresentationId: string;
  creationDraft: JsonObject;
  llm: {
    modelOverride: string;
  };
  savedLayouts: JsonObject[];
  savedThemes: JsonObject[];
};

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

type PresentationSummary = JsonObject & {
  description: string;
  id: string;
  title: string;
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asJsonObjectArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is JsonObject => asJsonObject(entry) === entry)
    : [];
}

function createInitialCoverSlide(params: {
  audience: unknown;
  constraints: unknown;
  objective: unknown;
  targetLine: string;
  title: unknown;
  tone: unknown;
}): JsonObject {
  return {
    type: "cover",
    title: params.title,
    logo: "slideotter",
    eyebrow: "Draft deck",
    summary: params.objective,
    note: params.constraints,
    cards: [
      {
        id: "draft-audience",
        title: "Audience",
        body: params.audience
      },
      {
        id: "draft-tone",
        title: "Tone",
        body: params.tone
      },
      {
        id: "draft-constraints",
        title: "Constraints",
        body: `${params.constraints} ${params.targetLine}`
      }
    ]
  };
}

function createInitialTocSlide(targetSlideCount: number | null): JsonObject {
  return {
    type: "toc",
    title: "Starting structure",
    eyebrow: "Initial plan",
    summary: targetSlideCount
      ? `A minimal scaffold generated from the presentation brief. The saved target is ${targetSlideCount} slide${targetSlideCount === 1 ? "" : "s"}.`
      : "A minimal scaffold generated from the presentation brief. Refine the outline before expanding the deck.",
    note: "Use the Outline drawer to generate alternatives once the constraints read right.",
    cards: [
      {
        id: "plan-context",
        title: "Context",
        body: "Audience, objective, and constraints."
      },
      {
        id: "plan-argument",
        title: "Argument",
        body: "The claim this deck should make."
      },
      {
        id: "plan-handoff",
        title: "Handoff",
        body: "The decision or action the deck should support."
      }
    ]
  };
}

function createInitialSummarySlide(): JsonObject {
  return {
    type: "summary",
    title: "Next steps",
    eyebrow: "Authoring path",
    summary: "Turn the scaffold into a real deck by tightening context, generating variants, and validating before archive.",
    resourcesTitle: "Working files",
    bullets: [
      {
        id: "next-context",
        title: "Tighten context",
        body: "Clarify audience, objective, tone, and constraints."
      },
      {
        id: "next-slides",
        title: "Shape slides",
        body: "Add, duplicate, rewrite, or generate structured candidates."
      },
      {
        id: "next-validate",
        title: "Validate output",
        body: "Run checks before treating the deck as ready."
      }
    ],
    resources: [
      {
        id: "resource-slides",
        title: "Slides",
        body: "presentations/<id>/slides"
      },
      {
        id: "resource-state",
        title: "State",
        body: "presentations/<id>/state"
      }
    ]
  };
}

function createInitialSlideSpecs(deck: JsonObject): JsonObject[] {
  const title = deck.title || "Untitled presentation";
  const objective = deck.objective || `Explain ${title} clearly.`;
  const constraints = deck.constraints || "Keep the presentation concise, readable, and focused.";
  const audience = deck.audience || "Audience to define";
  const tone = deck.tone || "Direct and practical";
  const lengthProfile = asJsonObject(deck.lengthProfile);
  const targetSlideCount = normalizeTargetSlideCount(lengthProfile.targetCount);
  const targetLine = targetSlideCount
    ? `Target length: ${targetSlideCount} slide${targetSlideCount === 1 ? "" : "s"}.`
    : "Target length can be set from the Outline drawer.";

  return [
    createInitialCoverSlide({ audience, constraints, objective, targetLine, title, tone }),
    createInitialTocSlide(targetSlideCount),
    createInitialSummarySlide()
  ];
}

function createDeckLengthProfile(fields: JsonObject): JsonObject | null {
  const lengthProfile = asJsonObject(fields.lengthProfile);
  const timestamp = lengthProfile.updatedAt
    ? lengthProfile.updatedAt
    : new Date().toISOString();
  const targetSlideCount = normalizeTargetSlideCount(
    fields.targetSlideCount ?? fields.targetCount ?? lengthProfile.targetCount
  );

  return targetSlideCount
    ? {
        activeCount: Number.isFinite(Number(fields.activeCount)) ? Number(fields.activeCount) : 3,
        skippedCount: Number.isFinite(Number(fields.skippedCount)) ? Number(fields.skippedCount) : 0,
        targetCount: targetSlideCount,
        updatedAt: timestamp
      }
    : null;
}

function createDefaultDeckContext(fields: JsonObject = {}): JsonObject {
  const validationSettingsFields = asJsonObject(fields.validationSettings);
  const visualTheme = normalizeVisualTheme({
    ...defaultVisualTheme,
    ...asJsonObject(fields.visualTheme)
  });
  const validationSettings = normalizeValidationSettings({
    ...defaultValidationSettings,
    ...validationSettingsFields,
    rules: {
      ...(defaultValidationSettings.rules || {}),
      ...asJsonObject(validationSettingsFields.rules)
    }
  });

  return {
    deck: {
      author: fields.author || deckMeta.author,
      company: fields.company || deckMeta.company,
      subject: fields.subject || deckMeta.subject,
      title: fields.title || "Untitled presentation",
      lang: fields.lang || defaultDeckLanguage,
      audience: fields.audience || "",
      objective: fields.objective || "",
      tone: fields.tone || "",
      constraints: fields.constraints || "",
      designConstraints: normalizeDesignConstraints({
        ...defaultDesignConstraints,
        ...(fields.designConstraints || {})
      }),
      validationSettings,
      visualTheme,
      lengthProfile: createDeckLengthProfile(fields),
      themeBrief: fields.themeBrief || "",
      outline: fields.outline || "",
      structureLabel: "",
      structureSummary: "",
      structurePlan: []
    },
    slides: {}
  };
}

function createDefaultPresentationMeta(fields: JsonObject = {}): JsonObject {
  const timestamp = new Date().toISOString();

  return {
    id: fields.id || defaultPresentationId,
    title: fields.title || "slideotter",
    description: fields.description || "",
    createdAt: fields.createdAt || timestamp,
    updatedAt: fields.updatedAt || timestamp
  };
}

function createDefaultRegistry(): PresentationsRegistry {
  return {
    presentations: [
      {
        id: defaultPresentationId,
        title: "slideotter"
      }
    ]
  };
}

function normalizeRegistry(registry: unknown): PresentationsRegistry {
  const source = asJsonObject(registry);
  const presentations = Array.isArray(source.presentations)
    ? source.presentations
      .filter((entry: unknown): entry is JsonObject => asJsonObject(entry) === entry && typeof asJsonObject(entry).id === "string")
      .map((entry: JsonObject) => ({
        id: assertPresentationId(entry.id),
        title: String(entry.title || entry.id)
      }))
    : [];

  const normalized = presentations.length
    ? presentations
    : createDefaultRegistry().presentations;

  return {
    presentations: normalized
  };
}

function defaultActivePresentationId(registry: PresentationsRegistry): string {
  const entries = registry.presentations || [];
  return entries.some((entry: RegistryEntry) => entry.id === defaultPresentationId)
    ? defaultPresentationId
    : entries[0]?.id || defaultPresentationId;
}

function normalizeOutlineLocks(value: unknown): JsonObject {
  const source = asJsonObject(value);
  return Object.keys(source).length
    ? Object.fromEntries(Object.entries(source)
      .filter(([key, entry]) => /^\d+$/.test(key) && entry === true)
      .map(([key]) => [key, true]))
    : {};
}

function normalizeContentRunSlide(value: unknown): JsonObject {
  const slide = asJsonObject(value);
  const status = typeof slide.status === "string" && ["pending", "generating", "complete", "failed"].includes(slide.status) ? slide.status : "pending";
  return {
    error: typeof slide.error === "string" ? slide.error : null,
    errorLogPath: typeof slide.errorLogPath === "string" ? slide.errorLogPath : null,
    slideContext: slide.slideContext && typeof slide.slideContext === "object" && !Array.isArray(slide.slideContext)
      ? slide.slideContext
      : null,
    slideSpec: slide.slideSpec && typeof slide.slideSpec === "object" && !Array.isArray(slide.slideSpec)
      ? slide.slideSpec
      : null,
    status
  };
}

function normalizeContentRun(value: JsonObject | null): JsonObject | null {
  if (!value) {
    return null;
  }

  const status = typeof value.status === "string" && ["running", "stopped", "failed", "completed"].includes(value.status) ? value.status : "running";
  const slideCount = Number.isFinite(Number(value.slideCount)) ? Number(value.slideCount) : 0;
  const slides = Array.isArray(value.slides)
    ? value.slides.map(normalizeContentRunSlide).slice(0, Math.max(0, slideCount || value.slides.length || 0))
    : [];
  const completed = Number.isFinite(Number(value.completed)) ? Number(value.completed) : slides.filter((slide: JsonObject) => slide.status === "complete").length;
  const failedSlideIndex = value.failedSlideIndex === null || value.failedSlideIndex === undefined
    ? null
    : Number.isFinite(Number(value.failedSlideIndex))
      ? Number(value.failedSlideIndex)
      : null;

  return {
    completed,
    failedSlideIndex,
    id: typeof value.id === "string" ? value.id : "",
    materials: Array.isArray(value.materials)
      ? value.materials.filter((item: unknown) => asJsonObject(item) === item).slice(0, 20)
      : [],
    sourceText: typeof value.sourceText === "string" ? value.sourceText : "",
    slideCount,
    slides,
    startedAt: value.startedAt || null,
    stopRequested: value.stopRequested === true,
    status,
    updatedAt: value.updatedAt || null
  };
}

function normalizeCreationImageSearch(fields: JsonObject): JsonObject {
  const imageSearch = asJsonObject(fields.imageSearch);
  return Object.keys(imageSearch).length
    ? {
        count: normalizeTargetSlideCount(imageSearch.count) || 3,
        provider: String(imageSearch.provider || "openverse"),
        query: String(imageSearch.query || ""),
        restrictions: String(imageSearch.restrictions || "")
      }
    : {
        count: 3,
        provider: "openverse",
        query: "",
        restrictions: ""
      };
}

function normalizeCreationDraftFields(value: unknown): JsonObject {
  const fields = asJsonObject(value);
  return {
    audience: String(fields.audience || ""),
    constraints: String(fields.constraints || ""),
    imageSearch: normalizeCreationImageSearch(fields),
    objective: String(fields.objective || ""),
    presentationDensity: fields.presentationDensity === "balanced" || fields.presentationDensity === "dense" || fields.presentationDensity === "spacious"
      ? fields.presentationDensity
      : "spacious",
    lang: String(fields.lang || fields.presentationLanguage || ""),
    presentationSourceUrls: String(fields.presentationSourceUrls || ""),
    presentationSourceText: String(fields.presentationSourceText || ""),
    sourcingStyle: typeof fields.sourcingStyle === "string" && ["compact-references", "inline-notes", "none"].includes(fields.sourcingStyle)
      ? fields.sourcingStyle
      : "none",
    targetSlideCount: normalizeTargetSlideCount(fields.targetSlideCount),
    themeBrief: String(fields.themeBrief || ""),
    title: String(fields.title || ""),
    tone: String(fields.tone || ""),
    visualTheme: normalizeVisualTheme({
      ...defaultVisualTheme,
      ...asJsonObject(fields.visualTheme)
    })
  };
}

function normalizeCreationDraft(draft: unknown): JsonObject {
  const source = asJsonObject(draft);
  const contentRunSource = source.contentRun && asJsonObject(source.contentRun) === source.contentRun
    ? asJsonObject(source.contentRun)
    : null;

  return {
    approvedOutline: source.approvedOutline === true,
    contentRun: normalizeContentRun(contentRunSource),
    createdPresentationId: typeof source.createdPresentationId === "string" ? source.createdPresentationId : null,
    deckPlan: source.deckPlan && typeof source.deckPlan === "object" && !Array.isArray(source.deckPlan)
      ? source.deckPlan
      : null,
    fields: normalizeCreationDraftFields(source.fields),
    retrieval: source.retrieval && typeof source.retrieval === "object" && !Array.isArray(source.retrieval)
      ? source.retrieval
      : null,
    outlineLocks: normalizeOutlineLocks(source.outlineLocks),
    outlineDirty: source.outlineDirty === true,
    stage: typeof source.stage === "string" && ["brief", "structure", "content", "theme", "sources"].includes(source.stage)
      ? source.stage
      : "brief",
    updatedAt: source.updatedAt || null
  };
}

function normalizeSavedThemes(themes: unknown): JsonObject[] {
  const source = Array.isArray(themes) ? themes : [];
  const seen = new Set<string>();

  return source
    .filter((theme: unknown): theme is JsonObject => asJsonObject(theme) === theme)
    .map((theme: JsonObject, index: number) => {
      const id = createSlug(theme.id || theme.name || `theme-${index + 1}`, `theme-${index + 1}`);
      const uniqueId = seen.has(id) ? `${id}-${index + 1}` : id;
      seen.add(uniqueId);

      return {
        id: uniqueId,
        name: String(theme.name || theme.id || `Theme ${index + 1}`),
        theme: normalizeVisualTheme({
          ...defaultVisualTheme,
          ...(theme.theme || theme.visualTheme || {})
        }),
        updatedAt: theme.updatedAt || null
      };
    })
    .slice(0, 30);
}

function normalizeSavedLayouts(layouts: unknown): JsonObject[] {
  const source = Array.isArray(layouts) ? layouts : [];
  const seen = new Set<string>();

  return source
    .filter((layout: unknown): layout is JsonObject => asJsonObject(layout) === layout)
    .map((layout: JsonObject, index: number) => {
      const id = createSlug(layout.id || layout.name || `layout-${index + 1}`, `layout-${index + 1}`);
      const uniqueId = seen.has(id) ? `${id}-${index + 1}` : id;
      seen.add(uniqueId);

      return {
        ...layout,
        id: uniqueId,
        name: String(layout.name || layout.id || `Layout ${index + 1}`),
        updatedAt: layout.updatedAt || null
      };
    })
    .slice(0, 50);
}

function normalizeRuntimeState(runtime: unknown, registry: PresentationsRegistry): RuntimeState {
  const source = asJsonObject(runtime);
  const activePresentationId = registry.presentations.some((entry: RegistryEntry) => entry.id === source.activePresentationId)
    ? String(source.activePresentationId)
    : defaultActivePresentationId(registry);

  return {
    activePresentationId,
    creationDraft: normalizeCreationDraft(source.creationDraft),
    llm: {
      modelOverride: typeof asJsonObject(source.llm).modelOverride === "string"
        ? String(asJsonObject(source.llm).modelOverride).trim()
        : ""
    },
    savedLayouts: normalizeSavedLayouts(source.savedLayouts),
    savedThemes: normalizeSavedThemes(source.savedThemes)
  };
}

export {
  asJsonObject,
  asJsonObjectArray,
  createDefaultDeckContext,
  createDefaultPresentationMeta,
  createDefaultRegistry,
  createInitialSlideSpecs,
  defaultActivePresentationId,
  normalizeCreationDraft,
  normalizeRegistry,
  normalizeRuntimeState,
  presentationsRegistryFile
};

export type {
  DeckContext,
  JsonObject,
  PresentationSummary,
  PresentationsRegistry,
  RegistryEntry,
  RuntimeState
};
