# slideotter

> NOTE! This software is under heavy development right now, and I consider it alpha level so if you try it, expect to find bugs, underspecified features, and weird UI/UX solutions. I found that it works well with LM Studio (Qwen, Gemma) and most likely the other LLM connectors work as well. Likely foundation models work far better/faster, but the application has been designed with weak local models in mind.

<img src="docs/assets/slideotter-logo.svg" alt="slideotter logo" width="420">

slideotter is a local, DOM-first workbench for building structured presentations that stay editable, grounded, themed, reviewable, and archive-ready.

It is built around a simple loop: describe the deck, add sources and materials, approve an outline, draft slides progressively, preview the result in the browser, compare alternatives, tune the visual theme from a brief or site URL, apply the useful changes, and publish a checked PDF when the result is ready.

It is not trying to replace PowerPoint or become a general WYSIWYG editor. The focus is controlled generation and structured deck work where the source, review path, and final archive remain inspectable.

## Start Here

Use the getting-started guide for installation, required tools, and the first local run:

[Getting Started](docs/GETTING_STARTED.md)

The app workflow:

```bash
npm install
npx slideotter init --template tutorial
npx slideotter studio
```

Then open `http://127.0.0.1:4173`.

For repository development, the source-mode server is still available:

```bash
npm install
npm run studio:start
```

Docker is available for a one-command source-mode run:

```bash
docker compose up --build
```

Then open `http://127.0.0.1:4173`. The container stores mutable app data in the `slideotter_data` Docker volume and mounts the working tree for live source edits. To use LM Studio running on the host machine, start LM Studio's local server and run Compose with the loaded model id:

```bash
STUDIO_LLM_PROVIDER=lmstudio \
LMSTUDIO_MODEL=qwen/qwen3.5-9b \
docker compose up --build
```

The command stores mutable user data under `~/.slideotter` by default:

- presentations: `~/.slideotter/presentations/`
- app state: `~/.slideotter/state/`
- PDFs and previews: `~/.slideotter/output/`
- baselines: `~/.slideotter/baseline/`
- archives: `~/.slideotter/archive/`
- reusable libraries: `~/.slideotter/libraries/`

Inspect the resolved paths with:

```bash
npx slideotter data-dir
npx slideotter paths
```

Those commands do not create the data directory unless you pass `--ensure`:

```bash
npx slideotter data-dir --ensure
npx slideotter paths --ensure
```

Use `--data-dir /path/to/data` or `SLIDEOTTER_HOME=/path/to/data` to override the default location.

For LM Studio, start LM Studio's local server, load a model, then save the provider config into the slideotter data directory:

```bash
npx slideotter llm lmstudio --model qwen/qwen3.5-9b
npx slideotter llm status
```

Use the exact model id shown by LM Studio. If your LM Studio server is not on the default `http://127.0.0.1:1234`, pass `--base-url`:

```bash
npx slideotter llm lmstudio --model qwen/qwen3.5-9b --base-url http://127.0.0.1:1234
```

For higher-quality local narration, install the Piper executable on your system, then let slideotter download a voice model into the data directory:

```bash
npx slideotter tts voices
npx slideotter tts install en_US-amy-medium --bin /path/to/piper
npx slideotter tts status
```

Presentation mode uses cached Piper audio when local narration is configured, and falls back to the browser's built-in speech synthesis when it is not.

## What You Can Do

- Work on multiple local presentations with visual first-slide cards.
- Create a deck through a staged flow: brief, editable outline, live slide drafting, and theme selection.
- Seed new decks with target length, visual direction or a site URL, starter sources, optional starter images, and open-license image search.
- Scale a presentation semantically from the Slide Studio Outline drawer: shrink by skipping slides, grow by restoring skipped slides or adding detail slides.
- Edit supported slides as readable JSON specs, including cover, divider, quote, photo, photo-grid, table-of-contents, content, and summary slides.
- Preview the active deck while you work.
- Present the active deck from a browser playback surface, including core-path slides with optional vertical detours, local Piper narration when configured, and optional bundled comic narration avatars.
- Attach image materials to slides, provide a starter image, import sourced open-license images through Openverse or Wikimedia Commons, or search/import SVGL brand logos, including outline-stage logo suggestions when generated slide guidance names a brand logo.
- Ground generation with presentation-scoped notes, excerpts, URLs, and image material metadata.
- Generate first drafts with OpenAI, LM Studio, or OpenRouter, then review candidates before applying changes.
- Compare candidate slides and deck plans before applying them.
- Save and reuse deck-local or favorite layout treatments.
- Validate layout, text, media references, workflow behavior, and rendered output.
- Build a PDF and refresh an archive copy when you are ready to publish.
- Use the macOS Electron wrapper around the same local server/client runtime.
- Check the Cloudflare Workers hosting baseline for the hosted API/storage direction.

