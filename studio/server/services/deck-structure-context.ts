import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray,
  compactSentence as sentence
} from "../../shared/json-utils.ts";
import { describeDesignConstraints } from "./design-constraints.ts";
import { getSlides, readSlideSpec } from "./slides.ts";

type JsonObject = Record<string, unknown>;

export type DeckStructureSlide = JsonObject & {
  currentTitle: string;
  id: string;
  index: number;
  intent: string;
  outlineLine: string;
  summary: string;
  type: string | null;
  value: string;
};

export type DeckStructureContext = JsonObject & {
  audience: string;
  constraints: string;
  deck: JsonObject;
  objective: string;
  outlineLines: string[];
  slides: DeckStructureSlide[];
  themeBrief: string;
  title: string;
  tone: string;
};

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
      const slideContext = context.slides[slideId] || {};
      let slideSpec: JsonObject | null = null;
      try {
        slideSpec = asJsonObject(readSlideSpec(slideId));
      } catch (error) {
        slideSpec = null;
      }
      return {
        currentTitle: sentence(slideContext.title || (slideSpec && slideSpec.title) || slide.title, `Slide ${index + 1}`, 10),
        id: slideId,
        index: Number(slide.index || index + 1),
        intent: sentence(slideContext.intent, slideSpec && slideSpec.summary ? slideSpec.summary : "make the slide's job clear"),
        outlineLine: outlineLines[index] || sentence(slideSpec && slideSpec.title ? slideSpec.title : slide.title, "Untitled section", 8),
        summary: sentence(slideSpec && slideSpec.summary ? slideSpec.summary : slide.title, slideSpec && slideSpec.title ? slideSpec.title : slide.title, 12),
        type: slideSpec && slideSpec.type ? String(slideSpec.type) : null,
        value: sentence(slideContext.value, slideContext.intent || slideSpec && slideSpec.summary || slide.title, 12)
      };
    }),
    themeBrief: sentence(deck.themeBrief, "keep the surface quiet, readable, and deliberate"),
    title: sentence(deck.title, "slideotter", 10),
    tone: sentence(deck.tone, "calm and exact")
  };
}
