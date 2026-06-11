export type DrawerToolKey = "outline" | "memory" | "context" | "layout" | "debug" | "structuredDraft" | "theme" | "assistant";
export type DrawerRail = "left" | "right";
export type DrawerStateKey =
  | "assistantOpen"
  | "contextDrawerOpen"
  | "debugDrawerOpen"
  | "layoutDrawerOpen"
  | "memoryDrawerOpen"
  | "outlineDrawerOpen"
  | "structuredDraftOpen"
  | "themeDrawerOpen";

export type DrawerTool = {
  bodyClass: string;
  drawerSelector: string;
  key: DrawerToolKey;
  label: string;
  mobileLabel: string;
  rail: DrawerRail;
  shortcut: string;
  stateKey: DrawerStateKey;
  toggleSelector: string;
};

const drawerTools: DrawerTool[] = [
  {
    bodyClass: "outline-drawer-open",
    drawerSelector: "#outline-drawer",
    key: "outline",
    label: "Outline",
    mobileLabel: "Outline",
    rail: "left",
    shortcut: "1",
    stateKey: "outlineDrawerOpen",
    toggleSelector: "#outline-drawer-toggle"
  },
  {
    bodyClass: "memory-drawer-open",
    drawerSelector: "#memory-drawer",
    key: "memory",
    label: "Memory",
    mobileLabel: "Memory",
    rail: "right",
    shortcut: "2",
    stateKey: "memoryDrawerOpen",
    toggleSelector: "#memory-drawer-toggle"
  },
  {
    bodyClass: "context-drawer-open",
    drawerSelector: "#context-drawer",
    key: "context",
    label: "Context",
    mobileLabel: "Context",
    rail: "right",
    shortcut: "3",
    stateKey: "contextDrawerOpen",
    toggleSelector: "#context-drawer-toggle"
  },
  {
    bodyClass: "layout-drawer-open",
    drawerSelector: "#layout-drawer",
    key: "layout",
    label: "Layout",
    mobileLabel: "Layout",
    rail: "right",
    shortcut: "4",
    stateKey: "layoutDrawerOpen",
    toggleSelector: "#layout-drawer-toggle"
  },
  {
    bodyClass: "debug-drawer-open",
    drawerSelector: "#debug-drawer",
    key: "debug",
    label: "Diagnostics",
    mobileLabel: "Diagnostics",
    rail: "right",
    shortcut: "5",
    stateKey: "debugDrawerOpen",
    toggleSelector: "#debug-drawer-toggle"
  },
  {
    bodyClass: "structured-draft-open",
    drawerSelector: "#structured-draft-drawer",
    key: "structuredDraft",
    label: "Structured Draft",
    mobileLabel: "Spec",
    rail: "right",
    shortcut: "6",
    stateKey: "structuredDraftOpen",
    toggleSelector: "#structured-draft-toggle"
  },
  {
    bodyClass: "theme-drawer-open",
    drawerSelector: "#theme-drawer",
    key: "theme",
    label: "Theme",
    mobileLabel: "Theme",
    rail: "right",
    shortcut: "7",
    stateKey: "themeDrawerOpen",
    toggleSelector: "#theme-drawer-toggle"
  },
  {
    bodyClass: "assistant-open",
    drawerSelector: "#assistant-drawer",
    key: "assistant",
    label: "Assistant",
    mobileLabel: "Assistant",
    rail: "right",
    shortcut: "8",
    stateKey: "assistantOpen",
    toggleSelector: "#assistant-toggle"
  }
];

export function listDrawerTools(): DrawerTool[] {
  return drawerTools.map((tool) => ({ ...tool }));
}

export function requireDrawerTool(key: DrawerToolKey): DrawerTool {
  const tool = drawerTools.find((candidate) => candidate.key === key);
  if (!tool) {
    throw new Error(`Unknown drawer tool: ${key}`);
  }
  return { ...tool };
}

export function listDrawerBodyClasses(): string[] {
  return drawerTools.map((tool) => tool.bodyClass);
}

export function listDrawerShortcutOrder(): DrawerToolKey[] {
  return drawerTools.map((tool) => tool.key);
}

export function listDrawerSelectors(): string[] {
  return drawerTools.map((tool) => tool.drawerSelector);
}

export function listMobileDrawerTools(): DrawerTool[] {
  return listDrawerTools();
}

export function listRightRailDrawerTools(): DrawerTool[] {
  return drawerTools.filter((tool) => tool.rail === "right").map((tool) => ({ ...tool }));
}
