import { cleanText, isAuthoringMetaText, isScaffoldLeak, isWeakLabel } from "./generated-text-hygiene.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function usefulItemText(items: unknown, fieldName: "body" | "title"): string {
  return (Array.isArray(items) ? items : [])
    .filter(isRecord)
    .map((item) => cleanText(item[fieldName]))
    .find((text) => text && !isWeakLabel(text) && !isScaffoldLeak(text) && !isAuthoringMetaText(text)) || "";
}

export function firstUsefulItemTitle(items: unknown): string {
  return usefulItemText(items, "title");
}

export function firstUsefulItemBody(items: unknown): string {
  return usefulItemText(items, "body");
}
