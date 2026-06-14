export type MemoryLink = {
  href?: string;
  rel?: string;
  title?: string;
};

export type MemoryItem = {
  confidence?: string;
  detail?: string;
  evidence?: MemoryLink[];
  id?: string;
  status?: string;
  summary?: string;
  tags?: string[];
  type?: string;
  usedBy?: MemoryLink[];
};

export type DerivedSlideset = {
  id?: string;
  memoryIds?: string[];
  purpose?: string;
  resultPresentationId?: string | null;
  targetLength?: number | null;
};

export type StudioSlide = {
  id?: string;
  index?: number;
  slideSpec?: {
    memoryIds?: unknown;
    title?: unknown;
    type?: unknown;
  };
  title?: string;
};

export type MemoryFilters = {
  confidence?: string;
  evidenceState?: "any" | "hasEvidence" | "needsEvidence";
  query?: string;
  status?: string;
  tag?: string;
  type?: string;
  usageState?: "any" | "used" | "unused";
};

export type MemoryBrowserRow = {
  evidenceCount: number;
  item: MemoryItem;
  maintenanceFlags: string[];
  tagText: string;
  usedByCount: number;
};

export type DependencyRow = {
  derivedDecks: string[];
  evidence: string[];
  itemId: string;
  itemSummary: string;
  linkMode: "linked" | "inferred" | "mixed" | "none";
  slides: string[];
};

export type MaintenanceWarning = {
  itemId: string;
  level: "info" | "warning";
  message: string;
  reason: "accepted-without-evidence" | "stale-used" | "retired-used" | "orphaned-high-confidence";
};

export type CoverageSummary = {
  acceptedClaims: number;
  derivedDecks: number;
  evidenceLinkedItems: number;
  maintenanceWarnings: number;
  memoryItems: number;
  usedItems: number;
};

export type DerivedDeckComparison = {
  memoryWorkbench: string[];
  outlineDrawer: string[];
};

function normalizeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function lower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function includesText(value: unknown, query: string): boolean {
  return lower(value).includes(query);
}

function listTags(item: MemoryItem): string[] {
  return Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())) : [];
}

function listLinks(value: unknown): MemoryLink[] {
  return Array.isArray(value) ? value.filter((link): link is MemoryLink => Boolean(link && typeof link === "object")) : [];
}

function itemId(item: MemoryItem): string {
  return normalizeText(item.id);
}

function slideMemoryIds(slide: StudioSlide): string[] {
  const ids = slide.slideSpec?.memoryIds;
  return Array.isArray(ids) ? ids.map(normalizeText).filter(Boolean) : [];
}

function slideTitle(slide: StudioSlide): string {
  const index = Number.isFinite(Number(slide.index)) ? `Slide ${Number(slide.index)}` : "Slide";
  return normalizeText(slide.title || slide.slideSpec?.title || slide.id || index);
}

function usedBySlideLinks(item: MemoryItem, slides: StudioSlide[]): string[] {
  const id = itemId(item);
  const explicit = new Set(
    listLinks(item.usedBy)
      .filter((link) => normalizeText(link.rel) === "slide")
      .map((link) => normalizeText(link.title || link.href))
      .filter(Boolean)
  );
  slides.forEach((slide) => {
    if (slideMemoryIds(slide).includes(id)) {
      explicit.add(slideTitle(slide));
    }
  });
  return [...explicit];
}

function inferredSlideLinks(item: MemoryItem, slides: StudioSlide[]): string[] {
  const summary = lower(item.summary);
  if (!summary || summary.length < 8) {
    return [];
  }
  const terms = summary.split(/[^a-z0-9]+/).filter((term) => term.length > 4).slice(0, 5);
  if (!terms.length) {
    return [];
  }
  return slides
    .filter((slide) => {
      const haystack = lower([
        slide.title,
        slide.slideSpec?.title,
        slide.slideSpec?.type
      ].join(" "));
      return terms.some((term) => haystack.includes(term));
    })
    .map(slideTitle);
}

function relatedDerivedDecks(item: MemoryItem, derivedSlidesets: DerivedSlideset[]): string[] {
  const id = itemId(item);
  return derivedSlidesets
    .filter((deck) => Array.isArray(deck.memoryIds) && deck.memoryIds.includes(id))
    .map((deck) => normalizeText(deck.purpose || deck.id || deck.resultPresentationId || "Derived deck"))
    .filter(Boolean);
}

function evidenceLabels(item: MemoryItem): string[] {
  return listLinks(item.evidence)
    .map((link) => normalizeText(link.title || link.href || link.rel))
    .filter(Boolean);
}

function hasUsage(item: MemoryItem, slides: StudioSlide[], derivedSlidesets: DerivedSlideset[]): boolean {
  return usedBySlideLinks(item, slides).length > 0 || relatedDerivedDecks(item, derivedSlidesets).length > 0;
}

