import {
  formatContentRunSummary,
  getContentRunActionState,
  getContentRunPreviewState,
  planSlides,
  runSlides,
  shouldShowContentRunNavStatus,
  type ContentRun,
  type ContentRunDeckPlan
} from "./content-run-model.ts";

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

type ContentRunElements = {
  contentRunNavStatus?: HTMLElement | null;
  contentRunPreview?: HTMLElement | null;
  contentRunPreviewActions?: HTMLElement | null;
  contentRunPreviewEyebrow?: HTMLElement | null;
  contentRunPreviewTitle?: HTMLElement | null;
  contentRunSummary?: HTMLElement | null;
  studioContentRunPanel?: HTMLElement | null;
};

type RenderContentRunOptions = {
  createDomElement: CreateDomElement;
  elements: ContentRunElements;
  isWorkflowRunning: () => boolean;
  renderDomSlide: (container: HTMLElement, slideSpec: unknown, options?: Record<string, unknown>) => void;
  selectedSlideIndex: unknown;
  setSelectedSlideIndex: (index: number) => void;
  truncateStatusText: (value: unknown, maxLength?: number) => string;
};

function isContentRun(value: unknown): value is ContentRun {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function asContentRun(value: unknown): ContentRun | null {
  return isContentRun(value) ? value : null;
}

export function renderContentRunNavStatus(elements: ContentRunElements, deckPlan: ContentRunDeckPlan | null | undefined, run: ContentRun | null): void {
  if (!elements.contentRunNavStatus) {
    return;
  }

  const runSlideList = runSlides(run);
  const slideCount = run && Number.isFinite(Number(run.slideCount))
    ? Number(run.slideCount)
    : planSlides(deckPlan).length;

  if (!shouldShowContentRunNavStatus(deckPlan, run)) {
    elements.contentRunNavStatus.hidden = true;
    elements.contentRunNavStatus.textContent = "";
    elements.contentRunNavStatus.dataset.state = "idle";
    return;
  }
  if (!run) {
    return;
  }

  elements.contentRunNavStatus.hidden = false;
  const summary = formatContentRunSummary(run, slideCount, runSlideList);
  elements.contentRunNavStatus.textContent = summary;
  elements.contentRunNavStatus.title = summary;
  elements.contentRunNavStatus.dataset.state = run.status || "idle";
}

export function renderStudioContentRunPanel(
  elements: ContentRunElements,
  deckPlan: ContentRunDeckPlan | null | undefined,
  activeRun: ContentRun | null,
  options: Pick<RenderContentRunOptions, "createDomElement" | "isWorkflowRunning">
): void {
  if (!elements.studioContentRunPanel) {
    return;
  }

  const actionState = getContentRunActionState(deckPlan, activeRun);
  if (!actionState || !activeRun || !["running", "failed", "stopped"].includes(actionState.run.status || "")) {
    elements.studioContentRunPanel.hidden = true;
    elements.studioContentRunPanel.replaceChildren();
    return;
  }

  const { completedCount, failedIndex, incompleteCount, run, runSlides: runSlideList, slideCount } = actionState;
  const summary = formatContentRunSummary(run, slideCount, runSlideList);
  const canRetry = run.status === "failed" && failedIndex >= 0 && !options.isWorkflowRunning();
  const canAcceptPartial = run.status !== "running" && completedCount > 0 && incompleteCount > 0;

  elements.studioContentRunPanel.hidden = false;
  elements.studioContentRunPanel.dataset.state = run.status || "idle";
  const actionButtons: HTMLElement[] = [];
  if (run.status === "running") {
    actionButtons.push(options.createDomElement("button", {
      attributes: { type: "button" },
      className: "secondary compact-button",
      dataset: { studioContentRunStop: "" },
      text: "Stop"
    }));
  }
  if (canRetry) {
    actionButtons.push(options.createDomElement("button", {
      attributes: { type: "button" },
      className: "secondary compact-button",
      dataset: { studioContentRunRetry: failedIndex + 1 },
      text: `Retry slide ${failedIndex + 1}`
    }));
  }
  if (canAcceptPartial) {
    actionButtons.push(options.createDomElement("button", {
      attributes: { type: "button" },
      className: "secondary compact-button",
      dataset: { studioContentRunAcceptPartial: "" },
      text: "Accept completed"
    }));
  }
  elements.studioContentRunPanel.replaceChildren(
    options.createDomElement("div", {}, [
      options.createDomElement("p", { className: "eyebrow", text: "Live generation" }),
      options.createDomElement("strong", { text: summary })
    ]),
    options.createDomElement("div", { className: "button-row compact" }, actionButtons)
  );
}

export function renderContentRun(draft: { contentRun?: unknown; deckPlan?: ContentRunDeckPlan } | null, options: RenderContentRunOptions): void {
  const { createDomElement, elements } = options;
  if (!elements.contentRunPreview || !elements.contentRunPreviewTitle || !elements.contentRunPreviewEyebrow || !elements.contentRunPreviewActions || !elements.contentRunSummary) {
    return;
  }

  const deckPlan = draft?.deckPlan || null;
  const planSlideList = planSlides(deckPlan);
  const run = asContentRun(draft?.contentRun);
  const runSlideList = runSlides(run);
  const slideCount = planSlideList.length;

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

  const previewState = getContentRunPreviewState(deckPlan, run, options.selectedSlideIndex);
  if (!previewState) {
    return;
  }
  const {
    completedCount,
    incompleteCount,
    planSlide,
    runSlide,
    selected,
    status
  } = previewState;
  options.setSelectedSlideIndex(selected);

  elements.contentRunSummary.textContent = formatContentRunSummary(run, slideCount, runSlideList);

  elements.contentRunPreviewActions.replaceChildren();
  elements.contentRunPreviewEyebrow.textContent = previewState.statusLabel;
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
    options.renderDomSlide(elements.contentRunPreview, runSlide.slideSpec, {
      index: selected,
      totalSlides: slideCount
    });
    return;
  }

  if (status === "failed") {
    elements.contentRunPreviewActions.appendChild(createDomElement("button", {
      attributes: { type: "button" },
      className: "secondary compact-button",
      dataset: { contentRunRetrySlide: selected },
      disabled: options.isWorkflowRunning(),
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
    describe("Value", planSlide.value, "No value provided."),
    describe("Key message", planSlide.keyMessage || planSlide.intent, "No key message provided."),
    describe("Source need", planSlide.sourceNeed, "No specific source need."),
    describe("Image guidance", planSlide.visualNeed, "No specific image guidance.")
  ]));

  elements.contentRunPreview.replaceChildren(createDomElement("div", {
    className: "creation-content-placeholder"
  }, placeholderChildren));
}
