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
  plans: OutlinePlan[];
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function createSlug(value: unknown, fallback = "presentation"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return slug || fallback;
}

function normalizeTargetSlideCount(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(Math.max(1, parsed), 200);
}

function normalizeCompactText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
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
  const sourceScope = asJsonObject(source.sourceScope);

  return {
    id,
    name,
    sourcePresentationId: normalizeCompactText(source.sourcePresentationId || fallback.sourcePresentationId),
    parentPlanId: normalizeCompactText(source.parentPlanId || fallback.parentPlanId),
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
      sources: Array.isArray(sourceScope.sources)
        ? sourceScope.sources.map((item: unknown) => normalizeCompactText(item)).filter(Boolean)
        : [],
      materials: Array.isArray(sourceScope.materials)
        ? sourceScope.materials.map((item: unknown) => normalizeCompactText(item)).filter(Boolean)
        : []
    },
    traceability: Array.isArray(source.traceability)
      ? source.traceability.map(normalizeTraceabilityEntry).filter((entry: JsonObject | null): entry is JsonObject => entry !== null)
      : [],
    sections,
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

  return {
    plans: uniqueById(plans).slice(0, 50)
  };
}
