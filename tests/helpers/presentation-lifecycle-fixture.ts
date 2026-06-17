import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type CoveragePresentationFields = Record<string, unknown>;

type CoveragePresentation = Record<string, unknown> & {
  id: string;
  slideCount?: number;
  targetSlideCount?: number;
  title?: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: CoveragePresentation[];
};

type PresentationServices = {
  createPresentation: (fields: CoveragePresentationFields) => CoveragePresentation;
  deletePresentation: (id: string) => void;
  listPresentations: () => PresentationRegistry;
  setActivePresentation: (id: string) => void;
};

function createPresentationLifecycleFixture() {
  const {
    createPresentation,
    deletePresentation,
    listPresentations,
    setActivePresentation
  } = require("../../studio/server/services/presentations.ts") as PresentationServices;
  const createdPresentationIds = new Set<string>();
  const originalActivePresentationId = listPresentations().activePresentationId;

  function createCoveragePresentation(suffix: string, fields: CoveragePresentationFields = {}): CoveragePresentation {
    const presentation = createPresentation({
      audience: "Coverage validation",
      constraints: "Created by automated tests and removed after the run.",
      objective: "Exercise high-risk filesystem-backed studio services.",
      title: `Coverage Risk ${Date.now()} ${suffix}`,
      ...fields
    });
    createdPresentationIds.add(presentation.id);
    setActivePresentation(presentation.id);
    return presentation;
  }

  function listCoveragePresentations(): PresentationRegistry {
    return listPresentations();
  }

  function cleanupCoveragePresentations(): void {
    const current = listCoveragePresentations();
    const knownIds = new Set(current.presentations.map((presentation) => presentation.id));

    for (const id of createdPresentationIds) {
      if (!knownIds.has(id)) {
        continue;
      }

      try {
        deletePresentation(id);
      } catch (error) {
        // Keep cleanup best-effort so the original assertion failure remains visible.
      }
    }

    const afterCleanup = listCoveragePresentations();
    if (afterCleanup.presentations.some((presentation) => presentation.id === originalActivePresentationId)) {
      setActivePresentation(originalActivePresentationId);
    }
  }

  return {
    cleanupCoveragePresentations,
    createCoveragePresentation,
    forgetCoveragePresentation: (id: string) => {
      createdPresentationIds.delete(id);
    },
    listCoveragePresentations,
    trackCoveragePresentation: (id: string) => {
      createdPresentationIds.add(id);
    }
  };
}

export { createPresentationLifecycleFixture };
export type { CoveragePresentation };
