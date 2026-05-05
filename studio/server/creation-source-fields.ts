import { fetchSourceTextFromUrl } from "./services/sources.ts";

type JsonObject = Record<string, unknown>;

type CreationSourceFields = JsonObject & {
  lang?: unknown;
  presentationLanguage?: unknown;
  presentationSourceUrls: string;
  presentationSourceText: string;
};

function parseCreationSourceUrls(value: unknown): string[] {
  const urls = String(value || "")
    .split(/[\s,]+/)
    .map((url) => url.trim())
    .filter(Boolean);
  return Array.from(new Set(urls)).slice(0, 8);
}

function formatFetchedCreationSource(source: Awaited<ReturnType<typeof fetchSourceTextFromUrl>>): string {
  return [
    source.title ? `Source: ${source.title}` : "Source",
    `URL: ${source.url}`,
    "Source language may differ from the requested deck language; use it only for facts and translate or summarize visible outline text into the requested deck language.",
    source.text
  ].filter(Boolean).join("\n");
}

function formatFetchWarning(url: string, reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason || "Source URL request failed");
  return [
    "Source fetch warning",
    `URL: ${url}`,
    `Could not fetch this source automatically: ${message}`,
    "Paste relevant source text manually if this URL should ground the deck."
  ].join("\n");
}

function requestedCreationLanguage(fields: CreationSourceFields): string {
  return String(fields.lang || fields.presentationLanguage || "").trim();
}

async function attachWebSourcesToCreationFields<T extends CreationSourceFields>(fields: T): Promise<T> {
  const urls = parseCreationSourceUrls(fields.presentationSourceUrls);
  if (!urls.length) {
    return fields;
  }

  const language = requestedCreationLanguage(fields);
  const fetchResults = await Promise.allSettled(urls.map((url) => fetchSourceTextFromUrl(url, { language })));
  const fetchedText = fetchResults.map((result, index) => {
    if (result.status === "fulfilled") {
      return formatFetchedCreationSource(result.value);
    }

    return formatFetchWarning(urls[index] || "unknown source URL", result.reason);
  }).join("\n\n");
  return {
    ...fields,
    presentationSourceText: [
      fields.presentationSourceText,
      fetchedText
    ].filter(Boolean).join("\n\n")
  };
}

export {
  attachWebSourcesToCreationFields,
  parseCreationSourceUrls
};

export type {
  CreationSourceFields
};
