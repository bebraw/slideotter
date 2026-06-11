const memoryDrawerMarkup = `
    <aside class="studio-drawer memory-drawer" id="memory-drawer" aria-label="Memory">
      <button
        class="studio-drawer-toggle memory-drawer-toggle"
        id="memory-drawer-toggle"
        type="button"
        aria-controls="memory-drawer-panel"
        aria-expanded="false"
        aria-label="Open memory"
        data-drawer-label="Memory"
      >
        <svg class="drawer-toggle-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7.5c0-2 3.6-3.5 8-3.5s8 1.5 8 3.5S16.4 11 12 11 4 9.5 4 7.5Z"></path>
          <path d="M4 7.5v4c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-4"></path>
          <path d="M4 11.5v4c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-4"></path>
        </svg>
      </button>

      <div class="studio-drawer-panel memory-drawer-panel" id="memory-drawer-panel">
        <div class="memory-drawer-panel-head">
          <div>
            <p class="eyebrow">Memory</p>
            <h2>Knowledge Memory</h2>
          </div>
          <button class="secondary compact-button" id="memory-refresh-button" type="button">Refresh</button>
        </div>

        <div class="memory-search-row">
          <label class="field">
            <span>Search</span>
            <input id="memory-search" type="search" placeholder="claims, evidence, style notes">
          </label>
        </div>

        <form class="memory-create-form" id="memory-create-form">
          <div class="memory-create-grid">
            <label class="field">
              <span>Type</span>
              <select id="memory-type">
                <option value="claim">Claim</option>
                <option value="evidence">Evidence</option>
                <option value="styleNote">Style note</option>
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select id="memory-status">
                <option value="draft">Draft</option>
                <option value="accepted">Accepted</option>
                <option value="stale">Stale</option>
              </select>
            </label>
          </div>
          <label class="field">
            <span>Summary</span>
            <input id="memory-summary" type="text" placeholder="Reusable claim or note">
          </label>
          <label class="field">
            <span>Detail</span>
            <textarea id="memory-detail" placeholder="Optional detail, evidence note, or rationale"></textarea>
          </label>
          <button id="memory-create-button" class="secondary" type="submit">Add memory</button>
        </form>

        <p class="section-note" id="memory-status-note">Memory is presentation-scoped.</p>
        <div class="memory-list" id="memory-list"></div>
      </div>
    </aside>
`;

export function mountMemoryDrawerShell(documentRef: Document): void {
  if (documentRef.getElementById("memory-drawer")) {
    return;
  }

  const contextDrawer = documentRef.getElementById("context-drawer");
  if (!contextDrawer || !contextDrawer.parentElement) {
    throw new Error("Memory drawer shell mount point is missing");
  }

  contextDrawer.insertAdjacentHTML("beforebegin", memoryDrawerMarkup);
}
