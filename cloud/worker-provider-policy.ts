import { badRequestResponse } from "./worker-responses.ts";

export type CloudProvider = "workers-ai";
export type CloudProviderDataClass =
  | "deck-context"
  | "selected-source-snippets"
  | "materials-metadata"
  | "model-visible-media";
export type CloudProviderWorkflow = "deck-outline" | "slide-draft" | "theme" | "variant";

export type CloudProviderSnapshot = {
  allowedDataClasses: string[];
  enabledWorkflows: string[];
  model: string;
  provider: string;
  updatedAt: string;
  workspaceId: string;
};

const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const defaultProviderDataClasses: CloudProviderDataClass[] = ["deck-context", "selected-source-snippets"];
const defaultProviderWorkflows: CloudProviderWorkflow[] = ["deck-outline", "slide-draft", "variant", "theme"];
const providerDataClasses = new Set<string>([
  "deck-context",
  "selected-source-snippets",
  "materials-metadata",
  "model-visible-media"
]);
const providerWorkflows = new Set<string>([
  "deck-outline",
  "slide-draft",
  "theme",
  "variant"
]);

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function assertCloudId(value: unknown, label: string): string {
  const id = String(value || "").trim();
  if (!idPattern.test(id)) {
    throw new Error(`${label} must start with a lowercase letter or number and contain only lowercase letters, numbers, and dashes.`);
  }
  return id;
}

export function isSupportedProviderWorkflow(value: unknown): value is CloudProviderWorkflow {
  return providerWorkflows.has(String(value || ""));
}

export function normalizeProviderDataClasses(value: unknown): CloudProviderDataClass[] | Response {
  const requested = asStringArray(value);
  const values = requested.length ? requested : defaultProviderDataClasses;
  const normalized = Array.from(new Set(values));
  const invalid = normalized.find((item) => !providerDataClasses.has(item));
  if (invalid) {
    return badRequestResponse(`allowedDataClasses includes unsupported data class: ${invalid}`);
  }

  return normalized as CloudProviderDataClass[];
}

export function normalizeProviderWorkflows(value: unknown): CloudProviderWorkflow[] | Response {
  const requested = asStringArray(value);
  const values = requested.length ? requested : defaultProviderWorkflows;
  const normalized = Array.from(new Set(values));
  const invalid = normalized.find((item) => !providerWorkflows.has(item));
  if (invalid) {
    return badRequestResponse(`enabledWorkflows includes unsupported workflow: ${invalid}`);
  }

  return normalized as CloudProviderWorkflow[];
}

export function normalizeCloudProvider(value: unknown): CloudProvider | Response {
  const provider = String(value || "").trim() || "workers-ai";
  if (provider !== "workers-ai") {
    return badRequestResponse("provider must be workers-ai in the first cloud generation slice.");
  }

  return provider;
}

export function normalizeOptionalCloudIds(value: unknown, label: string): string[] | Response {
  const ids = asStringArray(value);
  const normalized: string[] = [];
  for (const id of ids) {
    try {
      normalized.push(assertCloudId(id, label));
    } catch (error) {
      return badRequestResponse(error instanceof Error ? error.message : `Invalid ${label}.`);
    }
  }

  return Array.from(new Set(normalized));
}
