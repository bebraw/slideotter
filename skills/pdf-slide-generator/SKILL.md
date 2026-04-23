---
name: pdf-slide-generator
description: "Create and maintain this repository's presentation deck as native PDF output. Use when work involves slide content, deck structure, visual assets, the DOM-first runtime, render baselines, or validation for presentations, slides, decks, demos, or speaker materials."
license: MIT
metadata:
  version: "2.0"
  category: productivity
---

# PDF Slide Generator

Use this skill for presentation work in this repository.

## Scope

- Slide content lives in `slides/`.
- Active build, rendering, and validation runtime now flows through `studio/` plus the remaining baseline utilities in `generator/`.
- Primary output is `slides/output/demo-presentation.pdf`.
- Checked-in archive snapshot is `archive/demo-presentation.pdf`.
- Approved render baseline lives in `generator/render-baseline/`.

## Default Workflow

1. Determine whether the change belongs in slide content (`slides/`), the active DOM runtime (`studio/`), or the remaining CLI and baseline utilities (`generator/`).
2. Reuse the existing DOM-first runtime helpers instead of introducing parallel slide infrastructure.
3. Build with `npm run build`.
4. If the visible output changed intentionally, refresh the baseline with `npm run baseline:render`.
5. Finish by running `npm run quality:gate`.

Do not consider presentation work done unless `npm run quality:gate` passes.

## Editing Rules

- Keep one file per slide spec, following the existing naming pattern such as `slides/slide-05.json`.
- Prefer updating the existing shared design system in `studio/client/slide-dom.js`, `generator/theme.js`, and `generator/design-constraints.js` over slide-local style drift.
- Put presentation images in `slides/imgs/`.
- Keep generated artifacts in `slides/output/`.
- Treat `archive/demo-presentation.pdf` as a release snapshot. Update it only when the user asks for the archival copy to be refreshed.

## Validation Rules

- `npm run build` must produce the PDF successfully.
- `npm run quality:gate` is the required final validation.
- If slide visuals change intentionally, update `generator/render-baseline/` with `npm run baseline:render` before rerunning the gate.
- If `quality:gate` fails, fix the deck or baseline mismatch instead of bypassing the check.

## Structural Guidance

- Add new DOM-first build or validation logic under `studio/`, and keep `generator/` focused on the baseline gate unless there is a clear reason not to.
- Add new content slides under `slides/`.
- Keep slide specs dependent on shared runtime utilities rather than duplicating helpers.
- If the deck order changes, update the active slide indices or other live ordering source in the same change.

## Output Expectations

- Preserve the existing deck voice and visual language unless the user asks for a redesign.
- Optimize for a clean rendered PDF, not for PPTX compatibility.
- Keep documentation aligned with the current structure when scripts, directories, or validation commands change.
