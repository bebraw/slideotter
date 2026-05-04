import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";
import { buildSlideReorderEntries, moveSlideId, reorderSlideIds as reorderSlideIdList } from "./slide-reorder-model.ts";

type CreateDomElement = (
  tagName: string,
  options?: {
    attributes?: Record<string, string | number | boolean>;
    className?: string;
    disabled?: boolean;
    text?: unknown;
  },
  children?: Array<Node | string | number | boolean>
) => HTMLElement;

type SlideReorderRenderingDependencies = {
  createDomElement: CreateDomElement;
  elements: StudioClientElements.Elements;
  getReorderSlideIds: () => string[];
  setReorderSlideIds: (slideIds: string[]) => void;
  state: StudioClientState.State;
};

export function createSlideReorderRendering(deps: SlideReorderRenderingDependencies) {
  let draggedReorderSlideId = "";

  function moveReorderSlide(slideId: string, offset: number): void {
    const current = deps.getReorderSlideIds();
    const next = moveSlideId(current, slideId, offset);
    if (next === current) {
      return;
    }
    deps.setReorderSlideIds(next);
    renderSlideReorderList();
  }

  function renderSlideReorderList(): void {
    const reorderSlideIds = deps.getReorderSlideIds();
    const entries = buildSlideReorderEntries({
      context: deps.state.context,
      reorderSlideIds,
      selectedSlideId: deps.state.selectedSlideId,
      slides: deps.state.slides
    });
    deps.elements.slideReorderList.replaceChildren(...entries.map((entry) => {
      const item = deps.createDomElement("article", {
        attributes: {
          draggable: "true",
          role: "listitem",
          "data-slide-id": entry.id
        },
        className: `slide-reorder-item${entry.selected ? " active" : ""}`
      }, [
        deps.createDomElement("span", { className: "slide-reorder-handle", text: "Drag" }),
        deps.createDomElement("div", { className: "slide-reorder-copy" }, [
          deps.createDomElement("strong", { text: entry.titleLabel }),
          deps.createDomElement("span", { text: `${entry.description} - File order ${entry.fileOrder}` })
        ]),
        deps.createDomElement("div", { className: "slide-reorder-stepper" }, [
          deps.createDomElement("button", {
            attributes: { type: "button", "aria-label": `Move ${entry.title} up` },
            className: "secondary utility-button",
            disabled: entry.isFirst,
            text: "Up"
          }),
          deps.createDomElement("button", {
            attributes: { type: "button", "aria-label": `Move ${entry.title} down` },
            className: "secondary utility-button",
            disabled: entry.isLast,
            text: "Down"
          })
        ])
      ]);
      const buttons = item.querySelectorAll("button");
      buttons[0]?.addEventListener("click", () => moveReorderSlide(entry.id, -1));
      buttons[1]?.addEventListener("click", () => moveReorderSlide(entry.id, 1));
      item.addEventListener("dragstart", (event: DragEvent) => {
        draggedReorderSlideId = entry.id;
        event.dataTransfer?.setData("text/plain", entry.id);
        event.dataTransfer?.setDragImage(item, 12, 12);
      });
      item.addEventListener("dragover", (event: DragEvent) => {
        event.preventDefault();
      });
      item.addEventListener("drop", (event: DragEvent) => {
        event.preventDefault();
        const sourceId = event.dataTransfer?.getData("text/plain") || draggedReorderSlideId;
        deps.setReorderSlideIds(reorderSlideIdList(deps.getReorderSlideIds(), sourceId, entry.id));
        draggedReorderSlideId = "";
        renderSlideReorderList();
      });
      item.addEventListener("dragend", () => {
        draggedReorderSlideId = "";
      });
      return item;
    }));
  }

  function openSlideReorderDialog(): void {
    deps.setReorderSlideIds(deps.state.slides.map((slide: StudioClientState.StudioSlide) => slide.id));
    renderSlideReorderList();
    if (deps.elements.slideReorderDialog instanceof HTMLDialogElement && typeof deps.elements.slideReorderDialog.showModal === "function") {
      deps.elements.slideReorderDialog.showModal();
    } else {
      deps.elements.slideReorderDialog.setAttribute("open", "");
    }
  }

  function closeSlideReorderDialog(): void {
    if (deps.elements.slideReorderDialog instanceof HTMLDialogElement && typeof deps.elements.slideReorderDialog.close === "function") {
      deps.elements.slideReorderDialog.close();
    } else {
      deps.elements.slideReorderDialog.removeAttribute("open");
    }
    draggedReorderSlideId = "";
    deps.setReorderSlideIds([]);
  }

  return {
    closeSlideReorderDialog,
    moveReorderSlide,
    openSlideReorderDialog,
    renderSlideReorderList
  };
}
