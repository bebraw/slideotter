type JsonObject = Record<string, unknown>;

type TextPoint = JsonObject & {
  body?: unknown;
  title?: unknown;
};

type MaterialCandidate = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  id: string;
  license?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
};

type PlanSlideMaterialContext = {
  keyPoints?: TextPoint[];
  mediaMaterialId?: unknown;
  summary?: unknown;
  title?: unknown;
};

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

function resolveSlideMaterial(
  planSlide: PlanSlideMaterialContext | null | undefined,
  materialCandidates: unknown[] | undefined,
  usedMaterialIds: Set<string>
): MaterialCandidate | null {
  const materials = Array.isArray(materialCandidates) ? materialCandidates.filter(isMaterialCandidate) : [];
  if (!materials.length) {
    return null;
  }

  const requestedId = String(planSlide && planSlide.mediaMaterialId || "").trim();
  if (requestedId) {
    const requested = materials.find((material) => material.id === requestedId && !usedMaterialIds.has(material.id));
    if (requested) {
      usedMaterialIds.add(requested.id);
      return requested;
    }
  }

  let bestMaterial: MaterialCandidate | null = null;
  let bestScore = 0;
  for (const material of materials) {
    if (usedMaterialIds.has(material.id)) {
      continue;
    }

    const score = scoreMaterialForSlide(material, planSlide);
    if (score > bestScore) {
      bestMaterial = material;
      bestScore = score;
    }
  }

  if (bestMaterial && bestScore > 0) {
    usedMaterialIds.add(bestMaterial.id);
    return bestMaterial;
  }

  return null;
}

function resolveSlideMaterials(
  planSlide: PlanSlideMaterialContext | null | undefined,
  materialCandidates: unknown[] | undefined,
  usedMaterialIds: Set<string>,
  count: number
): MaterialCandidate[] {
  const materials = Array.isArray(materialCandidates) ? materialCandidates.filter(isMaterialCandidate) : [];
  const selected: MaterialCandidate[] = [];
  const targetCount = Math.max(0, count);
  if (!materials.length || targetCount === 0) {
    return selected;
  }

  const requestedId = String(planSlide && planSlide.mediaMaterialId || "").trim();
  if (requestedId) {
    const requested = materials.find((material) => material.id === requestedId && !usedMaterialIds.has(material.id));
    if (requested) {
      selected.push(requested);
      usedMaterialIds.add(requested.id);
    }
  }

  const scored = materials
    .filter((material) => !usedMaterialIds.has(material.id))
    .map((material) => ({
      material,
      score: scoreMaterialForSlide(material, planSlide)
    }))
    .sort((left, right) => right.score - left.score);

  for (const entry of scored) {
    if (selected.length >= targetCount) {
      break;
    }

    selected.push(entry.material);
    usedMaterialIds.add(entry.material.id);
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
};
