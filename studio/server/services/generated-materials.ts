import type {
  MaterialCandidate,
  PlanSlideMaterialContext,
  TextPoint
} from "./generated-material-types.ts";

function isMaterialCandidate(value: unknown): value is MaterialCandidate {
  return Boolean(value && typeof value === "object" && typeof (value as MaterialCandidate).id === "string" && typeof (value as MaterialCandidate).url === "string");
}

function tokenizeMaterialText(value: unknown): string[] {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
}

function scoreMaterialForSlide(material: MaterialCandidate, planSlide: PlanSlideMaterialContext | null | undefined): number {
  const keyPoints = Array.isArray(planSlide?.keyPoints) ? planSlide.keyPoints : [];
  const materialTokens = new Set(tokenizeMaterialText([
    material.title,
    material.alt,
    material.caption
  ].filter(Boolean).join(" ")));
  const slideTokens = tokenizeMaterialText([
    planSlide && planSlide.title,
    planSlide && planSlide.summary,
    ...keyPoints.flatMap((point: TextPoint) => [point && point.title, point && point.body])
  ].filter(Boolean).join(" "));

  return slideTokens.reduce((score, token) => score + (materialTokens.has(token) ? 1 : 0), 0);
}

function getMaterialCandidates(materialCandidates: unknown[] | undefined): MaterialCandidate[] {
  return Array.isArray(materialCandidates) ? materialCandidates.filter(isMaterialCandidate) : [];
}

function getRequestedMaterialId(planSlide: PlanSlideMaterialContext | null | undefined): string {
  return String(planSlide && planSlide.mediaMaterialId || "").trim();
}

function findUnusedMaterialById(materials: MaterialCandidate[], materialId: string, usedMaterialIds: Set<string>): MaterialCandidate | null {
  return materials.find((material) => material.id === materialId && !usedMaterialIds.has(material.id)) || null;
}

function markMaterialUsed(material: MaterialCandidate, usedMaterialIds: Set<string>): MaterialCandidate {
  usedMaterialIds.add(material.id);
  return material;
}

function resolveRequestedMaterial(
  planSlide: PlanSlideMaterialContext | null | undefined,
  materials: MaterialCandidate[],
  usedMaterialIds: Set<string>
): MaterialCandidate | null {
  const requestedId = getRequestedMaterialId(planSlide);
  return requestedId ? findUnusedMaterialById(materials, requestedId, usedMaterialIds) : null;
}

function scoreUnusedMaterials(
  planSlide: PlanSlideMaterialContext | null | undefined,
  materials: MaterialCandidate[],
  usedMaterialIds: Set<string>
): Array<{ material: MaterialCandidate; score: number }> {
  return materials
    .filter((material) => !usedMaterialIds.has(material.id))
    .map((material) => ({
      material,
      score: scoreMaterialForSlide(material, planSlide)
    }))
    .sort((left, right) => right.score - left.score);
}

function resolveSlideMaterial(
  planSlide: PlanSlideMaterialContext | null | undefined,
  materialCandidates: unknown[] | undefined,
  usedMaterialIds: Set<string>
): MaterialCandidate | null {
  const materials = getMaterialCandidates(materialCandidates);
  if (!materials.length) {
    return null;
  }

  const requested = resolveRequestedMaterial(planSlide, materials, usedMaterialIds);
  if (requested) {
    return markMaterialUsed(requested, usedMaterialIds);
  }

  let bestMaterial: MaterialCandidate | null = null;
  let bestScore = 0;
  for (const { material, score } of scoreUnusedMaterials(planSlide, materials, usedMaterialIds)) {
    if (score > bestScore) {
      bestMaterial = material;
      bestScore = score;
    }
  }

  if (bestMaterial && bestScore > 0) {
    return markMaterialUsed(bestMaterial, usedMaterialIds);
  }

  return null;
}

function resolveSlideMaterials(
  planSlide: PlanSlideMaterialContext | null | undefined,
  materialCandidates: unknown[] | undefined,
  usedMaterialIds: Set<string>,
  count: number
): MaterialCandidate[] {
  const materials = getMaterialCandidates(materialCandidates);
  const selected: MaterialCandidate[] = [];
  const targetCount = Math.max(0, count);
  if (!materials.length || targetCount === 0) {
    return selected;
  }

  const requested = resolveRequestedMaterial(planSlide, materials, usedMaterialIds);
  if (requested) {
    selected.push(markMaterialUsed(requested, usedMaterialIds));
  }

  for (const entry of scoreUnusedMaterials(planSlide, materials, usedMaterialIds)) {
    if (selected.length >= targetCount) {
      break;
    }

    selected.push(markMaterialUsed(entry.material, usedMaterialIds));
  }

  return selected;
}

export {
  isMaterialCandidate,
  resolveSlideMaterial,
  resolveSlideMaterials,
  scoreMaterialForSlide
};

export type {
  MaterialCandidate
} from "./generated-material-types.ts";
