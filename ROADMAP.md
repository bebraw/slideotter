# Browser Studio Roadmap

This document turns the browser-app MVP discussion into a concrete implementation roadmap for this repository.

The goal is to build a local browser-based presentation studio that reduces typing, codifies common flows, improves context handling, and shortens the iteration loop while converging on one DOM-first rendering path for both browser preview and PDF output.

## Working Agreement

Keep this roadmap live while implementing the studio.

- update [`STUDIO_STATUS.md`](./STUDIO_STATUS.md) in the same change as meaningful studio work
- correct architecture notes when implementation choices change
- keep the "Next Focus" section aimed at the next practical slice, not long-range ideas only

## Current Status

The live implementation snapshot now lives in [`STUDIO_STATUS.md`](./STUDIO_STATUS.md).

Use that file for:

- current capabilities and known gaps
- per-phase implementation status
- the detailed checklist of what has landed already
- notable workflow-shape changes such as:
  - separating variant generation from variant comparison
  - moving deck planning and validation into their own pages
  - folding the assistant and structured draft into side rails
  - removing the old manual rebuild control because deck-context saves and workflow actions already refresh the live deck

Keep this roadmap focused on architecture, rollout order, and the next slice to build.

## Next Focus

The DOM pivot is complete enough that renderer migration is no longer the main task:

1. supported JSON slide families render through a shared DOM slide runtime inside the studio
2. current slide preview, thumbnails, variant cards, and compare panes now use that DOM renderer instead of passing PNGs around
3. the server exposes the same renderer through a standalone `/deck-preview` document path
4. studio-triggered PDF export and preview PNG generation now run through that DOM renderer via Playwright
5. studio validation and the CLI quality gate now use that same DOM validation path for supported slide families
6. the render-baseline gate now compares the current DOM-built PDF against the approved raster baseline instead of rebuilding a separate generator-side validation PDF

The next practical tasks are:

1. extend shared deck-context patches across the remaining deck-plan modes so sequence-, compressed-, and composed-plan candidates can also steer shared context instead of only slide-file shape
2. add the next DOM-validation checks where they matter most now: image or screenshot legibility, caption and source spacing, and other media-specific rules that are still weaker than the text-and-layout checks
3. keep pruning stale “migration” or `generator/` language from deeper docs, and mark old rollout sections as historical whenever they are touched

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

Keep exactly one rendering engine authoritative at a time.

Current implementation is now DOM-first:

- supported JSON slide families render through [`studio/client/slide-dom.js`](./studio/client/slide-dom.js) for studio preview and the standalone `/deck-preview` document
- studio-triggered PDF export and preview PNG generation now run through Playwright in [`studio/server/services/dom-export.js`](./studio/server/services/dom-export.js)
- studio geometry and text validation for supported slide families now run through Playwright DOM inspection in [`studio/server/services/dom-validate.js`](./studio/server/services/dom-validate.js)
- that DOM validator now covers content-gap floors, contrast, and vertical-balance checks in addition to bounds, panel padding, minimum font size, and words-per-slide
- the CLI build and geometry/text validation entrypoints now live under [`scripts/`](./scripts/) and call that same Playwright-backed DOM renderer and DOM validator
- studio preview strips and contact sheets now use [`studio/server/services/page-artifacts.js`](./studio/server/services/page-artifacts.js) instead of importing those generic helpers from the generator runtime
- repo-level [`scripts/`](./scripts/) entrypoints now drive build, diagram rendering, geometry/text validation, and baseline refresh around the DOM runtime
- the optional render-baseline comparison now checks the current DOM-built PDF against approved raster snapshots under [`studio/baseline/`](./studio/baseline/) instead of building a second generator-side validation PDF
- the older generator-side slide drawer, PDF renderer, text-measurement helpers, config modules, and CLI wrappers have been removed from the active codebase

The active architecture is DOM-first:

- slide-spec JSON stays the source content model for supported slides
- a shared DOM renderer becomes the source of truth for browser preview
- the same DOM renderer, via headless browser automation, becomes the source of truth for PDF and PNG export
- validation reads DOM layout results instead of generator-side geometry

The point of the pivot was to reduce total complexity, not split it again. Do not reintroduce a second long-lived renderer beside the shared DOM runtime.

