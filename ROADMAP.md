# Browser Studio Roadmap

This document turns the browser-app MVP discussion into a concrete implementation roadmap for this repository.

The goal is to build a local browser-based presentation studio that reduces typing, codifies common flows, improves context handling, and shortens the iteration loop while keeping the existing deck generator as the source of truth.

## Working Agreement

Keep this roadmap live while implementing the studio.

- update progress status in the same change as meaningful studio work
- correct architecture notes when implementation choices change
- keep the "Next Focus" section aimed at the next practical slice, not long-range ideas only

## Current Status

Implemented:

- local Node studio server under `studio/server/`
- static browser client under `studio/client/`
- deck rebuild and preview rendering against the real generator
- geometry/text validation and optional render validation through the studio API
- persisted deck and slide context in `studio/state/deck-context.json`
- capture/apply variant snapshots, with structured slide variants now stored alongside slide JSON and legacy fallbacks still available in `studio/state/variants.json`
- a quiet studio UI pass with sans-serif typography, a white canvas, and divider-based layout instead of card containers
- first explicit workflow operation: `Ideate Slide` generates saved source variants from stored context, renders preview images, and applies one variant back into the working slide on demand
- side-by-side compare view with current-vs-candidate previews, source-change summaries, and apply-or-validate actions inside the workflow area
- dry-run ideation mode that renders transient variants without saving them to the variant store
- explicit before-and-after source diff panes plus operation-specific change summaries in the compare area
- per-slide workflow locking so overlapping ideation requests do not race on the working slide source
- schema-backed slide-spec materialization for `cover`, `toc`, `content`, and `summary` so common workflow variants can be represented as structured data before becoming source
- `Ideate Slide` variants now carry validated slide specs alongside generated source for supported slide families
- server-side LLM client, prompt builder, and structured-output schema modules for future assistant-backed workflows
- feature-flagged `Ideate Slide` generation mode selection with `auto`, `local`, and `llm` paths plus clean local fallback when no LLM is configured
- provider-aware LLM setup for both OpenAI and LM Studio, with LM Studio using its local OpenAI-compatible server for easier local integration
- browser-visible LLM provider verification through a guarded server check that validates configuration, reachability, and structured-output support
- verified live LLM-backed `Ideate Slide` workflow generation in the studio when a provider is configured and reachable, including LM Studio responses that emit structured JSON through `reasoning_content`
- assistant session persistence through a repo-local session store with request/response history
- assistant workflow API and browser chat surface that can answer, trigger `Ideate Slide`, and run validation through the existing guarded server flows
- source-to-slide-spec extraction for the four supported slide families so workflows can tighten current slide copy without editing JavaScript directly
- browser-based slide-spec JSON editing for the four supported slide families, with server-side materialization back into source so JavaScript is not exposed as the primary authoring surface
- the included four-slide demo deck ported to JSON slide specs and rendered directly from that structured content in both the studio and the PDF build
- structured local `Drill Wording` workflow with assistant routing and compareable dry-run variants
- structured local `Redo Layout` workflow with direct browser action, assistant routing, and compareable dry-run variants
- structured local `Ideate Theme` workflow with direct browser action, assistant routing, and compareable dry-run variants
- structured local `Ideate Structure` workflow with direct browser action, assistant routing, and compareable dry-run variants
- structured local deck-level presentation-structure ideation that generates candidate outlines plus per-slide plan changes from saved deck context and can apply one back to persisted deck metadata while promoting retitles, slide reordering, inserted slide scaffolds, scaffolded slide replacements, guarded slide archival, richer composed deck plans, stronger pre-apply deck-plan summaries, and affected-slide preview hints into the deck itself
- broader assistant intent handling for short layout-oriented requests such as `redo layout`, `rebalance`, and `rearrange`
- browser-visible workflow progress states through the shared runtime endpoint so direct operations and assistant-triggered actions can report stages before previews are ready

Not implemented yet:
- repo-aware deck-level workflows beyond the current file-safe compose actions, such as broader generator-aware composition changes or larger batch authoring flows

## Next Focus

The next practical slice should deepen the deck-level workflow surface now that composed deck plans, stronger summaries, and affected-slide preview hints are in place:

