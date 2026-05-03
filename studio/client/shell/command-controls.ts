import { StudioClientElements } from "../elements.ts";

export namespace StudioClientCommandControls {
  type AsyncAction = () => Promise<unknown>;
  type SyncAction = () => void;

  export type CommandControlDeps = {
    appTheme: {
      mount: () => void;
    };
    build: {
      validate: (includeRender: boolean) => Promise<unknown>;
    };
    commands: {
      checkLlmProvider: AsyncAction;
      closeExportMenu: SyncAction;
      exportPdf: AsyncAction;
      exportPptx: AsyncAction;
      ideateDeckStructure: AsyncAction;
      ideateSlide: AsyncAction;
      ideateStructure: AsyncAction;
      ideateTheme: AsyncAction;
      openPresentationMode: SyncAction;
      redoLayout: AsyncAction;
      renderManualSlideForm: SyncAction;
      renderPresentationLibrary: SyncAction;
      saveDeckContext: AsyncAction;
      saveSlideContext: AsyncAction;
      saveValidationSettings: AsyncAction;
      toggleExportMenu: SyncAction;
    };
    elements: StudioClientElements.Elements;
    navigationShell: {
      mount: () => void;
    };
    presentationCreationWorkbench: {
      mountCommandControls: () => void;
    };
    runtimeStatusWorkbench: {
      mountLlmModelControls: () => void;
    };
    slideEditorWorkbench: {
      mount: () => void;
    };
    variantReview: {
      ensureWorkbench: AsyncAction;
      isLoaded: () => boolean;
    };
    windowRef: Window;
  };

  function alertError(windowRef: Window, error: unknown): void {
    windowRef.alert(error instanceof Error ? error.message : String(error));
  }

  export function mountCommandControls(deps: CommandControlDeps): void {
    const {
      appTheme,
      build,
      commands,
      elements,
      navigationShell,
      presentationCreationWorkbench,
      runtimeStatusWorkbench,
      slideEditorWorkbench,
      variantReview,
      windowRef
    } = deps;

    elements.checkLlmButton.addEventListener("click", () => commands.checkLlmProvider().catch((error) => alertError(windowRef, error)));
    runtimeStatusWorkbench.mountLlmModelControls();
    elements.ideateSlideButton.addEventListener("click", () => commands.ideateSlide().catch((error) => alertError(windowRef, error)));
    elements.ideateStructureButton.addEventListener("click", () => commands.ideateStructure().catch((error) => alertError(windowRef, error)));
    elements.ideateThemeButton.addEventListener("click", () => commands.ideateTheme().catch((error) => alertError(windowRef, error)));
    elements.ideateDeckStructureButton.addEventListener("click", () => commands.ideateDeckStructure().catch((error) => alertError(windowRef, error)));
    elements.redoLayoutButton.addEventListener("click", () => commands.redoLayout().catch((error) => alertError(windowRef, error)));
    elements.captureVariantButton.addEventListener("click", () => {
      if (variantReview.isLoaded()) {
        return;
      }
      variantReview.ensureWorkbench()
        .then(() => elements.captureVariantButton.click())
        .catch((error) => alertError(windowRef, error));
    });
    slideEditorWorkbench.mount();
    elements.validateButton.addEventListener("click", () => build.validate(false).catch((error) => alertError(windowRef, error)));
    elements.validateRenderButton.addEventListener("click", () => build.validate(true).catch((error) => alertError(windowRef, error)));
    elements.exportMenuButton.addEventListener("click", () => commands.toggleExportMenu());
    elements.exportPdfButton.addEventListener("click", () => {
      commands.closeExportMenu();
      commands.exportPdf().catch((error) => alertError(windowRef, error));
    });
    elements.exportPptxButton.addEventListener("click", () => {
      commands.closeExportMenu();
      commands.exportPptx().catch((error) => alertError(windowRef, error));
    });
    appTheme.mount();
    navigationShell.mount();
    elements.saveDeckContextButton.addEventListener("click", () => commands.saveDeckContext().catch((error) => alertError(windowRef, error)));
    elements.saveValidationSettingsButton.addEventListener("click", () => commands.saveValidationSettings().catch((error) => alertError(windowRef, error)));
    elements.saveSlideContextButton.addEventListener("click", () => commands.saveSlideContext().catch((error) => alertError(windowRef, error)));
    presentationCreationWorkbench.mountCommandControls();
    elements.openPresentationModeButton.addEventListener("click", commands.openPresentationMode);
    if (elements.manualSystemType) {
      elements.manualSystemType.addEventListener("change", commands.renderManualSlideForm);
    }
    elements.presentationSearch.addEventListener("input", commands.renderPresentationLibrary);
  }
}
