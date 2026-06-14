import { StudioClientCore } from "../platform/core.ts";
import type { StudioClientElements } from "../core/elements.ts";
import type { StudioClientState } from "../core/state.ts";
import {
  buildBrowserRows,
  buildCoverageSummary,
  buildDependencyRows,
  buildDerivedDeckComparison,
  buildMaintenanceWarnings,
  type DependencyRow,
  type DerivedSlideset,
  type MaintenanceWarning,
  type MemoryBrowserRow,
  type MemoryFilters,
  type MemoryItem
} from "./memory-view-model.ts";

type MemoryAction = {
  baseVersion?: string;
  href?: string;
  id?: string;
  method?: string;
};

type MemoryCollectionResource = {
  actions?: MemoryAction[];
  derivedSets?: DerivedSlideset[];
  memoryItems?: MemoryItem[];
  state?: {
    baseVersion?: string;
    count?: number;
    presentationId?: string;
  };
};

type MemoryItemResource = {
  actions?: MemoryAction[];
  id?: string;
  memoryItem?: MemoryItem;
  state?: {
    baseVersion?: string;
  };
};

type Dependencies = {
  elements: StudioClientElements.Elements;
  state: StudioClientState.State;
};

function activePresentationId(state: StudioClientState.State): string {
  return state.presentations.activePresentationId || "";
}

function memoryUrl(presentationId: string): string {
  return `/api/v1/presentations/${encodeURIComponent(presentationId)}/memory`;
}

function evidenceFilterValue(value: string): "any" | "hasEvidence" | "needsEvidence" {
  return value === "hasEvidence" || value === "needsEvidence" ? value : "any";
}

function findAction(actions: MemoryAction[] | undefined, id: string): MemoryAction | null {
  return (actions || []).find((action) => action.id === id) || null;
}

