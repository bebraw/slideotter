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

const imageSearchStopWords = new Set([
  "about",
  "across",
  "and",
  "are",
  "because",
  "care",
  "deck",
  "for",
  "from",
  "have",
  "how",
  "into",
  "matter",
  "presentation",
  "should",
  "slide",
  "slides",
  "that",
  "the",
  "their",
  "they",
  "this",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "you"
]);

const roseTopicTerms = new Set([
  "bloom",
  "blooms",
  "botanical",
  "bouquet",
  "flower",
  "flowers",
  "garden",
  "gardens",
  "petal",
  "petals",
  "rose",
  "roses"
]);

function tokenizeSearchText(value: unknown): string[] {
  return compactText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);
}

function normalizeTopicTerm(value: string): string {
  if (value === "roses") {
    return "rose";
  }
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.endsWith("s") && value.length > 4) {
    return value.slice(0, -1);
  }
  return value;
}

function normalizeMaterialSearchCount(value: unknown): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(Math.max(1, parsed), 8);
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeTopicTerm(value);
    if (!normalized || imageSearchStopWords.has(normalized) || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function deriveAutomaticImageSearchTerms(fields: ImageSearchFields): string[] {
  const terms = uniqueTerms([
    ...tokenizeSearchText(fields.title),
    ...tokenizeSearchText(fields.objective),
    ...tokenizeSearchText(fields.constraints)
  ]);

  if (terms.includes("rose")) {
    return uniqueTerms([
      ...terms,
      "flower",
      "bloom",
      "garden",
      "bouquet"
    ]);
  }

  return terms;
}

function deriveAutomaticImageSearchQuery(fields: ImageSearchFields): string {
  return deriveAutomaticImageSearchTerms(fields).slice(0, 8).join(" ");
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

function resultSearchText(result: JsonObject): string {
  return [
    result.title,
    result.alt,
    result.caption,
    result.creator,
    result.sourceUrl
  ].map(compactText).filter(Boolean).join(" ");
}

function resultMatchesAutomaticTopic(result: JsonObject, fields: ImageSearchFields): boolean {
  const queryTerms = deriveAutomaticImageSearchTerms(fields);
  if (!queryTerms.length) {
    return true;
  }

  const normalizedResultTerms = new Set(uniqueTerms(tokenizeSearchText(resultSearchText(result))));
  const matchedTerms = queryTerms.filter((term) => normalizedResultTerms.has(term));
  const isRoseSearch = queryTerms.includes("rose");

  if (isRoseSearch) {
    const rawText = resultSearchText(result).toLowerCase();
    if (/\bcharlie rose\b/.test(rawText)) {
      return false;
    }

    const roseMatches = Array.from(normalizedResultTerms)
      .filter((term) => roseTopicTerms.has(term) || (term === "rose"));
    return roseMatches.length >= 2 || /\b(?:garden rose|rose bloom|rose flower|rose bouquet|rose garden)\b/.test(rawText);
  }

  return matchedTerms.length >= Math.min(2, queryTerms.length);
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
    const requestedCount = normalizeMaterialSearchCount(fields.imageSearch && fields.imageSearch.count);
    const search = await searchImages({
      count: automatic ? requestedCount * 4 : requestedCount,
      provider: fields.imageSearch && fields.imageSearch.provider,
      query,
      restrictions: fields.imageSearch && fields.imageSearch.restrictions
    });
    const rawResults: unknown[] = Array.isArray(search.results) ? search.results : [];
    const results = rawResults
      .filter((result): result is JsonObject => Boolean(result && typeof result === "object" && !Array.isArray(result)))
      .filter((result) => !automatic || resultMatchesAutomaticTopic(result, fields))
      .slice(0, requestedCount);

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
  deriveAutomaticImageSearchTerms,
  resolveCreationImageSearchQuery,
  searchCreationImagesAsMaterials
};
