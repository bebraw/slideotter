type JsonObject = Record<string, unknown>;

export type TextPoint = JsonObject & {
  body?: unknown;
  title?: unknown;
};

export type MaterialCandidate = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  id: string;
  license?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
};

export type PlanSlideMaterialContext = {
  keyPoints?: TextPoint[];
  mediaMaterialId?: unknown;
  summary?: unknown;
  title?: unknown;
};
