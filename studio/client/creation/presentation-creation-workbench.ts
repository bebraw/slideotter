import type { StudioClientElements } from "../core/elements";
import { StudioClientFileReaderActions } from "../core/file-reader-actions.ts";
import type { StudioClientState } from "../core/state";
import {
  formatContentRunSummary,
  getAutoContentRunSlideIndex,
  getContentRunStatusLabel,
  runSlides,
  truncateStatusText,
  type ContentRun
} from "./content-run-model.ts";
import {
  asContentRun,
  renderContentRun as renderContentRunPreview,
  renderContentRunNavStatus as renderContentRunNavStatusElement,
  renderStudioContentRunPanel as renderStudioContentRunPanelElement
} from "./content-run-rendering.ts";
import {
  getCreationStageAccess,
  normalizeCreationStage,
  type CreationStage,
  type CreationStageAccessContext
} from "./creation-stage-model.ts";
import {
  asDeckPlan,
  buildEditableDeckPlanOutline,
  cloneDeckPlan,
  countUnlockedOutlineSlides as countUnlockedDeckPlanSlides,
  normalizeOutlineLocks,
  updateOutlineLocks,
  type DeckPlan,
  type DeckPlanSlide
} from "./editable-outline-model.ts";
import {
  renderCreationOutline as renderCreationOutlineElement,
  renderQuickSourceOutline as renderQuickSourceOutlineElement
} from "./creation-outline-rendering.ts";
import { createContentRunActions } from "./content-run-actions.ts";

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
  type Stage = CreationStage;

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
  export type PresentationCreationWorkbenchDependencies = {
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    getPresentationState: () => PresentationState;
    isWorkflowRunning: () => boolean;
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

  export type CreationFields = {
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

  function ensureFontOption(select: CreationInputElement, value: string): void {
    if (!value || Array.from(select.options).some((option) => option.value === value)) {
      return;
    }
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `Site font (${value})`;
    option.dataset.customFont = "true";
    select.append(option);
  }

  function asCreationDraft(value: unknown): CreationDraft | null {
    return isRecord(value) ? value : null;
  }

  function currentDraft(state: StudioClientState.State): CreationDraft | null {
    return asCreationDraft(state.creationDraft);
  }

  export function createPresentationCreationWorkbench(deps: PresentationCreationWorkbenchDependencies) {
    const {
      createDomElement,
      elements,
      getPresentationState,
      isWorkflowRunning,
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
    const { readFileAsDataUrl } = StudioClientFileReaderActions.createFileReaderActions({
      windowRef
    });
    const contentRunActions = createContentRunActions({
      elements,
      onCreationDraft: (creationDraft: unknown) => {
        state.creationDraft = asCreationDraft(creationDraft) || state.creationDraft;
      },
      refreshState,
      request,
      setBusy,
      windowRef
    });

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
      return normalizeCreationStage(stage);
    }

    function getStageAccess(stage: unknown, _draft: CreationDraft | null, context: CreationStageAccessContext = {}) {
      const draft = _draft;
      return getCreationStageAccess(stage, {
        approved: context.approved ?? draft?.approvedOutline === true,
        hasOutline: context.hasOutline ?? Boolean(draft?.deckPlan && Array.isArray(draft.deckPlan.slides) && draft.deckPlan.slides.length),
        outlineDirty: context.outlineDirty ?? draft?.outlineDirty === true
      });
    }

    function setStage(stage: unknown): void {
      state.ui.creationStage = normalizeCreationStage(stage);
      renderDraft();
    }

    function getOutlineLocks(): Record<string, boolean> {
      const draft = currentDraft(state);
      return normalizeOutlineLocks(draft?.outlineLocks);
    }

    function setOutlineSlideLocked(index: number, locked: boolean): Record<string, boolean> {
      const locks = updateOutlineLocks(getOutlineLocks(), index, locked);

      state.creationDraft = {
        ...(state.creationDraft || {}),
        outlineLocks: locks
      };
      return locks;
    }

    function countUnlockedOutlineSlides(deckPlan: DeckPlan | null = null): number {
      const draft = currentDraft(state);
      const plan = deckPlan || draft?.deckPlan || null;
      return countUnlockedDeckPlanSlides(plan, getOutlineLocks());
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
        const visualNeed = readOutlineEditorValue(`[data-outline-slide-index="${index}"][data-outline-slide-field="visualNeed"]`, slide.visualNeed || "Use supplied image materials only where they help this slide.");

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

    function renderQuickSourceOutline(deckPlan: DeckPlan | null = null): void {
      const draft = currentDraft(state);
      const plan = deckPlan || draft?.deckPlan || null;
      renderQuickSourceOutlineElement(plan, { createDomElement, elements });
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
      renderCreationOutlineElement(draft, {
        createDomElement,
        elements,
        workflowRunning: isWorkflowRunning()
      });
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
        const fontFamily = theme.fontFamily || "avenir";
        ensureFontOption(elements.presentationFontFamily, fontFamily);
        elements.presentationFontFamily.value = fontFamily;
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
      const draft = state.creationDraft || {};
      renderContentRunNavStatusElement(elements, draft.deckPlan, asContentRun(draft.contentRun));
    }

    function renderStudioContentRunPanel() {
      renderStudioContentRunPanelElement(elements, (state.creationDraft || {}).deckPlan, getLiveStudioContentRun(), {
        createDomElement,
        isWorkflowRunning
      });
    }

    function renderContentRun(draft: CreationDraft | null): void {
      renderContentRunPreview(draft, {
        createDomElement,
        elements,
        isWorkflowRunning,
        renderDomSlide,
        selectedSlideIndex: state.ui.creationContentSlideIndex,
        setSelectedSlideIndex: (index: number) => {
          state.ui.creationContentSlideIndex = index;
        },
        truncateStatusText
      });
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
      contentRunActions.mountContentRunControls();
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
