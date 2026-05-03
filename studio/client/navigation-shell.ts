import { StudioClientDrawers } from "./drawers.ts";
import { listDrawerShortcutOrder, listMobileDrawerTools } from "./drawer-tool-model.ts";
import type { StudioClientElements } from "./elements.ts";

export namespace StudioClientNavigationShell {
  type ApiExplorerState = {
    resource?: unknown;
    url?: string;
  };

  type CustomLayoutWorkbench = {
    isSupported: () => boolean;
    renderEditor: () => void;
    renderLayoutStudio: () => void;
  };

  type OpenApiExplorerOptions = {
    pushHistory?: boolean;
  };

  type Preferences = {
    loadCurrentPage: () => "presentations" | "studio";
    loadDrawerOpen: (key: "assistant" | "context" | "structuredDraft") => boolean;
    persistCurrentPage: (page: "presentations" | "studio") => void;
    persistDrawerOpen: (key: "assistant" | "context" | "structuredDraft", open: boolean) => void;
  };
  type CurrentPage = ReturnType<Preferences["loadCurrentPage"]>;

  type NavigationUiState = Record<string, boolean | number | string | null | Record<string, boolean>> & {
    assistantOpen: boolean;
    checksOpen: boolean;
    contextDrawerOpen: boolean;
    currentPage: CurrentPage;
    customLayoutDefinitionPreviewActive: boolean;
    customLayoutMainPreviewActive: boolean;
    debugDrawerOpen: boolean;
    layoutDrawerOpen: boolean;
    llmPopoverOpen: boolean;
    mobileToolsOpen: boolean;
    outlineDrawerOpen: boolean;
    structuredDraftOpen: boolean;
    themeDrawerOpen: boolean;
  };

  type NavigationState = {
    ui: NavigationUiState;
  };

  type NavigationShellDependencies = {
    customLayoutWorkbench: CustomLayoutWorkbench;
    documentRef: Document;
    elements: StudioClientElements.Elements;
    getApiExplorerState: () => ApiExplorerState;
    openApiExplorerResource: (href: string, options?: OpenApiExplorerOptions) => Promise<unknown>;
    preferences: Preferences;
    renderCreationThemeStage: () => void;
    renderPreviews: () => void;
    setLlmPopoverOpen: (open: boolean) => void;
    state: NavigationState;
    toggleLlmPopover: () => void;
    windowRef: Window;
  };

