# ADR 0003: Presentation Material Library

## Status

Implemented.

## Context

slideotter now supports multiple presentations, each with its own slides and deck-local state under `presentations/<id>/`. Structured slides can be edited from JSON and rendered through the shared DOM runtime, but there is no first-class path for application-provided material such as images. Without that path, authors either need to hand-edit arbitrary file references or keep visual assets outside the same guarded workflow as slide specs.

## Decision

Add a per-presentation material library:

- material files live under `presentations/<id>/materials/`
- material metadata lives in `presentations/<id>/state/materials.json`
- the studio server owns upload, registry updates, and static serving
- structured slide specs may reference one attached material through an optional `media` object
- the DOM renderer materializes the optional `media` object as an image figure with alt text and caption/source text
- the Slide Studio UI exposes a compact material panel for upload, inspection, attach, and detach

The first implementation is intentionally narrow: image files only, one attached material per slide, no external URLs, and no bulk asset manager. This gives deck authors a safe material path while keeping the slide spec model understandable.

## Write Boundary

The write boundary expands deliberately to:

- `presentations/<id>/materials/**`
- `presentations/<id>/state/materials.json`

Material uploads should be validated by MIME type, decoded by the server, named with stable safe filenames, and served from a presentation-scoped URL. Slide specs store the served URL plus the material id so the DOM runtime can render without doing filesystem lookups.

## Consequences

- Images become part of the same presentation folder as slide content.
- Duplicating a presentation should copy its materials and material registry with the rest of the folder.
- Deleting a presentation removes its materials with the folder.
- Render validation can inspect attached material images through the existing DOM media checks.
- More advanced workflows such as multiple figures per slide, material tagging, screenshots, or generated image assets can build on the same registry later.
