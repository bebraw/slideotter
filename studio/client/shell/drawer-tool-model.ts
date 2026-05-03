export type DrawerToolKey = "outline" | "context" | "layout" | "debug" | "structuredDraft" | "theme" | "assistant";

export type DrawerTool = {
  key: DrawerToolKey;
  label: string;
  mobileLabel: string;
  shortcut: string;
};

const drawerTools: DrawerTool[] = [
  { key: "outline", label: "Outline", mobileLabel: "Outline", shortcut: "1" },
  { key: "context", label: "Context", mobileLabel: "Context", shortcut: "2" },
  { key: "layout", label: "Layout", mobileLabel: "Layout", shortcut: "3" },
  { key: "debug", label: "Diagnostics", mobileLabel: "Diagnostics", shortcut: "4" },
  { key: "structuredDraft", label: "Structured Draft", mobileLabel: "Spec", shortcut: "5" },
  { key: "theme", label: "Theme", mobileLabel: "Theme", shortcut: "6" },
  { key: "assistant", label: "Assistant", mobileLabel: "Assistant", shortcut: "7" }
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
