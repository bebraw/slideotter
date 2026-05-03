type SlideWithType = {
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
      type: String(approvedType)
    };
  });
}

export {
  isSupportedSlideType,
  contentRoles,
  normalizeGeneratedSlideType,
  preserveApprovedSlideTypes,
  supportedPlanRoles,
  supportedSlideTypes
};
