const { createMaterialFromRemoteImage } = require("./materials.ts");

const providerLabels = {
  openverse: "Openverse",
  wikimedia: "Wikimedia Commons"
};

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return providerLabels[provider] ? provider : "openverse";
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(Math.max(1, parsed), 8);
}

function normalizeText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function createSearchRestrictions(options: any = {}) {
  const rawRestrictions = normalizeText(options.restrictions || "");
  const licenseMatch = rawRestrictions.match(/\blicense\s*:\s*([a-z0-9,_-]+)/i);
  const sourceMatch = rawRestrictions.match(/\bsource\s*:\s*([a-z0-9,_-]+)/i);
  return {
    license: normalizeText(options.license || (licenseMatch && licenseMatch[1]) || "commercial,modification"),
    source: normalizeText(options.source || (sourceMatch && sourceMatch[1]) || ""),
    restrictions: rawRestrictions
  };
}

function buildOpenverseUrl(query, options: any = {}) {
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

function normalizeOpenverseResult(result) {
  const imageUrl = normalizeText(result && result.url);
  const title = normalizeText(result && result.title, "Openverse image");
  if (!imageUrl) {
    return null;
  }

  const creator = normalizeText(result.creator);
  const license = normalizeText(result.license || result.license_version);
  const caption = [
    creator ? `Creator: ${creator}` : "",
    license ? `License: ${license}` : "",
    normalizeText(result.foreign_landing_url)
  ].filter(Boolean).join(" | ");

  return {
    alt: title,
    caption,
    creator,
    license,
    provider: "openverse",
    sourceUrl: normalizeText(result.foreign_landing_url || result.url),
    title,
    url: imageUrl
  };
}

async function searchOpenverseImages(query, options: any = {}) {
  const response = await fetch(buildOpenverseUrl(query, options), {
    headers: {
      Accept: "application/json",
      "User-Agent": "slideotter-image-search/1.0"
    },
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Openverse image search failed with status ${response.status}`);
  }

  return (Array.isArray(payload.results) ? payload.results : [])
    .map(normalizeOpenverseResult)
    .filter(Boolean);
}

function buildWikimediaUrl(query, options: any = {}) {
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

function readWikimediaMeta(metadata, key) {
  const value = metadata && metadata[key] && metadata[key].value;
  return normalizeText(value ? String(value).replace(/<[^>]+>/g, " ") : "");
}

function normalizeWikimediaResult(page) {
  const info = page && Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
  const imageUrl = normalizeText(info && (info.thumburl || info.url));
  const title = normalizeText(readWikimediaMeta(info && info.extmetadata, "ObjectName") || page.title, "Wikimedia image");
  if (!imageUrl) {
    return null;
  }

  const metadata = info.extmetadata || {};
  const creator = readWikimediaMeta(metadata, "Artist") || readWikimediaMeta(metadata, "Credit");
  const license = readWikimediaMeta(metadata, "LicenseShortName");
  const licenseUrl = readWikimediaMeta(metadata, "LicenseUrl");
  const caption = [
    creator ? `Creator: ${creator}` : "",
    license ? `License: ${license}` : "",
    licenseUrl
  ].filter(Boolean).join(" | ");

  return {
    alt: title,
    caption,
    creator,
    license,
    licenseUrl,
    provider: "wikimedia",
    sourceUrl: info.descriptionurl || info.url || imageUrl,
    title,
    url: imageUrl
  };
}

async function searchWikimediaImages(query, options: any = {}) {
  const response = await fetch(buildWikimediaUrl(query, options), {
    headers: {
      Accept: "application/json",
      "User-Agent": "slideotter-image-search/1.0"
    },
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Wikimedia image search failed with status ${response.status}`);
  }

  return Object.values((payload.query && payload.query.pages) || {})
    .map(normalizeWikimediaResult)
    .filter(Boolean);
}

async function searchImages(options: any = {}) {
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

async function importImageSearchResults(options: any = {}) {
  const search = await searchImages(options);
  const imported = [];

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
