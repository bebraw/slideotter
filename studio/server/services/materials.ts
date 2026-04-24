const fs = require("fs");
const path = require("path");
const {
  getActivePresentationId,
  getActivePresentationPaths,
  getPresentationPaths
} = require("./presentations.ts");
const {
  ensureAllowedDir,
  writeAllowedBinary,
  writeAllowedJson
} = require("./write-boundary.ts");

const allowedImageTypes = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

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

function normalizeMaterialsStore(value) {
  const source = value && typeof value === "object" ? value : {};
  const materials = Array.isArray(source.materials)
    ? source.materials.filter((item) => item && typeof item.id === "string")
    : [];

  return { materials };
}

function getMaterialsStore() {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.materialsDir);
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.materialsFile)) {
    writeJson(paths.materialsFile, { materials: [] });
  }

  return normalizeMaterialsStore(readJson(paths.materialsFile, { materials: [] }));
}

function saveMaterialsStore(store) {
  const paths = getActivePresentationPaths();
  const normalized = normalizeMaterialsStore(store);
  writeJson(paths.materialsFile, normalized);
  return normalized;
}

function createSlug(value, fallback = "material") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return slug || fallback;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error("Material upload must be a base64 data URL");
  }

  const mimeType = match[1].toLowerCase();
  const extension = allowedImageTypes[mimeType];
  if (!extension) {
    throw new Error("Material upload must be a PNG, JPEG, GIF, or WebP image");
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!buffer.length) {
    throw new Error("Material upload is empty");
  }

  if (buffer.length > 4 * 1024 * 1024) {
    throw new Error("Material upload must be 4MB or smaller");
  }

  return {
    buffer,
    extension,
    mimeType
  };
}

function createMaterialUrl(presentationId, fileName) {
  return `/presentation-materials/${encodeURIComponent(presentationId)}/${encodeURIComponent(fileName)}`;
}

function listMaterials() {
  const presentationId = getActivePresentationId();
  return getMaterialsStore().materials.map((material) => ({
    ...material,
    url: createMaterialUrl(presentationId, material.fileName)
  }));
}

function getMaterial(materialId) {
  const material = listMaterials().find((entry) => entry.id === materialId);
  if (!material) {
    throw new Error(`Unknown material: ${materialId}`);
  }

  return material;
}

function createMaterialFromDataUrl(input: any = {}) {
  const parsed = parseDataUrl(input.dataUrl);
  const paths = getActivePresentationPaths();
  const presentationId = getActivePresentationId();
  const timestamp = new Date().toISOString();
  const id = `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = String(input.title || input.fileName || "Material").replace(/\s+/g, " ").trim() || "Material";
  const fileName = `${id}-${createSlug(title)}.${parsed.extension}`;
  const targetPath = path.join(paths.materialsDir, fileName);

  writeAllowedBinary(targetPath, parsed.buffer);

  const store = getMaterialsStore();
  const material = {
    alt: String(input.alt || title).replace(/\s+/g, " ").trim() || title,
    caption: String(input.caption || "").replace(/\s+/g, " ").trim(),
    createdAt: timestamp,
    fileName,
    id,
    mimeType: parsed.mimeType,
    size: parsed.buffer.length,
    title,
    url: createMaterialUrl(presentationId, fileName)
  };

  saveMaterialsStore({
    materials: [
      material,
      ...store.materials
    ]
  });

  return material;
}

function getMaterialFilePath(presentationId, fileName) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(presentationId || ""))) {
    throw new Error("Invalid presentation id");
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(String(fileName || ""))) {
    throw new Error("Invalid material filename");
  }

  const paths = getPresentationPaths(presentationId);
  const resolved = path.resolve(paths.materialsDir, fileName);
  const root = path.resolve(paths.materialsDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid material path");
  }

  return resolved;
}

module.exports = {
  createMaterialFromDataUrl,
  getMaterial,
  getMaterialFilePath,
  listMaterials
};
