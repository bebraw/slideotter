import type { JsonObject, SlideItem } from "./generated-slide-types.ts";

export function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isSlideItem(value: unknown): value is SlideItem {
  return isJsonObject(value);
}
