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
    rootDir,
    slidesDir: path.join(rootDir, "slides"),
    stateDir: path.join(rootDir, "state"),
    deckContextFile: path.join(rootDir, "state", "deck-context.json"),
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

function createDefaultDeckContext(fields: any = {}) {
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
    activePresentationId: defaultPresentationId,
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
  const activePresentationId = normalized.some((entry) => entry.id === source.activePresentationId)
    ? source.activePresentationId
    : normalized[0].id;

  return {
    activePresentationId,
    presentations: normalized
  };
}

function readRegistry() {
  return normalizeRegistry(readJson(presentationsRegistryFile, createDefaultRegistry()));
}

function writeRegistry(registry) {
  const normalized = normalizeRegistry(registry);
  writeJson(presentationsRegistryFile, normalized);
  return normalized;
}

function ensurePresentationFiles(id, fields: any = {}) {
  const paths = getPresentationPaths(id);
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
  return ensurePresentationsState().activePresentationId;
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

  return writeRegistry({
    ...registry,
    activePresentationId: safeId
  });
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

module.exports = {
  createDefaultDeckContext,
  createDefaultPresentationMeta,
  createSlug,
  defaultPresentationId,
  ensurePresentationFiles,
  ensurePresentationsState,
  getActivePresentationId,
  getActivePresentationPaths,
  getPresentationPaths,
  presentationsRegistryFile,
  setActivePresentation,
  updatePresentationMeta
};
