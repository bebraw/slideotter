# Development

This file contains development-facing workflow notes for slideotter. For required tools and first-run setup, see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

For focused coding maps, use:

- [LLM generation guide](docs/dev/LLM_GENERATION.md) for prompt, schema, provider, source, and material generation work
- [Validation guide](docs/dev/VALIDATION.md) for targeted validation commands and quality-gate composition
- [Browser debugging guide](docs/dev/BROWSER_DEBUGGING.md) for loopback CDP setup and browser inspection

## Setup

Development, CI, and Docker currently use Node 24.15.0 with npm 11.12.1. This
exact pin is intentional: the immutable private Kirjolab paper-import package
has that engine contract. Run `nvm install && nvm use` before installing
dependencies. Do not bypass `engine-strict` to use a newer Node 24 minor.

After installing the hard dependencies from the getting-started guide, install project dependencies:

```bash
npm install
```

`npm install` also configures the repo-managed Git hooks in `.githooks/`. The pre-push hook runs `npm run quality:affected`, which narrows checks for documentation-only, test-only, and presentation-render-only changes while falling back to `npm run quality:gate:fast` for source and tooling changes.

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

## Docker Development

Use Docker when you want the exact Node 24.15.0, native package, and Playwright runtime setup managed by the project:

```bash
docker compose up --build
```

The Compose service runs `npm run studio:start`, exposes the studio on `http://127.0.0.1:4173`, stores app data in the `slideotter_data` volume, and keeps installed packages in the `slideotter_node_modules` volume.

After changing the pinned Node version or dependencies, refresh an existing
Compose dependency volume without touching presentation data:

```bash
docker compose run --rm studio npm ci
```

The first paper-import integration is a server-only, state-free adapter under
`studio/server/services/paper-import/`. Production code uses only
`@kirjolab/paper-import`; the package's `/conformance` export is test-only. The
adapter is not yet connected to Studio uploads, presentation state, cloud
Workers, or Electron.

For host-local LM Studio, point the provider at Docker's host alias:

```bash
STUDIO_LLM_PROVIDER=lmstudio \
LMSTUDIO_MODEL=qwen/qwen3.5-9b \
docker compose up --build
```

Use the model id shown by LM Studio. Keep `LMSTUDIO_BASE_URL=http://127.0.0.1:1234` for non-container runs. Compose sets the in-container `LMSTUDIO_BASE_URL` to `http://host.docker.internal:1234` by default; set `DOCKER_LMSTUDIO_BASE_URL` only when the host-side LM Studio URL is different.

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

Both quality-gate commands announce each phase and emit a 30-second heartbeat while a phase is still running. The fast gate stops after Oxlint correctness checks, typechecking, service coverage, and static/browser validation; the full gate adds render-baseline validation.

Run a Stryker mutation-test dry run after changing the mutation config or test command:

```bash
npm run test:mutation:dry
```

Run mutation testing for the configured sentinel scope:

```bash
npm run test:mutation
```

Mutation testing uses Stryker's command runner against `npm test`, TypeScript checker preflight for mutants, incremental result caching, and HTML/JSON reports under `reports/mutation/`. Because the repository uses Node's built-in test runner, Stryker cannot do per-test coverage optimization and reruns the configured command for each surviving candidate. The committed mutation scope is therefore a small deterministic sentinel set; expand `mutate` in `stryker.config.mjs` only when a new area has fast, stable unit coverage.

Validate Markdown documentation links:

```bash
npm run validate:docs
```

Run the GitHub Actions workflow locally through Local CI (the current upstream name for Agent CI):

```bash
npm run ci:local
```

Docker must be running before `npm run ci:local`. Run it as `rtk proxy npm run ci:local` when following this repository's RTK requirement so the schema-v1 NDJSON stream stays live. The stream reports run, job, step, pause, diagnostic, and completion events; exit code 77 means the named runner is paused for repair. Use `rtk proxy npm run ci:local:retry -- --name <runner-name>` after fixing it. Machine-local overrides belong in `.env.local-ci`; copy `.env.local-ci.example` and use `LOCAL_CI_DOCKER_HOST` or the other documented variables when needed.

Typechecking intentionally uses two compiler package names during the TypeScript 7 transition. `npm run typecheck` invokes the aliased TypeScript 7 compiler directly, while the canonical `typescript` dependency remains the TypeScript 6 compatibility package used by build, validation, and server modules that import the compiler API.

Refresh the README studio screenshot:

```bash
npm run screenshot:home
```

Refresh the approved render baseline after an intentional visual change:

```bash
npm run baseline:render
```

## Targeted Validation

Use focused checks while iterating, then run the full gate when the change affects behavior, rendering, presentation output, or shared validation.

