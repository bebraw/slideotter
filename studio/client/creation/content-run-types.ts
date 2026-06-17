export type ContentRunSlide = Record<string, unknown> & {
  error?: string;
  errorLogPath?: string;
  slideSpec?: Record<string, unknown>;
  status?: string;
};

export type ContentRun = Record<string, unknown> & {
  completed?: number;
  failedSlideIndex?: number;
  slideCount?: number;
  slides?: ContentRunSlide[];
  status?: string;
};

export type ContentRunDeckPlanSlide = Record<string, unknown> & {
  intent?: unknown;
  keyMessage?: unknown;
  sourceNeed?: unknown;
  title?: unknown;
  value?: unknown;
  visualNeed?: unknown;
};

export type ContentRunDeckPlan = Record<string, unknown> & {
  slides?: ContentRunDeckPlanSlide[];
};

export type ContentRunActionState = {
  completedCount: number;
  failedIndex: number;
  incompleteCount: number;
  run: ContentRun;
  runSlides: ContentRunSlide[];
  slideCount: number;
};

export type ContentRunPreviewState = ContentRunActionState & {
  planSlide: ContentRunDeckPlanSlide;
  runSlide: ContentRunSlide | null;
  selected: number;
  status: string;
  statusLabel: string;
};
