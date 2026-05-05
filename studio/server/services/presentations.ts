import * as fs from "fs";
import * as path from "path";
import {
  presentationsDir,
  stateDir
} from "./paths.ts";
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
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";
import {
  normalizeOutlinePlan,
  type OutlinePlan,
  type OutlinePlanSection,
  type OutlinePlanSlide
} from "./outline-plans.ts";
import { createOutlinePlanStore } from "./outline-plan-store.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

const presentationsRegistryFile = path.join(stateDir, "presentations.json");
const presentationRuntimeFile = path.join(stateDir, "runtime.json");
const defaultPresentationId = "slideotter";

type JsonObject = Record<string, unknown>;

type PresentationPaths = {
  customVisualsFile: string;
  deckContextFile: string;
  id: string;
  layoutsFile: string;
  materialsDir: string;
  materialsFile: string;
  metaFile: string;
  outlinePlansFile: string;
  rootDir: string;
  slidesDir: string;
  sourcesFile: string;
  stateDir: string;
  variantsFile: string;
};

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

type DeckPlanSlide = JsonObject & {
  intent: string;
  keyMessage: string;
  role: string;
  sourceNeed: string;
  title: string;
  type: string;
  value: string;
  visualNeed: string;
};

type DeckPlan = JsonObject & {
  audience: string;
  language: string;
  narrativeArc: string;
  outline: string;
  slides: DeckPlanSlide[];
  thesis: string;
};

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

type SourceStore = {
  sources: JsonObject[];
};

type MaterialStore = {
  materials: JsonObject[];
};

type PresentationSummary = JsonObject & {
  description: string;
  id: string;
  title: string;
};

type CurrentSlideEntry = {
  id: string;
  index: number;
  title: string;
  type: string;
};

type PlanCandidateEntry = JsonObject & {
  action: string;
  currentIndex: number | null;
  currentTitle: string;
  proposedIndex: number | null;
  proposedTitle: string;
  slideId: string | null;
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asJsonObjectArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is JsonObject => asJsonObject(entry) === entry)
    : [];
}

function createSlug(value: unknown, fallback = "presentation"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return slug || fallback;
}

function assertPresentationId(id: unknown): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(id || ""))) {
    throw new Error(`Invalid presentation id: ${id}`);
  }

  return String(id);
}

function presentationRoot(id: unknown): string {
  return path.join(presentationsDir, assertPresentationId(id));
}

function getPresentationPaths(id: unknown): PresentationPaths {
  const rootDir = presentationRoot(id);

  return {
    id: assertPresentationId(id),
    metaFile: path.join(rootDir, "presentation.json"),
    materialsDir: path.join(rootDir, "materials"),
    materialsFile: path.join(rootDir, "state", "materials.json"),
    customVisualsFile: path.join(rootDir, "state", "custom-visuals.json"),
    layoutsFile: path.join(rootDir, "state", "layouts.json"),
    outlinePlansFile: path.join(rootDir, "state", "outline-plans.json"),
    rootDir,
    slidesDir: path.join(rootDir, "slides"),
    stateDir: path.join(rootDir, "state"),
    deckContextFile: path.join(rootDir, "state", "deck-context.json"),
    sourcesFile: path.join(rootDir, "state", "sources.json"),
    variantsFile: path.join(rootDir, "state", "variants.json")
  };
}

function readJson(fileName: string, fallback: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown): void {
  writeAllowedJson(fileName, value);
}

function writeSlideFile(paths: PresentationPaths, index: number, slideSpec: JsonObject): void {
  const validated = validateSlideSpec({
    ...slideSpec,
    index
  });
  writeJson(path.join(paths.slidesDir, `slide-${String(index).padStart(2, "0")}.json`), validated);
}

function removeSlideFiles(paths: PresentationPaths): void {
  const files = fs.existsSync(paths.slidesDir) ? fs.readdirSync(paths.slidesDir) : [];
  files
    .filter((fileName: string) => /^slide-\d+\.(json|js)$/.test(fileName))
    .forEach((fileName: string) => {
      fs.rmSync(path.join(paths.slidesDir, fileName), {
        force: true
      });
    });
}

function normalizeTargetSlideCount(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(Math.max(1, parsed), 200);
}

function normalizeCompactText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
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
    {
      type: "cover",
      title,
      logo: "slideotter",
      eyebrow: "Draft deck",
      summary: objective,
      note: constraints,
      cards: [
        {
          id: "draft-audience",
          title: "Audience",
          body: audience
        },
        {
          id: "draft-tone",
          title: "Tone",
          body: tone
        },
        {
          id: "draft-constraints",
          title: "Constraints",
          body: `${constraints} ${targetLine}`
        }
      ]
    },
    {
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
    },
    {
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
    }
  ];
}

