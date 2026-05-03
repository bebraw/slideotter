import { escapeHtml, isRecord } from "./html.ts";
import { type SlideSpec, type SlotRegion, type SlotRegionLayoutDefinition } from "./slide-data.ts";

function normalizeGridNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

export function getSlotRegionLayoutDefinition(slideSpec: SlideSpec): SlotRegionLayoutDefinition | null {
  const definition = isRecord(slideSpec.layoutDefinition)
    ? slideSpec.layoutDefinition
    : null;
  if (!definition || definition.type !== "slotRegionLayout" || !Array.isArray(definition.regions)) {
    return null;
  }
  return {
    ...definition,
    regions: definition.regions.filter(isRecord),
    type: "slotRegionLayout"
  };
}

function renderSlotRegionStyle(region: SlotRegion, definition: SlotRegionLayoutDefinition): string {
  const minFontSize = definition && definition.constraints
    ? normalizeGridNumber(definition.constraints.minFontSize, 18, 12, 44)
    : 18;
  const column = normalizeGridNumber(region && region.column, 1, 1, 12);
  const columnSpan = normalizeGridNumber(region && region.columnSpan, 4, 1, 12);
  const row = normalizeGridNumber(region && region.row, 1, 1, 8);
  const rowSpan = normalizeGridNumber(region && region.rowSpan, 2, 1, 8);

  return [
    `grid-column:${column} / span ${columnSpan}`,
    `grid-row:${row} / span ${rowSpan}`,
    `--dom-custom-min-font:${minFontSize}px`
  ].join(";");
}

export function renderSlotRegion(region: SlotRegion, definition: SlotRegionLayoutDefinition, body: string): string {
  if (!body) {
    return "";
  }

  const slot = region && region.slot ? String(region.slot) : "";
  const spacing = region && region.spacing
    ? String(region.spacing).replace(/[^a-z0-9-]/gi, "")
    : "normal";

  return `
    <section class="dom-slide__custom-layout-region dom-slide__custom-layout-region--${escapeHtml(slot || "slot")} dom-slide__custom-layout-region--${escapeHtml(spacing)}" style="${escapeHtml(renderSlotRegionStyle(region, definition))}">
      ${body}
    </section>
  `;
}
