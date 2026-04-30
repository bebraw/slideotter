export namespace StudioClientState {
  export type AbortControllerKey = "deckStructureAbortController" | "slideLoadAbortController" | "slideWorkflowAbortController";
  export type RequestSeqKey = "deckStructureRequestSeq" | "slideLoadRequestSeq" | "slideWorkflowRequestSeq";

  type UiState = {
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
    activePresentation: unknown;
    explorer: {
      history: unknown[];
      resource: unknown;
      url: string;
    };
    root: unknown;
  };

  export type State = {
    assistant: {
      selection: unknown;
      session: unknown;
      suggestions: unknown[];
    };
    context: unknown;
    creationDraft: unknown;
    deckLengthPlan: unknown;
    deckStructureAbortController: AbortController | null;
    deckStructureCandidates: unknown[];
    deckStructureRequestSeq: number;
    domPreview: {
      slides: unknown[];
      theme: unknown;
    };
    favoriteLayouts: unknown[];
    hypermedia: HypermediaState;
    layoutStudioSelectedRef: string;
    layouts: unknown[];
    materials: unknown[];
    outlinePlans: unknown[];
    presentations: {
      activePresentationId: string | null;
      presentations: unknown[];
    };
    previews: {
      pages: unknown[];
    };
    runtime: unknown;
    savedThemes: unknown[];
    selectedDeckStructureId: string | null;
    selectedSlideId: string | null;
    selectedSlideIndex: number;
    selectedSlideSource: string;
    selectedSlideSpec: unknown;
    selectedSlideSpecDraftError: unknown;
    selectedSlideSpecError: unknown;
    selectedSlideStructured: boolean;
    selectedVariantId: string | null;
    skippedSlides: unknown[];
    slideLoadAbortController: AbortController | null;
    slideLoadRequestSeq: number;
    slideWorkflowAbortController: AbortController | null;
    slideWorkflowRequestSeq: number;
    slides: unknown[];
    sources: unknown[];
    themeCandidates: unknown[];
    transientVariants: unknown[];
    ui: UiState;
    validation: unknown;
    variantStorage: unknown;
    variants: unknown[];
    workflowHistory: unknown[];
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
      context: null,
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