function createDefaultDeckContext(fields: JsonObject = {}): JsonObject {
  const lengthProfile = asJsonObject(fields.lengthProfile);
  const validationSettingsFields = asJsonObject(fields.validationSettings);
  const timestamp = lengthProfile.updatedAt
    ? lengthProfile.updatedAt
    : new Date().toISOString();
  const targetSlideCount = normalizeTargetSlideCount(
    fields.targetSlideCount ?? fields.targetCount ?? lengthProfile.targetCount
  );
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
      lengthProfile: targetSlideCount
        ? {
            activeCount: Number.isFinite(Number(fields.activeCount)) ? Number(fields.activeCount) : 3,
            skippedCount: Number.isFinite(Number(fields.skippedCount)) ? Number(fields.skippedCount) : 0,
            targetCount: targetSlideCount,
            updatedAt: timestamp
          }
        : null,
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

function normalizeCreationDraft(draft: unknown): JsonObject {
  const source = asJsonObject(draft);
  const fields = asJsonObject(source.fields);
  const contentRunSource = source.contentRun && asJsonObject(source.contentRun) === source.contentRun
    ? asJsonObject(source.contentRun)
    : null;
  const outlineLocksSource = asJsonObject(source.outlineLocks);
  const outlineLocks = Object.keys(outlineLocksSource).length
    ? Object.fromEntries(Object.entries(outlineLocksSource)
      .filter(([key, value]) => /^\d+$/.test(key) && value === true)
      .map(([key]) => [key, true]))
    : {};

  const normalizeContentRunSlide = (value: unknown): JsonObject => {
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
  };

  const normalizeContentRun = (value: JsonObject | null): JsonObject | null => {
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
  };

  return {
    approvedOutline: source.approvedOutline === true,
    contentRun: normalizeContentRun(contentRunSource),
    createdPresentationId: typeof source.createdPresentationId === "string" ? source.createdPresentationId : null,
    deckPlan: source.deckPlan && typeof source.deckPlan === "object" && !Array.isArray(source.deckPlan)
      ? source.deckPlan
      : null,
    fields: {
      audience: String(fields.audience || ""),
      constraints: String(fields.constraints || ""),
      imageSearch: Object.keys(asJsonObject(fields.imageSearch)).length
        ? {
            count: normalizeTargetSlideCount(asJsonObject(fields.imageSearch).count) || 3,
            provider: String(asJsonObject(fields.imageSearch).provider || "openverse"),
            query: String(asJsonObject(fields.imageSearch).query || ""),
            restrictions: String(asJsonObject(fields.imageSearch).restrictions || "")
          }
        : {
            count: 3,
            provider: "openverse",
            query: "",
            restrictions: ""
          },
      objective: String(fields.objective || ""),
      lang: String(fields.lang || fields.presentationLanguage || ""),
      presentationSourceUrls: String(fields.presentationSourceUrls || ""),
      presentationSourceText: String(fields.presentationSourceText || ""),
      sourcingStyle: typeof fields.sourcingStyle === "string" && ["compact-references", "inline-notes", "none"].includes(fields.sourcingStyle)
        ? fields.sourcingStyle
        : "",
      targetSlideCount: normalizeTargetSlideCount(fields.targetSlideCount),
      themeBrief: String(fields.themeBrief || ""),
      title: String(fields.title || ""),
      tone: String(fields.tone || ""),
      visualTheme: normalizeVisualTheme({
        ...defaultVisualTheme,
        ...asJsonObject(fields.visualTheme)
      })
    },
    retrieval: source.retrieval && typeof source.retrieval === "object" && !Array.isArray(source.retrieval)
      ? source.retrieval
      : null,
    outlineLocks,
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

function readRegistry(): PresentationsRegistry {
  return normalizeRegistry(readJson(presentationsRegistryFile, createDefaultRegistry()));
}

function readRuntimeState(registry: PresentationsRegistry = readRegistry()): RuntimeState {
  return normalizeRuntimeState(readJson(presentationRuntimeFile, {
    activePresentationId: defaultActivePresentationId(registry)
  }), registry);
}

function writeRuntimeState(runtime: JsonObject, registry: PresentationsRegistry = readRegistry()): RuntimeState {
  const current = readJson(presentationRuntimeFile, {});
  const normalized = normalizeRuntimeState({
    ...asJsonObject(current),
    ...runtime
  }, registry);
  writeJson(presentationRuntimeFile, normalized);
  return normalized;
}

function writeRegistry(registry: unknown): PresentationsRegistry {
  const normalized = normalizeRegistry(registry);
  writeJson(presentationsRegistryFile, normalized);
  return normalized;
}

function ensurePresentationFiles(id: unknown, fields: JsonObject = {}): void {
  const paths = getPresentationPaths(id);
  ensureAllowedDir(paths.materialsDir);
  ensureAllowedDir(paths.slidesDir);
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.metaFile)) {
    writeJson(paths.metaFile, createDefaultPresentationMeta({
      ...fields,
      id
    }));
  }

  if (!fs.existsSync(paths.deckContextFile)) {
    writeJson(paths.deckContextFile, createDefaultDeckContext({
      title: fields.title || id,
      subject: fields.description || ""
    }));
  }

  if (!fs.existsSync(paths.variantsFile)) {
    writeJson(paths.variantsFile, { variants: [] });
  }

  if (!fs.existsSync(paths.materialsFile)) {
    writeJson(paths.materialsFile, { materials: [] });
  }

  if (!fs.existsSync(paths.customVisualsFile)) {
    writeJson(paths.customVisualsFile, { customVisuals: [] });
  }

  if (!fs.existsSync(paths.sourcesFile)) {
    writeJson(paths.sourcesFile, { sources: [] });
  }

  if (!fs.existsSync(paths.outlinePlansFile)) {
    writeJson(paths.outlinePlansFile, { plans: [] });
  }
}

function ensurePresentationsState(): PresentationsRegistry {
  ensureAllowedDir(stateDir);
  ensureAllowedDir(presentationsDir);

  if (!fs.existsSync(presentationsRegistryFile)) {
    writeRegistry(createDefaultRegistry());
  }

  const registry = readRegistry();
  registry.presentations.forEach((entry: RegistryEntry) => ensurePresentationFiles(entry.id, entry));
  return registry;
}

function getActivePresentationId(): string {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).activePresentationId;
}

function getActivePresentationPaths(): PresentationPaths {
  return getPresentationPaths(getActivePresentationId());
}

function setActivePresentation(id: unknown): RuntimeState {
  const registry = ensurePresentationsState();
  const safeId = assertPresentationId(id);
  if (!registry.presentations.some((entry: RegistryEntry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  return writeRuntimeState({
    activePresentationId: safeId
  }, registry);
}

function getPresentationCreationDraft(): JsonObject {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).creationDraft;
}

function savePresentationCreationDraft(draft: JsonObject): JsonObject {
  const registry = ensurePresentationsState();
  const nextDraft = normalizeCreationDraft({
    ...draft,
    updatedAt: new Date().toISOString()
  });
  writeRuntimeState({
    creationDraft: nextDraft
  }, registry);
  return nextDraft;
}

function clearPresentationCreationDraft(): JsonObject {
  return savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan: null,
    fields: {},
    outlineLocks: {},
    retrieval: null,
    stage: "brief"
  });
}

