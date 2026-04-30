export namespace StudioClientSlidePreview {
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

  type DomRenderer = {
    renderSlideMarkup: (slideSpec: unknown, options: DomSlideRenderOptions) => string;
  };

  type DomSlideRenderOptions = {
    index?: number;
    theme?: unknown;
    totalSlides?: number;
  };

  const domSlideWidth = 960;
  let resizeObserver: ResizeObserver | null = null;

  function getResizeObserver(): ResizeObserver | null {
    if (!resizeObserver && typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          syncDomSlideViewport(entry.target as HTMLElement);
        });
      });
    }
    return resizeObserver;
  }

  function getDomRenderer(windowRef: Window): DomRenderer | null {
    return "SlideDomRenderer" in windowRef ? windowRef.SlideDomRenderer as DomRenderer : null;
  }

  function syncDomSlideViewport(viewport: HTMLElement | null): void {
    if (!viewport) {
      return;
    }

    const width = viewport.clientWidth || 0;
    const scale = width > 0 ? width / domSlideWidth : 1;
    viewport.style.setProperty("--dom-slide-scale", String(scale));
  }

  function observeDomSlideViewport(viewport: HTMLElement | null): void {
    if (!viewport) {
      return;
    }

    const observer = getResizeObserver();
    if (observer) {
      observer.observe(viewport);
    }

    syncDomSlideViewport(viewport);
  }

  export function createSlidePreview({
    createDomElement,
    getTheme,
    windowRef
  }: {
    createDomElement: CreateDomElement;
    getTheme: () => unknown;
    windowRef: Window;
  }) {
    function renderImagePreview(viewport: HTMLElement | null, url: string, alt: string): void {
      if (!viewport) {
        return;
      }

      if (!url) {
        viewport.replaceChildren();
        return;
      }

      viewport.replaceChildren(createDomElement("img", {
        attributes: {
          alt: alt || "Slide preview",
          src: url
        },
        className: "dom-slide-viewport__fallback-image"
      }));
    }

    function renderDomSlide(viewport: HTMLElement | null, slideSpec: unknown, options: DomSlideRenderOptions = {}): void {
      if (!viewport) {
        return;
      }

      const renderer = getDomRenderer(windowRef);
      if (!renderer || !slideSpec) {
        viewport.replaceChildren();
        return;
      }

      const renderOptions: DomSlideRenderOptions = {
        theme: options.theme || getTheme()
      };
      if (options.index !== undefined) {
        renderOptions.index = options.index;
      }
      if (options.totalSlides !== undefined) {
        renderOptions.totalSlides = options.totalSlides;
      }

      viewport.innerHTML = `
        <div class="dom-slide-viewport">
          <div class="dom-slide-viewport__stage">
            ${renderer.renderSlideMarkup(slideSpec, renderOptions)}
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
