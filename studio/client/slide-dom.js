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

  function normalizeTheme(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      accent: normalizeColor(source.accent, baseTheme.accent),
      bg: normalizeColor(source.bg, baseTheme.bg),
      fontFamily: normalizeFontFamily(source.fontFamily),
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
      `--dom-font-family:${theme.fontFamily}`,
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
        <p class="dom-slide__eyebrow"${editAttrs("eyebrow", "Eyebrow")}>${escapeHtml(slideSpec.eyebrow || "")}</p>
        <h2 class="dom-slide__title"${editAttrs("title", "Title")}>${escapeHtml(slideSpec.title || "")}</h2>
        <p class="dom-slide__summary"${editAttrs("summary", "Summary")}>${escapeHtml(slideSpec.summary || "")}</p>
      </header>
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
    const logo = slideSpec.logo === "slideotter" ? renderSlideotterLogo() : "";
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
    return `
      ${renderSectionHeader(slideSpec)}
      <section class="dom-slide__toc-body">
        <div class="dom-slide__toc-cards">
          ${cards.map((card, index) => renderCompactCard(card, index, "cards")).join("")}
        </div>
        <p class="dom-slide__toc-note"${editAttrs("note", "Note")}>${escapeHtml(slideSpec.note || "")}</p>
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
          <h3${editAttrs("signalsTitle", "Signals title")}>${escapeHtml(slideSpec.signalsTitle || "")}</h3>
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
        </article>
        <article class="dom-panel dom-panel--guardrails">
          <h3${editAttrs("guardrailsTitle", "Guardrails title")}>${escapeHtml(slideSpec.guardrailsTitle || "")}</h3>
          <div class="dom-guardrail-list">
            ${guardrails.map((item, index) => `
              <div class="dom-guardrail${index < guardrails.length - 1 ? " dom-guardrail--divided" : ""}">
                <strong${editAttrs(`guardrails.${index}.value`, "Guardrail value")}>${escapeHtml(item.value || "")}</strong>
                <span${editAttrs(`guardrails.${index}.label`, "Guardrail label")}>${escapeHtml(item.label || "")}</span>
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
    globalScope.SlideDomRenderer = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this));
