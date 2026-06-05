const approvedTypePreservedMarker: unique symbol = Symbol("slideotter.approvedTypePreserved");

type SlideWithType = {
  [approvedTypePreservedMarker]?: unknown;
  type?: unknown;
};

const supportedSlideTypes = ["cover", "toc", "content", "summary", "divider", "quote", "photo", "photoGrid"];
const contentRoles = ["context", "concept", "mechanics", "example", "tradeoff"];
const supportedPlanRoles = ["opening", ...contentRoles, "divider", "reference", "handoff"];

function isSupportedSlideType(value: unknown): value is string {
  return supportedSlideTypes.includes(String(value || ""));
}

function normalizeGeneratedSlideType(value: unknown, fallback = "content"): string {
  return isSupportedSlideType(value) ? String(value) : fallback;
}

function preserveApprovedSlideTypes<Slide extends SlideWithType>(
  generatedSlides: Slide[],
  approvedSlides: SlideWithType[]
): Slide[] {
  return generatedSlides.map((slide, index) => {
    const approvedType = approvedSlides[index]?.type;
    if (!isSupportedSlideType(approvedType)) {
      return slide;
    }

    return {
      ...slide,
      [approvedTypePreservedMarker]: true,
      type: String(approvedType)
    };
  });
}

function hasApprovedTypePreserved(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (value as SlideWithType)[approvedTypePreservedMarker] === true;
}

export {
  hasApprovedTypePreserved,
  isSupportedSlideType,
  contentRoles,
  normalizeGeneratedSlideType,
  preserveApprovedSlideTypes,
  supportedPlanRoles,
  supportedSlideTypes
};
