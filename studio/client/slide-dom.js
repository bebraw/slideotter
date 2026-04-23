(function attachSlideDomRenderer(globalScope) {
  const baseTheme = {
    accent: "f28f3b",
    bg: "f5f8fc",
    light: "d7e6f5",
    muted: "56677c",
    panel: "f8fbfe",
    primary: "183153",
    progressFill: "275d8c",
    progressTrack: "d7e6f5",
    secondary: "275d8c",
    surface: "ffffff"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeColor(value, fallback) {
    const normalized = String(value || "").trim().replace(/^#/, "").toLowerCase();
    return /^[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
  }

  function withHash(color) {
    return `#${String(color || "").replace(/^#/, "")}`;
  }

  function normalizeTheme(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      accent: normalizeColor(source.accent, baseTheme.accent),
      bg: normalizeColor(source.bg, baseTheme.bg),
      light: normalizeColor(source.light, baseTheme.light),
      muted: normalizeColor(source.muted, baseTheme.muted),
      panel: normalizeColor(source.panel, baseTheme.panel),
      primary: normalizeColor(source.primary, baseTheme.primary),
      progressFill: normalizeColor(source.progressFill, baseTheme.progressFill),
      progressTrack: normalizeColor(source.progressTrack, baseTheme.progressTrack),
      secondary: normalizeColor(source.secondary, baseTheme.secondary),
      surface: normalizeColor(source.surface, baseTheme.surface)
    };
  }

  function renderThemeVars(theme) {
    return [
      `--dom-accent:${withHash(theme.accent)}`,
      `--dom-bg:${withHash(theme.bg)}`,
      `--dom-light:${withHash(theme.light)}`,
      `--dom-muted:${withHash(theme.muted)}`,
      `--dom-panel:${withHash(theme.panel)}`,
      `--dom-primary:${withHash(theme.primary)}`,
      `--dom-progress-fill:${withHash(theme.progressFill)}`,
      `--dom-progress-track:${withHash(theme.progressTrack)}`,
      `--dom-secondary:${withHash(theme.secondary)}`,
      `--dom-surface:${withHash(theme.surface)}`
    ].join(";");
  }

  function renderPageBadge(index, total) {
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 1;
    const safeTotal = Number.isFinite(Number(total)) && Number(total) > 0 ? Number(total) : safeIndex;
    const progress = Math.max(0, Math.min(100, (safeIndex / safeTotal) * 100));

    return `
      <div class="dom-slide__badge" aria-label="Slide ${safeIndex} of ${safeTotal}">
        <div class="dom-slide__badge-track">
          <div class="dom-slide__badge-fill" style="width:${progress}%;"></div>
        </div>
        <span class="dom-slide__badge-label">${safeIndex}/${safeTotal}</span>
      </div>
    `;
  }

  function renderSectionHeader(slideSpec) {
    return `
      <header class="dom-slide__section-header">
        <p class="dom-slide__eyebrow">${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h2 class="dom-slide__title">${escapeHtml(slideSpec.title || "")}</h2>
        <p class="dom-slide__summary">${escapeHtml(slideSpec.summary || "")}</p>
      </header>
    `;
  }

  function renderCompactCard(card) {
    return `
      <article class="dom-card">
        <h3>${escapeHtml(card.title || "")}</h3>
        <p>${escapeHtml(card.body || "")}</p>
      </article>
    `;
  }

  function renderCover(slideSpec) {
    const cards = Array.isArray(slideSpec.cards) ? slideSpec.cards : [];
    return `
      <div class="dom-slide__cover-grid">
        <section class="dom-slide__cover-copy">
          <div class="dom-slide__cover-rule"></div>
          <p class="dom-slide__eyebrow">${escapeHtml(slideSpec.eyebrow || "")}</p>
          <h1 class="dom-slide__cover-title">${escapeHtml(slideSpec.title || "")}</h1>
          <p class="dom-slide__cover-summary">${escapeHtml(slideSpec.summary || "")}</p>
          <p class="dom-slide__cover-note">${escapeHtml(slideSpec.note || "")}</p>
        </section>
        <section class="dom-slide__cover-cards">
          ${cards.map(renderCompactCard).join("")}
        </section>
      </div>
    `;
  }

  function renderToc(slideSpec) {
    const cards = Array.isArray(slideSpec.cards) ? slideSpec.cards : [];
    return `
      ${renderSectionHeader(slideSpec)}
      <section class="dom-slide__toc-body">
        <div class="dom-slide__toc-cards">
          ${cards.map(renderCompactCard).join("")}
        </div>
        <p class="dom-slide__toc-note">${escapeHtml(slideSpec.note || "")}</p>
      </section>
    `;
  }

  function renderContent(slideSpec) {
    const signals = Array.isArray(slideSpec.signals) ? slideSpec.signals : [];
    const guardrails = Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails : [];

    return `
      ${renderSectionHeader(slideSpec)}
      <section class="dom-slide__content-columns">
        <article class="dom-panel dom-panel--signals">
          <h3>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
          <div class="dom-signal-list">
            ${signals.map((item) => {
              const value = Math.max(0, Math.min(100, Math.round(Number(item.value || 0) * 100)));
              return `
                <div class="dom-signal">
                  <div class="dom-signal__meta">
                    <span>${escapeHtml(item.label || "")}</span>
                    <strong>${value}%</strong>
                  </div>
                  <div class="dom-signal__track">
                    <div class="dom-signal__fill" style="width:${value}%;"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </article>
        <article class="dom-panel dom-panel--guardrails">
          <h3>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
          <div class="dom-guardrail-list">
            ${guardrails.map((item, index) => `
              <div class="dom-guardrail${index < guardrails.length - 1 ? " dom-guardrail--divided" : ""}">
                <strong>${escapeHtml(item.value || "")}</strong>
                <span>${escapeHtml(item.label || "")}</span>
              </div>
            `).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderSummary(slideSpec) {
    const bullets = Array.isArray(slideSpec.bullets) ? slideSpec.bullets : [];
    const resources = Array.isArray(slideSpec.resources) ? slideSpec.resources : [];

    return `
      ${renderSectionHeader(slideSpec)}
      <section class="dom-slide__summary-columns">
        <div class="dom-bullet-list">
          ${bullets.map((item) => `
            <article class="dom-bullet">
              <span class="dom-bullet__dot"></span>
              <div class="dom-bullet__copy">
                <h3>${escapeHtml(item.title || "")}</h3>
                <p>${escapeHtml(item.body || "")}</p>
              </div>
            </article>
          `).join("")}
        </div>
        <aside class="dom-panel dom-panel--resources">
          <p class="dom-panel__eyebrow">${escapeHtml(slideSpec.resourcesTitle || "")}</p>
          <div class="dom-resource-list">
            ${resources.map(renderCompactCard).join("")}
          </div>
        </aside>
      </section>
    `;
  }

  function renderUnsupported(slideSpec) {
    return `
      <div class="dom-slide__unsupported">
        <p class="dom-slide__eyebrow">Unsupported</p>
        <h2 class="dom-slide__title">${escapeHtml(slideSpec && slideSpec.title ? slideSpec.title : "Slide preview unavailable")}</h2>
        <p class="dom-slide__summary">This slide type is not yet part of the DOM renderer.</p>
      </div>
    `;
  }

  function renderSlideBody(slideSpec) {
    switch (slideSpec && slideSpec.type) {
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

  function renderSlideMarkup(slideSpec, options) {
    const config = options && typeof options === "object" ? options : {};
    const theme = normalizeTheme(config.theme);
    const index = Number.isFinite(Number(config.index)) ? Number(config.index) : Number(slideSpec && slideSpec.index) || 1;
    const totalSlides = Number.isFinite(Number(config.totalSlides)) ? Number(config.totalSlides) : index;

    return `
      <article class="dom-slide dom-slide--${escapeHtml(slideSpec && slideSpec.type ? slideSpec.type : "unsupported")}" style="${renderThemeVars(theme)}" data-slide-type="${escapeHtml(slideSpec && slideSpec.type ? slideSpec.type : "unsupported")}">
        ${renderSlideBody(slideSpec || {})}
        ${renderPageBadge(index, totalSlides)}
      </article>
    `;
  }

  function renderDeckMarkup(slides, options) {
    const slideList = Array.isArray(slides) ? slides : [];
    const config = options && typeof options === "object" ? options : {};
    const totalSlides = slideList.length || 1;

    return `
      <div class="dom-deck-document__slides">
        ${slideList.map((entry, slideIndex) => renderSlideMarkup(entry.slideSpec, {
          index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : slideIndex + 1,
          theme: config.theme,
          totalSlides
        })).join("")}
      </div>
    `;
  }

  function renderDocumentHead(config) {
    const title = escapeHtml(config.title || "Deck Preview");
    const inlineCss = typeof config.inlineCss === "string" ? config.inlineCss : "";

    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "  <head>",
      "    <meta charset=\"utf-8\">",
      "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      `    <title>${title}</title>`,
      inlineCss
        ? `    <style>\n${inlineCss}\n    </style>`
        : "    <link rel=\"stylesheet\" href=\"/styles.css\">",
      "  </head>"
    ].join("\n");
  }

  function renderDeckDocument(payload) {
    const config = payload && typeof payload === "object" ? payload : {};
    const title = escapeHtml(config.title || "Deck Preview");

    return [
      renderDocumentHead(config),
      "  <body class=\"dom-deck-document\">",
      "    <main class=\"dom-deck-document__page\">",
      `      <header class="dom-deck-document__header"><p class="eyebrow">DOM preview</p><h1>${title}</h1></header>`,
      renderDeckMarkup(config.slides || [], { theme: config.theme }),
      "    </main>",
      "  </body>",
      "</html>"
    ].join("\n");
  }

  function renderSlideDocument(payload) {
    const config = payload && typeof payload === "object" ? payload : {};
    const slideSpec = config.slideSpec || {};
    const title = escapeHtml(config.title || slideSpec.title || "Slide Preview");

    return [
      renderDocumentHead(config),
      "  <body class=\"dom-slide-document\">",
      "    <main class=\"dom-slide-document__page\">",
      renderSlideMarkup(slideSpec, {
        index: config.index,
        theme: config.theme,
        totalSlides: config.totalSlides
      }),
      "    </main>",
      "  </body>",
      "</html>"
    ].join("\n");
  }

  const api = {
    normalizeTheme,
    renderDeckDocument,
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
}(typeof globalThis !== "undefined" ? globalThis : this));
