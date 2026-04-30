namespace StudioClientApiExplorer {
  export function createApiExplorer({ elements, escapeHtml, request, state, window }) {
    function formatApiJson(value) {
      return escapeHtml(JSON.stringify(value, null, 2));
    }

    function getState() {
      if (!state.hypermedia) {
        state.hypermedia = { activePresentation: null, explorer: { history: [], resource: null, url: "/api/v1" }, root: null };
      }
      if (!state.hypermedia.explorer) {
        state.hypermedia.explorer = { history: [], resource: null, url: "/api/v1" };
      }
      return state.hypermedia.explorer;
    }

    function normalizeHref(href) {
      const value = String(href || "").trim();
      if (!value) {
        return "/api/v1";
      }

      try {
        const url = new URL(value, window.location.origin);
        if (url.origin !== window.location.origin) {
          throw new Error("API explorer only opens same-origin resources.");
        }
        return `${url.pathname}${url.search}`;
      } catch (error) {
        throw new Error(error.message || "API explorer needs a valid URL.");
      }
    }

    function render() {
      if (!elements.apiExplorerResource) {
        return;
      }

      const explorer = getState();
      const resource = explorer.resource;
      elements.apiExplorerUrl.value = explorer.url || "/api/v1";
      elements.apiExplorerBack.disabled = !explorer.history.length;

      if (!resource) {
        elements.apiExplorerStatus.textContent = "No API resource loaded yet.";
        elements.apiExplorerResource.innerHTML = "";
        return;
      }

      const links = resource.links && typeof resource.links === "object" && !Array.isArray(resource.links)
        ? Object.entries(resource.links).filter((entry) => entry[1] && typeof (entry[1] as any).href === "string")
        : [];
      const actions = Array.isArray(resource.actions) ? resource.actions : [];
      const statePreview = resource.state || resource;

      elements.apiExplorerStatus.textContent = `${resource.resource || "resource"} ${resource.id || ""}`.trim();
      elements.apiExplorerResource.innerHTML = `
        <div class="api-explorer-summary">
          <strong>${escapeHtml(resource.resource || "resource")}</strong>
          <span>${escapeHtml(resource.version ? `v${String(resource.version).replace(/^v/, "")}` : "unversioned")}</span>
        </div>
        <details class="api-explorer-details" open>
          <summary>State</summary>
          <pre>${formatApiJson(statePreview)}</pre>
        </details>
        <details class="api-explorer-details" open>
          <summary>Links</summary>
          <div class="api-explorer-list">
            ${links.length ? links.map(([rel, linkValue]) => `
              <button class="api-explorer-row" type="button" data-api-href="${escapeHtml((linkValue as any).href)}">
                <strong>${escapeHtml(rel)}</strong>
                <span>${escapeHtml((linkValue as any).href)}</span>
              </button>
            `).join("") : "<div class=\"api-explorer-empty\">No links.</div>"}
          </div>
        </details>
        <details class="api-explorer-details" open>
          <summary>Actions</summary>
          <div class="api-explorer-list">
            ${actions.length ? actions.map((action) => `
              <article class="api-explorer-action">
                <div>
                  <strong>${escapeHtml(action.id || "action")}</strong>
                  <span>${escapeHtml([action.method, action.effect, action.scope].filter(Boolean).join(" · "))}</span>
                </div>
                <code>${escapeHtml(action.href || "")}</code>
              </article>
            `).join("") : "<div class=\"api-explorer-empty\">No actions.</div>"}
          </div>
        </details>
      `;
    }

    async function openResource(href, options: any = {}) {
      const explorer = getState();
      const nextUrl = normalizeHref(href);
      const previousUrl = explorer.url || "/api/v1";

      elements.apiExplorerStatus.textContent = `Loading ${nextUrl}...`;
      const resource = await request(nextUrl);
      if (options.pushHistory !== false && previousUrl !== nextUrl) {
        explorer.history = [...explorer.history.slice(-12), previousUrl];
      }
      explorer.url = nextUrl;
      explorer.resource = resource;
      render();
    }

    function openPrevious() {
      const explorer = getState();
      const previous = explorer.history.pop();
      if (!previous) {
        render();
        return Promise.resolve();
      }
      return openResource(previous, { pushHistory: false });
    }

    function reportError(error) {
      elements.apiExplorerStatus.textContent = error.message;
    }

    function mount() {
      elements.apiExplorerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        openResource(elements.apiExplorerUrl.value).catch(reportError);
      });
      elements.apiExplorerRoot.addEventListener("click", () => {
        openResource("/api/v1").catch(reportError);
      });
      elements.apiExplorerBack.addEventListener("click", () => {
        openPrevious().catch(reportError);
      });
      elements.apiExplorerResource.addEventListener("click", (event) => {
        const target = (event.target as Element).closest("[data-api-href]") as HTMLElement | null;
        if (!target) {
          return;
        }
        openResource(target.dataset.apiHref).catch(reportError);
      });
    }

    return {
      getState,
      mount,
      openPrevious,
      openResource,
      render
    };
  }
}
(globalThis as any).StudioClientApiExplorer = StudioClientApiExplorer;
