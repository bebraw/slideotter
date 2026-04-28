const fs = require("fs");
const path = require("path");
const {
  presentationsDir,
  stateDir
} = require("./paths.ts");
const {
  defaultDesignConstraints,
  normalizeDesignConstraints
} = require("./design-constraints.ts");
const {
  defaultValidationSettings,
  normalizeValidationSettings
} = require("./validation-settings.ts");
const {
  deckMeta,
  defaultDeckLanguage,
  normalizeVisualTheme,
  theme: defaultVisualTheme
} = require("./deck-theme.ts");
const {
  ensureAllowedDir,
  writeAllowedJson
} = require("./write-boundary.ts");

const presentationsRegistryFile = path.join(stateDir, "presentations.json");
const presentationRuntimeFile = path.join(stateDir, "runtime.json");
const defaultPresentationId = "slideotter";

function createSlug(value, fallback = "presentation") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return slug || fallback;
}

function assertPresentationId(id) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(id || ""))) {
    throw new Error(`Invalid presentation id: ${id}`);
  }

  return id;
}

function presentationRoot(id) {
  return path.join(presentationsDir, assertPresentationId(id));
}

function getPresentationPaths(id) {
  const rootDir = presentationRoot(id);

  return {
    id,
    metaFile: path.join(rootDir, "presentation.json"),
    materialsDir: path.join(rootDir, "materials"),
    materialsFile: path.join(rootDir, "state", "materials.json"),
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

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  writeAllowedJson(fileName, value);
}

function writeSlideFile(paths, index, slideSpec) {
  writeJson(path.join(paths.slidesDir, `slide-${String(index).padStart(2, "0")}.json`), {
    ...slideSpec,
    index
  });
}

function removeSlideFiles(paths) {
  const files = fs.existsSync(paths.slidesDir) ? fs.readdirSync(paths.slidesDir) : [];
  files
    .filter((fileName) => /^slide-\d+\.(json|js)$/.test(fileName))
    .forEach((fileName) => {
      fs.rmSync(path.join(paths.slidesDir, fileName), {
        force: true
      });
    });
}

function normalizeTargetSlideCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(Math.max(1, parsed), 200);
}

