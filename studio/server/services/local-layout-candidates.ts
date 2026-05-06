import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-utils.ts";
import { applyLayoutToSlideSpec, readFavoriteLayouts, readLayouts } from "./layouts.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

type Candidate = JsonObject & {
  changeSummary?: string[];
  label: string;
  notes?: unknown;
  promptSummary?: unknown;
  slideSpec: SlideSpec;
};

type OperationOptions = JsonObject & {
  dryRun?: unknown;
};

function describeVariantPersistence(_options: OperationOptions = {}): string {
  return "Generated as a session-only candidate; apply one to update the slide.";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSameFamilyLayoutIntentSpec(currentSpec: SlideSpec, intent: unknown): SlideSpec {
  const sourceIntent = asJsonObject(intent);
  const emphasis = String([sourceIntent.emphasis, sourceIntent.label, sourceIntent.rationale].filter(Boolean).join(" ")).toLowerCase();
  const nextSpec = {
    ...currentSpec
  };

  if (currentSpec.type === "content") {
    if (/guardrail|solution|capabilit/.test(emphasis)) {
      nextSpec.layout = "checklist";
    } else if (/signal|problem|drift|timeline|process/.test(emphasis)) {
      nextSpec.layout = "steps";
    } else if (/quote|summary|impact|focus/.test(emphasis)) {
      nextSpec.layout = "standard";
    } else {
      nextSpec.layout = chooseAlternateLayout(currentSpec.layout, ["steps", "checklist", "standard"]);
    }
  } else if (currentSpec.type === "summary") {
    nextSpec.layout = /resource|reference|handoff/.test(emphasis)
      ? "checklist"
      : chooseAlternateLayout(currentSpec.layout, ["checklist", "standard"]);
  } else if (currentSpec.type === "photoGrid") {
    const mediaItems = Array.isArray(currentSpec.mediaItems)
      ? currentSpec.mediaItems.map((item: unknown) => ({ ...asJsonObject(item) }))
      : [];
    if (/compare|comparison|side-by-side|contrast/.test(emphasis)) {
      nextSpec.layout = "standard";
      nextSpec.mediaItems = rotateItems(mediaItems, 1);
    } else if (/evidence|proof|sequence|story|set/.test(emphasis)) {
      nextSpec.layout = "standard";
      nextSpec.mediaItems = rotateItems(mediaItems, mediaItems.length > 2 ? 2 : 1);
    } else {
      nextSpec.layout = "standard";
      nextSpec.mediaItems = mediaItems;
    }
  } else if (["cover", "toc"].includes(String(currentSpec.type))) {
    nextSpec.layout = currentSpec.layout || "standard";
  }

  return asJsonObject(validateSlideSpec(nextSpec));
}

function rotateItems<T>(items: T[], offset = 0): T[] {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const shift = ((offset % items.length) + items.length) % items.length;
  return items.map((_item: T, index: number): T => {
    const nextItem = items[(index + shift) % items.length];
    if (nextItem === undefined) {
      return _item;
    }
    return cloneJson(nextItem);
  });
}

function chooseAlternateLayout(currentLayout: unknown, candidates: string[]): string {
  const current = typeof currentLayout === "string" && currentLayout ? currentLayout : "standard";
  return candidates.find((candidate) => candidate !== current) || current;
}

export function createLibraryLayoutCandidates(currentSpec: SlideSpec, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const slideType = currentSpec && currentSpec.type ? String(currentSpec.type) : "";
  const deckLayouts = asJsonObjectArray(readLayouts().layouts).map((layout: JsonObject) => ({
    layout,
    sourceLabel: "deck",
    sourceName: "deck-local"
  }));
  const favoriteLayouts = asJsonObjectArray(readFavoriteLayouts().layouts).map((layout: JsonObject) => ({
    layout,
    sourceLabel: "favorite",
    sourceName: "favorite"
  }));

  return [...deckLayouts, ...favoriteLayouts]
    .filter(({ layout }: { layout: JsonObject }) => Array.isArray(layout.supportedTypes) && layout.supportedTypes.includes(slideType))
    .map(({ layout, sourceLabel, sourceName }: { layout: JsonObject; sourceLabel: string; sourceName: string }) => ({
      changeSummary: [
        `Applied saved ${sourceName} layout "${layout.name}".`,
        `Changed the slide layout treatment to ${layout.treatment}.`,
        "Reused a validated layout-library item while keeping the current slide family.",
        modeLabel
      ],
      generator: "local",
      label: `Use ${sourceLabel} layout: ${layout.name}`,
      model: null,
      notes: layout.description || `Reuses the ${layout.treatment} layout treatment from the ${sourceName} layout library.`,
      promptSummary: `Applies saved ${sourceName} layout ${layout.name} to this ${slideType} slide.`,
      provider: "local",
      slideSpec: asJsonObject(validateSlideSpec(applyLayoutToSlideSpec(
        currentSpec,
        `${sourceLabel}:${layout.id}`
      )))
    }));
}
