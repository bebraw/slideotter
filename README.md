# slideotter

<img src="docs/assets/slideotter-logo.svg" alt="slideotter logo" width="420">

slideotter is a local presentation workbench for people who want a deck to stay editable, inspectable, and easy to validate while it changes.

It is built around a simple loop: write structured slide content, preview the deck in the browser, compare alternatives, apply the useful changes, and publish a checked PDF when the result is ready.

It is not trying to replace PowerPoint or become a general WYSIWYG editor. The focus is a quieter authoring environment for structured decks where repeatable checks matter.

## Start Here

Use the getting-started guide for installation, required tools, and the first local run:

[Getting Started](docs/GETTING_STARTED.md)

The short version:

```bash
npm install
npm run studio:start
```

Then open `http://127.0.0.1:4173`.

## What You Can Do

- Work on multiple local presentations.
- Set a target presentation length while creating a deck, then scale toward it without deleting skipped slides.
- Edit supported slides as readable JSON specs.
- Preview the active deck while you work.
- Attach image materials to slides.
- Generate local or LLM-assisted candidates.
- Compare candidate slides and deck plans before applying them.
- Validate layout, text, media references, workflow behavior, and rendered output.
- Build a PDF and refresh an archive copy when you are ready to publish.

## Studio

The browser studio is the main working surface.

![Browser studio screenshot](docs/assets/studio-home.png)

It includes presentation selection, slide preview, thumbnail navigation, material upload, candidate review, deck planning, validation settings, and light/dark mode.

## Included Demo

The repository includes a twenty-slide `slideotter` presentation that explains the tool and its workflow. Its source lives under `presentations/slideotter/`, and the generated PDF is written locally to `slides/output/slideotter.pdf`.

Checked-in archive snapshots live under `archive/`.

## Documentation

- [Getting Started](docs/GETTING_STARTED.md): required tools, setup, first run, and common commands
- [DEVELOPMENT.md](DEVELOPMENT.md): development workflow, validation, LLM setup, and slide workflow notes
- [ARCHITECTURE.md](ARCHITECTURE.md): rendering, export, validation, and artifact architecture
- [TECHNICAL.md](TECHNICAL.md): lower-level project layout notes
- [ROADMAP.md](ROADMAP.md): current product and architecture direction
- [STUDIO_STATUS.md](STUDIO_STATUS.md): live implementation snapshot
