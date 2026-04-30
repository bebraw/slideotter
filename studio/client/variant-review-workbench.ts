import type { StudioClientElements } from "./elements";
import type { StudioClientState } from "./state";

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
    createdAt?: string;
    generator?: string;
    kind?: string;
    layoutDefinition?: JsonRecord & {
      regions?: unknown[];
      slots?: unknown[];
      type?: string;
    };
    layoutPreview?: JsonRecord & {
      mode?: string;
      state?: string;
    };
    notes?: string;
    operation?: string;
    operationScope?: SelectionScope;
    persisted?: boolean;
    promptSummary?: string;
    source?: string;
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
  type DiffHighlight = {
    after: string;
    before: string;
    line: number;
  };
  type SourceDiff = {
    added: number;
    changed: number;
    highlights: DiffHighlight[];
    removed: number;
  };
  type SourceDiffRow = DiffHighlight & {
    changed: boolean;
  };
  type StructuredGroup = "bullets" | "cards" | "family" | "framing" | "guardrails" | "resources" | "signals" | string;
  type StructuredChange = {
    after: string;
    before: string;
    group: StructuredGroup;
    label: string;
  };
  type StructuredGroupDetail = {
    changes: StructuredChange[];
    group: StructuredGroup;
    label: string;
  };
  type StructuredComparison = {
    changes: StructuredChange[];
    groupDetails?: StructuredGroupDetail[];
    groups: StructuredGroup[];
    summaryLines: string[];
    totalChanges: number;
  };
  type DecisionSupport = {
    contentAreas: number;
    cues: string[];
    fieldChanges: number;
    focusItems: Array<{
      label: string;
      value: string;
    }>;
    scale: "Large" | "Medium" | "Small";
    wordDelta: number | null;
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
  type Deps = {
    createDomElement: CreateDomElement;
    customLayoutWorkbench: {
      renderLibrary: () => void;
    };
    elements: StudioClientElements.Elements;
    escapeHtml: (value: unknown) => string;
    formatSourceCode: (source: string, format: string) => string;
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
    workflowRunners: {
      ideateSlide: () => Promise<void>;
      ideateStructure: () => Promise<void>;
      ideateTheme: () => Promise<void>;
      redoLayout: () => Promise<void>;
    };
  };

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function toVariant(value: StudioClientState.VariantRecord | JsonRecord): VariantRecord {
    return { ...value };
  }

  function toVariants(values: unknown): VariantRecord[] {
    return Array.isArray(values) ? values.filter(isRecord).map(toVariant) : [];
  }

  function slideSpecItems(spec: JsonRecord, field: string): JsonRecord[] {
    const value = spec[field];
    return Array.isArray(value) ? value.filter(isRecord) : [];
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

  export function createVariantReviewWorkbench(deps: Deps) {
    const {
      createDomElement,
      customLayoutWorkbench,
      elements,
      escapeHtml,
      formatSourceCode,
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
      windowRef,
      workflowRunners
    } = deps;

    function getSlideVariants(): VariantRecord[] {
      return [
        ...state.transientVariants.map(toVariant).filter((variant: VariantRecord) => variant.slideId === state.selectedSlideId),
        ...state.variants.map(toVariant).filter((variant: VariantRecord) => variant.slideId === state.selectedSlideId)
      ];
    }

    function getSelectedVariant(): VariantRecord | null {
      const variants = getSlideVariants();
      if (!variants.length) {
        state.selectedVariantId = null;
        return null;
      }

      if (!variants.some((variant: VariantRecord) => variant.id === state.selectedVariantId)) {
        state.selectedVariantId = null;
      }

      return variants.find((variant: VariantRecord) => variant.id === state.selectedVariantId) || null;
    }

    function clearTransientVariants(slideId: string): void {
      state.transientVariants = state.transientVariants.filter((variant: StudioClientState.VariantRecord) => variant.slideId !== slideId);
    }

    function replacePersistedVariantsForSlide(slideId: string, variants: unknown): void {
      state.variants = [
        ...state.variants.filter((variant: StudioClientState.VariantRecord) => variant.slideId !== slideId),
        ...toVariants(variants)
      ];
    }

    function openGenerationControls(): void {
      const details = windowRef.document.querySelector(".variant-generation-details") as HTMLDetailsElement | null;
      if (details) {
        details.open = true;
      }
    }

    function summarizeDiff(currentSource: string, variantSource: string): SourceDiff {
      const currentLines = currentSource.split("\n");
      const variantLines = variantSource.split("\n");
      const maxLines = Math.max(currentLines.length, variantLines.length);
      let added = 0;
      let changed = 0;
      const highlights: DiffHighlight[] = [];
      let removed = 0;

      for (let index = 0; index < maxLines; index += 1) {
        const before = currentLines[index];
        const after = variantLines[index];

        if (before === after) {
          continue;
        }

        if (before === undefined) {
          added += 1;
        } else if (after === undefined) {
          removed += 1;
        } else {
          changed += 1;
        }

        if (highlights.length < 4) {
          highlights.push({
            after: after ? after.trim() : "(removed)",
            before: before ? before.trim() : "(no line)",
            line: index + 1
          });
        }
      }

      return {
        added,
        changed,
        highlights,
        removed
      };
    }

    function normalizeCompareValue(value: unknown): string {
      if (typeof value === "string") {
        return value.replace(/\s+/g, " ").trim();
      }

      if (typeof value === "number") {
        return String(value);
      }

      if (value === null || value === undefined) {
        return "";
      }

      return JSON.stringify(value);
    }

    function formatCompareValue(value: unknown): string {
      const normalized = normalizeCompareValue(value);
      return normalized || "(empty)";
    }

    function formatStructuredGroupLabel(group: StructuredGroup): string {
      const labels: Record<string, string> = {
        bullets: "Bullets",
        cards: "Cards",
        family: "Slide family",
        framing: "Framing",
        guardrails: "Guardrails",
        resources: "Resources",
        signals: "Signals"
      };
      return labels[group] || group;
    }

    function buildStructuredComparison(currentSpec: JsonRecord | null, variantSpec: JsonRecord | null): StructuredComparison | null {
      if (!currentSpec || !variantSpec) {
        return null;
      }

      const changes: StructuredChange[] = [];
      const groups = new Set<StructuredGroup>();

      const pushChange = (group: StructuredGroup, label: string, before: unknown, after: unknown): void => {
        const normalizedBefore = normalizeCompareValue(before);
        const normalizedAfter = normalizeCompareValue(after);

        if (normalizedBefore === normalizedAfter) {
          return;
        }

        groups.add(group);
        changes.push({
          after: formatCompareValue(after),
          before: formatCompareValue(before),
          group,
          label
        });
      };

      if (currentSpec.type !== variantSpec.type) {
        pushChange("family", "Slide family", currentSpec.type, variantSpec.type);

        return {
          changes,
          groupDetails: [
            {
              changes,
              group: "family",
              label: "Slide family"
            }
          ],
          groups: ["family"],
          summaryLines: [
            `Changed slide family from ${currentSpec.type} to ${variantSpec.type}.`,
            "Review dropped or transformed fields in the JSON diff before applying."
          ],
          totalChanges: changes.length
        };
      }

      pushChange("framing", "Title", currentSpec.title, variantSpec.title);
      if (currentSpec.type !== "divider") {
        pushChange("framing", "Eyebrow", currentSpec.eyebrow, variantSpec.eyebrow);
        pushChange("framing", "Summary", currentSpec.summary, variantSpec.summary);
      }

      switch (currentSpec.type) {
        case "divider":
          break;
        case "cover":
        case "toc":
          pushChange("framing", "Note", currentSpec.note, variantSpec.note);
          slideSpecItems(currentSpec, "cards").forEach((card: JsonRecord, index: number) => {
            const nextCard = slideSpecItems(variantSpec, "cards")[index] || {};
            pushChange("cards", `Card ${index + 1} title`, card.title, nextCard.title);
            pushChange("cards", `Card ${index + 1} body`, card.body, nextCard.body);
          });
          break;
        case "content":
          pushChange("signals", "Signals title", currentSpec.signalsTitle, variantSpec.signalsTitle);
          slideSpecItems(currentSpec, "signals").forEach((signal: JsonRecord, index: number) => {
            const nextSignal = slideSpecItems(variantSpec, "signals")[index] || {};
            pushChange("signals", `Signal ${index + 1} title`, signal.title || signal.label, nextSignal.title || nextSignal.label);
            pushChange("signals", `Signal ${index + 1} body`, signal.body || signal.value, nextSignal.body || nextSignal.value);
          });
          pushChange("guardrails", "Guardrails title", currentSpec.guardrailsTitle, variantSpec.guardrailsTitle);
          slideSpecItems(currentSpec, "guardrails").forEach((guardrail: JsonRecord, index: number) => {
            const nextGuardrail = slideSpecItems(variantSpec, "guardrails")[index] || {};
            pushChange("guardrails", `Guardrail ${index + 1} title`, guardrail.title || guardrail.label, nextGuardrail.title || nextGuardrail.label);
            pushChange("guardrails", `Guardrail ${index + 1} body`, guardrail.body || guardrail.value, nextGuardrail.body || nextGuardrail.value);
          });
          break;
        case "summary":
          pushChange("resources", "Resources title", currentSpec.resourcesTitle, variantSpec.resourcesTitle);
          slideSpecItems(currentSpec, "bullets").forEach((bullet: JsonRecord, index: number) => {
            const nextBullet = slideSpecItems(variantSpec, "bullets")[index] || {};
            pushChange("bullets", `Bullet ${index + 1} title`, bullet.title, nextBullet.title);
            pushChange("bullets", `Bullet ${index + 1} body`, bullet.body, nextBullet.body);
          });
          slideSpecItems(currentSpec, "resources").forEach((resource: JsonRecord, index: number) => {
            const nextResource = slideSpecItems(variantSpec, "resources")[index] || {};
            pushChange("resources", `Resource ${index + 1} title`, resource.title, nextResource.title);
            pushChange("resources", `Resource ${index + 1} body`, resource.body, nextResource.body);
          });
          break;
        default:
          return null;
      }

      if (!changes.length) {
        return {
          changes: [],
          groups: [],
          summaryLines: ["No structured field changes detected."],
          totalChanges: 0
        };
      }

      const orderedGroups = Array.from(groups);
      const groupLabels = orderedGroups.map((group) => formatStructuredGroupLabel(group)).join(", ");
      const groupDetails = orderedGroups.map((group) => ({
        changes: changes.filter((change: StructuredChange) => change.group === group),
        group,
        label: formatStructuredGroupLabel(group)
      }));

      return {
        changes,
        groupDetails,
        groups: orderedGroups,
        summaryLines: [
          `Changed ${changes.length} structured field${changes.length === 1 ? "" : "s"} across ${orderedGroups.length} content area${orderedGroups.length === 1 ? "" : "s"}.`,
          `Areas touched: ${groupLabels}.`
        ],
        totalChanges: changes.length
      };
    }

    function collectSlideTextParts(spec: unknown): string[] {
      if (!isRecord(spec)) {
        return [];
      }

      const parts: unknown[] = [
        spec.eyebrow,
        spec.title,
        spec.summary,
        spec.note,
        spec.signalsTitle,
        spec.guardrailsTitle,
        spec.resourcesTitle
      ];

      ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
        slideSpecItems(spec, field).forEach((item: JsonRecord) => {
          parts.push(item.title, item.body, item.label, item.value);
        });
      });

      return parts
        .filter((part) => typeof part === "string")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    function countSlideWords(spec: unknown): number {
      const text = collectSlideTextParts(spec).join(" ").trim();
      return text ? text.split(/\s+/).length : 0;
    }

    function buildVariantDecisionSupport(
      currentSpec: JsonRecord | null,
      variantSpec: JsonRecord | undefined,
      structuredComparison: StructuredComparison | null,
      diff: SourceDiff
    ): DecisionSupport {
      const fieldChanges = structuredComparison
        ? structuredComparison.totalChanges
        : diff.changed + diff.added + diff.removed;
      const groupDetails = structuredComparison && Array.isArray(structuredComparison.groupDetails)
        ? structuredComparison.groupDetails
        : [];
      const contentAreas = groupDetails.length;
      const canCompareWords = Boolean(currentSpec && variantSpec);
      const currentWords = canCompareWords ? countSlideWords(currentSpec) : 0;
      const variantWords = canCompareWords ? countSlideWords(variantSpec) : 0;
      const wordDelta = canCompareWords ? variantWords - currentWords : null;
      const absoluteWordDelta = wordDelta === null ? 0 : Math.abs(wordDelta);
      const titleChanged = structuredComparison
        ? structuredComparison.changes.some((change: StructuredChange) => change.label === "Title")
        : false;
      const scale = fieldChanges >= 12 || contentAreas >= 4 || absoluteWordDelta >= 24
        ? "Large"
        : fieldChanges >= 5 || contentAreas >= 2 || absoluteWordDelta >= 10
          ? "Medium"
          : "Small";
      const focusItems = groupDetails.length
        ? groupDetails.map((group: StructuredGroupDetail) => ({
          label: group.label,
          value: `${group.changes.length} change${group.changes.length === 1 ? "" : "s"}`
        }))
        : diff.highlights.map((highlight: DiffHighlight) => ({
          label: `Line ${highlight.line}`,
          value: "source change"
        }));
      const cues = [];

      if (scale === "Large") {
        cues.push("Review the full preview and affected areas before applying.");
      } else if (scale === "Medium") {
        cues.push("Check changed areas and text fit before applying.");
      } else {
        cues.push("Preview check is likely enough for this small change.");
      }

      if (titleChanged) {
        cues.push("Headline changed; confirm it still matches the deck narrative.");
      }

      if (wordDelta !== null && wordDelta >= 10) {
        cues.push("Candidate adds visible text; check wrapping and slide density.");
      } else if (wordDelta !== null && wordDelta <= -10) {
        cues.push("Candidate removes visible text; check whether key claims remain.");
      }

      if (contentAreas >= 3) {
        cues.push("Several content areas move together; compare the visual hierarchy.");
      }

      if (structuredComparison && structuredComparison.groups.includes("family")) {
        cues.push("Slide family changes can drop incompatible fields; inspect the JSON diff before applying.");
      }

      return {
        contentAreas,
        cues,
        fieldChanges,
        focusItems,
        scale,
        wordDelta
      };
    }

    function renderVariantDecisionSupport(decisionSupport: DecisionSupport): string {
      const formattedDelta = decisionSupport.wordDelta === null
        ? "n/a"
        : decisionSupport.wordDelta > 0
          ? `+${decisionSupport.wordDelta}`
          : String(decisionSupport.wordDelta);
      const focusItems = decisionSupport.focusItems.slice(0, 5);

      return `
        <section class="compare-decision-panel">
          <div class="compare-decision-head">
            <div>
              <p class="eyebrow">Decision support</p>
              <strong>${escapeHtml(decisionSupport.scale)} candidate change</strong>
            </div>
            <div class="compare-decision-metrics">
              <span><strong>${decisionSupport.fieldChanges}</strong> field${decisionSupport.fieldChanges === 1 ? "" : "s"}</span>
              <span><strong>${decisionSupport.contentAreas}</strong> area${decisionSupport.contentAreas === 1 ? "" : "s"}</span>
              <span><strong>${escapeHtml(formattedDelta)}</strong> words</span>
            </div>
          </div>
          ${focusItems.length ? `
            <div class="compare-decision-focus" aria-label="Review focus">
              ${focusItems.map((item: { label: string; value: string }) => `
                <span class="compare-decision-chip">
                  <strong>${escapeHtml(item.label)}</strong>
                  ${escapeHtml(item.value)}
                </span>
              `).join("")}
            </div>
          ` : ""}
          <div class="compare-decision-cues">
            ${decisionSupport.cues.map((cue: string) => `<p>${escapeHtml(cue)}</p>`).join("")}
          </div>
        </section>
      `;
    }

    function buildSourceDiffRows(currentSource: string, variantSource: string): SourceDiffRow[] {
      const beforeLines = currentSource.split("\n");
      const afterLines = variantSource.split("\n");
      const maxLines = Math.max(beforeLines.length, afterLines.length);
      const rows: SourceDiffRow[] = [];

      for (let index = 0; index < maxLines; index += 1) {
        const before = beforeLines[index];
        const after = afterLines[index];
        const changed = before !== after;

        rows.push({
          after: after === undefined ? "" : after,
          before: before === undefined ? "" : before,
          changed,
          line: index + 1
        });
      }

      return rows;
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
      return Boolean(variant && canSaveVariantLayout(variant)
        && (variant.operation !== "custom-layout" || (variant.layoutPreview && variant.layoutPreview.mode === "multi-slide")));
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
      const workflow = state.runtime && state.runtime.workflow;
      const workflowRunning = workflow && workflow.status === "running";
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
      const reviewOpen = Boolean(state.ui.variantReviewOpen && variants.length);
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
          createDomElement("strong", { text: "No candidates yet" }),
          createDomElement("span", { text: "Choose a count, then run a variant action to create session-only options." })
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
      }

      elements.compareEmpty.hidden = true;
      elements.compareSummary.hidden = false;

      elements.compareStats.innerHTML = [
        `<span class="compare-stat"><strong>${variant.persisted === false ? "session-only" : "saved"}</strong> variant mode</span>`,
        `<span class="compare-stat"><strong>${escapeHtml(variant.generator || "manual")}</strong> generator</span>`,
        structuredComparison
          ? `<span class="compare-stat"><strong>${structuredComparison.totalChanges}</strong> structured changes</span>`
          : "",
        structuredComparison
          ? `<span class="compare-stat"><strong>${structuredComparison.groups.length}</strong> content areas</span>`
          : "",
        variantVisualTheme
          ? `<span class="compare-stat"><strong>visual</strong> theme</span>`
          : "",
        variant.layoutDefinition
          ? `<span class="compare-stat"><strong>${escapeHtml(variant.layoutDefinition.type || "layout")}</strong> definition</span>`
          : "",
        variant.layoutPreview && variant.layoutPreview.state
          ? `<span class="compare-stat"><strong>${escapeHtml(variant.layoutPreview.state)}</strong> preview</span>`
          : "",
        variant.operationScope && variant.operationScope.scopeLabel
          ? `<span class="compare-stat"><strong>${escapeHtml(variant.operationScope.scopeLabel)}</strong> scope</span>`
          : "",
        variant.operationScope && variant.operationScope.allowFamilyChange
          ? `<span class="compare-stat"><strong>family</strong> change</span>`
          : "",
        `<span class="compare-stat"><strong>${diff.changed}</strong> changed lines</span>`,
        `<span class="compare-stat"><strong>${diff.added}</strong> added lines</span>`,
        `<span class="compare-stat"><strong>${diff.removed}</strong> removed lines</span>`
      ].filter(Boolean).join("");
      elements.compareChangeSummary.innerHTML = compareSummaryItems
        .map((item: string) => `<p class="compare-summary-item">${escapeHtml(item)}</p>`)
        .join("");
      elements.compareDecisionSupport.innerHTML = renderVariantDecisionSupport(decisionSupport);
      elements.compareSourceGrid.innerHTML = `
        <div class="source-pane">
          <p class="eyebrow">${state.selectedSlideStructured ? "Current JSON" : "Before"}</p>
          <div class="source-lines">
            ${sourceRows.map((row: SourceDiffRow) => `
              <div class="source-line${row.changed ? " changed" : ""}">
                <span class="source-line-no">${row.line}</span>
                <code>${formatSourceCode(row.before, beforeSourceFormat)}</code>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="source-pane">
          <p class="eyebrow">${variant.slideSpec ? "Candidate JSON" : "After"}</p>
          <div class="source-lines">
            ${sourceRows.map((row: SourceDiffRow) => `
              <div class="source-line${row.changed ? " changed" : ""}">
                <span class="source-line-no">${row.line}</span>
                <code>${formatSourceCode(row.after, afterSourceFormat)}</code>
              </div>
            `).join("")}
          </div>
        </div>
      `;
      synchronizeCompareSourceScroll();
      elements.compareHighlights.innerHTML = structuredComparison && Array.isArray(structuredComparison.groupDetails) && structuredComparison.groupDetails.length
        ? structuredComparison.groupDetails.map((group: StructuredGroupDetail) => `
          <section class="compare-group">
            <div class="compare-group-head">
              <strong>${escapeHtml(group.label)}</strong>
              <span>${group.changes.length} change${group.changes.length === 1 ? "" : "s"}</span>
            </div>
            <div class="compare-group-items">
              ${group.changes.map((highlight: StructuredChange) => `
                <div class="compare-highlight">
                  <strong>${escapeHtml(highlight.label)}</strong>
                  <span>Before: ${escapeHtml(highlight.before)}</span>
                  <span>After: ${escapeHtml(highlight.after)}</span>
                </div>
              `).join("")}
            </div>
          </section>
        `).join("")
        : diff.highlights.length
          ? diff.highlights.map((highlight: DiffHighlight) => `
          <div class="compare-highlight">
            <strong>Line ${highlight.line}</strong>
            <span>${escapeHtml(highlight.before)}</span>
            <span>${escapeHtml(highlight.after)}</span>
          </div>
        `).join("")
        : "<p class=\"compare-empty-copy\">No source changes detected.</p>";
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
        const payload = await request<RequestPayload>("/api/layouts/candidates/save", {
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

        const payload = await request<RequestPayload>("/api/variants/capture", {
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
          payload = await request<RequestPayload>(`/api/slides/${variant.slideId}/slide-spec`, {
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
          payload = await request<RequestPayload>(`/api/slides/${variant.slideId}/source`, {
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
        payload = await request<RequestPayload>("/api/variants/apply", {
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
      elements.ideateSlideButton.addEventListener("click", () => workflowRunners.ideateSlide().catch((error) => windowRef.alert(errorMessage(error))));
      elements.ideateStructureButton.addEventListener("click", () => workflowRunners.ideateStructure().catch((error) => windowRef.alert(errorMessage(error))));
      elements.ideateThemeButton.addEventListener("click", () => workflowRunners.ideateTheme().catch((error) => windowRef.alert(errorMessage(error))));
      elements.redoLayoutButton.addEventListener("click", () => workflowRunners.redoLayout().catch((error) => windowRef.alert(errorMessage(error))));
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
