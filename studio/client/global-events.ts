export namespace StudioClientGlobalEvents {
  export type GlobalEventDeps = {
    documentRef: Document;
    exportMenu: {
      close: () => void;
      contains: (target: Node) => boolean;
      isOpen: () => boolean;
    };
    navigationShell: {
      mountGlobalEvents: () => void;
    };
  };

  export function mountGlobalEvents({ documentRef, exportMenu, navigationShell }: GlobalEventDeps): void {
    navigationShell.mountGlobalEvents();
    documentRef.addEventListener("click", (event) => {
      const target = event.target;
      if (!exportMenu.isOpen() || !(target instanceof Node) || exportMenu.contains(target)) {
        return;
      }
      exportMenu.close();
    });
    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        exportMenu.close();
      }
    });
  }
}
