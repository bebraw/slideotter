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
