import {
  normalizeOutlineLocks,
  type DeckPlan,
  type DeckPlanSlide
} from "./editable-outline-model.ts";
import { formatSourceOutlineText } from "./source-outline-model.ts";

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

type CreationOutlineElements = {
  presentationOutlineList: HTMLElement;
  presentationOutlineSummary: HTMLElement & {
    dataset: DOMStringMap;
    disabled: boolean;
    value: string;
  };
  presentationOutlineTitle: HTMLElement & {
    dataset: DOMStringMap;
    disabled: boolean;
    value: string;
  };
  presentationSourceEvidence: HTMLElement;
  presentationSourceOutline?: HTMLElement | null;
};

type CreationDraftWithOutline = {
  deckPlan?: DeckPlan;
  outlineLocks?: Record<string, boolean>;
  retrieval?: {
    snippets?: Array<{
      text?: string;
      title?: string;
    }>;
  };
};

type RenderOutlineOptions = {
  createDomElement: CreateDomElement;
  elements: CreationOutlineElements;
  workflowRunning: boolean;
};

export function renderQuickSourceOutline(deckPlan: DeckPlan | null, options: Pick<RenderOutlineOptions, "createDomElement" | "elements">): void {
  const slides = deckPlan?.slides || [];
  if (!options.elements.presentationSourceOutline) {
    return;
  }

  if (!slides.length) {
    options.elements.presentationSourceOutline.replaceChildren(
      options.createDomElement("strong", { text: "Quick source outline" }),
      options.createDomElement("p", { text: "No outline source guidance yet." })
    );
    return;
  }

  options.elements.presentationSourceOutline.replaceChildren(
    options.createDomElement("strong", { text: "Quick source outline" }),
    options.createDomElement("div", { className: "creation-source-outline-list" }, slides.map((slide: DeckPlanSlide, index: number) => options.createDomElement("article", {
      className: "creation-source-outline-item"
    }, [
      options.createDomElement("span", { text: index + 1 }),
      options.createDomElement("div", {}, [
        options.createDomElement("b", { text: slide.title || `Slide ${index + 1}` }),
        options.createDomElement("small", { text: formatSourceOutlineText(slide) })
      ])
    ])))
  );
}

export function renderCreationOutline(draft: CreationDraftWithOutline | null, options: RenderOutlineOptions): void {
  const { createDomElement, elements, workflowRunning } = options;
  const deckPlan = draft?.deckPlan || null;
  const slides = deckPlan?.slides || [];
  const outlineLocks = normalizeOutlineLocks(draft?.outlineLocks);
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
          textField("textarea", "Value", "value", slide.value || ""),
          textField("textarea", "Key message", "keyMessage", slide.keyMessage || slide.intent || ""),
          textField("textarea", "Source need", "sourceNeed", slide.sourceNeed || "No specific source need."),
          textField("textarea", "Source notes", "sourceNotes", slide.sourceNotes || slide.sourceText || "", {
            placeholder: "Paste excerpts, URLs, or reference notes for this outline beat."
          }),
          textField("textarea", "Image guidance", "visualNeed", slide.visualNeed || "Use supplied image materials only where they help this slide.")
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
  renderQuickSourceOutline(deckPlan, options);
}
