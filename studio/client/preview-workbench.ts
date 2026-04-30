namespace StudioClientPreviewWorkbench {
  type PreviewWorkbenchDependencies = {
    customLayoutWorkbench: any;
    documentRef: Document;
    elements: Record<string, any>;
    enableDomSlideTextEditing: (viewport: any) => void;
    escapeHtml: (value: any) => string;
    getDomSlideSpec: (slideId: string) => any;
    getSelectedVariant: () => any;
    getVariantVisualTheme: (variant: any) => any;
    presentationCreationWorkbench: any;
    renderDomSlide: (viewport: any, slideSpec: any, options?: any) => void;
    renderImagePreview: (viewport: any, url: string, alt: string) => void;
    selectSlideByIndex: (index: number) => Promise<void>;
    state: any;
  };

  export function createPreviewWorkbench(dependencies: PreviewWorkbenchDependencies) {
    const {
      customLayoutWorkbench,
      documentRef,
      elements,
      enableDomSlideTextEditing,
      escapeHtml,
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
      elements.thumbRail.innerHTML = "";
      const liveRun = presentationCreationWorkbench.getLiveStudioContentRun();
      const liveRunSlides = liveRun && Array.isArray(liveRun.slides) ? liveRun.slides : [];

      if (!state.slides.length) {
        elements.activePreview.innerHTML = "";
        return;
      }

      const activeSlide = state.slides.find((entry) => entry.index === state.selectedSlideIndex) || state.slides[0];
      const activeSpec = activeSlide ? (state.selectedSlideId === activeSlide.id && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(activeSlide.id)) : null;
      const activePage = state.previews.pages.find((page) => activeSlide && page.index === activeSlide.index) || state.previews.pages[0] || null;
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
        elements.activePreview.innerHTML = "";
      }

      state.slides.forEach((slide) => {
        const page = state.previews.pages.find((entry) => entry.index === slide.index) || null;
        const thumbSpec = slide.id === state.selectedSlideId && state.selectedSlideSpec ? state.selectedSlideSpec : getDomSlideSpec(slide.id);
        const liveRunSlide = liveRunSlides[slide.index - 1] || null;
        const liveStatus = liveRunSlide && liveRunSlide.status ? liveRunSlide.status : "";
        const button = documentRef.createElement("button");
        button.className = `thumb${slide.index === state.selectedSlideIndex ? " active" : ""}${liveStatus ? " thumb-live" : ""}`;
        button.type = "button";
        if (liveStatus) {
          button.dataset.status = liveStatus;
        }
        button.title = `${slide.index}. ${slide.title || slide.fileName || "Slide"}`;
        button.setAttribute("aria-label", `Select slide ${slide.index}: ${slide.title || slide.fileName || "Untitled slide"}`);
        button.innerHTML = `
          <div class="thumb-preview"></div>
          <span class="thumb-index">${slide.index}</span>
          <strong>${escapeHtml(slide.title || `Slide ${slide.index}`)}</strong>
          <span>${escapeHtml(liveStatus ? `${presentationCreationWorkbench.getStatusLabel(liveStatus)} generation` : slide.fileName || `slide ${slide.index}`)}</span>
        `;
        button.addEventListener("click", () => {
          selectSlideByIndex(slide.index);
        });
        const thumbPreview = button.querySelector(".thumb-preview");
        if (thumbSpec) {
          renderDomSlide(thumbPreview, thumbSpec, {
            index: slide.index,
            totalSlides: state.slides.length
          });
        } else if (page) {
          renderImagePreview(thumbPreview, `${page.url}?t=${encodeURIComponent(state.previews.generatedAt || "")}`, `${slide.title || `Slide ${slide.index}`} thumbnail`);
        }
        elements.thumbRail.appendChild(button);
      });

      elements.thumbRail.scrollLeft = thumbRailScrollLeft;
      elements.thumbRail.scrollTop = thumbRailScrollTop;
    }

    return {
      render
    };
  }
}
