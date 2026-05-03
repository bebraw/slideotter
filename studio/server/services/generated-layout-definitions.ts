import { normalizeLayoutDefinition } from "./layouts.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

type LayoutIntent = JsonObject & {
  emphasis?: unknown;
  label?: unknown;
  rationale?: unknown;
};

type SlotOptions = {
  maxLines?: number;
  required?: boolean;
};

type SlotDefinition = {
  id: string;
  maxLines: number | null;
  required: boolean;
  role: string;
};

type SlotRegionProfile = {
  layoutKind: string;
  maxLines: number;
  mediaFocalPoint: string;
  minFontSize: number;
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSentence(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function rotateItems<T>(items: T[], offset = 0): T[] {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const shift = ((offset % items.length) + items.length) % items.length;
  return items.map((_item: T, index: number): T => {
    const nextItem = items[(index + shift) % items.length];
    return nextItem === undefined ? _item : cloneJson(nextItem);
  });
}

export function createGeneratedLayoutDefinition(currentSpec: SlideSpec, slideSpec: SlideSpec, intent: LayoutIntent = {}): JsonObject | undefined {
  const photoGridDefinition = createPhotoGridLayoutDefinition(currentSpec, slideSpec);
  if (photoGridDefinition) {
    return photoGridDefinition;
  }

  const slotRegionDefinition = createSlotRegionLayoutDefinition(slideSpec, intent);
  if (!slotRegionDefinition) {
    return undefined;
  }

  return asJsonObject(normalizeLayoutDefinition(slotRegionDefinition, [String(slideSpec.type)]));
}

export function describeLayoutDefinition(definition: unknown): string {
  const source = asJsonObject(definition);
  if (!source.type) {
    return "generated";
  }

  if (source.type === "slotRegionLayout") {
    const slotCount = Array.isArray(source.slots) ? source.slots.length : 0;
    const regionCount = Array.isArray(source.regions) ? source.regions.length : 0;
    return `slot-region (${slotCount} slots, ${regionCount} regions)`;
  }

  if (source.type === "photoGridArrangement") {
    return `${source.arrangement || "photo-grid"} photo-grid`;
  }

  return String(source.type);
}

export function createSlotRegionLayoutDefinition(slideSpec: SlideSpec, intent: LayoutIntent = {}): JsonObject | undefined {
  if (!slideSpec || !slideSpec.type || slideSpec.type === "photoGrid") {
    return undefined;
  }

  const slots = getSlotDefinitionsForSlideSpec(slideSpec);
  if (!slots.length) {
    return undefined;
  }

  const emphasis = String([intent.emphasis, intent.label, intent.rationale, slideSpec.layout].filter(Boolean).join(" ")).toLowerCase();
  const layout = String(slideSpec.layout || "").trim();
  const profile = chooseSlotRegionProfile(slideSpec.type, layout, emphasis);
  const regions = createSlotRegions(slots, profile);

  return {
    constraints: {
      captionAttached: ["photo", "quote"].includes(String(slideSpec.type)),
      maxLines: slideSpec.type === "divider" ? 2 : profile.maxLines,
      minFontSize: slideSpec.type === "divider" ? 32 : profile.minFontSize,
      progressClearance: true
    },
    mediaTreatment: {
      fit: slideSpec.type === "photo" ? "cover" : "contain",
      focalPoint: profile.mediaFocalPoint
    },
    readingOrder: slots.map((slot: SlotDefinition) => slot.id),
    regions,
    slots,
    typography: Object.fromEntries(slots.map((slot: SlotDefinition) => [slot.id, typographyRoleForSlot(slot)])),
    type: "slotRegionLayout"
  };
}

function getSlotDefinitionsForSlideSpec(slideSpec: SlideSpec): SlotDefinition[] {
  const slots: SlotDefinition[] = [];
  const pushSlot = (id: string, role: string, options: SlotOptions = {}) => {
    slots.push({
      id,
      maxLines: options.maxLines || null,
      required: options.required !== false,
      role
    });
  };

  if (slideSpec.eyebrow) {
    pushSlot("eyebrow", "eyebrow", { maxLines: 1, required: false });
  }
  pushSlot("title", "title", { maxLines: slideSpec.type === "divider" ? 2 : 3 });

  switch (slideSpec.type) {
    case "cover":
    case "toc":
      pushSlot("summary", "summary", { maxLines: 3 });
      pushSlot("cards", "body", { maxLines: 6 });
      if (slideSpec.note) {
        pushSlot("note", "note", { maxLines: 2, required: false });
      }
      break;
    case "content":
      pushSlot("summary", "summary", { maxLines: 3 });
      pushSlot("signals", "signals", { maxLines: 6 });
      pushSlot("guardrails", "guardrails", { maxLines: 5 });
      break;
    case "summary":
      pushSlot("summary", "summary", { maxLines: 3 });
      pushSlot("bullets", "body", { maxLines: 6 });
      pushSlot("resources", "resources", { maxLines: 4 });
      break;
    case "quote":
      pushSlot("quote", "quote", { maxLines: 5 });
      if (slideSpec.attribution) {
        pushSlot("attribution", "source", { maxLines: 1, required: false });
      }
      if (slideSpec.context) {
        pushSlot("context", "body", { maxLines: 2, required: false });
      }
      break;
    case "photo":
      pushSlot("media", "media");
      if (slideSpec.caption || asJsonObject(slideSpec.media).caption) {
        pushSlot("caption", "caption", { maxLines: 2, required: false });
      }
      break;
    case "divider":
      break;
    default:
      return [];
  }

  return slots;
}

function chooseSlotRegionProfile(slideType: unknown, layout: string, emphasis: string): SlotRegionProfile {
  if (slideType === "photo") {
    return {
      layoutKind: "media-lead",
      maxLines: 4,
      mediaFocalPoint: "center",
      minFontSize: 18
    };
  }

  if (slideType === "quote") {
    return {
      layoutKind: "quote-lead",
      maxLines: 5,
      mediaFocalPoint: "center",
      minFontSize: 22
    };
  }

  if (slideType === "divider") {
    return {
      layoutKind: "centered-title",
      maxLines: 2,
      mediaFocalPoint: "center",
      minFontSize: 32
    };
  }

  if (/sidebar|aside|support|evidence|source/.test(emphasis) || layout === "strip") {
    return {
      layoutKind: "lead-sidebar",
      maxLines: 6,
      mediaFocalPoint: "center",
      minFontSize: 18
    };
  }

  if (/sequence|step|process|timeline/.test(emphasis) || layout === "steps") {
    return {
      layoutKind: "stacked-sequence",
      maxLines: 5,
      mediaFocalPoint: "center",
      minFontSize: 18
    };
  }

  if (/focus|quote|claim|impact/.test(emphasis) || layout === "focus" || layout === "callout") {
    return {
      layoutKind: "lead-support",
      maxLines: 5,
      mediaFocalPoint: "center",
      minFontSize: 20
    };
  }

  return {
    layoutKind: "balanced-grid",
    maxLines: 6,
    mediaFocalPoint: "center",
    minFontSize: 18
  };
}

function createSlotRegions(slots: SlotDefinition[], profile: SlotRegionProfile): JsonObject[] {
  const leadSlots = new Set(["eyebrow", "title", "summary", "quote", "media"]);
  if (profile.layoutKind === "centered-title") {
    return slots.map((slot: SlotDefinition, index: number) => ({
      align: "center",
      area: slot.id === "title" ? "lead" : "support",
      column: 2,
      columnSpan: 10,
      id: `${slot.id}-region`,
      row: index + 3,
      rowSpan: slot.id === "title" ? 2 : 1,
      slot: slot.id,
      spacing: "normal"
    }));
  }

  if (profile.layoutKind === "media-lead") {
    return slots.map((slot: SlotDefinition, index: number) => ({
      align: slot.id === "media" ? "stretch" : "start",
      area: slot.id === "media" ? "media" : slot.id === "caption" ? "footer" : "header",
      column: slot.id === "media" ? 1 : 2,
      columnSpan: slot.id === "media" ? 12 : 10,
      id: `${slot.id}-region`,
      row: slot.id === "media" ? 2 : index + 1,
      rowSpan: slot.id === "media" ? 5 : 1,
      slot: slot.id,
      spacing: slot.id === "caption" ? "tight" : "normal"
    }));
  }

  if (profile.layoutKind === "lead-sidebar") {
    return slots.map((slot: SlotDefinition, index: number) => {
      const isLead = leadSlots.has(slot.id);
      return {
        align: "stretch",
        area: isLead ? "lead" : "sidebar",
        column: isLead ? 1 : 8,
        columnSpan: isLead ? 7 : 5,
        id: `${slot.id}-region`,
        row: isLead ? index + 1 : Math.max(2, index),
        rowSpan: slot.id === "title" || slot.id === "quote" ? 2 : 1,
        slot: slot.id,
        spacing: isLead ? "normal" : "tight"
      };
    });
  }

  if (profile.layoutKind === "stacked-sequence") {
    return slots.map((slot: SlotDefinition, index: number) => ({
      align: "stretch",
      area: index < 2 ? "header" : "body",
      column: 1,
      columnSpan: 12,
      id: `${slot.id}-region`,
      row: index + 1,
      rowSpan: slot.id === "title" || slot.id === "quote" ? 2 : 1,
      slot: slot.id,
      spacing: index < 2 ? "normal" : "tight"
    }));
  }

  return slots.map((slot: SlotDefinition, index: number) => {
    const isLead = leadSlots.has(slot.id) || index < 2;
    return {
      align: "stretch",
      area: isLead ? "lead" : "support",
      column: isLead ? 1 : 7,
      columnSpan: isLead ? 6 : 6,
      id: `${slot.id}-region`,
      row: isLead ? index + 1 : Math.max(2, index),
      rowSpan: slot.id === "title" || slot.id === "quote" ? 2 : 1,
      slot: slot.id,
      spacing: isLead ? "normal" : "tight"
    };
  });
}

function typographyRoleForSlot(slot: SlotDefinition): string {
  if (slot.role === "title") {
    return "title";
  }
  if (slot.role === "quote") {
    return "quote";
  }
  if (slot.role === "caption" || slot.role === "source" || slot.role === "eyebrow") {
    return "caption";
  }
  if (slot.role === "signals" || slot.role === "guardrails") {
    return "metric";
  }
  return "body";
}

function getLayoutDefinitionSlots(definition: unknown): string[] {
  const source = asJsonObject(definition);
  return Array.isArray(source.slots)
    ? source.slots.map((slot: unknown) => normalizeSentence(asJsonObject(slot).id)).filter(Boolean)
    : [];
}

export function validateCustomLayoutDefinitionForSlide(slideSpec: SlideSpec, definition: unknown): JsonObject {
  if (!slideSpec || !["content", "cover"].includes(String(slideSpec.type))) {
    throw new Error("Custom layout authoring currently supports content and cover slides");
  }

  const normalized = asJsonObject(normalizeLayoutDefinition(definition, [String(slideSpec.type)]));
  if (normalized.type !== "slotRegionLayout") {
    throw new Error("Custom layout authoring currently supports slotRegionLayout definitions");
  }

  const slotIds = new Set(getLayoutDefinitionSlots(normalized));
  const requiredSlots = slideSpec.type === "cover"
    ? ["title", "summary", "note", "cards"]
    : ["title", "summary", "signals", "guardrails"];
  requiredSlots.forEach((slotId) => {
    if (!slotIds.has(slotId)) {
      throw new Error(`Custom ${slideSpec.type} layouts must include a ${slotId} slot`);
    }
  });

  return normalized;
}

function createPhotoGridLayoutDefinition(currentSpec: SlideSpec, slideSpec: SlideSpec): JsonObject | undefined {
  if (!currentSpec || currentSpec.type !== "photoGrid" || !slideSpec || slideSpec.type !== "photoGrid") {
    return undefined;
  }

  const mediaItems = Array.isArray(currentSpec.mediaItems) ? currentSpec.mediaItems : [];
  const fullOrder = mediaItems.map((_item: unknown, index: number) => index).slice(0, 3);

  if (slideSpec.layout === "standard") {
    return {
      arrangement: "comparison",
      captionRole: "comparison",
      mediaOrder: rotateItems(fullOrder, 1),
      type: "photoGridArrangement"
    };
  }

  if (slideSpec.layout === "strip") {
    return {
      arrangement: "evidence",
      captionRole: "evidence",
      mediaOrder: rotateItems(fullOrder, mediaItems.length > 2 ? 2 : 1),
      type: "photoGridArrangement"
    };
  }

  return {
    arrangement: "lead-image",
    captionRole: "context",
    mediaOrder: fullOrder,
    type: "photoGridArrangement"
  };
}
