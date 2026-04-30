export namespace StudioClientState {
  export type AbortControllerKey = "deckStructureAbortController" | "slideLoadAbortController" | "slideWorkflowAbortController";
  export type RequestSeqKey = "deckStructureRequestSeq" | "slideLoadRequestSeq" | "slideWorkflowRequestSeq";
  export type JsonRecord = Record<string, unknown>;

  export type VisualTheme = JsonRecord & {
    accent?: string;
    bg?: string;
    fontFamily?: string;
    light?: string;
    muted?: string;
    panel?: string;
    primary?: string;
    progressFill?: string;
    progressTrack?: string;
    secondary?: string;
    surface?: string;
  };

  export type ValidationSettings = JsonRecord & {
    mediaValidationMode?: string;
    rules?: Record<string, unknown>;
  };

  export type DesignConstraints = JsonRecord & {
    maxWordsPerSlide?: unknown;
    minCaptionGapIn?: unknown;
    minContentGapIn?: unknown;
    minFontSizePt?: unknown;
    minPanelPaddingIn?: unknown;
  };

  export type DeckFields = JsonRecord & {
    audience?: string;
    author?: string;
    company?: string;
    constraints?: string;
    designConstraints?: DesignConstraints;
    lang?: string;
    objective?: string;
    outline?: string;
    subject?: string;
    themeBrief?: string;
    title?: string;
    tone?: string;
    validationSettings?: ValidationSettings;
    visualTheme?: VisualTheme;
  };

  export type DeckContext = {
    deck?: DeckFields;
    slides?: Record<string, JsonRecord>;
  };

  export type CreationDraft = JsonRecord & {
    fields?: JsonRecord;
    stage?: string;
  };

  export type StudioSlide = JsonRecord & {
    id: string;
    index: number;
    slideSpec?: JsonRecord;
    title?: string;
  };

  export type VariantRecord = JsonRecord & {
    id?: string;
    label?: string;
    previewImage?: {
      url: string;
    };
    slideId?: string;
    slideSpec?: JsonRecord;
    visualTheme?: unknown;
  };

  export type SavedTheme = JsonRecord & {
    id: string;
    name?: string;
    theme?: VisualTheme;
  };

  export type ThemeCandidate = JsonRecord & {
    id: string;
    label: string;
    note: string;
    theme: VisualTheme;
  };

  export type SavedLayout = JsonRecord & {
    id: string;
  };

  export type PresentationSummary = JsonRecord & {
    id?: string;
    title?: string;
  };

  export type RuntimeState = JsonRecord & {
    workflow?: JsonRecord | null;
  };

  export type HypermediaResource = JsonRecord & {
    links?: Record<string, { href?: string } | null | undefined>;
  };

  type UiState = {
    [key: string]: boolean | number | string | null | Record<string, boolean>;
    appTheme: string;
    assistantOpen: boolean;
    checksOpen: boolean;
    contextDrawerOpen: boolean;
    creationContentSlideIndex: number;
    creationContentSlidePinned: boolean;
    creationStage: string;
    creationStudioRefreshPending: boolean;
    creationThemeVariantId: string;
    currentPage: string;
    customLayoutDefinitionPreviewActive: boolean;
    customLayoutDraftRequestSeq: number;
    customLayoutDraftSlideId: string;
    customLayoutDraftSlideType: string;
    customLayoutMainPreviewActive: boolean;
    customLayoutPreviewMode: string;
    debugDrawerOpen: boolean;
    deckPlanApplySharedSettings: Record<string, boolean>;
    lastCreatedPresentationId: string | null;
    layoutDrawerOpen: boolean;
    llmChecking: boolean;
    llmPopoverOpen: boolean;
    structuredDraftOpen: boolean;
    themeCandidateRefreshIndex: number;
    themeCandidatesGenerated: boolean;
    themeDrawerOpen: boolean;
    variantReviewOpen: boolean;
  };

  type HypermediaState = {
    activePresentation: HypermediaResource | null;
    explorer: {
      history: string[];
      resource: JsonRecord | null;
      url: string;
    };
    root: HypermediaResource | null;
  };

  export type State = {
    assistant: {
      selection: unknown;
      session: unknown;
      suggestions: unknown[];
    };
    context: DeckContext;
    creationDraft: CreationDraft | null;
    deckLengthPlan: unknown;
    deckStructureAbortController: AbortController | null;
    deckStructureCandidates: JsonRecord[];
    deckStructureRequestSeq: number;
    domPreview: {
      slides: StudioSlide[];
      theme: unknown;
    };
    favoriteLayouts: SavedLayout[];
    hypermedia: HypermediaState;
    layoutStudioSelectedRef: string;
    layouts: SavedLayout[];
    materials: JsonRecord[];
    outlinePlans: JsonRecord[];
    presentations: {
      activePresentationId: string | null;
      presentations: PresentationSummary[];
    };
    previews: {
      pages: JsonRecord[];
    };
    runtime: RuntimeState | null;
    savedThemes: SavedTheme[];
    selectedDeckStructureId: string | null;
    selectedSlideId: string | null;
    selectedSlideIndex: number;
    selectedSlideSource: string;
    selectedSlideSpec: JsonRecord | null;
    selectedSlideSpecDraftError: unknown;
    selectedSlideSpecError: unknown;
    selectedSlideStructured: boolean;
    selectedVariantId: string | null;
    skippedSlides: StudioSlide[];
    slideLoadAbortController: AbortController | null;
    slideLoadRequestSeq: number;
    slideWorkflowAbortController: AbortController | null;
    slideWorkflowRequestSeq: number;
    slides: StudioSlide[];
    sources: JsonRecord[];
    themeCandidates: ThemeCandidate[];
    transientVariants: VariantRecord[];
    ui: UiState;
    validation: JsonRecord | null;
    variantStorage: unknown;
    variants: VariantRecord[];
    workflowHistory: JsonRecord[];
  };

  export type AbortableRequest = {
    abortController: AbortController;
    requestSeq: number;
  };

  export function createInitialState(): State {
    return {
      assistant: {
        selection: null,
        session: null,
        suggestions: []
      },
      context: {},
      creationDraft: null,
      deckLengthPlan: null,
      deckStructureAbortController: null,
      deckStructureCandidates: [],
      deckStructureRequestSeq: 0,
      domPreview: {
        slides: [],
        theme: null
      },
      favoriteLayouts: [],
      layoutStudioSelectedRef: "",
      hypermedia: {
        activePresentation: null,
        explorer: {
          history: [],
          resource: null,
          url: "/api/v1"
        },
        root: null
      },
      layouts: [],
      materials: [],
      outlinePlans: [],
      presentations: {
        activePresentationId: null,
        presentations: []
      },
      previews: { pages: [] },
      runtime: null,
      savedThemes: [],
      selectedDeckStructureId: null,
      selectedSlideId: null,
      selectedSlideIndex: 1,
      selectedSlideSpec: null,
      selectedSlideSpecDraftError: null,
      selectedSlideSpecError: null,
      selectedSlideSource: "",
      selectedSlideStructured: false,
      selectedVariantId: null,
      skippedSlides: [],
      slideLoadAbortController: null,
      slideLoadRequestSeq: 0,
      slideWorkflowAbortController: null,
      slideWorkflowRequestSeq: 0,
      slides: [],
      sources: [],
      transientVariants: [],
      themeCandidates: [],
      ui: {
        appTheme: "light",
        assistantOpen: false,
        checksOpen: false,
        contextDrawerOpen: false,
        creationContentSlideIndex: 1,
        creationContentSlidePinned: false,
        creationStage: "brief",
        creationStudioRefreshPending: false,
        creationThemeVariantId: "current",
        currentPage: "studio",
        customLayoutDefinitionPreviewActive: false,
        customLayoutDraftSlideId: "",
        customLayoutDraftRequestSeq: 0,
        customLayoutDraftSlideType: "",
        customLayoutMainPreviewActive: false,
        customLayoutPreviewMode: "slide",
        debugDrawerOpen: false,
        deckPlanApplySharedSettings: {},
        lastCreatedPresentationId: null,
        layoutDrawerOpen: false,
        llmChecking: false,
        llmPopoverOpen: false,
        structuredDraftOpen: false,
        themeCandidateRefreshIndex: 0,
        themeCandidatesGenerated: false,
        themeDrawerOpen: false,
        variantReviewOpen: false
      },
      validation: null,
      variantStorage: null,
      variants: [],
      workflowHistory: []
    };
  }

  export function beginAbortableRequest(state: State, controllerKey: AbortControllerKey, requestSeqKey: RequestSeqKey): AbortableRequest {
    const requestSeq = state[requestSeqKey] + 1;
    state[requestSeqKey] = requestSeq;
    if (state[controllerKey]) {
      state[controllerKey].abort();
    }
    const abortController = new AbortController();
    state[controllerKey] = abortController;
    return { abortController, requestSeq };
  }

  export function isCurrentAbortableRequest(
    state: State,
    controllerKey: AbortControllerKey,
    requestSeqKey: RequestSeqKey,
    requestSeq: number,
    abortController: AbortController
  ): boolean {
    return requestSeq === state[requestSeqKey] && abortController === state[controllerKey];
  }

  export function clearAbortableRequest(state: State, controllerKey: AbortControllerKey, abortController: AbortController): void {
    if (state[controllerKey] === abortController) {
      state[controllerKey] = null;
    }
  }
}
