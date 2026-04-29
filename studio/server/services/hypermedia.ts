const fs = require("fs");
const path = require("path");
const {
  getPresentationPaths,
  listPresentations,
  readPresentationDeckContext,
  readPresentationSummary
} = require("./presentations.ts");
const { getSlide, getSlides, readSlideSpec } = require("./slides.ts");
const { listVariantsForSlide } = require("./variants.ts");

const API_VERSION = "v1";

function versionFromFiles(files) {
  const parts = files.map((fileName) => {
    try {
      const stat = fs.statSync(fileName);
      return `${path.basename(fileName)}:${Math.trunc(stat.mtimeMs)}:${stat.size}`;
    } catch (error) {
      return `${path.basename(fileName)}:missing`;
    }
  });

  return parts.join("|");
}

function getPresentationVersion(presentationId) {
  const paths = getPresentationPaths(presentationId);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir)
      .filter((fileName) => /^slide-\d+\.json$/.test(fileName))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .map((fileName) => path.join(paths.slidesDir, fileName))
    : [];

  return versionFromFiles([
    paths.metaFile,
    paths.deckContextFile,
    paths.sourcesFile,
    paths.materialsFile,
    paths.layoutsFile,
    paths.variantsFile,
    ...slideFiles
  ]);
}

function getSlideVersion(presentationId, slideId) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  return versionFromFiles([slide.path]);
}

function createStaleResourceError(resourceLabel) {
  const error: any = new Error(`${resourceLabel} changed after this action was advertised. Refresh the resource and try again.`);
  error.code = "STALE_RESOURCE_VERSION";
  error.statusCode = 409;
  return error;
}

function assertBaseVersion(currentVersion, advertisedVersion, resourceLabel) {
  if (advertisedVersion == null || advertisedVersion === "") {
    return;
  }

  if (advertisedVersion !== currentVersion) {
    throw createStaleResourceError(resourceLabel);
  }
}

function link(href) {
  return { href };
}

function action({
  audience = ["local", "headless"],
  baseVersion = null,
  effect,
  href,
  id,
  input,
  label,
  links = null,
  method,
  scope
}) {
  const descriptor: any = {
    id,
    label,
    method,
    href,
    effect,
    input,
    scope,
    audience
  };

  if (baseVersion) {
    descriptor.baseVersion = baseVersion;
  }

  if (links) {
    descriptor.links = links;
  }

  return descriptor;
}

