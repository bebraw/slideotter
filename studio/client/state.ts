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
    lengthProfile?: {
      targetCount?: number;
    };
    navigation?: JsonRecord & {
      coreSlideIds?: unknown;
      detours?: unknown;
      mode?: unknown;
    };
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
    contentRun?: {
      completed?: number;
      failedSlideIndex?: number;
      id?: string;
      slideCount?: number;
      slides?: Array<JsonRecord & {
        error?: string;
        errorLogPath?: string;
        slideSpec?: JsonRecord;
        status?: string;
      }>;
      status?: string;
    };
    approvedOutline?: boolean;
    createdPresentationId?: string;
    deckPlan?: JsonRecord & {
      narrativeArc?: string;
      outline?: string;
      slides?: JsonRecord[];
      thesis?: string;
    };
    fields?: JsonRecord;
    outlineDirty?: boolean;
    outlineLocks?: Record<string, boolean>;
    retrieval?: JsonRecord & {
      snippets?: Array<{ text?: string; title?: string }>;
    };
    stage?: string;
  };

  export type AssistantSelection = {
    kind?: string;
    label?: string;
    presentationId?: string | null;
    scopeLabel?: string;
    selectedText?: string;
    selections?: unknown[];
    slideIndex?: number;
    slideId?: string | null;
    text?: string;
  };

  export type AssistantSuggestion = {
    label: string;
    prompt: string;
  };

  export type AssistantSession = {
    id?: string;
    messages?: Array<{
      content: string;
      role: string;
      selection?: AssistantSelection;
    }>;
  };

  export type StudioSlide = JsonRecord & {
    id: string;
    index: number;
    skipReason?: string;
    slideSpec?: JsonRecord;
    title?: string;
  };

  export type SourceRecord = JsonRecord & {
    chunkCount?: number;
    id?: string;
    preview?: string;
    title?: string;
    url?: string;
    wordCount?: number;
  };

  export type DeckLengthAction = JsonRecord & {
    action?: string;
    confidence?: string;
    reason?: string;
    slideId?: string;
    targetIndex?: number | string;
    title?: string;
  };

  export type DeckLengthPlan = JsonRecord & {
    actions?: DeckLengthAction[];
    mode?: string;
    nextCount?: number;
    summary?: string;
    targetCount?: number;
  };

  export type DeckStructurePlanStep = JsonRecord & {
    action?: string;
    currentIndex?: number;
    currentTitle?: string;
    proposedIndex?: number;
    proposedTitle?: string;
    rationale?: string;
    role?: string;
    summary?: string;
    title?: string;
  };

  export type DeckStructureCandidate = JsonRecord & {
    deckPatch?: unknown;
    diff?: JsonRecord;
    id: string;
    kindLabel?: string;
    label?: string;
    notes?: string;
    outline?: string;
    planStats?: JsonRecord;
    preview?: JsonRecord;
    promptSummary?: string;
    slides?: DeckStructurePlanStep[];
    summary?: string;
  };

  export type OutlinePlanSlide = JsonRecord & {
    intent?: string;
    layoutHint?: string;
    mustInclude?: string[];
    sourceSlideId?: string;
    workingTitle?: string;
  };

  export type OutlinePlanSection = JsonRecord & {
    intent?: string;
    slides?: OutlinePlanSlide[];
    title?: string;
  };

  export type OutlinePlan = JsonRecord & {
    id: string;
    name?: string;
    objective?: string;
    purpose?: string;
    sections?: OutlinePlanSection[];
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
    name: string;
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
    id: string;
    title?: string;
  };

  export type WorkflowState = JsonRecord & {
    id?: string;
    message?: string;
    operation?: string;
    slideId?: string;
    stage?: string;
    status?: string;
  };

  export type RuntimeState = JsonRecord & {
    promptBudget?: JsonRecord & {
      developerPromptCharCount?: string | number | null;
      materialPromptCharCount?: string | number | null;
      model?: string | number | null;
      provider?: string | number | null;
      requestedMaxOutputTokens?: string | number | null;
      responseCharCount?: string | number | null;
      retryCount?: string | number | null;
      schemaCharCount?: string | number | null;
      schemaName?: string | number | null;
      sourcePromptCharCount?: string | number | null;
      totalPromptCharCount?: string | number | null;
      userPromptCharCount?: string | number | null;
      workflowName?: string | number | null;
    };
    sourceRetrieval?: JsonRecord & {
      budget?: JsonRecord;
      snippets?: Array<{
        chunkIndex?: number | string;
        sourceId?: string;
        text?: string;
        title?: string;
        url?: string;
      }>;
    };
    validation?: {
      ok?: boolean;
      updatedAt?: string;
    };
    workflow?: WorkflowState | null;
  };

  export type HypermediaResource = JsonRecord & {
    links?: Record<string, { href?: string } | null | undefined>;
  };

  export type PreviewPage = JsonRecord & {
    generatedAt?: string;
    index: number;
    url: string;
  };

  export type CurrentPage = "presentations" | "studio";

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
    currentPage: CurrentPage;
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
    outlineDrawerOpen: boolean;
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
      selection: AssistantSelection | null;
      session: AssistantSession | null;
      suggestions: AssistantSuggestion[];
    };
    context: DeckContext;
    creationDraft: CreationDraft | null;
    deckLengthPlan: DeckLengthPlan | null;
    deckStructureAbortController: AbortController | null;
    deckStructureCandidates: DeckStructureCandidate[];
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
    customVisuals: JsonRecord[];
    outlinePlans: OutlinePlan[];
    presentations: {
      activePresentationId: string | null;
      presentations: PresentationSummary[];
    };
    previews: {
      generatedAt?: string;
      pages: PreviewPage[];
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
    sources: SourceRecord[];
    themeCandidates: ThemeCandidate[];
    transientVariants: VariantRecord[];
    ui: UiState;
    validation: JsonRecord | null;
    variantStorage: unknown;
    variants: VariantRecord[];
    workflowHistory: WorkflowState[];
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
      customVisuals: [],
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
        outlineDrawerOpen: false,
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
