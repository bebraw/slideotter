import type { StudioClientElements } from "./elements.ts";

export namespace StudioClientThemeWorkbench {
  type CreateDomElement = (
    tagName: string,
    options?: {
      attributes?: Record<string, string | number | boolean>;
      className?: string;
      dataset?: Record<string, string | number | boolean>;
      disabled?: boolean;
      text?: unknown;
    },
    children?: Array<Node | string | number | boolean>
  ) => HTMLElement;

  type VisualTheme = {
    accent?: string;
    bg?: string;
    fontFamily?: string;
    panel?: string;
    primary?: string;
    secondary?: string;
  };

  type ThemeVariant = {
    id: string;
    label: string;
    note: string;
    theme: VisualTheme;
  };

  type SavedTheme = {
    id: string;
    name: string;
    theme?: VisualTheme;
  };

  type PreviewEntry = {
    id: string;
    index?: number;
    slideSpec?: {
      type?: string;
    } & Record<string, unknown>;
  };

  type TokenSummary = {
    label: string;
    tone: "color" | "neutral";
    value: string;
  };

  type ThemeWorkbenchState = {
    domPreview: {
      slides: PreviewEntry[];
    };
    savedThemes: SavedTheme[];
    selectedSlideId: string | null;
    slides: unknown[];
    themeCandidates: ThemeVariant[];
    ui: {
      creationThemeVariantId: string;
      themeCandidateRefreshIndex: number;
      themeCandidatesGenerated: boolean;
      themeDrawerOpen: boolean;
    };
  };

  type ThemeRequestContext = Record<string, unknown>;

  type ThemeWorkbenchDependencies = {
    applyCreationTheme: (theme: VisualTheme) => void;
    applyDeckThemeFields: (theme: VisualTheme | undefined) => void;
    applySavedTheme: (themeId: string) => void;
    applySavedThemeToDeck: (themeId: string | undefined) => void;
    createDomElement: CreateDomElement;
    elements: StudioClientElements.Elements;
    getBrief: () => string;
    getCurrentTheme: () => VisualTheme;
    getRequestContext: () => ThemeRequestContext;
    persistSelectedThemeToDeck: () => Promise<void>;
    render: () => void;
    renderDomSlide: (viewport: Element | null, slideSpec: unknown, options?: { index?: number; theme?: VisualTheme; totalSlides?: number }) => void;
    request: (url: string, options?: RequestInit) => Promise<{
      candidates?: ThemeVariant[];
      name?: string;
      source?: string;
      theme?: VisualTheme;
    }>;
    saveCreationDraft: (scope: string) => Promise<void>;
    saveDeckTheme: () => Promise<void>;
    savePresentationTheme?: () => Promise<void>;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
    setThemeDrawerOpen: (open: boolean) => void;
    state: ThemeWorkbenchState;
    syncDeckThemeBrief: (value: string) => void;
  };

  function isPreviewEntry(value: unknown): value is PreviewEntry {
    return Boolean(value && typeof value === "object" && "id" in value);
  }

