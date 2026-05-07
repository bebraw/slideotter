import { searchImages } from "./services/image-search.ts";

type JsonObject = Record<string, unknown>;

type ImageSearchFields = JsonObject & {
  imageSearch?: {
    count?: unknown;
    provider?: unknown;
    query?: unknown;
    restrictions?: unknown;
  };
};

type MaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  id?: unknown;
  license?: unknown;
  licenseUrl?: unknown;
  provider?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
};

type CreationImageSearchResult = {
  automatic: boolean;
  materials: MaterialPayload[];
  query: string;
  search: JsonObject | null;
};

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value: unknown, fallback: string): string {
  const slug = compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function deriveAutomaticImageSearchQuery(fields: ImageSearchFields): string {
  const source = [
    fields.title,
    fields.objective,
    fields.constraints
  ].map(compactText).filter(Boolean).join(" ");
  const words = source
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .slice(0, 10);
  return words.join(" ");
}

function resolveCreationImageSearchQuery(fields: ImageSearchFields): { automatic: boolean; query: string } {
  const explicitQuery = compactText(fields.imageSearch && fields.imageSearch.query);
  if (explicitQuery) {
    return {
      automatic: false,
      query: explicitQuery
    };
  }

  return {
    automatic: true,
    query: deriveAutomaticImageSearchQuery(fields)
  };
}

function imageSearchResultToMaterialPayload(result: JsonObject, index: number): MaterialPayload {
  const title = compactText(result.title) || `Search image ${index + 1}`;
  const provider = compactText(result.provider) || "search";
  return {
    alt: result.alt || title,
    caption: result.caption || result.sourceUrl || "",
    creator: result.creator || "",
    id: `material-search-${slugify(provider, "search")}-${index + 1}`,
    license: result.license || "",
    licenseUrl: result.licenseUrl || "",
    provider: result.provider,
    sourceUrl: result.sourceUrl || "",
    title,
    url: result.url
  };
}

async function searchCreationImagesAsMaterials(fields: ImageSearchFields): Promise<CreationImageSearchResult> {
  const { automatic, query } = resolveCreationImageSearchQuery(fields);
  if (!query) {
    return {
      automatic,
      materials: [],
      query,
      search: null
    };
  }

  try {
    const search = await searchImages({
      count: fields.imageSearch && fields.imageSearch.count,
      provider: fields.imageSearch && fields.imageSearch.provider,
      query,
      restrictions: fields.imageSearch && fields.imageSearch.restrictions
    });
    const rawResults: unknown[] = Array.isArray(search.results) ? search.results : [];
    const results = rawResults.filter((result): result is JsonObject => Boolean(result && typeof result === "object" && !Array.isArray(result)));

    const searchRecord: JsonObject = {
      ...search,
      results
    };

    return {
      automatic,
      materials: results.map(imageSearchResultToMaterialPayload),
      query,
      search: searchRecord
    };
  } catch (error) {
    if (!automatic) {
      throw error;
    }

    return {
      automatic,
      materials: [],
      query,
      search: null
    };
  }
}

export {
  deriveAutomaticImageSearchQuery,
  resolveCreationImageSearchQuery,
  searchCreationImagesAsMaterials
};
