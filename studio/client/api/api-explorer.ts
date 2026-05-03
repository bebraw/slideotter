import type { StudioClientElements } from "../elements.ts";

export namespace StudioClientApiExplorer {
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

  type ApiLink = {
    href: string;
  };

  type ApiAction = {
    effect?: string;
    href?: string;
    id?: string;
    method?: string;
    scope?: string;
  };

  type ApiResource = {
    actions?: ApiAction[];
    id?: string;
    links?: Record<string, ApiLink | null | undefined>;
    resource?: string;
    state?: unknown;
    version?: string;
  };

  type ApiExplorerState = {
    history: string[];
    resource: ApiResource | null;
    url: string;
  };

  type ApiExplorerDependencies = {
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    request: (url: string) => Promise<ApiResource>;
    state: {
      hypermedia?: {
        activePresentation: unknown;
        explorer?: ApiExplorerState;
        root: unknown;
      };
    };
    window: Window;
  };

  type OpenResourceOptions = {
    pushHistory?: boolean;
  };

  export function createApiExplorer({ createDomElement, elements, request, state, window }: ApiExplorerDependencies) {
    function isApiLink(value: unknown): value is ApiLink {
      return Boolean(value && typeof value === "object" && "href" in value && typeof value.href === "string");
    }

    function formatError(error: unknown): string {
      return error instanceof Error ? error.message : String(error || "API explorer needs a valid URL.");
    }

    function formatApiJson(value: unknown): string {
      return JSON.stringify(value, null, 2);
    }

    function renderApiLinkRow(rel: string, linkValue: ApiLink): HTMLElement {
      return createDomElement("button", {
        attributes: { type: "button" },
        className: "api-explorer-row",
        dataset: { apiHref: linkValue.href }
      }, [
        createDomElement("strong", { text: rel }),
        createDomElement("span", { text: linkValue.href })
      ]);
    }

    function renderApiAction(action: ApiAction): HTMLElement {
      const actionMeta = [action.method, action.effect, action.scope].filter(Boolean).join(" · ");
      return createDomElement("article", { className: "api-explorer-action" }, [
        createDomElement("div", {}, [
          createDomElement("strong", { text: action.id || "action" }),
          createDomElement("span", { text: actionMeta })
        ]),
        createDomElement("code", { text: action.href || "" })
      ]);
    }

    function getState(): ApiExplorerState {
      if (!state.hypermedia) {
        state.hypermedia = { activePresentation: null, explorer: { history: [], resource: null, url: "/api/v1" }, root: null };
      }
      if (!state.hypermedia.explorer) {
        state.hypermedia.explorer = { history: [], resource: null, url: "/api/v1" };
      }
      return state.hypermedia.explorer;
    }

    function normalizeHref(href: string | null | undefined): string {
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
        throw new Error(formatError(error));
      }
    }

    function render(): void {
      if (!elements.apiExplorerResource) {
        return;
      }

      const explorer = getState();
      const resource = explorer.resource;
      elements.apiExplorerUrl.value = explorer.url || "/api/v1";
      elements.apiExplorerBack.disabled = !explorer.history.length;

      if (!resource) {
        elements.apiExplorerStatus.textContent = "No API resource loaded yet.";
        elements.apiExplorerResource.replaceChildren();
        return;
      }

      const links = resource.links && typeof resource.links === "object" && !Array.isArray(resource.links)
        ? Object.entries(resource.links).filter((entry): entry is [string, ApiLink] => isApiLink(entry[1]))
        : [];
      const actions = Array.isArray(resource.actions) ? resource.actions : [];
      const statePreview = resource.state || resource;

      elements.apiExplorerStatus.textContent = `${resource.resource || "resource"} ${resource.id || ""}`.trim();
      elements.apiExplorerResource.replaceChildren(
        createDomElement("div", { className: "api-explorer-summary" }, [
          createDomElement("strong", { text: resource.resource || "resource" }),
          createDomElement("span", {
            text: resource.version ? `v${String(resource.version).replace(/^v/, "")}` : "unversioned"
          })
        ]),
        createDomElement("details", { attributes: { open: "open" }, className: "api-explorer-details" }, [
          createDomElement("summary", { text: "State" }),
          createDomElement("pre", { text: formatApiJson(statePreview) })
        ]),
        createDomElement("details", { attributes: { open: "open" }, className: "api-explorer-details" }, [
          createDomElement("summary", { text: "Links" }),
          createDomElement("div", { className: "api-explorer-list" }, links.length
            ? links.map(([rel, linkValue]) => renderApiLinkRow(rel, linkValue))
            : [createDomElement("div", { className: "api-explorer-empty", text: "No links." })])
        ]),
        createDomElement("details", { attributes: { open: "open" }, className: "api-explorer-details" }, [
          createDomElement("summary", { text: "Actions" }),
          createDomElement("div", { className: "api-explorer-list" }, actions.length
            ? actions.map((action) => renderApiAction(action))
            : [createDomElement("div", { className: "api-explorer-empty", text: "No actions." })])
        ])
      );
    }

    async function openResource(href: string | null | undefined, options: OpenResourceOptions = {}): Promise<void> {
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

    function openPrevious(): Promise<void> {
      const explorer = getState();
      const previous = explorer.history.pop();
      if (!previous) {
        render();
        return Promise.resolve();
      }
      return openResource(previous, { pushHistory: false });
    }

    function reportError(error: Error): void {
      elements.apiExplorerStatus.textContent = error.message;
    }

    function mount(): void {
      elements.apiExplorerForm.addEventListener("submit", (event: SubmitEvent) => {
        event.preventDefault();
        openResource(elements.apiExplorerUrl.value).catch(reportError);
      });
      elements.apiExplorerRoot.addEventListener("click", () => {
        openResource("/api/v1").catch(reportError);
      });
      elements.apiExplorerBack.addEventListener("click", () => {
        openPrevious().catch(reportError);
      });
      elements.apiExplorerResource.addEventListener("click", (event: MouseEvent) => {
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
