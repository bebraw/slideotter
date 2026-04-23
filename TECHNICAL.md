# Technical Notes

This document contains the development-facing details for the presentation template repository.

For the system-level view of how build, rendering, validation, and archival fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).
For future packaging thoughts about the runtime layer, see the "Future Option: Extract A Runtime Package" section in [ARCHITECTURE.md](ARCHITECTURE.md).

## Usage

Install dependencies:

```bash
npm install
```

Build the presentation:

```bash
npm run build
```

Run DOM-backed geometry and text validation:

```bash
npm run validate
```

Run the full validation suite, including render validation:

```bash
npm run validate:all
```

Run the project quality gate used after changes:

```bash
npm run quality:gate
```

Refresh the committed render baseline after intentionally changing the deck design:

```bash
npm run baseline:render
```

If you add presentation diagrams or other deck graphics, author them as Graphviz `.dot` files in `slides/assets/diagrams/`. The build regenerates sibling `.png` files automatically through `npm run build:diagrams`, and validation rejects generated diagram PNGs that do not have matching `.dot` sources.

## Development Layout

- `slides/slide-01.json` to `slides/slide-04.json` hold the demo deck content.
- `studio/` holds the browser studio, shared DOM renderer, Playwright export path, and DOM validation runtime.
- `scripts/` now holds CLI build, validation, diagram, and baseline commands while shared deck settings and baseline utilities live under `studio/server/services/`.
- `skills/pdf-slide-generator/SKILL.md` contains the deck-generation workflow guidance.
- `skills/slide-clarity-drill/` contains the wording-tightening skill used for line-by-line slide copy refinement.
- `archive/demo-presentation.pdf` stores the checked-in PDF snapshot for linking and archival.

## Project Structure

```text
.
├── archive/
│   └── demo-presentation.pdf
├── ARCHITECTURE.md
├── package.json
├── README.md
├── scripts/
│   ├── build-deck.js
│   ├── render-diagrams.js
│   ├── update-render-baseline.js
│   ├── validate-geometry.js
│   ├── validate-render.js
│   └── validate-text.js
├── STUDIO_STATUS.md
├── TECHNICAL.md
├── skills/
│   ├── pdf-slide-generator/
│   │   └── SKILL.md
│   └── slide-clarity-drill/
│       ├── agents/
│       │   └── openai.yaml
│       └── SKILL.md
├── slides/
│   ├── assets/
│   │   └── diagrams/
│   ├── output/
│   ├── slide-01.json
│   ├── slide-02.json
│   ├── slide-03.json
│   └── slide-04.json
└── studio/
    ├── baseline/
    ├── client/
    ├── output/
    ├── server/
    │   └── services/
    └── state/
```

## Notes

- Slide content lives in `slides/`, while the active authoring/runtime path now lives primarily in `studio/`.
- Diagram graphics in `slides/assets/diagrams/` must come from Graphviz `.dot` sources; do not hand-maintain the generated PNGs.
- The production build path now renders PDF through Playwright and the shared DOM slide renderer.
- The deck uses `Avenir Next` for both display and body text.
- Shared palette, deck metadata, design constraints, and output config now live under `studio/server/services/`, while the authoritative slide layout/runtime lives in `studio/client/slide-dom.js`.
- `slides/output/` is git-ignored, so generated binaries stay local.
- `archive/demo-presentation.pdf` stores the checked-in PDF snapshot for linking and archival.
- `studio/baseline/` stores the approved render baseline for the current deck output.
- `npm run quality:gate` runs DOM-backed geometry/text validation before checking the generated PDF against the approved render baseline.
- If you extend the deck, follow the JSON slide-spec path and keep new runtime work on the DOM path rather than reintroducing generator-side slide drawing.
