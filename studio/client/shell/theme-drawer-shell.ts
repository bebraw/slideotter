const themeDrawerMarkup = `
    <aside class="studio-drawer theme-drawer" id="theme-drawer" aria-label="Theme control">
      <button
        class="studio-drawer-toggle theme-drawer-toggle"
        id="theme-drawer-toggle"
        type="button"
        aria-controls="theme-drawer-panel"
        aria-expanded="false"
        aria-label="Open theme control"
        data-drawer-label="Theme"
      >
        <svg class="drawer-toggle-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 22a10 10 0 1 1 10-10c0 4.42-3.58 8-8 8h-1.25a1.75 1.75 0 0 0-1.4 2.8c.18.12.4.2.65.2Z"></path>
          <circle cx="6.5" cy="11.5" r="1.1"></circle>
          <circle cx="9.5" cy="7.5" r="1.1"></circle>
          <circle cx="14.5" cy="7.5" r="1.1"></circle>
          <circle cx="17.5" cy="12.5" r="1.1"></circle>
        </svg>
      </button>

      <div class="studio-drawer-panel theme-drawer-panel" id="theme-drawer-panel">
        <div class="theme-drawer-panel-head">
          <div>
            <p class="eyebrow">Theme</p>
            <h2>Deck Surface</h2>
          </div>
          <p class="theme-drawer-panel-note">
            Describe, generate, and tune deck-level theme changes against real slides.
          </p>
        </div>

        <div class="theme-drawer-tools">
          <label class="field theme-brief-field">
            <span>Describe the theme</span>
            <textarea id="theme-brief" placeholder="Describe a visual direction or paste a site URL."></textarea>
          </label>
          <div class="theme-brief-actions">
            <label class="field theme-scheme-field">
              <span>Site mode</span>
              <select id="theme-color-scheme">
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <button id="generate-theme-from-brief-button" class="secondary compact-button" type="button">Generate a new theme</button>
          </div>

          <div class="theme-drawer-row">
            <label class="field">
              <span>Font</span>
              <select id="theme-font-family">
                <option value="avenir">Avenir</option>
                <option value="editorial">Editorial</option>
                <option value="workshop">Workshop</option>
                <option value="mono">Mono</option>
              </select>
            </label>
          </div>

          <div class="theme-drawer-color-grid">
            <label class="field color-field">
              <span>Primary</span>
              <input id="theme-primary" type="color">
            </label>

            <label class="field color-field">
              <span>Secondary</span>
              <input id="theme-secondary" type="color">
            </label>

            <label class="field color-field">
              <span>Accent</span>
              <input id="theme-accent" type="color">
            </label>

            <label class="field color-field">
              <span>Muted</span>
              <input id="theme-muted" type="color">
            </label>

            <label class="field color-field">
              <span>Light</span>
              <input id="theme-light" type="color">
            </label>

            <label class="field color-field">
              <span>Background</span>
              <input id="theme-bg" type="color">
            </label>

            <label class="field color-field">
              <span>Panel</span>
              <input id="theme-panel" type="color">
            </label>

            <label class="field color-field">
              <span>Surface</span>
              <input id="theme-surface" type="color">
            </label>

            <label class="field color-field">
              <span>Progress track</span>
              <input id="theme-progress-track" type="color">
            </label>

            <label class="field color-field">
              <span>Progress fill</span>
              <input id="theme-progress-fill" type="color">
            </label>
          </div>

          <div class="theme-drawer-actions button-row compact">
            <button id="generate-theme-candidates-button" class="secondary" type="button">Generate candidates</button>
            <button id="save-deck-theme-button" class="secondary" type="button">Save to favorites</button>
          </div>
        </div>

        <div class="creation-theme-variant-list theme-candidate-list" id="presentation-theme-variant-list"></div>

        <section class="theme-drawer-favorites" aria-label="Favorite themes">
          <div class="theme-drawer-section-head">
            <strong>Favorites</strong>
          </div>
          <div class="theme-favorite-list" id="theme-favorite-list"></div>
        </section>

        <section class="creation-theme-review" id="presentation-theme-review" aria-label="Theme review summary"></section>

        <div class="theme-drawer-preview" id="presentation-theme-preview">
          <div class="presentation-empty">
            <strong>No slide preview yet</strong>
            <span>Select a presentation to preview themes.</span>
          </div>
        </div>
      </div>
    </aside>
`;

export function mountThemeDrawerShell(documentRef: Document): void {
  if (documentRef.getElementById("theme-drawer")) {
    return;
  }

  const contextDrawer = documentRef.getElementById("context-drawer");
  if (!contextDrawer || !contextDrawer.parentElement) {
    throw new Error("Theme drawer shell mount point is missing");
  }

  contextDrawer.insertAdjacentHTML("beforebegin", themeDrawerMarkup);
}