  export function createNavigationShell(dependencies: NavigationShellDependencies) {
    const {
      customLayoutWorkbench,
      documentRef,
      elements,
      getApiExplorerState,
      openApiExplorerResource,
      preferences,
      renderCreationThemeStage,
      renderPreviews,
      setLlmPopoverOpen,
      state,
      toggleLlmPopover,
      windowRef
    } = dependencies;

    function persistAssistantDrawerPreference() {
      preferences.persistDrawerOpen("assistant", state.ui.assistantOpen);
    }

    function persistStructuredDraftDrawerPreference() {
      preferences.persistDrawerOpen("structuredDraft", state.ui.structuredDraftOpen);
    }

    function persistContextDrawerPreference() {
      preferences.persistDrawerOpen("context", state.ui.contextDrawerOpen);
    }

    const drawerConfigs = {
      assistant: {
        bodyClass: "assistant-open",
        drawer: () => elements.assistantDrawer,
        closedLabel: "Open workflow assistant",
        hideWhenUnavailable: true,
        openLabel: "Close workflow assistant",
        persist: persistAssistantDrawerPreference,
        stateKey: "assistantOpen",
        toggle: () => elements.assistantToggle
      },
      context: {
        bodyClass: "context-drawer-open",
        drawer: () => elements.contextDrawer,
        closedLabel: "Open slide context",
        openLabel: "Close slide context",
        persist: persistContextDrawerPreference,
        stateKey: "contextDrawerOpen",
        toggle: () => elements.contextDrawerToggle
      },
      debug: {
        bodyClass: "debug-drawer-open",
        drawer: () => elements.debugDrawer,
        closedLabel: "Open generation diagnostics",
        onOpen: () => {
          if (!getApiExplorerState().resource) {
            openApiExplorerResource(getApiExplorerState().url || "/api/v1", { pushHistory: false }).catch((error: unknown) => {
              elements.apiExplorerStatus.textContent = error instanceof Error ? error.message : String(error);
            });
          }
        },
        openLabel: "Close generation diagnostics",
        stateKey: "debugDrawerOpen",
        toggle: () => elements.debugDrawerToggle
      },
      layout: {
        afterRender: customLayoutWorkbench.renderEditor,
        afterSet: renderPreviews,
        bodyClass: "layout-drawer-open",
        drawer: () => elements.layoutDrawer,
        closedLabel: "Open layout controls",
        onBeforeSet: () => {
          state.ui.customLayoutDefinitionPreviewActive = false;
          state.ui.customLayoutMainPreviewActive = false;
        },
        onOpen: () => {
          elements.customLayoutStatus.textContent = customLayoutWorkbench.isSupported() ? "Draft" : "Content and cover slides only";
        },
        openLabel: "Close layout controls",
        stateKey: "layoutDrawerOpen",
        toggle: () => elements.layoutDrawerToggle
      },
      outline: {
        bodyClass: "outline-drawer-open",
        drawer: () => elements.outlineDrawer,
        closedLabel: "Open outline planning",
        openLabel: "Close outline planning",
        stateKey: "outlineDrawerOpen",
        toggle: () => elements.outlineDrawerToggle
      },
      structuredDraft: {
        bodyClass: "structured-draft-open",
        drawer: () => elements.structuredDraftDrawer,
        closedLabel: "Open structured draft editor",
        openLabel: "Close structured draft editor",
        persist: persistStructuredDraftDrawerPreference,
        stateKey: "structuredDraftOpen",
        toggle: () => elements.structuredDraftToggle
      },
      theme: {
        afterRender: renderCreationThemeStage,
        bodyClass: "theme-drawer-open",
        drawer: () => elements.themeDrawer,
        closedLabel: "Open theme control",
        hideWhenUnavailable: true,
        openLabel: "Close theme control",
        stateKey: "themeDrawerOpen",
        toggle: () => elements.themeDrawerToggle
      }
    } satisfies Record<string, StudioClientDrawers.DrawerConfig>;
    const drawerOrder = ["assistant", "outline", "context", "debug", "layout", "structuredDraft", "theme"];
    const drawerShortcutOrder = listDrawerShortcutOrder();
    const mobileToolOrder = listMobileDrawerTools().map((tool) => tool.key);
    const drawerController = StudioClientDrawers.createDrawerController({
      configs: drawerConfigs,
      documentBody: documentRef.body,
      isAvailable: () => state.ui.currentPage === "studio",
      order: drawerOrder,
      state
    });

    function loadCurrentPagePreference() {
      return preferences.loadCurrentPage();
    }

    function persistCurrentPagePreference() {
      preferences.persistCurrentPage(state.ui.currentPage);
    }

    function initializeState() {
      state.ui.currentPage = loadCurrentPagePreference();
      if (windowRef.location.hash.replace(/^#/, "") === "layout-studio") {
        state.ui.currentPage = "studio";
        state.ui.layoutDrawerOpen = true;
      }
      if (windowRef.location.hash.replace(/^#/, "") === "planning") {
        state.ui.currentPage = "studio";
        state.ui.outlineDrawerOpen = true;
        const url = new URL(windowRef.location.href);
        url.hash = "#studio";
        windowRef.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      state.ui.checksOpen = windowRef.location.hash.replace(/^#/, "") === "validation";
      state.ui.assistantOpen = preferences.loadDrawerOpen("assistant");
      state.ui.contextDrawerOpen = preferences.loadDrawerOpen("context");
      state.ui.structuredDraftOpen = preferences.loadDrawerOpen("structuredDraft");
      if (state.ui.contextDrawerOpen && state.ui.structuredDraftOpen) {
        state.ui.structuredDraftOpen = false;
      }
    }

    function renderPages() {
      const current = state.ui.currentPage;
      elements.presentationsPage.hidden = current !== "presentations";
      elements.studioPage.hidden = current !== "studio";
      elements.validationPage.hidden = !state.ui.checksOpen;
      elements.selectedSlideLabel.hidden = current !== "studio";
      elements.openPresentationModeButton.hidden = current !== "studio";
      elements.contextDrawer.hidden = current !== "studio";
      elements.outlineDrawer.hidden = current !== "studio";
      elements.debugDrawer.hidden = current !== "studio";
      elements.layoutDrawer.hidden = current !== "studio";
      elements.structuredDraftDrawer.hidden = current !== "studio";
      elements.themeDrawer.hidden = current !== "studio";
      elements.showPresentationsPageButton.classList.toggle("active", current === "presentations");
      elements.showStudioPageButton.classList.toggle("active", current === "studio");
      elements.showValidationPageButton.classList.toggle("active", state.ui.checksOpen);
      elements.showPresentationsPageButton.setAttribute("aria-pressed", current === "presentations" ? "true" : "false");
      elements.showStudioPageButton.setAttribute("aria-pressed", current === "studio" ? "true" : "false");
      elements.showValidationPageButton.setAttribute("aria-expanded", state.ui.checksOpen ? "true" : "false");
      renderAllDrawers();
      customLayoutWorkbench.renderLayoutStudio();
    }

    function setCurrentPage(page: string): void {
      state.ui.currentPage = page === "presentations" ? page : "studio";
      if (page === "layout-studio") {
        state.ui.layoutDrawerOpen = true;
      }
      if (page === "planning") {
        state.ui.outlineDrawerOpen = true;
      }
      const nextHash = `#${state.ui.currentPage}`;
      if (windowRef.location.hash !== nextHash) {
        const url = new URL(windowRef.location.href);
        url.hash = nextHash;
        windowRef.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      persistCurrentPagePreference();
      renderPages();
    }

    function setChecksPanelOpen(open: boolean): void {
      state.ui.checksOpen = Boolean(open);
      renderPages();
    }

    function renderAllDrawers() {
      drawerController.renderAll();
      renderMobileTools();
    }

    function setAssistantDrawerOpen(open: boolean): void {
      drawerController.setOpen("assistant", open);
    }

    function setStructuredDraftDrawerOpen(open: boolean): void {
      drawerController.setOpen("structuredDraft", open);
    }

    function setContextDrawerOpen(open: boolean): void {
      drawerController.setOpen("context", open);
    }

    function setDebugDrawerOpen(open: boolean): void {
      drawerController.setOpen("debug", open);
    }

    function setLayoutDrawerOpen(open: boolean): void {
      drawerController.setOpen("layout", open);
    }

    function setOutlineDrawerOpen(open: boolean): void {
      drawerController.setOpen("outline", open);
    }

    function renderThemeDrawer() {
      drawerController.render("theme");
    }

    function setThemeDrawerOpen(open: boolean): void {
      drawerController.setOpen("theme", open);
    }

    function setDrawerOpenByKey(key: string, open: boolean): void {
      if (key === "assistant") {
        setAssistantDrawerOpen(open);
      }
      if (key === "context") {
        setContextDrawerOpen(open);
      }
      if (key === "debug") {
        setDebugDrawerOpen(open);
      }
      if (key === "layout") {
        setLayoutDrawerOpen(open);
      }
      if (key === "outline") {
        setOutlineDrawerOpen(open);
      }
      if (key === "structuredDraft") {
        setStructuredDraftDrawerOpen(open);
      }
      if (key === "theme") {
        setThemeDrawerOpen(open);
      }
    }

    function getOpenDrawerKey(): string {
      return mobileToolOrder.find((key) => Boolean(state.ui[drawerConfigs[key].stateKey])) || "";
    }

    function setMobileToolsOpen(open: boolean): void {
      state.ui.mobileToolsOpen = state.ui.currentPage === "studio" && Boolean(open);
      renderMobileTools();
    }

    function renderMobileTools(): void {
      const shell = documentRef.getElementById("mobile-tools") as HTMLElement | null;
      const toggle = documentRef.getElementById("mobile-tools-toggle") as HTMLButtonElement | null;
      const panel = documentRef.getElementById("mobile-tools-panel") as HTMLElement | null;
      if (!shell || !toggle || !panel) {
        return;
      }

      const available = state.ui.currentPage === "studio";
      const open = available && state.ui.mobileToolsOpen;
      const openDrawerKey = getOpenDrawerKey();
      shell.hidden = !available;
      shell.dataset.open = open ? "true" : "false";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close Studio tools" : "Open Studio tools");
      panel.hidden = !open;
      panel.querySelectorAll<HTMLButtonElement>("[data-mobile-drawer-tool]").forEach((button) => {
        const toolKey = button.dataset.mobileDrawerTool || "";
        const active = toolKey === openDrawerKey;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setOutlineMode(mode: string): void {
      const panelSelector = "[data-outline-mode-panel]";
      const tabSelector = "[data-outline-mode]";
      const panels = Array.from(documentRef.querySelectorAll<HTMLElement>(panelSelector));
      const tabs = Array.from(documentRef.querySelectorAll<HTMLButtonElement>(tabSelector));
      const availableModes = panels.map((panel) => panel.dataset.outlineModePanel || "");
      const activeMode = availableModes.includes(mode) ? mode : "brief";

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.outlineModePanel !== activeMode;
      });
      tabs.forEach((tab) => {
        const active = tab.dataset.outlineMode === activeMode;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    function isEditableShortcutTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tagName = target.tagName.toLowerCase();
      return target.isContentEditable || tagName === "input" || tagName === "select" || tagName === "textarea";
    }

    function handleDrawerShortcut(event: KeyboardEvent): boolean {
      if (state.ui.currentPage !== "studio" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return false;
      }
      if (isEditableShortcutTarget(event.target)) {
        return false;
      }

      const shortcutIndex = Number(event.key) - 1;
      const drawerKey = Number.isInteger(shortcutIndex) ? drawerShortcutOrder[shortcutIndex] : undefined;
      if (!drawerKey) {
        return false;
      }

      const config = drawerConfigs[drawerKey];
      event.preventDefault();
      drawerController.setOpen(drawerKey, !state.ui[config.stateKey]);
      return true;
    }

    function mount() {
      elements.layoutDrawerToggle.addEventListener("click", () => setLayoutDrawerOpen(!state.ui.layoutDrawerOpen));
      elements.outlineDrawerToggle.addEventListener("click", () => setOutlineDrawerOpen(!state.ui.outlineDrawerOpen));
      elements.assistantToggle.addEventListener("click", () => {
        setAssistantDrawerOpen(!state.ui.assistantOpen);
      });
      elements.showPresentationsPageButton.addEventListener("click", () => setCurrentPage("presentations"));
      elements.showStudioPageButton.addEventListener("click", () => setCurrentPage("studio"));
      elements.showLlmDiagnosticsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleLlmPopover();
      });
      elements.llmPopover.addEventListener("click", (event) => event.stopPropagation());
      elements.showValidationPageButton.addEventListener("click", () => setChecksPanelOpen(!state.ui.checksOpen));
      elements.closeValidationPageButton.addEventListener("click", () => setChecksPanelOpen(false));
      elements.contextDrawerToggle.addEventListener("click", () => {
        setContextDrawerOpen(!state.ui.contextDrawerOpen);
      });
      elements.debugDrawerToggle.addEventListener("click", () => {
        setDebugDrawerOpen(!state.ui.debugDrawerOpen);
      });
      elements.structuredDraftToggle.addEventListener("click", () => {
        setStructuredDraftDrawerOpen(!state.ui.structuredDraftOpen);
      });
      const mobileToolsToggle = documentRef.getElementById("mobile-tools-toggle");
      mobileToolsToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        setMobileToolsOpen(!state.ui.mobileToolsOpen);
      });
      documentRef.querySelectorAll<HTMLButtonElement>("[data-mobile-drawer-tool]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const drawerKey = button.dataset.mobileDrawerTool || "";
          setDrawerOpenByKey(drawerKey, getOpenDrawerKey() !== drawerKey);
          setMobileToolsOpen(false);
        });
      });
      documentRef.querySelectorAll<HTMLButtonElement>("[data-outline-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          setOutlineMode(button.dataset.outlineMode || "brief");
        });
      });
      setOutlineMode("brief");
    }

    function mountGlobalEvents() {
      documentRef.addEventListener("keydown", (event) => {
        if (handleDrawerShortcut(event)) {
          return;
        }
        if (event.key === "Escape") {
          if (state.ui.llmPopoverOpen) {
            setLlmPopoverOpen(false);
          }
          if (state.ui.checksOpen) {
            setChecksPanelOpen(false);
          }
          if (state.ui.mobileToolsOpen) {
            setMobileToolsOpen(false);
          }
          if (state.ui.assistantOpen) {
            setAssistantDrawerOpen(false);
          }
          if (state.ui.themeDrawerOpen) {
            setThemeDrawerOpen(false);
          }
          if (state.ui.contextDrawerOpen) {
            setContextDrawerOpen(false);
          }
          if (state.ui.outlineDrawerOpen) {
            setOutlineDrawerOpen(false);
          }
          if (state.ui.debugDrawerOpen) {
            setDebugDrawerOpen(false);
          }
          if (state.ui.structuredDraftOpen) {
            setStructuredDraftDrawerOpen(false);
          }
        }
      });

      documentRef.addEventListener("click", () => {
        if (state.ui.llmPopoverOpen) {
          setLlmPopoverOpen(false);
        }
        if (state.ui.mobileToolsOpen) {
          setMobileToolsOpen(false);
        }
      });

      windowRef.addEventListener("hashchange", () => {
        const page = windowRef.location.hash.replace(/^#/, "");
        if (page === "validation") {
          setCurrentPage("studio");
          setChecksPanelOpen(true);
          return;
        }

        setCurrentPage(page === "planning" || page === "presentations" || page === "layout-studio" ? page : "studio");
      });
    }

    return {
      initializeState,
      mount,
      mountGlobalEvents,
      renderAllDrawers,
      renderPages,
      renderThemeDrawer,
      setAssistantDrawerOpen,
      setChecksPanelOpen,
      setContextDrawerOpen,
      setDebugDrawerOpen,
      setLayoutDrawerOpen,
      setStructuredDraftDrawerOpen,
      setThemeDrawerOpen,
      setCurrentPage
    };
  }
}
