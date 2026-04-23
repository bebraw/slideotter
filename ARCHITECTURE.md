# Architecture

This document explains how the repository currently assembles, previews, validates, and publishes the demo deck.

The repo is now DOM-first for active authoring and PDF output. Slide-spec JSON under `slides/` is the content model, `studio/client/slide-dom.js` is the shared renderer, and Playwright is the export and validation runtime around that renderer.

## Overview

There are now three layers:

1. `slides/*.json` holds the active slide content model for supported slide families.
2. `studio/client/slide-dom.js` renders those slide specs into a shared HTML/CSS slide runtime.
3. Playwright-backed server services turn that same runtime into PDFs, preview PNGs, and validation inputs.

The older generator-side slide drawing path has been removed. The remaining `generator/` layer now exists mainly for CLI entrypoints, shared deck settings, and raster-baseline comparison.

## System Graph

```mermaid
flowchart TD
    package["package.json scripts"] --> build["npm run build"]
    package --> validate["npm run validate"]
    package --> gate["npm run quality:gate"]
    package --> baseline["npm run baseline:render"]
    package --> studio["npm run studio:start"]

    subgraph content["Content Layer"]
        slides["slides/slide-01.json ... slide-04.json"]
        state["studio/state/*.json"]
    end

    subgraph dom["DOM Runtime"]
        slideDom["studio/client/slide-dom.js"]
        preview["studio/server/services/dom-preview.js"]
        export["studio/server/services/dom-export.js"]
        validateDom["studio/server/services/dom-validate.js"]
        buildSvc["studio/server/services/build.js"]
        validateSvc["studio/server/services/validate.js"]
        pageArtifacts["studio/server/services/page-artifacts.js"]
    end

    subgraph generator["Generator / Legacy Layer"]
        compile["generator/compile.js"]
        renderUtils["generator/baseline-utils.js"]
        render["generator/validate-render.js"]
        baselineUpdate["generator/update-render-baseline.js"]
        diagrams["generator/render-diagrams.js"]
        theme["generator/theme.js"]
    end

    subgraph artifacts["Artifacts"]
        pdf["slides/output/demo-presentation.pdf"]
        previews["studio/output/**"]
        baselineFiles["generator/render-baseline/*.png"]
        diffs["slides/output/render-diff/*.png"]
        archive["archive/demo-presentation.pdf"]
    end

    slides --> slideDom
    state --> preview
    theme --> preview
    preview --> export
    preview --> validateDom
    slideDom --> export
    slideDom --> validateDom
    export --> pdf
    export --> previews
    pageArtifacts --> previews

    studio --> buildSvc
    studio --> validateSvc
    buildSvc --> export
    validateSvc --> validateDom
    validateSvc --> renderUtils

    build --> diagrams
    build --> compile
    compile --> export

    validate --> diagrams
    validate --> validateDom

    gate --> render
    render --> renderUtils
    renderUtils --> pdf
    render --> baselineFiles
    render --> diffs

    baseline --> baselineUpdate
    baselineUpdate --> renderUtils
    baselineUpdate --> baselineFiles

    pdf -. manual archive refresh .-> archive
```

## Main Concepts

### Slide Spec Layer

Supported slides are authored as JSON documents in `slides/`. Each document contains the active slide spec and, for structured slides, any preserved named variants.

The supported families currently include:

- `cover`
- `toc`
- `content`
- `summary`

The studio reads and writes these specs directly. That is the primary authoring model now.

### Shared DOM Renderer

`studio/client/slide-dom.js` is the shared rendering runtime. It is used in three places:

- browser preview surfaces inside the studio
- standalone `/deck-preview` rendering on the server
- Playwright-driven export and validation

This keeps preview and PDF output on the same layout path instead of maintaining a separate legacy renderer for active workflows.

### Playwright Runtime

`studio/server/services/dom-export.js` renders the shared DOM runtime in headless Chromium to produce:

- the final deck PDF
- single-slide preview PNGs
- contact sheets and preview strips around those images

`studio/server/services/dom-validate.js` uses the same browser runtime to inspect layout results for geometry and text checks.

### Generator / Baseline Layer

The `generator/` directory still exists, but its role is narrower than before:

- `generator/compile.js` is still the CLI entrypoint, but it now delegates to the DOM export path
- `generator/validate-render.js` and `generator/update-render-baseline.js` still own raster-baseline comparison
- `generator/baseline-utils.js` now owns PDF rasterization and image comparison for that baseline gate
- `generator/theme.js` and `generator/design-constraints.js` still provide shared deterministic deck settings consumed by the DOM path

## Build Flow

The build path is now:

1. `npm run build` regenerates any Graphviz-authored diagrams through `generator/render-diagrams.js`.
2. `npm run build` then runs `generator/compile.js`.
3. `compile.js` collects the DOM preview state and calls the Playwright-backed export path.
4. The shared DOM renderer writes the final PDF to `slides/output/demo-presentation.pdf`.

## Validation Flow

There are now two active validation layers.

### Geometry And Text Validation

`npm run validate` runs:

- `generator/render-diagrams.js`
- `generator/validate-geometry.js`
- `generator/validate-text.js`

The geometry and text entrypoints now call `studio/server/services/dom-validate.js`, which evaluates the shared DOM slide runtime in Playwright and reports:

- bounds issues
- panel text padding issues
- minimum font-size issues
- maximum words-per-slide issues

This is the same validation path used by the studio server.

### Render Validation

`npm run validate:render` still checks the final PDF visually against the approved raster baseline:

1. build the current PDF through the DOM export path
2. rasterize the PDF pages with ImageMagick through `generator/baseline-utils.js`
3. compare the rasterized pages to `generator/render-baseline/*.png`
4. write diffs under `slides/output/render-diff/` when pages drift

`npm run quality:gate` runs the DOM geometry/text validators first and then this render-baseline gate.

## Studio Runtime

The local studio under `studio/` is now a control plane around the shared DOM renderer:

- `studio/server/services/build.js` rebuilds the PDF and preview images
- `studio/server/services/validate.js` runs DOM validation and, optionally, the render-baseline gate
- `studio/server/services/operations.js` manages variant generation, deck plans, apply flows, and transient preview artifacts
- `studio/server/services/page-artifacts.js` now owns generic page-listing and contact-sheet work for studio-side preview flows, instead of reaching into generator helpers for that concern

## Baseline And Archive

The repo still keeps two long-lived output types:

- `generator/render-baseline/` is the approved visual regression target
- `archive/demo-presentation.pdf` is the checked-in presentation snapshot for linking and archival

They serve different roles. Refreshing the render baseline is part of intentional visual changes. Refreshing the archive is a separate publishing decision.

## Extension Points

If you are extending the current system, the normal entry points are now:

- add or refine supported slide rendering in `studio/client/slide-dom.js`
- add or refine server-side export behavior in `studio/server/services/dom-export.js`
- deepen DOM validation in `studio/server/services/dom-validate.js`
- update deck-level metadata and theme resolution in `studio/server/services/state.js` and `generator/theme.js`
- change raster-baseline comparison behavior in `generator/baseline-utils.js` and `generator/validate-render.js`

## Migration Direction

The remaining cleanup direction is:

- deepen DOM validation where the older generator checks still covered useful layout-specific signals
- keep the baseline-comparison utilities narrow instead of growing another generic preview-helper layer under `generator/`
- keep architecture docs aligned so the DOM runtime is described as the primary system, not as a preview sidecar
