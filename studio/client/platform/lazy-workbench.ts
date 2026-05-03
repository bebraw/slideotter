export namespace StudioClientLazyWorkbench {
  type LazyWorkbenchOptions<TWorkbench> = {
    create: () => Promise<TWorkbench>;
    mount?: (workbench: TWorkbench) => void;
  };

  type LazyWorkbenchModuleOptions<TModule, TWorkbench> = {
    create: (module: TModule) => Promise<TWorkbench> | TWorkbench;
    importModule: () => Promise<TModule>;
    mount?: (workbench: TWorkbench) => void;
  };

  export type LazyWorkbench<TWorkbench> = {
    get: () => TWorkbench | null;
    load: () => Promise<TWorkbench>;
  };

  type RenderLoadedOrLoadOptions<TWorkbench> = {
    load: () => void;
    render: (workbench: TWorkbench) => void;
    shouldLoad: () => boolean;
    workbench: TWorkbench | null;
  };

  export function createLazyWorkbench<TWorkbench>({ create, mount }: LazyWorkbenchOptions<TWorkbench>): LazyWorkbench<TWorkbench> {
    let workbench: TWorkbench | null = null;
    let loadPromise: Promise<TWorkbench> | null = null;
    let mounted = false;

    async function load(): Promise<TWorkbench> {
      if (workbench) {
        return workbench;
      }
      if (!loadPromise) {
        loadPromise = create().then((created) => {
          workbench = created;
          if (mount && !mounted) {
            mount(created);
            mounted = true;
          }
          return created;
        });
      }
      return loadPromise;
    }

    return {
      get: () => workbench,
      load
    };
  }

  export function createLazyWorkbenchModule<TModule, TWorkbench>({
    create,
    importModule,
    mount
  }: LazyWorkbenchModuleOptions<TModule, TWorkbench>): LazyWorkbench<TWorkbench> {
    const options: LazyWorkbenchOptions<TWorkbench> = {
      create: async () => create(await importModule())
    };
    if (mount) {
      options.mount = mount;
    }
    return createLazyWorkbench(options);
  }

  export function renderLoadedOrLoad<TWorkbench>({
    load,
    render,
    shouldLoad,
    workbench
  }: RenderLoadedOrLoadOptions<TWorkbench>): void {
    if (workbench) {
      render(workbench);
      return;
    }
    if (shouldLoad()) {
      load();
    }
  }
}
