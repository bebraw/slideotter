namespace StudioClientSlidePreview {
  const domSlideWidth = 960;
  let resizeObserver = null;

  function getResizeObserver() {
    if (!resizeObserver && typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          syncDomSlideViewport(entry.target);
        });
      });
    }
    return resizeObserver;
  }

  function getDomRenderer(windowRef) {
    return windowRef.SlideDomRenderer || null;
  }

  function syncDomSlideViewport(viewport) {
    if (!viewport) {
      return;
    }

    const width = viewport.clientWidth || 0;
    const scale = width > 0 ? width / domSlideWidth : 1;
    viewport.style.setProperty("--dom-slide-scale", String(scale));
  }

  function observeDomSlideViewport(viewport) {
    if (!viewport) {
      return;
    }

    const observer = getResizeObserver();
    if (observer) {
      observer.observe(viewport);
    }

    syncDomSlideViewport(viewport);
  }

  export function createSlidePreview({ escapeHtml, getTheme, windowRef }) {
    function renderImagePreview(viewport, url, alt) {
      if (!viewport) {
        return;
      }

      if (!url) {
        viewport.innerHTML = "";
        return;
      }

      viewport.innerHTML = `<img class="dom-slide-viewport__fallback-image" src="${escapeHtml(url)}" alt="${escapeHtml(alt || "Slide preview")}">`;
    }

    function renderDomSlide(viewport, slideSpec, options: any = {}) {
      if (!viewport) {
        return;
      }

      const renderer = getDomRenderer(windowRef);
      if (!renderer || !slideSpec) {
        viewport.innerHTML = "";
        return;
      }

      viewport.innerHTML = `
        <div class="dom-slide-viewport">
          <div class="dom-slide-viewport__stage">
            ${renderer.renderSlideMarkup(slideSpec, {
              index: options.index,
              theme: options.theme || getTheme(),
              totalSlides: options.totalSlides
            })}
          </div>
        </div>
      `;
      observeDomSlideViewport(viewport.querySelector(".dom-slide-viewport"));
    }

    return {
      renderDomSlide,
      renderImagePreview
    };
  }
}
(globalThis as any).StudioClientSlidePreview = StudioClientSlidePreview;
