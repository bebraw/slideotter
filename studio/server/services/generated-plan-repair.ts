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

function roleForIndex(index: number, total: number): string {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  return contentRoles[(index - 1) % contentRoles.length] || "concept";
}

function normalizePlanRole(role: unknown, index: number, total: number): string {
  const desired = roleForIndex(index, total);
  const normalizedRole = String(role || "").trim();

  if (index === 0 || index === total - 1 && total > 1) {
    return desired;
  }

  if (normalizedRole === "opening" || normalizedRole === "handoff") {
    return desired;
  }

  return supportedPlanRoles.includes(normalizedRole) ? normalizedRole : desired;
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
  normalizePlanRole,
  preserveApprovedSlideTypes,
  roleForIndex,
  supportedPlanRoles,
  supportedSlideTypes
};