1. add richer visual preview cues for deck plans, potentially including transient deck-level preview strips or affected-slide before-and-after previews
2. keep the server responsible for validating slide specs, preview rendering, variant storage, and apply gating
3. decide whether progress reporting should stay polling-based or move to streaming once more workflows exist

## Product Intent

The browser studio should make these flows faster and more repeatable:

- ideate a theme
- ideate a presentation structure
- ideate or rewrite a slide
- drill wording line by line
- retry or redo layout
- generate slide variants
- compare alternatives visually
- validate changes before keeping them

This is not a PowerPoint replacement and not a full WYSIWYG editor in the MVP.

## Core Principle

Keep the current deck engine as the source of truth.

The app should wrap the existing runtime rather than replace it:

- [`generator/deck.js`](./generator/deck.js) remains the composition point
- [`generator/compile.js`](./generator/compile.js) remains the main PDF build path
- [`generator/render-utils.js`](./generator/render-utils.js) remains the page-rendering utility
- validation continues to reuse the existing geometry, text, and render checks under [`generator/`](./generator)

The studio is a control plane around the current generator, not a second rendering system.

## LLM Integration Plan

The studio should use an LLM as a planner and content generator, not as the runtime itself.

Keep these boundaries:

- the browser sends user intent and workflow actions
- the studio server gathers context, builds prompts, calls the LLM, and validates outputs
- the current deck generator remains the executor that renders previews and final output
- variant apply, rebuild, and validation remain server-controlled operations

### Execution Model

For LLM-backed actions, the request flow should be:

1. client sends an action such as `ideate slide`, `redo layout`, or `tighten wording`
2. server gathers the context pack for that action
3. server calls the LLM with a structured prompt and schema
4. server validates and materializes the returned candidate into variant data or source edits
5. server renders previews, stores artifacts, and returns compare-ready results to the client

This keeps the user experience conversational while preserving deterministic enforcement at the server boundary.

### Provider Setup

The studio should support both hosted and local OpenAI-compatible providers without changing the browser flow.

- `openai`: use `OPENAI_API_KEY` and `OPENAI_MODEL` or `STUDIO_LLM_MODEL`
- `lmstudio`: use `STUDIO_LLM_PROVIDER=lmstudio`, point at the local OpenAI-compatible server, and set `LMSTUDIO_MODEL` or `STUDIO_LLM_MODEL`
- normalize local LM Studio base URLs to `/v1` so the server can reuse one provider contract
- keep provider selection on the studio server through env vars or repo-local `.env` files rather than exposing provider-specific logic in the browser client

### Context Pack

Each LLM request should include only the context needed for the current action:

- deck brief, audience, objective, tone, constraints, and theme brief
- selected slide context such as intent, notes, must-include points, and layout hints
- current slide spec
- nearby slide titles or adjacent slide summaries when structure matters
- operation type and explicit output constraints

Avoid sending the whole repository by default. Build small operation-specific context packs instead.

### Output Contract

Do not start by letting the LLM emit arbitrary JavaScript for any file.

Prefer a constrained output shape first:

- `label`
- `rationale`
- `changeSummary`
- slide-type-specific payload fields such as cards, bullets, eyebrow, summary, or note

The server should then convert that structured payload into slide source using local materializers. Raw source generation can be added later as an advanced path once the constrained path is reliable.

### Slide Spec Layer

For common slide patterns, add a structured slide-spec layer before introducing any custom DSL.

Start with JSON plus schema validation rather than inventing a new language immediately. The goal is:

- let the studio and assistant read and write slide intent as structured data
- validate candidate edits before they become source
- compile structured slide specs into the existing slide runtime on the server
- keep raw JavaScript as an escape hatch for advanced or irregular slides

This should begin with the slide families already present in the deck:

- `cover`
- `toc`
- `content`
- `summary`

Each type should have a clear schema for fields such as:

- `title`
- `eyebrow`
- `summary`
- `cards`
- `bullets`
- `signals`
- `guardrails`
- `resources`
- `note`

The server should own the materialization step from slide spec to source. That keeps layout rules and generator constraints in one place instead of leaking them into the UI or prompts.

For structured slides, the roadmap now stores named variants alongside the main slide JSON payload. The current working slide spec remains explicit at the top level, while alternate slide-spec options stay preserved in the same slide-level document so users can swap between them later without losing work.

