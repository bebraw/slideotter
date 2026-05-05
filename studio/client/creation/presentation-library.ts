import type { StudioClientElements } from "../core/elements.ts";

export namespace StudioClientPresentationLibrary {
  type PresentationSummary = {
    audience?: string;
    description?: string;
    firstSlideSpec?: unknown;
    id: string;
    objective?: string;
    slideCount?: number;
    subject?: string;
    targetSlideCount?: number;
    theme?: unknown;
    title?: string;
    tone?: string;
    updatedAt?: string;
  };

  type PresentationState = {
    activePresentationId?: string | null;
    presentations: PresentationSummary[];
  };

  type PresentationLibraryState = {
    selectedSlideId: string | null;
    selectedSlideIndex: number;
    selectedSlideSource: string;
    selectedSlideSpec: unknown;
    selectedSlideSpecDraftError: unknown;
    selectedSlideSpecError: unknown;
    selectedSlideStructured: boolean;
    selectedVariantId: string | null;
    transientVariants: unknown[];
  };

  type BusyButton = HTMLElement & {
    disabled: boolean;
  };

  type PresentationCommandResponse = {
    presentation?: PresentationSummary;
    presentations?: PresentationSummary[];
    ok?: boolean;
  };

  type Request = <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;

  type PresentationLibraryDependencies = {
    createDomElement: (tagName: string, options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      dataset?: Record<string, string | number | boolean>;
      disabled?: boolean;
      text?: unknown;
    }, children?: Array<Node | string | number | boolean>) => HTMLElement;
    elements: StudioClientElements.Elements;
    getPresentationState: () => PresentationState;
    refreshState: () => Promise<void>;
    renderDomSlide: (viewport: Element | null, slideSpec: unknown, options?: { index?: number; theme?: unknown; totalSlides?: number }) => void;
    request: Request;
    setBusy: (button: BusyButton, label: string) => () => void;
    setCurrentPage: (page: string) => void;
    state: PresentationLibraryState;
    windowRef: Window;
  };

  type SelectPresentationOptions = {
    openStudio?: boolean;
  };

  export function createPresentationLibrary(deps: PresentationLibraryDependencies) {
    const {
      createDomElement,
      elements,
      getPresentationState,
      refreshState,
      renderDomSlide,
      request,
      setBusy,
      setCurrentPage,
      state,
      windowRef
    } = deps;

    function createPresentationButton(className: string, label: string, disabled = false): HTMLButtonElement {
      const button = createDomElement("button", {
        attributes: {
          type: "button"
        },
        className,
        disabled,
        text: label
      });
      return button as HTMLButtonElement;
    }

    function renderEmptyState(query: string): void {
      elements.presentationList.replaceChildren(createDomElement("div", { className: "presentation-empty" }, [
        createDomElement("strong", {
          text: query ? "No matching presentations" : "No presentations found"
        }),
        createDomElement("span", {
          text: query
            ? "Clear the filter or search for a different title, audience, tone, or objective."
            : "Create one from constraints and an initial generated deck."
        })
      ]));
    }

    function formatPresentationDate(value: string | null | undefined): string {
      if (!value) {
        return "";
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      try {
        return new Intl.DateTimeFormat(undefined, {
          day: "numeric",
          month: "short"
        }).format(date);
      } catch (error) {
        return date.toISOString().slice(0, 10);
      }
    }

    function buildPresentationFacts(presentation: PresentationSummary): string[] {
      const facts = [
        `${presentation.slideCount || 0} slide${presentation.slideCount === 1 ? "" : "s"}`
      ];
      if (presentation.targetSlideCount) {
        facts.push(`${presentation.targetSlideCount} target`);
      }
      const updated = formatPresentationDate(presentation.updatedAt);
      if (updated) {
        facts.push(`Updated ${updated}`);
      }
      if (presentation.audience) {
        facts.push(presentation.audience);
      }
      if (presentation.tone) {
        facts.push(presentation.tone);
      }

      return facts.slice(0, 4);
    }

    function getPresentationSearchText(presentation: PresentationSummary): string {
      return [
        presentation.title,
        presentation.description,
        presentation.audience,
        presentation.objective,
        presentation.subject,
        presentation.tone,
        presentation.targetSlideCount ? `${presentation.targetSlideCount} target` : ""
      ].map((value) => String(value || "").toLowerCase()).join(" ");
    }

    function resetSelection(): void {
      state.selectedSlideId = null;
      state.selectedSlideIndex = 1;
      state.selectedSlideSpec = null;
      state.selectedSlideSpecDraftError = null;
      state.selectedSlideSpecError = null;
      state.selectedSlideStructured = false;
      state.selectedSlideSource = "";
      state.selectedVariantId = null;
      state.transientVariants = [];
    }

    async function selectPresentation(
      presentationId: string,
      button: BusyButton | null = null,
      options: SelectPresentationOptions = {}
    ): Promise<void> {
      const presentationState = getPresentationState();
      const shouldOpenStudio = options.openStudio === true;
      if (presentationId === presentationState.activePresentationId) {
        if (shouldOpenStudio) {
          setCurrentPage("studio");
        }
        return;
      }

      const done = button ? setBusy(button, "Selecting...") : null;
      try {
        await request<PresentationCommandResponse>("/api/v1/presentations/select", {
          body: JSON.stringify({ presentationId }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
        if (shouldOpenStudio) {
          setCurrentPage("studio");
        }
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function duplicatePresentation(presentation: PresentationSummary, button: BusyButton | null = null): Promise<void> {
      const title = `${presentation.title || presentation.id} copy`;
      const done = button ? setBusy(button, "Duplicating...") : null;
      try {
        await request<PresentationCommandResponse>("/api/v1/presentations/duplicate", {
          body: JSON.stringify({
            presentationId: presentation.id,
            title
          }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
        setCurrentPage("studio");
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function rebuildPresentationFromSavedContext(presentation: PresentationSummary, button: BusyButton | null = null): Promise<void> {
      const confirmed = windowRef.confirm(
        `Rebuild "${presentation.title || presentation.id}" from its saved context?\n\n`
        + "This replaces every current slide file. Use Slide Studio retry controls for non-destructive per-slide regeneration."
      );
      if (!confirmed) {
        return;
      }

      const done = button ? setBusy(button, "Rebuilding...") : null;
      try {
        await request<PresentationCommandResponse>("/api/v1/presentations/regenerate", {
          body: JSON.stringify({
            presentationId: presentation.id
          }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
        setCurrentPage("studio");
      } finally {
        if (done) {
          done();
        }
      }
    }

    async function deletePresentation(presentation: PresentationSummary, button: BusyButton | null = null): Promise<void> {
      const confirmed = windowRef.confirm(`Delete "${presentation.title || presentation.id}"? This removes the presentation folder from this workspace.`);
      if (!confirmed) {
        return;
      }

      const done = button ? setBusy(button, "Deleting...") : null;
      try {
        await request<PresentationCommandResponse>("/api/v1/presentations/delete", {
          body: JSON.stringify({ presentationId: presentation.id }),
          method: "POST"
        });
        resetSelection();
        await refreshState();
      } finally {
        if (done) {
          done();
        }
      }
    }

    function render(): void {
      const presentationState = getPresentationState();
      const query = String(elements.presentationSearch.value || "").trim().toLowerCase();
      const presentations = presentationState.presentations
        .filter((presentation: PresentationSummary) => !query || getPresentationSearchText(presentation).includes(query));
      elements.presentationList.replaceChildren();
      elements.presentationResultCount.textContent = `${presentations.length} of ${presentationState.presentations.length} presentation${presentationState.presentations.length === 1 ? "" : "s"}`;

      if (!presentations.length) {
        renderEmptyState(query);
        return;
      }

      presentations.forEach((presentation: PresentationSummary) => {
        const active = presentation.id === presentationState.activePresentationId;
        const facts = buildPresentationFacts(presentation);
        const preview = createDomElement("div", {
          attributes: {
            "aria-hidden": "true"
          },
          className: "presentation-card-preview"
        });
        const titleRowChildren: Array<Node | string> = [
          createDomElement("h3", { text: presentation.title || presentation.id })
        ];
        if (active) {
          titleRowChildren.push(createDomElement("span", {
            className: "presentation-active-pill",
            text: "Active"
          }));
        }
        const factsRow = createDomElement("div", {
          attributes: {
            "aria-label": "Presentation metadata"
          },
          className: "presentation-card-facts"
        }, facts.map((fact: string) => createDomElement("span", { text: fact })));
        const selectButton = createPresentationButton("secondary presentation-select-button", active ? "Open" : "Select");
        const regenerateButton = createPresentationButton("secondary presentation-regenerate-button", "Rebuild from context");
        regenerateButton.title = "Destructive rebuild: replaces all current slide files from the saved presentation context.";
        const duplicateButton = createPresentationButton("secondary presentation-duplicate-button", "Duplicate");
        const deleteButton = createPresentationButton("secondary presentation-delete-button", "Delete", presentations.length <= 1);
        const card = createDomElement("article", {
          className: `presentation-card${active ? " active" : ""}`,
          dataset: {
            presentationId: presentation.id
          }
        }, [
          preview,
          createDomElement("div", { className: "presentation-card-body" }, [
            createDomElement("div", { className: "presentation-card-title-row" }, titleRowChildren),
            createDomElement("p", { text: presentation.description || "No brief saved yet." }),
            factsRow
          ]),
          createDomElement("div", { className: "presentation-card-actions" }, [
            selectButton,
            regenerateButton,
            duplicateButton,
            deleteButton
          ])
        ]);

        if (presentation.firstSlideSpec) {
          renderDomSlide(preview, presentation.firstSlideSpec, {
            index: 1,
            theme: presentation.theme,
            totalSlides: presentation.slideCount || 1
          });
        }

        selectButton.addEventListener("click", () => {
          selectPresentation(presentation.id, selectButton, { openStudio: active }).catch((error) => windowRef.alert(error.message));
        });
        duplicateButton.addEventListener("click", () => {
          duplicatePresentation(presentation, duplicateButton).catch((error) => windowRef.alert(error.message));
        });
        regenerateButton.addEventListener("click", () => {
          rebuildPresentationFromSavedContext(presentation, regenerateButton).catch((error) => windowRef.alert(error.message));
        });
        deleteButton.addEventListener("click", () => {
          deletePresentation(presentation, deleteButton).catch((error) => windowRef.alert(error.message));
        });
        card.addEventListener("click", (event: MouseEvent) => {
          const target = event.target as Element | null;
          if (target && target.closest("button")) {
            return;
          }

          const openStudio = event.detail > 1 || presentation.id === getPresentationState().activePresentationId;
          selectPresentation(presentation.id, selectButton, { openStudio }).catch((error) => windowRef.alert(error.message));
        });

        elements.presentationList.appendChild(card);
      });
    }

    return {
      deletePresentation,
      duplicatePresentation,
      rebuildPresentationFromSavedContext,
      render,
      resetSelection,
      selectPresentation
    };
  }
}
