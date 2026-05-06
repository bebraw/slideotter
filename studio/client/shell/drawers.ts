export namespace StudioClientDrawers {
  export type DrawerConfig = {
    afterRender?: () => void;
    afterSet?: (open: boolean) => void;
    bodyClass: string;
    closedLabel: string;
    drawer: () => HTMLElement;
    hideWhenUnavailable?: boolean;
    onBeforeSet?: (open: boolean) => void;
    onOpen?: () => void;
    openLabel: string;
    persist?: () => void;
    stateKey: string;
    toggle: () => HTMLElement;
  };

  type DrawerControllerDependencies = {
    configs: Record<string, DrawerConfig>;
    documentBody: HTMLElement;
    isAvailable: () => boolean;
    order: string[];
    state: {
      ui: Record<string, boolean | number | string | null | Record<string, boolean>>;
    };
  };

  export function createDrawerController({ configs, documentBody, isAvailable, order, state }: DrawerControllerDependencies) {
    function getConfig(key: string): DrawerConfig {
      const config = configs[key];
      if (!config) {
        throw new Error(`Unknown drawer config: ${key}`);
      }
      return config;
    }

    function render(key: string): void {
      const config = getConfig(key);
      const available = isAvailable();
      const open = available && Boolean(state.ui[config.stateKey]);
      const drawer = config.drawer();
      const toggle = config.toggle();

      documentBody.classList.toggle(config.bodyClass, open);
      if (config.hideWhenUnavailable) {
        drawer.hidden = !available;
      }
      drawer.dataset.open = open ? "true" : "false";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? config.openLabel : config.closedLabel);
      if (config.afterRender) {
        config.afterRender();
      }
    }

    function renderAll(): void {
      order.forEach(render);
    }

    function persistPreference(key: string): void {
      const persist = getConfig(key).persist;
      if (persist) {
        persist();
      }
    }

    function closePeers(openKey: string): void {
      order.forEach((key: string) => {
        if (key === openKey) {
          return;
        }
        const config = getConfig(key);
        if (state.ui[config.stateKey]) {
          state.ui[config.stateKey] = false;
          persistPreference(key);
        }
      });
    }

    function hasOpenPeer(openKey: string): boolean {
      return order.some((key: string) => {
        if (key === openKey) {
          return false;
        }
        return Boolean(state.ui[getConfig(key).stateKey]);
      });
    }

    function scheduleSwitchingClassRemoval(): void {
      const windowRef = documentBody.ownerDocument.defaultView;
      if (!windowRef) {
        documentBody.classList.remove("drawer-switching");
        return;
      }
      windowRef.requestAnimationFrame(() => {
        windowRef.requestAnimationFrame(() => documentBody.classList.remove("drawer-switching"));
      });
    }

    function setOpen(key: string, open: boolean): void {
      const config = getConfig(key);
      const switchingDrawers = isAvailable() && Boolean(open) && hasOpenPeer(key);
      if (config.onBeforeSet) {
        config.onBeforeSet(Boolean(open));
      }

      state.ui[config.stateKey] = isAvailable() && Boolean(open);
      if (state.ui[config.stateKey]) {
        closePeers(key);
        if (config.onOpen) {
          config.onOpen();
        }
      }

      persistPreference(key);
      documentBody.classList.toggle("drawer-switching", switchingDrawers);
      renderAll();
      if (switchingDrawers) {
        scheduleSwitchingClassRemoval();
      }
      if (config.afterSet) {
        config.afterSet(Boolean(state.ui[config.stateKey]));
      }
    }

    return {
      render,
      renderAll,
      setOpen
    };
  }
}
