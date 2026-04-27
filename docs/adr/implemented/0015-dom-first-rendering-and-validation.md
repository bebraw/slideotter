# ADR 0015: DOM-First Rendering And Validation

## Status

Implemented.

## Context

slideotter previously had pressure to grow separate paths for browser preview, PDF export, thumbnails, presentation mode, and validation. That would make presentation output harder to reason about: a slide could look correct in the studio but fail in export, or pass source-coordinate checks while the rendered PDF still looked cramped.

The browser studio is now built around a shared DOM runtime. Supported slide specs render through the same DOM code in the authoring preview, compare views, thumbnail surfaces, standalone deck preview, browser presentation mode, PDF export, PNG preview artifacts, and validation fixtures.

This decision is fundamental enough that it should live as an implemented ADR rather than only as status prose.

## Decision

Use the shared DOM renderer as the authoritative presentation runtime.

The studio should not introduce a second long-lived rendering path for supported slide families. Browser preview, `/deck-preview`, `/present`, PDF export, preview PNG generation, CLI builds, text validation, geometry validation, media validation, and render-baseline validation should all exercise the same rendered DOM output.

Source coordinates and schema checks remain useful, but visual acceptance is based on rendered output.

## Runtime Rules

- Structured slide specs remain the source content model.
- The DOM runtime materializes slide specs, deck context, theme values, media references, and layout treatments.
- The studio preview and comparison surfaces use the same renderer as export.
- The CLI PDF build uses Playwright against the DOM preview path.
- Validation inspects rendered DOM geometry and text, not only source JSON coordinates.
- Render-baseline validation compares rasterized DOM-built PDFs against approved baseline PNGs.
- Browser presentation mode builds on the same renderer rather than using a presentation-only slide implementation.

## Validation Rules

The quality gate should continue to cover:

- TypeScript type checks.
- schema validation for supported slide specs and layout treatments.
- DOM geometry checks.
- DOM text and fit checks.
- media loading, bounds, distortion, caption/source attachment, and progress-area spacing checks.
- browser workflow fixtures that use the real studio server and renderer.
- render-baseline checks for intentional visual changes.

When slide, media, theme, or layout behavior changes intentionally, the rendered PDF and baseline artifacts should be refreshed through the existing commands rather than accepted from source-coordinate reasoning alone.

## Consequences

### Positive

- Preview, export, presentation mode, and validation are less likely to drift.
- Slide design problems are caught from the same output users see.
- New slide families and layout treatments have one primary rendering integration point.
- PDF and browser behavior stay easier to debug because they share the DOM surface.

### Negative

- Validation depends on browser rendering and is slower than pure schema checks.
- Playwright and browser runtime behavior become part of the local build assumptions.
- Renderer changes can affect many surfaces at once, so fixture coverage and baseline updates matter.

## Maintenance Notes

- Keep new supported slide families in the shared DOM renderer.
- Do not add a parallel PDF-only renderer for convenience.
- Treat browser screenshot/PDF inspection as the final arbiter for layout spacing issues.
- If a future non-DOM renderer is ever required, it should be introduced through a new ADR with a clear migration and drift-prevention strategy.
