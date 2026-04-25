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

  return {
    approvedOutline: source.approvedOutline === true,
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

function normalizeRuntimeState(runtime, registry, fallbackActivePresentationId = defaultActivePresentationId(registry)) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const activePresentationId = registry.presentations.some((entry) => entry.id === source.activePresentationId)
    ? source.activePresentationId
    : fallbackActivePresentationId;

  return {
    activePresentationId,
    creationDraft: normalizeCreationDraft(source.creationDraft),
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
        activeCount: slideSpecs.length,
        skippedCount: 0,
        targetCount,
        updatedAt: timestamp
      },
      outline: fields.outline || currentDeck.outline || ""
    }
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
  createPresentation,
  createSlug,
  defaultPresentationId,
  deletePresentation,
  duplicatePresentation,
  ensurePresentationFiles,
  ensurePresentationsState,
  getActivePresentationId,
  getActivePresentationPaths,
  getPresentationPaths,
  getPresentationCreationDraft,
  readPresentationDeckContext,
  regeneratePresentationSlides,
  listPresentations,
  listSavedThemes,
  presentationRuntimeFile,
  presentationsRegistryFile,
  clearPresentationCreationDraft,
  savePresentationCreationDraft,
  saveRuntimeTheme,
  setActivePresentation,
  updatePresentationMeta
};
