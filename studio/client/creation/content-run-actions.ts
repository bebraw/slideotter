type BusyElement = HTMLElement & {
  disabled: boolean;
};

type ContentRunActionSelectors = {
  accept: string;
  retry: string;
  retryDataset: string;
  stop: string;
};

type CreationPayload = {
  creationDraft?: unknown;
};

type ContentRunActionElements = {
  contentRunPreviewActions?: HTMLElement | null;
  studioContentRunPanel?: HTMLElement | null;
};

type ContentRunActionsDependencies = {
  elements: ContentRunActionElements;
  onCreationDraft: (creationDraft: unknown) => void;
  refreshState: () => Promise<void>;
  request: <TResponse = CreationPayload>(url: string, options?: RequestInit) => Promise<TResponse>;
  setBusy: (button: BusyElement, label: string) => () => void;
  windowRef: Window;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function closestContainedButton(target: EventTarget | null, container: HTMLElement, selector: string): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const button = target.closest(selector);
  return button instanceof HTMLButtonElement && container.contains(button) ? button : null;
}

export function createContentRunActions(deps: ContentRunActionsDependencies) {
  function retrySlide(slideNumber: number): void {
    deps.request("/api/presentations/draft/content/retry", {
      body: JSON.stringify({
        slideIndex: slideNumber - 1
      }),
      method: "POST"
    }).catch((error) => deps.windowRef.alert(errorMessage(error)));
  }

  function stopRun(button: HTMLButtonElement): void {
    const done = deps.setBusy(button, "Stopping...");
    deps.request("/api/presentations/draft/content/stop", {
      method: "POST"
    }).catch((error) => deps.windowRef.alert(errorMessage(error))).finally(() => done());
  }

  function acceptPartial(button: HTMLButtonElement): void {
    const done = deps.setBusy(button, "Accepting...");
    deps.request("/api/presentations/draft/content/accept-partial", {
      method: "POST"
    }).then((payload: CreationPayload) => {
      deps.onCreationDraft(payload.creationDraft);
      return deps.refreshState();
    }).catch((error) => deps.windowRef.alert(errorMessage(error))).finally(() => done());
  }

  function handleContentRunActionClick(event: MouseEvent, container: HTMLElement, selectors: ContentRunActionSelectors): void {
    const target = event.target;
    const retryButton = closestContainedButton(target, container, selectors.retry);
    if (retryButton) {
      const slideNumber = Number.parseInt(retryButton.dataset[selectors.retryDataset] || "", 10);
      if (Number.isFinite(slideNumber)) {
        retrySlide(slideNumber);
      }
      return;
    }

    const stopButton = closestContainedButton(target, container, selectors.stop);
    if (stopButton) {
      stopRun(stopButton);
      return;
    }

    const acceptButton = closestContainedButton(target, container, selectors.accept);
    if (acceptButton) {
      acceptPartial(acceptButton);
    }
  }

  function mountContentRunControls(): void {
    const contentRunPreviewActions = deps.elements.contentRunPreviewActions;
    if (contentRunPreviewActions) {
      contentRunPreviewActions.addEventListener("click", (event) => {
        handleContentRunActionClick(event, contentRunPreviewActions, {
          accept: "[data-content-run-accept-partial]",
          retry: "[data-content-run-retry-slide]",
          retryDataset: "contentRunRetrySlide",
          stop: "[data-content-run-stop]"
        });
      });
    }

    const studioContentRunPanel = deps.elements.studioContentRunPanel;
    if (studioContentRunPanel) {
      studioContentRunPanel.addEventListener("click", (event) => {
        handleContentRunActionClick(event, studioContentRunPanel, {
          accept: "[data-studio-content-run-accept-partial]",
          retry: "[data-studio-content-run-retry]",
          retryDataset: "studioContentRunRetry",
          stop: "[data-studio-content-run-stop]"
        });
      });
    }
  }

  return {
    acceptPartial,
    handleContentRunActionClick,
    mountContentRunControls,
    retrySlide,
    stopRun
  };
}
