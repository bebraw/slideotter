import type { StudioClientElements } from "./elements.ts";

export namespace StudioClientPreviewWorkbench {
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

  type PreviewPage = {
    generatedAt?: string;
    index: number;
    url: string;
  };

  type PreviewSlide = {
    fileName?: string;
    id: string;
    index: number;
    title?: string;
  };

  type SelectedVariant = {
    label?: string;
    previewImage?: {
      url: string;
    };
    slideSpec?: unknown;
    visualTheme?: unknown;
  };

  type LiveRunSlide = {
    status?: string;
  };

  type SlideSpec = Record<string, unknown>;

  type LiveStudioContentRun = {
    slides?: LiveRunSlide[];
  };

  type PreviewState = {
    previews: {
      generatedAt?: string;
      pages: PreviewPage[];
    };
    selectedSlideId: string | null;
    selectedSlideIndex: number;
    selectedSlideSpec: SlideSpec | null;
    slides: PreviewSlide[];
  };

  type DomSlideRenderOptions = {
    index?: number;
    theme?: unknown;
    totalSlides?: number;
  };

  type CustomLayoutWorkbench = {
    getLivePreviewSlideSpec: (slide: PreviewSlide | undefined, slideSpec: SlideSpec | null) => SlideSpec | null;
  };

  type PresentationCreationWorkbench = {
    getLiveStudioContentRun: () => LiveStudioContentRun | null;
    getStatusLabel: (status: string) => string;
  };

  type PreviewWorkbenchDependencies = {
    createDomElement: CreateDomElement;
    customLayoutWorkbench: CustomLayoutWorkbench;
    elements: StudioClientElements.Elements;
    enableDomSlideTextEditing: (viewport: HTMLElement) => void;
    getDomSlideSpec: (slideId: string) => SlideSpec | null;
    getSelectedVariant: () => SelectedVariant | null;
    getVariantVisualTheme: (variant: SelectedVariant | null) => unknown;
    presentationCreationWorkbench: PresentationCreationWorkbench;
    renderDomSlide: (viewport: HTMLElement | null, slideSpec: unknown, options?: DomSlideRenderOptions) => void;
    renderImagePreview: (viewport: HTMLElement | null, url: string, alt: string) => void;
    selectSlideByIndex: (index: number) => Promise<void>;
    state: PreviewState;
  };

  export function createPreviewWorkbench(dependencies: PreviewWorkbenchDependencies) {
    const {
      createDomElement,
      customLayoutWorkbench,
      elements,
      enableDomSlideTextEditing,
      getDomSlideSpec,
      getSelectedVariant,
      getVariantVisualTheme,
      presentationCreationWorkbench,
      renderDomSlide,
      renderImagePreview,
      selectSlideByIndex,
      state
    } = dependencies;

    function render() {
      const thumbRailScrollLeft = elements.thumbRail.scrollLeft;
      const thumbRailScrollTop = elements.thumbRail.scrollTop;
      elements.thumbRail.replaceChildren();
      const liveRun = presentationCreationWorkbench.getLiveStudioContentRun();
      const liveRunSlides = liveRun && Array.isArray(liveRun.slides) ? liveRun.slides : [];

      if (!state.slides.length) {
        elements.activePreview.replaceChildren();
        return;
      }

      const activeSlide = state.slides.find((entry: PreviewSlide) => entry.index === state.selectedSlideIndex) || state.slides[0];
      if (!activeSlide) {
        elements.activePreview.replaceChildren();
        return;
      }

      const activeSpec = state.selectedSlideId === activeSlide.id && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(activeSlide.id);
      const activePage = state.previews.pages.find((page: PreviewPage) => activeSlide && page.index === activeSlide.index) || state.previews.pages[0] || null;
      const selectedVariant = getSelectedVariant();
      const selectedVariantTheme = getVariantVisualTheme(selectedVariant);
      const liveCustomLayoutSpec = customLayoutWorkbench.getLivePreviewSlideSpec(activeSlide, activeSpec);
      const previewSpec = liveCustomLayoutSpec
        ? liveCustomLayoutSpec
        : selectedVariant && selectedVariant.slideSpec
        ? selectedVariant.slideSpec
        : selectedVariant && selectedVariantTheme && activeSpec
          ? activeSpec
          : activeSpec;
      const previewTheme = selectedVariant && selectedVariant.slideSpec
        ? selectedVariantTheme || undefined
        : selectedVariant && selectedVariantTheme
          ? selectedVariantTheme
          : undefined;

      if (previewSpec) {
        renderDomSlide(elements.activePreview, previewSpec, {
          index: activeSlide.index,
          theme: previewTheme,
          totalSlides: state.slides.length
        });
        if (!selectedVariant) {
          enableDomSlideTextEditing(elements.activePreview);
        }
      } else if (selectedVariant && selectedVariant.previewImage) {
        renderImagePreview(elements.activePreview, selectedVariant.previewImage.url, `${selectedVariant.label} preview`);
      } else if (activePage) {
        renderImagePreview(elements.activePreview, `${activePage.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${activeSlide ? activeSlide.title : "Slide"} preview`);
      } else {
        elements.activePreview.replaceChildren();
      }

      const thumbnailButtons = state.slides.map((slide: PreviewSlide) => {
        const page = state.previews.pages.find((entry: PreviewPage) => entry.index === slide.index) || null;
        const thumbSpec = slide.id === state.selectedSlideId && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(slide.id);
        const liveRunSlide = liveRunSlides[slide.index - 1] as LiveRunSlide | null;
        const liveStatus = liveRunSlide && liveRunSlide.status ? liveRunSlide.status : "";
        const buttonOptions: Parameters<CreateDomElement>[1] = {
          attributes: {
            "aria-label": `Select slide ${slide.index}: ${slide.title || slide.fileName || "Untitled slide"}`,
            title: `${slide.index}. ${slide.title || slide.fileName || "Slide"}`,
            type: "button"
          },
          className: `thumb${slide.index === state.selectedSlideIndex ? " active" : ""}${liveStatus ? " thumb-live" : ""}`
        };
        buttonOptions.dataset = { slideId: slide.id };
        if (liveStatus) {
          buttonOptions.dataset.status = liveStatus;
        }
        const button = createDomElement("button", buttonOptions, [
          createDomElement("div", { className: "thumb-preview" }),
          createDomElement("span", { className: "thumb-index", text: slide.index }),
          createDomElement("strong", { text: slide.title || `Slide ${slide.index}` }),
          createDomElement("span", {
            text: liveStatus ? `${presentationCreationWorkbench.getStatusLabel(liveStatus)} generation` : slide.fileName || `slide ${slide.index}`
          })
        ]);
        button.addEventListener("click", () => {
          selectSlideByIndex(slide.index);
        });
        const thumbPreview = button.querySelector<HTMLElement>(".thumb-preview");
        if (thumbSpec) {
          renderDomSlide(thumbPreview, thumbSpec, {
            index: slide.index,
            totalSlides: state.slides.length
          });
        } else if (page) {
          renderImagePreview(thumbPreview, `${page.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${slide.title || `Slide ${slide.index}`} thumbnail`);
        }
        return button;
      });
      elements.thumbRail.replaceChildren(...thumbnailButtons);

      elements.thumbRail.scrollLeft = thumbRailScrollLeft;
      elements.thumbRail.scrollTop = thumbRailScrollTop;
    }

    return {
      render
    };
  }
}
