const outlineDrawerMarkup = `
    <aside class="studio-drawer outline-drawer" id="outline-drawer" aria-label="Outline planning">
      <button
        class="studio-drawer-toggle outline-drawer-toggle"
        id="outline-drawer-toggle"
        type="button"
        aria-controls="outline-drawer-panel"
        aria-expanded="false"
        aria-label="Open outline planning"
        data-drawer-label="Outline"
      >
        <svg class="drawer-toggle-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M8 6h13"></path>
          <path d="M8 12h13"></path>
          <path d="M8 18h13"></path>
          <path d="M3 6h.01"></path>
          <path d="M3 12h.01"></path>
          <path d="M3 18h.01"></path>
        </svg>
      </button>

      <div class="studio-drawer-panel outline-drawer-panel" id="outline-drawer-panel">
        <div class="outline-drawer-panel-head">
          <p class="eyebrow">Outline</p>
          <h2>Deck Outline</h2>
          <p class="outline-drawer-panel-note">
            Plan deck shape, source grounding, reusable outlines, and length changes beside the active slide.
          </p>
        </div>

        <div class="outline-mode-tabs" role="tablist" aria-label="Outline modes">
          <button id="outline-mode-brief-tab" class="active" type="button" role="tab" aria-selected="true" aria-controls="outline-mode-brief" data-outline-mode="brief">Brief</button>
          <button id="outline-mode-plans-tab" type="button" role="tab" aria-selected="false" aria-controls="outline-mode-plans" data-outline-mode="plans">Plans</button>
          <button id="outline-mode-changes-tab" type="button" role="tab" aria-selected="false" aria-controls="outline-mode-changes" data-outline-mode="changes">Changes</button>
          <button id="outline-mode-length-tab" type="button" role="tab" aria-selected="false" aria-controls="outline-mode-length" data-outline-mode="length">Length</button>
        </div>

        <div class="outline-mode-panel" id="outline-mode-brief" role="tabpanel" aria-labelledby="outline-mode-brief-tab" data-outline-mode-panel="brief">
        <article class="editorial-block editorial-block-wide planning-console">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Planning</p>
              <h2>Outline Planning</h2>
            </div>
          </div>

          <p class="section-note">
            Set the shared brief, outline, palette, and guardrails that deck-level planning uses before it proposes structure changes.
          </p>

          <div class="button-row compact planning-actions">
            <button id="save-deck-context-button" class="secondary">Save deck context</button>
            <button id="generate-outline-plan-button" class="secondary" type="button">Generate outline plan</button>
          </div>

          <div class="field-grid deck-identity-grid">
            <label class="field">
              <span>Title</span>
              <input id="deck-title" type="text">
            </label>
            <label class="field">
              <span>Audience</span>
              <input id="deck-audience" type="text">
            </label>
            <label class="field">
              <span>Author</span>
              <input id="deck-author" type="text">
            </label>
            <label class="field">
              <span>Company</span>
              <input id="deck-company" type="text">
            </label>
            <label class="field">
              <span>Subject</span>
              <input id="deck-subject" type="text">
            </label>
            <label class="field">
              <span>Language</span>
              <input id="deck-lang" type="text" placeholder="en-US">
            </label>
            <label class="field">
              <span>Tone</span>
              <input id="deck-tone" type="text">
            </label>
          </div>

          <div class="planning-text-grid">
            <label class="field">
              <span>Objective</span>
              <textarea id="deck-objective"></textarea>
            </label>

            <label class="field">
              <span>Constraints</span>
              <textarea id="deck-constraints"></textarea>
            </label>

            <label class="field">
              <span>Theme brief</span>
              <textarea id="deck-theme-brief"></textarea>
            </label>

            <label class="field">
              <span>Outline</span>
              <textarea id="deck-outline"></textarea>
            </label>
          </div>

          <details class="source-details">
            <summary>
              <span class="disclosure-copy">
                <strong>Sources</strong>
                <small>Add notes, copied text, or URLs that generation can retrieve from.</small>
              </span>
              <span class="disclosure-action" aria-hidden="true">
                <span class="disclosure-action-closed">Manage sources</span>
                <span class="disclosure-action-open">Hide sources</span>
                <span class="disclosure-action-mark"></span>
              </span>
            </summary>

            <div class="source-panel">
              <div class="source-input-grid">
                <label class="field">
                  <span>Title</span>
                  <input id="source-title" type="text" placeholder="Official docs, meeting notes, research excerpt">
                </label>

                <label class="field">
                  <span>URL</span>
                  <input id="source-url" type="url" placeholder="https://example.com/source">
                </label>

                <label class="field source-text-field">
                  <span>Text</span>
                  <textarea id="source-text" placeholder="Paste source text, notes, or an excerpt. If URL is provided without text, the server tries to fetch readable text."></textarea>
                </label>

                <div class="button-row compact source-actions">
                  <button id="add-source-button" type="button">Add source</button>
                </div>
              </div>

              <div class="source-list" id="source-list"></div>
            </div>
          </details>

          <details class="planning-guardrails-details">
            <summary>
              <span class="disclosure-copy">
                <strong>Design guardrails</strong>
                <small>Validation thresholds used by deck planning and checks.</small>
              </span>
              <span class="disclosure-action" aria-hidden="true">
                <span class="disclosure-action-closed">Show guardrails</span>
                <span class="disclosure-action-open">Hide guardrails</span>
                <span class="disclosure-action-mark"></span>
              </span>
            </summary>

            <div class="field-grid design-constraints-grid">
              <label class="field">
                <span>Minimum font size (pt)</span>
                <input id="design-min-font-size" type="number" min="6" max="30" step="0.5">
              </label>

              <label class="field">
                <span>Minimum content gap (in)</span>
                <input id="design-min-content-gap" type="number" min="0.02" max="1.5" step="0.01">
              </label>

              <label class="field">
                <span>Minimum caption gap (in)</span>
                <input id="design-min-caption-gap" type="number" min="0.02" max="1" step="0.01">
              </label>

              <label class="field">
                <span>Minimum panel padding (in)</span>
                <input id="design-min-panel-padding" type="number" min="0.02" max="0.5" step="0.01">
              </label>

              <label class="field">
                <span>Maximum words per slide</span>
                <input id="design-max-words" type="number" min="10" max="250" step="1">
              </label>
            </div>
          </details>

        </article>
        </div>

        <div class="outline-mode-panel" id="outline-mode-plans" role="tabpanel" aria-labelledby="outline-mode-plans-tab" data-outline-mode-panel="plans" hidden>
        <article class="editorial-block editorial-block-wide outline-plan-panel" aria-label="Outline plans">
          <div class="section-heading compact-heading">
            <div>
              <p class="eyebrow">Reusable plans</p>
              <h2>Outline Plans</h2>
            </div>
          </div>
          <p class="section-note">
            Reuse generated outlines as a compact decision surface before changing the active deck structure.
          </p>
          <div class="outline-plan-list" id="outline-plan-list"></div>
        </article>
        </div>

        <div class="outline-mode-panel" id="outline-mode-length" role="tabpanel" aria-labelledby="outline-mode-length-tab" data-outline-mode-panel="length" hidden>
        <article class="editorial-block editorial-block-wide deck-length-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Length</p>
              <h2>Scale Deck</h2>
            </div>
          </div>

          <p class="section-note">
            Plan a shorter or longer active deck without deleting slides. Hidden slides are marked as skipped and can be restored later.
          </p>

          <div class="field-grid deck-length-grid">
            <label class="field">
              <span>Target slides</span>
              <input id="deck-length-target" type="number" min="1" step="1">
            </label>
            <label class="field">
              <span>Mode</span>
              <select id="deck-length-mode">
                <option value="balanced">Balanced</option>
                <option value="semantic">Semantic</option>
                <option value="front-loaded">Front-loaded</option>
                <option value="appendix-first">Appendix first</option>
                <option value="manual">Manual review</option>
              </select>
              <small id="deck-length-mode-help">Semantic planning keeps the strongest narrative path and archives lower-value support slides first.</small>
            </label>
            <div class="button-row compact deck-length-actions">
              <button id="deck-length-plan-button" class="secondary" type="button">Plan length</button>
              <button id="deck-length-apply-button" type="button" disabled>Apply length plan</button>
            </div>
          </div>

          <div class="deck-length-summary" id="deck-length-summary"></div>
          <div class="variant-list workflow-variant-list deck-length-plan-list" id="deck-length-plan-list"></div>
          <div class="deck-length-restore-list" id="deck-length-restore-list"></div>
        </article>
        </div>

        <div class="outline-mode-panel" id="outline-mode-changes" role="tabpanel" aria-labelledby="outline-mode-changes-tab" data-outline-mode-panel="changes" hidden>
        <article class="editorial-block editorial-block-wide">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Workflow</p>
              <h2>Deck Plans</h2>
            </div>
          </div>

          <p class="section-note" id="deck-structure-note">
            Generate structure or batch-authoring plans from the saved deck brief and outline, then apply one back to the outline and live slide files when it reads right.
          </p>

          <div class="button-row compact deck-structure-actions">
            <button id="ideate-deck-structure-button">Ideate deck plans</button>
          </div>

          <div class="workflow-variants">
            <div class="variant-list workflow-variant-list" id="deck-structure-list"></div>
          </div>
        </article>
        </div>
      </div>
    </aside>
`;

export function mountOutlineDrawerShell(documentRef: Document): void {
  if (documentRef.getElementById("outline-drawer")) {
    return;
  }

  const contextDrawer = documentRef.getElementById("context-drawer");
  if (!contextDrawer || !contextDrawer.parentElement) {
    throw new Error("Outline drawer shell mount point is missing");
  }

  contextDrawer.insertAdjacentHTML("beforebegin", outlineDrawerMarkup);
}
