namespace StudioClientDrawers {
  export function createDrawerController({ configs, documentBody, isAvailable, order, state }) {
    function render(key) {
      const config = configs[key];
      const available = isAvailable();
      const open = available && state.ui[config.stateKey];
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

    function renderAll() {
      order.forEach(render);
    }

    function persistPreference(key) {
      const persist = configs[key].persist;
      if (persist) {
        persist();
      }
    }

    function closePeers(openKey) {
      order.forEach((key) => {
        if (key === openKey) {
          return;
        }
        const config = configs[key];
        if (state.ui[config.stateKey]) {
          state.ui[config.stateKey] = false;
          persistPreference(key);
        }
      });
    }

    function setOpen(key, open) {
      const config = configs[key];
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
      renderAll();
      if (config.afterSet) {
        config.afterSet(state.ui[config.stateKey]);
      }
    }

    return {
      render,
      renderAll,
      setOpen
    };
  }
}