A custom DSL should be considered only later if JSON becomes too awkward for composition, references, or layout relationships.

### Assistant Session Layer

To replicate a chat-like experience, add a thin session layer on top of workflow actions:

- persist message history in a repo-local session store
- expose an assistant endpoint that accepts user messages plus current studio selection
- let the assistant either answer in text, trigger a workflow, or return both text and variants
- expose intermediate states such as `gathering context`, `generating variants`, `rendering preview`, and `validation passed` through the shared runtime state, with streaming as a later upgrade if polling becomes too limiting

This should feel like an assistant inside the studio, not a separate general-purpose chatbot.

### Safety Rules

The server must remain the gatekeeper:

- allow edits only to approved workflow targets
- validate syntax before previewing or storing
- rebuild previews through the existing generator
- keep dry-run and saved-variant behavior explicit
- require explicit apply for promotion into the working slide
- reject overlapping operations that touch the same slide or file set

### Initial File Plan

Add these modules first:

- `studio/server/services/llm/client.js`
- `studio/server/services/llm/prompts.js`
- `studio/server/services/llm/schemas.js`
- `studio/server/services/assistant.js`
- `studio/server/services/sessions.js`
- `studio/server/services/slide-specs/`

Refactor `Ideate Slide` into smaller stages:

- collect operation inputs
- generate candidates through either local rules or the LLM path
- validate and normalize candidates as slide specs for supported slide types
- materialize candidates into source or structured variant payloads
- render and validate
- store and return compare-ready variants

### Rollout Order

Implement in this order:

1. add a slide-spec schema layer for `cover`, `toc`, `content`, and `summary`
2. add LLM client, prompt builder, and schema validation without changing the UI flow
3. put `Ideate Slide` behind a feature flag that can use the LLM path or the current deterministic fallback
4. add assistant-style endpoints and session persistence for conversational actions
5. extend the same pattern to `Drill Wording`, `Redo Layout`, and `Ideate Theme`

## Target Outcome

By the end of the MVP, the repository should include a local browser app that:

- shows real slide previews generated from the current deck
- stores reusable deck and slide context
- exposes common workflows as explicit actions
- supports safe slide variants and compare/apply flow
- runs the current validation flow and reports the result clearly

## Architecture

Build the studio as two parts:

- `studio/server`: a Node backend that edits files, runs the build and validation pipeline, and exposes workflow APIs
- `studio/client`: a browser UI for previews, context, operations, variants, and validation feedback

Recommended stack:

- frontend: local static client served by the studio server
- backend: small Node HTTP server

Current implementation uses plain browser assets instead of React + Vite so the local-first slice stays small and works directly with the current CommonJS runtime.

## UX Shape

Current implementation uses a centered white-canvas workspace:

- top masthead with action controls and status
- one dominant preview region near the top
- stacked editing sections for deck context, slide context, source editing, variants, and validation

Visual rules for the current studio UI:

- default to sans-serif typography throughout the app shell
- keep the background clean white rather than tinted or textured
- avoid visual containers such as cards or panels; use spacing, alignment, and light dividers to separate regions instead

This is intentionally quieter than a full app shell. If a later iteration adds richer workflow controls, keep the visual hierarchy anchored around the preview rather than turning the page into a dashboard.

## Phase Plan

### Phase 1: Studio Shell And Runtime Bridge

Objective: establish the browser app shell and connect it to the current generator runtime.

Implementation:

- create `studio/server/` with server entrypoint, route registration, and task runner modules
- create `studio/client/` with the initial three-pane shell
- add root scripts in [`package.json`](./package.json) for:
  - `studio:dev`
  - `studio:build`
  - `studio:start`
- implement backend wrappers for:
  - `buildDeck()`
  - `renderDeckPages()`
  - `validateDeck()`

Acceptance criteria:

- opening the browser app shows the current deck state
- the app can trigger a real deck build
- the app can report whether the last build succeeded or failed

Status: complete

### Phase 2: Preview And Status Pipeline

Objective: make the app preview-first so every meaningful change can be judged visually.

Implementation:

- add backend endpoints:
  - `POST /api/build`
  - `GET /api/preview/deck`
  - `GET /api/preview/slide/:index`
  - `POST /api/validate`