function normalizeCompactText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function uniqueById(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry || !entry.id || seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

function normalizeTraceabilityEntry(entry) {
  const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const kind = normalizeCompactText(source.kind, "slide");
  const normalized: any = { kind };

  [
    "slideId",
    "sourceId",
    "snippetId",
    "materialId",
    "sectionId",
    "outlineSlideId",
    "range"
  ].forEach((field) => {
    const value = normalizeCompactText(source[field]);
    if (value) {
      normalized[field] = value;
    }
  });

  return Object.keys(normalized).length > 1 ? normalized : null;
}

function normalizeOutlinePlanSlide(slide, index) {
  const source = slide && typeof slide === "object" && !Array.isArray(slide) ? slide : {};
  const workingTitle = normalizeCompactText(source.workingTitle || source.title, `Slide ${index + 1}`);
  const intent = normalizeCompactText(source.intent || source.keyMessage, "Explain this part of the story.");
  const id = createSlug(source.id || source.sourceSlideId || workingTitle || `slide-${index + 1}`, `slide-${index + 1}`);
  const mustInclude = Array.isArray(source.mustInclude)
    ? source.mustInclude.map((item) => normalizeCompactText(item)).filter(Boolean).slice(0, 8)
    : normalizeCompactText(source.mustInclude || source.keyMessage)
      ? [normalizeCompactText(source.mustInclude || source.keyMessage)]
      : [];

  return {
    id,
    intent,
    layoutHint: normalizeCompactText(source.layoutHint || source.visualNeed),
    mustInclude,
    role: normalizeCompactText(source.role),
    sourceSlideId: normalizeCompactText(source.sourceSlideId || source.slideId),
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter(Boolean)
      : [],
    workingTitle
  };
}

function normalizeOutlinePlanSection(section, index) {
  const source = section && typeof section === "object" && !Array.isArray(section) ? section : {};
  const title = normalizeCompactText(source.title, index === 0 ? "Current deck" : `Section ${index + 1}`);
  const id = createSlug(source.id || title || `section-${index + 1}`, `section-${index + 1}`);
  const slides = Array.isArray(source.slides)
    ? source.slides.map(normalizeOutlinePlanSlide).filter((slide) => slide.workingTitle && slide.intent)
    : [];

  return {
    id,
    intent: normalizeCompactText(source.intent, "Group related slide intents for review."),
    slides,
    title,
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter(Boolean)
      : []
  };
}

function normalizeOutlinePlan(plan, fallback: any = {}) {
  const source = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  const timestamp = new Date().toISOString();
  const name = normalizeCompactText(source.name || fallback.name, "Outline plan");
  const id = createSlug(source.id || name, "outline-plan");
  const sections = Array.isArray(source.sections)
    ? source.sections.map(normalizeOutlinePlanSection).filter((section) => section.slides.length)
    : [];

  if (!sections.length) {
    throw new Error("Outline plan needs at least one section with one slide intent.");
  }

  const targetSlideCount = normalizeTargetSlideCount(
    source.targetSlideCount ?? fallback.targetSlideCount
  ) || sections.reduce((count, section) => count + section.slides.length, 0);

  return {
    id,
    name,
    sourcePresentationId: normalizeCompactText(source.sourcePresentationId || fallback.sourcePresentationId),
    parentPlanId: normalizeCompactText(source.parentPlanId || fallback.parentPlanId),
    purpose: normalizeCompactText(source.purpose || fallback.purpose),
    audience: normalizeCompactText(source.audience || fallback.audience),
    targetSlideCount,
    tone: normalizeCompactText(source.tone || fallback.tone),
    objective: normalizeCompactText(source.objective || fallback.objective),
    intendedUse: normalizeCompactText(source.intendedUse || fallback.intendedUse),
    sourceScope: {
      slides: Array.isArray(source.sourceScope && source.sourceScope.slides)
        ? source.sourceScope.slides.map((item) => normalizeCompactText(item)).filter(Boolean)
        : [],
      sources: Array.isArray(source.sourceScope && source.sourceScope.sources)
        ? source.sourceScope.sources.map((item) => normalizeCompactText(item)).filter(Boolean)
        : [],
      materials: Array.isArray(source.sourceScope && source.sourceScope.materials)
        ? source.sourceScope.materials.map((item) => normalizeCompactText(item)).filter(Boolean)
        : []
    },
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter(Boolean)
      : [],
    sections,
    archivedAt: source.archivedAt || fallback.archivedAt || null,
    createdAt: source.createdAt || fallback.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeOutlinePlansStore(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const plans = Array.isArray(source.plans)
    ? source.plans.map((plan) => {
      try {
        return normalizeOutlinePlan(plan);
      } catch (error) {
        return null;
      }
    }).filter(Boolean)
    : [];

  return {
    plans: uniqueById(plans).slice(0, 50)
  };
}

function createInitialSlideSpecs(deck) {
  const title = deck.title || "Untitled presentation";
  const objective = deck.objective || `Explain ${title} clearly.`;
  const constraints = deck.constraints || "Keep the presentation concise, readable, and focused.";
  const audience = deck.audience || "Audience to define";
  const tone = deck.tone || "Direct and practical";
  const targetSlideCount = normalizeTargetSlideCount(deck.lengthProfile && deck.lengthProfile.targetCount);
  const targetLine = targetSlideCount
    ? `Target length: ${targetSlideCount} slide${targetSlideCount === 1 ? "" : "s"}.`
    : "Target length can be set from Deck Planning.";

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
      note: "Use Deck Planning to generate alternatives once the constraints read right.",
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

function createDefaultDeckContext(fields: any = {}) {
  const timestamp = fields.lengthProfile && fields.lengthProfile.updatedAt
    ? fields.lengthProfile.updatedAt
    : new Date().toISOString();
  const targetSlideCount = normalizeTargetSlideCount(
    fields.targetSlideCount ?? fields.targetCount ?? (fields.lengthProfile && fields.lengthProfile.targetCount)
  );
  const visualTheme = normalizeVisualTheme({
    ...defaultVisualTheme,
    ...(fields.visualTheme || {})
  });
  const validationSettings = normalizeValidationSettings({
    ...defaultValidationSettings,
    ...(fields.validationSettings || {}),
    rules: {
      ...(defaultValidationSettings.rules || {}),
      ...(fields.validationSettings && fields.validationSettings.rules ? fields.validationSettings.rules : {})
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

function createDefaultPresentationMeta(fields: any = {}) {
  const timestamp = new Date().toISOString();

  return {
    id: fields.id || defaultPresentationId,
    title: fields.title || "slideotter",
    description: fields.description || "",
    createdAt: fields.createdAt || timestamp,
    updatedAt: fields.updatedAt || timestamp
  };
}

function createDefaultRegistry() {
  return {
    presentations: [
      {
        id: defaultPresentationId,
        title: "slideotter"
      }
    ]
  };
}

function normalizeRegistry(registry) {
  const source = registry && typeof registry === "object" ? registry : {};
  const presentations = Array.isArray(source.presentations)
    ? source.presentations
      .filter((entry) => entry && typeof entry.id === "string")
      .map((entry) => ({
        id: assertPresentationId(entry.id),
        title: entry.title || entry.id
      }))
    : [];

  const normalized = presentations.length
    ? presentations
    : createDefaultRegistry().presentations;

  return {
    presentations: normalized
  };
}

function defaultActivePresentationId(registry) {
  const entries = registry.presentations || [];
  return entries.some((entry) => entry.id === defaultPresentationId)
    ? defaultPresentationId
    : entries[0].id;
}

function normalizeCreationDraft(draft) {
  const source = draft && typeof draft === "object" && !Array.isArray(draft) ? draft : {};
  const fields = source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)
    ? source.fields
    : {};
  const contentRunSource = source.contentRun && typeof source.contentRun === "object" && !Array.isArray(source.contentRun)
    ? source.contentRun
    : null;
  const outlineLocks = source.outlineLocks && typeof source.outlineLocks === "object" && !Array.isArray(source.outlineLocks)
    ? Object.fromEntries(Object.entries(source.outlineLocks)
      .filter(([key, value]) => /^\d+$/.test(key) && value === true)
      .map(([key]) => [key, true]))
    : {};

  const normalizeContentRunSlide = (value) => {
    const slide = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const status = ["pending", "generating", "complete", "failed"].includes(slide.status) ? slide.status : "pending";
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

  const normalizeContentRun = (value) => {
    if (!value) {
      return null;
    }

    const status = ["running", "stopped", "failed", "completed"].includes(value.status) ? value.status : "running";
    const slideCount = Number.isFinite(Number(value.slideCount)) ? Number(value.slideCount) : 0;
    const slides = Array.isArray(value.slides)
      ? value.slides.map(normalizeContentRunSlide).slice(0, Math.max(0, slideCount || value.slides.length || 0))
      : [];
    const completed = Number.isFinite(Number(value.completed)) ? Number(value.completed) : slides.filter((slide) => slide.status === "complete").length;
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
        ? value.materials.filter((item) => item && typeof item === "object" && !Array.isArray(item)).slice(0, 20)
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
      imageSearch: fields.imageSearch && typeof fields.imageSearch === "object" && !Array.isArray(fields.imageSearch)
        ? {
            count: normalizeTargetSlideCount(fields.imageSearch.count) || 3,
            provider: String(fields.imageSearch.provider || "openverse"),
            query: String(fields.imageSearch.query || ""),
            restrictions: String(fields.imageSearch.restrictions || "")
          }
        : {
            count: 3,
            provider: "openverse",
            query: "",
            restrictions: ""
          },
      objective: String(fields.objective || ""),
      presentationSourceText: String(fields.presentationSourceText || ""),
      sourcingStyle: ["compact-references", "inline-notes", "none"].includes(fields.sourcingStyle)
        ? fields.sourcingStyle
        : "compact-references",
      targetSlideCount: normalizeTargetSlideCount(fields.targetSlideCount) || 5,
      themeBrief: String(fields.themeBrief || ""),
      title: String(fields.title || ""),
      tone: String(fields.tone || ""),
      visualTheme: normalizeVisualTheme({
        ...defaultVisualTheme,
        ...(fields.visualTheme || {})
      })
    },
    retrieval: source.retrieval && typeof source.retrieval === "object" && !Array.isArray(source.retrieval)
      ? source.retrieval
      : null,
    outlineLocks,
    outlineDirty: source.outlineDirty === true,
    stage: ["brief", "structure", "content", "theme", "sources"].includes(source.stage)
      ? source.stage
      : "brief",
    updatedAt: source.updatedAt || null
  };
}

function normalizeSavedThemes(themes) {
  const source = Array.isArray(themes) ? themes : [];
  const seen = new Set();

  return source
    .filter((theme) => theme && typeof theme === "object" && !Array.isArray(theme))
    .map((theme, index) => {
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

function normalizeSavedLayouts(layouts) {
  const source = Array.isArray(layouts) ? layouts : [];
  const seen = new Set();

  return source
    .filter((layout) => layout && typeof layout === "object" && !Array.isArray(layout))
    .map((layout, index) => {
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

function normalizeRuntimeState(runtime, registry, fallbackActivePresentationId = defaultActivePresentationId(registry)) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const activePresentationId = registry.presentations.some((entry) => entry.id === source.activePresentationId)
    ? source.activePresentationId
    : fallbackActivePresentationId;

  return {
    activePresentationId,
    creationDraft: normalizeCreationDraft(source.creationDraft),
    savedLayouts: normalizeSavedLayouts(source.savedLayouts),
    savedThemes: normalizeSavedThemes(source.savedThemes)
  };
}

function readRegistry() {
  return normalizeRegistry(readJson(presentationsRegistryFile, createDefaultRegistry()));
}

function readRuntimeState(registry = readRegistry()) {
  const legacyRegistry = readJson(presentationsRegistryFile, {});
  const fallbackActivePresentationId = registry.presentations.some((entry) => entry.id === legacyRegistry.activePresentationId)
    ? legacyRegistry.activePresentationId
    : defaultActivePresentationId(registry);

  return normalizeRuntimeState(readJson(presentationRuntimeFile, {
    activePresentationId: fallbackActivePresentationId
  }), registry, fallbackActivePresentationId);
}

function writeRuntimeState(runtime, registry = readRegistry()) {
  const current = readJson(presentationRuntimeFile, {});
  const normalized = normalizeRuntimeState({
    ...current,
    ...runtime
  }, registry);
  writeJson(presentationRuntimeFile, normalized);
  return normalized;
}

function writeRegistry(registry) {
  const normalized = normalizeRegistry(registry);
  writeJson(presentationsRegistryFile, normalized);
  return normalized;
}

function ensurePresentationFiles(id, fields: any = {}) {
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

  if (!fs.existsSync(paths.sourcesFile)) {
    writeJson(paths.sourcesFile, { sources: [] });
  }

  if (!fs.existsSync(paths.outlinePlansFile)) {
    writeJson(paths.outlinePlansFile, { plans: [] });
  }
}

function ensurePresentationsState() {
  ensureAllowedDir(stateDir);
  ensureAllowedDir(presentationsDir);

  if (!fs.existsSync(presentationsRegistryFile)) {
    writeRegistry(createDefaultRegistry());
  }

  const registry = readRegistry();
  registry.presentations.forEach((entry) => ensurePresentationFiles(entry.id, entry));
  return registry;
}

function getActivePresentationId() {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).activePresentationId;
}

function getActivePresentationPaths() {
  return getPresentationPaths(getActivePresentationId());
}

function setActivePresentation(id) {
  const registry = ensurePresentationsState();
  const safeId = assertPresentationId(id);
  if (!registry.presentations.some((entry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  return writeRuntimeState({
    activePresentationId: safeId
  }, registry);
}

function getPresentationCreationDraft() {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).creationDraft;
}

function savePresentationCreationDraft(draft) {
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

function clearPresentationCreationDraft() {
  return savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan: null,
    fields: {},
    outlineLocks: {},
    retrieval: null,
    stage: "brief"
  });
}

function listSavedThemes() {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).savedThemes;
}

function saveRuntimeTheme(fields: any = {}) {
  const registry = ensurePresentationsState();
  const runtime = readRuntimeState(registry);
  const timestamp = new Date().toISOString();
  const name = String(fields.name || "Saved theme").trim() || "Saved theme";
  const id = createSlug(fields.id || name, "theme");
  const existing = runtime.savedThemes.filter((theme) => theme.id !== id);
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

function updatePresentationMeta(id, fields) {
  const paths = getPresentationPaths(id);
  const current = readJson(paths.metaFile, createDefaultPresentationMeta({ id }));
  const next = {
    ...current,
    ...fields,
    id,
    updatedAt: new Date().toISOString()
  };
  writeJson(paths.metaFile, next);
  return next;
}

function readPresentationDeckContext(id) {
  const paths = getPresentationPaths(id);
  if (!fs.existsSync(paths.rootDir)) {
    throw new Error(`Unknown presentation: ${id}`);
  }

  return readJson(paths.deckContextFile, createDefaultDeckContext({ id }));
}

function readPresentationSlideSpecs(id) {
  const paths = getPresentationPaths(id);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir).filter((fileName) => /^slide-\d+\.json$/.test(fileName)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    : [];

  return slideFiles
    .map((fileName) => readJson(path.join(paths.slidesDir, fileName), null))
    .filter((slide) => slide && slide.archived !== true && slide.skipped !== true);
}

function readOutlinePlansStore(id = getActivePresentationId()) {
  const paths = getPresentationPaths(id);
  ensureAllowedDir(paths.stateDir);
  if (!fs.existsSync(paths.outlinePlansFile)) {
    writeJson(paths.outlinePlansFile, { plans: [] });
  }

  return normalizeOutlinePlansStore(readJson(paths.outlinePlansFile, { plans: [] }));
}

function writeOutlinePlansStore(id, store) {
  const paths = getPresentationPaths(id);
  ensureAllowedDir(paths.stateDir);
  const normalized = normalizeOutlinePlansStore(store);
  writeJson(paths.outlinePlansFile, normalized);
  return normalized;
}

function listOutlinePlans(id = getActivePresentationId(), options: any = {}) {
  const plans = readOutlinePlansStore(id).plans;
  return options.includeArchived === true
    ? plans
    : plans.filter((plan) => !plan.archivedAt);
}

function getOutlinePlan(id, planId) {
  const plan = listOutlinePlans(id, { includeArchived: true }).find((entry) => entry.id === planId);
  if (!plan) {
    throw new Error(`Unknown outline plan: ${planId}`);
  }

  return plan;
}

function saveOutlinePlan(id, plan) {
  const safeId = assertPresentationId(id);
  const registry = ensurePresentationsState();
  if (!registry.presentations.some((entry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  const normalized = normalizeOutlinePlan(plan, {
    sourcePresentationId: safeId
  });
  const current = readOutlinePlansStore(safeId);
  const existing = current.plans.filter((entry) => entry.id !== normalized.id);
  const next = writeOutlinePlansStore(safeId, {
    plans: [
      normalized,
      ...existing
    ]
  });

  return next.plans.find((entry) => entry.id === normalized.id);
}

function deleteOutlinePlan(id, planId) {
  const safeId = assertPresentationId(id);
  const current = readOutlinePlansStore(safeId);
  if (!current.plans.some((plan) => plan.id === planId)) {
    throw new Error(`Unknown outline plan: ${planId}`);
  }

  return writeOutlinePlansStore(safeId, {
    plans: current.plans.filter((plan) => plan.id !== planId)
  }).plans;
}

function duplicateOutlinePlan(id, planId, fields: any = {}) {
  const safeId = assertPresentationId(id);
  const sourcePlan = getOutlinePlan(safeId, planId);
  const current = readOutlinePlansStore(safeId);
  const baseName = normalizeCompactText(fields.name, `${sourcePlan.name} copy`);
  let candidateId = createSlug(fields.id || baseName, "outline-plan-copy");
  let suffix = 2;

  while (current.plans.some((plan) => plan.id === candidateId)) {
    candidateId = `${createSlug(baseName, "outline-plan-copy")}-${suffix}`;
    suffix += 1;
  }

  return saveOutlinePlan(safeId, {
    ...sourcePlan,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    id: candidateId,
    name: baseName,
    parentPlanId: sourcePlan.id,
    updatedAt: null
  });
}

function archiveOutlinePlan(id, planId) {
  const safeId = assertPresentationId(id);
  const sourcePlan = getOutlinePlan(safeId, planId);
  return saveOutlinePlan(safeId, {
    ...sourcePlan,
    archivedAt: new Date().toISOString()
  });
}

function deckPlanToOutlinePlan(presentationId, deckPlan, fields: any = {}) {
  const slides = Array.isArray(deckPlan && deckPlan.slides) ? deckPlan.slides : [];
  if (!slides.length) {
    throw new Error("Expected deck plan slides before saving an outline plan");
  }

  return normalizeOutlinePlan({
    audience: fields.audience || deckPlan.audience,
    intendedUse: fields.intendedUse || "derived-deck",
    name: fields.name || `${fields.title || "Approved"} outline`,
    objective: fields.objective || deckPlan.thesis,
    purpose: fields.purpose || fields.objective || deckPlan.thesis,
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
        intent: deckPlan.narrativeArc || "Approved staged creation outline.",
        slides: slides.map((slide, index) => ({
          id: `slide-${String(index + 1).padStart(2, "0")}`,
          intent: slide.intent || slide.keyMessage || "",
          layoutHint: slide.visualNeed || "",
          mustInclude: [slide.keyMessage || ""].filter(Boolean),
          role: slide.role || "",
          sourceSlideId: "",
          traceability: [],
          workingTitle: slide.title || `Slide ${index + 1}`
        }))
      }
    ]
  });
}

function createOutlinePlanFromDeckPlan(presentationId, deckPlan, fields: any = {}) {
  return saveOutlinePlan(presentationId, deckPlanToOutlinePlan(presentationId, deckPlan, fields));
}

function createOutlinePlanFromPresentation(id = getActivePresentationId(), fields: any = {}) {
  const safeId = assertPresentationId(id);
  const paths = getPresentationPaths(safeId);
  if (!fs.existsSync(paths.rootDir)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  const context = readJson(paths.deckContextFile, createDefaultDeckContext({ id: safeId }));
  const deck = context && context.deck ? context.deck : {};
  const slides = readPresentationSlideSpecs(safeId);
  if (!slides.length) {
    throw new Error("Expected at least one slide before generating an outline plan");
  }

  const sourceStore = readJson(paths.sourcesFile, { sources: [] });
  const materialStore = readJson(paths.materialsFile, { materials: [] });
  const sourceTraceability = Array.isArray(sourceStore.sources)
    ? sourceStore.sources.map((source) => ({
      kind: "source-snippet",
      range: source.text ? `0-${Math.min(String(source.text).length, 240)}` : "",
      snippetId: "chunk-0",
      sourceId: source.id
    }))
    : [];
  const materialTraceability = Array.isArray(materialStore.materials)
    ? materialStore.materials.map((material) => ({
      kind: "material",
      materialId: material.id
    }))
    : [];
  const deckTraceability = [
    ...slides.map((slide, index) => ({
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
      materials: Array.isArray(materialStore.materials) ? materialStore.materials.map((material) => material.id).filter(Boolean) : [],
      slides: slides.map((slide, index) => slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`),
      sources: Array.isArray(sourceStore.sources) ? sourceStore.sources.map((source) => source.id).filter(Boolean) : []
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
        slides: slides.map((slide, index) => {
          const slideId = slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`;
          const slideContext = context.slides && context.slides[slideId] ? context.slides[slideId] : {};
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
            workingTitle: slide.title || `Slide ${index + 1}`
          };
        })
      }
    ]
  });

  return saveOutlinePlan(safeId, plan);
}

function outlinePlanToDeckPlan(plan) {
  const sections = Array.isArray(plan && plan.sections) ? plan.sections : [];
  const slides = sections.flatMap((section) => Array.isArray(section.slides) ? section.slides : []);
  if (!slides.length) {
    throw new Error("Outline plan needs at least one slide intent before derivation");
  }

  return {
    audience: plan.audience || "",
    language: "",
    narrativeArc: sections.map((section) => `${section.title}: ${section.intent}`).join("\n"),
    outline: slides.map((slide, index) => `${index + 1}. ${slide.workingTitle}`).join("\n"),
    slides: slides.map((slide, index) => ({
      intent: slide.intent || "",
      keyMessage: Array.isArray(slide.mustInclude) && slide.mustInclude.length ? slide.mustInclude.join("; ") : slide.intent || "",
      role: slide.role || (index === 0 ? "opening" : index === slides.length - 1 && slides.length > 1 ? "handoff" : "concept"),
      sourceNeed: slide.sourceSlideId ? `Use source slide ${slide.sourceSlideId} when relevant.` : "Use selected source material when relevant.",
      title: slide.workingTitle || `Slide ${index + 1}`,
      visualNeed: slide.layoutHint || "Use a simple readable layout."
    })),
    thesis: plan.objective || plan.purpose || ""
  };
}

function createDerivedPlaceholderSlide(planSlide, index, slideCount) {
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
        }
      ],
      resources: [
        {
          id: "derived-source",
          title: "Source need",
          body: planSlide.sourceNeed || "Use selected source material when relevant."
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
      }
    ]
  };
}

function createOutlinePlanScaffoldSlide(planSlide, index) {
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
      }
    ],
    guardrails: [
      {
        id: "plan-visual",
        title: "Visual",
        body: planSlide.visualNeed || "Use a simple readable layout."
      }
    ]
  };
}

function createPlanCandidateStats(entries) {
  return {
    archived: entries.filter((entry) => entry.action === "remove").length,
    inserted: entries.filter((entry) => entry.action === "insert").length,
    moved: entries.filter((entry) => Number.isFinite(entry.currentIndex) && Number.isFinite(entry.proposedIndex) && entry.currentIndex !== entry.proposedIndex).length,
    replaced: 0,
    retitled: entries.filter((entry) => entry.currentTitle && entry.proposedTitle && normalizeCompactText(entry.currentTitle).toLowerCase() !== normalizeCompactText(entry.proposedTitle).toLowerCase()).length,
    shared: 0,
    total: entries.length
  };
}

function proposeDeckChangesFromOutlinePlan(presentationId, planId) {
  const safeId = assertPresentationId(presentationId);
  const plan = getOutlinePlan(safeId, planId);
  if (plan.archivedAt) {
    throw new Error("Archived outline plans cannot propose deck changes.");
  }

  const deckPlan = outlinePlanToDeckPlan(plan);
  const currentSlides = readPresentationSlideSpecs(safeId).map((slide, index) => ({
    id: `slide-${String(slide.index || index + 1).padStart(2, "0")}`,
    index: Number(slide.index || index + 1),
    title: slide.title || `Slide ${index + 1}`,
    type: slide.type || "content"
  }));
  const entries = [];

  deckPlan.slides.forEach((planSlide, index) => {
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

  currentSlides.slice(deckPlan.slides.length).forEach((slide) => {
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
    .filter((entry) => Number.isFinite(entry.proposedIndex) && entry.proposedTitle)
    .sort((left, right) => left.proposedIndex - right.proposedIndex)
    .map((entry) => ({
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
        added: entries.filter((entry) => entry.action === "insert").map((entry) => entry.proposedTitle),
        archived: entries.filter((entry) => entry.action === "remove").map((entry) => entry.currentTitle),
        moved: entries.filter((entry) => Number.isFinite(entry.currentIndex) && Number.isFinite(entry.proposedIndex) && entry.currentIndex !== entry.proposedIndex).map((entry) => ({
          from: entry.currentIndex,
          title: entry.proposedTitle || entry.currentTitle,
          to: entry.proposedIndex
        })),
        retitled: entries.filter((entry) => entry.currentTitle && entry.proposedTitle && normalizeCompactText(entry.currentTitle).toLowerCase() !== normalizeCompactText(entry.proposedTitle).toLowerCase()).map((entry) => ({
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

function derivePresentationFromOutlinePlan(sourcePresentationId, planId, options: any = {}) {
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
      title: slide.title
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
  const targetContext = readJson(targetPaths.deckContextFile, createDefaultDeckContext({ title }));
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

function getUniquePresentationId(title) {
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

function readFileMtime(fileName) {
  try {
    return fs.statSync(fileName).mtime.getTime();
  } catch (error) {
    return 0;
  }
}

function readPresentationSummary(id) {
  const paths = getPresentationPaths(id);
  const meta = readJson(paths.metaFile, createDefaultPresentationMeta({ id }));
  const deckContext = readJson(paths.deckContextFile, null);
  const deck = deckContext && deckContext.deck ? deckContext.deck : {};
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir).filter((fileName) => /^slide-\d+\.json$/.test(fileName)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    : [];
  const firstSlideSpec = slideFiles.length ? readJson(path.join(paths.slidesDir, slideFiles[0]), null) : null;
  const slidePaths = slideFiles.map((fileName) => path.join(paths.slidesDir, fileName));
  const updatedAtMs = [
    paths.metaFile,
    paths.deckContextFile,
    ...slidePaths
  ].reduce((latest, fileName) => Math.max(latest, readFileMtime(fileName)), 0);

  return {
    audience: deck.audience || "",
    id,
    title: deck.title || meta.title || id,
    description: deck.objective || meta.description || deck.subject || "",
    targetSlideCount: normalizeTargetSlideCount(deck.lengthProfile && deck.lengthProfile.targetCount),
    createdAt: meta.createdAt || "",
    objective: deck.objective || "",
    subject: deck.subject || "",
    tone: deck.tone || "",
    updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : (meta.updatedAt || ""),
    slideCount: slideFiles.filter((fileName) => {
      const slide = readJson(path.join(paths.slidesDir, fileName), {});
      return slide && slide.archived !== true && slide.skipped !== true;
    }).length,
    firstSlideSpec,
    theme: deck.visualTheme || null
  };
}

function listPresentations() {
  const registry = ensurePresentationsState();
  const runtime = readRuntimeState(registry);

  return {
    activePresentationId: runtime.activePresentationId,
    presentations: registry.presentations.map((entry) => readPresentationSummary(entry.id))
  };
}

function createPresentation(fields: any = {}) {
  const id = getUniquePresentationId(fields.title || "Untitled presentation");
  const paths = getPresentationPaths(id);
  const timestamp = new Date().toISOString();
  const title = fields.title || "Untitled presentation";
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
    : createInitialSlideSpecs(context.deck);

  initialSlideSpecs.forEach((slideSpec, index) => {
    writeSlideFile(paths, index + 1, slideSpec);
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

function regeneratePresentationSlides(id, slideSpecs, fields: any = {}) {
  const safeId = assertPresentationId(id);
  const registry = ensurePresentationsState();
  if (!registry.presentations.some((entry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }
  if (!Array.isArray(slideSpecs) || !slideSpecs.length) {
    throw new Error("Expected generated slide specs");
  }

  const paths = getPresentationPaths(safeId);
  const currentContext = readJson(paths.deckContextFile, createDefaultDeckContext({ id: safeId }));
  const currentDeck = currentContext && currentContext.deck ? currentContext.deck : {};
  const timestamp = new Date().toISOString();
  const activeCount = slideSpecs.filter((slideSpec) => slideSpec && slideSpec.skipped !== true).length;
  const skippedCount = slideSpecs.filter((slideSpec) => slideSpec && slideSpec.skipped === true).length;
  const targetCount = normalizeTargetSlideCount(
    fields.targetSlideCount ?? fields.targetCount ?? (currentDeck.lengthProfile && currentDeck.lengthProfile.targetCount)
  ) || slideSpecs.length;

  removeSlideFiles(paths);
  slideSpecs.forEach((slideSpec, index) => {
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
      : currentContext.slides || {}
  });
  updatePresentationMeta(safeId, {});

  return readPresentationSummary(safeId);
}

function duplicateDirectory(sourceDir, targetDir) {
  ensureAllowedDir(targetDir);
  fs.cpSync(sourceDir, targetDir, {
    recursive: true
  });
}

function duplicatePresentation(sourceId, fields: any = {}) {
  const sourcePaths = getPresentationPaths(sourceId);
  if (!fs.existsSync(sourcePaths.rootDir)) {
    throw new Error(`Unknown presentation: ${sourceId}`);
  }

  const sourceSummary = readPresentationSummary(sourceId);
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
  const context = readJson(targetPaths.deckContextFile, createDefaultDeckContext({ title }));
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

function deletePresentation(id) {
  const registry = ensurePresentationsState();
  const safeId = assertPresentationId(id);
  if (!registry.presentations.some((entry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }
  if (registry.presentations.length <= 1) {
    throw new Error("Cannot delete the only presentation.");
  }

  const runtime = readRuntimeState(registry);
  const nextPresentations = registry.presentations.filter((entry) => entry.id !== safeId);
  const nextActiveId = runtime.activePresentationId === safeId
    ? nextPresentations[0].id
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

module.exports = {
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
  saveRuntimeTheme,
  setActivePresentation,
  updatePresentationMeta
};
