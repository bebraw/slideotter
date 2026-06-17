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
