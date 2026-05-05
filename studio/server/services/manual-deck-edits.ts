import { getMaterial } from "./materials.ts";

type JsonObject = Record<string, unknown>;

type SlideSpecPayload = JsonObject & {
  caption?: unknown;
  index?: unknown;
  media?: JsonObject;
  mediaItems?: JsonObject[];
  type?: unknown;
};

type MaterialPayload = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  id?: unknown;
  title?: unknown;
  url?: unknown;
};

type ManualSlideInput = {
  targetIndex: number;
  title: unknown;
};

type ManualSystemSlideInput = ManualSlideInput & {
  summary: unknown;
};

type ManualQuoteSlideInput = ManualSlideInput & {
  quote: unknown;
};

type ManualPhotoSlideInput = ManualSlideInput & {
  caption: unknown;
  materialId: unknown;
};

type ManualPhotoGridSlideInput = ManualSlideInput & {
  caption: unknown;
  materialIds: unknown;
};

function sentenceValue(value: unknown, fallback: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function slugPart(value: unknown, fallback = "system"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return slug || fallback;
}

export function renumberOutlineWithInsert(outline: unknown, title: string, targetIndex: number): string {
  const lines = String(outline || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const cleanTitle = sentenceValue(title, "New slide");
  lines.splice(Math.max(0, targetIndex - 1), 0, cleanTitle);
  return lines.map((line, index) => {
    const text = line.replace(/^\d+[\.)]\s*/, "").trim();
    return `${index + 1}. ${text}`;
  }).join("\n");
}

export function renumberOutlineWithoutIndex(outline: unknown, targetIndex: number): string {
  const lines = String(outline || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  lines.splice(Math.max(0, targetIndex - 1), 1);
  return lines.map((line, index) => {
    const text = line.replace(/^\d+[\.)]\s*/, "").trim();
    return `${index + 1}. ${text}`;
  }).join("\n");
}

export function createManualSystemSlideSpec({ summary, targetIndex, title }: ManualSystemSlideInput): SlideSpecPayload {
  const safeTitle = sentenceValue(title, "New system");
  const safeSummary = sentenceValue(summary, "Explain the system boundary and the signal to watch.");
  const slug = slugPart(safeTitle);

  return {
    type: "content",
    index: targetIndex,
    title: safeTitle,
    eyebrow: "System",
    summary: safeSummary,
    signalsTitle: "Signals",
    guardrailsTitle: "Guardrails",
    signals: [
      { id: `${slug}-signal-1`, title: "Boundary", body: safeSummary },
      { id: `${slug}-signal-2`, title: "Signal", body: "Name the evidence that shows the workflow is working." },
      { id: `${slug}-signal-3`, title: "Owner", body: "Name the person or role that keeps this system healthy." }
    ],
    guardrails: [
      { id: `${slug}-guardrail-1`, title: "Scope", body: "Keep the change inside the deck workflow boundary." },
      { id: `${slug}-guardrail-2`, title: "Check", body: "Validate rendered output after the edit." },
      { id: `${slug}-guardrail-3`, title: "Handoff", body: "Leave the next action explicit." }
    ]
  };
}

export function createManualDividerSlideSpec({ targetIndex, title }: ManualSlideInput): SlideSpecPayload {
  return {
    type: "divider",
    index: targetIndex,
    title: sentenceValue(title, "Section break")
  };
}

export function createManualQuoteSlideSpec({ quote, targetIndex, title }: ManualQuoteSlideInput): SlideSpecPayload {
  return {
    type: "quote",
    index: targetIndex,
    title: sentenceValue(title, "Pull quote"),
    quote: sentenceValue(quote, "Add a sourced quote or authored pull quote here.")
  };
}

function materialToSlideMedia(material: MaterialPayload, captionOverride = ""): JsonObject {
  const safeCaption = String(captionOverride || material.caption || "").replace(/\s+/g, " ").trim();
  return {
    alt: String(material.alt || material.title).replace(/\s+/g, " ").trim() || material.title,
    id: material.id,
    src: material.url,
    title: material.title,
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

export function createManualPhotoSlideSpec({ caption, materialId, targetIndex, title }: ManualPhotoSlideInput): SlideSpecPayload {
  const material: MaterialPayload = getMaterial(String(materialId || ""));
  const safeCaption = String(caption || material.caption || "").replace(/\s+/g, " ").trim();
  const media = materialToSlideMedia(material, safeCaption);

  return {
    type: "photo",
    index: targetIndex,
    title: sentenceValue(title, String(material.title || "Photo")),
    media,
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}

export function createManualPhotoGridSlideSpec({ caption, materialIds, targetIndex, title }: ManualPhotoGridSlideInput): SlideSpecPayload {
  const uniqueMaterialIds = Array.from(new Set(Array.isArray(materialIds) ? materialIds : []))
    .map((id: unknown) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (uniqueMaterialIds.length < 2) {
    throw new Error("Photo grid slides need 2-3 materials");
  }

  const materials: MaterialPayload[] = uniqueMaterialIds.map((materialId: string) => getMaterial(materialId));
  const safeCaption = String(caption || "").replace(/\s+/g, " ").trim();

  return {
    type: "photoGrid",
    index: targetIndex,
    title: sentenceValue(title, "Photo grid"),
    mediaItems: materials.map((material: MaterialPayload) => materialToSlideMedia(material)),
    ...(safeCaption ? { caption: safeCaption } : {})
  };
}
