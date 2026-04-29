namespace StudioClientState {
  export function createInitialState() {
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

  export function beginAbortableRequest(state, controllerKey, requestSeqKey) {
    const requestSeq = state[requestSeqKey] + 1;
    state[requestSeqKey] = requestSeq;
    if (state[controllerKey]) {
      state[controllerKey].abort();
    }
    const abortController = new AbortController();
    state[controllerKey] = abortController;
    return { abortController, requestSeq };
  }

  export function isCurrentAbortableRequest(state, controllerKey, requestSeqKey, requestSeq, abortController) {
    return requestSeq === state[requestSeqKey] && abortController === state[controllerKey];
  }

  export function clearAbortableRequest(state, controllerKey, abortController) {
    if (state[controllerKey] === abortController) {
      state[controllerKey] = null;
    }
  }
}
