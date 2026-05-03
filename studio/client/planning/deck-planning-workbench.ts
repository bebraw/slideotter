import type { StudioClientElements } from "../elements";
import type { StudioClientState } from "../state";

export namespace StudioClientDeckPlanningWorkbench {
  type BusyElement = HTMLElement & {
    disabled: boolean;
  };
  type JsonRecord = StudioClientState.JsonRecord;
  type DeckLengthPlan = StudioClientState.DeckLengthPlan;
  type DeckStructureCandidate = StudioClientState.DeckStructureCandidate;
  type DeckStructurePlanStep = StudioClientState.DeckStructurePlanStep;
  type OutlinePlan = StudioClientState.OutlinePlan;
  type OutlinePlanSection = StudioClientState.OutlinePlanSection;
  type OutlinePlanSlide = StudioClientState.OutlinePlanSlide;
  type SourceRecord = StudioClientState.SourceRecord;
  type StudioSlide = StudioClientState.StudioSlide;

  type Request = <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;
  type PresentationCreationWorkbench = {
    applyFields: (fields: JsonRecord) => void;
    normalizeStage: (stage: unknown) => string;
  };
  type PresentationLibrary = {
    resetSelection: () => void;
  };
  type Deps = {
    buildDeck: () => Promise<void>;
    createDomElement: (tagName: string, options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      dataset?: Record<string, string | number | boolean>;
      text?: unknown;
    }, children?: Array<Node | string | number | boolean>) => HTMLElement;
    elements: StudioClientElements.Elements;
    loadSlide: (slideId: string) => Promise<void>;
    presentationCreationWorkbench: PresentationCreationWorkbench;
    presentationLibrary: PresentationLibrary;
    refreshState: () => Promise<void>;
    renderCreationDraft: () => void;
    renderDeckFields: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    request: Request;
    setBusy: (button: BusyElement, label: string) => () => void;
    setCurrentPage: (page: string) => void;
    setDomPreviewState: (payload: JsonRecord) => void;
    state: StudioClientState.State;
    syncSelectedSlideToActiveList: () => void;
    windowRef: Window;
  };

  type DeckPlanStepGroup = {
    action: string;
    items: DeckStructurePlanStep[];
    label: string;
  };

  type DeckDiffMetric = {
    label: string;
    signed?: boolean;
    value: number;
  };

  type DeckDiffSupport = {
    actionMap: Array<{
      action: string;
      currentIndex?: number | undefined;
      proposedIndex?: number | undefined;
      title: string;
    }>;
    cues: string[];
    focusItems: Array<{ action: string; count: number }>;
    metrics: DeckDiffMetric[];
    overflow: number;
    scale: string;
  };

  type DeckDiffDetails = {
    currentSequence?: SequenceEntry[];
    deckChanges?: DeckChange[];
    diff?: JsonRecord;
    diffFiles?: DiffFile[];
    plan?: DeckStructurePlanStep[];
    planStats?: PlanStats;
    proposedSequence?: SequenceEntry[];
  };

  type PlanStats = JsonRecord & {
    archived?: number;
    inserted?: number;
    moved?: number;
    replaced?: number;
    retitled?: number;
    shared?: number;
    total?: number;
  };

  type SequenceEntry = JsonRecord & {
    index?: number;
    title?: string;
    url?: string;
  };

  type PreviewHint = JsonRecord & {
    action?: string;
    cue?: string;
    currentIndex?: number;
    currentTitle?: string;
    proposedPreview?: {
      url?: string;
    };
    proposedTitle?: string;
    type?: string;
  };

  type DeckChange = JsonRecord & {
    after?: string;
    before?: string;
    label?: string;
    scope?: string;
  };

  type DiffFile = JsonRecord & {
    after?: string;
    before?: string;
    changeKinds?: string[];
    note?: string;
    targetPath?: string;
  };

  type OutlineDiff = JsonRecord & {
    added?: string[];
    archived?: string[];
    moved?: Array<{ from?: number | string; title?: string; to?: number | string }>;
    retitled?: Array<{ after?: string; before?: string }>;
  };

  type DeckStructurePreview = JsonRecord & {
    cues?: string[];
    currentSequence?: SequenceEntry[];
    currentStrip?: { url?: string };
    overview?: string;
    previewHints?: PreviewHint[];
    proposedSequence?: SequenceEntry[];
    strip?: { url?: string };
  };

  type DeckStructureDiff = JsonRecord & {
    counts?: {
      afterSlides?: number;
      beforeSlides?: number;
      shared?: number;
    };
    deck?: JsonRecord & {
      changes?: DeckChange[];
      summary?: string;
    };
    files?: DiffFile[];
    outline?: OutlineDiff;
    summary?: string;
  };

  type OutlinePlanPayload = {
    context?: StudioClientState.DeckContext;
    creationDraft?: StudioClientState.CreationDraft | null;
    deckStructureCandidates?: DeckStructureCandidate[];
    outlinePlan?: OutlinePlan;
    outlinePlans?: OutlinePlan[];
    presentations?: StudioClientState.State["presentations"];
    runtime?: StudioClientState.RuntimeState | null;
    slides?: StudioSlide[];
    summary?: string;
  } & JsonRecord;

  type SourcePayload = {
    runtime?: StudioClientState.RuntimeState | null;
    source?: SourceRecord;
    sources?: SourceRecord[];
  };

  type DeckLengthPayload = {
    context?: StudioClientState.DeckContext;
    domPreview?: unknown;
    lengthProfile?: { activeCount?: number };
    previews?: StudioClientState.State["previews"];
    restoredSlides?: number;
    runtime?: StudioClientState.RuntimeState | null;
    skippedSlides?: StudioSlide[];
    slides?: StudioSlide[];
  } & JsonRecord;

  type DeckStructureApplyPayload = JsonRecord & {
    indexUpdates?: number;
    insertedSlides?: number;
    removedSlides?: number;
    replacedSlides?: number;
    sharedDeckUpdates?: number;
    titleUpdates?: number;
  };

  function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function asPlanStats(value: unknown): PlanStats {
    return isRecord(value) ? value : {};
  }

  function asDeckStructureDiff(value: unknown): DeckStructureDiff {
    return isRecord(value) ? value : {};
  }

  function asDeckStructurePreview(value: unknown): DeckStructurePreview {
    return isRecord(value) ? value : {};
  }

  function createDeckPlanStep(value: unknown): DeckStructurePlanStep | null {
    return isRecord(value) ? value : null;
  }

  function createDeckStructureCandidate(value: unknown): DeckStructureCandidate | null {
    if (!isRecord(value) || typeof value.id !== "string") {
      return null;
    }
    return {
      ...value,
      id: value.id,
      slides: Array.isArray(value.slides) ? value.slides.map(createDeckPlanStep).filter((slide): slide is DeckStructurePlanStep => Boolean(slide)) : []
    };
  }

  export function createDeckPlanningWorkbench(deps: Deps) {
    const {
      buildDeck,
      createDomElement,
      elements,
      loadSlide,
      presentationCreationWorkbench,
      presentationLibrary,
      refreshState,
      renderCreationDraft,
      renderDeckFields,
      renderPreviews,
      renderStatus,
      renderVariants,
      request,
      setBusy,
      setCurrentPage,
      setDomPreviewState,
      state,
      syncSelectedSlideToActiveList,
      windowRef
    } = deps;

    function formatDeckActionLabel(action: unknown): string {
      const labels: Record<string, string> = {
        insert: "Insert",
        keep: "Keep",
        move: "Move",
        remove: "Archive",
        replace: "Replace",
        "retitle-and-move": "Retitle + move",
        "retitle-and-replace": "Retitle + replace",
        retitle: "Retitle",
        shared: "Shared"
      };
      return labels[String(action)] || String(action);
    }

    function groupDeckPlanSteps(plan: DeckStructurePlanStep[] = []): DeckPlanStepGroup[] {
      const grouped = new Map<string, DeckPlanStepGroup>();

      plan.forEach((slide: DeckStructurePlanStep) => {
        const action = String(slide && slide.action ? slide.action : "keep");
        if (action === "keep") {
          return;
        }
    
        const label = formatDeckActionLabel(action);
        const current = grouped.get(action) || {
          action,
          items: [],
          label
        };
        current.items.push(slide);
        grouped.set(action, current);
      });
    
      return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label));
    }
    
    function buildDeckDiffSupport(details: DeckDiffDetails): DeckDiffSupport {
      const planStats = details.planStats || {};
      const diff = asDeckStructureDiff(details.diff);
      const diffCounts = diff.counts || {};
      const diffFiles = Array.isArray(details.diffFiles) ? details.diffFiles : [];
      const deckChanges = Array.isArray(details.deckChanges) ? details.deckChanges : [];
      const plan = Array.isArray(details.plan) ? details.plan : [];
      const currentSequence = Array.isArray(details.currentSequence) ? details.currentSequence : [];
      const proposedSequence = Array.isArray(details.proposedSequence) ? details.proposedSequence : [];
      const changedSlides = [
        planStats.inserted || 0,
        planStats.replaced || 0,
        planStats.archived || 0,
        planStats.moved || 0,
        planStats.retitled || 0
      ].reduce((total, count) => total + count, 0);
      const sharedChanges = (planStats.shared || 0) || deckChanges.length || (diffCounts.shared || 0);
      const totalImpact = changedSlides + sharedChanges + diffFiles.length;
      const beforeSlides = (diffCounts.beforeSlides || currentSequence.length || 0);
      const afterSlides = (diffCounts.afterSlides || proposedSequence.length || 0);
      const scale = totalImpact >= 12 || changedSlides >= 8 || diffFiles.length >= 6
        ? "Large"
        : totalImpact >= 5 || changedSlides >= 3 || diffFiles.length >= 3
          ? "Medium"
          : "Small";
      const metrics = [
        { label: "slide actions", value: changedSlides },
        { label: "files", value: diffFiles.length },
        { label: "shared", value: sharedChanges },
        { label: "slide delta", signed: true, value: afterSlides - beforeSlides }
      ];
      const focusItems = [
        { action: "insert", count: planStats.inserted || 0 },
        { action: "replace", count: planStats.replaced || 0 },
        { action: "remove", count: planStats.archived || 0 },
        { action: "move", count: planStats.moved || 0 },
        { action: "retitle", count: planStats.retitled || 0 },
        { action: "shared", count: sharedChanges }
      ].filter((item) => item.count > 0);
      const cues = [];
    
      if (scale === "Large") {
        cues.push("Review the strip, affected previews, and file targets before applying.");
      } else if (scale === "Medium") {
        cues.push("Check the action map and changed file list before applying.");
      } else {
        cues.push("A focused preview pass should be enough for this candidate.");
      }
    
      if ((planStats.archived || 0) > 0) {
        cues.push("Archived slides are preserved by guardrails; confirm the narrative still has their claims.");
      }
    
      if (sharedChanges > 0) {
        cues.push("Shared deck settings change with this candidate unless you clear that apply option.");
      }
    
      if (diffFiles.length >= 4) {
        cues.push("Multiple slide files change; run checks after applying.");
      }
    
      const changedPlanSteps = plan.filter((slide: DeckStructurePlanStep) => slide && slide.action && slide.action !== "keep");
      const actionMap = changedPlanSteps
        .slice(0, 14)
        .map((slide: DeckStructurePlanStep) => ({
          action: String(slide.action || "keep"),
          currentIndex: slide.currentIndex,
          proposedIndex: slide.proposedIndex,
          title: slide.proposedTitle || slide.currentTitle || "Untitled"
        }));
      const overflow = Math.max(0, changedPlanSteps.length - actionMap.length);
    
      return {
        actionMap,
        cues,
        focusItems,
        metrics,
        overflow,
        scale
      };
    }
    
    function renderDeckDiffSupport(support: DeckDiffSupport): HTMLElement {
      const formatMetricValue = (metric: DeckDiffMetric): string => metric.signed && metric.value > 0
        ? `+${metric.value}`
        : String(metric.value);

      const children: HTMLElement[] = [
        createDomElement("div", { className: "compare-decision-head" }, [
          createDomElement("div", {}, [
            createDomElement("p", { className: "eyebrow", text: "Diff impact" }),
            createDomElement("strong", { text: `${support.scale} deck change` })
          ]),
          createDomElement("div", { className: "compare-decision-metrics" }, support.metrics.map((metric) => createDomElement("span", {}, [
            createDomElement("strong", { text: formatMetricValue(metric) }),
            ` ${metric.label}`
          ])))
        ])
      ];

      if (support.focusItems.length) {
        children.push(createDomElement("div", {
          attributes: { "aria-label": "Deck diff focus" },
          className: "compare-decision-focus"
        }, support.focusItems.map((item) => createDomElement("span", { className: "compare-decision-chip" }, [
          createDomElement("strong", { text: formatDeckActionLabel(item.action) }),
          ` ${item.count}`
        ]))));
      }

      if (support.actionMap.length) {
        const actionNodes = support.actionMap.map((item) => {
          const indexLabel = Number.isFinite(item.proposedIndex)
            ? item.proposedIndex
            : (Number.isFinite(item.currentIndex) ? item.currentIndex : "?");
          return createDomElement("span", {
            attributes: { title: item.title },
            className: "deck-diff-node",
            dataset: { action: item.action }
          }, [
            createDomElement("strong", { text: indexLabel }),
            ` ${formatDeckActionLabel(item.action)}`
          ]);
        });
        if (support.overflow) {
          actionNodes.push(createDomElement("span", { className: "deck-diff-node overflow" }, [
            createDomElement("strong", { text: `+${support.overflow}` }),
            " more"
          ]));
        }
        children.push(createDomElement("div", {
          attributes: { "aria-label": "Deck action map" },
          className: "deck-diff-map"
        }, actionNodes));
      }

      children.push(createDomElement("div", { className: "compare-decision-cues" }, support.cues.map((cue) => createDomElement("p", { text: cue }))));
      return createDomElement("section", { className: "deck-diff-panel" }, children);
    }
    
    function renderDeckLengthPlan(): void {
      const activeCount = state.slides.length;
      const skippedSlides = Array.isArray(state.skippedSlides) ? state.skippedSlides : [];
      const lengthProfile = state.context && state.context.deck ? state.context.deck.lengthProfile : null;
      const plan = state.deckLengthPlan;
      const actions = plan && Array.isArray(plan.actions) ? plan.actions : [];
    
      if (!elements.deckLengthTarget.value) {
        elements.deckLengthTarget.value = String(lengthProfile && lengthProfile.targetCount
          ? lengthProfile.targetCount
          : activeCount || 1);
      }
    
      elements.deckLengthApplyButton.disabled = !actions.length;
      const summaryStats = [
        createDomElement("span", { className: "compare-stat" }, [
          createDomElement("strong", { text: activeCount }),
          " active"
        ]),
        createDomElement("span", { className: "compare-stat" }, [
          createDomElement("strong", { text: skippedSlides.length }),
          " skipped"
        ])
      ];
      if (plan) {
        summaryStats.push(createDomElement("span", { className: "compare-stat" }, [
          createDomElement("strong", { text: plan.targetCount }),
          " target"
        ]));
        summaryStats.push(createDomElement("span", { className: "compare-stat" }, [
          createDomElement("strong", { text: plan.nextCount }),
          " after apply"
        ]));
      }
      elements.deckLengthSummary.replaceChildren(
        createDomElement("div", { className: "compare-stats" }, summaryStats),
        createDomElement("p", {
          className: "section-note",
          text: plan ? plan.summary : "Set a target length and plan a reversible keep/skip/restore pass."
        })
      );

      elements.deckLengthPlanList.replaceChildren();
      if (!actions.length) {
        elements.deckLengthPlanList.replaceChildren(createDomElement("div", { className: "variant-card" }, [
          createDomElement("strong", { text: "No length plan yet" }),
          createDomElement("span", { text: "Plan a target length to review which slides would be skipped or restored." })
        ]));
      } else {
        actions.forEach((action: StudioClientState.DeckLengthAction) => {
          const actionLabel = action.action === "restore" ? "Restore" : action.action === "insert" ? "Insert" : "Skip";
          const metaTarget = action.action === "insert"
            ? `new slide at ${action.targetIndex || "end"}`
            : action.slideId;
          const card = createDomElement("div", { className: "variant-card deck-length-card" }, [
            createDomElement("p", { className: "variant-kind", text: actionLabel }),
            createDomElement("strong", { text: action.title || action.slideId }),
            createDomElement("span", { className: "variant-meta", text: `${action.confidence || "medium"} confidence · ${metaTarget || ""}` }),
            createDomElement("span", { text: action.reason || "No reason recorded." })
          ]);
          elements.deckLengthPlanList.appendChild(card);
        });
      }
    
      if (!skippedSlides.length) {
        elements.deckLengthRestoreList.replaceChildren();
        return;
      }

      const restoreAllButton = createDomElement("button", {
        attributes: {
          type: "button"
        },
        className: "secondary",
        dataset: {
          action: "restore-all"
        },
        text: "Restore all"
      }) as HTMLButtonElement;
      const restoreCards = skippedSlides.map((slide: StudioSlide) => {
        const restoreButton = createDomElement("button", {
          attributes: {
            type: "button"
          },
          className: "secondary",
          dataset: {
            slideId: slide.id
          },
          text: "Restore"
        }) as HTMLButtonElement;
        restoreButton.addEventListener("click", () => {
          restoreSkippedSlides({ slideId: slide.id }).catch((error: unknown) => window.alert(errorMessage(error)));
        });
        return createDomElement("div", { className: "variant-card deck-length-card" }, [
          createDomElement("p", { className: "variant-kind", text: "Skipped" }),
          createDomElement("strong", { text: slide.title || slide.id }),
          createDomElement("span", { text: slide.skipReason || "Hidden by length scaling." }),
          createDomElement("div", { className: "variant-actions" }, [
            restoreButton
          ])
        ]);
      });
      elements.deckLengthRestoreList.replaceChildren(
        createDomElement("div", { className: "workflow-variants-head" }, [
          createDomElement("div", {}, [
            createDomElement("p", { className: "eyebrow", text: "Restore" }),
            createDomElement("h3", { text: "Skipped slides" })
          ]),
          restoreAllButton
        ]),
        createDomElement("div", { className: "variant-list workflow-variant-list" }, restoreCards)
      );
    
      restoreAllButton.addEventListener("click", () => {
        restoreSkippedSlides({ all: true }).catch((error: unknown) => window.alert(errorMessage(error)));
      });
    }
    
    function setDeckStructureCandidates(candidates: unknown): void {
      state.deckStructureCandidates = Array.isArray(candidates)
        ? candidates.map(createDeckStructureCandidate).filter((candidate): candidate is DeckStructureCandidate => Boolean(candidate))
        : [];
      state.selectedDeckStructureId = state.deckStructureCandidates[0] ? state.deckStructureCandidates[0].id : null;
    }
    
    function renderDeckStructureCandidates(): void {
      const candidates = Array.isArray(state.deckStructureCandidates) ? state.deckStructureCandidates : [];
      elements.deckStructureList.replaceChildren();
    
      if (!candidates.length) {
        elements.deckStructureList.replaceChildren(createDomElement("div", { className: "variant-card" }, [
          createDomElement("strong", { text: "No deck plan candidates yet" }),
          createDomElement("span", {
            text: "Use the deck-level workflow to generate structure or batch-authoring options from the saved brief and current slides."
          })
        ]));
        return;
      }
    
      candidates.forEach((candidate: DeckStructureCandidate, index: number) => {
        const isSelected = candidate.id === state.selectedDeckStructureId;
        const card = createDomElement("div", {
          className: `variant-card deck-plan-card${isSelected ? " active" : ""}`
        });
        const outlineLines = String(candidate.outline || "").split("\n").filter(Boolean);
        const planStats = asPlanStats(candidate.planStats);
        const diff = asDeckStructureDiff(candidate.diff);
        const preview = asDeckStructurePreview(candidate.preview);
        const plan = Array.isArray(candidate.slides) ? candidate.slides : [];
        const previewCues = Array.isArray(preview.cues) ? preview.cues : [];
        const previewHints = Array.isArray(preview.previewHints) ? preview.previewHints : [];
        const currentSequence = Array.isArray(preview.currentSequence) ? preview.currentSequence : [];
        const proposedSequence = Array.isArray(preview.proposedSequence) ? preview.proposedSequence : [];
        const diffFiles = Array.isArray(diff.files) ? diff.files : [];
        const deckDiff = diff.deck || {};
        const deckChanges = Array.isArray(deckDiff.changes) ? deckDiff.changes : [];
        const applySharedSettings = state.ui.deckPlanApplySharedSettings[candidate.id] !== false;
        const outlineDiff: OutlineDiff = isRecord(diff.outline) ? diff.outline : {};
        const groupedPlan = groupDeckPlanSteps(plan);
        const deckDiffSupport = buildDeckDiffSupport({
          currentSequence,
          deckChanges,
          diff,
          diffFiles,
          plan,
          planStats,
          proposedSequence
        });
        const stripCards: HTMLElement[] = [];
        if (preview.currentStrip && preview.currentStrip.url) {
          stripCards.push(createDomElement("div", { className: "deck-structure-strip-card" }, [
            createDomElement("span", { className: "deck-structure-strip-label", text: "Before deck" }),
            createDomElement("img", {
              attributes: {
                alt: `${candidate.label || "Deck plan"} current deck strip`,
                src: preview.currentStrip.url
              }
            })
          ]));
        }
        if (preview.strip && preview.strip.url) {
          stripCards.push(createDomElement("div", { className: "deck-structure-strip-card" }, [
            createDomElement("span", { className: "deck-structure-strip-label", text: "After deck" }),
            createDomElement("img", {
              attributes: {
                alt: `${candidate.label || "Deck plan"} proposed deck strip`,
                src: preview.strip.url
              }
            })
          ]));
        }
        const stripCompare = stripCards.length
          ? createDomElement("div", { className: "deck-structure-strip-compare" }, stripCards)
          : null;
        const previewHintCards = previewHints.map((hint: PreviewHint) => {
              const currentPage = Number.isFinite(hint.currentIndex)
                ? state.previews.pages.find((entry) => entry.index === hint.currentIndex)
                : null;
              const currentPreview = currentPage
                ? createDomElement("img", {
                  attributes: {
                    alt: hint.currentTitle || "Current slide",
                    src: `${currentPage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`
                  }
                })
                : createDomElement("div", {
                  className: "deck-structure-preview-placeholder",
                  text: hint.action === "insert" ? (hint.type || "new slide") : "archived"
                });
              const proposedPreview = hint.proposedPreview && hint.proposedPreview.url
                ? createDomElement("img", {
                  attributes: {
                    alt: hint.proposedTitle || "Proposed slide",
                    src: hint.proposedPreview.url
                  }
                })
                : createDomElement("div", {
                  className: "deck-structure-preview-placeholder",
                  text: hint.action === "remove" ? "archived" : (hint.type || "pending")
                });

              return createDomElement("div", { className: "deck-structure-preview-card" }, [
                createDomElement("div", { className: "deck-structure-preview-pair" }, [
                  createDomElement("div", { className: "deck-structure-preview-slot" }, [
                    createDomElement("span", { className: "deck-structure-preview-label", text: "Before" }),
                    currentPreview
                  ]),
                  createDomElement("div", { className: "deck-structure-preview-slot" }, [
                    createDomElement("span", { className: "deck-structure-preview-label", text: "After" }),
                    proposedPreview
                  ])
                ]),
                createDomElement("strong", { text: hint.action || "keep" }),
                createDomElement("span", { text: hint.cue || "" })
              ]);
            });
        const previewHintList = previewHintCards.length
          ? createDomElement("div", { className: "deck-structure-preview-hints" }, previewHintCards)
          : null;
        const stat = (value: unknown, label: string): HTMLElement => createDomElement("span", { className: "compare-stat" }, [
          createDomElement("strong", { text: value }),
          ` ${label}`
        ]);
        const summaryItems = [
          ...(preview.overview ? [preview.overview] : []),
          ...previewCues
        ];
        const cardChildren: HTMLElement[] = [
          createDomElement("p", { className: "variant-kind", text: candidate.kindLabel || "Deck plan" }),
          createDomElement("strong", { text: candidate.label || `Candidate ${index + 1}` }),
          createDomElement("span", {
            className: "variant-meta",
            text: candidate.summary || candidate.promptSummary || candidate.notes || "No summary"
          }),
          createDomElement("div", { className: "compare-stats" }, [
            stat(planStats.total || plan.length, "plan steps"),
            stat(planStats.inserted || 0, "insert"),
            stat(planStats.replaced || 0, "replace"),
            stat(planStats.archived || 0, "archive"),
            stat(planStats.moved || 0, "move"),
            stat(planStats.shared || 0, "shared"),
            stat(planStats.retitled || 0, "retitle")
          ]),
          createDomElement("div", { className: "compare-change-summary" }, summaryItems.map((item: string) => createDomElement("p", {
            className: "compare-summary-item",
            text: item
          })))
        ];

        if (isSelected) {
          const outlineLine = (label: string, value: unknown): HTMLElement => createDomElement("div", {
            className: "deck-structure-outline-line"
          }, [
            createDomElement("strong", { text: label }),
            createDomElement("span", { text: value })
          ]);
          const deckStructureStep = (children: Array<Node | string | number | boolean>): HTMLElement => createDomElement("div", {
            className: "deck-structure-step"
          }, children);
          const deckStructurePlan = (children: HTMLElement[]): HTMLElement => createDomElement("div", {
            className: "deck-structure-plan"
          }, children);
          const deckStructurePill = (value: unknown): HTMLElement => createDomElement("span", {
            className: "deck-structure-pill",
            text: value
          });
          const planStepTitle = (slide: DeckStructurePlanStep): string => Number.isFinite(slide.proposedIndex)
            ? `${slide.proposedIndex}. ${slide.proposedTitle || slide.currentTitle || "Untitled"}`
            : `Archive ${slide.currentIndex || "?"}. ${slide.currentTitle || "Untitled"}`;
          const selectedOutline = createDomElement("div", { className: "deck-structure-outline" }, [
            outlineLine("Diff summary", diff.summary || "No deck diff summary available"),
            outlineLine("Shared deck changes", deckDiff.summary || "No shared deck changes"),
            outlineLine("Added to live deck", (outlineDiff.added || []).join(" / ") || "None"),
            outlineLine("Archived from live deck", (outlineDiff.archived || []).join(" / ") || "None"),
            outlineLine("Retitled beats", (outlineDiff.retitled || []).map((item) => `${item.before} -> ${item.after}`).join(" / ") || "None"),
            outlineLine("Moved beats", (outlineDiff.moved || []).map((item) => `${item.title} ${item.from}->${item.to}`).join(" / ") || "None")
          ]);
          const sharedSettingsOption = deckChanges.length
            ? createDomElement("label", { className: "deck-structure-option" }, [
              createDomElement("input", {
                attributes: {
                  ...(applySharedSettings ? { checked: "checked" } : {}),
                  type: "checkbox"
                },
                dataset: { action: "toggle-shared-settings" }
              }),
              createDomElement("span", { text: "Apply shared deck settings with this candidate" })
            ])
            : null;
          const sharedDeckChangeNodes = deckChanges.length
            ? deckChanges.map((change: DeckChange) => createDomElement("div", { className: "deck-structure-step" }, [
              createDomElement("strong", { text: change.label || "Shared deck change" }),
              deckStructurePill(change.scope || "deck"),
              createDomElement("span", { text: `Before: ${change.before || "(empty)"}` }),
              createDomElement("span", { text: `After: ${change.after || "(empty)"}` })
            ]))
            : [createDomElement("div", { className: "deck-structure-step" }, [
              createDomElement("strong", { text: "No shared deck changes" }),
              createDomElement("span", { text: "This candidate keeps shared deck settings untouched." })
            ])];
          const groupedPlanNodes = groupedPlan.map((group) => createDomElement("section", {
            className: "deck-structure-group"
          }, [
            createDomElement("div", { className: "deck-structure-group-head" }, [
              createDomElement("strong", { text: group.label }),
              createDomElement("span", { text: `${group.items.length} slide${group.items.length === 1 ? "" : "s"}` })
            ]),
            createDomElement("div", { className: "deck-structure-group-items" }, group.items.map((slide: DeckStructurePlanStep) => deckStructureStep([
              createDomElement("strong", { text: planStepTitle(slide) }),
              createDomElement("span", { text: `Current: ${slide.currentIndex || "?"}. ${slide.currentTitle || "Untitled"}` }),
              createDomElement("span", { text: slide.summary || slide.rationale || "" })
            ])))
          ]));
          const diffFileNodes = diffFiles.length
            ? diffFiles.map((file: DiffFile) => deckStructureStep([
              createDomElement("strong", { text: file.targetPath || "slides/(pending)" }),
              deckStructurePill((file.changeKinds || []).join(" + ") || "change"),
              createDomElement("span", { text: `Before: ${file.before || "(none)"}` }),
              createDomElement("span", { text: `After: ${file.after || "(none)"}` }),
              createDomElement("span", { text: file.note || "" })
            ]))
            : [deckStructureStep([
              createDomElement("strong", { text: "No file-level changes" }),
              createDomElement("span", { text: "This candidate keeps the current file set untouched." })
            ])];
          const outlineLineNodes = outlineLines.map((line, lineIndex) => outlineLine(`${lineIndex + 1}.`, line));
          const fullPlanNodes = plan.map((slide: DeckStructurePlanStep) => deckStructureStep([
            createDomElement("strong", { text: planStepTitle(slide) }),
            deckStructurePill(slide.action || "keep"),
            createDomElement("span", { text: slide.role || "Role" }),
            createDomElement("span", { text: `Current: ${slide.currentIndex || "?"}. ${slide.currentTitle || "Untitled"}` }),
            createDomElement("span", { text: slide.summary || "" }),
            createDomElement("span", { text: slide.rationale || "" })
          ]));
          const planDetails = createDomElement("details", { className: "deck-plan-details" }, [
            createDomElement("summary", { text: "Plan details" }),
            createDomElement("div", { className: "compare-stats" }, [
              stat((diff.counts && diff.counts.beforeSlides) || currentSequence.length, "slides before"),
              stat((diff.counts && diff.counts.afterSlides) || proposedSequence.length, "slides after"),
              stat(diffFiles.length, `file target${diffFiles.length === 1 ? "" : "s"}`)
            ]),
            deckStructurePlan(sharedDeckChangeNodes),
            deckStructurePlan(groupedPlanNodes),
            deckStructurePlan(diffFileNodes),
            createDomElement("div", { className: "deck-structure-outline" }, [
              outlineLine("Current live deck", currentSequence.map((slide: SequenceEntry) => `${slide.index}. ${slide.title}`).join(" / ") || "No current sequence"),
              outlineLine("Proposed live deck", proposedSequence.map((slide: SequenceEntry) => `${slide.index}. ${slide.title}`).join(" / ") || "No proposed sequence")
            ]),
            createDomElement("div", { className: "deck-structure-outline" }, outlineLineNodes),
            deckStructurePlan(fullPlanNodes)
          ]);
          const selectedDetails = createDomElement("div");
          selectedDetails.append(planDetails);
          const selectedPrefix = [
            renderDeckDiffSupport(deckDiffSupport),
            stripCompare,
            previewHintList,
            selectedOutline,
            sharedSettingsOption
          ].filter((node): node is HTMLElement => Boolean(node));
          selectedDetails.prepend(...selectedPrefix);
          cardChildren.push(selectedDetails);
        }

        cardChildren.push(createDomElement("div", { className: "variant-actions" }, [
          createDomElement("button", {
            attributes: { type: "button" },
            className: "secondary",
            dataset: { action: "inspect" },
            text: isSelected ? "Refresh view" : "Inspect"
          }),
          createDomElement("button", {
            attributes: { type: "button" },
            dataset: { action: "apply" },
            text: "Apply plan"
          })
        ]));
        card.replaceChildren(...cardChildren);
    
        card.querySelector<HTMLButtonElement>("[data-action=\"inspect\"]")?.addEventListener("click", () => {
          state.selectedDeckStructureId = candidate.id;
          elements.operationStatus.textContent = `Inspecting deck plan candidate ${candidate.label}.`;
          renderDeckStructureCandidates();
        });
    
        const sharedSettingsToggle = card.querySelector("[data-action=\"toggle-shared-settings\"]");
        if (sharedSettingsToggle) {
          sharedSettingsToggle.addEventListener("change", (event) => {
            const target = event.currentTarget;
            state.ui.deckPlanApplySharedSettings[candidate.id] = target instanceof HTMLInputElement && target.checked;
          });
        }
    
        const applyButton = card.querySelector<HTMLButtonElement>("[data-action=\"apply\"]");
        applyButton?.addEventListener("click", async () => {
          const done = setBusy(applyButton, "Applying...");
          try {
            await applyDeckStructureCandidate(candidate);
          } catch (error: unknown) {
            window.alert(errorMessage(error));
          } finally {
            done();
          }
        });
    
        elements.deckStructureList.appendChild(card);
      });
    }
    
    function renderSources(): void {
      if (!elements.sourceList) {
        return;
      }
    
      const sources = Array.isArray(state.sources) ? state.sources : [];
      if (!sources.length) {
        elements.sourceList.replaceChildren(createDomElement("div", { className: "source-empty" }, [
          createDomElement("strong", { text: "No sources yet" }),
          createDomElement("span", { text: "Add notes, excerpts, or URLs so generation can retrieve grounded material." })
        ]));
        return;
      }
    
      elements.sourceList.replaceChildren();
      sources.forEach((source: SourceRecord) => {
        const button = createDomElement("button", {
          attributes: {
            type: "button"
          },
          className: "secondary",
          text: "Remove"
        }) as HTMLButtonElement;
        const item = createDomElement("article", { className: "source-card" }, [
          createDomElement("div", { className: "source-card-copy" }, [
            createDomElement("strong", { text: source.title || "Source" }),
            createDomElement("span", { text: source.url || `${source.wordCount || 0} words, ${source.chunkCount || 0} chunks` }),
            createDomElement("p", { text: source.preview || "No preview available." })
          ]),
          button
        ]);
        button.addEventListener("click", () => deleteSource(source, button).catch((error: unknown) => window.alert(errorMessage(error))));
        elements.sourceList.appendChild(item);
      });
    }
    
    function countOutlinePlanSlides(plan: OutlinePlan): number {
      const sections: OutlinePlanSection[] = Array.isArray(plan.sections) ? plan.sections : [];
      return sections
        .reduce((count: number, section: OutlinePlanSection) => count + (Array.isArray(section.slides) ? section.slides.length : 0), 0);
    }
    
    function renderOutlinePlanComparison(plan: OutlinePlan): HTMLElement {
      const currentSlides = Array.isArray(state.slides) ? state.slides : [];
      const sections: OutlinePlanSection[] = Array.isArray(plan.sections) ? plan.sections : [];
    
      if (!sections.length) {
        return createDomElement("div", {
          className: "outline-plan-compare-empty",
          text: "No sections saved in this plan."
        });
      }
    
      const currentSequence = currentSlides
        .map((slide: StudioSlide) => `${slide.index}. ${slide.title || slide.id}`)
        .join(" | ");
      const detailLine = (label: string, value: unknown): HTMLElement => createDomElement("p", {}, [
        createDomElement("strong", { text: label }),
        createDomElement("span", { text: value })
      ]);
      const sectionNodes = sections.map((section: OutlinePlanSection, sectionIndex: number) => {
        const slides = Array.isArray(section.slides) ? section.slides : [];
        const slideNodes = slides.length
          ? slides.map((slide: OutlinePlanSlide, slideIndex: number) => {
            const currentSlide = slide.sourceSlideId
              ? currentSlides.find((entry: StudioSlide) => entry.id === slide.sourceSlideId)
              : currentSlides[slideIndex];
            const currentTitle = currentSlide
              ? `${currentSlide.index}. ${currentSlide.title}`
              : "New or unmatched";
            return createDomElement("details", { className: "outline-plan-compare-slide" }, [
              createDomElement("summary", {}, [
                createDomElement("strong", { text: slide.workingTitle || `Slide ${slideIndex + 1}` }),
                createDomElement("span", { text: currentTitle })
              ]),
              createDomElement("div", {}, [
                detailLine("Intent", slide.intent || "No slide intent saved."),
                detailLine("Must include", (slide.mustInclude || []).join(" / ") || "None"),
                detailLine("Layout hint", slide.layoutHint || "None")
              ])
            ]);
          })
          : [createDomElement("div", {
            className: "outline-plan-compare-empty",
            text: "No slide intents in this section."
          })];
        return createDomElement("section", { className: "outline-plan-compare-section" }, [
          createDomElement("div", { className: "outline-plan-compare-section-head" }, [
            createDomElement("strong", { text: section.title || `Section ${sectionIndex + 1}` }),
            createDomElement("span", { text: section.intent || "No section intent saved." })
          ]),
          createDomElement("div", { className: "outline-plan-compare-slides" }, slideNodes)
        ]);
      });

      return createDomElement("div", { className: "outline-plan-compare" }, [
        createDomElement("div", { className: "outline-plan-current-sequence" }, [
          createDomElement("strong", { text: "Current deck" }),
          createDomElement("span", { text: currentSequence || "No active slides." })
        ]),
        ...sectionNodes
      ]);
    }
    
    function renderOutlinePlans(): void {
      if (!elements.outlinePlanList) {
        return;
      }
    
      const plans = Array.isArray(state.outlinePlans) ? state.outlinePlans : [];
      if (!plans.length) {
        elements.outlinePlanList.replaceChildren(createDomElement("div", { className: "source-empty" }, [
          createDomElement("strong", { text: "No outline plans yet" }),
          createDomElement("span", { text: "Generate one from the active deck when you want a reusable narrative plan." })
        ]));
        return;
      }
    
      elements.outlinePlanList.replaceChildren();
      plans.forEach((plan: OutlinePlan) => {
        const sectionCount = Array.isArray(plan.sections) ? plan.sections.length : 0;
        const slideCount = countOutlinePlanSlides(plan);
        const deriveButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-derive-button", text: "Derive deck" }) as HTMLButtonElement;
        const stageButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-stage-button", text: "Live draft" }) as HTMLButtonElement;
        const proposeButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-propose-button", text: "Propose changes" }) as HTMLButtonElement;
        const duplicateButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-duplicate-button", text: "Duplicate" }) as HTMLButtonElement;
        const saveButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-save-button", text: "Save" }) as HTMLButtonElement;
        const archiveButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-archive-button", text: "Archive" }) as HTMLButtonElement;
        const deleteButton = createDomElement("button", { attributes: { type: "button" }, className: "secondary outline-plan-delete-button", text: "Delete" }) as HTMLButtonElement;
        const comparison = renderOutlinePlanComparison(plan);
        const textarea = createDomElement("textarea", {
          attributes: {
            spellcheck: "false"
          },
          className: "outline-plan-json"
        }) as HTMLTextAreaElement;
        textarea.value = JSON.stringify(plan, null, 2);
        const item = createDomElement("article", { className: "outline-plan-card" }, [
          createDomElement("div", { className: "outline-plan-card__header" }, [
            createDomElement("div", {}, [
              createDomElement("strong", { text: plan.name || "Outline plan" }),
              createDomElement("span", { text: [`${sectionCount} section${sectionCount === 1 ? "" : "s"}`, `${slideCount} slide intent${slideCount === 1 ? "" : "s"}`].join(" | ") })
            ]),
            createDomElement("div", { className: "button-row compact" }, [
              deriveButton,
              stageButton,
              proposeButton,
              duplicateButton,
              saveButton,
              archiveButton,
              deleteButton
            ])
          ]),
          createDomElement("p", { text: plan.purpose || plan.objective || "No purpose saved." }),
          createDomElement("details", {}, [
            createDomElement("summary", { text: "Compare with current deck" }),
            comparison
          ]),
          createDomElement("details", {}, [
            createDomElement("summary", { text: "Edit structured plan" }),
            textarea
          ])
        ]);
    
        deriveButton.addEventListener("click", () => deriveOutlinePlan(plan, deriveButton).catch((error: unknown) => window.alert(errorMessage(error))));
        stageButton.addEventListener("click", () => stageOutlinePlanCreation(plan, stageButton).catch((error: unknown) => window.alert(errorMessage(error))));
        proposeButton.addEventListener("click", () => proposeOutlinePlanChanges(plan, proposeButton).catch((error: unknown) => window.alert(errorMessage(error))));
        duplicateButton.addEventListener("click", () => duplicateOutlinePlan(plan, duplicateButton).catch((error: unknown) => window.alert(errorMessage(error))));
        saveButton.addEventListener("click", () => saveOutlinePlanJson(textarea, saveButton).catch((error: unknown) => window.alert(errorMessage(error))));
        archiveButton.addEventListener("click", () => archiveOutlinePlan(plan, archiveButton).catch((error: unknown) => window.alert(errorMessage(error))));
        deleteButton.addEventListener("click", () => deleteOutlinePlan(plan, deleteButton).catch((error: unknown) => window.alert(errorMessage(error))));
        elements.outlinePlanList.appendChild(item);
      });
    }
    
    async function generateOutlinePlan(): Promise<void> {
      const done = setBusy(elements.generateOutlinePlanButton, "Generating...");
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/generate", {
          method: "POST",
          body: JSON.stringify({
            name: `${elements.deckTitle.value || "Current deck"} outline plan`,
            purpose: elements.deckObjective.value,
            targetSlideCount: state.slides.length || undefined
          })
        });
        state.outlinePlans = payload.outlinePlans || state.outlinePlans;
        renderOutlinePlans();
        elements.operationStatus.textContent = `Generated outline plan "${payload.outlinePlan?.name || "Outline plan"}".`;
      } finally {
        done();
      }
    }
    
    async function saveOutlinePlanJson(textarea: HTMLTextAreaElement, button: HTMLButtonElement | null = null): Promise<void> {
      let outlinePlan: unknown = null;
      try {
        outlinePlan = JSON.parse(textarea.value);
      } catch (error) {
        throw new Error("Outline plan JSON is invalid.");
      }
    
      const done = button ? setBusy(button, "Saving...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans", {
          method: "POST",
          body: JSON.stringify({ outlinePlan })
        });
        state.outlinePlans = payload.outlinePlans || state.outlinePlans;
        renderOutlinePlans();
        elements.operationStatus.textContent = `Saved outline plan "${payload.outlinePlan?.name || "Outline plan"}".`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function deriveOutlinePlan(plan: OutlinePlan, button: HTMLButtonElement | null = null): Promise<void> {
      const title = window.prompt("Derived presentation title", `${plan.name || "Outline plan"} deck`);
      if (!title) {
        return;
      }
      const copySources = window.confirm("Copy active source records into the derived deck?");
      const copyMaterials = window.confirm("Copy active image materials into the derived deck?");
    
      const done = button ? setBusy(button, "Deriving...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/derive", {
          method: "POST",
          body: JSON.stringify({
            copyDeckContext: true,
            copyMaterials,
            copySources,
            copyTheme: true,
            planId: plan.id,
            title
          })
        });
        state.outlinePlans = payload.outlinePlans || [];
        state.presentations = payload.presentations || state.presentations;
        state.context = payload.context || state.context;
        state.slides = payload.slides || state.slides;
        setDomPreviewState(payload);
        presentationLibrary.resetSelection();
        await refreshState();
        setCurrentPage("studio");
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function stageOutlinePlanCreation(plan: OutlinePlan, button: HTMLButtonElement | null = null): Promise<void> {
      const title = window.prompt("Live-generated presentation title", `${plan.name || "Outline plan"} deck`);
      if (!title) {
        return;
      }
      const copySources = window.confirm("Use compact source text from the current deck during live generation?");
    
      const done = button ? setBusy(button, "Staging...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/stage-creation", {
          method: "POST",
          body: JSON.stringify({
            copyDeckContext: true,
            copySources,
            copyTheme: true,
            planId: plan.id,
            title
          })
        });
        state.creationDraft = payload.creationDraft || state.creationDraft;
        if (state.creationDraft && state.creationDraft.fields) {
          presentationCreationWorkbench.applyFields(state.creationDraft.fields);
          state.ui.creationStage = presentationCreationWorkbench.normalizeStage(state.creationDraft.stage || "content");
        }
        state.runtime = payload.runtime || state.runtime;
        setCurrentPage("presentations");
        renderCreationDraft();
        renderStatus();
        elements.presentationCreationStatus.textContent = `Staged "${plan.name}" for live slide generation.`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function proposeOutlinePlanChanges(plan: OutlinePlan, button: HTMLButtonElement | null = null): Promise<void> {
      const done = button ? setBusy(button, "Proposing...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/propose", {
          method: "POST",
          body: JSON.stringify({ planId: plan.id })
        });
        setDeckStructureCandidates(payload.deckStructureCandidates);
        state.runtime = payload.runtime || state.runtime;
        renderDeckStructureCandidates();
        renderStatus();
        elements.operationStatus.textContent = payload.summary || `Proposed current-deck changes from "${plan.name}".`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function duplicateOutlinePlan(plan: OutlinePlan, button: HTMLButtonElement | null = null): Promise<void> {
      const name = window.prompt("Duplicate outline plan name", `${plan.name || "Outline plan"} copy`);
      if (!name) {
        return;
      }
    
      const done = button ? setBusy(button, "Duplicating...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/duplicate", {
          method: "POST",
          body: JSON.stringify({
            name,
            planId: plan.id
          })
        });
        state.outlinePlans = payload.outlinePlans || state.outlinePlans;
        renderOutlinePlans();
        elements.operationStatus.textContent = `Duplicated outline plan "${payload.outlinePlan?.name || "Outline plan"}".`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function archiveOutlinePlan(plan: OutlinePlan, button: HTMLButtonElement | null = null): Promise<void> {
      const confirmed = window.confirm(`Archive outline plan "${plan.name || plan.id}"?`);
      if (!confirmed) {
        return;
      }
    
      const done = button ? setBusy(button, "Archiving...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/archive", {
          method: "POST",
          body: JSON.stringify({ planId: plan.id })
        });
        state.outlinePlans = payload.outlinePlans || [];
        renderOutlinePlans();
        elements.operationStatus.textContent = `Archived outline plan "${plan.name || plan.id}".`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function deleteOutlinePlan(plan: OutlinePlan, button: HTMLButtonElement | null = null): Promise<void> {
      const confirmed = window.confirm(`Delete outline plan "${plan.name || plan.id}"?`);
      if (!confirmed) {
        return;
      }
    
      const done = button ? setBusy(button, "Deleting...") : null;
      try {
        const payload = await request<OutlinePlanPayload>("/api/outline-plans/delete", {
          method: "POST",
          body: JSON.stringify({ planId: plan.id })
        });
        state.outlinePlans = payload.outlinePlans || [];
        renderOutlinePlans();
        elements.operationStatus.textContent = `Deleted outline plan "${plan.name || plan.id}".`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    async function addSource(): Promise<void> {
      const title = elements.sourceTitle.value.trim();
      const url = elements.sourceUrl.value.trim();
      const text = elements.sourceText.value.trim();
    
      if (!url && !text) {
        window.alert("Add source text or a URL.");
        elements.sourceText.focus();
        return;
      }
    
      const done = setBusy(elements.addSourceButton, "Adding...");
      try {
        const payload = await request<SourcePayload>("/api/sources", {
          body: JSON.stringify({
            text,
            title,
            url
          }),
          method: "POST"
        });
    
        state.runtime = payload.runtime || state.runtime;
        state.sources = payload.sources || state.sources;
        elements.sourceTitle.value = "";
        elements.sourceUrl.value = "";
        elements.sourceText.value = "";
        renderSources();
        renderStatus();
        elements.operationStatus.textContent = `Added source ${payload.source?.title || "Source"}.`;
      } finally {
        done();
      }
    }
    
    async function deleteSource(source: SourceRecord, button: HTMLButtonElement | null = null): Promise<void> {
      if (!source || !source.id) {
        return;
      }
    
      const done = button ? setBusy(button, "Removing...") : null;
      try {
        const payload = await request<SourcePayload>("/api/sources/delete", {
          body: JSON.stringify({
            sourceId: source.id
          }),
          method: "POST"
        });
    
        state.runtime = payload.runtime || state.runtime;
        state.sources = payload.sources || [];
        renderSources();
        renderStatus();
        elements.operationStatus.textContent = `Removed source ${source.title || "Source"}.`;
      } finally {
        if (done) {
          done();
        }
      }
    }
    
    function applyDeckLengthPayload(payload: DeckLengthPayload): void {
      state.context = payload.context || state.context;
      if (payload.domPreview) {
        setDomPreviewState(payload);
      }
      state.previews = payload.previews || state.previews;
      state.runtime = payload.runtime || state.runtime;
      state.skippedSlides = payload.skippedSlides || [];
      state.slides = payload.slides || state.slides;
      state.deckLengthPlan = null;
      syncSelectedSlideToActiveList();
      renderDeckFields();
      renderDeckLengthPlan();
      renderStatus();
      renderPreviews();
      renderVariants();
    }
    
    async function planDeckLength(): Promise<void> {
      const targetCount = Number.parseInt(elements.deckLengthTarget.value, 10);
      if (!Number.isFinite(targetCount) || targetCount < 1) {
        window.alert("Set a target slide count of at least 1.");
        elements.deckLengthTarget.focus();
        return;
      }
    
      const done = setBusy(elements.deckLengthPlanButton, "Planning...");
      try {
        const payload = await request<{ plan: DeckLengthPlan }>("/api/deck/scale-length/plan", {
          body: JSON.stringify({
            includeSkippedForRestore: true,
            mode: elements.deckLengthMode.value,
            targetCount
          }),
          method: "POST"
        });
    
        state.deckLengthPlan = payload.plan;
        renderDeckLengthPlan();
        elements.operationStatus.textContent = payload.plan.summary || "Planned deck length changes.";
      } finally {
        done();
      }
    }
    
    async function applyDeckLength(): Promise<void> {
      if (!state.deckLengthPlan || !Array.isArray(state.deckLengthPlan.actions) || !state.deckLengthPlan.actions.length) {
        return;
      }
    
      const done = setBusy(elements.deckLengthApplyButton, "Applying...");
      try {
        const payload = await request<DeckLengthPayload>("/api/deck/scale-length/apply", {
          body: JSON.stringify({
            actions: state.deckLengthPlan.actions,
            mode: state.deckLengthPlan.mode,
            targetCount: state.deckLengthPlan.targetCount
          }),
          method: "POST"
        });
    
        applyDeckLengthPayload(payload);
        const activeCount = payload.lengthProfile?.activeCount || 0;
        elements.operationStatus.textContent = `Scaled deck to ${activeCount} active slide${activeCount === 1 ? "" : "s"}.`;
        if (state.selectedSlideId) {
          await loadSlide(state.selectedSlideId);
          renderDeckLengthPlan();
        }
        setCurrentPage("planning");
      } finally {
        done();
      }
    }
    
    async function restoreSkippedSlides(options: { all?: boolean; slideId?: string } = {}): Promise<void> {
      const done = setBusy(elements.deckLengthPlanButton, "Restoring...");
      try {
        const payload = await request<DeckLengthPayload>("/api/slides/restore-skipped", {
          body: JSON.stringify(options || {}),
          method: "POST"
        });
    
        applyDeckLengthPayload(payload);
        elements.operationStatus.textContent = `Restored ${payload.restoredSlides || 0} skipped slide${payload.restoredSlides === 1 ? "" : "s"}.`;
        if (state.selectedSlideId) {
          await loadSlide(state.selectedSlideId);
          renderDeckLengthPlan();
        }
        setCurrentPage("planning");
      } finally {
        done();
      }
    }
    
    async function applyDeckStructureCandidate(candidate: DeckStructureCandidate): Promise<void> {
      const applySharedSettings = state.ui.deckPlanApplySharedSettings[candidate.id] !== false;
      const payload = await request<DeckStructureApplyPayload>("/api/context/deck-structure/apply", {
        body: JSON.stringify({
          applyDeckPatch: applySharedSettings,
          deckPatch: applySharedSettings ? candidate.deckPatch : null,
          label: candidate.label,
          outline: candidate.outline,
          promoteInsertions: true,
          promoteIndices: true,
          promoteRemovals: true,
          promoteReplacements: true,
          promoteTitles: true,
          slides: candidate.slides,
          summary: candidate.summary
        }),
        method: "POST"
      });
    
      elements.operationStatus.textContent = `Applied deck plan candidate ${candidate.label} to the saved outline, slide plan, ${payload.insertedSlides || 0} inserted slide${payload.insertedSlides === 1 ? "" : "s"}, ${payload.replacedSlides || 0} replaced slide${payload.replacedSlides === 1 ? "" : "s"}, ${payload.removedSlides || 0} archived slide${payload.removedSlides === 1 ? "" : "s"}, ${payload.indexUpdates || 0} slide order change${payload.indexUpdates === 1 ? "" : "s"}, ${payload.titleUpdates || 0} slide title${payload.titleUpdates === 1 ? "" : "s"}${payload.sharedDeckUpdates ? `, and ${payload.sharedDeckUpdates} shared deck setting${payload.sharedDeckUpdates === 1 ? "" : "s"}` : ""}.`;
      await refreshState();
    }

    function mount(): void {
      elements.deckLengthPlanButton.addEventListener("click", () => planDeckLength().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.deckLengthApplyButton.addEventListener("click", () => applyDeckLength().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.addSourceButton.addEventListener("click", () => addSource().catch((error: unknown) => windowRef.alert(errorMessage(error))));
      elements.generateOutlinePlanButton.addEventListener("click", () => generateOutlinePlan().catch((error: unknown) => windowRef.alert(errorMessage(error))));
    }

    return {
      mount,
      renderDeckLengthPlan,
      renderDeckStructureCandidates,
      renderOutlinePlans,
      renderSources,
      setDeckStructureCandidates
    };
  }
}
