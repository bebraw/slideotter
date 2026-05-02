import type { StudioClientElements } from "./elements";
import type { StudioClientState } from "./state";

export namespace StudioClientPresentationCreationWorkbench {
  type CreateDomElement = (
    tagName: string,
    options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      dataset?: Record<string, string | number | boolean>;
      disabled?: boolean;
      text?: unknown;
    },
    children?: Array<Node | string | number | boolean>
  ) => HTMLElement;

  type JsonRecord = StudioClientState.JsonRecord;
  type BusyElement = HTMLElement & {
    disabled: boolean;
  };
  type CreationInputElement = StudioClientElements.StudioElement;
  type Stage = "brief" | "content" | "structure";

  type StageAccessContext = {
    approved?: boolean;
    hasOutline?: boolean;
    outlineDirty?: boolean;
  };

  type EditableOutlineSaveOptions = {
    render?: boolean;
    stage?: string;
  };

  type CreatePresentationOptions = {
    approvedOutline?: boolean;
    busyLabel?: string;
    button?: BusyElement | null;
    deckPlan?: unknown;
    openStudio?: boolean;
  };

  type SaveCreationDraftOptions = {
    invalidateOutline?: boolean;
    render?: boolean;
    silent?: boolean;
  };
  type DeckPlanSlide = JsonRecord & {
    intent?: string;
    keyMessage?: string;
    role?: string;
    sourceNeed?: string;
    sourceNotes?: string;
    sourceText?: string;
    title?: string;
    visualNeed?: string;
  };
  type DeckPlan = JsonRecord & {
    narrativeArc?: string;
    outline?: string;
    slides: DeckPlanSlide[];
    thesis?: string;
  };
  type ContentRunSlide = JsonRecord & {
    error?: string;
    errorLogPath?: string;
    slideSpec?: JsonRecord;
    status?: string;
  };
  type ContentRun = JsonRecord & {
    completed?: number;
    failedSlideIndex?: number;
    slideCount?: number;
    slides?: ContentRunSlide[];
    status?: string;
  };
  type ContentRunActionSelectors = {
    accept: string;
    retry: string;
    retryDataset: string;
    stop: string;
  };
  type CreationDraft = StudioClientState.CreationDraft & {
    approvedOutline?: boolean;
    contentRun?: ContentRun | null;
    createdPresentationId?: string;
    deckPlan?: DeckPlan;
    fields?: CreationFields;
    outlineDirty?: boolean;
    outlineLocks?: Record<string, boolean>;
    retrieval?: {
      snippets?: Array<{
        text?: string;
        title?: string;
      }>;
    };
    stage?: string;
  };
  type CreationPayload = {
    creationDraft?: CreationDraft;
    savedThemes?: StudioClientState.SavedTheme[];
  };
  type Request = <TResponse = CreationPayload>(url: string, options?: RequestInit) => Promise<TResponse>;
  type PresentationState = {
    activePresentationId?: string | null;
  };
  type Deps = {
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    escapeHtml: (value: unknown) => string;
    getPresentationState: () => PresentationState;
    isWorkflowRunning: () => boolean;
    readFileAsDataUrl: (file: Blob) => Promise<string | ArrayBuffer | null>;
    renderCreationThemeStage: () => void;
    renderDomSlide: (container: HTMLElement, slideSpec: unknown, options?: Record<string, unknown>) => void;
    renderSavedThemes: () => void;
    resetThemeCandidates: () => void;
    resetPresentationSelection: () => void;
    refreshState: () => Promise<void>;
    request: Request;
    setBusy: (button: BusyElement, label: string) => () => void;
    setCurrentPage: (page: string) => void;
    state: StudioClientState.State;
    windowRef: Window;
  };

  type CreationFields = {
    audience?: string;
    constraints?: string;
    imageSearch?: {
      count?: number;
      provider?: string;
      query?: string;
      restrictions?: string;
    };
    objective?: string;
    presentationSourceText?: string;
    sourcingStyle?: string;
    targetSlideCount?: number | string | null;
    themeBrief?: string;
    title?: string;
    tone?: string;
    visualTheme?: {
      accent?: string;
      bg?: string;
      fontFamily?: string;
      panel?: string;
      primary?: string;
      progressFill?: string;
      progressTrack?: string;
      secondary?: string;
    };
  };

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function asCreationDraft(value: unknown): CreationDraft | null {
    return isRecord(value) ? value : null;
  }

  function currentDraft(state: StudioClientState.State): CreationDraft | null {
    return asCreationDraft(state.creationDraft);
  }

  function asDeckPlan(value: unknown): DeckPlan | null {
    if (!isRecord(value) || !Array.isArray(value.slides)) {
      return null;
    }
    return {
      ...value,
      slides: value.slides.filter(isRecord)
    };
  }

  function asContentRun(value: unknown): ContentRun | null {
    return isRecord(value) ? value : null;
  }

  function isStage(value: unknown): value is Stage {
    return value === "brief" || value === "structure" || value === "content";
  }

  function runSlides(run: ContentRun | null | undefined): ContentRunSlide[] {
    return run && Array.isArray(run.slides) ? run.slides.filter(isRecord) : [];
  }

  export function createPresentationCreationWorkbench(deps: Deps) {
    const {
      createDomElement,
      elements,
      escapeHtml,
      getPresentationState,
      isWorkflowRunning,
      readFileAsDataUrl,
      renderCreationThemeStage,
      renderDomSlide,
      renderSavedThemes,
      resetThemeCandidates,
      resetPresentationSelection,
      refreshState,
      request,
      setBusy,
      setCurrentPage,
      state,
      windowRef
    } = deps;

    let draftSaveTimer: number | null = null;

    function getFields(): CreationFields {
      const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);
      return {
        audience: elements.presentationAudience.value.trim(),
        constraints: elements.presentationConstraints.value.trim(),
        imageSearch: {
          count: 3,
          provider: elements.presentationImageSearchProvider.value,
          query: elements.presentationImageSearchQuery.value.trim(),
          restrictions: elements.presentationImageSearchRestrictions.value.trim()
        },
        objective: elements.presentationObjective.value.trim(),
        presentationSourceText: (elements.presentationSourceText.value || elements.presentationOutlineSourceText.value || "").trim(),
        sourcingStyle: elements.presentationSourcingStyle ? elements.presentationSourcingStyle.value : "grounded",
        targetSlideCount: Number.isFinite(targetSlideCount) ? targetSlideCount : null,
        themeBrief: elements.presentationThemeBrief ? elements.presentationThemeBrief.value.trim() : "",
        title: elements.presentationTitle.value.trim(),
        tone: elements.presentationTone.value.trim(),
        visualTheme: {
          accent: elements.presentationThemeAccent ? elements.presentationThemeAccent.value : "#7c3aed",
          bg: elements.presentationThemeBg ? elements.presentationThemeBg.value : "#fff7ed",
          fontFamily: elements.presentationFontFamily ? elements.presentationFontFamily.value : "Avenir Next",
          panel: elements.presentationThemePanel ? elements.presentationThemePanel.value : "#ffffff",
          primary: elements.presentationThemePrimary ? elements.presentationThemePrimary.value : "#1f2937",
          progressFill: elements.presentationThemeSecondary.value,
          progressTrack: elements.presentationThemeBg.value,
          secondary: elements.presentationThemeSecondary ? elements.presentationThemeSecondary.value : "#f97316"
        }
      };
    }

    function getInputElements(): CreationInputElement[] {
      return [
        elements.presentationTitle,
        elements.presentationAudience,
        elements.presentationTone,
        elements.presentationTargetSlides,
        elements.presentationObjective,
        elements.presentationConstraints,
        elements.presentationSourcingStyle,
        elements.presentationThemeBrief,
        elements.presentationSourceText,
        elements.presentationOutlineSourceText,
        elements.presentationMaterialFile,
        elements.presentationImageSearchQuery,
        elements.presentationImageSearchProvider,
        elements.presentationImageSearchRestrictions,
        elements.presentationSavedTheme,
        elements.presentationFontFamily,
        elements.presentationThemePrimary,
        elements.presentationThemeSecondary,
        elements.presentationThemeAccent,
        elements.presentationThemeBg,
        elements.presentationThemePanel,
        elements.presentationThemeName
      ].filter((element): element is CreationInputElement => Boolean(element));
    }

    function isOutlineRelevantInput(element: CreationInputElement): boolean {
      return [
        elements.presentationTitle,
        elements.presentationAudience,
        elements.presentationTone,
        elements.presentationTargetSlides,
        elements.presentationObjective,
        elements.presentationConstraints,
        elements.presentationSourcingStyle,
        elements.presentationSourceText,
        elements.presentationOutlineSourceText,
        elements.presentationImageSearchQuery,
        elements.presentationImageSearchProvider,
        elements.presentationImageSearchRestrictions
      ].includes(element);
    }

    function normalizeStage(stage: unknown): Stage {
      if (stage === "sources") {
        return "structure";
      }

      return isStage(stage) ? stage : "brief";
    }

    function getStageAccess(stage: unknown, draft: CreationDraft | null, context: StageAccessContext = {}) {
      const hasOutline = context.hasOutline === true;
      const outlineDirty = context.outlineDirty === true;
      const approved = context.approved === true;

      if (stage === "brief") {
        return {
          enabled: true,
          state: hasOutline && !outlineDirty ? "complete" : "active"
        };
      }

      if (stage === "structure") {
        return {
          enabled: hasOutline,
          state: !hasOutline ? "locked" : approved && !outlineDirty ? "complete" : "active"
        };
      }

      if (stage === "content") {
        return {
          enabled: approved && hasOutline && !outlineDirty,
          state: approved && hasOutline && !outlineDirty ? "available" : "locked"
        };
      }

      return {
        enabled: false,
        state: "locked"
      };
    }

    function setStage(stage: unknown): void {
      state.ui.creationStage = normalizeStage(stage);
      renderDraft();
    }

    function cloneDeckPlan(deckPlan: unknown): DeckPlan | null {
      const plan = asDeckPlan(deckPlan);
      if (!plan) {
        return null;
      }

      return {
        ...plan,
        slides: plan.slides.map((slide: DeckPlanSlide) => ({ ...slide }))
      };
    }

    function buildEditableDeckPlanOutline(slides: DeckPlanSlide[]): string {
      return slides
        .map((slide: DeckPlanSlide, index: number) => {
          const title = slide.title || `Slide ${index + 1}`;
          const message = slide.keyMessage || slide.intent || "";
          return `${index + 1}. ${title}${message ? ` - ${message}` : ""}`;
        })
        .join("\n");
    }

    function getOutlineLocks(): Record<string, boolean> {
      const draft = currentDraft(state);
      const locks = draft && isRecord(draft.outlineLocks)
        ? draft.outlineLocks
        : {};
      return Object.fromEntries(Object.entries(locks).filter(([key, value]) => /^\d+$/.test(key) && value === true));
    }

    function setOutlineSlideLocked(index: number, locked: boolean): Record<string, boolean> {
      const locks = getOutlineLocks();
      if (locked) {
        locks[String(index)] = true;
      } else {
        delete locks[String(index)];
      }

      state.creationDraft = {
        ...(state.creationDraft || {}),
        outlineLocks: locks
      };
      return locks;
    }

    function countUnlockedOutlineSlides(deckPlan: DeckPlan | null = null): number {
      const draft = currentDraft(state);
      const plan = deckPlan || draft?.deckPlan || null;
      const slides = plan?.slides || [];
      const locks = getOutlineLocks();
      return slides.filter((_slide: DeckPlanSlide, index: number) => locks[String(index)] !== true).length;
    }

    function readOutlineEditorValue(selector: string, fallback = ""): string {
      const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
      const value = element && typeof element.value === "string" ? element.value.trim() : "";
      return value || fallback || "";
    }

    function getEditableDeckPlan(): DeckPlan | null {
      const draft = currentDraft(state);
      const currentPlan = draft?.deckPlan;
      const deckPlan = cloneDeckPlan(currentPlan);
      if (!deckPlan || !deckPlan.slides.length) {
        return currentPlan || null;
      }

      deckPlan.thesis = readOutlineEditorValue("[data-outline-field=\"thesis\"]", deckPlan.thesis);
      deckPlan.narrativeArc = readOutlineEditorValue("[data-outline-field=\"narrativeArc\"]", deckPlan.narrativeArc);
      deckPlan.slides = deckPlan.slides.map((slide: DeckPlanSlide, index: number) => {
        const title = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="title"]`, slide.title || `Slide ${index + 1}`);
        const intent = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="intent"]`, slide.intent || title);
        const keyMessage = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="keyMessage"]`, slide.keyMessage || intent);
        const sourceNeed = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="sourceNeed"]`, slide.sourceNeed || "Use supplied context when relevant.");
        const sourceNotes = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="sourceNotes"]`, slide.sourceNotes || slide.sourceText || "");
        const visualNeed = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="visualNeed"]`, slide.visualNeed || "Use fitting supplied imagery when relevant.");

        return {
          ...slide,
          intent,
          keyMessage,
          sourceNeed,
          sourceNotes,
          title,
          visualNeed
        };
      });
      deckPlan.outline = buildEditableDeckPlanOutline(deckPlan.slides);
      return deckPlan;
    }

    function formatSourceOutlineText(slide: DeckPlanSlide | null): string {
      const sourceNotes = slide && (slide.sourceNotes || slide.sourceText);
      if (sourceNotes) {
        return sourceNotes;
      }

      return slide && slide.sourceNeed || "No source guidance yet.";
    }

    function renderQuickSourceOutline(deckPlan: DeckPlan | null = null): void {
      const draft = currentDraft(state);
      const plan = deckPlan || draft?.deckPlan || null;
      const slides = plan?.slides || [];
      if (!elements.presentationSourceOutline) {
        return;
      }

      if (!slides.length) {
        elements.presentationSourceOutline.replaceChildren(
          createDomElement("strong", { text: "Quick source outline" }),
          createDomElement("p", { text: "No outline source guidance yet." })
        );
        return;
      }

      elements.presentationSourceOutline.replaceChildren(
        createDomElement("strong", { text: "Quick source outline" }),
        createDomElement("div", { className: "creation-source-outline-list" }, slides.map((slide: DeckPlanSlide, index: number) => createDomElement("article", {
          className: "creation-source-outline-item"
        }, [
          createDomElement("span", { text: index + 1 }),
          createDomElement("div", {}, [
            createDomElement("b", { text: slide.title || `Slide ${index + 1}` }),
            createDomElement("small", { text: formatSourceOutlineText(slide) })
          ])
        ])))
      );
    }

    function markOutlineEditedLocally(): void {
      const deckPlan = getEditableDeckPlan();
      if (!deckPlan || !state.creationDraft) {
        return;
      }

      state.creationDraft = {
        ...state.creationDraft,
        approvedOutline: false,
        deckPlan,
        outlineDirty: false
      };
      elements.createPresentationButton.disabled = true;
      elements.presentationCreationStatus.textContent = "Outline changed. Approve the outline before creating slides.";
      renderQuickSourceOutline(deckPlan);
    }

    async function saveEditableOutlineDraft(options: EditableOutlineSaveOptions = {}) {
      const deckPlan = getEditableDeckPlan();
      if (!deckPlan || !state.creationDraft || isWorkflowRunning()) {
        return null;
      }

      state.creationDraft = {
        ...state.creationDraft,
        approvedOutline: false,
        deckPlan,
        outlineDirty: false
      };

      const payload = await request("/api/presentations/draft", {
        body: JSON.stringify({
          approvedOutline: false,
          deckPlan,
          fields: getFields(),
          outlineLocks: getOutlineLocks(),
          outlineDirty: false,
          retrieval: state.creationDraft.retrieval,
          stage: options.stage || state.ui.creationStage || "structure"
        }),
        method: "POST"
      });
      state.creationDraft = payload.creationDraft || state.creationDraft;
      state.savedThemes = payload.savedThemes || state.savedThemes;
      renderSavedThemes();
      if (options.render !== false) {
        renderDraft();
      }
      return payload;
    }

    function validateCreationInputs() {
      const title = elements.presentationTitle.value.trim();
      const targetSlideCount = Number.parseInt(elements.presentationTargetSlides.value, 10);
      if (!title) {
        elements.presentationTitle.focus();
        return null;
      }
      if (elements.presentationTargetSlides.value && (!Number.isFinite(targetSlideCount) || targetSlideCount < 1)) {
        elements.presentationTargetSlides.focus();
        return null;
      }

      return {
        targetSlideCount,
        title
      };
    }

    function disableInputs() {
      getInputElements().forEach((element) => {
        element.disabled = true;
      });
    }

    async function createPresentationFromForm(options: CreatePresentationOptions = {}) {
      const inputState = validateCreationInputs();
      if (!inputState) {
        return;
      }

      const busyButton = Object.prototype.hasOwnProperty.call(options, "button")
        ? options.button
        : elements.createPresentationButton;
      const done = busyButton ? setBusy(busyButton, options.busyLabel || "Creating...") : null;
      disableInputs();
      try {
        const deckPlan = options.deckPlan || getEditableDeckPlan();
        const creationFields = getFields();
        const starterMaterialFile = elements.presentationMaterialFile.files && elements.presentationMaterialFile.files[0];
        const presentationMaterials = starterMaterialFile
          ? [{
              alt: starterMaterialFile.name,
              dataUrl: await readFileAsDataUrl(starterMaterialFile),
              fileName: starterMaterialFile.name,
              title: starterMaterialFile.name
            }]
          : [];
        const payload = await request<CreationPayload>("/api/presentations/draft/create", {
          body: JSON.stringify({
            approvedOutline: options.approvedOutline === true || state.creationDraft && state.creationDraft.approvedOutline === true,
            deckPlan: deckPlan || state.creationDraft && state.creationDraft.deckPlan,
            fields: creationFields,
            presentationMaterials,
            targetSlideCount: Number.isFinite(inputState.targetSlideCount) ? inputState.targetSlideCount : null
          }),
          method: "POST"
        });
        if (payload && payload.creationDraft) {
          state.creationDraft = payload.creationDraft;
          state.ui.creationStage = normalizeStage(payload.creationDraft.stage || state.ui.creationStage);
          state.ui.creationContentSlideIndex = 1;
          state.ui.creationContentSlidePinned = false;
        }
        if (options.openStudio !== false) {
          resetPresentationSelection();
          await refreshState();
          setCurrentPage("studio");
          elements.operationStatus.textContent = "Generating slides from the approved outline. Completed slides replace placeholders as they validate.";
        } else {
          setCurrentPage("presentations");
          renderDraft();
        }
      } finally {
        if (done) {
          done();
        }
        renderDraft();
      }
    }

    async function saveCreationDraft(stage = state.ui.creationStage, options: SaveCreationDraftOptions = {}): Promise<void> {
      const editableDeckPlan = getEditableDeckPlan();
      const shouldDirtyOutline = options.invalidateOutline
        && state.creationDraft
        && state.creationDraft.deckPlan;
      if (shouldDirtyOutline) {
        state.creationDraft = {
          ...state.creationDraft,
          approvedOutline: false,
          outlineDirty: true
        };
        renderDraft();
      }

      const payload = await request<CreationPayload>("/api/presentations/draft", {
        body: JSON.stringify({
          approvedOutline: shouldDirtyOutline ? false : undefined,
          deckPlan: editableDeckPlan || undefined,
          fields: getFields(),
          outlineLocks: getOutlineLocks(),
          outlineDirty: shouldDirtyOutline ? true : undefined,
          stage
        }),
        method: "POST"
      });
      state.creationDraft = payload.creationDraft || state.creationDraft;
      state.savedThemes = payload.savedThemes || state.savedThemes;
      renderSavedThemes();
      renderDraft();
    }

    async function generatePresentationOutline() {
      const inputState = validateCreationInputs();
      if (!inputState) {
        return;
      }

      const done = setBusy(elements.generatePresentationOutlineButton, "Generating...");
      disableInputs();
      try {
        const deckPlan = getEditableDeckPlan();
        const payload = await request<CreationPayload>("/api/presentations/draft/outline", {
          body: JSON.stringify({
            deckPlan: deckPlan || undefined,
            fields: getFields(),
            outlineLocks: getOutlineLocks()
          }),
          method: "POST"
        });
        state.creationDraft = payload.creationDraft || state.creationDraft;
        setStage("structure");
      } finally {
        done();
        renderDraft();
      }
    }

    async function regeneratePresentationOutlineSlide(slideIndex: number): Promise<void> {
      const deckPlan = getEditableDeckPlan();
      if (!deckPlan || !Array.isArray(deckPlan.slides) || !deckPlan.slides[slideIndex]) {
        return;
      }

      const button = document.querySelector<HTMLButtonElement>(`[data-outline-regenerate-slide-index="${slideIndex}"]`);
      const done = button ? setBusy(button, "Regenerating...") : null;
      disableInputs();
      try {
        const payload = await request<CreationPayload>("/api/presentations/draft/outline/slide", {
          body: JSON.stringify({
            deckPlan,
            fields: getFields(),
            outlineLocks: getOutlineLocks(),
            slideIndex
          }),
          method: "POST"
        });
        state.creationDraft = payload.creationDraft || state.creationDraft;
        setStage("structure");
      } finally {
        if (done) {
          done();
        }
        renderDraft();
      }
    }

    async function approvePresentationOutline() {
      const deckPlan = getEditableDeckPlan();
      const approvedDeckPlan = deckPlan || state.creationDraft && state.creationDraft.deckPlan;
      if (!approvedDeckPlan) {
        return;
      }

      const done = setBusy(elements.approvePresentationOutlineButton, "Creating slides...");
      disableInputs();
      elements.regeneratePresentationOutlineButton.disabled = true;
      elements.regeneratePresentationOutlineWithSourcesButton.disabled = true;
      try {
        const payload = await request<CreationPayload>("/api/presentations/draft/approve", {
          body: JSON.stringify({
            deckPlan: approvedDeckPlan,
            outlineLocks: getOutlineLocks()
          }),
          method: "POST"
        });
        state.creationDraft = payload.creationDraft || state.creationDraft;
        elements.presentationCreationStatus.textContent = "Outline approved. Creating slides from the locked outline...";
        await createPresentationFromForm({
          approvedOutline: true,
          busyLabel: "Creating slides...",
          button: null,
          deckPlan: approvedDeckPlan,
          openStudio: true
        });
      } finally {
        done();
        renderDraft();
      }
    }

    async function backToPresentationOutline() {
      const deckPlan = getEditableDeckPlan();
      const payload = await request("/api/presentations/draft", {
        body: JSON.stringify({
          approvedOutline: false,
          deckPlan: deckPlan || state.creationDraft && state.creationDraft.deckPlan,
          fields: getFields(),
          outlineLocks: getOutlineLocks(),
          retrieval: state.creationDraft && state.creationDraft.retrieval,
          stage: "structure"
        }),
        method: "POST"
      });
      state.creationDraft = {
        ...(payload.creationDraft || state.creationDraft),
        approvedOutline: false
      };
      setStage("structure");
    }

    function clearPresentationForm() {
      elements.presentationTitle.value = "";
      elements.presentationAudience.value = "";
      elements.presentationTone.value = "";
      elements.presentationTargetSlides.value = "";
      elements.presentationObjective.value = "";
      elements.presentationConstraints.value = "";
      elements.presentationSourcingStyle.value = "";
      elements.presentationThemeBrief.value = "";
      elements.presentationSourceText.value = "";
      elements.presentationOutlineSourceText.value = "";
      elements.presentationMaterialFile.value = "";
      elements.presentationImageSearchQuery.value = "";
      elements.presentationImageSearchProvider.value = "openverse";
      elements.presentationImageSearchRestrictions.value = "";
      elements.presentationFontFamily.value = "avenir";
      elements.presentationThemePrimary.value = "#183153";
      elements.presentationThemeSecondary.value = "#275d8c";
      elements.presentationThemeAccent.value = "#f28f3b";
      elements.presentationThemeBg.value = "#f5f8fc";
      elements.presentationThemePanel.value = "#f8fbfe";
      elements.presentationThemeName.value = "";
      elements.presentationSavedTheme.value = "";
      state.creationDraft = null;
      setStage("brief");
    }

    function openCreatedPresentation() {
      clearPresentationForm();
      setCurrentPage("studio");
    }

    function renderCreationOutline(draft: CreationDraft | null): void {
      const deckPlan = draft?.deckPlan || null;
      const slides = deckPlan?.slides || [];
      const workflowRunning = isWorkflowRunning();
      const outlineLocks = draft && isRecord(draft.outlineLocks) ? draft.outlineLocks : {};
      elements.presentationOutlineTitle.value = deckPlan && deckPlan.thesis ? deckPlan.thesis : "";
      elements.presentationOutlineTitle.dataset.outlineField = "thesis";
      elements.presentationOutlineTitle.disabled = workflowRunning || !slides.length;
      elements.presentationOutlineSummary.value = deckPlan && deckPlan.narrativeArc ? deckPlan.narrativeArc : "";
      elements.presentationOutlineSummary.dataset.outlineField = "narrativeArc";
      elements.presentationOutlineSummary.disabled = workflowRunning || !slides.length;
      if (!slides.length) {
        elements.presentationOutlineList.replaceChildren(createDomElement("div", { className: "presentation-empty" }, [
          createDomElement("strong", { text: "No outline generated" }),
          createDomElement("span", { text: "Use the brief stage to generate a draft outline." })
        ]));
      } else {
        elements.presentationOutlineList.replaceChildren(...slides.map((slide: DeckPlanSlide, index: number) => {
          const locked = outlineLocks[String(index)] === true;
          const lockLabel = locked ? "Unlock slide" : "Lock slide";
          const textField = (
            tagName: "input" | "textarea",
            label: string,
            field: string,
            value: string,
            extraAttributes: Record<string, string | number | boolean> = {}
          ): HTMLElement => {
            const fieldOptions: Parameters<CreateDomElement>[1] = {
              attributes: {
                ...extraAttributes,
                ...(tagName === "input" ? { type: "text", value } : {})
              },
              dataset: {
                outlineSlideField: field,
                outlineSlideIndex: index
              },
              disabled: workflowRunning
            };
            if (tagName === "textarea") {
              fieldOptions.text = value;
            }
            return createDomElement("label", {
              className: field === "title" ? "field creation-outline-title-field" : "field"
            }, [
              createDomElement("span", { text: label }),
              createDomElement(tagName, fieldOptions)
            ]);
          };

          return createDomElement("article", {
            className: `creation-outline-item${locked ? " creation-outline-item-locked" : ""}`
          }, [
            createDomElement("div", { className: "creation-outline-item-rail" }, [
              createDomElement("span", { text: index + 1 }),
              createDomElement("button", {
                attributes: {
                  "aria-label": lockLabel,
                  "aria-pressed": locked ? "true" : "false",
                  title: lockLabel,
                  type: "button"
                },
                className: "outline-lock-button",
                dataset: { outlineLockSlideIndex: index },
                disabled: workflowRunning
              }, [
                createDomElement("span", {
                  attributes: { "aria-hidden": "true" },
                  className: "outline-lock-icon"
                })
              ])
            ]),
            createDomElement("div", { className: "creation-outline-slide-fields" }, [
              createDomElement("div", { className: "creation-outline-slide-toolbar" }, [
                createDomElement("strong", { text: slide.title || `Slide ${index + 1}` }),
                createDomElement("button", {
                  attributes: { type: "button" },
                  className: "secondary compact-button outline-regenerate-button",
                  dataset: { outlineRegenerateSlideIndex: index },
                  disabled: workflowRunning,
                  text: "Regenerate slide"
                })
              ]),
              textField("input", "Slide title", "title", slide.title || `Slide ${index + 1}`),
              textField("textarea", "Intent", "intent", slide.intent || ""),
              textField("textarea", "Key message", "keyMessage", slide.keyMessage || slide.intent || ""),
              textField("textarea", "Source need", "sourceNeed", slide.sourceNeed || "No specific source need."),
              textField("textarea", "Source notes", "sourceNotes", slide.sourceNotes || slide.sourceText || "", {
                placeholder: "Paste excerpts, URLs, or reference notes for this outline beat."
              }),
              textField("textarea", "Visual need", "visualNeed", slide.visualNeed || "Use fitting supplied imagery when relevant.")
            ])
          ]);
        }));
      }

      const snippets = draft && draft.retrieval && Array.isArray(draft.retrieval.snippets) ? draft.retrieval.snippets : [];
      elements.presentationSourceEvidence.replaceChildren(snippets.length
        ? createDomElement("details", { className: "creation-source-snippets" }, [
          createDomElement("summary", { text: `${snippets.length} source snippet${snippets.length === 1 ? "" : "s"} used` }),
          ...snippets.slice(0, 3).map((snippet: { text?: string; title?: string }, index: number) => createDomElement("article", {
            className: "creation-source-item"
          }, [
            createDomElement("strong", { text: `${index + 1}. ${snippet.title || "Source"}` }),
            createDomElement("p", { text: snippet.text || "" })
          ]))
        ])
        : createDomElement("p", { className: "creation-source-note", text: "No source snippets used." }));
      renderQuickSourceOutline(deckPlan);
    }

    function applyFields(fields: CreationFields = {}) {
      elements.presentationTitle.value = fields.title || "";
      elements.presentationAudience.value = fields.audience || "";
      elements.presentationTone.value = fields.tone || "";
      elements.presentationTargetSlides.value = fields.targetSlideCount ? String(fields.targetSlideCount) : "";
      elements.presentationObjective.value = fields.objective || "";
      elements.presentationConstraints.value = fields.constraints || "";
      if (elements.presentationSourcingStyle) {
        elements.presentationSourcingStyle.value = fields.sourcingStyle || "";
      }
      if (elements.presentationThemeBrief) {
        elements.presentationThemeBrief.value = fields.themeBrief || "";
      }
      if (elements.presentationSourceText) {
        elements.presentationSourceText.value = fields.presentationSourceText || "";
      }
      if (elements.presentationOutlineSourceText) {
        elements.presentationOutlineSourceText.value = fields.presentationSourceText || "";
      }
      if (elements.presentationImageSearchQuery) {
        elements.presentationImageSearchQuery.value = fields.imageSearch && fields.imageSearch.query || "";
      }
      if (elements.presentationImageSearchProvider) {
        elements.presentationImageSearchProvider.value = fields.imageSearch && fields.imageSearch.provider || "openverse";
      }
      if (elements.presentationImageSearchRestrictions) {
        elements.presentationImageSearchRestrictions.value = fields.imageSearch && fields.imageSearch.restrictions || "";
      }

      const theme = fields.visualTheme || {};
      if (elements.presentationFontFamily) {
        elements.presentationFontFamily.value = theme.fontFamily || "avenir";
      }
      if (elements.presentationThemePrimary) {
        elements.presentationThemePrimary.value = theme.primary || "#183153";
      }
      if (elements.presentationThemeSecondary) {
        elements.presentationThemeSecondary.value = theme.secondary || "#275d8c";
      }
      if (elements.presentationThemeAccent) {
        elements.presentationThemeAccent.value = theme.accent || "#f28f3b";
      }
      if (elements.presentationThemeBg) {
        elements.presentationThemeBg.value = theme.bg || "#f5f8fc";
      }
      if (elements.presentationThemePanel) {
        elements.presentationThemePanel.value = theme.panel || "#f8fbfe";
      }
    }

    function syncSourceFields(element: CreationInputElement): void {
      if (element === elements.presentationOutlineSourceText) {
        elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
      }
      if (element === elements.presentationSourceText) {
        elements.presentationOutlineSourceText.value = elements.presentationSourceText.value;
      }
    }

    function isThemeElement(element: CreationInputElement): boolean {
      return [
        elements.presentationFontFamily,
        elements.presentationThemePrimary,
        elements.presentationThemeSecondary,
        elements.presentationThemeAccent,
        elements.presentationThemeBg,
        elements.presentationThemePanel
      ].includes(element);
    }

    function getAutoContentRunSlideIndex(run: ContentRun | null | undefined): number {
      const slides = runSlides(run);
      const generatingIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "generating");
      if (generatingIndex >= 0) {
        return generatingIndex + 1;
      }

      for (let index = slides.length - 1; index >= 0; index -= 1) {
        if (slides[index] && slides[index]?.status === "complete") {
          return index + 1;
        }
      }

      const failedIndex = slides.findIndex((slide: ContentRunSlide) => slide.status === "failed");
      return failedIndex >= 0 ? failedIndex + 1 : 1;
    }

    function getContentRunStatusLabel(status: string | undefined): string {
      switch (status) {
        case "running":
          return "Generating";
        case "failed":
          return "Failed";
        case "stopped":
          return "Stopped";
        case "completed":
          return "Complete";
        default:
          return "Ready";
      }
    }

    function truncateStatusText(value: unknown, maxLength = 140): string {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      if (text.length <= maxLength) {
        return text;
      }

      return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
    }

    function getContentRunFailureDetail(runSlides: ContentRunSlide[]): string {
      const failedIndex = runSlides.findIndex((slide: ContentRunSlide) => slide.status === "failed");
      if (failedIndex < 0) {
        return "";
      }

      const failedSlide = runSlides[failedIndex] || {};
      const error = truncateStatusText(failedSlide.error || "Slide generation failed.");
      return ` Slide ${failedIndex + 1} failed: ${error}`;
    }

    function formatContentRunSummary(run: ContentRun | null, slideCount: number, runSlides: ContentRunSlide[]): string {
      const completedCount = run && Number.isFinite(Number(run.completed))
        ? Number(run.completed)
        : runSlides.filter((slide: ContentRunSlide) => slide.status === "complete").length;
      const runStatus = run && run.status ? run.status : "ready";
      const failedCount = runSlides.filter((slide: ContentRunSlide) => slide.status === "failed").length;
      const generatingIndex = runSlides.findIndex((slide: ContentRunSlide) => slide.status === "generating");
      const activePart = generatingIndex >= 0 ? ` Slide ${generatingIndex + 1} is generating.` : "";
      const failurePart = failedCount ? ` ${failedCount} failed.${getContentRunFailureDetail(runSlides)}` : "";

      return `${completedCount}/${slideCount} slides complete. ${getContentRunStatusLabel(runStatus)}.${activePart}${failurePart}`;
    }

    function getLiveStudioContentRun(): ContentRun | null {
      const draft = currentDraft(state);
      const run = asContentRun(draft?.contentRun);
      if (!run || !draft?.createdPresentationId) {
        return null;
      }

      const presentationState = getPresentationState();
      return draft.createdPresentationId === presentationState.activePresentationId ? run : null;
    }

    function renderContentRunNavStatus() {
      if (!elements.contentRunNavStatus) {
        return;
      }

      const draft = state.creationDraft || {};
      const deckPlan = draft.deckPlan;
      const run = draft.contentRun;
      const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
      const slideCount = run && Number.isFinite(Number(run.slideCount))
        ? Number(run.slideCount)
        : deckPlan && Array.isArray(deckPlan.slides)
          ? deckPlan.slides.length
          : 0;

      const shouldShow = run
        && slideCount
        && ["running", "failed", "stopped"].includes(run.status || "");
      if (!shouldShow) {
        elements.contentRunNavStatus.hidden = true;
        elements.contentRunNavStatus.textContent = "";
        elements.contentRunNavStatus.dataset.state = "idle";
        return;
      }

      elements.contentRunNavStatus.hidden = false;
      const summary = formatContentRunSummary(run, slideCount, runSlides);
      elements.contentRunNavStatus.textContent = summary;
      elements.contentRunNavStatus.title = summary;
      elements.contentRunNavStatus.dataset.state = run.status || "idle";
    }

    function getContentRunActionState() {
      const draft = state.creationDraft || {};
      const deckPlan = draft.deckPlan;
      const run = draft.contentRun && typeof draft.contentRun === "object" ? draft.contentRun : null;
      const planSlides = deckPlan && Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
      const runSlides = run && Array.isArray(run.slides) ? run.slides : [];
      if (!run || !planSlides.length) {
        return null;
      }

      const slideCount = Number.isFinite(Number(run.slideCount)) ? Number(run.slideCount) : planSlides.length;
      const failedIndex = runSlides.findIndex((slide) => slide && slide.status === "failed");
      const completedCount = Number.isFinite(Number(run.completed))
        ? Number(run.completed)
        : runSlides.filter((slide) => slide && slide.status === "complete").length;
      const incompleteCount = runSlides.filter((slide) => slide && slide.status !== "complete").length;

      return {
        completedCount,
        failedIndex,
        incompleteCount,
        run,
        runSlides,
        slideCount
      };
    }

    function renderStudioContentRunPanel() {
      if (!elements.studioContentRunPanel) {
        return;
      }

      const actionState = getContentRunActionState();
      const activeRun = getLiveStudioContentRun();
      if (!actionState || !activeRun || !["running", "failed", "stopped"].includes(actionState.run.status || "")) {
        elements.studioContentRunPanel.hidden = true;
        elements.studioContentRunPanel.replaceChildren();
        return;
      }

      const { completedCount, failedIndex, incompleteCount, run, runSlides, slideCount } = actionState;
      const summary = formatContentRunSummary(run, slideCount, runSlides);
      const canRetry = run.status === "failed" && failedIndex >= 0 && !isWorkflowRunning();
      const canAcceptPartial = run.status !== "running" && completedCount > 0 && incompleteCount > 0;

      elements.studioContentRunPanel.hidden = false;
      elements.studioContentRunPanel.dataset.state = run.status || "idle";
      const actionButtons: HTMLElement[] = [];
      if (run.status === "running") {
        actionButtons.push(createDomElement("button", {
          attributes: { type: "button" },
          className: "secondary compact-button",
          dataset: { studioContentRunStop: "" },
          text: "Stop"
        }));
      }
      if (canRetry) {
        actionButtons.push(createDomElement("button", {
          attributes: { type: "button" },
          className: "secondary compact-button",
          dataset: { studioContentRunRetry: failedIndex + 1 },
          text: `Retry slide ${failedIndex + 1}`
        }));
      }
      if (canAcceptPartial) {
        actionButtons.push(createDomElement("button", {
          attributes: { type: "button" },
          className: "secondary compact-button",
          dataset: { studioContentRunAcceptPartial: "" },
          text: "Accept completed"
        }));
      }
      elements.studioContentRunPanel.replaceChildren(
        createDomElement("div", {}, [
          createDomElement("p", { className: "eyebrow", text: "Live generation" }),
          createDomElement("strong", { text: summary })
        ]),
        createDomElement("div", { className: "button-row compact" }, actionButtons)
      );
    }

    function renderContentRun(draft: CreationDraft | null): void {
      if (!elements.contentRunPreview || !elements.contentRunPreviewTitle || !elements.contentRunPreviewEyebrow || !elements.contentRunPreviewActions || !elements.contentRunSummary) {
        return;
      }

      const deckPlan = draft?.deckPlan || null;
      const planSlides = deckPlan?.slides || [];
      const run = asContentRun(draft?.contentRun);
      const runSlideList = runSlides(run);
      const slideCount = planSlides.length;

      if (!slideCount) {
        elements.contentRunPreviewActions.replaceChildren();
        elements.contentRunSummary.textContent = "No slides generated yet.";
        elements.contentRunPreviewEyebrow.textContent = "Preview";
        elements.contentRunPreviewTitle.textContent = "No outline yet";
        elements.contentRunPreview.replaceChildren(createDomElement("div", { className: "creation-content-placeholder" }, [
          createDomElement("h4", { text: "Generate an outline first" }),
          createDomElement("p", { text: "Draft slides are available after the outline is approved." })
        ]));
        return;
      }

      const selected = Number.isFinite(Number(state.ui.creationContentSlideIndex))
        ? Math.max(1, Math.min(slideCount, Number(state.ui.creationContentSlideIndex)))
        : 1;
      state.ui.creationContentSlideIndex = selected;

      const statusLabel = (status: string | undefined): string => {
        switch (status) {
          case "generating":
            return "Generating";
          case "complete":
            return "Complete";
          case "failed":
            return "Failed";
          default:
            return "Pending";
        }
      };

      elements.contentRunSummary.textContent = formatContentRunSummary(run, slideCount, runSlideList);

      const index = selected - 1;
      const planSlide = planSlides[index] || {};
      const runSlide = runSlideList[index] || null;
      const status = runSlide && runSlide.status ? runSlide.status : "pending";
      const completedCount = run && Number.isFinite(Number(run.completed))
        ? Number(run.completed)
        : runSlideList.filter((slide: ContentRunSlide) => slide.status === "complete").length;
      const incompleteCount = runSlideList.filter((slide: ContentRunSlide) => slide.status !== "complete").length;

      elements.contentRunPreviewActions.replaceChildren();
      elements.contentRunPreviewEyebrow.textContent = statusLabel(status);
      elements.contentRunPreviewTitle.textContent = `${selected}. ${planSlide.title || `Slide ${selected}`}`;

      if (run && run.status === "running") {
        elements.contentRunPreviewActions.appendChild(createDomElement("button", {
          attributes: { type: "button" },
          className: "secondary compact-button",
          dataset: { contentRunStop: "" },
          text: "Stop generation"
        }));
      }
      if (run && run.status !== "running" && completedCount > 0 && incompleteCount > 0) {
        elements.contentRunPreviewActions.appendChild(createDomElement("button", {
          attributes: { type: "button" },
          className: "secondary compact-button",
          dataset: { contentRunAcceptPartial: "" },
          text: "Accept completed"
        }));
      }

      if (status === "complete" && runSlide && runSlide.slideSpec) {
        elements.contentRunPreview.replaceChildren();
        renderDomSlide(elements.contentRunPreview, runSlide.slideSpec, {
          index: selected,
          totalSlides: slideCount
        });
        return;
      }

      if (status === "failed") {
        const retryDisabled = isWorkflowRunning();
        elements.contentRunPreviewActions.appendChild(createDomElement("button", {
          attributes: { type: "button" },
          className: "secondary compact-button",
          dataset: { contentRunRetrySlide: selected },
          disabled: retryDisabled,
          text: "Retry slide"
        }));
      }

      const describe = (label: string, value: unknown, fallback: string): HTMLElement => {
        const body = String(value || "").trim() || fallback;
        return createDomElement("div", {}, [
          createDomElement("dt", { text: label }),
          createDomElement("dd", { text: body })
        ]);
      };

      const placeholderChildren: HTMLElement[] = [
        createDomElement("h4", { text: planSlide.title || `Slide ${selected}` })
      ];
      if (status === "failed") {
        placeholderChildren.push(createDomElement("p", {
          text: String(runSlide && runSlide.error ? runSlide.error : "Slide generation failed.")
        }));
      }
      if (status === "failed" && runSlide && runSlide.errorLogPath) {
        placeholderChildren.push(createDomElement("p", {}, [
          "Full error log: ",
          createDomElement("code", { text: runSlide.errorLogPath })
        ]));
      }
      if (status === "generating") {
        placeholderChildren.push(createDomElement("p", { text: "Drafting this slide now..." }));
      } else if (status === "pending") {
        placeholderChildren.push(createDomElement("p", { text: "Waiting for generation." }));
      }
      placeholderChildren.push(createDomElement("dl", {}, [
        describe("Intent", planSlide.intent, "No intent provided."),
        describe("Key message", planSlide.keyMessage || planSlide.intent, "No key message provided."),
        describe("Source need", planSlide.sourceNeed, "No specific source need."),
        describe("Visual need", planSlide.visualNeed, "No specific visual need.")
      ]));

      elements.contentRunPreview.replaceChildren(createDomElement("div", {
        className: "creation-content-placeholder"
      }, placeholderChildren));
    }

    function renderDraft(): void {
      const draft: CreationDraft = currentDraft(state) || {};
      const hasOutline = Boolean(draft.deckPlan && Array.isArray(draft.deckPlan.slides) && draft.deckPlan.slides.length);
      const approved = draft.approvedOutline === true;
      const outlineDirty = draft.outlineDirty === true;
      const workflowRunning = isWorkflowRunning();
      const unlockedOutlineCount = hasOutline ? countUnlockedOutlineSlides(asDeckPlan(draft.deckPlan)) : 0;
      const stageContext = { approved, hasOutline, outlineDirty };
      let stage = normalizeStage(state.ui.creationStage || draft.stage || "brief");
      if (!getStageAccess(stage, draft, stageContext).enabled) {
        stage = hasOutline ? "structure" : "brief";
      }
      state.ui.creationStage = stage;

      const stagePanels: Array<[Stage, HTMLElement]> = [
        ["brief", elements.creationStageBrief],
        ["structure", elements.creationStageStructure],
        ["content", elements.creationStageContent],
      ];
      stagePanels.forEach(([name, element]) => {
        element.hidden = name !== stage;
      });

      document.querySelectorAll<HTMLButtonElement>("[data-creation-stage]").forEach((button) => {
        const active = button.dataset.creationStage === stage;
        const access = getStageAccess(button.dataset.creationStage, draft, stageContext);
        button.classList.toggle("active", active);
        button.dataset.state = active ? "active" : access.state;
        button.setAttribute("aria-current", active ? "step" : "false");
        button.disabled = workflowRunning || !access.enabled;
      });

      getInputElements().forEach((element) => {
        element.disabled = workflowRunning;
      });

      elements.generatePresentationOutlineButton.disabled = workflowRunning || !elements.presentationTitle.value.trim();
      elements.approvePresentationOutlineButton.disabled = workflowRunning || !hasOutline || outlineDirty;
      elements.regeneratePresentationOutlineButton.disabled = workflowRunning || !elements.presentationTitle.value.trim() || (hasOutline && unlockedOutlineCount === 0);
      elements.regeneratePresentationOutlineWithSourcesButton.disabled = workflowRunning || !elements.presentationTitle.value.trim() || (hasOutline && unlockedOutlineCount === 0);
      elements.backToPresentationOutlineButton.disabled = workflowRunning;
      elements.createPresentationButton.disabled = workflowRunning || !approved || !hasOutline || outlineDirty;
      if (elements.savePresentationThemeButton) {
        elements.savePresentationThemeButton.disabled = workflowRunning;
      }
      renderContentRunNavStatus();
      const contentRun = asContentRun(draft.contentRun);
      const failedSlideNumber = contentRun && Number.isFinite(Number(contentRun.failedSlideIndex))
        ? Number(contentRun.failedSlideIndex) + 1
        : null;
      const failedSlide = failedSlideNumber
        ? runSlides(contentRun)[failedSlideNumber - 1]
        : null;
      const failedError = failedSlide && failedSlide.error
        ? truncateStatusText(failedSlide.error, 180)
        : "Slide generation failed.";
      elements.presentationCreationStatus.textContent = workflowRunning
        ? "Generation is running from a locked snapshot. Wait for it to finish before changing the draft."
        : contentRun && contentRun.status === "failed"
          ? `Slide generation failed${failedSlideNumber ? ` on slide ${failedSlideNumber}` : ""}. ${failedError} Retry from the failed slide in Studio or inspect the saved error log.`
          : contentRun && contentRun.status === "stopped"
            ? "Slide generation stopped. Completed slides remain available in Slide Studio."
        : outlineDirty
          ? "Brief changed. Regenerate the outline before approving it."
          : hasOutline && unlockedOutlineCount === 0
            ? "All outline slides are kept. Unlock a slide before regenerating the outline."
          : approved
        ? "Outline approved. Slide Studio will show generated slides as they validate."
        : hasOutline
          ? "Review the outline, then approve it to create slides."
          : "Draft is saved locally as ignored runtime state.";
      renderCreationOutline(draft);
      renderContentRun(draft);
      renderCreationThemeStage();
    }

    function closestContainedButton(target: EventTarget | null, container: HTMLElement, selector: string): HTMLButtonElement | null {
      if (!(target instanceof Element)) {
        return null;
      }

      const button = target.closest(selector);
      return button instanceof HTMLButtonElement && container.contains(button) ? button : null;
    }

    function retrySlide(slideNumber: number): void {
      request("/api/presentations/draft/content/retry", {
        body: JSON.stringify({
          slideIndex: slideNumber - 1
        }),
        method: "POST"
      }).catch((error) => window.alert(errorMessage(error)));
    }

    function stopRun(button: HTMLButtonElement): void {
      const done = setBusy(button, "Stopping...");
      request("/api/presentations/draft/content/stop", {
        method: "POST"
      }).catch((error) => window.alert(errorMessage(error))).finally(() => done());
    }

    function acceptPartial(button: HTMLButtonElement): void {
      const done = setBusy(button, "Accepting...");
      request("/api/presentations/draft/content/accept-partial", {
        method: "POST"
      }).then((payload: CreationPayload) => {
        state.creationDraft = payload.creationDraft || state.creationDraft;
        return refreshState();
      }).catch((error) => window.alert(errorMessage(error))).finally(() => done());
    }

    function handleContentRunActionClick(event: MouseEvent, container: HTMLElement, selectors: ContentRunActionSelectors): void {
      const target = event.target;
      const retryButton = closestContainedButton(target, container, selectors.retry);
      if (retryButton) {
        const slideNumber = Number.parseInt(retryButton.dataset[selectors.retryDataset] || "", 10);
        if (Number.isFinite(slideNumber)) {
          retrySlide(slideNumber);
        }
        return;
      }

      const stopButton = closestContainedButton(target, container, selectors.stop);
      if (stopButton) {
        stopRun(stopButton);
        return;
      }

      const acceptButton = closestContainedButton(target, container, selectors.accept);
      if (acceptButton) {
        acceptPartial(acceptButton);
      }
    }

    function refreshThemeDraftForElement(element: CreationInputElement): void {
      if (isThemeElement(element)) {
        resetThemeCandidates();
        renderCreationThemeStage();
      }
    }

    function scheduleDraftSave(element: CreationInputElement): void {
      if (isWorkflowRunning()) {
        return;
      }
      if (draftSaveTimer) {
        windowRef.clearTimeout(draftSaveTimer);
      }
      draftSaveTimer = windowRef.setTimeout(() => {
        draftSaveTimer = null;
        saveCreationDraft(state.ui.creationStage, {
          invalidateOutline: isOutlineRelevantInput(element)
        }).catch((error) => window.alert(errorMessage(error)));
      }, 350);
    }

    function flushDraftSave(element: CreationInputElement): void {
      if (draftSaveTimer) {
        windowRef.clearTimeout(draftSaveTimer);
        draftSaveTimer = null;
      }
      saveCreationDraft(state.ui.creationStage, {
        invalidateOutline: isOutlineRelevantInput(element)
      }).catch((error) => window.alert(errorMessage(error)));
    }

    function mountInputs(): void {
      getInputElements().forEach((element) => {
        element.addEventListener("input", () => {
          syncSourceFields(element);
          refreshThemeDraftForElement(element);
          scheduleDraftSave(element);
        });
        element.addEventListener("change", () => {
          syncSourceFields(element);
          refreshThemeDraftForElement(element);
          flushDraftSave(element);
        });
      });
    }

    function mountContentRunControls(): void {
      const contentRunPreviewActions = elements.contentRunPreviewActions;
      if (contentRunPreviewActions) {
        contentRunPreviewActions.addEventListener("click", (event) => {
          handleContentRunActionClick(event, contentRunPreviewActions, {
            accept: "[data-content-run-accept-partial]",
            retry: "[data-content-run-retry-slide]",
            retryDataset: "contentRunRetrySlide",
            stop: "[data-content-run-stop]"
          });
        });
      }

      const studioContentRunPanel = elements.studioContentRunPanel;
      if (studioContentRunPanel) {
        studioContentRunPanel.addEventListener("click", (event) => {
          handleContentRunActionClick(event, studioContentRunPanel, {
            accept: "[data-studio-content-run-accept-partial]",
            retry: "[data-studio-content-run-retry]",
            retryDataset: "studioContentRunRetry",
            stop: "[data-studio-content-run-stop]"
          });
        });
      }
    }

    function mountCommandControls(): void {
      elements.generatePresentationOutlineButton.addEventListener("click", () => generatePresentationOutline().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.regeneratePresentationOutlineButton.addEventListener("click", () => generatePresentationOutline().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.regeneratePresentationOutlineWithSourcesButton.addEventListener("click", () => {
        elements.presentationSourceText.value = elements.presentationOutlineSourceText.value;
        generatePresentationOutline().catch((error: unknown) => windowRef.alert(errorMessage(error)));
      });
      elements.approvePresentationOutlineButton.addEventListener("click", () => approvePresentationOutline().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.backToPresentationOutlineButton.addEventListener("click", () => backToPresentationOutline().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.createPresentationButton.addEventListener("click", () => createPresentationFromForm().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      if (elements.openCreatedPresentationButton) {
        elements.openCreatedPresentationButton.addEventListener("click", openCreatedPresentation);
      }

      document.querySelectorAll<HTMLButtonElement>("[data-creation-stage]").forEach((button) => {
        button.addEventListener("click", () => {
          if (button.disabled) {
            return;
          }

          const nextStage = normalizeStage(button.dataset.creationStage);
          setStage(nextStage);
          saveCreationDraft(nextStage).catch((error: unknown) => windowRef.alert(errorMessage(error)));
        });
      });

      [elements.presentationOutlineList, elements.presentationOutlineTitle, elements.presentationOutlineSummary].filter(Boolean).forEach((element) => {
        element.addEventListener("input", (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && (target.dataset.outlineField || target.dataset.outlineSlideField)) {
            markOutlineEditedLocally();
          }
        });
        element.addEventListener("change", (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && (target.dataset.outlineField || target.dataset.outlineSlideField)) {
            saveEditableOutlineDraft({ render: false }).catch((error: unknown) => windowRef.alert(errorMessage(error)));
          }
        });
      });

      elements.presentationOutlineList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const lockButton = target.closest<HTMLElement>("[data-outline-lock-slide-index]");
        if (lockButton && elements.presentationOutlineList.contains(lockButton)) {
          const slideIndex = Number.parseInt(lockButton.dataset.outlineLockSlideIndex || "", 10);
          if (Number.isFinite(slideIndex)) {
            setOutlineSlideLocked(slideIndex, lockButton.getAttribute("aria-pressed") !== "true");
            saveEditableOutlineDraft().catch((error: unknown) => windowRef.alert(errorMessage(error)));
          }
          return;
        }

        const regenerateButton = target.closest<HTMLElement>("[data-outline-regenerate-slide-index]");
        if (regenerateButton && elements.presentationOutlineList.contains(regenerateButton)) {
          const slideIndex = Number.parseInt(regenerateButton.dataset.outlineRegenerateSlideIndex || "", 10);
          if (Number.isFinite(slideIndex)) {
            regeneratePresentationOutlineSlide(slideIndex).catch((error: unknown) => windowRef.alert(errorMessage(error)));
          }
        }
      });

      mountContentRunControls();
    }

    return {
      applyFields,
      approvePresentationOutline,
      backToPresentationOutline,
      countUnlockedOutlineSlides,
      createPresentationFromForm,
      formatContentRunSummary,
      generatePresentationOutline,
      openCreatedPresentation,
      getAutoContentRunSlideIndex,
      getEditableDeckPlan,
      getFields,
      getInputElements,
      getLiveStudioContentRun,
      getOutlineLocks,
      getStageAccess,
      getStatusLabel: getContentRunStatusLabel,
      isOutlineRelevantInput,
      markOutlineEditedLocally,
      mountCommandControls,
      mountContentRunControls,
      mountInputs,
      normalizeStage,
      renderContentRun,
      renderCreationOutline,
      renderDraft,
      renderContentRunNavStatus,
      renderStudioContentRunPanel,
      regeneratePresentationOutlineSlide,
      saveCreationDraft,
      saveEditableOutlineDraft,
      setStage,
      setOutlineSlideLocked,
      truncateStatusText
    };
  }
}