function getRuntimeLlmSettings(): JsonObject {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).llm;
}

function saveRuntimeLlmSettings(fields: JsonObject = {}): JsonObject {
  const registry = ensurePresentationsState();
  const modelOverride = typeof fields.modelOverride === "string"
    ? fields.modelOverride.trim()
    : "";

  return writeRuntimeState({
    llm: {
      modelOverride
    }
  }, registry).llm;
}

function listSavedThemes(): JsonObject[] {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).savedThemes;
}

function saveRuntimeTheme(fields: JsonObject = {}): JsonObject {
  const registry = ensurePresentationsState();
  const runtime = readRuntimeState(registry);
  const timestamp = new Date().toISOString();
  const name = String(fields.name || "Saved theme").trim() || "Saved theme";
  const id = createSlug(fields.id || name, "theme");
  const existing = runtime.savedThemes.filter((theme: JsonObject) => theme.id !== id);
  const savedTheme = {
    id,
    name,
    theme: normalizeVisualTheme({
      ...defaultVisualTheme,
      ...(fields.theme || fields.visualTheme || {})
    }),
    updatedAt: timestamp
  };

  writeRuntimeState({
    savedThemes: [
      savedTheme,
      ...existing
    ].slice(0, 30)
  }, registry);

  return savedTheme;
}

function updatePresentationMeta(id: unknown, fields: JsonObject): JsonObject {
  const paths = getPresentationPaths(id);
  const current = readJson(paths.metaFile, createDefaultPresentationMeta({ id }));
  const next = {
    ...asJsonObject(current),
    ...fields,
    id,
    updatedAt: new Date().toISOString()
  };
  writeJson(paths.metaFile, next);
  return next;
}

function readPresentationDeckContext(id: unknown): DeckContext {
  const paths = getPresentationPaths(id);
  if (!fs.existsSync(paths.rootDir)) {
    throw new Error(`Unknown presentation: ${id}`);
  }

  const source = asJsonObject(readJson(paths.deckContextFile, createDefaultDeckContext({ id })));
  return {
    ...source,
    deck: asJsonObject(source.deck),
    slides: Object.fromEntries(Object.entries(asJsonObject(source.slides))
      .map(([slideId, slideContext]) => [slideId, asJsonObject(slideContext)]))
  };
}

function readPresentationSlideSpecs(id: unknown): JsonObject[] {
  const paths = getPresentationPaths(id);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir).filter((fileName: string) => /^slide-\d+\.json$/.test(fileName)).sort((left: string, right: string) => left.localeCompare(right, undefined, { numeric: true }))
    : [];

  return slideFiles
    .map((fileName: string) => readJson(path.join(paths.slidesDir, fileName), null))
    .filter((slide: unknown) => {
      const source = asJsonObject(slide);
      return slide && source.archived !== true && source.skipped !== true;
    })
    .map((slide: unknown) => asJsonObject(slide));
}

const outlinePlanStore = createOutlinePlanStore({
  assertPresentationId,
  ensureAllowedDir,
  ensurePresentationExists(id: string): void {
    const registry = ensurePresentationsState();
    if (!registry.presentations.some((entry: RegistryEntry) => entry.id === id)) {
      throw new Error(`Unknown presentation: ${id}`);
    }
  },
  getActivePresentationId,
  getPresentationPaths,
  readJson,
  writeJson
});

function listOutlinePlans(id: unknown = getActivePresentationId(), options: { includeArchived?: boolean } = {}): OutlinePlan[] {
  return outlinePlanStore.listOutlinePlans(id, options);
}

function getOutlinePlan(id: unknown, planId: unknown): OutlinePlan {
  return outlinePlanStore.getOutlinePlan(id, planId);
}

function saveOutlinePlan(id: unknown, plan: unknown): OutlinePlan | undefined {
  return outlinePlanStore.saveOutlinePlan(id, plan);
}

function deleteOutlinePlan(id: unknown, planId: unknown): OutlinePlan[] {
  return outlinePlanStore.deleteOutlinePlan(id, planId);
}

function duplicateOutlinePlan(id: unknown, planId: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
  return outlinePlanStore.duplicateOutlinePlan(id, planId, fields);
}

function archiveOutlinePlan(id: unknown, planId: unknown): OutlinePlan | undefined {
  return outlinePlanStore.archiveOutlinePlan(id, planId);
}

function normalizeDeckPlanSlide(slide: unknown, index: number): DeckPlanSlide {
  const source = asJsonObject(slide);
  return {
    ...source,
    intent: normalizeCompactText(source.intent),
    keyMessage: normalizeCompactText(source.keyMessage),
    role: normalizeCompactText(source.role),
    sourceNeed: normalizeCompactText(source.sourceNeed),
    title: normalizeCompactText(source.title, `Slide ${index + 1}`),
    type: normalizeCompactText(source.type, "content"),
    value: normalizeCompactText(source.value),
    visualNeed: normalizeCompactText(source.visualNeed)
  };
}

function normalizeDeckPlan(deckPlan: unknown): DeckPlan {
  const source = asJsonObject(deckPlan);
  return {
    ...source,
    audience: normalizeCompactText(source.audience),
    language: normalizeCompactText(source.language),
    narrativeArc: normalizeCompactText(source.narrativeArc),
    outline: normalizeCompactText(source.outline),
    slides: Array.isArray(source.slides)
      ? source.slides.map(normalizeDeckPlanSlide)
      : [],
    thesis: normalizeCompactText(source.thesis)
  };
}

