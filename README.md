# presentation-template

This repository contains a small demonstration presentation built around imported presentation skills, including `pdf-slide-generator` and `slide-clarity-drill`.

## Included skills

This repository ships with two presentation-focused skills under `skills/`.

### `pdf-slide-generator`

Use this skill for deck-building work:

- adding or editing slides in `slides/`
- changing shared presentation helpers in `generator/`
- updating assets, PDF output, or render baselines
- validating deck changes with `npm run build` and `npm run quality:gate`

Typical requests:

- `Use pdf-slide-generator to add a new slide about X.`
- `Update the theme and rebuild the PDF.`
- `Refresh the render baseline after this visual change.`

### `slide-clarity-drill`

Use this skill when the structure is mostly right but slide wording needs tightening:

- vague or slogan-like claims
- overlong slide text
- wording that needs to become more concrete or defensible
- line-by-line rewrite passes before patching slides

Typical requests:

- `Use slide-clarity-drill on slide 3.`
- `This wording feels fuzzy. Tighten it one line at a time.`
- `Help me rewrite these bullets without shrinking the font.`

## How to use them

Mention the skill name directly in your request when you want Codex to follow that workflow.

- Use `pdf-slide-generator` for implementation, rendering, validation, and deck structure changes.
- Use `slide-clarity-drill` for interactive copy refinement and line-by-line wording decisions.
- Use both when a change needs wording work first and slide/code updates after that.

Example combined request:

```text
Use slide-clarity-drill to tighten slide 2, then use pdf-slide-generator to patch the slide and run the deck validation flow.
```

## Demo deck

- Archived PDF: `archive/demo-presentation.pdf`
- Current local PDF build: `slides/output/demo-presentation.pdf`

The demo presentation is a four-slide starter deck:

- Cover
- Outline
- Content with implementation signals
- Summary / next steps

## Browser studio

The repository now includes a local browser-based presentation studio under `studio/`.

Start it with:

```bash
npm run studio:start
```

Then open:

```text
http://127.0.0.1:4173
```

The first implementation slice is local-first and wraps the existing generator runtime. It currently supports:

- deck rebuilds and preview rendering
- geometry/text validation and optional full render validation
- persisted deck and slide context in `studio/state/`
- saved deck metadata such as author, company, explicit subject, and language that flow back into shared PPT/PDF document metadata
- saved design constraints and shared visual theme values that flow back into generator validation and deck chrome
- the included four-slide demo deck stored as slide-spec JSON and rendered directly by the shared slide-spec runtime
- browser-based editing of supported slides through slide-spec JSON instead of direct JavaScript
- capture/apply slide variants through structured slide specs for supported slide families, with supported JSON slides saving named variants alongside the active slide spec and legacy structured variants migrated into the owning slide JSON
- grouped slide-compare summaries for supported JSON slide types so larger changes read as framed content-area diffs instead of only flat line changes

The studio does not replace the current PDF generator. It uses the same deck source files and rebuild path that the repository already uses for normal presentation work.

Studio write targets are intentionally narrow. The server only mutates:

- `slides/slide-*.json` and `slides/slide-*.js`
- repo-local state files under `studio/state/*.json`
- generated workflow artifacts under `studio/output/**`

### LLM provider setup

The studio can use either OpenAI or LM Studio as its LLM backend.

The server now loads repo-root `.env` and `.env.local` files automatically when you run `npm run studio:start` or `npm run studio:dev`.

- shell environment variables still take precedence over `.env` values
- `.env.local` can override `.env`
- copy `.env.example` to `.env` and fill in the provider you want to use

OpenAI via `.env`:

```dotenv
STUDIO_LLM_PROVIDER=openai
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-5.2
```

LM Studio via `.env`:

```dotenv
STUDIO_LLM_PROVIDER=lmstudio
LMSTUDIO_MODEL=openai/gpt-oss-20b
LMSTUDIO_BASE_URL=http://127.0.0.1:1234
```

Optional LM Studio overrides:

```dotenv
LMSTUDIO_BASE_URL=http://127.0.0.1:1234
STUDIO_LLM_MODEL=openai/gpt-oss-20b
```

Notes:

- the LM Studio provider talks to the local OpenAI-compatible server and normalizes the base URL to `/v1`
- `STUDIO_LLM_MODEL` overrides provider-specific model variables for either backend
- the browser UI still uses the same `Auto`, `Local`, and `LLM` generation modes; provider selection happens through environment variables on the studio server
- use `Check LLM provider` in the studio workflow area to verify config, reachability, and structured-output support before switching ideation to `LLM`

## Development

Build, validation, repository structure, and generator details are documented in [TECHNICAL.md](TECHNICAL.md).
The higher-level system design and runtime flow are documented in [ARCHITECTURE.md](ARCHITECTURE.md).
For presentation changes, run `npm run quality:gate` before considering the work done. It now runs geometry/text validation before the render-baseline check.
If you add deck graphics, author them as Graphviz `.dot` sources under `slides/assets/diagrams/`; the build regenerates the matching PNGs automatically.

### Slide JSON migration

If you have legacy slide modules that still use the older CommonJS source format, you can extract them into slide-spec JSON with:

```bash
npm run slides:migrate:json -- slides/slide-02.js
```

Useful options:

- `--out-dir <dir>` writes the generated JSON files into another directory
- `--force` overwrites existing JSON output
- `--delete-js` removes the source JS file after extraction

The migration utility currently supports the slide families that already have structured schemas in this repository: `cover`, `toc`, `content`, and `summary`.
