import { fetchSourceTextFromUrl } from "./services/sources.ts";

type JsonObject = Record<string, unknown>;

type CreationSourceFields = JsonObject & {
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
    source.text
  ].filter(Boolean).join("\n");
}

async function attachWebSourcesToCreationFields<T extends CreationSourceFields>(fields: T): Promise<T> {
  const urls = parseCreationSourceUrls(fields.presentationSourceUrls);
  if (!urls.length) {
    return fields;
  }

  const fetchedSources = await Promise.all(urls.map(fetchSourceTextFromUrl));
  const fetchedText = fetchedSources.map(formatFetchedCreationSource).join("\n\n");
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
