type DeckPlanSlide = {
  sourceNeed?: unknown;
  sourceNotes?: unknown;
  sourceText?: unknown;
};

export function formatSourceOutlineText(slide: DeckPlanSlide | null): string {
  const sourceNotes = slide && (slide.sourceNotes || slide.sourceText);
  if (sourceNotes) {
    return String(sourceNotes);
  }

  return slide && slide.sourceNeed ? String(slide.sourceNeed) : "No source guidance yet.";
}