function deckPlanToOutlinePlan(presentationId: unknown, deckPlan: unknown, fields: JsonObject = {}): OutlinePlan {
  const normalizedDeckPlan = normalizeDeckPlan(deckPlan);
  const slides = normalizedDeckPlan.slides;
  if (!slides.length) {
    throw new Error("Expected deck plan slides before saving an outline plan");
  }

  return normalizeOutlinePlan({
    audience: fields.audience || normalizedDeckPlan.audience,
    intendedUse: fields.intendedUse || "derived-deck",
    name: fields.name || `${fields.title || "Approved"} outline`,
    objective: fields.objective || normalizedDeckPlan.thesis,
    purpose: fields.purpose || fields.objective || normalizedDeckPlan.thesis,
    sourcePresentationId: presentationId,
    sourceScope: fields.sourceScope || {
      materials: [],
      slides: [],
      sources: []
    },
    targetSlideCount: fields.targetSlideCount || slides.length,
    tone: fields.tone || "",
    traceability: [],
    sections: [
      {
        id: "approved-outline",
        title: "Approved outline",
        intent: normalizedDeckPlan.narrativeArc || "Approved staged creation outline.",
        slides: slides.map((slide: DeckPlanSlide, index: number) => ({
          id: `slide-${String(index + 1).padStart(2, "0")}`,
          intent: slide.intent || slide.keyMessage || "",
          layoutHint: slide.visualNeed || "",
          mustInclude: [slide.keyMessage || ""].filter(Boolean),
          role: slide.role || "",
          sourceSlideId: "",
          traceability: [],
          type: slide.type || "content",
          workingTitle: slide.title || `Slide ${index + 1}`
        }))
      }
    ]
  });
}

function createOutlinePlanFromDeckPlan(presentationId: unknown, deckPlan: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
  return saveOutlinePlan(presentationId, deckPlanToOutlinePlan(presentationId, deckPlan, fields));
}

