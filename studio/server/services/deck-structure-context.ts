import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-record-utils.ts";
import { compactSentence as sentence } from "../../shared/text-utils.ts";
import { describeDesignConstraints } from "./design-constraints.ts";
import {
  type DeckStructureContext,
  type DeckStructureSlide
} from "./deck-structure-context-types.ts";
import { getSlides, readSlideSpec } from "./slides.ts";

type JsonObject = Record<string, unknown>;

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

function splitLines(value: unknown): string[] {
  return String(value || "")
    .split(/\n|;/)
    .map((line) => line.replace(/^[\s*-]+/, "").trim())
    .filter(Boolean);
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.map((value: unknown) => String(value || "").trim()).filter(Boolean))];
}

function getDeckConstraintLines(deck: JsonObject = {}): string[] {
  return unique([
    ...splitLines(deck.constraints),
    ...describeDesignConstraints(deck.designConstraints)
  ]);
}

function toOutlineLines(value: unknown): string[] {
  return unique(splitLines(value)).map((line) => sentence(line, "Untitled section", 8));
}

function readOptionalSlideSpec(slideId: string): JsonObject | null {
  try {
    return asJsonObject(readSlideSpec(slideId));
  } catch {
    return null;
  }
}

function firstPresent(...values: unknown[]): unknown {
  return values.find((value) => Boolean(value));
}

function getSlideSpecField(slideSpec: JsonObject | null, field: string): unknown {
  return slideSpec ? slideSpec[field] : undefined;
}

function collectDeckStructureSlide(params: {
  index: number;
  outlineLine: string | undefined;
  slide: JsonObject;
  slideContext: JsonObject;
}): DeckStructureSlide {
  const { index, outlineLine, slide, slideContext } = params;
  const slideId = String(slide.id || `slide-${index + 1}`);
  const slideSpec = readOptionalSlideSpec(slideId);
  const slideTitle = firstPresent(getSlideSpecField(slideSpec, "title"), slide.title);
  const slideSummary = firstPresent(getSlideSpecField(slideSpec, "summary"), slide.title);

  return {
    currentTitle: sentence(firstPresent(slideContext.title, slideTitle), `Slide ${index + 1}`, 10),
    id: slideId,
    index: Number(slide.index || index + 1),
    intent: sentence(slideContext.intent, firstPresent(slideSummary, "make the slide's job clear")),
    outlineLine: outlineLine || sentence(slideTitle, "Untitled section", 8),
    summary: sentence(slideSummary, slideTitle, 12),
    type: getSlideSpecField(slideSpec, "type") ? String(getSlideSpecField(slideSpec, "type")) : null,
    value: sentence(slideContext.value, firstPresent(slideContext.intent, slideSummary, slide.title), 12)
  };
}

export function collectDeckStructureContext(context: DeckContext): DeckStructureContext {
  const deck = asJsonObject(context.deck);
  const slides = asJsonObjectArray(getSlides());
  const outlineLines = toOutlineLines(deck.outline);

  return {
    audience: sentence(deck.audience, "the next editor"),
    constraints: sentence(getDeckConstraintLines(deck)[0], "keep the shared runtime as the source of truth"),
    deck,
    objective: sentence(deck.objective, "turn deck editing into a repeatable studio loop"),
    outlineLines,
    slides: slides.map((slide: JsonObject, index: number) => {
      const slideId = String(slide.id || `slide-${index + 1}`);
      return collectDeckStructureSlide({
        index,
        outlineLine: outlineLines[index],
        slide,
        slideContext: context.slides[slideId] || {}
      });
    }),
    themeBrief: sentence(deck.themeBrief, "keep the surface quiet, readable, and deliberate"),
    title: sentence(deck.title, "slideotter", 10),
    tone: sentence(deck.tone, "calm and exact")
  };
}
