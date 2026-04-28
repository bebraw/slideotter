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
const maxMaterialBytes = 4 * 1024 * 1024;

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

  if (buffer.length > maxMaterialBytes) {
    throw new Error("Material upload must be 4MB or smaller");
  }

  return {
    buffer,
    extension,
    mimeType
  };
}

function normalizeRemoteImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("Image URL is required");
  }

  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Image URL must use http or https");
  }

  const hostname = url.hostname.toLowerCase();
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (
    hostname === "localhost"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
  ) {
    throw new Error("Image URL cannot point to a local host.");
  }

  if (ipv4) {
    const first = Number(ipv4[1]);
    const second = Number(ipv4[2]);
    if (
      first === 10
      || first === 127
      || first === 169 && second === 254
      || first === 172 && second >= 16 && second <= 31
      || first === 192 && second === 168
    ) {
      throw new Error("Image URL cannot point to a private network address.");
    }
  }

  return url.toString();
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

function normalizeGenerationMaterial(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = String(value.id || "").trim();
  const title = String(value.title || value.fileName || "").replace(/\s+/g, " ").trim();
  const url = String(value.url || "").trim();
  if (!id || !title || !url) {
    return null;
  }

  return {
    alt: String(value.alt || title).replace(/\s+/g, " ").trim() || title,
    caption: String(value.caption || "").replace(/\s+/g, " ").trim(),
    creator: String(value.creator || "").replace(/\s+/g, " ").trim(),
    id,
    license: String(value.license || "").replace(/\s+/g, " ").trim(),
    licenseUrl: String(value.licenseUrl || "").replace(/\s+/g, " ").trim(),
    provider: String(value.provider || "").replace(/\s+/g, " ").trim(),
    sourceUrl: String(value.sourceUrl || "").replace(/\s+/g, " ").trim(),
    title,
    url
  };
}

function getGenerationMaterialContext(options: any = {}) {
  const activeMaterials = options.includeActiveMaterials === false
    ? []
    : listMaterials().map(normalizeGenerationMaterial).filter(Boolean);
  const inlineMaterials = Array.isArray(options.materials)
    ? options.materials.map(normalizeGenerationMaterial).filter(Boolean)
    : [];
  const materialMap = new Map();

  [
    ...inlineMaterials,
    ...activeMaterials
  ].forEach((material) => {
    if (!materialMap.has(material.id)) {
      materialMap.set(material.id, material);
    }
  });

  const materials = Array.from(materialMap.values()).slice(0, 12);

  return {
    materials,
    promptText: materials.map((material, index) => [
      `[${index + 1}] ${material.id}`,
      `Title: ${material.title}`,
      `Alt: ${material.alt}`,
      material.caption ? `Caption: ${material.caption}` : "",
      material.creator ? `Creator: ${material.creator}` : "",
      material.license ? `License: ${material.license}` : "",
      material.sourceUrl ? `Source: ${material.sourceUrl}` : ""
    ].filter(Boolean).join("\n")).join("\n\n")
  };
}

function normalizeMetadataText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createMaterialFromParsedImage(parsed, input: any = {}) {
  const paths = getActivePresentationPaths();
  const presentationId = getActivePresentationId();
  const timestamp = new Date().toISOString();
  const providedId = typeof input.id === "string" ? input.id.trim() : "";
  const id = providedId || `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = String(input.title || input.fileName || "Material").replace(/\s+/g, " ").trim() || "Material";
  const fileName = `${id}-${createSlug(title)}.${parsed.extension}`;
  const targetPath = path.join(paths.materialsDir, fileName);

  writeAllowedBinary(targetPath, parsed.buffer);

  const store = getMaterialsStore();
  const material = {
    alt: String(input.alt || title).replace(/\s+/g, " ").trim() || title,
    caption: String(input.caption || "").replace(/\s+/g, " ").trim(),
    createdAt: timestamp,
    creator: normalizeMetadataText(input.creator),
    fileName,
    id,
    license: normalizeMetadataText(input.license),
    licenseUrl: normalizeMetadataText(input.licenseUrl),
    mimeType: parsed.mimeType,
    provider: normalizeMetadataText(input.provider),
    size: parsed.buffer.length,
    sourceUrl: normalizeMetadataText(input.sourceUrl),
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

function createMaterialFromDataUrl(input: any = {}) {
  return createMaterialFromParsedImage(parseDataUrl(input.dataUrl), input);
}

async function createMaterialFromRemoteImage(input: any = {}) {
  const imageUrl = normalizeRemoteImageUrl(input.url);
  const response = await fetch(imageUrl, {
    headers: {
      Accept: "image/png,image/jpeg,image/gif,image/webp;q=0.9,*/*;q=0.1",
      "User-Agent": "slideotter-image-import/1.0"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }

  if (response.url) {
    normalizeRemoteImageUrl(response.url);
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxMaterialBytes) {
    throw new Error("Image response is too large. Limit is 4MB.");
  }

  const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const extension = allowedImageTypes[mimeType];
  if (!extension) {
    throw new Error(`Image response content type is not supported: ${mimeType || "unknown"}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error("Image response is empty");
  }
  if (buffer.length > maxMaterialBytes) {
    throw new Error("Image response is too large. Limit is 4MB.");
  }

  return createMaterialFromParsedImage({
    buffer,
    extension,
    mimeType
  }, input);
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
  createMaterialFromRemoteImage,
  getGenerationMaterialContext,
  getMaterial,
  getMaterialFilePath,
  listMaterials
};
