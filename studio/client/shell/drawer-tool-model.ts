export type DrawerToolKey = "outline" | "context" | "layout" | "debug" | "structuredDraft" | "theme" | "assistant";

export type DrawerTool = {
  key: DrawerToolKey;
  label: string;
  shortcut: string;
};

const drawerTools: DrawerTool[] = [
  { key: "outline", label: "Outline", shortcut: "1" },
  { key: "context", label: "Context", shortcut: "2" },
  { key: "layout", label: "Layout", shortcut: "3" },
  { key: "debug", label: "Diagnostics", shortcut: "4" },
  { key: "structuredDraft", label: "Structured Draft", shortcut: "5" },
  { key: "theme", label: "Theme", shortcut: "6" },
  { key: "assistant", label: "Assistant", shortcut: "7" }
];

export function listDrawerTools(): DrawerTool[] {
  return drawerTools.map((tool) => ({ ...tool }));
}

export function listDrawerShortcutOrder(): DrawerToolKey[] {
  return drawerTools.map((tool) => tool.key);
}

export function listMobileDrawerTools(): DrawerTool[] {
  return listDrawerTools();
}
