import { resolveSlideMaterial, resolveSlideMaterials } from "./generated-materials.ts";
import { sentence } from "./generated-text-hygiene.ts";
import type { MaterialCandidate } from "./generated-materials.ts";

type JsonObject = Record<string, unknown>;

type TextPoint = JsonObject & {
  body?: unknown;
  title?: unknown;
};

type PlanSlideMediaContext = {
  keyPoints?: TextPoint[];
  mediaMaterialId?: unknown;
  summary?: unknown;
  title?: unknown;
};

export type MaterialMedia = {
  alt: string;
  caption?: string;
  id: string;
  src: unknown;
};

function uniqueBy<T>(values: T[], getKey: (value: T) => unknown): T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];

  values.forEach((value) => {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(value);
  });

  return result;
}

function normalizeCaptionPart(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^source:\s*/i, "source: ")
    .replace(/^creator:\s*/i, "creator: ")
    .replace(/^license:\s*/i, "license: ")
    .trim()
    .toLowerCase();
}

function buildMaterialCaption(material: MaterialCandidate): string {
  const structuredParts = [
    material.creator ? `Creator: ${material.creator}` : "",
    material.license ? `License: ${material.license}` : "",
    material.sourceUrl ? `Source: ${material.sourceUrl}` : ""
  ].filter(Boolean);
  const structuredKeys = new Set(structuredParts.map(normalizeCaptionPart));
  const bareSourceKey = normalizeCaptionPart(material.sourceUrl || "");
  const captionParts = String(material.caption || "")
    .split("|")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeCaptionPart(part);
      if (structuredKeys.has(key)) {
        return false;
      }

      if (bareSourceKey && key === bareSourceKey) {
        return false;
      }

      if (/^(creator|license|source):/i.test(part)) {
        return false;
      }

      return true;
    });

  return uniqueBy([
    ...captionParts,
    ...structuredParts
  ], normalizeCaptionPart).join(" | ");
}

function materialToMedia(material: MaterialCandidate | null | undefined): MaterialMedia | undefined {
  if (!material) {
    return undefined;
  }

  const media: MaterialMedia = {
    alt: sentence(material.alt || material.title, material.title, 16),
    id: material.id,
    src: material.url
  };
  const sourceCaption = buildMaterialCaption(material);

  if (sourceCaption) {
    media.caption = sentence(sourceCaption, material.title, 34);
  }

  return media;
}

export function resolvePlanSlideMedia(
  planSlide: PlanSlideMediaContext,
  materialCandidates: MaterialCandidate[],
  usedMaterialIds: Set<string>
): MaterialMedia | undefined {
  return materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
}

export function resolvePhotoGridMaterialSet(planSlide: PlanSlideMediaContext, materialCandidates: MaterialCandidate[]): MaterialMedia[] {
  // Photo grids are comparison sets, so they may reuse images already selected by adjacent one-up slides.
  const gridOnlyUsedMaterialIds = new Set<string>();
  return resolveSlideMaterials(planSlide, materialCandidates, gridOnlyUsedMaterialIds, 3)
    .map(materialToMedia)
    .filter((media): media is MaterialMedia => Boolean(media));
}
