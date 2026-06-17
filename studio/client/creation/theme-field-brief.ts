import type { StudioClientElements } from "../core/elements.ts";

export function setBrief(elements: StudioClientElements.Elements, value: unknown): void {
  const nextValue = String(value || "");
  elements.deckThemeBrief.value = nextValue;
  if (elements.themeBrief) {
    elements.themeBrief.value = nextValue;
  }
}

export function getBrief(elements: StudioClientElements.Elements): string {
  return String(elements.themeBrief ? elements.themeBrief.value : elements.deckThemeBrief.value || "");
}
