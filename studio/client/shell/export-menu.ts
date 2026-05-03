import { StudioClientElements } from "../elements.ts";

export namespace StudioClientExportMenu {
  export type ExportMenu = {
    close: () => void;
    contains: (target: Node) => boolean;
    isOpen: () => boolean;
    toggle: () => void;
  };

  export function createExportMenu(elements: StudioClientElements.Elements): ExportMenu {
    function setOpen(open: boolean): void {
      elements.exportMenuPopover.hidden = !open;
      elements.exportMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function isOpen(): boolean {
      return elements.exportMenuPopover.hidden === false;
    }

    return {
      close: () => setOpen(false),
      contains: (target) => elements.exportMenu.contains(target),
      isOpen,
      toggle: () => setOpen(!isOpen())
    };
  }
}
