import type { StudioClientState } from "../core/state";

type OutlinePlan = StudioClientState.OutlinePlan;
type OutlinePlanSection = StudioClientState.OutlinePlanSection;
type OutlinePlanSlide = StudioClientState.OutlinePlanSlide;
type StudioSlide = StudioClientState.StudioSlide;

export type OutlinePlanSlideComparison = {
  currentTitle: string;
  intent: string;
  layoutHint: string;
  mustInclude: string;
  title: string;
};

export type OutlinePlanSectionComparison = {
  intent: string;
  slides: OutlinePlanSlideComparison[];
  title: string;
};

export type OutlinePlanComparison = {
  currentSequence: string;
  sections: OutlinePlanSectionComparison[];
};

export type OutlinePlanCardSummary = {
  purpose: string;
  sectionCount: number;
  slideCount: number;
  statsText: string;
  title: string;
};

export function countOutlinePlanSlides(plan: OutlinePlan): number {
  const sections: OutlinePlanSection[] = Array.isArray(plan.sections) ? plan.sections : [];
  return sections
    .reduce((count: number, section: OutlinePlanSection) => count + (Array.isArray(section.slides) ? section.slides.length : 0), 0);
}

export function buildOutlinePlanCardSummary(plan: OutlinePlan): OutlinePlanCardSummary {
  const sectionCount = Array.isArray(plan.sections) ? plan.sections.length : 0;
  const slideCount = countOutlinePlanSlides(plan);
  return {
    purpose: plan.purpose || plan.objective || "No purpose saved.",
    sectionCount,
    slideCount,
    statsText: [`${sectionCount} section${sectionCount === 1 ? "" : "s"}`, `${slideCount} slide intent${slideCount === 1 ? "" : "s"}`].join(" | "),
    title: plan.name || "Outline plan"
  };
}

export function buildOutlinePlanComparison(plan: OutlinePlan, currentSlides: StudioSlide[]): OutlinePlanComparison {
  const sections: OutlinePlanSection[] = Array.isArray(plan.sections) ? plan.sections : [];
  const currentSequence = currentSlides
    .map((slide: StudioSlide) => `${slide.index}. ${slide.title || slide.id}`)
    .join(" | ");

  return {
    currentSequence: currentSequence || "No active slides.",
    sections: sections.map((section: OutlinePlanSection, sectionIndex: number) => {
      const slides: OutlinePlanSlide[] = Array.isArray(section.slides) ? section.slides : [];
      return {
        intent: section.intent || "No section intent saved.",
        slides: slides.map((slide: OutlinePlanSlide, slideIndex: number) => {
          const currentSlide = slide.sourceSlideId
            ? currentSlides.find((entry: StudioSlide) => entry.id === slide.sourceSlideId)
            : currentSlides[slideIndex];
          return {
            currentTitle: currentSlide ? `${currentSlide.index}. ${currentSlide.title}` : "New or unmatched",
            intent: slide.intent || "No slide intent saved.",
            layoutHint: slide.layoutHint || "None",
            mustInclude: (slide.mustInclude || []).join(" / ") || "None",
            title: slide.workingTitle || `Slide ${slideIndex + 1}`
          };
        }),
        title: section.title || `Section ${sectionIndex + 1}`
      };
    })
  };
}
