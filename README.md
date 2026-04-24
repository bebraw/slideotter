# slideotter

<img src="docs/assets/slideotter-logo.svg" alt="slideotter logo" width="420">

slideotter is a local, DOM-first presentation workbench for structured decks. It keeps slide content, previews, workflow actions, variant review, and validation in one browser loop so deck changes can move from intent to checked output without losing the source.

It is not a PowerPoint replacement and not a broad WYSIWYG editor. The project focuses on pragmatic authoring support for decks that are already structured enough to render, compare, and validate reliably.

## What It Does

- Edits supported slides from compact JSON slide specs.
- Renders the active deck through one shared DOM runtime for studio previews, thumbnails, comparison panes, preview PNGs, and PDF export.
- Supports direct text edits from the rendered slide preview for structured slides.
- Generates slide and deck-planning candidates through local rules or an optional LLM provider.
- Keeps generated candidates previewable, comparable, and safely applicable before they overwrite the working slide.
- Shows visual and structured comparisons for slide candidates and larger deck plans.
- Runs geometry, text, media, deck-plan, and render-baseline validation through the same quality gate used by the CLI.

## Current Demo

The repository includes a four-slide demo deck that explains the project itself:

- `slides/slide-01.json`: project framing
- `slides/slide-02.json`: workflow outline
- `slides/slide-03.json`: architecture signals
- `slides/slide-04.json`: summary and next steps

Current local PDF output is written to `slides/output/demo-presentation.pdf`. The checked-in archive copy lives at `archive/demo-presentation.pdf`.

## Browser Studio

The local studio lives under `studio/` and runs as a small Node server with a static browser client.

![Browser studio screenshot](docs/assets/studio-home.png)

The UI currently includes:

- a compact sticky navigation with the project name first
- active slide preview and thumbnail navigation
- collapsible selected-slide context
- direct slide-text editing from the DOM preview
- workflow chat with optional selected-text context from the current slide
- slide candidate generation, review, visual comparison, and apply controls
- deck planning with manual system-slide insertion and removal, compact plan summaries, palette controls, and apply previews
- validation console with compact settings and discoverable rule severity overrides

The same DOM renderer is also exposed as a standalone deck preview at `/deck-preview` while the studio server is running.

## Repository Map

- `slides/`: active demo deck slide specs
- `studio/client/`: browser UI and shared DOM slide renderer
- `studio/server/`: local server, workflow actions, export, validation, write boundary, and LLM integration
- `studio/state/`: repo-local deck context, validation settings, assistant sessions, and related state
- `studio/baseline/`: approved render-baseline images for visual regression checks
- `scripts/`: CLI wrappers for build, validation, diagram rendering, and baseline refresh
- `skills/`: presentation-focused Codex workflow guidance
- `docs/adr/`: durable studio decisions

## Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md): local setup, commands, validation, LLM provider setup, and workflow rules
- [ARCHITECTURE.md](ARCHITECTURE.md): current rendering, build, validation, and artifact architecture
- [TECHNICAL.md](TECHNICAL.md): lower-level technical notes and project layout
- [ROADMAP.md](ROADMAP.md): current architecture direction and next maintenance focus
- [STUDIO_STATUS.md](STUDIO_STATUS.md): live implementation snapshot
