# Development

This file contains development-facing workflow notes for slideotter. For required tools and first-run setup, see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

## Setup

After installing the hard dependencies from the getting-started guide, install project dependencies:

```bash
npm install
```

`npm install` also configures the repo-managed Git hooks in `.githooks/`. The pre-push hook runs `npm run quality:gate:fast` so local structural validation passes before code leaves the machine.

Start the local browser studio:

```bash
npm run studio:start
```

Then open:

```text
http://127.0.0.1:4173
```

The standalone DOM deck preview is available while the studio server is running:

```text
http://127.0.0.1:4173/deck-preview
```

## Common Commands

Build the deck PDF:

```bash
npm run build
```

Run geometry, text, media-fixture, and deck-plan validation:

```bash
npm run validate
```

Run the fast local quality gate used by the pre-push hook:

```bash
npm run quality:gate:fast
```

Run the full project quality gate, including render-baseline validation:

```bash
npm run quality:gate
```

Run the GitHub Actions workflow locally through Agent CI:

```bash
npm run ci:local
```

Docker must be running before `npm run ci:local`. The GitHub Actions workflow runs the fast deterministic gate; use `npm run quality:gate` locally when presentation output or baselines matter. Use `npm run ci:local:retry -- --name <runner-name>` to resume a paused Agent CI runner after a fix. Machine-local Agent CI overrides belong in `.env.agent-ci`; copy `.env.agent-ci.example` when you need to set `GITHUB_REPO`, `AGENT_CI_DOCKER_HOST`, or related Docker host settings.

Refresh the README studio screenshot:

```bash
npm run screenshot:home
```

Refresh the approved render baseline after an intentional visual change:

```bash
npm run baseline:render
```

## Output And Baselines

- `slides/output/<presentation-id>.pdf` is generated locally by `npm run build`; the included deck writes `slides/output/slideotter.pdf`.
- `slides/output/` is git-ignored.
- `studio/baseline/<presentation-id>/` stores approved render-baseline PNGs used by the visual regression gate.
- `docs/assets/studio-home.png` is refreshed manually by `npm run screenshot:home`.
- `archive/<presentation-id>.pdf` is the checked-in archive snapshot and should be refreshed only as a publishing decision with `npm run archive:update`.

When slide visuals or theme output intentionally change, run `npm run baseline:render` before `npm run quality:gate`.

The README screenshot refresh is local-only. The command starts or reuses the studio at `http://127.0.0.1:4173/`; override `SCREENSHOT_URL`, `SCREENSHOT_OUTPUT_PATH`, `SCREENSHOT_SERVER_COMMAND`, or `SCREENSHOT_SERVER_READY_URL` only when capturing a different local surface.

## LLM Provider Setup

The studio can use local rules, OpenAI, LM Studio, or OpenRouter for candidate generation. Provider selection happens on the studio server through environment variables. The browser still uses the same `Auto`, `Local`, and `LLM` generation modes.

The server loads repo-root `.env` and `.env.local` files automatically when you run `npm run studio:start` or `npm run studio:dev`.

- shell environment variables take precedence over `.env`
- `.env.local` can override `.env`
- copy `.env.example` to `.env` and fill in the provider you want to use
- use `Check LLM provider` in the studio workflow area before switching ideation to `LLM`

OpenAI example:

```dotenv
STUDIO_LLM_PROVIDER=openai
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-5.2
```

LM Studio example:

```dotenv
STUDIO_LLM_PROVIDER=lmstudio
LMSTUDIO_MODEL=openai/gpt-oss-20b
LMSTUDIO_BASE_URL=http://127.0.0.1:1234
```

OpenRouter example:

```dotenv
STUDIO_LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=openai/gpt-4o
OPENROUTER_APP_TITLE=slideotter
```

OpenRouter uses the OpenAI-compatible chat completions API at `https://openrouter.ai/api/v1` by default. You can set `OPENROUTER_HTTP_REFERER` and `OPENROUTER_APP_TITLE` to send the optional attribution headers OpenRouter documents for rankings and analytics.

Optional model override for any provider:

```dotenv
STUDIO_LLM_MODEL=openai/gpt-oss-20b
```

## Write Boundary

Studio writes are intentionally narrow and server-controlled. The current allowlist covers:

- slide files, material files, and per-presentation state under `presentations/<id>/`
- repo-local state files under `studio/state/*.json`
- generated workflow artifacts under `studio/output/**`

Keep new workflow write targets explicit instead of adding ad hoc file writes.

## Slide And Deck Workflow

For presentation changes:

- rebuild the deck after slide or theme changes
- run `npm run quality:gate` before considering work complete
- refresh `studio/baseline/<presentation-id>/` with `npm run baseline:render` when visible output changes intentionally
- keep `ROADMAP.md` and `STUDIO_STATUS.md` current for browser-studio product or workflow changes
- keep the project-story slides aligned when roadmap or outline structure changes

To add a system slide manually, open the studio's `Slide Studio` page, expand `Add system slide`, enter the title and summary, choose the insertion point, and create it. The server writes a new structured `presentations/<id>/slides/slide-*.json`, reindexes later slides, updates the saved outline, rebuilds previews, and selects the new slide for follow-up JSON editing.

To delete a slide manually, open `Slide Studio`, expand `Remove slide`, choose the slide, and remove it from the deck. The server archives the structured slide JSON with `archived: true`, reindexes the remaining active slides, updates the saved outline, rebuilds previews, and selects a neighboring slide.

To add an image material manually, open `Slide Studio`, expand `Materials`, choose a PNG, JPEG, GIF, or WebP image, fill in alt text and optional caption/source text, and upload it. The server stores the file under `presentations/<id>/materials/`, stores metadata in `presentations/<id>/state/materials.json`, and `Attach` writes a guarded `media` object into the selected structured slide spec.

If you add deck graphics, author them as DOT sources under `slides/assets/diagrams/`. The repo-local WebAssembly Graphviz renderer regenerates matching PNGs automatically during the build.

## Codex Skills

This repository includes presentation-focused workflow guidance under `skills/`.

Use the deck workflow for implementation, rendering, validation, and deck structure changes.

Use `slide-clarity-drill` when slide wording needs line-by-line tightening before editing the source.

Typical requests:

```text
Use slide-clarity-drill on slide 3.
```

```text
Tighten slide 2, then patch the slide and run the deck validation flow.
```
