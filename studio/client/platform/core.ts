export namespace StudioClientCore {
  export type JsonRequestOptions = RequestInit;

  export type DomElementOptions = {
    attributes?: Record<string, string | number | boolean>;
    className?: string;
    dataset?: Record<string, string | number | boolean>;
    disabled?: boolean;
    text?: unknown;
  };

  type BusyElement = HTMLElement & {
    disabled: boolean;
  };

  export function requiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing required studio element: #${id}`);
    }
    return element;
  }

  export function optionalElement(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  export function optionalSelector(selector: string): Element | null {
    return document.querySelector(selector);
  }

  export async function request<TResponse = unknown>(url: string, options: JsonRequestOptions = {}): Promise<TResponse> {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }

    return payload as TResponse;
  }

  export function postJson<TBody = unknown, TResponse = unknown>(url: string, body: TBody, options: JsonRequestOptions = {}): Promise<TResponse> {
    return request<TResponse>(url, {
      ...options,
      body: JSON.stringify(body),
      method: "POST"
    });
  }

  export function isAbortError(error: unknown): boolean {
    return Boolean(
      error
        && typeof error === "object"
        && (
          ("name" in error && error.name === "AbortError")
          || ("code" in error && error.code === 20)
        )
    );
  }

  export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  export function setBusy(button: BusyElement, label: string): () => void {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = label;

    return () => {
      button.disabled = false;
      button.textContent = previous;
    };
  }

  export function escapeHtml(value: unknown): string {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  export function highlightJsonSource(source: unknown): string {
    const text = String(source || "");
    const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    let cursor = 0;
    let markup = "";

    text.replace(tokenPattern, (token: string, quoted: string | undefined, keySuffix: string | undefined, offset: number) => {
      markup += escapeHtml(text.slice(cursor, offset));

      if (quoted) {
        const tokenClass = keySuffix ? "json-token-key" : "json-token-string";
        markup += `<span class="${tokenClass}">${escapeHtml(quoted)}</span>${escapeHtml(keySuffix || "")}`;
      } else if (/^-?\d/.test(token)) {
        markup += `<span class="json-token-number">${escapeHtml(token)}</span>`;
      } else {
        markup += `<span class="json-token-literal">${escapeHtml(token)}</span>`;
      }

      cursor = offset + token.length;
      return token;
    });

    markup += escapeHtml(text.slice(cursor));
    return markup || " ";
  }

  export function formatSourceCode(source: unknown, format = "plain"): string {
    return format === "json" ? highlightJsonSource(source) : escapeHtml(source);
  }

  function createTokenSpan(className: string, text: string): HTMLElement {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  export function formatSourceCodeNodes(source: unknown, format = "plain"): Array<HTMLElement | string> {
    const text = String(source || "");
    if (format !== "json") {
      return [text || " "];
    }

    const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    const nodes: Array<HTMLElement | string> = [];
    let cursor = 0;

    text.replace(tokenPattern, (token: string, quoted: string | undefined, keySuffix: string | undefined, offset: number) => {
      const prefix = text.slice(cursor, offset);
      if (prefix) {
        nodes.push(prefix);
      }

      if (quoted) {
        nodes.push(createTokenSpan(keySuffix ? "json-token-key" : "json-token-string", quoted));
        if (keySuffix) {
          nodes.push(keySuffix);
        }
      } else if (/^-?\d/.test(token)) {
        nodes.push(createTokenSpan("json-token-number", token));
      } else {
        nodes.push(createTokenSpan("json-token-literal", token));
      }

      cursor = offset + token.length;
      return token;
    });

    const suffix = text.slice(cursor);
    if (suffix) {
      nodes.push(suffix);
    }
    return nodes.length ? nodes : [" "];
  }

  export function createDomElement(tagName: string, options: DomElementOptions = {}, children: Array<Node | string | number | boolean> = []): HTMLElement {
    const element = document.createElement(tagName);
    if (options.className) {
      element.className = options.className;
    }
    if (options.text !== undefined) {
      element.textContent = String(options.text);
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        element.dataset[key] = String(value);
      });
    }
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
      });
    }
    if (options.disabled && "disabled" in element) {
      element.disabled = true;
    }
    children.forEach((child) => {
      element.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }
}
