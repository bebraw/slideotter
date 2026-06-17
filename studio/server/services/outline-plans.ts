import {
  createSlug,
  normalizeCompactText,
  normalizeTargetSlideCount
} from "./compact-text.ts";

type JsonObject = Record<string, unknown>;

export type OutlinePlanSlide = JsonObject & {
  id: string;
  intent: string;
  layoutHint: string;
  mustInclude: string[];
  role: string;
  sourceSlideId: string;
  traceability: JsonObject[];
  type: string;
  value: string;
  workingTitle: string;
};

export type OutlinePlanSection = JsonObject & {
  id: string;
  intent: string;
  slides: OutlinePlanSlide[];
  title: string;
  traceability: JsonObject[];
};

export type OutlinePlan = JsonObject & {
  archivedAt: unknown;
  audience: string;
  createdAt: unknown;
  id: string;
  name: string;
  objective: string;
  parentPlanId: string;
  presentationDensity: "spacious" | "balanced" | "dense";
  purpose: string;
  sections: OutlinePlanSection[];
  sourcePresentationId: string;
  sourceScope: {
    materials: string[];
    slides: string[];
    sources: string[];
  };
  targetSlideCount: number;
  tone: string;
  traceability: JsonObject[];
  updatedAt: unknown;
};

export type OutlinePlansStore = {
  activePlanId: string;
  plans: OutlinePlan[];
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function normalizePresentationDensity(value: unknown): "spacious" | "balanced" | "dense" {
  return value === "spacious" || value === "balanced" || value === "dense"
    ? value
    : "balanced";
}

function uniqueById<T extends { id?: unknown }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter((entry: T) => {
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function normalizeTraceabilityEntry(entry: unknown): JsonObject | null {
  const source = asJsonObject(entry);
  const kind = normalizeCompactText(source.kind, "slide");
  const normalized: Record<string, string> = { kind };

  [
    "slideId",
    "sourceId",
    "snippetId",
    "materialId",
    "sectionId",
    "outlineSlideId",
    "range"
  ].forEach((field) => {
    const value = normalizeCompactText(source[field]);
    if (value) {
      normalized[field] = value;
    }
  });

  return Object.keys(normalized).length > 1 ? normalized : null;
}

function normalizeOutlinePlanSlide(slide: unknown, index: number): OutlinePlanSlide {
  const source = asJsonObject(slide);
  const workingTitle = normalizeCompactText(source.workingTitle || source.title, `Slide ${index + 1}`);
  const intent = normalizeCompactText(source.intent || source.keyMessage, "Explain this part of the story.");
  const id = createSlug(source.id || source.sourceSlideId || workingTitle || `slide-${index + 1}`, `slide-${index + 1}`);
  const mustInclude = Array.isArray(source.mustInclude)
    ? source.mustInclude.map((item) => normalizeCompactText(item)).filter(Boolean).slice(0, 8)
    : normalizeCompactText(source.mustInclude || source.keyMessage)
      ? [normalizeCompactText(source.mustInclude || source.keyMessage)]
      : [];

  return {
    id,
    intent,
    layoutHint: normalizeCompactText(source.layoutHint || source.visualNeed),
    mustInclude,
    role: normalizeCompactText(source.role),
    sourceSlideId: normalizeCompactText(source.sourceSlideId || source.slideId),
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter((entry: JsonObject | null): entry is JsonObject => entry !== null)
      : [],
    type: normalizeCompactText(source.type, "content"),
    value: normalizeCompactText(source.value),
    workingTitle
  };
}

function normalizeOutlinePlanSection(section: unknown, index: number): OutlinePlanSection {
  const source = asJsonObject(section);
  const title = normalizeCompactText(source.title, index === 0 ? "Current deck" : `Section ${index + 1}`);
  const id = createSlug(source.id || title || `section-${index + 1}`, `section-${index + 1}`);
  const slides = Array.isArray(source.slides)
    ? source.slides.map(normalizeOutlinePlanSlide).filter((slide: OutlinePlanSlide) => slide.workingTitle && slide.intent)
    : [];

  return {
    id,
    intent: normalizeCompactText(source.intent, "Group related slide intents for review."),
    slides,
    title,
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter((entry: JsonObject | null): entry is JsonObject => entry !== null)
      : []
  };
}

function createUniqueOutlineSlideId(baseId: string, usedIds: Set<string>, fallbackIndex: number): string {
  const base = createSlug(baseId, `slide-${fallbackIndex + 1}`);
  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function createExpandedOutlinePlanSlide(sourceSlide: OutlinePlanSlide, index: number, usedIds: Set<string>): OutlinePlanSlide {
  const workingTitle = normalizeCompactText(sourceSlide.workingTitle, `Slide ${index + 1}`);
  const detailLabel = `Detail ${index + 1}`;

  return {
    ...sourceSlide,
    id: createUniqueOutlineSlideId(`${sourceSlide.id || workingTitle}-detail-${index + 1}`, usedIds, index),
    intent: normalizeCompactText(sourceSlide.intent, `Expand on ${workingTitle}.`),
    mustInclude: sourceSlide.mustInclude.length
      ? sourceSlide.mustInclude
      : [normalizeCompactText(sourceSlide.value || sourceSlide.intent || workingTitle)].filter(Boolean),
    role: index === 0 ? "opening" : "concept",
    type: sourceSlide.type || "content",
    workingTitle: `${detailLabel}: ${workingTitle}`
  };
}

function resizeOutlinePlanSections(sections: OutlinePlanSection[], targetSlideCount: number): OutlinePlanSection[] {
  const slides = sections.flatMap((section) => section.slides);
  if (!slides.length || slides.length === targetSlideCount) {
    return sections;
  }

  if (slides.length > targetSlideCount) {
    let remaining = targetSlideCount;
    return sections.map((section) => {
      const nextSlides = section.slides.slice(0, Math.max(0, remaining));
      remaining -= nextSlides.length;
      return {
        ...section,
        slides: nextSlides
      };
    }).filter((section) => section.slides.length);
  }

  const usedIds = new Set(slides.map((slide) => slide.id).filter(Boolean));
  const additions: OutlinePlanSlide[] = [];
  for (let index = slides.length; index < targetSlideCount; index += 1) {
    const sourceSlide = slides[(index - slides.length) % slides.length];
    if (!sourceSlide) {
      continue;
    }
    additions.push(createExpandedOutlinePlanSlide(sourceSlide, index, usedIds));
  }

  const lastSectionIndex = sections.length - 1;
  return sections.map((section, index) => index === lastSectionIndex
    ? {
        ...section,
        slides: [
          ...section.slides,
          ...additions
        ]
      }
    : section);
}

export function normalizeOutlinePlan(plan: unknown, fallback: JsonObject = {}): OutlinePlan {
  const source = asJsonObject(plan);
  const timestamp = new Date().toISOString();
  const name = normalizeCompactText(source.name || fallback.name, "Outline plan");
  const id = createSlug(source.id || name, "outline-plan");
  const sections = Array.isArray(source.sections)
    ? source.sections.map(normalizeOutlinePlanSection).filter((section) => section.slides.length)
    : [];

  if (!sections.length) {
    throw new Error("Outline plan needs at least one section with one slide intent.");
  }

  const targetSlideCount = normalizeTargetSlideCount(
    source.targetSlideCount ?? fallback.targetSlideCount
  ) || sections.reduce((count, section) => count + section.slides.length, 0);
  const resizedSections = resizeOutlinePlanSections(sections, targetSlideCount);
  const sourceScope = asJsonObject(source.sourceScope);

  return {
    id,
    name,
    sourcePresentationId: normalizeCompactText(source.sourcePresentationId || fallback.sourcePresentationId),
    parentPlanId: normalizeCompactText(source.parentPlanId || fallback.parentPlanId),
    presentationDensity: normalizePresentationDensity(source.presentationDensity || fallback.presentationDensity),
    purpose: normalizeCompactText(source.purpose || fallback.purpose),
    audience: normalizeCompactText(source.audience || fallback.audience),
    targetSlideCount,
    tone: normalizeCompactText(source.tone || fallback.tone),
    objective: normalizeCompactText(source.objective || fallback.objective),
    intendedUse: normalizeCompactText(source.intendedUse || fallback.intendedUse),
    sourceScope: {
      slides: Array.isArray(sourceScope.slides)
        ? sourceScope.slides.map((item: unknown) => normalizeCompactText(item)).filter(Boolean)
        : [],
      sources: [],
      materials: []
    },
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter((entry: JsonObject | null): entry is JsonObject => entry !== null)
      : [],
    sections: resizedSections,
    archivedAt: source.archivedAt || fallback.archivedAt || null,
    createdAt: source.createdAt || fallback.createdAt || timestamp,
    updatedAt: timestamp
  };
}

export function normalizeOutlinePlansStore(value: unknown): OutlinePlansStore {
  const source = asJsonObject(value);
  const plans = Array.isArray(source.plans)
    ? source.plans.map((plan: unknown) => {
      try {
        return normalizeOutlinePlan(plan);
      } catch (error) {
        return null;
      }
    }).filter((plan: OutlinePlan | null): plan is OutlinePlan => plan !== null)
    : [];
  const uniquePlans = uniqueById(plans);
  const requestedActivePlanId = normalizeCompactText(source.activePlanId);
  const activePlan = uniquePlans.find((plan: OutlinePlan) => !plan.archivedAt && plan.id === requestedActivePlanId)
    || uniquePlans.find((plan: OutlinePlan) => !plan.archivedAt)
    || null;

  return {
    activePlanId: activePlan ? activePlan.id : "",
    plans: uniquePlans
  };
}
