# ADR 0018: Rich Slide Families And Layout Library Baseline

## Status

Implemented baseline.

## Context

ADR 0005 proposed richer slide families and reusable layout definitions. Several parts of that direction are now shipped: first-class divider, quote, photo, and photo-grid slides; optional multi-image `mediaItems`; deck-local and favorite layout libraries; portable layout JSON exchange; and layout/family-changing candidates that stay inside the compare/apply workflow.

ADR 0005 now remains proposed only for richer generated layout-definition workflows beyond this shipped baseline.

## Decision

Support a richer structured slide and layout baseline while preserving the guarded slide-spec model.

The studio supports common presentation intentions through named slide families instead of hiding them behind generic content slides or renderer-specific layout hacks. Layout treatments can be saved, reused, imported, exported, and proposed as candidates, but they remain validated JSON data rather than executable renderer code.

## Implemented Slide Families

The supported structured slide families include:

- `cover`
- `divider`
- `quote`
- `photo`
- `photoGrid`
- `toc`
- `content`
- `summary`

Divider slides provide section transitions. Quote slides render a dominant quote with optional attribution, source, and context. Photo slides render one dominant material image with attached caption/source text. Photo-grid slides render two to four material images with attached captions.

## Layout Library Rules

- Deck-local layout definitions persist under the presentation's state directory.
- Favorite layouts persist in ignored runtime state for reuse across presentations.
- Layout definitions use portable JSON document shapes.
- Single-layout and layout-pack exchange should validate imported data and normalize duplicate ids before save.
- Slide specs may carry optional validated layout treatments.
- Layout candidates remain session-only until applied or explicitly saved.
- Redo Layout can propose compatible saved layouts through the same candidate review surface as generated layout variants.
- Candidates can be saved directly to deck-local or favorite layout libraries before applying.

## Generation And Review Rules

- Family-changing candidates must explicitly label the old and new slide family.
- Local validated transforms materialize supported family changes from intent metadata.
- The compare/apply surface must show dropped, preserved, and transformed fields before apply.
- Generated split-photo/photo-grid layout candidates should carry reusable arrangement definitions when possible.
- No layout definition may execute arbitrary HTML, CSS, SVG, JavaScript, or hidden runtime code.

## Validation Rules

Validation should cover:

- schema validity for each supported slide family.
- known layout treatments.
- `mediaItems` references and per-item metadata.
- media bounds, loading, distortion, caption/source attachment, and progress-area spacing.
- text fit and geometry for rich slide families.
- layout import/export document shapes.
- candidate materialization before preview/apply.

## Consequences

### Positive

- Authors can create common slide intentions directly.
- Rich media slides stay inside the presentation material library and validation boundary.
- Layout reuse becomes a product workflow rather than hardcoded renderer behavior.
- Candidate review remains consistent even when the slide family changes.

### Negative

- The slide schema and validation matrix are broader.
- Layout-library state needs compatibility handling as definitions evolve.
- Richer generated layout-definition workflows still need their own implementation slices.

## Maintenance Notes

- Keep ADR 0005 as the future-direction record for generated layout definitions beyond this baseline.
- Keep rich slide families declarative and renderer-owned.
- Prefer adding named structured families or validated layout definitions over arbitrary per-slide positioning.