Deck-level planning context should still flow into shared rendering behavior where it is safe and deterministic to do so. The current implementation already proves that with metadata, progress totals, design constraints, and shared palette values. The DOM-first renderer should inherit that same deck-context boundary instead of inventing browser-only presentation state.

The studio write boundary should stay explicit and narrow. Studio-driven file mutation is now limited to slide files under `slides/slide-*`, repo-local state files under `studio/state/*.json`, and generated workflow artifacts under `studio/output/**`. Future workflow expansion should continue extending that allowlist deliberately rather than relying on ad hoc file writes.

## LLM Integration Plan

The studio should use an LLM as a planner and content generator, not as the runtime itself.

Keep these boundaries:

- the browser sends user intent and workflow actions
- the studio server gathers context, builds prompts, calls the LLM, and validates outputs
- the shared DOM renderer remains the executor that renders previews and final output
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

The server should own the materialization step from slide spec to source. That keeps layout rules and shared runtime constraints in one place instead of leaking them into the UI or prompts.

For structured slides, the roadmap now stores named variants alongside the main slide JSON payload. The current working slide spec remains explicit at the top level, while alternate slide-spec options stay preserved in the same slide-level document so users can swap between them later without losing work. Older structured variants from the repo-global fallback store are now migrated into slide-local JSON as part of the same content model, leaving `studio/state/variants.json` as a compatibility path for non-structured slides only.

A custom DSL should be considered only later if JSON becomes too awkward for composition, references, or layout relationships.

### Assistant Session Layer

To replicate a chat-like experience, add a thin session layer on top of workflow actions:

- persist message history in a repo-local session store
- expose an assistant endpoint that accepts user messages plus current studio selection
- let the assistant either answer in text, trigger a workflow, or return both text and variants
- expose intermediate states such as `gathering context`, `generating variants`, `rendering preview`, and `validation passed` through the shared runtime state; the studio now does this through SSE-backed runtime events and workflow history

This should feel like an assistant inside the studio, not a separate general-purpose chatbot.

### Safety Rules

The server must remain the gatekeeper:

- allow edits only to approved workflow targets
- validate syntax before previewing or storing
- rebuild previews through the shared DOM runtime
- keep dry-run and saved-variant behavior explicit
- require explicit apply for promotion into the working slide
- reject overlapping operations that touch the same slide or file set

### Initial File Plan

Historical note: this file list is kept as a record of the first implementation wave. Most of these modules now exist.

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

Historical note: this was the original rollout order for the first studio buildout. Use `Next Focus` for current work.

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

## DOM-First Migration

This migration track is now complete for the active deck and runtime. Keep this section as a summary of the architectural shift rather than a pending plan.

### Why This Pivot

- one renderer for editing, preview, and final export is simpler than keeping preview images plus a separate authoring surface
- CSS layout primitives such as Flexbox and Grid are a better long-term fit than manual slide geometry for many authoring tasks
- the project targets PDF output, so keeping PPT-specific rendering constraints is no longer a requirement
- structured slide JSON already exists, so the content model is strong enough to support a rendering reset

### Target Runtime

End-state request flow:

1. slide-spec JSON is loaded
2. a shared DOM renderer turns it into HTML/CSS
3. the browser uses that DOM for live studio preview
4. a headless browser uses that same DOM for exported PNGs and final PDF
5. validation inspects DOM layout boxes, overflow, spacing, and rendered output from that same runtime

### Non-Goals

- preserving PPT output
- keeping the current generator-side slide renderer as a permanent second runtime
- building a freeform WYSIWYG editor before the DOM renderer is stable

### Migration Summary

Delivered in this order:

1. slide-spec JSON became the only active source model for the supported slide families
2. a shared DOM renderer landed for `cover`, `toc`, `content`, and `summary`
3. studio preview for supported slides moved from PNG-first to DOM-first
4. headless-browser export took over PDF and preview image generation
5. validation moved from generator-side geometry to DOM layout inspection plus rendered checks
6. generator-side slide drawing and legacy config modules were removed for the active deck
7. repo-level scripts and studio services replaced the older generator-owned command and baseline paths

### Current State

- the same DOM renderer powers live studio preview and exported PDF for supported slides
- supported slide families no longer depend on generator-side drawing code for authoritative layout
- validation results come from DOM layout and rendered output, not from the old slide-canvas geometry model
- the active demo deck no longer needs a separate generator runtime to build, preview, or validate

