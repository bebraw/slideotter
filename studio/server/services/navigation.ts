type JsonRecord = Record<string, unknown>;

type SlideLike = {
  id: string;
  index: number;
  skipped?: boolean;
};

type DetourStack = {
  label: string;
  parentId: string;
  slideIds: string[];
};

type DeckNavigation = {
  coreSlideIds: string[];
  detours: DetourStack[];
  mode: "linear" | "two-dimensional";
};

type PresentationCoordinate = {
  slideId: string;
  x: number;
  y: number;
};

type NavigationValidationIssue = {
  message: string;
  severity: "error" | "warning";
  slideId?: string;
};

type NavigationValidationResult = {
  coordinates: PresentationCoordinate[];
  issues: NavigationValidationIssue[];
  navigation: DeckNavigation;
  ok: boolean;
};

type OrderedSlide<TSlide extends SlideLike> = TSlide & PresentationCoordinate;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function uniqueStrings(values: unknown): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  if (!Array.isArray(values)) {
    return result;
  }

  values.forEach((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function defaultCoreSlideIds(slides: SlideLike[]): string[] {
  return slides
    .filter((slide) => slide.skipped !== true)
    .sort((left, right) => left.index - right.index)
    .map((slide) => slide.id);
}

function normalizeDeckNavigation(source: unknown, slides: SlideLike[]): DeckNavigation {
  const record = asRecord(source);
  const mode = record.mode === "two-dimensional" ? "two-dimensional" : "linear";
  const fallbackCoreSlideIds = defaultCoreSlideIds(slides);
  const knownSlideIds = new Set(slides.map((slide) => slide.id));
  const coreSlideIds = uniqueStrings(record.coreSlideIds).filter((slideId) => knownSlideIds.has(slideId));
  const activeCoreSlideIds = coreSlideIds.length ? coreSlideIds : fallbackCoreSlideIds;
  const coreSet = new Set(activeCoreSlideIds);
  const rawDetours = Array.isArray(record.detours) ? record.detours : [];
  const detours: DetourStack[] = rawDetours
    .map((entry) => {
      const detour = asRecord(entry);
      const parentId = typeof detour.parentId === "string" ? detour.parentId.trim() : "";
      const label = typeof detour.label === "string" ? detour.label.trim() : "";

      return {
        label,
        parentId,
        slideIds: uniqueStrings(detour.slideIds).filter((slideId) => knownSlideIds.has(slideId) && slideId !== parentId)
      };
    })
    .filter((detour) => coreSet.has(detour.parentId) && detour.slideIds.length > 0);

  if (mode !== "two-dimensional") {
    return {
      coreSlideIds: fallbackCoreSlideIds,
      detours: [],
      mode: "linear"
    };
  }

  return {
    coreSlideIds: activeCoreSlideIds,
    detours,
    mode
  };
}

function validateDeckNavigation(source: unknown, slides: SlideLike[]): NavigationValidationResult {
  const record = asRecord(source);
  const knownSlideIds = new Set(slides.map((slide) => slide.id));
  const skippedSlideIds = new Set(slides.filter((slide) => slide.skipped === true).map((slide) => slide.id));
  const navigation = normalizeDeckNavigation(source, slides);
  const issues: NavigationValidationIssue[] = [];
  const seen = new Set<string>();
  const rawCoreSlideIds = uniqueStrings(record.coreSlideIds);
  const rawDetours = Array.isArray(record.detours) ? record.detours.map(asRecord) : [];

  rawCoreSlideIds.forEach((slideId) => {
    if (!knownSlideIds.has(slideId)) {
      issues.push({
        message: `Navigation core path references unknown slide ${slideId}.`,
        severity: "error",
        slideId
      });
    }
    if (skippedSlideIds.has(slideId)) {
      issues.push({
        message: `Navigation core path references skipped slide ${slideId}.`,
        severity: "warning",
        slideId
      });
    }
  });

  navigation.coreSlideIds.forEach((slideId) => {
    if (seen.has(slideId)) {
      issues.push({
        message: `Navigation references slide ${slideId} more than once.`,
        severity: "error",
        slideId
      });
    }
    seen.add(slideId);
  });

  rawDetours.forEach((detour) => {
    const parentId = typeof detour.parentId === "string" ? detour.parentId.trim() : "";
    if (!parentId || !knownSlideIds.has(parentId)) {
      issues.push({
        message: parentId
          ? `Detour references unknown parent slide ${parentId}.`
          : "Detour is missing a parent slide.",
        severity: "error",
        slideId: parentId || undefined
      });
    }
    if (parentId && skippedSlideIds.has(parentId)) {
      issues.push({
        message: `Detour parent ${parentId} is skipped, so its detours are hidden.`,
        severity: "warning",
        slideId: parentId
      });
    }

    uniqueStrings(detour.slideIds).forEach((slideId) => {
      if (!knownSlideIds.has(slideId)) {
        issues.push({
          message: `Detour references unknown slide ${slideId}.`,
          severity: "error",
          slideId
        });
      }
      if (slideId === parentId) {
        issues.push({
          message: `Detour slide ${slideId} cannot also be its parent.`,
          severity: "error",
          slideId
        });
      }
      if (skippedSlideIds.has(slideId)) {
        issues.push({
          message: `Detour references skipped slide ${slideId}.`,
          severity: "warning",
          slideId
        });
      }
    });
  });

  const coordinates = createPresentationCoordinates(navigation, slides, { includeDetours: true });
  coordinates.forEach((coordinate) => {
    if (seen.has(coordinate.slideId) && coordinate.y > 0) {
      issues.push({
        message: `Navigation references slide ${coordinate.slideId} more than once.`,
        severity: "error",
        slideId: coordinate.slideId
      });
    }
    seen.add(coordinate.slideId);
  });

  return {
    coordinates,
    issues,
    navigation,
    ok: !issues.some((issue) => issue.severity === "error")
  };
}

function createPresentationCoordinates(
  navigation: DeckNavigation,
  slides: SlideLike[],
  options: { includeDetours?: boolean } = {}
): PresentationCoordinate[] {
  const activeSlides = slides.filter((slide) => slide.skipped !== true);
  const activeSlideIds = new Set(activeSlides.map((slide) => slide.id));
  const detoursByParent = new Map<string, DetourStack>();
  const coordinates: PresentationCoordinate[] = [];
  const coreSlideIds = navigation.coreSlideIds.filter((slideId) => activeSlideIds.has(slideId));

  navigation.detours.forEach((detour) => {
    detoursByParent.set(detour.parentId, detour);
  });

  coreSlideIds.forEach((slideId, coreIndex) => {
    coordinates.push({
      slideId,
      x: coreIndex + 1,
      y: 0
    });

    if (options.includeDetours !== true) {
      return;
    }

    const detour = detoursByParent.get(slideId);
    if (!detour) {
      return;
    }

    detour.slideIds
      .filter((detourSlideId) => activeSlideIds.has(detourSlideId))
      .forEach((detourSlideId, detourIndex) => {
        coordinates.push({
          slideId: detourSlideId,
          x: coreIndex + 1,
          y: detourIndex + 1
        });
      });
  });

  return coordinates;
}

function orderSlidesForNavigation<TSlide extends SlideLike>(
  slides: TSlide[],
  navigation: DeckNavigation,
  options: { includeDetours?: boolean } = {}
): Array<OrderedSlide<TSlide>> {
  const slidesById = new Map(slides.map((slide) => [slide.id, slide]));
  return createPresentationCoordinates(navigation, slides, options)
    .map((coordinate) => {
      const slide = slidesById.get(coordinate.slideId);
      return slide
        ? {
            ...slide,
            ...coordinate
          }
        : null;
    })
    .filter((entry): entry is OrderedSlide<TSlide> => Boolean(entry));
}

module.exports = {
  createPresentationCoordinates,
  normalizeDeckNavigation,
  orderSlidesForNavigation,
  validateDeckNavigation
};
