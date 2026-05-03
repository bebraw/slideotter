import type { StudioClientElements } from "../core/elements";
import type { StudioClientState } from "../core/state";

type JsonRecord = StudioClientState.JsonRecord;

export type CustomVisual = JsonRecord & {
  content?: string;
  description?: string;
  id: string;
  role?: string;
  title?: string;
};

export type CustomVisualRenderDependencies = {
  createDomElement: (tagName: string, options?: {
    attributes?: Record<string, string | number | boolean>;
    className?: string;
    disabled?: boolean;
    text?: unknown;
  }, children?: Array<Node | string | number | boolean>) => HTMLElement;
  elements: Pick<StudioClientElements.Elements, "customVisualDetachButton" | "customVisualList">;
  onAttach: (customVisual: CustomVisual, button: HTMLButtonElement) => void;
  selectedSlideId: string | null;
  selectedSlideSpec: JsonRecord | null;
  customVisuals: JsonRecord[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toCustomVisual(value: JsonRecord): CustomVisual | null {
  return typeof value.id === "string" ? { ...value, id: value.id } : null;
}

export function getSelectedSlideCustomVisualId(selectedSlideSpec: JsonRecord | null): string {
  const customVisual = selectedSlideSpec && isRecord(selectedSlideSpec.customVisual) ? selectedSlideSpec.customVisual : null;
  return typeof customVisual?.id === "string"
    ? customVisual.id
    : "";
}

export function renderCustomVisualList(deps: CustomVisualRenderDependencies): void {
  const {
    createDomElement,
    customVisuals: rawCustomVisuals,
    elements,
    onAttach,
    selectedSlideId,
    selectedSlideSpec
  } = deps;

  if (!elements.customVisualList) {
    return;
  }

  const customVisuals = (Array.isArray(rawCustomVisuals) ? rawCustomVisuals : [])
    .map(toCustomVisual)
    .filter((customVisual): customVisual is CustomVisual => Boolean(customVisual));
  const selectedCustomVisualId = getSelectedSlideCustomVisualId(selectedSlideSpec);
  elements.customVisualDetachButton.disabled = !selectedSlideId || !selectedCustomVisualId;

  if (!customVisuals.length) {
    elements.customVisualList.replaceChildren(createDomElement("div", { className: "material-empty" }, [
      createDomElement("strong", { text: "No custom visuals yet" }),
      createDomElement("span", { text: "Save a sanitized static SVG to reuse it in this presentation." })
    ]));
    return;
  }

  elements.customVisualList.replaceChildren();
  customVisuals.forEach((customVisual: CustomVisual) => {
    const attached = customVisual.id === selectedCustomVisualId;
    const button = createDomElement("button", {
      attributes: {
        type: "button"
      },
      className: "secondary",
      disabled: !selectedSlideId || attached,
      text: attached ? "Attached" : "Attach"
    }) as HTMLButtonElement;
    const preview = createDomElement("div", {
      className: "custom-visual-card-preview"
    });
    preview.innerHTML = customVisual.content || "";
    const item = createDomElement("article", {
      className: `material-card custom-visual-card${attached ? " active" : ""}`
    }, [
      preview,
      createDomElement("div", { className: "material-card-copy" }, [
        createDomElement("strong", { text: customVisual.title || "Custom visual" }),
        createDomElement("span", { text: customVisual.description || customVisual.role || "Static SVG" })
      ]),
      button
    ]);
    button.addEventListener("click", () => onAttach(customVisual, button));
    elements.customVisualList.appendChild(item);
  });
}