- docs only: `npm run validate:docs`
- JavaScript or TypeScript changes: `npm run lint` and `npm run typecheck`
- service API changes: `npm run typecheck` and `npm test`
- service behavior or branch-heavy guard changes: `npm run test:mutation:dry`, then `npm run test:mutation` when the dry run is clean
- prompt, schema, or deck-plan changes: `npm run validate:deck-plan-fixture`
- slide spec, text, or geometry changes: `npm run validate:slide-spec-fixture`, `npm run validate:text`, and `npm run validate:geometry`
- media and caption changes: `npm run validate:media-fixture` and `npm run validate:slide-media-fixture`
- browser client source or CSS changes: `npm run studio:client:build`, `npm run validate:client-fixture`, and `npm run validate:browser:studio`
- presentation workflow, export, or playback changes: `npm run validate:browser:presentation`
- broad browser workflow changes: `npm run validate:browser`
- public website response or markup changes: `node --test tests/website-worker.test.ts` and `npm run website:check`; add `npm run website:audit` for mobile/desktop web-quality evidence
- visual output changes: `npm run baseline:render`, then `npm run quality:gate`

See [docs/dev/VALIDATION.md](docs/dev/VALIDATION.md) for the detailed command map.

## Coding Agent Model Guidance

Use `gpt-5.2` with medium reasoning for day-to-day work in this repository. It is the best default for documentation, ADRs, focused bug fixes, validation follow-up, small refactors, and ordinary code navigation.

Use `gpt-5.4` or `gpt-5.5` with high reasoning for substantial implementation work, especially changes that cross subsystem boundaries:

- LLM generation flow
- prompt, schema, or provider client changes
- browser workflow validation
- DOM rendering, export, or validation
- large service-file splits
- presentation storage or write-boundary behavior

Use `gpt-5.5` with high or xhigh reasoning for complex architecture work or risky refactors that need coordinated changes across ADRs, runtime behavior, tests, and UI workflows. Implementing ADR 0028 or ADR 0029 end to end belongs in this category.

Use `gpt-5.4-mini` with medium reasoning for narrow mechanical work such as small docs edits, fixture updates, search-and-summarize tasks, or local patches where the affected surface is obvious.

## Output And Baselines

- `slides/output/<presentation-id>.pdf` is generated locally by `npm run build`; the included deck writes `slides/output/slideotter.pdf`.
- `slides/output/` is git-ignored.
- `studio/baseline/<presentation-id>/` stores approved render-baseline PNGs used by the visual regression gate.
- `docs/assets/studio-home.png` is refreshed manually by `npm run screenshot:home`.
- `archive/<presentation-id>.pdf` is the checked-in archive snapshot and should be refreshed only as a publishing decision with `npm run archive:update`.

When slide visuals or theme output intentionally change, run `npm run baseline:render` before `npm run quality:gate`.

The README screenshot refresh is local-only. The command starts or reuses the studio at `http://127.0.0.1:4173/`; override `SCREENSHOT_URL`, `SCREENSHOT_OUTPUT_PATH`, `SCREENSHOT_SERVER_COMMAND`, or `SCREENSHOT_SERVER_READY_URL` only when capturing a different local surface.

## LLM Provider Setup

The studio can use local rules, OpenAI, OpenAI-compatible chat gateways, LM Studio, or OpenRouter for candidate generation. Provider selection happens on the studio server through environment variables. The browser still uses the same `Auto`, `Local`, and `LLM` generation modes.

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

OpenAI-compatible chat completions example:

```dotenv
STUDIO_LLM_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your-key-here
OPENAI_COMPATIBLE_BASE_URL=https://llm-gateway.example.test/api/v1
OPENAI_COMPATIBLE_MODEL=provider/model-id
```

The OpenAI-compatible provider uses `/chat/completions` with non-streaming JSON schema responses. Use it for gateways that implement the chat completions API but do not support OpenAI's `/responses` API.

### Local Codex gateway

The optional local Codex gateway lets the OpenAI-compatible provider use a separately authenticated Codex home. Codex supports either ChatGPT subscription login or API-key-backed login; slideotter does not receive or store either upstream credential. The direct `openai` provider above remains available when you want slideotter to call the Responses API with `OPENAI_API_KEY` itself.

Install Codex if needed, then authenticate a dedicated gateway home separately from your normal `~/.codex` storage and configuration:

```bash
mkdir -p "$HOME/.slideotter/codex-gateway"
CODEX_HOME="$HOME/.slideotter/codex-gateway" codex -c 'cli_auth_credentials_store="file"' login
```

This login command writes credentials to `<gateway-home>/auth.json` instead of a shared OS keyring. The launcher requires `auth.json` to be a regular file, and the gateway forces file-backed credential storage for the child process.

