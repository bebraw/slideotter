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

const allowedImageTypes: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const maxMaterialBytes = 4 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

type Material = {
  alt: string;
  caption: string;
  createdAt: string;
  creator: string;
  fileName: string;
  id: string;
  license: string;
  licenseUrl: string;
  mimeType: string;
  provider: string;
  size: number;
  sourceUrl: string;
  title: string;
  url?: string;
};

type MaterialsStore = {
  materials: Material[];
};

type GenerationMaterial = {
  alt: string;
  caption: string;
  creator: string;
  id: string;
  license: string;
  licenseUrl: string;
  provider: string;
  sourceUrl: string;
  title: string;
  url: string;
};

type GenerationMaterialOptions = {
  includeActiveMaterials?: unknown;
  includeAttribution?: unknown;
  materials?: unknown;
  maxMaterials?: unknown;
  query?: unknown;
  slideIntent?: unknown;
  slideKeyMessage?: unknown;
  slideTitle?: unknown;
};

type ParsedImage = {
  buffer: Buffer;
  extension: string;
  mimeType: string;
};

type MaterialInput = {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  id?: unknown;
  license?: unknown;
  licenseUrl?: unknown;
  provider?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown) {
  writeAllowedJson(fileName, value);
}

function isMaterial(value: unknown): value is Material {
  return typeof asRecord(value).id === "string";
}

function normalizeMaterialsStore(value: unknown): MaterialsStore {
  const source = asRecord(value);
  const materials = Array.isArray(source.materials)
    ? source.materials.filter(isMaterial)
    : [];

  return { materials };
}

function getMaterialsStore(): MaterialsStore {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.materialsDir);
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.materialsFile)) {
    writeJson(paths.materialsFile, { materials: [] });
  }

  return normalizeMaterialsStore(readJson(paths.materialsFile, { materials: [] }));
}

function saveMaterialsStore(store: unknown): MaterialsStore {
  const paths = getActivePresentationPaths();
  const normalized = normalizeMaterialsStore(store);
  writeJson(paths.materialsFile, normalized);
  return normalized;
}

function createSlug(value: unknown, fallback = "material"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return slug || fallback;
}

function parseDataUrl(dataUrl: unknown): ParsedImage {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match || !match[1] || !match[2]) {
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

function normalizeRemoteImageUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("Image URL is required");
  }

  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Image URL must use http or https");
  }

  const hostname = url.hostname.toLowerCase();
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "");
  const ipv4 = parseIpv4Address(normalizedHostname);
  const mappedIpv4 = parseIpv4MappedIpv6Address(normalizedHostname);
  if (
    normalizedHostname === "localhost"
    || hostname === "0.0.0.0"
    || normalizedHostname === "::1"
    || normalizedHostname.endsWith(".localhost")
    || normalizedHostname.endsWith(".local")
    || isPrivateIpv6Address(normalizedHostname)
  ) {
    throw new Error("Image URL cannot point to a local host.");
  }

  if (ipv4 && isPrivateIpv4Address(ipv4) || mappedIpv4 && isPrivateIpv4Address(mappedIpv4)) {
    throw new Error("Image URL cannot point to a private network address.");
  }

  return url.toString();
}

function parseIpv4Address(value: string): [number, number, number, number] | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    return null;
  }

  const octets: [number, number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4])
  ];
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return [octets[0], octets[1], octets[2], octets[3]];
}

function parseIpv4MappedIpv6Address(value: string): [number, number, number, number] | null {
  if (!value.startsWith("::ffff:")) {
    return null;
  }

  const suffix = value.slice("::ffff:".length);
  const dotted = parseIpv4Address(suffix);
  if (dotted) {
    return dotted;
  }

  const parts = suffix.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (
    !Number.isInteger(high)
    || !Number.isInteger(low)
    || high < 0
    || high > 0xffff
    || low < 0
    || low > 0xffff
  ) {
    return null;
  }

  return [
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff
  ];
}

function isPrivateIpv4Address(octets: [number, number, number, number]): boolean {
  const [first, second] = octets;
  return first === 10
    || first === 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && second === 168;
}

function isPrivateIpv6Address(value: string): boolean {
  const firstHextet = value.split(":")[0] || "";
  return /^f[cd][0-9a-f]{0,2}$/i.test(firstHextet)
    || /^fe[89ab][0-9a-f]{0,1}$/i.test(firstHextet);
}

