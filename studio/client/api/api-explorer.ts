import type { StudioClientElements } from "../core/elements.ts";
import { withClientSelectedSlideLink } from "./api-explorer-model.ts";

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
    audience?: string;
    baseVersion?: string | number;
    effect?: string;
    href?: string;
    id?: string;
    input?: string;
    inputSchema?: string;
    label?: string;
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
      presentations?: {
        activePresentationId: string | null;
      };
      selectedSlideId?: string | null;
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

    function metadataValue(value: unknown): string {
      return String(value || "").trim();
    }

    function compactActionMeta(action: ApiAction): string {
      return [
        metadataValue(action.method),
        metadataValue(action.effect),
        metadataValue(action.scope),
        metadataValue(action.audience),
        metadataValue(action.inputSchema || action.input)
      ].filter(Boolean).join(" · ");
    }

    function renderApiAction(action: ApiAction): HTMLElement {
      const actionMeta = compactActionMeta(action);
      const baseVersion = metadataValue(action.baseVersion);
      return createDomElement("article", { className: "api-explorer-action" }, [
        createDomElement("div", { className: "api-explorer-action-head" }, [
          createDomElement("strong", { text: action.label || action.id || "action" }),
          createDomElement("button", {
            attributes: { type: "button" },
            className: "secondary utility-button api-explorer-copy-action",
            dataset: { apiActionJson: formatApiJson(action) },
            text: "Copy"
          })
        ]),
        createDomElement("span", { text: actionMeta || "No metadata" }),
        baseVersion ? createDomElement("span", { text: `base ${baseVersion}` }) : "",
        createDomElement("code", { text: `${action.method || "GET"} ${action.href || ""}` })
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
      const resource = explorer.resource
        ? withClientSelectedSlideLink(explorer.resource, {
          activePresentationId: state.presentations?.activePresentationId || null,
          selectedSlideId: state.selectedSlideId || null
        })
        : null;
      explorer.resource = resource;
      elements.apiExplorerUrl.value = explorer.url || "/api/v1";
      elements.apiExplorerBack.disabled = !explorer.history.length;
      elements.apiExplorerCopy.disabled = !resource;
      elements.apiExplorerActive.disabled = !state.presentations?.activePresentationId;
      elements.apiExplorerSlide.disabled = !state.presentations?.activePresentationId || !state.selectedSlideId;

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

      const actionCount = actions.length;
      const linkCount = links.length;
      elements.apiExplorerStatus.textContent = `${resource.resource || "resource"} ${resource.id || ""}`.trim();
      elements.apiExplorerResource.replaceChildren(
        createDomElement("div", { className: "api-explorer-summary" }, [
          createDomElement("strong", { text: `${resource.resource || "resource"}${resource.id ? ` / ${resource.id}` : ""}` }),
          createDomElement("span", {
            text: `${linkCount} link${linkCount === 1 ? "" : "s"} · ${actionCount} action${actionCount === 1 ? "" : "s"} · ${resource.version ? `v${String(resource.version).replace(/^v/, "")}` : "unversioned"}`
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

    async function copyText(value: string, label: string): Promise<void> {
      if (!window.navigator.clipboard) {
        throw new Error("Clipboard API is unavailable.");
      }
      await window.navigator.clipboard.writeText(value);
      elements.apiExplorerStatus.textContent = `Copied ${label}.`;
    }

    function openActivePresentation(): Promise<void> {
      const activePresentationId = state.presentations?.activePresentationId;
      if (!activePresentationId) {
        throw new Error("No active presentation is selected.");
      }
      return openResource(`/api/v1/presentations/${activePresentationId}`);
    }

    function openSelectedSlide(): Promise<void> {
      const activePresentationId = state.presentations?.activePresentationId;
      const selectedSlideId = state.selectedSlideId;
      if (!activePresentationId || !selectedSlideId) {
        throw new Error("No selected slide resource is available.");
      }
      return openResource(`/api/v1/presentations/${activePresentationId}/slides/${selectedSlideId}`);
    }

    function mount(): void {
      elements.apiExplorerForm.addEventListener("submit", (event: SubmitEvent) => {
        event.preventDefault();
        openResource(elements.apiExplorerUrl.value).catch(reportError);
      });
      elements.apiExplorerRoot.addEventListener("click", () => {
        openResource("/api/v1").catch(reportError);
      });
      elements.apiExplorerActive.addEventListener("click", () => {
        openActivePresentation().catch(reportError);
      });
      elements.apiExplorerSlide.addEventListener("click", () => {
        openSelectedSlide().catch(reportError);
      });
      elements.apiExplorerBack.addEventListener("click", () => {
        openPrevious().catch(reportError);
      });
      elements.apiExplorerCopy.addEventListener("click", () => {
        const resource = getState().resource;
        if (!resource) {
          return;
        }
        copyText(formatApiJson(resource), "resource JSON").catch(reportError);
      });
      elements.apiExplorerResource.addEventListener("click", (event: MouseEvent) => {
        const actionTarget = (event.target as Element).closest("[data-api-action-json]") as HTMLElement | null;
        if (actionTarget) {
          copyText(actionTarget.dataset.apiActionJson || "", "action JSON").catch(reportError);
          return;
        }
        const linkTarget = (event.target as Element).closest("[data-api-href]") as HTMLElement | null;
        if (linkTarget) {
          openResource(linkTarget.dataset.apiHref).catch(reportError);
        }
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