function createOutlinePlanFromPresentation(id: unknown = getActivePresentationId(), fields: JsonObject = {}): OutlinePlan | undefined {
  const safeId = assertPresentationId(id);
  const paths = getPresentationPaths(safeId);
  if (!fs.existsSync(paths.rootDir)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  const context = readPresentationDeckContext(safeId);
  const deck = context.deck;
  const slides = readPresentationSlideSpecs(safeId);
  if (!slides.length) {
    throw new Error("Expected at least one slide before generating an outline plan");
  }

  const sourceStore: SourceStore = {
    sources: asJsonObjectArray(asJsonObject(readJson(paths.sourcesFile, { sources: [] })).sources)
  };
  const materialStore: MaterialStore = {
    materials: asJsonObjectArray(asJsonObject(readJson(paths.materialsFile, { materials: [] })).materials)
  };
  const sourceTraceability = Array.isArray(sourceStore.sources)
    ? sourceStore.sources.map((source: JsonObject) => ({
      kind: "source-snippet",
      range: source.text ? `0-${Math.min(String(source.text).length, 240)}` : "",
      snippetId: "chunk-0",
      sourceId: source.id
    }))
    : [];
  const materialTraceability = Array.isArray(materialStore.materials)
    ? materialStore.materials.map((material: JsonObject) => ({
      kind: "material",
      materialId: material.id
    }))
    : [];
  const deckTraceability = [
    ...slides.map((slide: JsonObject, index: number) => ({
      kind: "slide",
      slideId: slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`
    })),
    ...sourceTraceability,
    ...materialTraceability
  ];
  const plan = normalizeOutlinePlan({
    audience: fields.audience || deck.audience || "",
    intendedUse: fields.intendedUse || "current-deck-review",
    name: fields.name || `${deck.title || "Current deck"} outline plan`,
    objective: fields.objective || deck.objective || "",
    purpose: fields.purpose || deck.objective || `Review ${deck.title || safeId}.`,
    sourcePresentationId: safeId,
    sourceScope: {
      materials: materialStore.materials.map((material: JsonObject) => normalizeCompactText(material.id)).filter(Boolean),
      slides: slides.map((slide: JsonObject, index: number) => normalizeCompactText(slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`)),
      sources: sourceStore.sources.map((source: JsonObject) => normalizeCompactText(source.id)).filter(Boolean)
    },
    targetSlideCount: fields.targetSlideCount || slides.length,
    tone: fields.tone || deck.tone || "",
    traceability: deckTraceability,
    sections: [
      {
        id: "current-deck",
        title: "Current deck",
        intent: deck.objective || "Represent the current slide sequence as an editable outline plan.",
        traceability: deckTraceability,
        slides: slides.map((slide: JsonObject, index: number) => {
          const slideId = normalizeCompactText(slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`);
          const slideContext = context.slides[slideId] || {};
          const summary = normalizeCompactText(slide.summary || slide.note || slideContext.mustInclude || "");
          return {
            id: `intent-${String(index + 1).padStart(2, "0")}`,
            intent: slideContext.intent || summary || `Explain ${slide.title || `slide ${index + 1}`}.`,
            layoutHint: slideContext.layoutHint || slide.type || "",
            mustInclude: [slideContext.mustInclude || summary].filter(Boolean),
            role: index === 0 ? "opening" : index === slides.length - 1 && slides.length > 1 ? "handoff" : "concept",
            sourceSlideId: slideId,
            traceability: [
              {
                kind: "slide",
                slideId
              }
            ],
            type: normalizeCompactText(slide.type, "content"),
            value: slideContext.value || "",
            workingTitle: slide.title || `Slide ${index + 1}`
          };
        })
      }
    ]
  });

  return saveOutlinePlan(safeId, plan);
}

function outlinePlanToDeckPlan(plan: OutlinePlan): DeckPlan {
  const sections = Array.isArray(plan.sections) ? plan.sections : [];
  const slides = sections.flatMap((section: OutlinePlanSection) => Array.isArray(section.slides) ? section.slides : []);
  if (!slides.length) {
    throw new Error("Outline plan needs at least one slide intent before derivation");
  }

  return {
    audience: plan.audience || "",
    language: "",
    narrativeArc: sections.map((section: OutlinePlanSection) => `${section.title}: ${section.intent}`).join("\n"),
    outline: slides.map((slide: OutlinePlanSlide, index: number) => `${index + 1}. ${slide.workingTitle}`).join("\n"),
    slides: slides.map((slide: OutlinePlanSlide, index: number) => ({
      intent: slide.intent || "",
      keyMessage: Array.isArray(slide.mustInclude) && slide.mustInclude.length ? slide.mustInclude.join("; ") : slide.intent || "",
      role: slide.role || (index === 0 ? "opening" : index === slides.length - 1 && slides.length > 1 ? "handoff" : "concept"),
      sourceNeed: slide.sourceSlideId ? `Use source slide ${slide.sourceSlideId} when relevant.` : "Use selected source material when relevant.",
      title: slide.workingTitle || `Slide ${index + 1}`,
      type: slide.type || "content",
      value: slide.value || "",
      visualNeed: slide.layoutHint || "Use a simple readable layout."
    })),
    thesis: plan.objective || plan.purpose || ""
  };
}

function createDerivedPlaceholderSlide(planSlide: DeckPlanSlide, index: number, slideCount: number): JsonObject {
  const title = planSlide.title || `Slide ${index + 1}`;
  const message = planSlide.keyMessage || planSlide.intent || "Draft this slide from the outline plan.";

  if (index === 0) {
    return {
      type: "cover",
      title,
      logo: "slideotter",
      eyebrow: "Derived outline",
      summary: message,
      note: planSlide.intent || "",
      cards: [
        {
          id: "derived-intent",
          title: "Intent",
          body: planSlide.intent || message
        },
        {
          id: "derived-source",
          title: "Source",
          body: planSlide.sourceNeed || "Use selected source material when relevant."
        },
        {
          id: "derived-visual",
          title: "Visual",
          body: planSlide.visualNeed || "Use a simple readable layout."
        }
      ]
    };
  }

  if (index === slideCount - 1 && slideCount > 1) {
    return {
      type: "summary",
      title,
      eyebrow: "Derived outline",
      summary: message,
      resourcesTitle: "Plan cues",
      bullets: [
        {
          id: "derived-intent",
          title: "Intent",
          body: planSlide.intent || message
        },
        {
          id: "derived-message",
          title: "Message",
          body: message
        },
        {
          id: "derived-next",
          title: "Next",
          body: planSlide.value || "Use the outline as the drafting handoff."
        }
      ],
      resources: [
        {
          id: "derived-source",
          title: "Source need",
          body: planSlide.sourceNeed || "Use selected source material when relevant."
        },
        {
          id: "derived-role",
          title: "Slide role",
          body: planSlide.role || "Closing slide"
        }
      ]
    };
  }

  return {
    type: "content",
    title,
    eyebrow: "Derived outline",
    summary: message,
    signalsTitle: "Plan cues",
    guardrailsTitle: "Drafting notes",
    signals: [
      {
        id: "derived-intent",
        title: "Intent",
        body: planSlide.intent || message
      },
      {
        id: "derived-message",
        title: "Message",
        body: message
      },
      {
        id: "derived-source",
        title: "Source",
        body: planSlide.sourceNeed || "Use selected source material when relevant."
      }
    ],
    guardrails: [
      {
        id: "derived-visual",
        title: "Visual",
        body: planSlide.visualNeed || "Use a simple readable layout."
      },
      {
        id: "derived-audience",
        title: "Audience",
        body: planSlide.value || "Keep the slide useful for the stated audience."
      },
      {
        id: "derived-scope",
        title: "Scope",
        body: "Preserve the outline intent without adding unsupported claims."
      }
    ]
  };
}

function createOutlinePlanScaffoldSlide(planSlide: DeckPlanSlide, index: number): JsonObject {
  const title = planSlide.title || `Slide ${index + 1}`;
  const message = planSlide.keyMessage || planSlide.intent || "Draft this slide from the outline plan.";

  return {
    type: "content",
    title,
    eyebrow: "Outline plan",
    summary: message,
    signalsTitle: "Plan cues",
    guardrailsTitle: "Drafting notes",
    signals: [
      {
        id: "plan-intent",
        title: "Intent",
        body: planSlide.intent || message
      },
      {
        id: "plan-message",
        title: "Message",
        body: message
      },
      {
        id: "plan-source",
        title: "Source",
        body: planSlide.sourceNeed || "Use selected source material when relevant."
      }
    ],
    guardrails: [
      {
        id: "plan-visual",
        title: "Visual",
        body: planSlide.visualNeed || "Use a simple readable layout."
      },
      {
        id: "plan-audience",
        title: "Audience",
        body: planSlide.value || "Keep the slide useful for the stated audience."
      },
      {
        id: "plan-scope",
        title: "Scope",
        body: "Preserve the outline intent without adding unsupported claims."
      }
    ]
  };
}

function createPlanCandidateStats(entries: PlanCandidateEntry[]): JsonObject {
  return {
    archived: entries.filter((entry: PlanCandidateEntry) => entry.action === "remove").length,
    inserted: entries.filter((entry: PlanCandidateEntry) => entry.action === "insert").length,
    moved: entries.filter((entry: PlanCandidateEntry) => Number.isFinite(entry.currentIndex) && Number.isFinite(entry.proposedIndex) && entry.currentIndex !== entry.proposedIndex).length,
    replaced: 0,
    retitled: entries.filter((entry: PlanCandidateEntry) => entry.currentTitle && entry.proposedTitle && normalizeCompactText(entry.currentTitle).toLowerCase() !== normalizeCompactText(entry.proposedTitle).toLowerCase()).length,
    shared: 0,
    total: entries.length
  };
}

function proposeDeckChangesFromOutlinePlan(presentationId: unknown, planId: unknown): JsonObject {
  const safeId = assertPresentationId(presentationId);
  const plan = getOutlinePlan(safeId, planId);
  if (plan.archivedAt) {
    throw new Error("Archived outline plans cannot propose deck changes.");
  }

  const deckPlan = outlinePlanToDeckPlan(plan);
  const currentSlides: CurrentSlideEntry[] = readPresentationSlideSpecs(safeId).map((slide: JsonObject, index: number) => ({
    id: `slide-${String(slide.index || index + 1).padStart(2, "0")}`,
    index: Number(slide.index || index + 1),
    title: normalizeCompactText(slide.title, `Slide ${index + 1}`),
    type: normalizeCompactText(slide.type, "content")
  }));
  const entries: PlanCandidateEntry[] = [];

  deckPlan.slides.forEach((planSlide: DeckPlanSlide, index: number) => {
    const currentSlide = currentSlides[index] || null;
    const proposedIndex = index + 1;
    const proposedTitle = planSlide.title || `Slide ${proposedIndex}`;
    if (!currentSlide) {
      entries.push({
        action: "insert",
        currentIndex: null,
        currentTitle: "",
        proposedIndex,
        proposedTitle,
        rationale: planSlide.intent || planSlide.keyMessage || "",
        role: planSlide.role || "concept",
        scaffold: {
          slideSpec: createOutlinePlanScaffoldSlide(planSlide, proposedIndex)
        },
        slideId: null,
        summary: planSlide.keyMessage || planSlide.intent || "",
        type: "content"
      });
      return;
    }

    const moved = currentSlide.index !== proposedIndex;
    const retitled = normalizeCompactText(currentSlide.title).toLowerCase() !== normalizeCompactText(proposedTitle).toLowerCase();
    entries.push({
      action: moved && retitled ? "move-retitle" : moved ? "move" : retitled ? "retitle" : "keep",
      currentIndex: currentSlide.index,
      currentTitle: currentSlide.title,
      proposedIndex,
      proposedTitle,
      rationale: planSlide.intent || planSlide.keyMessage || "",
      role: planSlide.role || "concept",
      slideId: currentSlide.id,
      summary: planSlide.keyMessage || planSlide.intent || "",
      type: currentSlide.type
    });
  });

  currentSlides.slice(deckPlan.slides.length).forEach((slide: CurrentSlideEntry) => {
    entries.push({
      action: "remove",
      currentIndex: slide.index,
      currentTitle: slide.title,
      proposedIndex: null,
      proposedTitle: "",
      rationale: "Outside the selected outline plan target length.",
      role: "archive",
      slideId: slide.id,
      summary: "Archive this slide if applying the outline plan to the current deck.",
      type: slide.type
    });
  });

  const planStats = createPlanCandidateStats(entries);
  const proposedSequence = entries
    .filter((entry: PlanCandidateEntry): entry is PlanCandidateEntry & { proposedIndex: number } => Number.isFinite(entry.proposedIndex) && Boolean(entry.proposedTitle))
    .sort((left, right) => left.proposedIndex - right.proposedIndex)
    .map((entry: PlanCandidateEntry & { proposedIndex: number }) => ({
      index: entry.proposedIndex,
      title: entry.proposedTitle
    }));

  return {
    id: `outline-plan-candidate-${plan.id}`,
    kindLabel: "Outline plan",
    label: plan.name,
    outline: deckPlan.outline,
    diff: {
      counts: {
        afterSlides: proposedSequence.length,
        beforeSlides: currentSlides.length
      },
      deck: {
        changes: [],
        count: 0,
        summary: "No shared deck settings are changed by this outline-plan candidate."
      },
      files: [],
      outline: {
        added: entries.filter((entry: PlanCandidateEntry) => entry.action === "insert").map((entry: PlanCandidateEntry) => entry.proposedTitle),
        archived: entries.filter((entry: PlanCandidateEntry) => entry.action === "remove").map((entry: PlanCandidateEntry) => entry.currentTitle),
        moved: entries.filter((entry: PlanCandidateEntry) => Number.isFinite(entry.currentIndex) && Number.isFinite(entry.proposedIndex) && entry.currentIndex !== entry.proposedIndex).map((entry: PlanCandidateEntry) => ({
          from: entry.currentIndex,
          title: entry.proposedTitle || entry.currentTitle,
          to: entry.proposedIndex
        })),
        retitled: entries.filter((entry: PlanCandidateEntry) => entry.currentTitle && entry.proposedTitle && normalizeCompactText(entry.currentTitle).toLowerCase() !== normalizeCompactText(entry.proposedTitle).toLowerCase()).map((entry: PlanCandidateEntry) => ({
          before: entry.currentTitle,
          after: entry.proposedTitle
        }))
      },
      summary: `Plan proposes ${planStats.total} current-deck step${planStats.total === 1 ? "" : "s"}.`
    },
    planStats,
    preview: {
      currentSequence: currentSlides.map((slide) => ({
        index: slide.index,
        title: slide.title
      })),
      overview: plan.purpose || plan.objective || "Apply this outline plan to the current deck.",
      previewHints: [],
      proposedSequence
    },
    promptSummary: plan.purpose || "",
    slides: entries,
    summary: `Propose current-deck changes from outline plan "${plan.name}".`
  };
}

function derivePresentationFromOutlinePlan(sourcePresentationId: unknown, planId: unknown, options: JsonObject = {}): JsonObject {
  const safeSourceId = assertPresentationId(sourcePresentationId);
  const plan = getOutlinePlan(safeSourceId, planId);
  const sourceContext = readPresentationDeckContext(safeSourceId);
  const sourceDeck = sourceContext.deck || {};
  const deckPlan = outlinePlanToDeckPlan(plan);
  const title = normalizeCompactText(options.title, `${plan.name} deck`);
  const slideSpecs = deckPlan.slides.map((slide, index) => createDerivedPlaceholderSlide(slide, index, deckPlan.slides.length));
  const slideContexts = Object.fromEntries(deckPlan.slides.map((slide, index) => [
    `slide-${String(index + 1).padStart(2, "0")}`,
    {
      intent: slide.intent,
      layoutHint: slide.visualNeed,
      mustInclude: slide.keyMessage,
      notes: slide.sourceNeed,
      title: slide.title,
      value: slide.value || ""
    }
  ]));
  const presentation = createPresentation({
    audience: options.copyDeckContext === false ? plan.audience : plan.audience || sourceDeck.audience || "",
    constraints: options.copyDeckContext === false ? "" : sourceDeck.constraints || "",
    initialSlideSpecs: slideSpecs,
    objective: plan.objective || plan.purpose || sourceDeck.objective || "",
    outline: deckPlan.outline,
    targetSlideCount: deckPlan.slides.length,
    themeBrief: options.copyDeckContext === false ? "" : sourceDeck.themeBrief || "",
    title,
    tone: plan.tone || sourceDeck.tone || "",
    visualTheme: options.copyTheme === false ? undefined : sourceDeck.visualTheme
  });
  const targetPaths = getPresentationPaths(presentation.id);
  const targetContext = readPresentationDeckContext(presentation.id);
  if (options.copySources === true) {
    writeJson(targetPaths.sourcesFile, readJson(getPresentationPaths(safeSourceId).sourcesFile, { sources: [] }));
  }
  if (options.copyMaterials === true) {
    const sourcePaths = getPresentationPaths(safeSourceId);
    duplicateDirectory(sourcePaths.materialsDir, targetPaths.materialsDir);
    writeJson(targetPaths.materialsFile, readJson(sourcePaths.materialsFile, { materials: [] }));
  }
  writeJson(targetPaths.deckContextFile, {
    ...targetContext,
    deck: {
      ...targetContext.deck,
      lineage: {
        derivedAt: new Date().toISOString(),
        outlinePlanId: plan.id,
        sourcePresentationId: safeSourceId
      },
      outline: deckPlan.outline
    },
    slides: slideContexts
  });
  saveOutlinePlan(presentation.id, {
    ...plan,
    id: plan.id,
    parentPlanId: plan.id,
    sourcePresentationId: safeSourceId
  });

  return {
    outlinePlan: plan,
    presentation: readPresentationSummary(presentation.id)
  };
}

function getUniquePresentationId(title: unknown): string {
  const registry = ensurePresentationsState();
  const base = createSlug(title, "presentation");
  let candidate = base;
  let suffix = 2;

  while (registry.presentations.some((entry) => entry.id === candidate) || fs.existsSync(presentationRoot(candidate))) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function readFileMtime(fileName: string): number {
  try {
    return fs.statSync(fileName).mtime.getTime();
  } catch (error) {
    return 0;
  }
}

function readPresentationSummary(id: unknown): PresentationSummary {
  const safeId = assertPresentationId(id);
  const paths = getPresentationPaths(id);
  const meta = asJsonObject(readJson(paths.metaFile, createDefaultPresentationMeta({ id: safeId })));
  const deckContext = asJsonObject(readJson(paths.deckContextFile, null));
  const deck = asJsonObject(deckContext.deck);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir).filter((fileName: string) => /^slide-\d+\.json$/.test(fileName)).sort((left: string, right: string) => left.localeCompare(right, undefined, { numeric: true }))
    : [];
  const firstSlideFile = slideFiles[0];
  const firstSlideSpec = firstSlideFile ? readJson(path.join(paths.slidesDir, firstSlideFile), null) : null;
  const slidePaths = slideFiles.map((fileName: string) => path.join(paths.slidesDir, fileName));
  const updatedAtMs = [
    paths.metaFile,
    paths.deckContextFile,
    ...slidePaths
  ].reduce((latest: number, fileName: string) => Math.max(latest, readFileMtime(fileName)), 0);
  const lengthProfile = asJsonObject(deck.lengthProfile);

  return {
    audience: deck.audience || "",
    id: safeId,
    title: normalizeCompactText(deck.title || meta.title || safeId, safeId),
    description: normalizeCompactText(deck.objective || meta.description || deck.subject),
    targetSlideCount: normalizeTargetSlideCount(lengthProfile.targetCount),
    createdAt: meta.createdAt || "",
    objective: deck.objective || "",
    subject: deck.subject || "",
    tone: deck.tone || "",
    updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : (meta.updatedAt || ""),
    slideCount: slideFiles.filter((fileName: string) => {
      const slide = asJsonObject(readJson(path.join(paths.slidesDir, fileName), {}));
      return slide.archived !== true && slide.skipped !== true;
    }).length,
    firstSlideSpec,
    theme: deck.visualTheme || null
  };
}

function listPresentations(): JsonObject {
  const registry = ensurePresentationsState();
  const runtime = readRuntimeState(registry);

  return {
    activePresentationId: runtime.activePresentationId,
    presentations: registry.presentations.map((entry: RegistryEntry) => readPresentationSummary(entry.id))
  };
}

function createPresentation(fields: JsonObject = {}): PresentationSummary {
  const id = getUniquePresentationId(fields.title || "Untitled presentation");
  const paths = getPresentationPaths(id);
  const timestamp = new Date().toISOString();
  const title = normalizeCompactText(fields.title, "Untitled presentation");
  const context = createDefaultDeckContext({
    ...fields,
    title,
    outline: fields.outline || "1. Opening claim\n2. Supporting evidence\n3. Decision or handoff"
  });
  const meta = createDefaultPresentationMeta({
    id,
    title,
    description: fields.objective || fields.description || "",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  ensurePresentationFiles(id, meta);
  writeJson(paths.metaFile, meta);
  writeJson(paths.deckContextFile, context);
  writeJson(paths.variantsFile, { variants: [] });
  const initialSlideSpecs = Array.isArray(fields.initialSlideSpecs) && fields.initialSlideSpecs.length
    ? fields.initialSlideSpecs
    : createInitialSlideSpecs(asJsonObject(context.deck));

  initialSlideSpecs.forEach((slideSpec: unknown, index: number) => {
    writeSlideFile(paths, index + 1, asJsonObject(slideSpec));
  });

  const registry = ensurePresentationsState();
  const nextRegistry = writeRegistry({
    presentations: [
      ...registry.presentations,
      {
        id,
        title
      }
    ]
  });
  writeRuntimeState({
    activePresentationId: id
  }, nextRegistry);

  return readPresentationSummary(id);
}

function regeneratePresentationSlides(id: unknown, slideSpecs: unknown, fields: JsonObject = {}): PresentationSummary {
  const safeId = assertPresentationId(id);
  const registry = ensurePresentationsState();
  if (!registry.presentations.some((entry: RegistryEntry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }
  if (!Array.isArray(slideSpecs) || !slideSpecs.length) {
    throw new Error("Expected generated slide specs");
  }

  const paths = getPresentationPaths(safeId);
  const currentContext = readPresentationDeckContext(safeId);
  const currentDeck = currentContext.deck;
  const timestamp = new Date().toISOString();
  const normalizedSlideSpecs = slideSpecs.map((slideSpec: unknown) => asJsonObject(slideSpec));
  const activeCount = normalizedSlideSpecs.filter((slideSpec: JsonObject) => slideSpec.skipped !== true).length;
  const skippedCount = normalizedSlideSpecs.filter((slideSpec: JsonObject) => slideSpec.skipped === true).length;
  const currentLengthProfile = asJsonObject(currentDeck.lengthProfile);
  const targetCount = normalizeTargetSlideCount(
    fields.targetSlideCount ?? fields.targetCount ?? currentLengthProfile.targetCount
  ) || normalizedSlideSpecs.length;

  removeSlideFiles(paths);
  normalizedSlideSpecs.forEach((slideSpec: JsonObject, index: number) => {
    writeSlideFile(paths, index + 1, slideSpec);
  });
  writeJson(paths.deckContextFile, {
    ...currentContext,
    deck: {
      ...currentDeck,
      lengthProfile: {
        activeCount,
        skippedCount,
        targetCount,
        updatedAt: timestamp
      },
      outline: fields.outline || currentDeck.outline || ""
    },
    slides: fields.slideContexts && typeof fields.slideContexts === "object" && !Array.isArray(fields.slideContexts)
      ? fields.slideContexts
      : currentContext.slides
  });
  updatePresentationMeta(safeId, {});

  return readPresentationSummary(safeId);
}

function duplicateDirectory(sourceDir: string, targetDir: string): void {
  ensureAllowedDir(targetDir);
  fs.cpSync(sourceDir, targetDir, {
    recursive: true
  });
}

function duplicatePresentation(sourceId: unknown, fields: JsonObject = {}): PresentationSummary {
  const safeSourceId = assertPresentationId(sourceId);
  const sourcePaths = getPresentationPaths(sourceId);
  if (!fs.existsSync(sourcePaths.rootDir)) {
    throw new Error(`Unknown presentation: ${sourceId}`);
  }

  const sourceSummary = readPresentationSummary(safeSourceId);
  const title = fields.title || `${sourceSummary.title} copy`;
  const id = getUniquePresentationId(title);
  const targetPaths = getPresentationPaths(id);
  duplicateDirectory(sourcePaths.rootDir, targetPaths.rootDir);
  const timestamp = new Date().toISOString();
  updatePresentationMeta(id, {
    id,
    title,
    description: sourceSummary.description,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  const context = readPresentationDeckContext(id);
  writeJson(targetPaths.deckContextFile, {
    ...context,
    deck: {
      ...context.deck,
      title
    }
  });

  const registry = ensurePresentationsState();
  const nextRegistry = writeRegistry({
    presentations: [
      ...registry.presentations,
      {
        id,
        title
      }
    ]
  });
  writeRuntimeState({
    activePresentationId: id
  }, nextRegistry);

  return readPresentationSummary(id);
}

function deletePresentation(id: unknown): PresentationsRegistry {
  const registry = ensurePresentationsState();
  const safeId = assertPresentationId(id);
  if (!registry.presentations.some((entry: RegistryEntry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }
  if (registry.presentations.length <= 1) {
    throw new Error("Cannot delete the only presentation.");
  }

  const runtime = readRuntimeState(registry);
  const nextPresentations = registry.presentations.filter((entry: RegistryEntry) => entry.id !== safeId);
  const nextActiveId = runtime.activePresentationId === safeId
    ? nextPresentations[0]?.id || defaultPresentationId
    : runtime.activePresentationId;
  const rootDir = presentationRoot(safeId);
  if (fs.existsSync(rootDir)) {
    fs.rmSync(rootDir, {
      recursive: true,
      force: true
    });
  }

  const nextRegistry = writeRegistry({
    presentations: nextPresentations
  });
  writeRuntimeState({
    activePresentationId: nextActiveId
  }, nextRegistry);

  return nextRegistry;
}

export {
  createDefaultDeckContext,
  createDefaultPresentationMeta,
  archiveOutlinePlan,
  createOutlinePlanFromDeckPlan,
  createOutlinePlanFromPresentation,
  createPresentation,
  createSlug,
  defaultPresentationId,
  deletePresentation,
  deleteOutlinePlan,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  duplicatePresentation,
  ensurePresentationFiles,
  ensurePresentationsState,
  getActivePresentationId,
  getActivePresentationPaths,
  getOutlinePlan,
  getPresentationPaths,
  getPresentationCreationDraft,
  getRuntimeLlmSettings,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  proposeDeckChangesFromOutlinePlan,
  readPresentationDeckContext,
  readPresentationSummary,
  regeneratePresentationSlides,
  listPresentations,
  listSavedThemes,
  presentationRuntimeFile,
  presentationsRegistryFile,
  clearPresentationCreationDraft,
  savePresentationCreationDraft,
  saveOutlinePlan,
  saveRuntimeLlmSettings,
  saveRuntimeTheme,
  setActivePresentation,
  updatePresentationMeta
};
