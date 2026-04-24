# Technical Notes

This document contains lower-level technical notes for slideotter.

For the system-level view of how build, rendering, validation, and archival fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).
For future packaging thoughts about the runtime layer, see the "Future Option: Extract A Runtime Package" section in [ARCHITECTURE.md](ARCHITECTURE.md).
For day-to-day setup and commands, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Development Layout

- `presentations/slideotter/slides/slide-01.json` to `presentations/slideotter/slides/slide-20.json` hold the demo deck content.
- `studio/` holds the browser studio, shared DOM renderer, Playwright export path, and DOM validation runtime.
- `scripts/` now holds CLI build, validation, diagram, and baseline commands while shared deck settings and baseline utilities live under `studio/server/services/`.
- `skills/` contains presentation workflow guidance.
- `skills/slide-clarity-drill/` contains the wording-tightening skill used for line-by-line slide copy refinement.
- `archive/<presentation-id>.pdf` stores checked-in PDF snapshots for linking and archival.

## Project Structure

```text
.
├── archive/
│   └── ...
├── ARCHITECTURE.md
├── DEVELOPMENT.md
├── package.json
├── presentations/
│   └── slideotter/
│       ├── materials/
│       ├── presentation.json
│       ├── slides/
│       │   ├── slide-01.json
│       │   ├── slide-02.json
│       │   └── ...
│       └── state/
├── README.md
├── scripts/
│   ├── build-deck.ts
│   ├── render-diagrams.ts
│   ├── update-render-baseline.ts
│   ├── validate-geometry.ts
│   ├── validate-render.ts
│   └── validate-text.ts
├── STUDIO_STATUS.md
├── TECHNICAL.md
├── skills/
│   └── ...
├── slides/
│   └── output/
└── studio/
    ├── baseline/
    ├── client/
    ├── output/
    ├── server/
    │   └── services/
    └── state/
```

## Notes

- Slide content lives under `presentations/<id>/slides/`, uploaded image materials live under `presentations/<id>/materials/`, and the active authoring/runtime path now lives primarily in `studio/`.
- The production build path now renders PDF through Playwright and the shared DOM slide renderer.
- The deck uses `Avenir Next` for both display and body text.
- Shared palette, deck metadata, design constraints, and output config now live under `studio/server/services/`, while the authoritative slide layout/runtime lives in `studio/client/slide-dom.ts`.
- `slides/output/` is git-ignored, so generated per-presentation binaries stay local.
- `archive/<presentation-id>.pdf` stores checked-in PDF snapshots for linking and archival.
- `studio/baseline/<presentation-id>/` stores the approved render baseline for each deck output.
- `npm run quality:gate` runs DOM-backed geometry/text validation before checking the generated PDF against the approved render baseline.
- If you extend the deck, follow the JSON slide-spec path and keep new runtime work on the DOM path.