## Agent Skills

slideotter includes a repo-local [`slideotter-agent-commands`](skills/slideotter-agent-commands/SKILL.md) skill for working with external coding agents such as Codex, Claude Code, Cursor, or Gemini CLI. The skill lets those agents use the model access they already have for advanced deck workflows without requiring a separate slideotter model key.

The skill covers command recipes for creating decks, improving slides, applying review comments, finding logos, validating decks, repairing checks, exporting decks, and explaining deck state. It is intentionally packaged as guidance over slideotter's existing APIs, scripts, material imports, validation checks, candidate review, and apply boundaries; it is not a second direct slide-file mutation path.

Start with the [Agent Command Usage Tutorial](docs/AGENT_COMMAND_USAGE.md), then see [ADR 0055: Agent Command Mode](docs/adr/implemented/0055-agent-command-mode.md) for the product boundary and rationale.

## Studio

The browser studio is the main working surface.

![Browser studio screenshot](docs/assets/studio-home.png)

It includes presentation selection, slide preview, thumbnail navigation, browser presentation playback, source and material workflows, staged live creation, URL-aware theme extraction, candidate review, semantic length scaling and reusable outline plans through the Outline drawer, reusable layout libraries, validation settings, provider status, and light/dark mode.

## Included Demo

The repository includes a thirty-six-slide `slideotter` onboarding presentation that explains the tool, workflow, current architecture, and maintenance focus. Its source lives under `presentations/slideotter/`.

Repo scripts keep generated output in repo-local ignored paths such as `slides/output/` and `studio/output/`. The `slideotter` command writes generated output under the active user data root, normally `~/.slideotter/output/`.

Checked-in archive snapshots live under `archive/`.

## Documentation

- [Getting Started](docs/GETTING_STARTED.md): required tools, setup, first run, and common commands
- [Agent Command Usage Tutorial](docs/AGENT_COMMAND_USAGE.md): using external coding agents through guarded slideotter workflows
- [DEVELOPMENT.md](DEVELOPMENT.md): development workflow, validation, LLM setup, and slide workflow notes
- [Developer guides](docs/dev/README.md): focused maps for high-churn coding areas
- [Architecture](docs/ARCHITECTURE.md): rendering, generation, validation, and artifact architecture
- [Architecture Decision Records](docs/adr/README.md): implemented decisions and proposed architecture direction
- [Slidev comparison](docs/SLIDEV_COMPARISON.md): competitive notes for positioning slideotter against Slidev
- [Quarto comparison](docs/QUARTO_COMPARISON.md): observations from comparing Quarto and slideotter
- [Reveal.js comparison](docs/REVEALJS_COMPARISON.md): observations from comparing Reveal.js and slideotter
- [Open Slide comparison](docs/OPEN_SLIDE_COMPARISON.md): competitive notes for positioning slideotter against Open Slide
- [TECHNICAL.md](TECHNICAL.md): lower-level project layout notes
- [ROADMAP.md](ROADMAP.md): current product and architecture direction
- [STUDIO_STATUS.md](STUDIO_STATUS.md): live implementation snapshot

## License

[MIT](LICENSE)

## Current Engineering Shape

- The browser client loads through Vite and keeps `studio/client/app.ts` as a small composition shell.
- Feature behavior lives in typed modules for creation, editing, planning, variants, runtime diagnostics, preview, navigation, assistant actions, and exports.
- Strict TypeScript, explicit-any checks, fixture validation, browser workflow validation, and render-baseline validation are part of the quality gate.
- Local app mode stores mutable data under `~/.slideotter`; repo mode keeps the bundled tutorial and development fixtures in this repository.