function matchesFilter(item: MemoryItem, filters: MemoryFilters, slides: StudioSlide[], derivedSlidesets: DerivedSlideset[]): boolean {
  const query = lower(filters.query);
  if (query) {
    const haystack = [
      item.id,
      item.type,
      item.status,
      item.confidence,
      item.summary,
      item.detail,
      ...listTags(item),
      ...evidenceLabels(item)
    ].join(" ");
    if (!includesText(haystack, query)) {
      return false;
    }
  }
  if (filters.type && filters.type !== "all" && normalizeText(item.type) !== filters.type) {
    return false;
  }
  if (filters.status && filters.status !== "all" && normalizeText(item.status) !== filters.status) {
    return false;
  }
  if (filters.confidence && filters.confidence !== "all" && normalizeText(item.confidence) !== filters.confidence) {
    return false;
  }
  if (filters.tag && filters.tag !== "all" && !listTags(item).includes(filters.tag)) {
    return false;
  }
  const evidenceCount = listLinks(item.evidence).length;
  if (filters.evidenceState === "hasEvidence" && evidenceCount === 0) {
    return false;
  }
  if (filters.evidenceState === "needsEvidence" && evidenceCount > 0) {
    return false;
  }
  const used = hasUsage(item, slides, derivedSlidesets);
  if (filters.usageState === "used" && !used) {
    return false;
  }
  if (filters.usageState === "unused" && used) {
    return false;
  }
  return true;
}

export function buildMaintenanceWarnings(
  items: MemoryItem[],
  slides: StudioSlide[] = [],
  derivedSlidesets: DerivedSlideset[] = []
): MaintenanceWarning[] {
  return items.flatMap((item) => {
    const id = itemId(item);
    const status = normalizeText(item.status || "draft");
    const evidenceCount = listLinks(item.evidence).length;
    const used = hasUsage(item, slides, derivedSlidesets);
    const warnings: MaintenanceWarning[] = [];
    if (normalizeText(item.type) === "claim" && status === "accepted" && evidenceCount === 0) {
      warnings.push({
        itemId: id,
        level: "warning",
        message: "Accepted claim has no evidence.",
        reason: "accepted-without-evidence"
      });
    }
    if (status === "stale" && used) {
      warnings.push({
        itemId: id,
        level: "warning",
        message: "Stale memory is used by slides or derived decks.",
        reason: "stale-used"
      });
    }
    if (status === "retired" && used) {
      warnings.push({
        itemId: id,
        level: "warning",
        message: "Retired memory is still linked to delivery output.",
        reason: "retired-used"
      });
    }
    if (normalizeText(item.confidence) === "high" && !used) {
      warnings.push({
        itemId: id,
        level: "info",
        message: "High-confidence memory is not used by slides or derived decks.",
        reason: "orphaned-high-confidence"
      });
    }
    return warnings;
  });
}

export function buildBrowserRows(
  items: MemoryItem[],
  filters: MemoryFilters = {},
  slides: StudioSlide[] = [],
  derivedSlidesets: DerivedSlideset[] = []
): MemoryBrowserRow[] {
  const warnings = buildMaintenanceWarnings(items, slides, derivedSlidesets);
  return items
    .filter((item) => matchesFilter(item, filters, slides, derivedSlidesets))
    .map((item) => {
      const id = itemId(item);
      return {
        evidenceCount: listLinks(item.evidence).length,
        item,
        maintenanceFlags: warnings.filter((warning) => warning.itemId === id).map((warning) => warning.reason),
        tagText: listTags(item).join(", "),
        usedByCount: usedBySlideLinks(item, slides).length + relatedDerivedDecks(item, derivedSlidesets).length
      };
    });
}

export function buildDependencyRows(
  items: MemoryItem[],
  slides: StudioSlide[] = [],
  derivedSlidesets: DerivedSlideset[] = []
): DependencyRow[] {
  return items.map((item) => {
    const linkedSlides = usedBySlideLinks(item, slides);
    const inferredSlides = inferredSlideLinks(item, slides).filter((slide) => !linkedSlides.includes(slide));
    const linkMode = linkedSlides.length && inferredSlides.length
      ? "mixed"
      : linkedSlides.length
        ? "linked"
        : inferredSlides.length
          ? "inferred"
          : "none";
    return {
      derivedDecks: relatedDerivedDecks(item, derivedSlidesets),
      evidence: evidenceLabels(item),
      itemId: itemId(item),
      itemSummary: normalizeText(item.summary || "Untitled memory"),
      linkMode,
      slides: [...linkedSlides, ...inferredSlides]
    };
  });
}

export function buildCoverageSummary(
  items: MemoryItem[],
  slides: StudioSlide[] = [],
  derivedSlidesets: DerivedSlideset[] = []
): CoverageSummary {
  return {
    acceptedClaims: items.filter((item) => item.type === "claim" && item.status === "accepted").length,
    derivedDecks: derivedSlidesets.length,
    evidenceLinkedItems: items.filter((item) => listLinks(item.evidence).length > 0).length,
    maintenanceWarnings: buildMaintenanceWarnings(items, slides, derivedSlidesets).length,
    memoryItems: items.length,
    usedItems: items.filter((item) => hasUsage(item, slides, derivedSlidesets)).length
  };
}

export function buildDerivedDeckComparison(derivedSlidesets: DerivedSlideset[]): DerivedDeckComparison {
  const deckCount = derivedSlidesets.length;
  const memoryIds = new Set(derivedSlidesets.flatMap((deck) => Array.isArray(deck.memoryIds) ? deck.memoryIds : []));
  const targetLengths = derivedSlidesets
    .map((deck) => Number(deck.targetLength || 0))
    .filter((length) => Number.isFinite(length) && length > 0);
  return {
    memoryWorkbench: [
      `${memoryIds.size} memory item${memoryIds.size === 1 ? "" : "s"} covered`,
      `${deckCount} derived deck${deckCount === 1 ? "" : "s"} tracked`
    ],
    outlineDrawer: [
      targetLengths.length ? `${Math.min(...targetLengths)}-${Math.max(...targetLengths)} target slides` : "No target lengths recorded",
      "Compare section order, density, pacing, and narrative arc in Outline"
    ]
  };
}
