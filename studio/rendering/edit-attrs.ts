import { escapeHtml } from "./escape.ts";

export function editAttrs(path: string, label?: string): string {
  return ` data-edit-path="${escapeHtml(path)}" data-edit-label="${escapeHtml(label || path)}"`;
}
