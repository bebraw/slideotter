type SlideDomRendererApi = {
  normalizeTheme: (input: unknown) => unknown;
  renderDeckDocument: (payload: unknown) => string;
  renderDeckMarkup: (slides: unknown, options?: Record<string, unknown>) => string;
  renderPresentationDocument: (payload: unknown) => string;
  renderSlideDocument: (payload: unknown) => string;
  renderSlideMarkup: (slideSpec: unknown, options?: Record<string, unknown>) => string;
};

(function attachSlideDomRenderer(globalScope: (typeof globalThis & { SlideDomRenderer?: SlideDomRendererApi }) | null) {
  type JsonRecord = Record<string, unknown>;

  type Theme = {
    accent: string;
    bg: string;
    fontFamily: string;
    light: string;
    muted: string;
    panel: string;
    primary: string;
    progressFill: string;
    progressTrack: string;
    secondary: string;
    surface: string;
  };

  type CardItem = JsonRecord & {
    body?: unknown;
    label?: unknown;
    source?: unknown;
    title?: unknown;
    value?: unknown;
  };

  type MediaItem = JsonRecord & {
    alt?: unknown;
    caption?: unknown;
    source?: unknown;
    src?: unknown;
  };

  type SlotRegion = JsonRecord & {
    column?: unknown;
    columnSpan?: unknown;
    row?: unknown;
    rowSpan?: unknown;
    slot?: unknown;
    spacing?: unknown;
  };

  type SlotRegionLayoutDefinition = JsonRecord & {
    constraints?: JsonRecord;
    regions: SlotRegion[];
    type: "slotRegionLayout";
  };

  type SlideSpec = JsonRecord & {
    attribution?: unknown;
    bullets?: unknown;
    caption?: unknown;
    cards?: unknown;
    context?: unknown;
    customVisual?: unknown;
    eyebrow?: unknown;
    guardrails?: unknown;
    guardrailsTitle?: unknown;
    id?: unknown;
    index?: unknown;
    layout?: unknown;
    layoutDefinition?: unknown;
    logo?: unknown;
    media?: unknown;
    mediaItems?: unknown;
    note?: unknown;
    quote?: unknown;
    resources?: unknown;
    resourcesTitle?: unknown;
    signals?: unknown;
    signalsTitle?: unknown;
    source?: unknown;
    summary?: unknown;
    title?: unknown;
    type?: unknown;
  };

  type SlideEntry = JsonRecord & {
    id?: unknown;
    index?: unknown;
    presentationX?: unknown;
    presentationY?: unknown;
    slideSpec?: unknown;
  };

  type DocumentMetadata = JsonRecord & {
    author?: unknown;
    company?: unknown;
    objective?: unknown;
    subject?: unknown;
  };

  type RenderSlideOptions = JsonRecord & {
    index?: unknown;
    presentationX?: unknown;
    presentationY?: unknown;
    slideId?: unknown;
    theme?: unknown;
    totalSlides?: unknown;
  };

  type DocumentPayload = JsonRecord & {
    index?: unknown;
    inlineCss?: unknown;
    lang?: unknown;
    metadata?: unknown;
    slideId?: unknown;
    slides?: unknown;
    slideSpec?: unknown;
    theme?: unknown;
    title?: unknown;
    totalSlides?: unknown;
  };

  type RendererApi = {
    normalizeTheme: (input: unknown) => Theme;
    renderDeckDocument: (payload: unknown) => string;
    renderDeckMarkup: (slides: unknown, options?: RenderSlideOptions) => string;
    renderPresentationDocument: (payload: unknown) => string;
    renderSlideDocument: (payload: unknown) => string;
    renderSlideMarkup: (slideSpec: unknown, options?: RenderSlideOptions) => string;
  };

  const baseTheme: Theme = {
    accent: "f28f3b",
    bg: "f5f8fc",
    fontFamily: "\"Avenir Next\", \"Helvetica Neue\", \"Segoe UI\", sans-serif",
    light: "d7e6f5",
    muted: "56677c",
    panel: "f8fbfe",
    primary: "183153",
    progressFill: "275d8c",
    progressTrack: "d7e6f5",
    secondary: "275d8c",
    surface: "ffffff"
  };

  function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function asRecord(value: unknown): JsonRecord {
    return isRecord(value) ? value : {};
  }

  function toSlideSpec(value: unknown): SlideSpec {
    return asRecord(value);
  }

  function toDocumentPayload(value: unknown): DocumentPayload {
    return asRecord(value);
  }

  function toItems(value: unknown): CardItem[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
  }

  function toMediaItems(value: unknown): MediaItem[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
  }

  function toSlideEntries(value: unknown): SlideEntry[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
  }

  function escapeHtml(value: unknown): string {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function editAttrs(path: string, label?: string): string {
    return ` data-edit-path="${escapeHtml(path)}" data-edit-label="${escapeHtml(label || path)}"`;
  }

  function normalizeColor(value: unknown, fallback: string): string {
    const normalized = String(value || "").trim().replace(/^#/, "").toLowerCase();
    return /^[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
  }

  function hexToRgb(hex: unknown): { b: number; g: number; r: number } {
    const normalized = normalizeColor(hex, "000000");
    return {
      b: parseInt(normalized.slice(4, 6), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      r: parseInt(normalized.slice(0, 2), 16)
    };
  }

  function luminanceChannel(value: number): number {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(hex: unknown): number {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * luminanceChannel(r)) +
      (0.7152 * luminanceChannel(g)) +
      (0.0722 * luminanceChannel(b));
  }

  function contrastRatio(foreground: unknown, background: unknown): number {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function ensureContrast(color: unknown, background: string, minRatio: number, candidates: string[] = []): string {
    const normalized = normalizeColor(color, baseTheme.primary);
    if (contrastRatio(normalized, background) >= minRatio) {
      return normalized;
    }

    return [...candidates, "101820", "ffffff", "f7fcfb"]
      .map((candidate) => normalizeColor(candidate, baseTheme.primary))
      .sort((a: string, b: string) => contrastRatio(b, background) - contrastRatio(a, background))[0] || normalized;
  }

  function withHash(color: unknown): string {
    return `#${String(color || "").replace(/^#/, "")}`;
  }

  function normalizeFontFamily(value: unknown): string {
    const key = String(value || "").trim().toLowerCase();
    const allowed: Record<string, string> = {
      avenir: "\"Avenir Next\", \"Helvetica Neue\", \"Segoe UI\", sans-serif",
      editorial: "Georgia, \"Times New Roman\", serif",
      mono: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
      workshop: "\"Trebuchet MS\", Verdana, sans-serif"
    };

    return allowed[key] || Object.values(allowed).find((stack) => stack.toLowerCase() === key) || baseTheme.fontFamily;
  }

  function normalizeLayoutName(value: unknown): string {
    const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (normalized === "default") {
      return "standard";
    }
    return normalized || "standard";
  }

  function normalizeGridNumber(value: unknown, fallback: number, min: number, max: number): number {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, number));
  }

  function getSlotRegionLayoutDefinition(slideSpec: SlideSpec): SlotRegionLayoutDefinition | null {
    const definition = isRecord(slideSpec.layoutDefinition)
      ? slideSpec.layoutDefinition
      : null;
    if (!definition || definition.type !== "slotRegionLayout" || !Array.isArray(definition.regions)) {
      return null;
    }
    return {
      ...definition,
      regions: definition.regions.filter(isRecord),
      type: "slotRegionLayout"
    };
  }

  function renderSlotRegionStyle(region: SlotRegion, definition: SlotRegionLayoutDefinition): string {
    const minFontSize = definition && definition.constraints
      ? normalizeGridNumber(definition.constraints.minFontSize, 18, 12, 44)
      : 18;
    const column = normalizeGridNumber(region && region.column, 1, 1, 12);
    const columnSpan = normalizeGridNumber(region && region.columnSpan, 4, 1, 12);
    const row = normalizeGridNumber(region && region.row, 1, 1, 8);
    const rowSpan = normalizeGridNumber(region && region.rowSpan, 2, 1, 8);

    return [
      `grid-column:${column} / span ${columnSpan}`,
      `grid-row:${row} / span ${rowSpan}`,
      `--dom-custom-min-font:${minFontSize}px`
    ].join(";");
  }

  function normalizeTheme(input: unknown): Theme {
    const source = asRecord(input);
    const bg = normalizeColor(source.bg, baseTheme.bg);
    const requestedPrimary = normalizeColor(source.primary, baseTheme.primary);
    const requestedSecondary = normalizeColor(source.secondary, baseTheme.secondary);
    const requestedAccent = normalizeColor(source.accent, baseTheme.accent);
    const requestedMuted = normalizeColor(source.muted, baseTheme.muted);
    const primary = ensureContrast(requestedPrimary, bg, 4.5);
    const secondary = ensureContrast(requestedSecondary, bg, 4.5, [primary]);
    const accent = ensureContrast(requestedAccent, bg, 3, [secondary, primary]);
    const muted = ensureContrast(requestedMuted, bg, 4.5, [primary, secondary]);
    const progressTrack = normalizeColor(source.progressTrack || source.light, baseTheme.progressTrack);
    const progressFill = ensureContrast(
      normalizeColor(source.progressFill || secondary, baseTheme.progressFill),
      progressTrack,
      3,
      [primary, secondary]
    );

    return {
      accent,
      bg,
      fontFamily: normalizeFontFamily(source.fontFamily),
      light: normalizeColor(source.light, baseTheme.light),
      muted,
      panel: normalizeColor(source.panel, baseTheme.panel),
      primary,
      progressFill,
      progressTrack,
      secondary,
      surface: normalizeColor(source.surface, baseTheme.surface)
    };
  }

  function renderThemeVars(theme: Theme): string {
    const onPanel = ensureContrast(theme.primary, theme.panel, 4.5);
    const onPanelMuted = ensureContrast(theme.muted, theme.panel, 4.5, [onPanel]);
    const onSurface = ensureContrast(theme.primary, theme.surface, 4.5);
    const onSurfaceMuted = ensureContrast(theme.muted, theme.surface, 4.5, [onSurface]);

    return [
      `--dom-accent:${withHash(theme.accent)}`,
      `--dom-bg:${withHash(theme.bg)}`,
      `--dom-font-family:${theme.fontFamily}`,
      `--dom-light:${withHash(theme.light)}`,
      `--dom-muted:${withHash(theme.muted)}`,
      `--dom-on-panel:${withHash(onPanel)}`,
      `--dom-on-panel-muted:${withHash(onPanelMuted)}`,
      `--dom-on-surface:${withHash(onSurface)}`,
      `--dom-on-surface-muted:${withHash(onSurfaceMuted)}`,
      `--dom-panel:${withHash(theme.panel)}`,
      `--dom-primary:${withHash(theme.primary)}`,
      `--dom-progress-fill:${withHash(theme.progressFill)}`,
      `--dom-progress-track:${withHash(theme.progressTrack)}`,
      `--dom-secondary:${withHash(theme.secondary)}`,
      `--dom-surface:${withHash(theme.surface)}`
    ].join(";");
  }

  function renderPageBadge(index: unknown, total: unknown): string {
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 1;
    const safeTotal = Number.isFinite(Number(total)) && Number(total) > 0 ? Number(total) : safeIndex;
    const progress = Math.max(0, Math.min(100, (safeIndex / safeTotal) * 100));

    return `
      <div class="dom-slide__badge" aria-label="Slide ${safeIndex} of ${safeTotal}">
        <div class="dom-slide__badge-track">
          <div class="dom-slide__badge-fill" style="width:${progress}%;"></div>
        </div>
      </div>
    `;
  }

  function renderSectionHeader(slideSpec: SlideSpec): string {
    return `
      <header class="dom-slide__section-header">
        <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
        <p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
      </header>
    `;
  }

  function mediaImageStyle(media: JsonRecord, fallbackFit = "contain"): string {
    const fit = String(media.fit || "").trim().toLowerCase() === "cover"
      ? "cover"
      : String(media.fit || "").trim().toLowerCase() === "contain"
        ? "contain"
        : fallbackFit;
    const focalPoint = String(media.focalPoint || "").trim().toLowerCase();
    const focalPoints: Record<string, string> = {
      "bottom": "50% 100%",
      "bottom-left": "0% 100%",
      "bottom-right": "100% 100%",
      "center": "50% 50%",
      "left": "0% 50%",
      "right": "100% 50%",
      "top": "50% 0%",
      "top-left": "0% 0%",
      "top-right": "100% 0%"
    };
    return `object-fit:${fit};object-position:${focalPoints[focalPoint] || focalPoints.center}`;
  }

  function renderSlideMedia(slideSpec: SlideSpec): string {
    const media = isRecord(slideSpec.media)
      ? slideSpec.media
      : null;
    if (!media || !media.src || !media.alt) {
      return "";
    }

    const caption = media.caption
      ? `<figcaption class="dom-caption"><span class="source">${escapeHtml(media.caption)}</span></figcaption>`
      : "";

    return `
      <figure class="dom-slide__media dom-media">
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" style="${escapeHtml(mediaImageStyle(media, "contain"))}">
        ${caption}
      </figure>
    `;
  }

  function renderCustomVisual(slideSpec: SlideSpec): string {
    const customVisual = isRecord(slideSpec.customVisual)
      ? slideSpec.customVisual
      : null;
    if (!customVisual || !customVisual.content) {
      return "";
    }

    const description = customVisual.description || customVisual.title || "";
    const caption = description
      ? `<figcaption class="dom-caption"><span class="source">${escapeHtml(description)}</span></figcaption>`
      : "";

    return `
      <figure class="dom-slide__media dom-slide__custom-visual" aria-label="${escapeHtml(customVisual.title || "Custom visual")}">
        <div class="dom-slide__custom-visual-frame">
          ${String(customVisual.content)}
        </div>
        ${caption}
      </figure>
    `;
  }

  function renderCompactCard(card: CardItem, index: number, basePath: string): string {
    const path = basePath ? `${basePath}.${index}` : `cards.${index}`;
    return `
      <article class="dom-card">
        <h3${editAttrs(`${path}.title`, "Card title")}>${escapeHtml(card.title || "")}</h3>
        <p${editAttrs(`${path}.body`, "Card body")}>${escapeHtml(card.body || "")}</p>
      </article>
    `;
  }

  function renderSlideotterLogo(): string {
    return `
      <figure class="dom-slide__cover-logo" aria-label="slideotter logo">
        <svg viewBox="0 0 152 152" role="img" aria-hidden="true">
          <rect x="0" y="0" width="152" height="152" rx="30" fill="var(--dom-surface, #ffffff)" stroke="var(--dom-primary, #183153)" stroke-width="10"></rect>
          <path d="M28 104C33 66 55 43 88 38C118 34 139 51 146 78C151 98 144 118 126 132C108 146 81 150 57 141C38 134 27 120 28 104Z" fill="var(--dom-secondary, #275d8c)"></path>
          <path d="M38 91C45 69 63 57 88 57C111 57 128 70 132 92C136 113 119 130 92 134C63 138 31 119 38 91Z" fill="var(--dom-panel, #f8fbfe)"></path>
          <circle cx="68" cy="82" r="5.5" fill="var(--dom-primary, #183153)"></circle>
          <circle cx="109" cy="82" r="5.5" fill="var(--dom-primary, #183153)"></circle>
          <path d="M86 96C90 93 96 93 100 96C98 102 94 105 90 105C86 105 83 102 86 96Z" fill="var(--dom-primary, #183153)"></path>
          <path d="M52 31C51 17 61 8 73 13C84 18 84 34 73 42Z" fill="var(--dom-secondary, #275d8c)"></path>
          <path d="M111 42C100 34 100 18 111 13C123 8 133 17 132 31Z" fill="var(--dom-secondary, #275d8c)"></path>
          <path d="M27 48C14 49 5 59 10 71C15 82 31 82 39 71Z" fill="var(--dom-accent, #f28f3b)"></path>
          <path d="M121 131C140 124 151 111 154 94" fill="none" stroke="var(--dom-accent, #f28f3b)" stroke-width="12" stroke-linecap="round"></path>
          <path d="M75 111C83 117 96 117 104 111" fill="none" stroke="var(--dom-primary, #183153)" stroke-width="5" stroke-linecap="round"></path>
          <path d="M54 99H25M55 109H28M122 99H151M121 109H148" fill="none" stroke="var(--dom-primary, #183153)" stroke-width="4" stroke-linecap="round" opacity="0.72"></path>
        </svg>
      </figure>
    `;
  }

  function renderCover(slideSpec: SlideSpec): string {
    const cards = toItems(slideSpec.cards);
    const logo = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec) || (slideSpec.logo === "slideotter" ? renderSlideotterLogo() : "");
    const customLayoutDefinition = getSlotRegionLayoutDefinition(slideSpec);
    if (customLayoutDefinition) {
      const regions = customLayoutDefinition.regions.map((region: SlotRegion) => {
        const slot = region && region.slot ? String(region.slot) : "";
        const style = renderSlotRegionStyle(region, customLayoutDefinition);
        const spacing = region && region.spacing ? String(region.spacing).replace(/[^a-z0-9-]/gi, "") : "normal";
        const body = (() => {
          if (slot === "title") {
            return `
              ${logo}
              <div class="dom-slide__cover-rule"></div>
              <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
              <h1 class="dom-slide__cover-title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
            `;
          }
          if (slot === "summary") {
            return `<p class="dom-slide__cover-summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>`;
          }
          if (slot === "note") {
            return `<p class="dom-slide__cover-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>`;
          }
          if (slot === "cards") {
            return `
              <section class="dom-slide__cover-cards">
                ${cards.map((card: CardItem, index: number) => renderCompactCard(card, index, "cards")).join("")}
              </section>
            `;
          }
          return "";
        })();

        return body ? `
          <section class="dom-slide__custom-layout-region dom-slide__custom-layout-region--${escapeHtml(slot || "slot")} dom-slide__custom-layout-region--${escapeHtml(spacing)}" style="${escapeHtml(style)}">
            ${body}
          </section>
        ` : "";
      }).join("");

      return `
        <div class="dom-slide__custom-layout-grid dom-slide__custom-layout-grid--cover">
          ${regions}
        </div>
      `;
    }

    return `
      <div class="dom-slide__cover-grid">
        <section class="dom-slide__cover-copy">
          ${logo}
          <div class="dom-slide__cover-rule"></div>
          <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
          <h1 class="dom-slide__cover-title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
          <p class="dom-slide__cover-summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
          <p class="dom-slide__cover-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>
        </section>
        <section class="dom-slide__cover-cards">
          ${cards.map((card: CardItem, index: number) => renderCompactCard(card, index, "cards")).join("")}
        </section>
      </div>
    `;
  }

  function renderDivider(slideSpec: SlideSpec): string {
    return `
      <section class="dom-slide__divider-title">
        <h1 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
      </section>
    `;
  }

  function renderQuote(slideSpec: SlideSpec): string {
    const attribution = slideSpec.attribution
      ? `<p class="dom-slide__quote-attribution"${editAttrs("attribution", "Attribution")}>${escapeHtml(slideSpec.attribution)}</p>`
      : "";
    const source = slideSpec.source
      ? `<p class="dom-slide__quote-source"${editAttrs("source", "Source")}>${escapeHtml(slideSpec.source)}</p>`
      : "";
    const context = slideSpec.context
      ? `<p class="dom-slide__quote-context"${editAttrs("context", "Context")}>${escapeHtml(slideSpec.context)}</p>`
      : "";

    return `
      <section class="dom-slide__quote-wrap">
        <p class="dom-slide__eyebrow"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</p>
        <blockquote class="dom-slide__quote"${editAttrs("quote", "Quote")}>${escapeHtml(slideSpec.quote || "")}</blockquote>
        <footer class="dom-slide__quote-footer">
          ${attribution}
          ${source}
          ${context}
        </footer>
      </section>
    `;
  }

  function renderPhoto(slideSpec: SlideSpec): string {
    const media = isRecord(slideSpec.media)
      ? slideSpec.media
      : null;
    const caption = slideSpec.caption || (media && media.caption) || "";
    const mediaMarkup = media && media.src && media.alt
      ? `
        <figure class="dom-slide__media dom-media">
          <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" style="${escapeHtml(mediaImageStyle(media, "cover"))}">
          ${caption ? `<figcaption class="dom-caption"${editAttrs("caption", "Caption")}><span class="source">${escapeHtml(caption)}</span></figcaption>` : ""}
        </figure>
      `
      : "";

    return `
      <section class="dom-slide__photo-wrap">
        <header class="dom-slide__photo-header">
          <h1 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
        </header>
        ${mediaMarkup}
      </section>
    `;
  }

  function renderPhotoGrid(slideSpec: SlideSpec): string {
    const mediaItems = toMediaItems(slideSpec.mediaItems).slice(0, 4);
    const count = Math.max(2, Math.min(4, mediaItems.length));
    const caption = slideSpec.caption || slideSpec.summary || "";
    const itemsMarkup = mediaItems.map((media: MediaItem) => {
      const itemCaption = media.caption || media.source || "";
      return `
        <figure class="dom-slide__photo-grid-item dom-slide__media dom-media">
          <img src="${escapeHtml(media.src || "")}" alt="${escapeHtml(media.alt || "")}" style="${escapeHtml(mediaImageStyle(media, "cover"))}">
          ${itemCaption ? `<figcaption class="dom-caption"><span class="source">${escapeHtml(itemCaption)}</span></figcaption>` : ""}
        </figure>
      `;
    }).join("");

    return `
      <section class="dom-slide__photo-grid-wrap dom-slide__photo-grid-wrap--${count}">
        <header class="dom-slide__photo-grid-header">
          <h1 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h1>
          ${caption ? `<p class="dom-slide__summary"${editAttrs(slideSpec.caption ? "caption" : "summary", "Caption")}>${escapeHtml(caption)}</p>` : ""}
        </header>
        <div class="dom-slide__photo-grid">
          ${itemsMarkup}
        </div>
      </section>
    `;
  }

  function renderToc(slideSpec: SlideSpec): string {
    const cards = toItems(slideSpec.cards);
    const media = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec);
    return `
      ${renderSectionHeader(slideSpec)}
      <section class="dom-slide__toc-body${media ? " dom-slide__toc-body--with-media" : ""}">
        <div class="dom-slide__toc-copy">
          <div class="dom-slide__toc-cards">
            ${cards.map((card: CardItem, index: number) => renderCompactCard(card, index, "cards")).join("")}
          </div>
          <p class="dom-slide__toc-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>
        </div>
        ${media}
      </section>
    `;
  }

  function renderContent(slideSpec: SlideSpec): string {
    const signals = toItems(slideSpec.signals);
    const guardrails = toItems(slideSpec.guardrails);
    const renderSignalCards = signals.some((item: CardItem) => Boolean(item && (item.title || item.body)));
    const renderGuardrailCards = guardrails.some((item: CardItem) => Boolean(item && (item.title || item.body)));
    const media = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec);
    const customLayoutDefinition = !media ? getSlotRegionLayoutDefinition(slideSpec) : null;
    const signalsMarkup = renderSignalCards ? `
      <div class="dom-evidence-list">
        ${signals.map((item: CardItem, index: number) => renderEvidenceItem(item, index, "signals", "Signal")).join("")}
      </div>
    ` : `
      <div class="dom-signal-list">
        ${signals.map((item: CardItem, index: number) => {
          const value = Math.max(0, Math.min(100, Math.round(Number(item.value || 0) * 100)));
          return `
            <div class="dom-signal">
              <div class="dom-signal__meta">
                <span${editAttrs(`signals.${index}.label`, "Signal label")}>${escapeHtml(item.label || "")}</span>
                <strong>${value}%</strong>
              </div>
              <div class="dom-signal__track">
                <div class="dom-signal__fill" style="width:${value}%;"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
    const guardrailsMarkup = renderGuardrailCards ? `
      <div class="dom-evidence-list">
        ${guardrails.map((item: CardItem, index: number) => renderEvidenceItem(item, index, "guardrails", "Guardrail")).join("")}
      </div>
    ` : `
      <div class="dom-guardrail-list">
        ${guardrails.map((item: CardItem, index: number) => `
          <div class="dom-guardrail${index < guardrails.length - 1 ? " dom-guardrail--divided" : ""}">
            <strong${editAttrs(`guardrails.${index}.value`, "Guardrail value")}>${escapeHtml(item.value || "")}</strong>
            <span${editAttrs(`guardrails.${index}.label`, "Guardrail label")}>${escapeHtml(item.label || "")}</span>
          </div>
        `).join("")}
      </div>
    `;
    if (customLayoutDefinition) {
      const regions = customLayoutDefinition.regions.map((region: SlotRegion) => {
        const slot = region && region.slot ? String(region.slot) : "";
        const style = renderSlotRegionStyle(region, customLayoutDefinition);
        const spacing = region && region.spacing ? String(region.spacing).replace(/[^a-z0-9-]/gi, "") : "normal";
        const body = (() => {
          if (slot === "title") {
            return `
              <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
              <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
            `;
          }
          if (slot === "summary") {
            return `<p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>`;
          }
          if (slot === "signals") {
            return `
              <article class="dom-panel dom-panel--signals">
                <h3${editAttrs("signalsTitle", "Signals title")}>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
                ${signalsMarkup}
              </article>
            `;
          }
          if (slot === "guardrails") {
            return `
              <article class="dom-panel dom-panel--guardrails">
                <h3${editAttrs("guardrailsTitle", "Guardrails title")}>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
                ${guardrailsMarkup}
              </article>
            `;
          }
          return "";
        })();

        return body ? `
          <section class="dom-slide__custom-layout-region dom-slide__custom-layout-region--${escapeHtml(slot || "slot")} dom-slide__custom-layout-region--${escapeHtml(spacing)}" style="${escapeHtml(style)}">
            ${body}
          </section>
        ` : "";
      }).join("");

      return `
        <div class="dom-slide__custom-layout-grid">
          ${regions}
        </div>
      `;
    }
    const columnsMarkup = `
        <div class="dom-slide__content-columns${media ? " dom-slide__content-columns--stacked" : ""}">
          <article class="dom-panel dom-panel--signals">
            <h3${editAttrs("signalsTitle", "Signals title")}>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
            ${signalsMarkup}
          </article>
          <article class="dom-panel dom-panel--guardrails">
            <h3${editAttrs("guardrailsTitle", "Guardrails title")}>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
            ${guardrailsMarkup}
          </article>
        </div>
    `;

    return `
      ${renderSectionHeader(slideSpec)}
      ${media ? `
      <section class="dom-slide__content-with-media">
        ${columnsMarkup}
        ${media}
      </section>
      ` : columnsMarkup}
    `;
  }

  function renderEvidenceItem(item: CardItem, index: number, basePath: string, labelPrefix: string): string {
    const title = item.title || item.label || "";
    const body = item.body || item.value || "";

    return `
      <article class="dom-evidence">
        <h4${editAttrs(`${basePath}.${index}.title`, `${labelPrefix} title`)}>${escapeHtml(title)}</h4>
        <p${editAttrs(`${basePath}.${index}.body`, `${labelPrefix} body`)}>${escapeHtml(body)}</p>
      </article>
    `;
  }

  function renderSummary(slideSpec: SlideSpec): string {
    const bullets = toItems(slideSpec.bullets);
    const resources = toItems(slideSpec.resources);
    const media = renderSlideMedia(slideSpec) || renderCustomVisual(slideSpec);
    const columnsMarkup = `
      <div class="dom-slide__summary-columns${media ? " dom-slide__summary-columns--stacked" : ""}">
        <div class="dom-bullet-list">
          ${bullets.map((item: CardItem, index: number) => `
            <article class="dom-bullet">
              <span class="dom-bullet__dot"></span>
              <div class="dom-bullet__copy">
                <h3${editAttrs(`bullets.${index}.title`, "Bullet title")}>${escapeHtml(item.title || "")}</h3>
                <p${editAttrs(`bullets.${index}.body`, "Bullet body")}>${escapeHtml(item.body || "")}</p>
              </div>
            </article>
          `).join("")}
        </div>
        <aside class="dom-panel dom-panel--resources">
          <p class="dom-panel__eyebrow"${editAttrs("resourcesTitle", "Resources title")}>${escapeHtml(slideSpec.resourcesTitle || "")}</p>
          <div class="dom-resource-list">
            ${resources.map((resource: CardItem, index: number) => renderCompactCard(resource, index, "resources")).join("")}
          </div>
        </aside>
      </div>
    `;

    return `
      ${renderSectionHeader(slideSpec)}
      ${media ? `
      <section class="dom-slide__summary-with-media">
        ${columnsMarkup}
        ${media}
      </section>
      ` : columnsMarkup}
    `;
  }

  function renderUnsupported(slideSpec: SlideSpec): string {
    return `
      <div class="dom-slide__unsupported">
        <p class="dom-slide__eyebrow">Unsupported</p>
        <h2 class="dom-slide__title">${escapeHtml(slideSpec && slideSpec.title ? slideSpec.title : "Slide preview unavailable")}</h2>
        <p class="dom-slide__summary">This slide type is not yet part of the DOM renderer.</p>
      </div>
    `;
  }

  function renderSlideBody(slideSpec: SlideSpec): string {
    switch (slideSpec && slideSpec.type) {
      case "divider":
        return renderDivider(slideSpec);
      case "quote":
        return renderQuote(slideSpec);
      case "photo":
        return renderPhoto(slideSpec);
      case "photoGrid":
        return renderPhotoGrid(slideSpec);
      case "cover":
        return renderCover(slideSpec);
      case "toc":
        return renderToc(slideSpec);
      case "content":
        return renderContent(slideSpec);
      case "summary":
        return renderSummary(slideSpec);
      default:
        return renderUnsupported(slideSpec);
    }
  }

  function renderSlideMarkup(slideSpec: unknown, options?: RenderSlideOptions): string {
    const spec = toSlideSpec(slideSpec);
    const config = asRecord(options);
    const theme = normalizeTheme(config.theme);
    const index = Number.isFinite(Number(config.index)) ? Number(config.index) : Number(spec.index) || 1;
    const totalSlides = Number.isFinite(Number(config.totalSlides)) ? Number(config.totalSlides) : index;
    const layout = normalizeLayoutName(spec.layout);
    const slideType = spec.type ? String(spec.type) : "unsupported";
    const slideId = config.slideId || spec.id || "";
    const dataSlideId = slideId ? ` data-slide-id="${escapeHtml(slideId)}"` : "";
    const dataSlideIndex = ` data-slide-index="${escapeHtml(String(index))}"`;
    const presentationX = Number(config.presentationX);
    const presentationY = Number(config.presentationY);
    const dataPresentationX = Number.isFinite(presentationX)
      ? ` data-presentation-x="${escapeHtml(String(presentationX))}"`
      : "";
    const dataPresentationY = Number.isFinite(presentationY)
      ? ` data-presentation-y="${escapeHtml(String(presentationY))}"`
      : "";

    return `
      <article class="dom-slide dom-slide--${escapeHtml(slideType)} dom-slide--layout-${escapeHtml(layout)}" style="${escapeHtml(renderThemeVars(theme))}" data-slide-type="${escapeHtml(slideType)}" data-slide-layout="${escapeHtml(layout)}"${dataSlideId}${dataSlideIndex}${dataPresentationX}${dataPresentationY}>
        ${renderSlideBody(spec)}
        ${renderPageBadge(index, totalSlides)}
      </article>
    `;
  }

  function renderDeckMarkup(slides: unknown, options?: RenderSlideOptions): string {
    const slideList = toSlideEntries(slides);
    const config = asRecord(options);
    const totalSlides = slideList.length || 1;

    return `
      <div class="dom-deck-document__slides">
        ${slideList.map((entry: SlideEntry, slideIndex: number) => renderSlideMarkup(entry.slideSpec, {
          index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : slideIndex + 1,
          presentationX: Number.isFinite(Number(entry.presentationX)) ? Number(entry.presentationX) : undefined,
          presentationY: Number.isFinite(Number(entry.presentationY)) ? Number(entry.presentationY) : undefined,
          slideId: entry.id,
          theme: config.theme,
          totalSlides
        })).join("")}
      </div>
    `;
  }

  function renderDocumentHead(config: DocumentPayload): string {
    const title = escapeHtml(config.title || "Deck Preview");
    const lang = escapeHtml(config.lang || "en");
    const inlineCss = typeof config.inlineCss === "string" ? config.inlineCss : "";
    const metadata: DocumentMetadata = asRecord(config.metadata);
    const metaTags: string[] = [];

    if (metadata.author) {
      metaTags.push(`    <meta name="author" content="${escapeHtml(metadata.author)}">`);
    }

    if (metadata.company) {
      metaTags.push(`    <meta name="application-name" content="${escapeHtml(metadata.company)}">`);
    }

    if (metadata.subject) {
      metaTags.push(`    <meta name="subject" content="${escapeHtml(metadata.subject)}">`);
    }

    if (metadata.objective) {
      metaTags.push(`    <meta name="description" content="${escapeHtml(metadata.objective)}">`);
    }

    return [
      "<!doctype html>",
      `<html lang="${lang}">`,
      "  <head>",
      "    <meta charset=\"utf-8\">",
      "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      `    <title>${title}</title>`,
      ...metaTags,
      inlineCss
        ? `    <style>\n${inlineCss}\n    </style>`
        : "    <link rel=\"stylesheet\" href=\"/styles.css\">",
      "  </head>"
    ].join("\n");
  }

  function renderDeckDocument(payload: unknown): string {
    const config = toDocumentPayload(payload);
    const title = escapeHtml(config.title || "Deck Preview");
    const metadata: DocumentMetadata = asRecord(config.metadata);
    const subjectLine = metadata.subject
      ? `<p class="dom-deck-document__subject">${escapeHtml(metadata.subject)}</p>`
      : "";
    const metaParts = [metadata.company, metadata.author].filter(Boolean);
    const metaLine = metaParts.length
      ? `<p class="dom-deck-document__meta">${escapeHtml(metaParts.join(" · "))}</p>`
      : "";

    return [
      renderDocumentHead(config),
      "  <body class=\"dom-deck-document\">",
      "    <main class=\"dom-deck-document__page\">",
      `      <header class="dom-deck-document__header"><p class="eyebrow">Deck preview</p><h1>${title}</h1>${subjectLine}${metaLine}</header>`,
      renderDeckMarkup(config.slides || [], { theme: config.theme }),
      "    </main>",
      "  </body>",
      "</html>"
    ].join("\n");
  }

  function renderSlideDocument(payload: unknown): string {
    const config = toDocumentPayload(payload);
    const slideSpec = toSlideSpec(config.slideSpec);
    const title = escapeHtml(config.title || slideSpec.title || "Slide Preview");

    return [
      renderDocumentHead(config),
      "  <body class=\"dom-slide-document\">",
      "    <main class=\"dom-slide-document__page\">",
      renderSlideMarkup(slideSpec, {
        index: config.index,
        slideId: config.slideId,
        theme: config.theme,
        totalSlides: config.totalSlides
      }),
      "    </main>",
      "  </body>",
      "</html>"
    ].join("\n");
  }

  function renderPresentationScript(): string {
    return [
      "(function () {",
      "  const slideNodes = Array.from(document.querySelectorAll('.dom-presentation-document__slides > .dom-slide'));",
      "  const stageNode = document.querySelector('.dom-presentation-document__slides');",
      "  if (!slideNodes.length) {",
      "    return;",
      "  }",
      "",
      "  function clamp(value, min, max) {",
      "    return Math.min(Math.max(value, min), max);",
      "  }",
      "",
      "  function slideCoordinate(slideNode, fallbackIndex) {",
      "    const x = Number.parseInt(slideNode.getAttribute('data-presentation-x') || '', 10);",
      "    const y = Number.parseInt(slideNode.getAttribute('data-presentation-y') || '', 10);",
      "    return {",
      "      index: fallbackIndex,",
      "      node: slideNode,",
      "      x: Number.isFinite(x) && x > 0 ? x : fallbackIndex,",
      "      y: Number.isFinite(y) && y >= 0 ? y : 0",
      "    };",
      "  }",
      "",
      "  const coordinates = slideNodes.map((slideNode, index) => slideCoordinate(slideNode, index + 1));",
      "  const coreCoordinates = coordinates.filter((coordinate) => coordinate.y === 0);",
      "  const maxX = coreCoordinates.length ? Math.max.apply(null, coreCoordinates.map((coordinate) => coordinate.x)) : slideNodes.length;",
      "",
      "  function readCoordinateFromHash() {",
      "    const hash = String(window.location.hash || '');",
      "    const xMatch = hash.match(/x=(\\d+)/);",
      "    const yMatch = hash.match(/y=(\\d+)/);",
      "    const parsedX = xMatch ? Number.parseInt(xMatch[1], 10) : 1;",
      "    const parsedY = yMatch ? Number.parseInt(yMatch[1], 10) : 0;",
      "    return {",
      "      x: Number.isFinite(parsedX) ? clamp(parsedX, 1, maxX) : 1,",
      "      y: Number.isFinite(parsedY) ? Math.max(0, parsedY) : 0",
      "    };",
      "  }",
      "",
      "  function findCoordinate(x, y) {",
      "    return coordinates.find((coordinate) => coordinate.x === x && coordinate.y === y)",
      "      || coordinates.find((coordinate) => coordinate.x === x && coordinate.y === 0)",
      "      || coordinates[0];",
      "  }",
      "",
      "  function maxYForX(x) {",
      "    const stack = coordinates.filter((coordinate) => coordinate.x === x);",
      "    return stack.length ? Math.max.apply(null, stack.map((coordinate) => coordinate.y)) : 0;",
      "  }",
      "",
      "  function writeHash(coordinate) {",
      "    const nextHash = coordinate.y > 0 ? '#x=' + coordinate.x + ',y=' + coordinate.y : '#x=' + coordinate.x;",
      "    if (window.location.hash !== nextHash) {",
      "      window.history.replaceState(null, '', nextHash);",
      "    }",
      "  }",
      "",
      "  function syncScale() {",
      "    const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540);",
      "    const safeScale = scale > 0 ? scale : 1;",
      "    if (stageNode instanceof HTMLElement) {",
      "      stageNode.style.width = (960 * safeScale) + 'px';",
      "      stageNode.style.height = (540 * safeScale) + 'px';",
      "      stageNode.style.setProperty('--presentation-scale', String(safeScale));",
      "    }",
      "    slideNodes.forEach((slideNode) => {",
      "      if (slideNode instanceof HTMLElement) {",
      "        slideNode.style.transform = 'scale(' + safeScale + ')';",
      "      }",
      "    });",
      "  }",
      "",
      "  function render(coordinate) {",
      "    const activeCoordinate = findCoordinate(coordinate.x, coordinate.y);",
      "    slideNodes.forEach((slideNode, slideOffset) => {",
      "      const isActive = slideOffset === activeCoordinate.index - 1;",
      "      slideNode.hidden = !isActive;",
      "      slideNode.classList.toggle('is-active', isActive);",
      "      slideNode.setAttribute('aria-hidden', isActive ? 'false' : 'true');",
      "    });",
      "    document.body.dataset.presentationIndex = String(activeCoordinate.x);",
      "    document.body.dataset.presentationY = String(activeCoordinate.y);",
      "    document.body.dataset.presentationSlideIndex = String(activeCoordinate.index);",
      "    document.body.dataset.presentationDetourUp = activeCoordinate.y > 0 ? 'true' : 'false';",
      "    document.body.dataset.presentationDetourDown = activeCoordinate.y < maxYForX(activeCoordinate.x) ? 'true' : 'false';",
      "    writeHash(activeCoordinate);",
      "  }",
      "",
      "  function renderHash() {",
      "    render(readCoordinateFromHash());",
      "  }",
      "",
      "  function moveHorizontal(delta) {",
      "    const coordinate = readCoordinateFromHash();",
      "    const nextX = ((coordinate.x - 1 + delta + maxX) % maxX) + 1;",
      "    render({ x: nextX, y: 0 });",
      "  }",
      "",
      "  function moveVertical(delta) {",
      "    const coordinate = readCoordinateFromHash();",
      "    render({ x: coordinate.x, y: coordinate.y + delta });",
      "  }",
      "",
      "  function exitPresentationMode() {",
      "    if (window.opener && !window.opener.closed) {",
      "      window.close();",
      "      if (window.closed) {",
      "        return;",
      "      }",
      "    }",
      "",
      "    const studioUrl = new URL('/', window.location.href);",
      "    studioUrl.hash = '#studio';",
      "    window.location.assign(studioUrl.toString());",
      "  }",
      "",
      "  window.addEventListener('keydown', (event) => {",
      "    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {",
      "      return;",
      "    }",
      "",
      "    switch (event.key) {",
      "      case 'ArrowRight':",
      "      case 'PageDown':",
      "      case ' ':",
      "        event.preventDefault();",
      "        moveHorizontal(1);",
      "        break;",
      "      case 'ArrowLeft':",
      "      case 'PageUp':",
      "        event.preventDefault();",
      "        moveHorizontal(-1);",
      "        break;",
      "      case 'ArrowDown':",
      "        event.preventDefault();",
      "        moveVertical(1);",
      "        break;",
      "      case 'ArrowUp':",
      "        event.preventDefault();",
      "        moveVertical(-1);",
      "        break;",
      "      case 'Home':",
      "        event.preventDefault();",
      "        render({ x: 1, y: 0 });",
      "        break;",
      "      case 'End':",
      "        event.preventDefault();",
      "        render({ x: maxX, y: 0 });",
      "        break;",
      "      case 'Escape':",
      "        event.preventDefault();",
      "        exitPresentationMode();",
      "        break;",
      "      default:",
      "        break;",
      "    }",
      "  });",
      "",
      "  window.addEventListener('hashchange', function () {",
      "    renderHash();",
      "  });",
      "  window.addEventListener('resize', syncScale);",
      "  syncScale();",
      "  renderHash();",
      "})();"
    ].join("\n");
  }

  function renderPresentationDocument(payload: unknown): string {
    const config = toDocumentPayload(payload);
    const title = escapeHtml(config.title || "Presentation");

    return [
      renderDocumentHead(config),
      "  <body class=\"dom-presentation-document\">",
      "    <main class=\"dom-presentation-document__page\">",
      `      <section class="dom-presentation-document__slides" aria-label="${title} slides">`,
      toSlideEntries(config.slides).map((entry: SlideEntry, slideIndex: number) => renderSlideMarkup(entry.slideSpec, {
        index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : slideIndex + 1,
        presentationX: Number.isFinite(Number(entry.presentationX)) ? Number(entry.presentationX) : slideIndex + 1,
        presentationY: Number.isFinite(Number(entry.presentationY)) ? Number(entry.presentationY) : 0,
        slideId: entry.id,
        theme: config.theme,
        totalSlides: toSlideEntries(config.slides).length || 1
      })).join(""),
      "      </section>",
      "    </main>",
      `    <script>\n${renderPresentationScript()}\n    </script>`,
      "  </body>",
      "</html>"
    ].join("\n");
  }

  const api = {
    normalizeTheme,
    renderDeckDocument,
    renderPresentationDocument,
    renderSlideDocument,
    renderDeckMarkup,
    renderSlideMarkup
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalScope && typeof globalScope === "object") {
    globalScope.SlideDomRenderer = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null));