function createApiRootResource() {
  const presentations = listPresentations();
  const activePresentationId = presentations.activePresentationId;

  return {
    resource: "studio",
    version: API_VERSION,
    state: {
      activePresentationId,
      presentationCount: presentations.presentations.length
    },
    links: {
      self: link("/api/v1"),
      presentations: link("/api/v1/presentations"),
      activePresentation: link(`/api/v1/presentations/${activePresentationId}`),
      schemas: link("/api/v1/schemas")
    },
    actions: [
      action({
        effect: "write",
        href: "/api/presentations",
        id: "create-presentation",
        input: "createPresentationRequest",
        label: "Create presentation",
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createPresentationCollectionResource() {
  const presentations = listPresentations();

  return {
    resource: "presentationCollection",
    version: API_VERSION,
    state: {
      activePresentationId: presentations.activePresentationId,
      count: presentations.presentations.length
    },
    links: {
      self: link("/api/v1/presentations"),
      root: link("/api/v1"),
      activePresentation: link(`/api/v1/presentations/${presentations.activePresentationId}`)
    },
    presentations: presentations.presentations.map((presentation) => ({
      ...presentation,
      links: {
        self: link(`/api/v1/presentations/${presentation.id}`)
      }
    })),
    actions: [
      action({
        effect: "write",
        href: "/api/presentations",
        id: "create-presentation",
        input: "createPresentationRequest",
        label: "Create presentation",
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createPresentationResource(presentationId) {
  const presentations = listPresentations();
  const summary = readPresentationSummary(presentationId);
  const deckContext = readPresentationDeckContext(presentationId);
  const slides = getSlides({ presentationId });
  const presentationVersion = getPresentationVersion(presentationId);
  const isActive = presentations.activePresentationId === presentationId;
  const canDelete = presentations.presentations.length > 1;
  const actions = [
    action({
      baseVersion: presentationVersion,
      effect: "candidate",
      href: "/api/operations/ideate-deck-structure",
      id: "generate-deck-structure-candidates",
      input: "deckStructureWorkflowRequest",
      label: "Generate deck structure candidates",
      links: {
        diagnostics: link("/api/runtime"),
        result: link(`/api/v1/presentations/${presentationId}`)
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      baseVersion: presentationVersion,
      effect: "write",
      href: "/api/context",
      id: "save-deck-context",
      input: "deckContextUpdateRequest",
      label: "Save deck context",
      method: "POST",
      scope: "deck"
    }),
    action({
      effect: "read",
      href: "/api/validate",
      id: "run-validation",
      input: "validateDeckRequest",
      label: "Run validation",
      links: {
        diagnostics: link("/api/runtime")
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      effect: "export",
      href: "/api/build",
      id: "export-pdf",
      input: "emptyRequest",
      label: "Export PDF",
      links: {
        diagnostics: link("/api/runtime"),
        result: link("/api/preview/deck")
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      baseVersion: presentationVersion,
      effect: "write",
      href: "/api/presentations/duplicate",
      id: "duplicate-presentation",
      input: "presentationIdRequest",
      label: "Duplicate presentation",
      method: "POST",
      scope: "deck"
    })
  ];

  if (!isActive) {
    actions.unshift(action({
      effect: "write",
      href: "/api/presentations/select",
      id: "select-presentation",
      input: "presentationIdRequest",
      label: "Select presentation",
      method: "POST",
      scope: "deck"
    }));
  }

  if (canDelete) {
    actions.push(action({
      baseVersion: presentationVersion,
      effect: "destructive",
      href: "/api/presentations/delete",
      id: "delete-presentation",
      input: "presentationIdRequest",
      label: "Delete presentation",
      method: "POST",
      scope: "deck"
    }));
  }

  return {
    resource: "presentation",
    version: API_VERSION,
    id: presentationId,
    state: {
      active: isActive,
      baseVersion: presentationVersion,
      slideCount: slides.length,
      title: summary.title,
      updatedAt: summary.updatedAt
    },
    presentation: summary,
    deckContext,
    slides: slides.map((slide) => ({
      id: slide.id,
      index: slide.index,
      skipped: slide.skipped,
      title: slide.title,
      links: {
        self: link(`/api/v1/presentations/${presentationId}/slides/${slide.id}`),
        preview: link(`/api/preview/slide/${slide.index}`),
        spec: link(`/api/slides/${slide.id}`)
      }
    })),
    links: {
      self: link(`/api/v1/presentations/${presentationId}`),
      root: link("/api/v1"),
      presentations: link("/api/v1/presentations"),
      slides: link(`/api/v1/presentations/${presentationId}/slides`),
      selectedSlide: slides[0] ? link(`/api/v1/presentations/${presentationId}/slides/${slides[0].id}`) : null,
      deckContext: link("/api/context"),
      sources: link("/api/sources"),
      materials: link("/api/materials"),
      checks: link("/api/validate"),
      exports: link("/api/build"),
      present: link(`/present/${presentationId}`)
    },
    actions
  };
}

function createSlideCollectionResource(presentationId) {
  const presentation = createPresentationResource(presentationId);

  return {
    resource: "slideCollection",
    version: API_VERSION,
    state: {
      presentationId,
      count: presentation.slides.length,
      baseVersion: presentation.state.baseVersion
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides`),
      presentation: link(`/api/v1/presentations/${presentationId}`)
    },
    slides: presentation.slides,
    actions: [
      action({
        baseVersion: presentation.state.baseVersion,
        effect: "write",
        href: "/api/slides/system",
        id: "create-system-slide",
        input: "createSystemSlideRequest",
        label: "Create slide",
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createSlideResource(presentationId, slideId) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  const slideSpec = readSlideSpec(slideId, { presentationId });
  const variants = listVariantsForSlide(slideId);
  const slideVersion = getSlideVersion(presentationId, slideId);
  const activeSlides = getSlides({ presentationId });
  const actions = [
    action({
      baseVersion: slideVersion,
      effect: "candidate",
      href: "/api/operations/ideate-slide",
      id: "generate-wording-candidates",
      input: "slideWorkflowRequest",
      label: "Generate wording candidates",
      links: {
        diagnostics: link("/api/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "candidate",
      href: "/api/operations/ideate-structure",
      id: "generate-structure-candidates",
      input: "slideWorkflowRequest",
      label: "Generate structure candidates",
      links: {
        diagnostics: link("/api/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "candidate",
      href: "/api/operations/redo-layout",
      id: "generate-layout-candidates",
      input: "slideWorkflowRequest",
      label: "Generate layout candidates",
      links: {
        diagnostics: link("/api/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "write",
      href: `/api/slides/${slideId}/slide-spec`,
      id: "save-slide-spec",
      input: "slideSpecUpdateRequest",
      label: "Save slide spec",
      method: "POST",
      scope: "slide"
    }),
    action({
      effect: "read",
      href: "/api/validate",
      id: "run-validation",
      input: "validateDeckRequest",
      label: "Run validation",
      links: {
        diagnostics: link("/api/runtime")
      },
      method: "POST",
      scope: "slide"
    })
  ];

  if (variants.length) {
    actions.push(action({
      baseVersion: slideVersion,
      effect: "write",
      href: "/api/variants/apply",
      id: "apply-candidate",
      input: "variantApplyRequest",
      label: "Apply candidate",
      links: {
        compare: link(`/api/slides/${slideId}`),
        preview: link(`/api/preview/slide/${slide.index}`)
      },
      method: "POST",
      scope: "candidate"
    }));
  }

  if (!slide.archived && activeSlides.length > 1) {
    actions.push(action({
      baseVersion: slideVersion,
      effect: "destructive",
      href: "/api/slides/delete",
      id: "delete-slide",
      input: "slideIdRequest",
      label: "Delete slide",
      method: "POST",
      scope: "slide"
    }));
  }

  return {
    resource: "slide",
    version: API_VERSION,
    id: slideId,
    state: {
      archived: slide.archived,
      baseVersion: slideVersion,
      family: slideSpec.type || "unknown",
      index: slide.index,
      skipped: slide.skipped,
      validation: "unknown"
    },
    slide: {
      id: slide.id,
      index: slide.index,
      title: slide.title
    },
    slideSpec,
    variants,
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`),
      presentation: link(`/api/v1/presentations/${presentationId}`),
      preview: link(`/api/preview/slide/${slide.index}`),
      spec: link(`/api/slides/${slideId}`),
      checks: link("/api/validate"),
      candidates: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates`),
      workflows: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/workflows`)
    },
    actions
  };
}

function createCandidateCollectionResource(presentationId, slideId) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  const slideVersion = getSlideVersion(presentationId, slideId);
  const variants = listVariantsForSlide(slideId);

  return {
    resource: "candidateCollection",
    version: API_VERSION,
    state: {
      presentationId,
      slideId,
      count: variants.length,
      baseVersion: slideVersion
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates`),
      slide: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`),
      compare: link(`/api/slides/${slideId}`),
      preview: link(`/api/preview/slide/${slide.index}`)
    },
    candidates: variants.map((variant) => ({
      id: variant.id,
      operation: variant.operation || "",
      summary: variant.summary || "",
      title: variant.title || "",
      links: {
        self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates/${variant.id}`),
        compare: link(`/api/slides/${slideId}`),
        preview: link(`/api/preview/slide/${slide.index}`),
        applyTarget: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      }
    })),
    actions: []
  };
}

function createCandidateResource(presentationId, slideId, candidateId) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  const variant = listVariantsForSlide(slideId).find((entry) => entry.id === candidateId);
  if (!variant) {
    throw new Error(`Unknown candidate: ${candidateId}`);
  }

  const slideVersion = getSlideVersion(presentationId, slideId);

  return {
    resource: "candidate",
    version: API_VERSION,
    id: candidateId,
    state: {
      presentationId,
      slideId,
      baseVersion: slideVersion
    },
    candidate: variant,
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates/${candidateId}`),
      candidates: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates`),
      slide: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`),
      preview: link(`/api/preview/slide/${slide.index}`),
      compare: link(`/api/slides/${slideId}`),
      diagnostics: link("/api/runtime"),
      applyTarget: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
    },
    actions: [
      action({
        baseVersion: slideVersion,
        effect: "write",
        href: "/api/variants/apply",
        id: "apply-candidate",
        input: "variantApplyRequest",
        label: "Apply candidate",
        links: {
          compare: link(`/api/slides/${slideId}`),
          preview: link(`/api/preview/slide/${slide.index}`),
          result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
        },
        method: "POST",
        scope: "candidate"
      })
    ]
  };
}

function createSlideWorkflowResource(presentationId, slideId) {
  const slide = createSlideResource(presentationId, slideId);

  return {
    resource: "slideWorkflowCollection",
    version: API_VERSION,
    state: {
      presentationId,
      slideId,
      baseVersion: slide.state.baseVersion
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/workflows`),
      slide: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
    },
    actions: slide.actions.filter((entry) => entry.effect === "candidate")
  };
}

function createSchemaResource() {
  return {
    resource: "schemaCollection",
    version: API_VERSION,
    links: {
      self: link("/api/v1/schemas"),
      root: link("/api/v1")
    },
    schemas: [
      { id: "emptyRequest" },
      { id: "createPresentationRequest" },
      { id: "presentationIdRequest" },
      { id: "createSystemSlideRequest" },
      { id: "deckContextUpdateRequest" },
      { id: "deckStructureWorkflowRequest" },
      { id: "slideIdRequest" },
      { id: "slideSpecUpdateRequest" },
      { id: "slideWorkflowRequest" },
      { id: "validateDeckRequest" },
      { id: "variantApplyRequest" }
    ]
  };
}

module.exports = {
  assertBaseVersion,
  createApiRootResource,
  createCandidateCollectionResource,
  createCandidateResource,
  createPresentationCollectionResource,
  createPresentationResource,
  createSchemaResource,
  createSlideCollectionResource,
  createSlideResource,
  createSlideWorkflowResource,
  getPresentationVersion,
  getSlideVersion
};
