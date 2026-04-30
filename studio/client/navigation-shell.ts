import { StudioClientDrawers } from "./drawers.ts";
import type { StudioClientElements } from "./elements.ts";

export namespace StudioClientNavigationShell {
  type NavigationShellDependencies = {
    customLayoutWorkbench: any;
    documentRef: Document;
    elements: StudioClientElements.Elements;
    getApiExplorerState: () => any;
    openApiExplorerResource: (href: string, options?: any) => Promise<any>;
    preferences: any;
    renderCreationThemeStage: () => void;
    renderPreviews: () => void;
    setLlmPopoverOpen: (open: boolean) => void;
    state: any;
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
            openApiExplorerResource(getApiExplorerState().url || "/api/v1", { pushHistory: false }).catch((error) => {
              elements.apiExplorerStatus.textContent = error.message;
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
    };
    const drawerOrder = ["assistant", "context", "debug", "layout", "structuredDraft", "theme"];
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
      elements.layoutStudioPage.hidden = current !== "layout-studio";
      elements.planningPage.hidden = current !== "planning";
      elements.validationPage.hidden = !state.ui.checksOpen;
      elements.selectedSlideLabel.hidden = current !== "studio";
      elements.openPresentationModeButton.hidden = current !== "studio";
      elements.contextDrawer.hidden = current !== "studio";
      elements.debugDrawer.hidden = current !== "studio";
      elements.layoutDrawer.hidden = current !== "studio";
      elements.structuredDraftDrawer.hidden = current !== "studio";
      elements.themeDrawer.hidden = current !== "studio";
      elements.showPresentationsPageButton.classList.toggle("active", current === "presentations");
      elements.showStudioPageButton.classList.toggle("active", current === "studio");
      elements.showLayoutStudioPageButton.classList.toggle("active", current === "layout-studio");
      elements.showPlanningPageButton.classList.toggle("active", current === "planning");
      elements.showValidationPageButton.classList.toggle("active", state.ui.checksOpen);
      elements.showPresentationsPageButton.setAttribute("aria-pressed", current === "presentations" ? "true" : "false");
      elements.showStudioPageButton.setAttribute("aria-pressed", current === "studio" ? "true" : "false");
      elements.showLayoutStudioPageButton.setAttribute("aria-pressed", current === "layout-studio" ? "true" : "false");
      elements.showPlanningPageButton.setAttribute("aria-pressed", current === "planning" ? "true" : "false");
      elements.showValidationPageButton.setAttribute("aria-expanded", state.ui.checksOpen ? "true" : "false");
      renderAllDrawers();
      customLayoutWorkbench.renderLayoutStudio();
    }

    function setCurrentPage(page: string): void {
      state.ui.currentPage = page === "planning" || page === "presentations" || page === "layout-studio" ? page : "studio";
      const nextHash = `#${state.ui.currentPage}`;
      if (windowRef.location.hash !== nextHash) {
        windowRef.history.replaceState(null, "", nextHash);
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

    function renderThemeDrawer() {
      drawerController.render("theme");
    }

    function setThemeDrawerOpen(open: boolean): void {
      drawerController.setOpen("theme", open);
    }

    function mount() {
      elements.layoutDrawerToggle.addEventListener("click", () => setLayoutDrawerOpen(!state.ui.layoutDrawerOpen));
      elements.assistantToggle.addEventListener("click", () => {
        setAssistantDrawerOpen(!state.ui.assistantOpen);
      });
      elements.showPresentationsPageButton.addEventListener("click", () => setCurrentPage("presentations"));
      elements.showStudioPageButton.addEventListener("click", () => setCurrentPage("studio"));
      elements.showLayoutStudioPageButton.addEventListener("click", () => setCurrentPage("layout-studio"));
      elements.showPlanningPageButton.addEventListener("click", () => setCurrentPage("planning"));
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
    }

    function mountGlobalEvents() {
      documentRef.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          if (state.ui.llmPopoverOpen) {
            setLlmPopoverOpen(false);
          }
          if (state.ui.checksOpen) {
            setChecksPanelOpen(false);
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