function formatType(value: unknown): string {
  if (value === "audienceAssumption") {
    return "Audience";
  }
  if (value === "styleNote") {
    return "Style";
  }
  if (value === "reviewNote") {
    return "Review";
  }
  const text = String(value || "memory");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createTextBlock(documentRef: Document, className: string, title: string, detail: string): HTMLElement {
  const block = documentRef.createElement("div");
  block.className = className;
  const strong = documentRef.createElement("strong");
  strong.textContent = title;
  const span = documentRef.createElement("span");
  span.textContent = detail;
  block.append(strong, span);
  return block;
}

function renderEmpty(target: HTMLElement, title: string, detail: string): void {
  target.replaceChildren(createTextBlock(target.ownerDocument, "presentation-empty", title, detail));
}

export function createMemoryPageWorkbench({ elements, state }: Dependencies) {
  let currentResource: MemoryCollectionResource | null = null;
  let selectedItemResource: MemoryItemResource | null = null;

  function filters(): MemoryFilters {
    return {
      evidenceState: evidenceFilterValue(elements.memoryWorkbenchEvidenceFilter.value),
      query: elements.memoryWorkbenchSearch.value,
      status: elements.memoryWorkbenchStatusFilter.value,
      type: elements.memoryWorkbenchTypeFilter.value
    };
  }

  function items(): MemoryItem[] {
    return currentResource?.memoryItems || [];
  }

  function derivedSets(): DerivedSlideset[] {
    return currentResource?.derivedSets || [];
  }

  function slides(): StudioClientState.StudioSlide[] {
    return state.slides;
  }

  function renderStatus(message: string): void {
    elements.memoryWorkbenchStatus.textContent = message;
  }

  function renderSummary(): void {
    const summary = buildCoverageSummary(items(), slides(), derivedSets());
    const entries = [
      ["Items", summary.memoryItems],
      ["Used", summary.usedItems],
      ["Evidence", summary.evidenceLinkedItems],
      ["Claims", summary.acceptedClaims],
      ["Derived", summary.derivedDecks],
      ["Warnings", summary.maintenanceWarnings]
    ];
    elements.memoryWorkbenchSummary.replaceChildren(...entries.map(([label, value]) => {
      const card = elements.memoryWorkbenchSummary.ownerDocument.createElement("div");
      card.className = "memory-summary-card";
      const strong = elements.memoryWorkbenchSummary.ownerDocument.createElement("strong");
      strong.textContent = String(value);
      const span = elements.memoryWorkbenchSummary.ownerDocument.createElement("span");
      span.textContent = String(label);
      card.append(strong, span);
      return card;
    }));
  }

  function renderList(): void {
    const rows = buildBrowserRows(items(), filters(), slides(), derivedSets());
    elements.memoryWorkbenchCount.textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      renderEmpty(elements.memoryWorkbenchList, "No memory matches", "Adjust filters or add a memory item.");
      return;
    }

    elements.memoryWorkbenchList.replaceChildren(...rows.map((row: MemoryBrowserRow) => {
      const button = elements.memoryWorkbenchList.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "memory-workbench-item";
      button.dataset.memoryId = row.item.id || "";
      button.setAttribute("aria-pressed", selectedItemResource?.id === row.item.id ? "true" : "false");

      const header = elements.memoryWorkbenchList.ownerDocument.createElement("span");
      header.className = "memory-workbench-item-head";
      const type = elements.memoryWorkbenchList.ownerDocument.createElement("span");
      type.className = "memory-badge";
      type.textContent = formatType(row.item.type);
      const status = elements.memoryWorkbenchList.ownerDocument.createElement("span");
      status.className = `memory-status memory-status-${String(row.item.status || "draft")}`;
      status.textContent = String(row.item.status || "draft");
      header.append(type, status);

      const title = elements.memoryWorkbenchList.ownerDocument.createElement("strong");
      title.textContent = row.item.summary || "Untitled memory";
      const meta = elements.memoryWorkbenchList.ownerDocument.createElement("small");
      meta.textContent = [
        row.evidenceCount ? `${row.evidenceCount} evidence` : "No evidence",
        row.usedByCount ? `${row.usedByCount} dependency` : "Unused",
        row.maintenanceFlags.length ? `${row.maintenanceFlags.length} warning` : "",
        row.tagText
      ].filter(Boolean).join(" | ");
      button.append(header, title, meta);
      button.addEventListener("click", () => {
        selectItem(row.item.id || "").catch((error: unknown) => renderStatus(StudioClientCore.errorMessage(error)));
      });
      return button;
    }));
  }

  function renderDependencyMap(): void {
    const rows = buildDependencyRows(items(), slides(), derivedSets()).filter((row: DependencyRow) => (
      row.evidence.length || row.slides.length || row.derivedDecks.length
    ));
    if (!rows.length) {
      renderEmpty(elements.memoryDependencyMap, "No dependency paths", "Link memory to evidence, slides, or derived decks to see paths here.");
      return;
    }

    elements.memoryDependencyMap.replaceChildren(...rows.map((row: DependencyRow) => {
      const path = elements.memoryDependencyMap.ownerDocument.createElement("article");
      path.className = "memory-path-row";
      const title = elements.memoryDependencyMap.ownerDocument.createElement("strong");
      title.textContent = row.itemSummary;
      const mode = elements.memoryDependencyMap.ownerDocument.createElement("span");
      mode.className = `memory-link-mode memory-link-mode-${row.linkMode}`;
      mode.textContent = row.linkMode;
      const detail = elements.memoryDependencyMap.ownerDocument.createElement("p");
      detail.textContent = [
        `Evidence: ${row.evidence.join(", ") || "none"}`,
        `Slides: ${row.slides.join(", ") || "none"}`,
        `Derived: ${row.derivedDecks.join(", ") || "none"}`
      ].join(" -> ");
      path.append(title, mode, detail);
      return path;
    }));
  }

  function renderWarnings(): void {
    const warnings = buildMaintenanceWarnings(items(), slides(), derivedSets());
    if (!warnings.length) {
      renderEmpty(elements.memoryWarningList, "No memory warnings", "Maintenance issues will appear here when memory and delivery output drift.");
      return;
    }
    elements.memoryWarningList.replaceChildren(...warnings.map((warning: MaintenanceWarning) => {
      const row = elements.memoryWarningList.ownerDocument.createElement("div");
      row.className = `memory-warning-row memory-warning-row-${warning.level}`;
      const strong = elements.memoryWarningList.ownerDocument.createElement("strong");
      strong.textContent = warning.reason;
      const span = elements.memoryWarningList.ownerDocument.createElement("span");
      span.textContent = `${warning.itemId}: ${warning.message}`;
      row.append(strong, span);
      return row;
    }));
  }

  function renderDerivedComparison(): void {
    const comparison = buildDerivedDeckComparison(derivedSets());
    const documentRef = elements.memoryDerivedComparison.ownerDocument;
    const memoryBlock = createTextBlock(documentRef, "memory-comparison-block", "Memory coverage", comparison.memoryWorkbench.join(" | "));
    const outlineBlock = createTextBlock(documentRef, "memory-comparison-block", "Outline structure", comparison.outlineDrawer.join(" | "));
    elements.memoryDerivedComparison.replaceChildren(memoryBlock, outlineBlock);
  }

  function renderDetail(): void {
    const resource = selectedItemResource;
    const item = resource?.memoryItem;
    const retireAction = findAction(resource?.actions, "retire-memory-item");
    elements.memoryWorkbenchRetireButton.disabled = !retireAction;
    if (!item) {
      renderEmpty(elements.memoryWorkbenchDetail, "Select memory", "Choose an item to inspect evidence, dependency paths, and available actions.");
      return;
    }
    const documentRef = elements.memoryWorkbenchDetail.ownerDocument;
    const title = documentRef.createElement("strong");
    title.textContent = item.summary || "Untitled memory";
    const meta = documentRef.createElement("span");
    meta.textContent = [formatType(item.type), item.status || "draft", item.confidence ? `${item.confidence} confidence` : ""].filter(Boolean).join(" | ");
    const detail = documentRef.createElement("p");
    detail.textContent = item.detail || "No detail saved.";
    const evidence = documentRef.createElement("small");
    evidence.textContent = `Evidence: ${(item.evidence || []).map((link) => link.title || link.href || link.rel).join(", ") || "none"}`;
    const usedBy = documentRef.createElement("small");
    usedBy.textContent = `Used by: ${(item.usedBy || []).map((link) => link.title || link.href || link.rel).join(", ") || "none"}`;
    elements.memoryWorkbenchDetail.replaceChildren(title, meta, detail, evidence, usedBy);
  }

  function render(): void {
    renderSummary();
    renderList();
    renderDependencyMap();
    renderWarnings();
    renderDerivedComparison();
    renderDetail();
  }

  async function load(): Promise<void> {
    const presentationId = activePresentationId(state);
    if (!presentationId) {
      currentResource = null;
      selectedItemResource = null;
      renderStatus("Select a presentation to use the Memory workbench.");
      render();
      return;
    }
    renderStatus("Loading memory...");
    currentResource = await StudioClientCore.request<MemoryCollectionResource>(memoryUrl(presentationId));
    renderStatus(`${currentResource.state?.count || 0} memory item${currentResource.state?.count === 1 ? "" : "s"} loaded.`);
    render();
  }

  async function selectItem(memoryId: string): Promise<void> {
    const presentationId = activePresentationId(state);
    if (!presentationId || !memoryId) {
      return;
    }
    selectedItemResource = await StudioClientCore.request<MemoryItemResource>(`${memoryUrl(presentationId)}/${encodeURIComponent(memoryId)}`);
    render();
  }

  async function createItem(): Promise<void> {
    const presentationId = activePresentationId(state);
    const summary = elements.memoryWorkbenchCreateSummary.value.trim();
    if (!presentationId || !summary) {
      renderStatus(presentationId ? "Summary is required." : "Select a presentation before adding memory.");
      return;
    }
    if (!currentResource) {
      await load();
    }
    const createAction = findAction(currentResource?.actions, "create-memory-item");
    await StudioClientCore.postJson(createAction?.href || memoryUrl(presentationId), {
      baseVersion: createAction?.baseVersion || currentResource?.state?.baseVersion || "",
      detail: elements.memoryWorkbenchCreateDetail.value.trim(),
      status: elements.memoryWorkbenchCreateStatus.value,
      summary,
      type: elements.memoryWorkbenchCreateType.value
    });
    elements.memoryWorkbenchCreateSummary.value = "";
    elements.memoryWorkbenchCreateDetail.value = "";
    await load();
  }

  async function retireSelected(): Promise<void> {
    const retireAction = findAction(selectedItemResource?.actions, "retire-memory-item");
    if (!retireAction?.href) {
      renderStatus("Select an active memory item to retire.");
      return;
    }
    selectedItemResource = await StudioClientCore.postJson(retireAction.href, {
      baseVersion: retireAction.baseVersion || selectedItemResource?.state?.baseVersion || ""
    });
    await load();
  }

  function mount(): void {
    elements.memoryWorkbenchRefreshButton.addEventListener("click", () => {
      load().catch((error: unknown) => renderStatus(StudioClientCore.errorMessage(error)));
    });
    [
      elements.memoryWorkbenchSearch,
      elements.memoryWorkbenchTypeFilter,
      elements.memoryWorkbenchStatusFilter,
      elements.memoryWorkbenchEvidenceFilter
    ].forEach((control) => {
      control.addEventListener("input", render);
      control.addEventListener("change", render);
    });
    elements.memoryWorkbenchCreateForm.addEventListener("submit", (event) => {
      event.preventDefault();
      createItem().catch((error: unknown) => renderStatus(StudioClientCore.errorMessage(error)));
    });
    elements.memoryWorkbenchRetireButton.addEventListener("click", () => {
      retireSelected().catch((error: unknown) => renderStatus(StudioClientCore.errorMessage(error)));
    });
  }

  return {
    load,
    mount,
    render
  };
}