- store preview PNGs in a studio-local cache directory rather than in committed baseline directories
- show deck thumbnails in a rail and a focused slide preview in the main pane
- surface build and validation errors as structured UI messages rather than raw terminal output

Acceptance criteria:

- one action rebuilds the deck and refreshes previews
- users can inspect the whole deck or one slide
- users can see build and validation failures in the UI

Status: complete

### Phase 3: Persistent Context Model

Objective: stop retyping the same presentation intent over and over.

Implementation:

- add a repo-local state directory such as `studio/state/`
- add a persisted deck context file such as `studio/state/deck-context.json`
- store:
  - deck brief
  - audience
  - objective
  - tone
  - constraints
  - theme brief
  - outline
  - per-slide intent
  - per-slide notes
  - per-slide layout hints
- build a right-hand context editor in the browser app

Acceptance criteria:

- deck and slide context survive reloads
- operations can use stored context as inputs
- context editing does not require touching slide source files directly

Status: complete

### Phase 4: Structured Workflow Operations

Objective: replace repeated freeform prompting with explicit high-value actions.

Initial operations:

- `Ideate Theme`
- `Ideate Structure`
- `Ideate Slide`
- `Drill Wording`
- `Redo Layout`
- `Generate Variants`

Implementation:

- define each operation in backend code with:
  - required inputs
  - allowed file targets
  - expected output shape
  - rebuild requirement
- map wording-tightening behavior to the existing `slide-clarity-drill` workflow
- for the MVP, operation handlers should generate file edits against `slides/` and `generator/`, then rebuild previews

Acceptance criteria:

- each operation can be run from the UI
- each operation produces a previewable result
- operation inputs come primarily from stored context rather than ad hoc typing

Status: partial

Implemented so far:

- `Ideate Slide` workflow action for the selected slide
- `Ideate Structure` workflow action for the selected slide through both the browser UI and the assistant
- `Ideate Theme` workflow action for the selected slide through both the browser UI and the assistant
- deck-level presentation-structure ideation through both the browser UI and the assistant, with safe apply back to the saved outline, per-slide structure metadata, promoted slide titles, slide reordering, inserted slide scaffolds, scaffolded slide replacement, guarded slide archival, richer composed deck plans, stronger pre-apply deck-plan summaries, and affected-slide preview hints
- `Drill Wording` workflow action through the assistant and server API
- generated multi-option source variants from stored deck and slide context
- schema-backed slide-spec generation and materialization for `cover`, `toc`, `content`, and `summary`
- source-to-slide-spec extraction for the same four slide families
- feature-flagged generation mode selection so `Ideate Slide` can run through local rules today and an LLM path when configured
- assistant session history and browser chat surface for workflow-triggering requests
- preview images for generated variants without overwriting the working slide
- side-by-side compare view, source-change summary, and apply-plus-validate flow for one chosen variant

Still needed:

- repo-aware deck-level workflow operations beyond the current file-safe compose actions, such as broader generator-aware composition changes or larger batch authoring flows
- stronger operation-specific change summaries and fuller diff support
- legacy-variant cleanup so older entries in `studio/state/variants.json` can be folded fully into slide-local storage

### Phase 5: Slide Variant System

Objective: make experimentation safe and visual instead of destructive.

Implementation:

- keep `studio/state/variants.json` as a legacy fallback for non-structured slides while supported structured slides persist named variants in slide JSON
- record, per variant:
  - slide id
  - variant label
  - prompt or attempt summary
  - generated patch or content payload
  - preview image path
  - creation timestamp
- do not overwrite the main slide file when generating variants
- add a compare view that shows the current slide alongside 2-3 generated alternatives
- add `Apply Variant` to promote one chosen variant into the working slide file and rebuild
- add a structured slide-level variant format so supported slide JSON files can keep a current choice plus named alternatives for later reuse

Acceptance criteria:

- users can generate alternatives without losing the current slide
- users can compare variants visually
- users can apply one chosen variant safely
- users can reopen a slide later and still find previously saved structured options without relying only on studio-local runtime state

Status: partial

Implemented so far:

- capture current slide source as a named snapshot
- apply a stored variant back into the working slide
- generate `Ideate Slide` variants with preview images stored under studio output
- compare the current slide and one selected variant inside the workflow area before apply
- store supported slide variants directly in slide JSON so alternate options remain part of the deck content model

