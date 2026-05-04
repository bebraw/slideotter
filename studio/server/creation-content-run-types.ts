import * as http from "http";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  media?: JsonObject;
  mediaItems?: unknown;
  skipped?: unknown;
  title?: unknown;
};

type StarterMaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  title?: unknown;
};

type MaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  id?: unknown;
  license?: unknown;
  licenseUrl?: unknown;
  provider?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
};

type CreationFields = JsonObject & {
  imageSearch: {
    count: unknown;
    provider: unknown;
    query: string;
    restrictions: string;
  };
  presentationSourceText: string;
  targetSlideCount: unknown;
  title: string;
  visualTheme: JsonObject;
};

type DeckPlanSlide = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  title?: unknown;
  visualNeed?: unknown;
};

type DeckPlanPayload = JsonObject & {
  outline?: unknown;
  slides?: DeckPlanSlide[];
};

type ContentRunSlide = JsonObject & {
  error?: unknown;
  errorLogPath?: unknown;
  slideContext?: unknown;
  slideSpec?: SlideSpecPayload | null;
  status?: unknown;
};

type ContentRunState = JsonObject & {
  completed?: unknown;
  failedSlideIndex?: unknown;
  id?: unknown;
  materials?: MaterialPayload[];
  slides?: ContentRunSlide[];
  sourceText?: unknown;
  status?: unknown;
  stopRequested?: unknown;
};

type ContentRunPatch = JsonObject & {
  completed?: unknown;
  failedSlideIndex?: unknown;
  slides?: ContentRunSlide[];
  status?: unknown;
};

type GenerationProgressPayload = JsonObject & {
  slideCount?: unknown;
  slideIndex?: unknown;
  stage?: unknown;
};

type GeneratedPartialSlidePayload = JsonObject & {
  slideContexts?: unknown;
  slideCount?: unknown;
  slideIndex?: unknown;
  slideSpec?: unknown;
};

type GenerationDraftFields = CreationFields & {
  includeActiveMaterials: boolean;
  includeActiveSources: boolean;
  onProgress: ((progress: GenerationProgressPayload) => void) | undefined;
  presentationMaterials: MaterialPayload[];
  presentationSourceText: string;
};

type CreationContentRunHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  createWorkflowProgressReporter: (baseState: JsonObject) => (progress: JsonObject) => void;
  errorCode: (error: unknown) => string;
  errorMessage: (error: unknown) => string;
  isJsonObject: (value: unknown) => value is JsonObject;
  jsonObjectOrEmpty: (value: unknown) => JsonObject;
  normalizeCreationFields: (body?: JsonObject) => CreationFields;
  publishCreationDraftUpdate: (draft: unknown) => void;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  resetPresentationRuntime: () => void;
  runtimeState: {
    lastError: {
      message?: string;
      updatedAt?: string;
    } | null;
    sourceRetrieval: unknown;
    workflow: JsonObject | null;
  };
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

export type {
  ContentRunPatch,
  ContentRunSlide,
  ContentRunState,
  CreationContentRunHandlerDependencies,
  CreationFields,
  DeckPlanPayload,
  DeckPlanSlide,
  GeneratedPartialSlidePayload,
  GenerationDraftFields,
  GenerationProgressPayload,
  JsonObject,
  MaterialPayload,
  ServerRequest,
  ServerResponse,
  SlideSpecPayload,
  StarterMaterialPayload
};
