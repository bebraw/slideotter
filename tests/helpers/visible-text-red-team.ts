import { readFileSync } from "node:fs";

export type JsonRecord = Record<string, unknown>;

export type RedTeamFixture = {
  code: string;
  name: string;
  text: string;
};

export type SafeVisibleTextFixture = {
  name: string;
  text: string;
};

// Add blocked examples to visible-text-red-team-corpus.json when model output
// exposes prompt, schema, instruction, or planning language. Add safe examples
// to visible-text-safe-corpus.json when product/domain copy uses nearby words legitimately, so the
// quarantine stays strict without becoming too broad.
export const redTeamCorpus = JSON.parse(readFileSync(new URL("../fixtures/visible-text-red-team-corpus.json", import.meta.url), "utf8")) as RedTeamFixture[];
export const safeVisibleTextCorpus = JSON.parse(readFileSync(new URL("../fixtures/visible-text-safe-corpus.json", import.meta.url), "utf8")) as SafeVisibleTextFixture[];

export const redTeamFieldPaths = [
  "title",
  "summary",
  "note",
  "media.alt",
  "media.caption",
  "bullets.0.title",
  "bullets.0.body",
  "cards.0.title",
  "cards.0.body",
  "signals.0.title",
  "signals.0.body",
  "guardrails.0.title",
  "guardrails.0.body",
  "resources.0.title",
  "resources.0.body",
  "mediaItems.0.title",
  "mediaItems.0.body"
] as const;

export type RedTeamFieldPath = typeof redTeamFieldPaths[number];

export function createRedTeamSlideSpec(fieldPath: RedTeamFieldPath, text: string): JsonRecord {
  const slideSpec: JsonRecord = {
    bullets: [{ body: "Concrete audience-facing detail.", id: "bullet-one", title: "Audience detail" }],
    cards: [{ body: "Concrete audience-facing card detail.", id: "card-one", title: "Card detail" }],
    guardrails: [{ body: "Concrete audience-facing check detail.", id: "guardrail-one", title: "Check detail" }],
    guardrailsTitle: "Review boundary",
    media: { alt: "Diagram showing a review boundary.", caption: "Review boundary diagram." },
    mediaItems: [{ body: "Concrete media detail.", id: "media-item-one", title: "Media detail" }],
    note: "Audience-facing speaker note.",
    resources: [{ body: "Concrete source detail.", id: "resource-one", title: "Source detail" }],
    resourcesTitle: "Sources",
    signals: [{ body: "Concrete audience-facing signal detail.", id: "signal-one", title: "Signal detail" }],
    signalsTitle: "Signals",
    summary: "Audience-facing summary.",
    title: "Audience-facing title",
    type: "content"
  };

  const pathParts = fieldPath.split(".");
  let target: JsonRecord | unknown[] = slideSpec;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const part = pathParts[index];
    if (part === undefined) {
      break;
    }
    const next = Array.isArray(target) ? target[Number(part)] : target[part];
    if (!next || typeof next !== "object") {
      throw new Error(`Invalid red-team field path: ${fieldPath}`);
    }
    target = next as JsonRecord | unknown[];
  }

  const field = pathParts[pathParts.length - 1];
  if (field === undefined) {
    throw new Error(`Invalid red-team field path: ${fieldPath}`);
  }
  if (Array.isArray(target)) {
    target[Number(field)] = text;
  } else {
    target[field] = text;
  }
  return slideSpec;
}
