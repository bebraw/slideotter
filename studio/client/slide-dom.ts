(function attachSlideDomRenderer(globalScope) {
  const baseTheme = {
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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function editAttrs(path, label) {
    return ` data-edit-path="${escapeHtml(path)}" data-edit-label="${escapeHtml(label || path)}"`;
  }

  function normalizeColor(value, fallback) {
    const normalized = String(value || "").trim().replace(/^#/, "").toLowerCase();
    return /^[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
  }

  function hexToRgb(hex) {
    const normalized = normalizeColor(hex, "000000");
    return {
      b: parseInt(normalized.slice(4, 6), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      r: parseInt(normalized.slice(0, 2), 16)
    };
  }

  function luminanceChannel(value) {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * luminanceChannel(r)) +
      (0.7152 * luminanceChannel(g)) +
      (0.0722 * luminanceChannel(b));
  }

  function contrastRatio(foreground, background) {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function ensureContrast(color, background, minRatio, candidates = []) {
    const normalized = normalizeColor(color, baseTheme.primary);
    if (contrastRatio(normalized, background) >= minRatio) {
      return normalized;
    }

    return [...candidates, "101820", "ffffff", "f7fcfb"]
      .map((candidate) => normalizeColor(candidate, baseTheme.primary))
      .sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0];
  }

  function withHash(color) {
    return `#${String(color || "").replace(/^#/, "")}`;
  }

  function normalizeFontFamily(value) {
    const key = String(value || "").trim().toLowerCase();
    const allowed = {
      avenir: "\"Avenir Next\", \"Helvetica Neue\", \"Segoe UI\", sans-serif",
      editorial: "Georgia, \"Times New Roman\", serif",
      mono: "\"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace",
      workshop: "\"Trebuchet MS\", Verdana, sans-serif"
    };

    return allowed[key] || Object.values(allowed).find((stack) => stack.toLowerCase() === key) || baseTheme.fontFamily;
  }

  function normalizeLayoutName(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    return normalized || "standard";
  }

  function normalizeTheme(input) {
    const source = input && typeof input === "object" ? input : {};
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

  function renderThemeVars(theme) {
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

  function renderPageBadge(index, total) {
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

  function renderSectionHeader(slideSpec) {
    return `
      <header class="dom-slide__section-header">
        <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
        <p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
      </header>
    `;
  }

  function renderSlideMedia(slideSpec) {
    const media = slideSpec && slideSpec.media && typeof slideSpec.media === "object"
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
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}">
        ${caption}
      </figure>
    `;
  }

  function renderCompactCard(card, index, basePath) {
    const path = basePath ? `${basePath}.${index}` : `cards.${index}`;
    return `
      <article class="dom-card">
        <h3${editAttrs(`${path}.title`, "Card title")}>${escapeHtml(card.title || "")}</h3>
        <p${editAttrs(`${path}.body`, "Card body")}>${escapeHtml(card.body || "")}</p>
      </article>
    `;
  }

  function renderSlideotterLogo() {
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

  function renderCover(slideSpec) {
    const cards = Array.isArray(slideSpec.cards) ? slideSpec.cards : [];
    const logo = renderSlideMedia(slideSpec) || (slideSpec.logo === "slideotter" ? renderSlideotterLogo() : "");
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
          ${cards.map((card, index) => renderCompactCard(card, index, "cards")).join("")}
        </section>
      </div>
    `;
  }

  function renderToc(slideSpec) {
    const cards = Array.isArray(slideSpec.cards) ? slideSpec.cards : [];
    const media = renderSlideMedia(slideSpec);
    return `
      ${renderSectionHeader(slideSpec)}
      <section class="dom-slide__toc-body${media ? " dom-slide__toc-body--with-media" : ""}">
        <div class="dom-slide__toc-copy">
          <div class="dom-slide__toc-cards">
            ${cards.map((card, index) => renderCompactCard(card, index, "cards")).join("")}
          </div>
          <p class="dom-slide__toc-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>
        </div>
        ${media}
      </section>
    `;
  }

  function renderContent(slideSpec) {
    const signals = Array.isArray(slideSpec.signals) ? slideSpec.signals : [];
    const guardrails = Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails : [];
    const renderSignalCards = signals.some((item) => item && (item.title || item.body));
    const renderGuardrailCards = guardrails.some((item) => item && (item.title || item.body));
    const media = renderSlideMedia(slideSpec);
    const columnsMarkup = `
        <div class="dom-slide__content-columns${media ? " dom-slide__content-columns--stacked" : ""}">
          <article class="dom-panel dom-panel--signals">
            <h3${editAttrs("signalsTitle", "Signals title")}>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
            ${renderSignalCards ? `
              <div class="dom-evidence-list">
                ${signals.map((item, index) => renderEvidenceItem(item, index, "signals", "Signal")).join("")}
              </div>
            ` : `
              <div class="dom-signal-list">
                ${signals.map((item, index) => {
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
            `}
          </article>
          <article class="dom-panel dom-panel--guardrails">
            <h3${editAttrs("guardrailsTitle", "Guardrails title")}>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
            ${renderGuardrailCards ? `
              <div class="dom-evidence-list">
                ${guardrails.map((item, index) => renderEvidenceItem(item, index, "guardrails", "Guardrail")).join("")}
              </div>
            ` : `
              <div class="dom-guardrail-list">
                ${guardrails.map((item, index) => `
                  <div class="dom-guardrail${index < guardrails.length - 1 ? " dom-guardrail--divided" : ""}">
                    <strong${editAttrs(`guardrails.${index}.value`, "Guardrail value")}>${escapeHtml(item.value || "")}</strong>
                    <span${editAttrs(`guardrails.${index}.label`, "Guardrail label")}>${escapeHtml(item.label || "")}</span>
                  </div>
                `).join("")}
              </div>
            `}
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

  function renderEvidenceItem(item, index, basePath, labelPrefix) {
    const title = item.title || item.label || "";
    const body = item.body || item.value || "";

    return `
      <article class="dom-evidence">
        <h4${editAttrs(`${basePath}.${index}.title`, `${labelPrefix} title`)}>${escapeHtml(title)}</h4>
        <p${editAttrs(`${basePath}.${index}.body`, `${labelPrefix} body`)}>${escapeHtml(body)}</p>
      </article>
    `;
  }

  function renderSummary(slideSpec) {
    const bullets = Array.isArray(slideSpec.bullets) ? slideSpec.bullets : [];
    const resources = Array.isArray(slideSpec.resources) ? slideSpec.resources : [];
    const media = renderSlideMedia(slideSpec);
    const columnsMarkup = `
      <div class="dom-slide__summary-columns${media ? " dom-slide__summary-columns--stacked" : ""}">
        <div class="dom-bullet-list">
          ${bullets.map((item, index) => `
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
            ${resources.map((resource, index) => renderCompactCard(resource, index, "resources")).join("")}
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
    const layout = normalizeLayoutName(slideSpec && slideSpec.layout);
    const slideType = slideSpec && slideSpec.type ? slideSpec.type : "unsupported";

    return `
      <article class="dom-slide dom-slide--${escapeHtml(slideType)} dom-slide--layout-${escapeHtml(layout)}" style="${escapeHtml(renderThemeVars(theme))}" data-slide-type="${escapeHtml(slideType)}" data-slide-layout="${escapeHtml(layout)}">
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
    const lang = escapeHtml(config.lang || "en");
    const inlineCss = typeof config.inlineCss === "string" ? config.inlineCss : "";
    const metadata = config.metadata && typeof config.metadata === "object" ? config.metadata : {};
    const metaTags = [];

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

  function renderDeckDocument(payload) {
    const config = payload && typeof payload === "object" ? payload : {};
    const title = escapeHtml(config.title || "Deck Preview");
    const metadata = config.metadata && typeof config.metadata === "object" ? config.metadata : {};
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
    /** @type {any} */ (globalScope).SlideDomRenderer = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this));