Use this Codex home only for gateway authentication and gateway-created session metadata. It must not contain `config.toml`, `requirements.toml`, `AGENTS.md`, `AGENTS.override.md`, `.agents/`, `plugins/`, `rules/`, `hooks/`, or custom skills. A `skills/` directory is allowed only when its sole child is the Codex-owned `.system/` directory. The gateway rejects other customization surfaces so personal Codex instructions, tools, MCP configuration, and skills cannot affect slide generation.

Choose a model available to that Codex account and a high-entropy local bearer token. The gateway loads the same `.env` and `.env.local` files as Studio, so configure both sides together in `.env.local`:

```dotenv
CODEX_GATEWAY_TOKEN=replace-with-a-random-local-token
CODEX_GATEWAY_MODEL=your-codex-model-id
CODEX_GATEWAY_CODEX_HOME=~/.slideotter/codex-gateway

STUDIO_LLM_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=replace-with-the-same-random-local-token
OPENAI_COMPATIBLE_BASE_URL=http://127.0.0.1:4174
OPENAI_COMPATIBLE_MODEL=your-codex-model-id
```

`CODEX_GATEWAY_TOKEN` must match `OPENAI_COMPATIBLE_API_KEY`, and `CODEX_GATEWAY_MODEL` must match `OPENAI_COMPATIBLE_MODEL` or `STUDIO_LLM_MODEL`.

Start the gateway in one terminal. Use the repository command when working from source:

```bash
npm run codex:gateway
```

An installed slideotter package exposes the same gateway through:

```bash
slideotter codex-gateway
```

It binds only to `127.0.0.1:4174` by default and prints a startup summary with its token redacted. Start or restart Studio in a second terminal, then use `Check LLM provider` before generation:

```bash
npm run studio:start
```

The first gateway slice is manual: the Studio command and Electron app do not start, stop, or configure the gateway.

Optional gateway settings:

```dotenv
CODEX_GATEWAY_PORT=4174
CODEX_GATEWAY_REASONING_EFFORT=medium
CODEX_GATEWAY_TIMEOUT_MS=300000
CODEX_GATEWAY_MAX_CONCURRENCY=1
```

The gateway refuses public binding, requires its high-entropy local bearer token for every endpoint, accepts only the configured model, and runs Codex in an empty temporary working directory with read-only filesystem access, approvals disabled, and executable/network tool features disabled. The Codex child receives a synthetic home: `HOME`, `USERPROFILE`, and `CODEX_HOME` all point at `CODEX_GATEWAY_CODEX_HOME`, while the real home and XDG config/data paths are not inherited. As a result, the child does not inherit slideotter provider keys, normal `~/.codex` configuration, user skills from `~/.agents/skills`, or repository instructions and skills. A marker in every request directory anchors Codex project discovery there instead of allowing a `TMPDIR` ancestor to become the project root.

This is not a zero-skill or zero-configuration claim. Codex-owned `skills/.system` content in the dedicated home, vendor-bundled skills, and machine-admin skills, configuration, or MCP definitions under `/etc/codex` remain trusted inputs. Do not expose the gateway through a LAN address, tunnel, reverse proxy, or hosted deployment.

The gateway requests `history.persistence=none`, uses a fresh SDK thread per completion, and removes its temporary working directory. The current TypeScript SDK does not expose the CLI's `--ephemeral` flag, however, so session metadata remains inside the dedicated gateway Codex home; the home is isolated, not recreated for every request.

The gateway validates `max_tokens` as a positive safe integer, defaults it to 2,600 when omitted, and includes that budget in the Codex prompt. The TypeScript SDK does not expose an exact output-token cap, so this is not a guaranteed upstream token or cost ceiling. The gateway separately rejects final responses larger than the smaller of 262,144 bytes or `max_tokens * 16` bytes before returning them to Studio.

If the provider check fails, verify that the gateway is still running, the port and token match, the configured model is available to the active Codex account, and `codex` can run successfully in the same local environment. Authentication and usage-limit failures come from Codex and follow the active ChatGPT workspace or OpenAI API account.

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

This repository includes product-facing presentation workflow guidance under `skills/` and developer-agent guidance under `.codex/skills/`.

Use the deck workflow for implementation, rendering, validation, and deck structure changes.

Use `slide-clarity-drill` when slide wording needs line-by-line tightening before editing the source.

Use the repo-local `agent-ci` developer skill for workflow-sensitive changes and explicit local CI readiness checks.

Use the repo-local `modern-web-guidance` developer skill when browser-facing implementation requires choosing a platform feature, checking compatibility, or designing a fallback. Its pinned, telemetry-disabled retrieval is advisory; the surface-specific support contract in `docs/ARCHITECTURE.md` and [ADR 0063](docs/adr/implemented/0063-surface-specific-browser-support.md) remains authoritative.

Typical requests:

```text
Use slide-clarity-drill on slide 3.
```

```text
Tighten slide 2, then patch the slide and run the deck validation flow.
```
