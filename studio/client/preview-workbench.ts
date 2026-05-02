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

  type DetourStack = {
    parentId: string;
    slideIds: string[];
  };

  type DeckNavigation = {
    coreSlideIds: string[];
    detours: DetourStack[];
    mode: "linear" | "two-dimensional";
  };

  type ThumbnailStack = {
    coreSlide: PreviewSlide;
    detourSlides: PreviewSlide[];
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
    context: {
      deck?: {
        navigation?: unknown;
      };
    };
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

    function asRecord(value: unknown): Record<string, unknown> | null {
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    }

    function uniqueStrings(value: unknown): string[] {
      if (!Array.isArray(value)) {
        return [];
      }

      const seen = new Set<string>();
      return value.reduce<string[]>((entries, item) => {
        if (typeof item !== "string") {
          return entries;
        }

        const trimmed = item.trim();
        if (!trimmed || seen.has(trimmed)) {
          return entries;
        }

        seen.add(trimmed);
        entries.push(trimmed);
        return entries;
      }, []);
    }

    function normalizeDeckNavigation(source: unknown, slides: PreviewSlide[]): DeckNavigation {
      const record = asRecord(source);
      const fallbackCoreSlideIds = slides.map((slide: PreviewSlide) => slide.id);
      if (!record || record.mode !== "two-dimensional") {
        return {
          coreSlideIds: fallbackCoreSlideIds,
          detours: [],
          mode: "linear"
        };
      }

      const knownSlideIds = new Set(fallbackCoreSlideIds);
      const coreSlideIds = uniqueStrings(record.coreSlideIds).filter((slideId: string) => knownSlideIds.has(slideId));
      const coreSet = new Set(coreSlideIds);
      const rawDetours = Array.isArray(record.detours) ? record.detours : [];
      const detours = rawDetours.reduce<DetourStack[]>((stacks, entry) => {
        const detour = asRecord(entry);
        const parentId = typeof detour?.parentId === "string" ? detour.parentId.trim() : "";
        const slideIds = uniqueStrings(detour?.slideIds).filter((slideId: string) => knownSlideIds.has(slideId) && slideId !== parentId);
        if (!parentId || !coreSet.has(parentId) || !slideIds.length) {
          return stacks;
        }

        stacks.push({ parentId, slideIds });
        return stacks;
      }, []);

      return {
        coreSlideIds: coreSlideIds.length ? coreSlideIds : fallbackCoreSlideIds,
        detours,
        mode: "two-dimensional"
      };
    }

    function getThumbnailStacks(): ThumbnailStack[] {
      const navigation = normalizeDeckNavigation(state.context.deck?.navigation, state.slides);
      if (navigation.mode !== "two-dimensional") {
        return state.slides.map((slide: PreviewSlide) => ({
          coreSlide: slide,
          detourSlides: []
        }));
      }

      const slidesById = new Map(state.slides.map((slide: PreviewSlide) => [slide.id, slide]));
      const detoursByParent = new Map(navigation.detours.map((detour: DetourStack) => [detour.parentId, detour.slideIds]));
      const includedSlideIds = new Set<string>();
      const stacks = navigation.coreSlideIds.reduce<ThumbnailStack[]>((entries, slideId: string) => {
        const coreSlide = slidesById.get(slideId);
        if (!coreSlide) {
          return entries;
        }

        includedSlideIds.add(coreSlide.id);
        const detourSlides = (detoursByParent.get(slideId) || [])
          .map((detourSlideId: string) => slidesById.get(detourSlideId))
          .filter((slide): slide is PreviewSlide => Boolean(slide));
        detourSlides.forEach((slide: PreviewSlide) => includedSlideIds.add(slide.id));
        entries.push({ coreSlide, detourSlides });
        return entries;
      }, []);

      state.slides
        .filter((slide: PreviewSlide) => !includedSlideIds.has(slide.id))
        .forEach((slide: PreviewSlide) => stacks.push({ coreSlide: slide, detourSlides: [] }));

      return stacks;
    }

    function renderThumbnailPreview(target: HTMLElement | null, slide: PreviewSlide): void {
      const page = state.previews.pages.find((entry: PreviewPage) => entry.index === slide.index) || null;
      const thumbSpec = slide.id === state.selectedSlideId && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(slide.id);
      if (thumbSpec) {
        renderDomSlide(target, thumbSpec, {
          index: slide.index,
          totalSlides: state.slides.length
        });
      } else if (page) {
        renderImagePreview(target, `${page.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${slide.title || `Slide ${slide.index}`} thumbnail`);
      }
    }

    function createThumbnailButton(slide: PreviewSlide, className: string, liveRunSlides: LiveRunSlide[]): HTMLElement {
      const liveRunSlide = liveRunSlides[slide.index - 1] as LiveRunSlide | null;
      const liveStatus = liveRunSlide && liveRunSlide.status ? liveRunSlide.status : "";
      const buttonOptions: Parameters<CreateDomElement>[1] = {
        attributes: {
          "aria-label": `Select slide ${slide.index}: ${slide.title || slide.fileName || "Untitled slide"}`,
          title: `${slide.index}. ${slide.title || slide.fileName || "Slide"}`,
          type: "button"
        },
        className: `${className}${slide.index === state.selectedSlideIndex ? " active" : ""}${liveStatus ? " thumb-live" : ""}`,
        dataset: { slideId: slide.id }
      };
      if (liveStatus) {
        buttonOptions.dataset = { ...buttonOptions.dataset, status: liveStatus };
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
      renderThumbnailPreview(button.querySelector<HTMLElement>(".thumb-preview"), slide);
      return button;
    }

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

      const thumbnailStacks = getThumbnailStacks().map((stack: ThumbnailStack) => {
        if (!stack.detourSlides.length) {
          return createThumbnailButton(stack.coreSlide, "thumb", liveRunSlides);
        }

        const stackActive = stack.coreSlide.index === state.selectedSlideIndex
          || stack.detourSlides.some((slide: PreviewSlide) => slide.index === state.selectedSlideIndex);
        return createDomElement("div", {
          className: `thumb-stack${stackActive ? " active" : ""}`,
          dataset: { slideId: stack.coreSlide.id }
        }, [
          createThumbnailButton(stack.coreSlide, "thumb thumb-core", liveRunSlides),
          createDomElement("div", { className: "thumb-detour-list" }, stack.detourSlides.map((slide: PreviewSlide) => (
            createThumbnailButton(slide, "thumb thumb-detour", liveRunSlides)
          )))
        ]);
      });
      elements.thumbRail.replaceChildren(...thumbnailStacks);

      elements.thumbRail.scrollLeft = thumbRailScrollLeft;
      elements.thumbRail.scrollTop = thumbRailScrollTop;
    }

    return {
      render
    };
  }
}
