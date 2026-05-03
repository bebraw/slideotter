export namespace StudioClientLazyWorkbench {
  type LazyWorkbenchOptions<TWorkbench> = {
    create: () => Promise<TWorkbench>;
    mount?: (workbench: TWorkbench) => void;
  };

  export type LazyWorkbench<TWorkbench> = {
    get: () => TWorkbench | null;
    load: () => Promise<TWorkbench>;
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
}
