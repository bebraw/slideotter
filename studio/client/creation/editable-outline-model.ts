export type JsonRecord = Record<string, unknown>;

export type DeckPlanSlide = JsonRecord & {
  intent?: string;
  keyMessage?: string;
  role?: string;
  sourceNeed?: string;
  sourceNotes?: string;
  sourceText?: string;
  title?: string;
  visualNeed?: string;
};

export type DeckPlan = JsonRecord & {
  narrativeArc?: string;
  outline?: string;
  slides: DeckPlanSlide[];
  thesis?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function asDeckPlan(value: unknown): DeckPlan | null {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return null;
  }

  return {
    ...value,
    slides: value.slides.filter((slide: unknown): slide is DeckPlanSlide => isRecord(slide))
  };
}

export function cloneDeckPlan(deckPlan: unknown): DeckPlan | null {
  const plan = asDeckPlan(deckPlan);
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    slides: plan.slides.map((slide: DeckPlanSlide) => ({ ...slide }))
  };
}

export function buildEditableDeckPlanOutline(slides: DeckPlanSlide[]): string {
  return slides
    .map((slide: DeckPlanSlide, index: number) => {
      const title = slide.title || `Slide ${index + 1}`;
      const message = slide.keyMessage || slide.intent || "";
      return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
    })
    .join("\n");
}

export function normalizeOutlineLocks(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  const locks: Record<string, boolean> = {};
  Object.entries(value).forEach(([key, lockValue]) => {
    if (/^\d+$/.test(key) && lockValue === true) {
      locks[key] = true;
    }
  });
  return locks;
}

export function updateOutlineLocks(locks: unknown, index: number, locked: boolean): Record<string, boolean> {
  const normalizedLocks = normalizeOutlineLocks(locks);
  if (locked) {
    normalizedLocks[String(index)] = true;
  } else {
    delete normalizedLocks[String(index)];
  }
  return normalizedLocks;
}

export function countUnlockedOutlineSlides(deckPlan: DeckPlan | null, locks: unknown): number {
  const slides = deckPlan?.slides || [];
  const normalizedLocks = normalizeOutlineLocks(locks);
  return slides.filter((_slide: DeckPlanSlide, index: number) => normalizedLocks[String(index)] !== true).length;
}
