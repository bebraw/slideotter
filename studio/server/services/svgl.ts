import { createMaterialFromSvgContent } from "./materials.ts";

type JsonRecord = Record<string, unknown>;

type SvglThemeRoutes = {
  dark?: string;
  light?: string;
};

type SvglApiLogo = {
  brandUrl?: unknown;
  category?: unknown;
  id?: unknown;
  route?: unknown;
  title?: unknown;
  url?: unknown;
  wordmark?: unknown;
};

type SvglLogoResult = {
  assetUrl: string;
  brandUrl: string;
  category: string;
  id: string;
  title: string;
  variant: string;
};

type SvglSearchOptions = {
  fetchImpl?: typeof fetch;
  limit?: unknown;
  query?: unknown;
};

type SvglImportInput = {
  alt?: unknown;
  assetUrl?: unknown;
  brandUrl?: unknown;
  category?: unknown;
  id?: unknown;
  title?: unknown;
  variant?: unknown;
};

type SvglImportOptions = {
  fetchImpl?: typeof fetch;
};

const svglApiBaseUrl = "https://api.svgl.app";
const maxSvglResults = 12;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function normalizeSearchQuery(value: unknown): string {
  const query = normalizeText(value);
  if (!query) {
    throw new Error("SVGL search query is required");
  }
  if (query.length > 80) {
    throw new Error("SVGL search query must be 80 characters or fewer");
  }

  return query;
}

function normalizeCategory(value: unknown): string {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean).join(", ")
    : normalizeText(value);
}

function normalizeSvglAssetUrl(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) {
    throw new Error("SVGL asset URL is required");
  }

  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "svgl.app" || !url.pathname.endsWith(".svg")) {
    throw new Error("SVGL asset URL must point to an https://svgl.app/*.svg asset");
  }

  return url.toString();
}

function normalizeSvglBrandUrl(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "";
  }

  return url.toString();
}

function routeEntries(route: unknown): Array<{ assetUrl: string; variant: string }> {
  if (typeof route === "string") {
    return [{ assetUrl: normalizeSvglAssetUrl(route), variant: "default" }];
  }

  const routes = asRecord(route) as SvglThemeRoutes;
  return [
    routes.light ? { assetUrl: normalizeSvglAssetUrl(routes.light), variant: "light" } : null,
    routes.dark ? { assetUrl: normalizeSvglAssetUrl(routes.dark), variant: "dark" } : null
  ].filter((entry): entry is { assetUrl: string; variant: string } => Boolean(entry));
}

function normalizeSvglLogo(value: unknown): SvglLogoResult[] {
  const logo = asRecord(value) as SvglApiLogo;
  const title = normalizeText(logo.title);
  if (!title) {
    return [];
  }

  const brandUrl = normalizeSvglBrandUrl(logo.url || logo.brandUrl);
  const category = normalizeCategory(logo.category);
  const baseId = normalizeText(logo.id, title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "logo";

  try {
    return routeEntries(logo.route).map((route) => ({
      assetUrl: route.assetUrl,
      brandUrl,
      category,
      id: `${baseId}-${route.variant}`,
      title,
      variant: route.variant
    }));
  } catch (error) {
    return [];
  }
}

async function searchSvglLogos(options: SvglSearchOptions = {}): Promise<SvglLogoResult[]> {
  const query = normalizeSearchQuery(options.query);
  const limit = Math.min(maxSvglResults, Math.max(1, Number.isFinite(Number(options.limit)) ? Number(options.limit) : maxSvglResults));
  const fetcher = options.fetchImpl || fetch;
  const url = new URL(svglApiBaseUrl);
  url.searchParams.set("search", query);

  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "slideotter-svgl-provider/1.0"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`SVGL search failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("SVGL search returned an unexpected response");
  }

  return payload.flatMap(normalizeSvglLogo).slice(0, limit);
}

async function importSvglLogo(input: SvglImportInput = {}, options: SvglImportOptions = {}) {
  const assetUrl = normalizeSvglAssetUrl(input.assetUrl);
  const title = normalizeText(input.title, "SVGL logo");
  const variant = normalizeText(input.variant, "default");
  const fetcher = options.fetchImpl || fetch;
  const response = await fetcher(assetUrl, {
    headers: {
      Accept: "image/svg+xml,text/plain;q=0.8,*/*;q=0.1",
      "User-Agent": "slideotter-svgl-provider/1.0"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`SVGL logo request failed with status ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 4 * 1024 * 1024) {
    throw new Error("SVGL logo response is too large. Limit is 4MB.");
  }

  const content = await response.text();
  return createMaterialFromSvgContent({
    alt: normalizeText(input.alt, `${title} logo`),
    caption: input.brandUrl ? `Source: ${normalizeText(input.brandUrl)}` : "",
    content,
    fileName: `${title}-${variant}.svg`,
    id: `material-svgl-${normalizeText(input.id, title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "logo"}-${variant}`,
    provider: "svgl",
    providerItemId: normalizeText(input.id, title),
    providerVariant: variant,
    sourceUrl: normalizeText(input.brandUrl) || assetUrl,
    title: variant === "default" ? `${title} logo` : `${title} logo (${variant})`
  });
}

export {
  importSvglLogo,
  searchSvglLogos,
  type SvglLogoResult
};