Still needed:

- fuller before/after diff support and clearer visual decision support for larger changes

### Phase 6: File Editing Boundary

Objective: keep write behavior predictable and auditable.

Implementation:

- centralize repo edits in one backend editing module
- restrict MVP write targets to:
  - `slides/slide-*.js`
  - [`generator/deck.js`](./generator/deck.js)
  - [`generator/theme.js`](./generator/theme.js)
  - `studio/state/*`
- add a dry-run mode for higher-risk operations such as theme and structure changes

Acceptance criteria:

- every operation has a clear write surface
- risky edits can be previewed before being applied
- the app does not make uncontrolled changes across the repo

Status: partial

Implemented so far:

- write behavior is centralized in the studio server
- current edits are limited to slide source files and repo-local studio state
- structured slide JSON now distinguishes active content from preserved named variants in the same document

Still needed:

- stronger enforcement and documentation of allowed write targets

### Phase 7: Validation And Diff UX

Objective: preserve the repository's guardrails inside the studio workflow.

Implementation:

- show geometry, text, and render validation status separately
- add a lightweight change summary view showing:
  - changed slide previews
  - changed files
  - validation result before and after
- keep render validation as an explicit action if it is too slow for every operation
- keep geometry and text checks easy to run after each meaningful change

Acceptance criteria:

- users can tell whether a change is acceptable visually
- users can tell whether a change broke the current gate
- validation feedback is understandable without reading raw logs

Status: partial

Implemented so far:

- geometry, text, and render validation are exposed separately
- validation results are shown in the UI

Still needed:

- before/after change summary
- clearer diff-oriented visual feedback

### Phase 8: First End-To-End Milestone

Objective: prove the workflow on one real vertical slice before expanding scope.

Target slice:

1. edit slide context in the app
2. run `Ideate Slide`
3. generate 2-3 layout variants
4. preview the results
5. apply one result
6. run validation

Exit condition:

- this flow feels materially faster than the current prompt-and-file-edit path
- the variant system is usable
- the preview loop is tight enough to justify continuing

If this slice feels clumsy, fix the operation model before adding more features.

Status: not started

## Proposed Directory Layout

```text
studio/
  client/
    app.js
    index.html
    styles.css
  server/
    index.js
    services/
      build.js
      paths.js
      slides.js
      state.js
      validate.js
      variants.js
  state/
    deck-context.json
    variants.json
```

## API Plan

Initial backend routes:

- `POST /api/build`
- `GET /api/runtime`
- `POST /api/validate`
- `GET /api/preview/deck`
- `GET /api/preview/slide/:index`
- `POST /api/theme/ideate`
- `POST /api/outline/ideate`
- `POST /api/slide/ideate`
- `POST /api/slide/drill`
- `POST /api/slide/layout-variants`
- `POST /api/variant/apply`

These routes should operate on repo state and app state, then return structured results suitable for UI updates.

## Delivery Order

Implement in this order:

1. scaffold `studio/server` and `studio/client`
2. bridge backend build and preview to the existing generator
3. build the preview-first UI shell
4. add persistent deck and slide context
5. implement `Ideate Slide` and `Drill Wording`
6. implement variant generation and compare/apply
7. implement theme and outline operations
8. tighten validation, diffs, and error handling

## Main Risks

- full-deck rebuild latency may make the app feel slower than intended
- unrestricted file writing will make variants and rollback messy
- a generic chat UI without structured actions will recreate the current typing overhead instead of solving it
- building a full visual editor too early will fight the current code-first generator model

## MVP Definition Of Done

The MVP is done when all of the following are true:

- the app runs locally in the browser
- it shows deck and slide previews generated from the real deck engine
- it stores reusable deck and slide context
- it supports at least:
  - `Ideate Slide`
  - `Drill Wording`
  - `Redo Layout`
  - `Generate Variants`
- it can apply one chosen result back into the repo
- it can run the current validation flow and present the result clearly

## Recommended First Build Slice

The first implementation slice should be intentionally narrow:

- one backend route to build and preview the current deck
- one browser view showing slide thumbnails and focused preview
- one persistent slide-context editor
- one `Ideate Slide` operation for a single slide
- one compare/apply variant flow

If that slice works well, expand into theme and structure operations next.