  export function createThemeWorkbench({
    applyCreationTheme,
    applyDeckThemeFields,
    applySavedTheme,
    applySavedThemeToDeck,
    createDomElement,
    elements,
    getBrief,
    getCurrentTheme,
    getRequestContext,
    persistSelectedThemeToDeck,
    render,
    renderDomSlide,
    request,
    saveCreationDraft,
    saveDeckTheme,
    savePresentationTheme,
    setBusy,
    setThemeDrawerOpen,
    state,
    syncDeckThemeBrief
  }: ThemeWorkbenchDependencies) {
    function reportError(error: unknown): void {
      window.alert(error instanceof Error ? error.message : String(error));
    }

    function runAction(action: () => Promise<void> | void): void {
      Promise.resolve()
        .then(action)
        .catch(reportError);
    }

    function resetCandidates(): void {
      state.themeCandidates = [];
      state.ui.creationThemeVariantId = "current";
      state.ui.themeCandidateRefreshIndex = 0;
      state.ui.themeCandidatesGenerated = false;
    }

    function getVariants(): ThemeVariant[] {
      const currentVariant = {
        id: "current",
        label: "Current",
        note: "Use the selected controls.",
        theme: getCurrentTheme()
      };

      if (!state.ui.themeCandidatesGenerated) {
        return [currentVariant];
      }

      return [
        currentVariant,
        ...(Array.isArray(state.themeCandidates)
          ? state.themeCandidates.filter((variant: ThemeVariant) => variant && variant.id !== "current")
          : [])
      ];
    }

    function getSelectedVariant(): ThemeVariant {
      const variants = getVariants();
      const selected = variants.find((variant: ThemeVariant) => variant.id === state.ui.creationThemeVariantId);
      return selected || variants[0] || {
        id: "current",
        label: "Current",
        note: "Use the selected controls.",
        theme: getCurrentTheme()
      };
    }

    function getPreviewEntries(): PreviewEntry[] {
      const slides = Array.isArray(state.domPreview.slides) ? state.domPreview.slides.filter(isPreviewEntry) : [];
      if (!slides.length) {
        return [];
      }

      const result: PreviewEntry[] = [];
      const seen = new Set<string>();

      const pushEntry = (entry: PreviewEntry | undefined): void => {
        if (!entry || !entry.id || seen.has(entry.id)) {
          return;
        }

        seen.add(entry.id);
        result.push(entry);
      };

      pushEntry(slides.find((entry) => entry && entry.slideSpec && entry.slideSpec.type === "cover"));
      pushEntry(slides.find((entry) => {
        const type = entry.slideSpec?.type;
        return Boolean(type && ["content", "summary", "toc"].includes(type));
      }));
      pushEntry(slides.find((entry) => {
        const type = entry.slideSpec?.type;
        return Boolean(type && ["divider", "quote", "photo", "photoGrid"].includes(type));
      }));

      if (result.length < 3) {
        slides.forEach((entry: PreviewEntry) => {
          if (result.length >= 3) {
            return;
          }
          pushEntry(entry);
        });
      }

      return result.slice(0, 3);
    }

    function getTokenSummary(theme: VisualTheme | null | undefined): TokenSummary[] {
      const source = theme && typeof theme === "object" ? theme : {};
      return [
        { label: "Font", value: source.fontFamily || "avenir", tone: "neutral" },
        { label: "Primary", value: source.primary || "#183153", tone: "color" },
        { label: "Secondary", value: source.secondary || "#275d8c", tone: "color" },
        { label: "Accent", value: source.accent || "#f28f3b", tone: "color" },
        { label: "Background", value: source.bg || "#f5f8fc", tone: "color" },
        { label: "Panel", value: source.panel || "#f8fbfe", tone: "color" }
      ];
    }

    function renderReview(selectedVariant: ThemeVariant): void {
      if (!elements.presentationThemeReview) {
        return;
      }

      const activeSlideCount = Array.isArray(state.slides) ? state.slides.length : 0;
      const previewEntries = getPreviewEntries();
      const tokens = getTokenSummary(selectedVariant.theme);
      const variantLabel = selectedVariant && selectedVariant.label ? selectedVariant.label : "Current";
      const variantNote = selectedVariant && selectedVariant.note ? selectedVariant.note : "Use the selected controls.";

      const tokenElements = tokens.map((token) => {
        const tokenOptions: Parameters<CreateDomElement>[1] = {
          className: `creation-theme-review__token${token.tone === "color" ? " is-color" : ""}`
        };
        if (token.tone === "color") {
          tokenOptions.attributes = { style: `--theme-token:${token.value}` };
        }
        return createDomElement("span", tokenOptions, [
          createDomElement("strong", { text: token.label }),
          createDomElement("small", { text: token.value })
        ]);
      });

      elements.presentationThemeReview.replaceChildren(
        createDomElement("div", { className: "creation-theme-review__head" }, [
          createDomElement("div", {}, [
            createDomElement("p", { className: "eyebrow", text: "Theme impact" }),
            createDomElement("strong", { text: `${variantLabel} theme` }),
            createDomElement("p", { text: variantNote })
          ]),
          createDomElement("div", {
            attributes: { "aria-label": "Theme impact" },
            className: "creation-theme-review__stats"
          }, [
            createDomElement("span", {}, [
              createDomElement("strong", { text: activeSlideCount }),
              ` active slide${activeSlideCount === 1 ? "" : "s"}`
            ]),
            createDomElement("span", {}, [
              createDomElement("strong", { text: previewEntries.length }),
              ` sample preview${previewEntries.length === 1 ? "" : "s"}`
            ])
          ])
        ]),
        createDomElement("div", {
          attributes: { "aria-label": "Theme tokens" },
          className: "creation-theme-review__tokens"
        }, tokenElements)
      );
    }

    function renderStage(): void {
      if (!elements.presentationThemeVariantList || !elements.presentationThemePreview) {
        return;
      }

      const variants = getVariants();
      if (!variants.some((variant: ThemeVariant) => variant.id === state.ui.creationThemeVariantId)) {
        state.ui.creationThemeVariantId = "current";
      }
      const selectedVariant = getSelectedVariant();
      renderReview(selectedVariant);
      if (elements.generateThemeCandidatesButton) {
        elements.generateThemeCandidatesButton.textContent = state.ui.themeCandidatesGenerated
          ? "Refresh candidates"
          : "Generate candidates";
      }
      elements.presentationThemeVariantList.replaceChildren(...variants.map((variant: ThemeVariant) => createDomElement("button", {
        attributes: {
          "aria-pressed": variant.id === selectedVariant.id ? "true" : "false",
          type: "button"
        },
        className: `creation-theme-variant${variant.id === selectedVariant.id ? " active" : ""}`,
        dataset: { creationThemeVariant: variant.id }
      }, [
        createDomElement("span", {
          attributes: {
            style: `--swatch-bg:${variant.theme.bg || "#ffffff"};--swatch-primary:${variant.theme.primary || "#183153"};--swatch-accent:${variant.theme.accent || "#f28f3b"}`
          },
          className: "creation-theme-swatch"
        }),
        createDomElement("strong", { text: variant.label }),
        createDomElement("small", { text: variant.note })
      ])));

      const previewEntries = getPreviewEntries();
      if (previewEntries.length) {
        elements.presentationThemePreview.replaceChildren(createDomElement("div", {
          className: "creation-theme-preview-grid"
        }, previewEntries.map((entry: PreviewEntry, index: number) => createDomElement("section", {
          className: `creation-theme-preview-card${entry.id === state.selectedSlideId ? " is-current" : ""}`,
          dataset: { themePreviewSlideId: entry.id }
        }, [
          createDomElement("header", { className: "creation-theme-preview-card__meta" }, [
            createDomElement("span", { text: `Slide ${entry.index || index + 1}` }),
            createDomElement("small", { text: entry.slideSpec && entry.slideSpec.type ? entry.slideSpec.type : "slide" })
          ]),
          createDomElement("div", { className: "creation-theme-preview-card__viewport" })
        ]))));
        elements.presentationThemePreview.querySelectorAll<HTMLElement>("[data-theme-preview-slide-id]").forEach((card: HTMLElement) => {
          const entry = previewEntries.find((candidate: PreviewEntry) => candidate.id === card.dataset.themePreviewSlideId);
          const viewport = card.querySelector(".creation-theme-preview-card__viewport");
          if (!entry || !entry.slideSpec || !viewport) {
            return;
          }

          renderDomSlide(viewport, entry.slideSpec, {
            index: entry.index || 1,
            theme: selectedVariant.theme,
            totalSlides: state.slides.length || state.domPreview.slides.length || 1
          });
        });
      } else {
        elements.presentationThemePreview.replaceChildren(createDomElement("div", { className: "presentation-empty" }, [
          createDomElement("strong", { text: "No slide preview yet" }),
          createDomElement("span", { text: "Select a presentation to preview themes." })
        ]));
      }
    }

    async function generateCandidates(): Promise<void> {
      const done = setBusy(elements.generateThemeCandidatesButton, "Generating...");
      try {
        state.ui.themeCandidateRefreshIndex = state.ui.themeCandidatesGenerated
          ? state.ui.themeCandidateRefreshIndex + 1
          : 0;
        const context = getRequestContext();
        const payload = await request("/api/themes/candidates", {
          body: JSON.stringify({
            ...context,
            currentTheme: getCurrentTheme(),
            refreshIndex: state.ui.themeCandidateRefreshIndex,
            themeBrief: getBrief()
          }),
          method: "POST"
        });
        state.themeCandidates = Array.isArray(payload.candidates)
          ? payload.candidates.filter((candidate: ThemeVariant) => candidate && candidate.id !== "current")
          : [];
        state.ui.themeCandidatesGenerated = true;
        state.ui.creationThemeVariantId = "current";
        render();
      } finally {
        done();
      }
    }

    async function generateFromBrief(): Promise<void> {
      const brief = getBrief().trim() || "clean professional theme";
      const done = setBusy(elements.generateThemeFromBriefButton, "Generating...");
      try {
        const generated = await request("/api/themes/generate", {
          body: JSON.stringify({
            ...getRequestContext(),
            currentTheme: getCurrentTheme(),
            themeBrief: brief
          }),
          method: "POST"
        });

        applyDeckThemeFields(generated.theme);
        resetCandidates();
        render();
        await persistSelectedThemeToDeck();
        elements.operationStatus.textContent = generated && generated.source === "llm"
          ? `Generated and applied "${generated.name || "theme"}" from the brief.`
          : "Generated and applied a fallback theme from the brief.";
      } finally {
        done();
      }
    }

    function renderFavorites(): void {
      if (!elements.themeFavoriteList) {
        return;
      }

      if (!state.savedThemes.length) {
        elements.themeFavoriteList.replaceChildren(createDomElement("p", { text: "No favorite themes yet." }));
        return;
      }

      elements.themeFavoriteList.replaceChildren(...state.savedThemes.map((theme: SavedTheme) => {
        const visualTheme = theme.theme || {};
        return createDomElement("button", {
          attributes: { type: "button" },
          className: "theme-favorite-card",
          dataset: { themeFavoriteId: theme.id }
        }, [
          createDomElement("span", {
            attributes: {
              style: `--swatch-bg:${visualTheme.bg || "#ffffff"};--swatch-primary:${visualTheme.primary || "#183153"};--swatch-accent:${visualTheme.accent || "#f28f3b"}`
            },
            className: "creation-theme-swatch"
          }),
          createDomElement("strong", { text: theme.name || "Saved theme" })
        ]);
      }));
    }

    function renderSavedThemes(): void {
      const selectedId = elements.presentationSavedTheme.value;
      elements.presentationSavedTheme.replaceChildren(
        createDomElement("option", { attributes: { value: "" }, text: "Current draft colors" }),
        ...state.savedThemes.map((theme: SavedTheme) => createDomElement("option", {
          attributes: { value: theme.id },
          text: theme.name
        }))
      );
      elements.presentationSavedTheme.value = state.savedThemes.some((theme: SavedTheme) => theme.id === selectedId) ? selectedId : "";
      renderFavorites();
    }

    function mountThemeInputs(): void {
      [
        elements.deckThemeBrief,
        elements.themeBrief,
        elements.themeFontFamily,
        elements.themePrimary,
        elements.themeSecondary,
        elements.themeAccent,
        elements.themeMuted,
        elements.themeLight,
        elements.themeBg,
        elements.themePanel,
        elements.themeSurface,
        elements.themeProgressTrack,
        elements.themeProgressFill
      ].forEach((element) => {
        element.addEventListener("input", () => {
          if (element === elements.deckThemeBrief || element === elements.themeBrief) {
            syncDeckThemeBrief(element.value);
          }
          resetCandidates();
          render();
        });
        element.addEventListener("change", () => {
          if (element === elements.deckThemeBrief || element === elements.themeBrief) {
            syncDeckThemeBrief(element.value);
          }
          resetCandidates();
          render();
          runAction(persistSelectedThemeToDeck);
        });
      });
    }

    function mount(): void {
      mountThemeInputs();
      elements.themeDrawerToggle.addEventListener("click", () => {
        setThemeDrawerOpen(!state.ui.themeDrawerOpen);
      });
      elements.generateThemeFromBriefButton.addEventListener("click", () => {
        runAction(generateFromBrief);
      });
      elements.generateThemeCandidatesButton.addEventListener("click", () => {
        runAction(generateCandidates);
      });
      elements.saveDeckThemeButton.addEventListener("click", () => {
        runAction(saveDeckTheme);
      });
      if (elements.savePresentationThemeButton && savePresentationTheme) {
        elements.savePresentationThemeButton.addEventListener("click", () => {
          runAction(savePresentationTheme);
        });
      }
      elements.presentationSavedTheme.addEventListener("change", () => {
        applySavedTheme(elements.presentationSavedTheme.value);
        state.ui.creationThemeVariantId = "current";
        render();
        runAction(() => saveCreationDraft("theme"));
      });
      elements.presentationThemeVariantList.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (!target) {
          return;
        }
        const button = target.closest<HTMLElement>("[data-creation-theme-variant]");
        if (!button || !elements.presentationThemeVariantList.contains(button)) {
          return;
        }

        state.ui.creationThemeVariantId = button.dataset.creationThemeVariant || "current";
        const variant = getSelectedVariant();
        if (variant.id !== "current") {
          applyCreationTheme(variant.theme);
        } else {
          render();
        }
        runAction(persistSelectedThemeToDeck);
      });
      elements.themeFavoriteList.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (!target) {
          return;
        }
        const button = target.closest<HTMLElement>("[data-theme-favorite-id]");
        if (!button || !elements.themeFavoriteList.contains(button)) {
          return;
        }

        applySavedThemeToDeck(button.dataset.themeFavoriteId);
        runAction(persistSelectedThemeToDeck);
      });
    }

    return {
      generateCandidates,
      generateFromBrief,
      getSelectedVariant,
      getVariants,
      mount,
      renderFavorites,
      renderSavedThemes,
      renderStage,
      resetCandidates
    };
  }
}
