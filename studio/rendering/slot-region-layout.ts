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

type NormalizedSlotRegionGrid = {
  column: number;
  columnSpan: number;
  minFontSize: number;
  row: number;
  rowSpan: number;
};

function normalizeSlotRegionGrid(region: SlotRegion, definition: SlotRegionLayoutDefinition): NormalizedSlotRegionGrid {
  const minFontSize = definition && definition.constraints
    ? normalizeGridNumber(definition.constraints.minFontSize, 18, 12, 44)
    : 18;
  const column = normalizeGridNumber(region && region.column, 1, 1, 12);
  const columnSpan = normalizeGridNumber(region && region.columnSpan, 4, 1, 12);
  const row = normalizeGridNumber(region && region.row, 1, 1, 8);
  const rowSpan = normalizeGridNumber(region && region.rowSpan, 2, 1, 8);

  return {
    column,
    columnSpan,
    minFontSize,
    row,
    rowSpan
  };
}

function renderSlotRegionStyle(grid: NormalizedSlotRegionGrid): string {
  return [
    `grid-column:${grid.column} / span ${grid.columnSpan}`,
    `grid-row:${grid.row} / span ${grid.rowSpan}`,
    `--dom-custom-min-font:${grid.minFontSize}px`
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
  const grid = normalizeSlotRegionGrid(region, definition);

  return `
    <section class="dom-slide__custom-layout-region dom-slide__custom-layout-region--${escapeHtml(slot || "slot")} dom-slide__custom-layout-region--${escapeHtml(spacing)}" data-region-column="${grid.column}" data-region-column-span="${grid.columnSpan}" data-region-row="${grid.row}" data-region-row-span="${grid.rowSpan}" style="${escapeHtml(renderSlotRegionStyle(grid))}">
      ${body}
    </section>
  `;
}
