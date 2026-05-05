import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import { StudioClientWorkflowStatus } from "../runtime/workflow-status.ts";
import {
  buildSourceDiffRows,
  buildStructuredComparison,
  buildVariantDecisionSupport,
  summarizeDiff,
  type DecisionSupport,
  type DiffHighlight,
  type SourceDiffRow,
  type StructuredChange,
  type StructuredGroupDetail
} from "./variant-comparison-model.ts";
import { StudioClientVariantGenerationControls } from "./variant-generation-controls.ts";
import { StudioClientVariantState } from "./variant-state.ts";

export namespace StudioClientVariantReviewWorkbench {
  type JsonRecord = StudioClientState.JsonRecord;
  type BusyElement = HTMLElement & {
    disabled: boolean;
  };
  type DomElementOptions = {
    attributes?: Record<string, string | number | boolean>;
    className?: string;
    dataset?: Record<string, string | number | boolean>;
    disabled?: boolean;
    text?: unknown;
  };
  type DomElementChild = HTMLElement | string;
  type CreateDomElement = (tag: string, options?: DomElementOptions, children?: DomElementChild[]) => HTMLElement;
  type VariantRecord = StudioClientState.VariantRecord & {
    changeSummary?: string[];
    changeScope?: string;
    createdAt?: string;
    generator?: string;
    kind?: string;
    layoutDefinition?: JsonRecord & {
      regions?: unknown[];
      slots?: unknown[];
      type?: string;
    };
    layoutPreview?: JsonRecord & {
      currentSlideValidation?: JsonRecord & {
        ok?: boolean;
        state?: string;
      };
      mode?: string;
      state?: string;
    };
    notes?: string;
    operation?: string;
    operationScope?: SelectionScope;
    persisted?: boolean;
    promptSummary?: string;
    remediationStrategy?: string;
    source?: string;
    sourceIssues?: JsonRecord[];
  };
  type SelectionEntry = {
    fieldHash?: string;
    fieldPath?: Array<number | string>;
    path?: Array<number | string> | string;
  };
  type SelectionScope = SelectionEntry & {
    allowFamilyChange?: boolean;
    kind?: string;
    scopeLabel?: string;
    selections?: SelectionEntry[];
  };
  type CaptureVariantBody = {
    label: string;
    slideId: string;
    slideSpec?: unknown;
  };

  type ApplyVariantOptions = {
    label?: string;
    validateAfter?: boolean;
  };
  type RequestPayload = {
    context?: StudioClientState.DeckContext;
    domPreview?: unknown;
    favoriteLayout?: { name?: string };
    favoriteLayouts?: StudioClientState.SavedLayout[];
    layout?: { name?: string };
    layouts?: StudioClientState.SavedLayout[];
    previews?: StudioClientState.State["previews"];
    slideId?: string;
    variant?: VariantRecord;
    variants?: VariantRecord[];
    variantStorage?: unknown;
  };
  type Request = <TResponse = RequestPayload>(url: string, options?: RequestInit) => Promise<TResponse>;
  export type VariantReviewWorkbenchOptions = {
    createDomElement: CreateDomElement;
    customLayoutWorkbench: {
      renderLibrary: () => void;
    };
    elements: StudioClientElements.Elements;
    formatSourceCodeNodes: (source: unknown, format?: string) => DomElementChild[];
    getSlideSpecPathValue: (slideSpec: unknown, path: Array<number | string>) => unknown;
    getVariantVisualTheme: (variant: VariantRecord) => unknown;
    hashFieldValue: (value: unknown) => string;
    loadSlide: (slideId: string) => Promise<void>;
    parseSlideSpecEditor: () => unknown;
    pathToString: (path: Array<number | string>) => string;
    renderPreviews: () => void;
    request: Request;
    setBusy: (button: BusyElement, label: string) => () => void;
    setDomPreviewState: (payload: RequestPayload) => void;
    state: StudioClientState.State;
    validate: (showPage: boolean) => Promise<void>;
    windowRef: Window;
  };

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function isRecord(value: unknown): value is JsonRecord {
    return StudioClientVariantState.isRecord(value);
  }

  function toVariant(value: StudioClientState.VariantRecord | JsonRecord): VariantRecord {
    return StudioClientVariantState.toVariant(value);
  }

