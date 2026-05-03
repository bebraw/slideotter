import type { JsonObject } from "./generated-slide-types.ts";

type PathContainer = JsonObject | unknown[];

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPathContainer(value: unknown): value is PathContainer {
  return isJsonObject(value) || Array.isArray(value);
}

function getPathChild(container: PathContainer, key: string | number): unknown {
  if (Array.isArray(container) && typeof key === "number") {
    return container[key];
  }

  if (isJsonObject(container) && typeof key === "string") {
    return container[key];
  }

  return undefined;
}

function setPathChild(container: PathContainer | undefined, key: string | number, value: unknown): void {
  if (Array.isArray(container) && typeof key === "number") {
    container[key] = value;
  } else if (isJsonObject(container) && typeof key === "string") {
    container[key] = value;
  }
}

export function cloneJsonObject<T extends JsonObject>(value: T): T {
  return JSON.parse(JSON.stringify(value || {})) as T;
}

export function setPathValue(target: JsonObject, pathParts: Array<string | number>, value: unknown): void {
  let current: PathContainer | undefined = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    if (key === undefined) {
      return;
    }

    const nextValue = getPathChild(current, key);
    if (!isPathContainer(nextValue)) {
      return;
    }

    current = nextValue;
  }

  const lastKey = pathParts[pathParts.length - 1];
  if (lastKey !== undefined) {
    setPathChild(current, lastKey, value);
  }
}
