import type { StudioClientState } from "../core/state";

type JsonRecord = StudioClientState.JsonRecord;
type PreviewPage = StudioClientState.PreviewPage;

type CreateDomElement = (
  tagName: string,
  options?: {
    attributes?: Record<string, string | number | boolean>;
    className?: string;
    text?: unknown;
  },
  children?: Array<Node | string | number | boolean>
) => HTMLElement;

type DeckStripPreview = {
  url?: string;
};

type DeckStructurePreview = JsonRecord & {
  currentStrip?: DeckStripPreview;
  strip?: DeckStripPreview;
};

type PreviewHint = JsonRecord & {
  action?: string;
  cue?: string;
  currentIndex?: number;
  currentTitle?: string;
  proposedPreview?: DeckStripPreview;
  proposedTitle?: string;
  type?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asPreviewHint(value: unknown): PreviewHint {
  return isRecord(value) ? value : {};
}

export function renderDeckStructureStripCompare({
  createDomElement,
  label,
  preview
}: {
  createDomElement: CreateDomElement;
  label: string;
  preview: DeckStructurePreview;
}): HTMLElement | null {
  const stripCards: HTMLElement[] = [];
  if (preview.currentStrip?.url) {
    stripCards.push(createDomElement("div", { className: "deck-structure-strip-card" }, [
      createDomElement("span", { className: "deck-structure-strip-label", text: "Before deck" }),
      createDomElement("img", {
        attributes: {
          alt: `${label} current deck strip`,
          src: preview.currentStrip.url
        }
      })
    ]));
  }
  if (preview.strip?.url) {
    stripCards.push(createDomElement("div", { className: "deck-structure-strip-card" }, [
      createDomElement("span", { className: "deck-structure-strip-label", text: "After deck" }),
      createDomElement("img", {
        attributes: {
          alt: `${label} proposed deck strip`,
          src: preview.strip.url
        }
      })
    ]));
  }

  return stripCards.length
    ? createDomElement("div", { className: "deck-structure-strip-compare" }, stripCards)
    : null;
}

export function renderDeckStructurePreviewHints({
  createDomElement,
  generatedAt,
  pages,
  previewHints
}: {
  createDomElement: CreateDomElement;
  generatedAt: string | undefined;
  pages: PreviewPage[];
  previewHints: unknown[];
}): HTMLElement | null {
  const hintCards = previewHints.map((rawHint: unknown) => {
    const hint = asPreviewHint(rawHint);
    const currentIndex = typeof hint.currentIndex === "number" ? hint.currentIndex : Number.NaN;
    const currentPage = Number.isFinite(currentIndex)
      ? pages.find((entry) => entry.index === currentIndex)
      : null;
    const currentPreview = currentPage
      ? createDomElement("img", {
        attributes: {
          alt: hint.currentTitle || "Current slide",
          src: `${currentPage.url}?t=${encodeURIComponent(generatedAt || "")}`
        }
      })
      : createDomElement("div", {
        className: "deck-structure-preview-placeholder",
        text: hint.action === "insert" ? (hint.type || "new slide") : "archived"
      });
    const proposedPreview = hint.proposedPreview?.url
      ? createDomElement("img", {
        attributes: {
          alt: hint.proposedTitle || "Proposed slide",
          src: hint.proposedPreview.url
        }
      })
      : createDomElement("div", {
        className: "deck-structure-preview-placeholder",
        text: hint.action === "remove" ? "archived" : (hint.type || "pending")
      });

    return createDomElement("div", { className: "deck-structure-preview-card" }, [
      createDomElement("div", { className: "deck-structure-preview-pair" }, [
        createDomElement("div", { className: "deck-structure-preview-slot" }, [
          createDomElement("span", { className: "deck-structure-preview-label", text: "Before" }),
          currentPreview
        ]),
        createDomElement("div", { className: "deck-structure-preview-slot" }, [
          createDomElement("span", { className: "deck-structure-preview-label", text: "After" }),
          proposedPreview
        ])
      ]),
      createDomElement("strong", { text: hint.action || "keep" }),
      createDomElement("span", { text: hint.cue || "" })
    ]);
  });

  return hintCards.length
    ? createDomElement("div", { className: "deck-structure-preview-hints" }, hintCards)
    : null;
}
