type SlideNavigationKeyInput = {
  altKey: boolean;
  ctrlKey: boolean;
  currentPage: string;
  interactiveTarget: boolean;
  key: string;
  metaKey: boolean;
  selectedVariantId: string | null;
  shiftKey: boolean;
};

type SlideNavigationEntry = {
  index: number;
};

function hasShortcutModifier(input: SlideNavigationKeyInput): boolean {
  return input.altKey || input.ctrlKey || input.metaKey || input.shiftKey;
}

function normalizeSlideIndexes(slides: readonly SlideNavigationEntry[]): number[] {
  return slides
    .map((slide) => Number(slide.index))
    .filter((index) => Number.isFinite(index) && index > 0)
    .sort((left, right) => left - right);
}

export function getSlideNavigationDelta(input: SlideNavigationKeyInput): number {
  if (
    input.currentPage !== "studio"
    || input.interactiveTarget
    || input.selectedVariantId
    || hasShortcutModifier(input)
  ) {
    return 0;
  }

  if (input.key === "ArrowLeft") {
    return -1;
  }
  if (input.key === "ArrowRight") {
    return 1;
  }
  return 0;
}

export function getAdjacentSlideIndex(
  slides: readonly SlideNavigationEntry[],
  selectedSlideIndex: number,
  delta: number
): number | null {
  if (delta === 0) {
    return null;
  }

  const indexes = normalizeSlideIndexes(slides);
  if (!indexes.length) {
    return null;
  }

  const currentIndex = Number(selectedSlideIndex);
  const currentPosition = indexes.findIndex((index) => index === currentIndex);
  if (currentPosition < 0) {
    const fallbackIndex = delta > 0 ? indexes[0] : indexes[indexes.length - 1];
    return typeof fallbackIndex === "number" ? fallbackIndex : null;
  }

  const nextIndex = indexes[currentPosition + delta];
  return typeof nextIndex === "number" ? nextIndex : null;
}

export function isSlideNavigationInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const interactiveElement = target.closest(
    "a, button, input, select, textarea, summary, [contenteditable='true'], [role='button'], [role='textbox'], [role='tab']"
  );
  return Boolean(interactiveElement);
}
