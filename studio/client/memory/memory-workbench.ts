import { StudioClientCore } from "../platform/core.ts";
import type { StudioClientElements } from "../core/elements.ts";
import type { StudioClientState } from "../core/state.ts";

export namespace StudioClientMemoryWorkbench {
  type MemoryLink = {
    href?: string;
    rel?: string;
    title?: string;
  };

  type MemoryItem = {
    confidence?: string;
    detail?: string;
    evidence?: MemoryLink[];
    id?: string;
    status?: string;
    summary?: string;
    tags?: string[];
    type?: string;
  };

  type MemoryAction = {
    baseVersion?: string;
    href?: string;
    id?: string;
    method?: string;
  };

  type MemoryCollectionResource = {
    actions?: MemoryAction[];
    memoryItems?: MemoryItem[];
    searchResults?: Array<{
      item?: MemoryItem;
      score?: number;
    }>;
    state?: {
      baseVersion?: string;
      count?: number;
      query?: string;
    };
  };

  type Dependencies = {
    elements: StudioClientElements.Elements;
    state: StudioClientState.State;
  };

  function formatType(value: unknown): string {
    if (value === "styleNote") {
      return "Style";
    }
    const text = String(value || "memory");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function getActivePresentationId(state: StudioClientState.State): string {
    return state.presentations.activePresentationId || "";
  }

  function createMemoryUrl(presentationId: string, query = ""): string {
    const baseUrl = `/api/v1/presentations/${encodeURIComponent(presentationId)}/memory`;
    return query ? `${baseUrl}?query=${encodeURIComponent(query)}` : baseUrl;
  }

  function findCreateAction(resource: MemoryCollectionResource): MemoryAction | null {
    return (resource.actions || []).find((action: MemoryAction) => action.id === "create-memory-item") || null;
  }

  function renderStatus(elements: StudioClientElements.Elements, message: string): void {
    elements.memoryStatusNote.textContent = message;
  }

  function createItemCard(documentRef: Document, item: MemoryItem, score: number | null): HTMLElement {
    const card = documentRef.createElement("article");
    card.className = "memory-card";

    const header = documentRef.createElement("div");
    header.className = "memory-card-head";

    const typeBadge = documentRef.createElement("span");
    typeBadge.className = "memory-badge";
    typeBadge.textContent = formatType(item.type);

    const statusBadge = documentRef.createElement("span");
    statusBadge.className = `memory-status memory-status-${String(item.status || "draft")}`;
    statusBadge.textContent = String(item.status || "draft");

    header.append(typeBadge, statusBadge);
    if (score !== null) {
      const scoreBadge = documentRef.createElement("span");
      scoreBadge.className = "memory-score";
      scoreBadge.textContent = `Score ${score}`;
      header.append(scoreBadge);
    }

    const summary = documentRef.createElement("strong");
    summary.textContent = item.summary || "Untitled memory";

    const detail = documentRef.createElement("p");
    detail.textContent = item.detail || "";
    detail.hidden = !item.detail;

    const meta = documentRef.createElement("small");
    meta.textContent = [
      item.confidence ? `${item.confidence} confidence` : "",
      Array.isArray(item.evidence) && item.evidence.length ? `${item.evidence.length} evidence` : "",
      Array.isArray(item.tags) && item.tags.length ? item.tags.join(", ") : ""
    ].filter(Boolean).join(" · ");
    meta.hidden = !meta.textContent;

    card.append(header, summary, detail, meta);
    return card;
  }

  function renderMemoryList(elements: StudioClientElements.Elements, resource: MemoryCollectionResource): void {
    const documentRef = elements.memoryList.ownerDocument;
    const query = String(resource.state?.query || "");
    const searchResults = Array.isArray(resource.searchResults) ? resource.searchResults : [];
    const items = query && searchResults.length
      ? searchResults.map((result) => ({
          item: result.item || {},
          score: Number.isFinite(Number(result.score)) ? Number(result.score) : null
        }))
      : (resource.memoryItems || []).map((item: MemoryItem) => ({
          item,
          score: null
        }));

    elements.memoryList.replaceChildren();
    if (!items.length) {
      const empty = documentRef.createElement("div");
      empty.className = "presentation-empty";
      const title = documentRef.createElement("strong");
      title.textContent = query ? "No memory matches" : "No memory yet";
      const note = documentRef.createElement("span");
      note.textContent = query ? "Try another search term." : "Add a claim, evidence note, or style note for this presentation.";
      empty.append(title, note);
      elements.memoryList.append(empty);
      return;
    }

    items.forEach((entry) => {
      elements.memoryList.append(createItemCard(documentRef, entry.item, entry.score));
    });
  }

  export function createMemoryWorkbench({ elements, state }: Dependencies) {
    let currentResource: MemoryCollectionResource | null = null;

    async function load(): Promise<void> {
      const presentationId = getActivePresentationId(state);
      if (!presentationId) {
        renderStatus(elements, "Select a presentation to use memory.");
        elements.memoryList.replaceChildren();
        return;
      }

      const query = elements.memorySearch.value.trim();
      renderStatus(elements, query ? "Searching memory..." : "Loading memory...");
      currentResource = await StudioClientCore.request<MemoryCollectionResource>(createMemoryUrl(presentationId, query));
      renderMemoryList(elements, currentResource);
      const count = Number(currentResource.state?.count || 0);
      renderStatus(elements, query ? `${count} match${count === 1 ? "" : "es"}` : `${count} memory item${count === 1 ? "" : "s"}`);
    }

    async function createItem(): Promise<void> {
      const presentationId = getActivePresentationId(state);
      const summary = elements.memorySummary.value.trim();
      if (!presentationId || !summary) {
        renderStatus(elements, presentationId ? "Summary is required." : "Select a presentation to add memory.");
        return;
      }

      if (!currentResource) {
        await load();
      }
      const createAction = currentResource ? findCreateAction(currentResource) : null;
      const href = createAction?.href || createMemoryUrl(presentationId);
      renderStatus(elements, "Adding memory...");
      await StudioClientCore.postJson(href, {
        baseVersion: createAction?.baseVersion || currentResource?.state?.baseVersion || "",
        detail: elements.memoryDetail.value.trim(),
        status: elements.memoryStatus.value,
        summary,
        type: elements.memoryType.value
      });

      elements.memorySummary.value = "";
      elements.memoryDetail.value = "";
      await load();
    }

    function mount(): void {
      elements.memoryRefreshButton.addEventListener("click", () => {
        load().catch((error: unknown) => renderStatus(elements, StudioClientCore.errorMessage(error)));
      });
      elements.memorySearch.addEventListener("input", () => {
        load().catch((error: unknown) => renderStatus(elements, StudioClientCore.errorMessage(error)));
      });
      elements.memoryCreateForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createItem().catch((error: unknown) => renderStatus(elements, StudioClientCore.errorMessage(error)));
      });
    }

    return {
      load,
      mount,
      render: () => {
        if (currentResource) {
          renderMemoryList(elements, currentResource);
        }
      }
    };
  }
}