function createMaterialUrl(presentationId: string, fileName: string): string {
  return `/presentation-materials/${encodeURIComponent(presentationId)}/${encodeURIComponent(fileName)}`;
}

function listMaterials(): Material[] {
  const presentationId = getActivePresentationId();
  return getMaterialsStore().materials.map((material) => ({
    ...material,
    url: createMaterialUrl(presentationId, material.fileName)
  }));
}

function getMaterial(materialId: string): Material {
  const material = listMaterials().find((entry) => entry.id === materialId);
  if (!material) {
    throw new Error(`Unknown material: ${materialId}`);
  }

  return material;
}

function normalizeGenerationMaterial(value: unknown): GenerationMaterial | null {
  const material = asRecord(value);
  if (!Object.keys(material).length) {
    return null;
  }

  const id = String(material.id || "").trim();
  const title = String(material.title || material.fileName || "").replace(/\s+/g, " ").trim();
  const url = String(material.url || "").trim();
  if (!id || !title || !url) {
    return null;
  }

  return {
    alt: String(material.alt || title).replace(/\s+/g, " ").trim() || title,
    caption: String(material.caption || "").replace(/\s+/g, " ").trim(),
    creator: String(material.creator || "").replace(/\s+/g, " ").trim(),
    id,
    license: String(material.license || "").replace(/\s+/g, " ").trim(),
    licenseUrl: String(material.licenseUrl || "").replace(/\s+/g, " ").trim(),
    provider: String(material.provider || "").replace(/\s+/g, " ").trim(),
    sourceUrl: String(material.sourceUrl || "").replace(/\s+/g, " ").trim(),
    title,
    url
  };
}

function isGenerationMaterial(value: GenerationMaterial | null): value is GenerationMaterial {
  return Boolean(value);
}

function scoreMaterialForQuery(material: GenerationMaterial, query: string): number {
  const tokens = String(query || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
  if (!tokens.length) {
    return 0;
  }

  const haystack = [
    material.title,
    material.alt,
    material.caption,
    material.creator,
    material.provider,
    material.sourceUrl
  ].join(" ").toLowerCase();

  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function getGenerationMaterialContext(options: GenerationMaterialOptions = {}) {
  const activeMaterials = options.includeActiveMaterials === false
    ? []
    : listMaterials().map(normalizeGenerationMaterial).filter(isGenerationMaterial);
  const inlineMaterials = Array.isArray(options.materials)
    ? options.materials.map(normalizeGenerationMaterial).filter(isGenerationMaterial)
    : [];
  const materialMap = new Map<string, GenerationMaterial>();

  [
    ...inlineMaterials,
    ...activeMaterials
  ].forEach((material) => {
    if (!materialMap.has(material.id)) {
      materialMap.set(material.id, material);
    }
  });

  const query = [
    options.query,
    options.slideTitle,
    options.slideIntent,
    options.slideKeyMessage
  ].filter(Boolean).join(" ");
  const maxMaterials = Number.isFinite(Number(options.maxMaterials)) ? Number(options.maxMaterials) : 8;
  const includeAttribution = options.includeAttribution === true;
  const materials = Array.from(materialMap.values())
    .map((material, index) => ({
      index,
      material,
      score: scoreMaterialForQuery(material, query)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .slice(0, maxMaterials)
    .map((entry) => entry.material);

  return {
    materials,
    promptText: materials.map((material, index) => [
      `[${index + 1}] ${material.id}`,
      `Title: ${material.title}`,
      `Alt: ${material.alt}`,
      material.caption ? `Caption: ${material.caption}` : "",
      includeAttribution && material.creator ? `Creator: ${material.creator}` : "",
      includeAttribution && material.license ? `License: ${material.license}` : "",
      includeAttribution && material.sourceUrl ? `Source: ${material.sourceUrl}` : ""
    ].filter(Boolean).join("\n")).join("\n\n")
  };
}

function normalizeMetadataText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createMaterialFromParsedImage(parsed: ParsedImage, input: MaterialInput = {}): Material {
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

function createMaterialFromDataUrl(input: MaterialInput = {}): Material {
  return createMaterialFromParsedImage(parseDataUrl(input.dataUrl), input);
}

async function createMaterialFromRemoteImage(input: MaterialInput = {}): Promise<Material> {
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

  const mimeType = (String(response.headers.get("content-type") || "").split(";")[0] || "").trim().toLowerCase();
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

function getMaterialFilePath(presentationId: string, fileName: string): string {
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