  function normalizePath(path: SelectionEntry["path"] | SelectionEntry["fieldPath"]): Array<number | string> {
    if (Array.isArray(path)) {
      return path;
    }
    return String(path || "")
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => Number.isInteger(Number(segment)) ? Number(segment) : segment);
  }

  function eventTargetButton(target: EventTarget | null): HTMLElement | null {
    return target instanceof Element ? target.closest("button") : null;
  }

  export function createVariantReviewWorkbench(deps: VariantReviewWorkbenchOptions) {
    const {
      createDomElement,
      customLayoutWorkbench,
      elements,
      formatSourceCodeNodes,
      getSlideSpecPathValue,
      getVariantVisualTheme,
      hashFieldValue,
      loadSlide,
      parseSlideSpecEditor,
      pathToString,
      renderPreviews,
      request,
      setBusy,
      setDomPreviewState,
      state,
      validate,
      windowRef
    } = deps;

    function getSlideVariants(): VariantRecord[] {
      return StudioClientVariantState.getSlideVariants(state).map(toVariant);
    }

    function getSelectedVariant(): VariantRecord | null {
      const variant = StudioClientVariantState.getSelectedVariant(state);
      return variant ? toVariant(variant) : null;
    }

    function clearTransientVariants(slideId: string): void {
      StudioClientVariantState.clearTransientVariants(state, slideId);
    }

    function replacePersistedVariantsForSlide(slideId: string, variants: unknown): void {
      StudioClientVariantState.replacePersistedVariantsForSlide(state, slideId, variants);
    }

    function openGenerationControls(): void {
      StudioClientVariantGenerationControls.open(windowRef.document);
    }

    function renderVariantDecisionSupport(decisionSupport: DecisionSupport): HTMLElement {
      const formattedDelta = decisionSupport.wordDelta === null
        ? "n/a"
        : decisionSupport.wordDelta > 0
          ? `+${decisionSupport.wordDelta}`
          : String(decisionSupport.wordDelta);
      const focusItems = decisionSupport.focusItems.slice(0, 5);

      const focus = focusItems.length
        ? createDomElement("div", {
          attributes: { "aria-label": "Review focus" },
          className: "compare-decision-focus"
        }, focusItems.map((item: { label: string; value: string }) => createDomElement("span", {
          className: "compare-decision-chip"
        }, [
          createDomElement("strong", { text: item.label }),
          ` ${item.value}`
        ])))
        : null;

      return createDomElement("section", { className: "compare-decision-panel" }, [
        createDomElement("div", { className: "compare-decision-head" }, [
          createDomElement("div", {}, [
            createDomElement("p", { className: "eyebrow", text: "Decision support" }),
            createDomElement("strong", { text: `${decisionSupport.scale} candidate change` })
          ]),
          createDomElement("div", { className: "compare-decision-metrics" }, [
            createDomElement("span", {}, [
              createDomElement("strong", { text: decisionSupport.fieldChanges }),
              ` field${decisionSupport.fieldChanges === 1 ? "" : "s"}`
            ]),
            createDomElement("span", {}, [
              createDomElement("strong", { text: decisionSupport.contentAreas }),
              ` area${decisionSupport.contentAreas === 1 ? "" : "s"}`
            ]),
            createDomElement("span", {}, [
              createDomElement("strong", { text: formattedDelta }),
              " words"
            ])
          ])
        ]),
        ...(focus ? [focus] : []),
        createDomElement("div", { className: "compare-decision-cues" },
          decisionSupport.cues.map((cue: string) => createDomElement("p", { text: cue })))
      ]);
    }

    function serializeJsonValue(value: unknown): string {
      return JSON.stringify(value, null, 2);
    }

    function getCurrentComparisonSource(): string {
      if (state.selectedSlideStructured && state.selectedSlideSpec) {
        return serializeJsonValue(state.selectedSlideSpec);
      }

      return state.selectedSlideSource || "";
    }

    function getVariantComparisonSource(variant: VariantRecord | null): string {
      if (variant && variant.slideSpec) {
        return serializeJsonValue(variant.slideSpec);
      }

      return variant && variant.source ? variant.source : "";
    }

    function synchronizeCompareSourceScroll(): void {
      const panes = Array.from(elements.compareSourceGrid.querySelectorAll(".source-lines"))
        .filter((pane): pane is HTMLElement => pane instanceof HTMLElement);
      if (panes.length !== 2) {
        return;
      }

      let syncing = false;

      const syncPane = (source: HTMLElement, target: HTMLElement): void => {
        source.addEventListener("scroll", () => {
          if (syncing) {
            return;
          }

          syncing = true;
          target.scrollTop = source.scrollTop;
          target.scrollLeft = source.scrollLeft;
          syncing = false;
        });
      };

      const firstPane = panes[0];
      const secondPane = panes[1];
      if (firstPane && secondPane) {
        syncPane(firstPane, secondPane);
        syncPane(secondPane, firstPane);
      }
    }

    function canSaveVariantLayout(variant: VariantRecord | null): boolean {
      return Boolean(variant
        && (variant.operation === "redo-layout" || variant.operation === "custom-layout")
        && variant.slideSpec
        && isRecord(variant.slideSpec)
        && variant.slideSpec.type
        && (variant.slideSpec.layout || variant.layoutDefinition));
    }

    function canSaveVariantLayoutAsFavorite(variant: VariantRecord | null): boolean {
      const validation = variant && variant.layoutPreview && variant.layoutPreview.currentSlideValidation;
      return Boolean(variant && canSaveVariantLayout(variant)
        && (variant.operation !== "custom-layout" || (
          variant.layoutPreview
          && variant.layoutPreview.mode === "multi-slide"
          && validation
          && validation.ok === true
        )));
    }

    function describeVariantKind(variant: VariantRecord): string {
      if (variant.operationScope && variant.operationScope.scopeLabel) {
        return `${variant.persisted === false ? "Session " : ""}${variant.operationScope.scopeLabel}`;
      }

      if (variant.kind !== "generated") {
        return "Snapshot";
      }

      const prefix = variant.persisted === false ? "Session " : "";

      if (variant.operation === "drill-wording") {
        return `${prefix}wording pass`;
      }

      if (variant.operation === "ideate-theme") {
        return `${prefix}theme pass`;
      }

      if (variant.operation === "ideate-structure") {
        return `${prefix}content rewrite`;
      }

      if (variant.operation === "redo-layout") {
        return `${prefix}layout pass`;
      }

      if (variant.operation === "custom-layout") {
        return `${prefix}custom layout`;
      }

      if (variant.generator === "llm") {
        return `${prefix}LLM ideate`;
      }

      return `${prefix}local ideate`;
    }

    function getVariantSelectionEntries(variant: VariantRecord | null): SelectionEntry[] {
      const scope = variant && variant.operationScope;
      if (!scope) {
        return [];
      }

      return scope.kind === "selectionGroup" && Array.isArray(scope.selections)
        ? scope.selections
        : [scope];
    }

    function getVariantSelectionStaleReason(variant: VariantRecord): string {
      const entries = getVariantSelectionEntries(variant);
      if (!entries.length || !state.selectedSlideSpec) {
        return "";
      }

      const stale = entries.find((entry: SelectionEntry) => {
        const currentValue = getSlideSpecPathValue(state.selectedSlideSpec, normalizePath(entry.fieldPath || entry.path));
        return currentValue === undefined || (entry.fieldHash && hashFieldValue(currentValue) !== entry.fieldHash);
      });

      return stale
        ? `Selection target changed: ${pathToString(normalizePath(stale.fieldPath || stale.path))}. Regenerate or rebase before applying.`
        : "";
    }

    function renderFlow(): void {
      if (!elements.variantFlow) {
        return;
      }

      const variants = getSlideVariants();
      const selectedVariant = variants.find((variant: VariantRecord) => variant.id === state.selectedVariantId) || null;
      const workflowRunning = StudioClientWorkflowStatus.hasActiveSlideWorkflow(state);
      const currentStep = workflowRunning
        ? "generate"
        : !variants.length
          ? "generate"
          : selectedVariant
            ? "preview"
            : "select";
      const order = ["generate", "select", "preview", "apply"];
      const currentIndex = order.indexOf(currentStep);

      Array.from(elements.variantFlow.querySelectorAll("[data-step]")).forEach((step) => {
        if (!(step instanceof HTMLElement)) {
          return;
        }
        const index = order.indexOf(step.dataset.step || "");
        const stepState = index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "pending";
        step.dataset.state = stepState;
      });
    }

    function render(): void {
      const variants = getSlideVariants();
      const savedCount = variants.filter((variant: VariantRecord) => variant.persisted !== false).length;
      const sessionCount = variants.length - savedCount;
      const generatingVariants = StudioClientWorkflowStatus.hasActiveSlideWorkflow(state);
      const reviewOpen = Boolean(state.ui.variantReviewOpen && variants.length);
      const previousVariantListScrollTop = elements.variantList.scrollTop;
      elements.variantList.replaceChildren();
      elements.variantStorageNote.textContent = savedCount > 0
        ? `${sessionCount} session-only candidate${sessionCount === 1 ? "" : "s"} and ${savedCount} saved snapshot${savedCount === 1 ? "" : "s"} are available for this slide.`
        : variants.length
          ? `${variants.length} session-only candidate${variants.length === 1 ? "" : "s"} available for this slide.`
          : "Generated candidates stay in the current session until one is applied.";

      if (!reviewOpen) {
        elements.variantReviewWorkspace.classList.add("is-empty");
        elements.workflowCompare.hidden = true;
        elements.variantList.replaceChildren(createDomElement("div", { className: "variant-card variant-empty-state" }, [
          createDomElement("strong", { text: generatingVariants ? "Generating candidates" : "No candidates yet" }),
          createDomElement("span", {
            text: generatingVariants
              ? "Waiting for the LLM response. Generated candidates will appear here."
              : "Choose a count, then run a variant action to create session-only options."
          })
        ]));
        renderFlow();
        renderComparison();
        return;
      }

      elements.variantReviewWorkspace.classList.remove("is-empty");
      elements.workflowCompare.hidden = false;

      const selectVariantForComparison = (variant: VariantRecord | null): void => {
        state.selectedVariantId = variant ? variant.id || null : null;
        elements.operationStatus.textContent = variant
          ? `Previewing ${variant.label} in the main slide area.`
          : "Previewing the original slide.";
        renderPreviews();
        render();
      };

      const renderOriginalCard = (): void => {
        const selectedTitle = state.selectedSlideSpec && state.selectedSlideSpec.title || "Current slide";
        const selected = !getSelectedVariant();
        const previewButton = createDomElement("button", {
          className: "secondary",
          dataset: { action: "preview" },
          text: selected ? "Previewing" : "Preview",
          attributes: { type: "button" }
        });
        const card = createDomElement("div", {
          className: `variant-card variant-original-card${selected ? " active" : ""}`,
          attributes: {
            "aria-current": selected ? "true" : "false",
            "aria-label": "Preview original slide"
          }
        }, [
          createDomElement("div", { className: "variant-select-line" }, [
            createDomElement("span", {
              className: "variant-select-mark",
              attributes: { "aria-hidden": "true" }
            }),
            createDomElement("p", { className: "variant-kind", text: "Original" })
          ]),
          createDomElement("strong", { text: selectedTitle }),
          createDomElement("span", { className: "variant-meta", text: "Saved slide" }),
          createDomElement("span", { text: "The current saved slide before applying any candidate." }),
          createDomElement("div", { className: "variant-actions" }, [previewButton])
        ]);
        card.tabIndex = 0;
        const previewOriginal = () => selectVariantForComparison(null);
        card.addEventListener("click", (event: MouseEvent) => {
          if (eventTargetButton(event.target)) {
            return;
          }
          previewOriginal();
        });
        card.addEventListener("keydown", (event: KeyboardEvent) => {
          if (eventTargetButton(event.target)) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            previewOriginal();
          }
        });
        previewButton.addEventListener("click", previewOriginal);
        elements.variantList.appendChild(card);
      };

      renderOriginalCard();

      variants.forEach((variant: VariantRecord) => {
        const selected = variant.id === state.selectedVariantId;
        const kindLabel = describeVariantKind(variant);
        const summary = variant.promptSummary || variant.notes || "No notes";
        const actions = [
          createDomElement("button", {
            className: "secondary",
            dataset: { action: "compare" },
            text: selected ? "Previewing" : "Preview",
            attributes: { type: "button" }
          })
        ];
        if (canSaveVariantLayout(variant)) {
          actions.push(createDomElement("button", {
            className: "secondary",
            dataset: { action: "save-layout" },
            text: "Save layout",
            attributes: { type: "button" }
          }));
          const canSaveFavorite = canSaveVariantLayoutAsFavorite(variant);
          const favoriteAttributes: Record<string, string> = { type: "button" };
          if (!canSaveFavorite) {
            favoriteAttributes.title = "Run a favorite-ready preview first";
          }
          actions.push(createDomElement("button", {
            className: "secondary",
            dataset: { action: "save-favorite-layout" },
            disabled: !canSaveFavorite,
            text: "Save favorite",
            attributes: favoriteAttributes
          }));
        }
        actions.push(createDomElement("button", {
          dataset: { action: "apply" },
          text: "Apply variant",
          attributes: { type: "button" }
        }));

        const card = createDomElement("div", {
          className: `variant-card${selected ? " active" : ""}`,
          attributes: {
            "aria-current": selected ? "true" : "false",
            "aria-label": `Preview ${variant.label}`
          }
        }, [
          createDomElement("div", { className: "variant-select-line" }, [
            createDomElement("span", {
              className: "variant-select-mark",
              attributes: { "aria-hidden": "true" }
            }),
            createDomElement("p", { className: "variant-kind", text: kindLabel })
          ]),
          createDomElement("strong", { text: variant.label }),
          createDomElement("span", { className: "variant-meta", text: new Date(variant.createdAt || Date.now()).toLocaleString() }),
          createDomElement("span", { text: summary }),
          createDomElement("div", { className: "variant-actions" }, actions)
        ]);
        card.tabIndex = 0;

        card.addEventListener("click", (event: MouseEvent) => {
          if (eventTargetButton(event.target)) {
            return;
          }

          selectVariantForComparison(variant);
        });

        card.addEventListener("keydown", (event: KeyboardEvent) => {
          if (eventTargetButton(event.target)) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectVariantForComparison(variant);
          }
        });

        const compareButton = card.querySelector("[data-action=\"compare\"]");
        if (compareButton) {
          compareButton.addEventListener("click", () => {
            selectVariantForComparison(variant);
          });
        }

        const saveLayoutButton = card.querySelector("[data-action=\"save-layout\"]");
        if (saveLayoutButton instanceof HTMLButtonElement) {
          saveLayoutButton.addEventListener("click", () => saveVariantLayout(variant, false, saveLayoutButton).catch((error) => windowRef.alert(errorMessage(error))));
        }

        const saveFavoriteLayoutButton = card.querySelector("[data-action=\"save-favorite-layout\"]");
        if (saveFavoriteLayoutButton instanceof HTMLButtonElement) {
          saveFavoriteLayoutButton.addEventListener("click", () => saveVariantLayout(variant, true, saveFavoriteLayoutButton).catch((error) => windowRef.alert(errorMessage(error))));
        }

        const applyButton = card.querySelector("[data-action=\"apply\"]");
        if (!(applyButton instanceof HTMLButtonElement)) {
          return;
        }
        applyButton.addEventListener("click", async () => {
          const done = setBusy(applyButton, "Applying...");
          try {
            await applyVariantById(variant.id, {
              ...(variant.label ? { label: variant.label } : {}),
              validateAfter: false
            });
          } catch (error) {
            windowRef.alert(errorMessage(error));
          } finally {
            done();
          }
        });

        elements.variantList.appendChild(card);
      });

      renderFlow();
      renderComparison();
      elements.variantList.scrollTop = previousVariantListScrollTop;
    }

    function renderComparison(): void {
      const variant = getSelectedVariant();
      if (!variant) {
        elements.compareEmpty.hidden = false;
        elements.compareSummary.hidden = true;
        elements.compareApplyButton.disabled = true;
        elements.compareApplyValidateButton.disabled = true;
        return;
      }

      const currentComparisonSource = getCurrentComparisonSource();
      const variantComparisonSource = getVariantComparisonSource(variant);
      const variantVisualTheme = getVariantVisualTheme(variant);
      const diff = summarizeDiff(currentComparisonSource, variantComparisonSource);
      const sourceRows = buildSourceDiffRows(currentComparisonSource, variantComparisonSource);
      const structuredComparison = state.selectedSlideStructured && isRecord(variant.slideSpec)
        ? buildStructuredComparison(state.selectedSlideSpec, variant.slideSpec)
        : null;
      const decisionSupport = buildVariantDecisionSupport(
        state.selectedSlideSpec,
        isRecord(variant.slideSpec) ? variant.slideSpec : undefined,
        structuredComparison,
        diff
      );
      const beforeSourceFormat = state.selectedSlideStructured ? "json" : "plain";
      const afterSourceFormat = variant.slideSpec ? "json" : "plain";
      const compareSummaryItems = Array.isArray(variant.changeSummary) && variant.changeSummary.length
        ? variant.changeSummary.slice()
        : [variant.promptSummary || variant.notes || "No change summary available."];
      const staleSelectionReason = getVariantSelectionStaleReason(variant);

      if (staleSelectionReason) {
        compareSummaryItems.unshift(staleSelectionReason);
      }

      if (structuredComparison && structuredComparison.summaryLines.length) {
        compareSummaryItems.push(...structuredComparison.summaryLines);
      }

      if (variant.layoutDefinition) {
        const slots = Array.isArray(variant.layoutDefinition.slots) ? variant.layoutDefinition.slots.length : 0;
        const regions = Array.isArray(variant.layoutDefinition.regions) ? variant.layoutDefinition.regions.length : 0;
        compareSummaryItems.push(`Layout definition: ${variant.layoutDefinition.type || "generated"}${slots || regions ? ` with ${slots} slots and ${regions} regions` : ""}.`);
      }
      if (variant.layoutPreview && variant.layoutPreview.mode) {
        compareSummaryItems.push(`Preview state: ${variant.layoutPreview.mode === "multi-slide" ? "favorite-ready multi-slide" : "current slide"}.`);
        if (variant.layoutPreview.currentSlideValidation && variant.layoutPreview.currentSlideValidation.state) {
          compareSummaryItems.push(`Current-slide validation: ${String(variant.layoutPreview.currentSlideValidation.state).replace(/-/g, " ")}.`);
        }
      }
      if (Array.isArray(variant.sourceIssues) && variant.sourceIssues.length) {
        const issueLabels = variant.sourceIssues
          .map((issue) => String(issue.rule || issue.message || "check").trim())
          .filter(Boolean);
        compareSummaryItems.push(`Remediates ${issueLabels.join(", ")}.`);
      }

      elements.compareEmpty.hidden = true;
      elements.compareSummary.hidden = false;

      const stat = (value: unknown, label: string): HTMLElement => createDomElement("span", { className: "compare-stat" }, [
        createDomElement("strong", { text: value }),
        ` ${label}`
      ]);
      const compareStats = [
        stat(variant.persisted === false ? "session-only" : "saved", "variant mode"),
        stat(variant.generator || "manual", "generator"),
        structuredComparison ? stat(structuredComparison.totalChanges, "structured changes") : null,
        structuredComparison ? stat(structuredComparison.groups.length, "content areas") : null,
        variantVisualTheme ? stat("visual", "theme") : null,
        variant.layoutDefinition ? stat(variant.layoutDefinition.type || "layout", "definition") : null,
        variant.layoutPreview && variant.layoutPreview.state ? stat(variant.layoutPreview.state, "preview") : null,
        variant.operationScope && variant.operationScope.scopeLabel ? stat(variant.operationScope.scopeLabel, "scope") : null,
        variant.operationScope && variant.operationScope.allowFamilyChange ? stat("family", "change") : null,
        variant.remediationStrategy ? stat(variant.remediationStrategy, "repair") : null,
        variant.changeScope ? stat(variant.changeScope, "scope") : null,
        stat(diff.changed, "changed lines"),
        stat(diff.added, "added lines"),
        stat(diff.removed, "removed lines")
      ].filter((entry): entry is HTMLElement => Boolean(entry));
      elements.compareStats.replaceChildren(...compareStats);
      elements.compareChangeSummary.replaceChildren(...compareSummaryItems
        .map((item: string) => createDomElement("p", { className: "compare-summary-item", text: item })));
      elements.compareDecisionSupport.replaceChildren(renderVariantDecisionSupport(decisionSupport));
      const formatCodeNode = (value: unknown, format: string): HTMLElement => {
        const code = createDomElement("code");
        code.replaceChildren(...formatSourceCodeNodes(String(value ?? ""), format));
        return code;
      };
      const sourcePane = (label: string, side: "after" | "before", format: string): HTMLElement => createDomElement("div", { className: "source-pane" }, [
        createDomElement("p", { className: "eyebrow", text: label }),
        createDomElement("div", { className: "source-lines" }, sourceRows.map((row: SourceDiffRow) => createDomElement("div", {
          className: `source-line${row.changed ? " changed" : ""}`
        }, [
          createDomElement("span", { className: "source-line-no", text: row.line }),
          formatCodeNode(side === "before" ? row.before : row.after, format)
        ])))
      ]);
      elements.compareSourceGrid.replaceChildren(
        sourcePane(state.selectedSlideStructured ? "Current JSON" : "Before", "before", beforeSourceFormat),
        sourcePane(variant.slideSpec ? "Candidate JSON" : "After", "after", afterSourceFormat)
      );
      synchronizeCompareSourceScroll();
      if (structuredComparison && Array.isArray(structuredComparison.groupDetails) && structuredComparison.groupDetails.length) {
        elements.compareHighlights.replaceChildren(...structuredComparison.groupDetails.map((group: StructuredGroupDetail) => createDomElement("section", {
          className: "compare-group"
        }, [
          createDomElement("div", { className: "compare-group-head" }, [
            createDomElement("strong", { text: group.label }),
            createDomElement("span", { text: `${group.changes.length} change${group.changes.length === 1 ? "" : "s"}` })
          ]),
          createDomElement("div", { className: "compare-group-items" }, group.changes.map((highlight: StructuredChange) => createDomElement("div", {
            className: "compare-highlight"
          }, [
            createDomElement("strong", { text: highlight.label }),
            createDomElement("span", { text: `Before: ${highlight.before}` }),
            createDomElement("span", { text: `After: ${highlight.after}` })
          ])))
        ])));
      } else if (diff.highlights.length) {
        elements.compareHighlights.replaceChildren(...diff.highlights.map((highlight: DiffHighlight) => createDomElement("div", {
          className: "compare-highlight"
        }, [
          createDomElement("strong", { text: `Line ${highlight.line}` }),
          createDomElement("span", { text: highlight.before }),
          createDomElement("span", { text: highlight.after })
        ])));
      } else {
        elements.compareHighlights.replaceChildren(createDomElement("p", {
          className: "compare-empty-copy",
          text: "No source changes detected."
        }));
      }
      elements.compareApplyButton.disabled = Boolean(staleSelectionReason);
      elements.compareApplyValidateButton.disabled = Boolean(staleSelectionReason);
      renderFlow();
    }

    async function saveVariantLayout(variant: VariantRecord, favorite = false, button: HTMLButtonElement | null = null): Promise<void> {
      if (!canSaveVariantLayout(variant)) {
        return;
      }

      const slideSpec = isRecord(variant.slideSpec) ? variant.slideSpec : {};
      const label = variant.label || `${slideSpec.layout || "Candidate"} layout`;
      const layoutName = label
        .replace(/^Use (deck|favorite) layout:\s*/i, "")
        .replace(/\s+candidate$/i, "");
      const done = button ? setBusy(button, favorite ? "Saving favorite..." : "Saving...") : () => {};
      try {
        const payload = await request<RequestPayload>("/api/v1/layouts/candidates/save", {
          body: JSON.stringify({
            description: variant.notes || variant.promptSummary || "",
            favorite,
            layoutDefinition: variant.layoutDefinition || null,
            layoutPreview: variant.layoutPreview || null,
            name: layoutName,
            operation: variant.operation || null,
            slideSpec: variant.slideSpec
          }),
          method: "POST"
        });
        state.layouts = payload.layouts || state.layouts;
        state.favoriteLayouts = payload.favoriteLayouts || state.favoriteLayouts;
        customLayoutWorkbench.renderLibrary();
        elements.operationStatus.textContent = favorite
          ? `Saved favorite layout ${payload.favoriteLayout?.name || layoutName}.`
          : `Saved layout ${payload.layout?.name || layoutName}.`;
      } finally {
        done();
      }
    }

    function exitReview(): void {
      if (state.selectedSlideId) {
        clearTransientVariants(state.selectedSlideId);
      }
      state.selectedVariantId = null;
      state.ui.variantReviewOpen = false;
      elements.operationStatus.textContent = "Returned to the slide list. Generate variants to review alternatives again.";
      renderPreviews();
      render();
    }

    async function captureVariant(): Promise<void> {
      if (!state.selectedSlideId) {
        return;
      }

      const done = setBusy(elements.captureVariantButton, "Capturing...");
      try {
        const payloadBody: CaptureVariantBody = {
          label: elements.variantLabel.value,
          slideId: state.selectedSlideId
        };

        if (state.selectedSlideStructured) {
          payloadBody.slideSpec = parseSlideSpecEditor();
        }

        const payload = await request<RequestPayload>("/api/v1/variants/capture", {
          body: JSON.stringify(payloadBody),
          method: "POST"
        });
        state.variantStorage = payload.variantStorage || state.variantStorage;
        const capturedVariant = payload.variant;
        if (!capturedVariant) {
          throw new Error("Variant capture did not return a variant.");
        }
        replacePersistedVariantsForSlide(state.selectedSlideId, payload.variants || [capturedVariant]);
        clearTransientVariants(state.selectedSlideId);
        state.selectedVariantId = capturedVariant.id || null;
        state.ui.variantReviewOpen = true;
        elements.variantLabel.value = "";
        elements.operationStatus.textContent = `Captured ${capturedVariant.label || "variant"} for comparison.`;
        openGenerationControls();
        render();
      } finally {
        done();
      }
    }

    async function applyVariantById(variantId: string | undefined, options: ApplyVariantOptions = {}): Promise<void> {
      const variant = getSlideVariants().find((entry: VariantRecord) => entry.id === variantId);
      if (!variant) {
        throw new Error(`Unknown variant: ${variantId}`);
      }

      let payload: RequestPayload;
      if (variant.persisted === false) {
        if (variant.slideSpec) {
          payload = await request<RequestPayload>(`/api/v1/slides/${variant.slideId}/slide-spec`, {
            body: JSON.stringify({
              rebuild: true,
              preserveSlidePosition: true,
              selectionScope: variant.operationScope || null,
              slideSpec: variant.slideSpec,
              visualTheme: variant.visualTheme || null
            }),
            method: "POST"
          });
        } else {
          payload = await request<RequestPayload>(`/api/v1/slides/${variant.slideId}/source`, {
            body: JSON.stringify({
              rebuild: true,
              source: variant.source,
              visualTheme: variant.visualTheme || null
            }),
            method: "POST"
          });
        }
        if (variant.slideId) {
          payload.slideId = variant.slideId;
        }
      } else {
        payload = await request<RequestPayload>("/api/v1/variants/apply", {
          body: JSON.stringify({ variantId }),
          method: "POST"
        });
      }
      state.previews = payload.previews || state.previews;
      state.context = payload.context || state.context;
      if (payload.domPreview) {
        setDomPreviewState(payload);
      }
      state.variantStorage = payload.variantStorage || state.variantStorage;
      elements.operationStatus.textContent = `Applied ${options.label || "variant"} to ${payload.slideId}.`;
      if (!payload.slideId) {
        throw new Error("Variant apply did not return a slide id.");
      }
      clearTransientVariants(payload.slideId);
      await loadSlide(payload.slideId);
      state.ui.variantReviewOpen = false;
      render();

      if (options.validateAfter) {
        await validate(false);
        elements.operationStatus.textContent = `Applied ${options.label || "variant"} and ran checks.`;
      }
    }

    function applySelectedVariant(validateAfter: boolean): void {
      const variant = getSelectedVariant();
      if (!variant) {
        return;
      }

      applyVariantById(variant.id, {
        ...(variant.label ? { label: variant.label } : {}),
        validateAfter
      }).catch((error) => windowRef.alert(errorMessage(error)));
    }

    function mount(): void {
      elements.compareApplyButton.addEventListener("click", () => applySelectedVariant(false));
      elements.compareApplyValidateButton.addEventListener("click", () => applySelectedVariant(true));
      elements.captureVariantButton.addEventListener("click", () => captureVariant().catch((error) => windowRef.alert(errorMessage(error))));
      elements.exitVariantReviewButton.addEventListener("click", exitReview);
    }

    return {
      applyVariantById,
      clearTransientVariants,
      getSelectedVariant,
      getSlideVariants,
      mount,
      openGenerationControls,
      render,
      renderComparison,
      renderFlow,
      replacePersistedVariantsForSlide
    };
  }
}