## UX Shape

Current implementation uses a centered white-canvas workspace with page-level separation:

- `Studio` page for preview, slide context, workflow generation, and compare/apply
- `Deck Planning` page for deck brief and deck-plan ideation
- `Validation` page for deck checks and reports
- fold-out side rails for the assistant and structured draft editor

Visual rules for the current studio UI:

- default to sans-serif typography throughout the app shell
- keep the background clean white rather than tinted or textured
- avoid visual containers such as cards or panels; use spacing, alignment, and light dividers to separate regions instead

This is intentionally quieter than a full app shell. If a later iteration adds richer workflow controls, keep the visual hierarchy anchored around the preview rather than turning the page into a dashboard.

## Phase Plan

The phases below are historical delivery slices. Use `Next Focus` for the current work rather than reading these as pending implementation.

### Phase 1: Studio Shell And Runtime Bridge

Objective: establish the browser app shell and connect it to the deck runtime.

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
- build persistent deck-level and slide-level context surfaces in the browser app

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
- for the MVP, operation handlers should work through structured slide specs, deck plans, repo-local context, and explicit apply flows rather than ad hoc edits

Acceptance criteria:

- each operation can be run from the UI
- each operation produces a previewable result
- operation inputs come primarily from stored context rather than ad hoc typing

Status: partial

Live implementation detail for this phase lives in [`STUDIO_STATUS.md`](./STUDIO_STATUS.md).

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

Live implementation detail for this phase lives in [`STUDIO_STATUS.md`](./STUDIO_STATUS.md).

### Phase 6: File Editing Boundary

Objective: keep write behavior predictable and auditable.

Implementation:

- centralize repo edits in one backend editing module
- restrict MVP write targets to:
  - `slides/slide-*`
  - `studio/state/*.json`
  - `studio/output/**`
- add a dry-run mode for higher-risk operations such as theme and structure changes

Acceptance criteria:

- every operation has a clear write surface
- risky edits can be previewed before being applied
- the app does not make uncontrolled changes across the repo

Status: complete

Live implementation detail for this phase lives in [`STUDIO_STATUS.md`](./STUDIO_STATUS.md).

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

Live implementation detail for this phase lives in [`STUDIO_STATUS.md`](./STUDIO_STATUS.md).

### Phase 8: First End-To-End Milestone

Objective: prove the workflow on one real vertical slice before expanding scope.

Original target slice:

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

The current implementation now exceeds this original slice. Remaining work is polish and broader deck-level composition, not basic feasibility.

Status: in progress

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
      assistant.js
      build.js
      llm/
        client.js
        prompts.js
        schemas.js
      paths.js
      sessions.js
      slide-specs/
        index.js
      slides.js
      state.js
      validate.js
      variants.js
      write-boundary.js
  output/
    variant-previews/
  state/
    deck-context.json
    sessions.json
    variants.json
```

## API Plan

Current backend routes:

- `POST /api/build`
- `GET /api/runtime`
- `GET /api/runtime/stream`
- `POST /api/validate`
- `POST /api/llm/check`
- `POST /api/context`
- `POST /api/context/deck-structure/apply`
- `GET /api/preview/deck`
- `GET /api/preview/slide/:index`
- `GET /api/slides/:slideId`
- `POST /api/slides/:slideId/source`
- `POST /api/slides/:slideId/slide-spec`
- `POST /api/slides/:slideId/context`
- `POST /api/variants/capture`
- `POST /api/variants/apply`
- `POST /api/operations/ideate-slide`
- `POST /api/operations/ideate-structure`
- `POST /api/operations/ideate-theme`
- `POST /api/operations/drill-wording`
- `POST /api/operations/redo-layout`
- `POST /api/operations/ideate-deck-structure`
- `GET /api/assistant/session`
- `POST /api/assistant/message`

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

## Historical First Build Slice

The first implementation slice should be intentionally narrow:

- one backend route to build and preview the current deck
- one browser view showing slide thumbnails and focused preview
- one persistent slide-context editor
- one `Ideate Slide` operation for a single slide
- one compare/apply variant flow

If that slice works well, expand into theme and structure operations next.
