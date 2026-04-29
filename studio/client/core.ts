namespace StudioClientCore {
  export function requiredElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing required studio element: #${id}`);
    }
    return element;
  }

  export function optionalElement(id) {
    return document.getElementById(id);
  }

  export function optionalSelector(selector) {
    return document.querySelector(selector);
  }

  export async function request(url, options: any = {}) {
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

    return payload;
  }

  export function postJson(url, body, options: any = {}) {
    return request(url, {
      ...options,
      body: JSON.stringify(body),
      method: "POST"
    });
  }

  export function isAbortError(error) {
    return error && (error.name === "AbortError" || error.code === 20);
  }

  export function setBusy(button, label) {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = label;

    return () => {
      button.disabled = false;
      button.textContent = previous;
    };
  }

  export function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  export function createDomElement(tagName, options: any = {}, children: any[] = []) {
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
    if (options.disabled) {
      element.disabled = true;
    }
    children.forEach((child) => {
      element.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }
}
