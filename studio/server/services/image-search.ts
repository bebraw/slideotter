const { createMaterialFromRemoteImage } = require("./materials.ts");

const providerLabels = {
  openverse: "Openverse",
  wikimedia: "Wikimedia Commons"
} as const;

type ImageSearchProvider = keyof typeof providerLabels;

type ImageSearchOptions = {
  count?: unknown;
  license?: unknown;
  provider?: unknown;
  query?: unknown;
  restrictions?: unknown;
  source?: unknown;
};

type NormalizedImageResult = {
  alt: string;
  caption: string;
  creator: string;
  license: string;
  licenseUrl?: string;
  provider: ImageSearchProvider;
  sourceUrl: string;
  title: string;
  url: string;
};

type SearchRestrictions = {
  license: string;
  restrictions: string;
  source: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeProvider(value: unknown): ImageSearchProvider {
  const provider = String(value || "").trim().toLowerCase();
  return Object.hasOwn(providerLabels, provider) ? provider as ImageSearchProvider : "openverse";
}

function normalizeCount(value: unknown): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(Math.max(1, parsed), 8);
}

function normalizeText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function truncateCaptionPart(value: string, maxLength = 72): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength - 3).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 24 ? lastSpace : clipped.length).trimEnd()}...`;
}

function formatCompactAttribution(provider: ImageSearchProvider, creator: string, license: string): string {
  const parts = [
    truncateCaptionPart(creator),
    truncateCaptionPart(license, 28)
  ].filter(Boolean);
  return parts.length ? `${providerLabels[provider]}: ${parts.join(", ")}` : providerLabels[provider];
}

function isNormalizedImageResult(value: NormalizedImageResult | null): value is NormalizedImageResult {
  return Boolean(value);
}

function createSearchRestrictions(options: ImageSearchOptions = {}): SearchRestrictions {
  const rawRestrictions = normalizeText(options.restrictions || "");
  const licenseMatch = rawRestrictions.match(/\blicense\s*:\s*([a-z0-9,_-]+)/i);
  const sourceMatch = rawRestrictions.match(/\bsource\s*:\s*([a-z0-9,_-]+)/i);
  return {
    license: normalizeText(options.license || (licenseMatch && licenseMatch[1]) || "commercial,modification"),
    source: normalizeText(options.source || (sourceMatch && sourceMatch[1]) || ""),
    restrictions: rawRestrictions
  };
}

function buildOpenverseUrl(query: string, options: ImageSearchOptions = {}): URL {
  const url = new URL("https://api.openverse.org/v1/images/");
  const restrictions = createSearchRestrictions(options);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(normalizeCount(options.count) * 2));
  url.searchParams.set("mature", "false");
  if (restrictions.license) {
    url.searchParams.set("license_type", restrictions.license);
  }
  if (restrictions.source) {
    url.searchParams.set("source", restrictions.source);
  }

  return url;
}

function normalizeOpenverseResult(result: unknown): NormalizedImageResult | null {
  const record = asRecord(result);
  const imageUrl = normalizeText(record.url);
  const title = normalizeText(record.title, "Openverse image");
  if (!imageUrl) {
    return null;
  }

  const creator = normalizeText(record.creator);
  const license = normalizeText(record.license || record.license_version);
  const caption = formatCompactAttribution("openverse", creator, license);

  return {
    alt: title,
    caption,
    creator,
    license,
    provider: "openverse",
    sourceUrl: normalizeText(record.foreign_landing_url || record.url),
    title,
    url: imageUrl
  };
}

async function searchOpenverseImages(query: string, options: ImageSearchOptions = {}): Promise<NormalizedImageResult[]> {
  const response = await fetch(buildOpenverseUrl(query, options), {
    headers: {
      Accept: "application/json",
      "User-Agent": "slideotter-image-search/1.0"
    },
    signal: AbortSignal.timeout(12000)
  });
  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`Openverse image search failed with status ${response.status}`);
  }

  return (Array.isArray(payload.results) ? payload.results : [])
    .map(normalizeOpenverseResult)
    .filter(isNormalizedImageResult);
}

function buildWikimediaUrl(query: string, options: ImageSearchOptions = {}): URL {
  const restrictions = createSearchRestrictions(options);
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", [query, restrictions.restrictions].filter(Boolean).join(" "));
  url.searchParams.set("gsrlimit", String(normalizeCount(options.count) * 2));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|extmetadata");
  url.searchParams.set("iiurlwidth", "1400");
  url.searchParams.set("origin", "*");

  return url;
}

function readWikimediaMeta(metadata: unknown, key: string): string {
  const entry = asRecord(asRecord(metadata)[key]);
  const value = entry.value;
  return normalizeText(value ? String(value).replace(/<[^>]+>/g, " ") : "");
}

function normalizeWikimediaResult(page: unknown): NormalizedImageResult | null {
  const pageRecord = asRecord(page);
  const info = asRecord(Array.isArray(pageRecord.imageinfo) ? pageRecord.imageinfo[0] : null);
  const imageUrl = normalizeText(info.thumburl || info.url);
  const title = normalizeText(readWikimediaMeta(info.extmetadata, "ObjectName") || pageRecord.title, "Wikimedia image");
  if (!imageUrl) {
    return null;
  }

  const metadata = info.extmetadata || {};
  const creator = readWikimediaMeta(metadata, "Artist") || readWikimediaMeta(metadata, "Credit");
  const license = readWikimediaMeta(metadata, "LicenseShortName");
  const licenseUrl = readWikimediaMeta(metadata, "LicenseUrl");
  const caption = formatCompactAttribution("wikimedia", creator, license);

  return {
    alt: title,
    caption,
    creator,
    license,
    licenseUrl,
    provider: "wikimedia",
    sourceUrl: normalizeText(info.descriptionurl || info.url || imageUrl),
    title,
    url: imageUrl
  };
}

async function searchWikimediaImages(query: string, options: ImageSearchOptions = {}): Promise<NormalizedImageResult[]> {
  const response = await fetch(buildWikimediaUrl(query, options), {
    headers: {
      Accept: "application/json",
      "User-Agent": "slideotter-image-search/1.0"
    },
    signal: AbortSignal.timeout(12000)
  });
  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`Wikimedia image search failed with status ${response.status}`);
  }

  return Object.values(asRecord(asRecord(payload.query).pages))
    .map(normalizeWikimediaResult)
    .filter(isNormalizedImageResult);
}

async function searchImages(options: ImageSearchOptions = {}) {
  const query = normalizeText(options.query);
  if (!query) {
    return {
      imported: [],
      provider: normalizeProvider(options.provider),
      query,
      results: [],
      restrictions: createSearchRestrictions(options)
    };
  }

  const provider = normalizeProvider(options.provider);
  const count = normalizeCount(options.count);
  const results = provider === "wikimedia"
    ? await searchWikimediaImages(query, { ...options, count })
    : await searchOpenverseImages(query, { ...options, count });

  return {
    imported: [],
    provider,
    providerLabel: providerLabels[provider],
    query,
    results: results.slice(0, count),
    restrictions: createSearchRestrictions(options)
  };
}

async function importImageSearchResults(options: ImageSearchOptions = {}) {
  const search = await searchImages(options);
  const imported: unknown[] = [];

  for (const result of search.results) {
    try {
      imported.push(await createMaterialFromRemoteImage({
        alt: result.alt || result.title,
        caption: result.caption || result.sourceUrl || "",
        creator: result.creator || "",
        license: result.license || "",
        licenseUrl: result.licenseUrl || "",
        provider: result.provider,
        sourceUrl: result.sourceUrl || "",
        title: result.title,
        url: result.url
      }));
    } catch (error) {
      // Continue with other results; search providers often include occasional hotlink-hostile images.
    }
  }

  return {
    ...search,
    imported
  };
}

module.exports = {
  importImageSearchResults,
  searchImages
};
