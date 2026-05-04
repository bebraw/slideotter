import * as fs from "fs";
import { getPresentationPaths } from "./services/presentations.ts";
import {
  isJsonObject,
  isSourcePayload,
  type SourcePayload
} from "./api-payloads.ts";

export function buildCompactPresentationSourceText(presentationId: string): string {
  const paths = getPresentationPaths(presentationId);
  const store = fs.existsSync(paths.sourcesFile)
    ? JSON.parse(fs.readFileSync(paths.sourcesFile, "utf8"))
    : { sources: [] };
  const sources = isJsonObject(store) && Array.isArray(store.sources) ? store.sources.filter(isSourcePayload) : [];

  return sources
    .map((source: SourcePayload, index: number) => {
      const title = String(source.title || `Source ${index + 1}`).replace(/\s+/g, " ").trim();
      const url = String(source.url || "").trim();
      const text = String(source.text || "").replace(/\s+/g, " ").trim().slice(0, 900);
      return [
        title ? `Source: ${title}` : "",
        url ? `URL: ${url}` : "",
        text
      ].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .slice(0, 6)
    .join("\n\n");
}
