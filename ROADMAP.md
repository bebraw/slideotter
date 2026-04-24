# Browser Studio Roadmap

This document records the browser-studio architecture and the remaining maintenance direction for this repository.

The goal is to maintain a local browser-based presentation studio that reduces typing, codifies common flows, improves context handling, shortens the iteration loop, and keeps one DOM-first rendering path authoritative for both browser preview and PDF output.

## Working Agreement

Keep this roadmap live while implementing the studio.

- update [`STUDIO_STATUS.md`](./STUDIO_STATUS.md) in the same change as meaningful studio work
- correct architecture notes when implementation choices change
- keep the "Next Focus" section aimed at the next practical maintenance slice, not long-range ideas only
- capture durable studio product or workflow decisions in `docs/adr/` when they are likely to outlive one implementation slice

## Current Status

The live implementation snapshot now lives in [`STUDIO_STATUS.md`](./STUDIO_STATUS.md).

Use that file for:

- current capabilities and known gaps
- completed phase status
- notable workflow-shape decisions

Keep this roadmap focused on architecture and the next maintenance slice.

## Next Focus

The DOM-first runtime is now the active path:

1. supported JSON slide families render through a shared DOM slide runtime inside the studio
2. current slide preview, thumbnails, variant cards, and compare panes now use that DOM renderer instead of passing PNGs around
3. the server exposes the same renderer through a standalone `/deck-preview` document path
4. studio-triggered PDF export and preview PNG generation now run through that DOM renderer via Playwright
5. studio validation and the CLI quality gate now use that same DOM validation path for supported slide families, with a browser layout fixture guarding the Slide Studio preview viewport
6. complete media validation mode now adds rendered-media checks for small, clipped, upscaled, distorted, unlabeled, unloaded, dimensionless, text-overlapping, or progress-area-crowding visuals plus caption/source attachment, preferred caption position, minimum spacing, and maximum attachment distance
7. the render-baseline gate now compares the current DOM-built PDF against the approved raster baseline

The next practical tasks are:

1. continue the pragmatic UI review by keeping Deck Planning palette and guardrail controls compact now that Variant Generation sits in the primary Slide Studio flow, empty compare space is hidden until candidates exist, Checks settings are collapsed by default, and drawer plus thumbnail chrome is less intrusive
2. keep hardening complete media-validation mode beyond its current media legibility, slide bounds, progress-area spacing, and caption/source attachment checks, now covered by a fixture in the quality gate, especially once media-heavy slide families land
3. keep extending shared deck-context patches if new deck-plan modes are added; the current sequence, boundary, decision, operator, compressed, composed, and deck-authoring candidates all carry shared-context steering, and generated content scaffolds use prose evidence items instead of metric-style placeholders, enforced by the deck-plan fixture in the quality gate
4. keep documentation aligned with the DOM-first runtime when older guidance is touched

Recent durable decisions are recorded in [`docs/adr/0001-studio-deck-plan-and-validation-controls.md`](./docs/adr/0001-studio-deck-plan-and-validation-controls.md) and [`docs/adr/0002-pragmatic-ui-review.md`](./docs/adr/0002-pragmatic-ui-review.md).

## Product Intent

The browser studio should make these flows faster and more repeatable:

- ideate a theme
- ideate a presentation structure
- ideate or rewrite a slide
- edit supported slide text directly from the rendered preview
- drill wording line by line
- retry or redo layout
- generate slide variants
- compare alternatives visually
- validate changes before keeping them

This is not a PowerPoint replacement and not a full WYSIWYG editor.

## Core Principle

Keep exactly one rendering engine authoritative at a time.

Current implementation is now DOM-first:

- supported JSON slide families render through [`studio/client/slide-dom.ts`](./studio/client/slide-dom.ts) for studio preview and the standalone `/deck-preview` document
- studio-triggered PDF export and preview PNG generation now run through Playwright in [`studio/server/services/dom-export.ts`](./studio/server/services/dom-export.ts)
- studio geometry and text validation for supported slide families now run through Playwright DOM inspection in [`studio/server/services/dom-validate.ts`](./studio/server/services/dom-validate.ts)
- that DOM validator now covers content-gap floors, contrast, vertical-balance checks, and complete-mode media checks in addition to bounds, panel padding, minimum font size, and words-per-slide
- the CLI build and geometry/text validation entrypoints now live under [`scripts/`](./scripts/) and call that same Playwright-backed DOM renderer and DOM validator
- studio preview strips and contact sheets now use [`studio/server/services/page-artifacts.ts`](./studio/server/services/page-artifacts.ts)
- repo-level [`scripts/`](./scripts/) entrypoints now drive build, diagram rendering, geometry/text validation, and baseline refresh around the DOM runtime
- the optional render-baseline comparison now checks the current DOM-built PDF against approved raster snapshots under [`studio/baseline/`](./studio/baseline/)
- retired slide drawing, PDF rendering, text-measurement, config, and CLI layers have been removed from the active codebase

The active architecture is DOM-first:

- slide-spec JSON stays the source content model for supported slides
- a shared DOM renderer becomes the source of truth for browser preview
- the same DOM renderer, via headless browser automation, becomes the source of truth for PDF and PNG export
- validation reads DOM layout results

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

Generated slide candidates are session-only: the server renders compare-ready previews and returns candidate specs to the browser, but it does not write generated options into `slides/slide-*.json`. Theme candidates also carry font and color overrides so Ideate Theme behaves as a visual theme operation during comparison. Applying one candidate writes only the chosen slide spec and any chosen visual theme. Manual snapshots can still persist in `studio/state/variants.json`, keeping slide JSON focused on the active deck content.

A custom DSL should be considered only later if JSON becomes too awkward for composition, references, or layout relationships.

### Assistant Session Layer

The assistant layer sits on top of workflow actions:

- message history persists in a repo-local session store
- the assistant endpoint accepts user messages plus current studio selection
- the assistant can answer in text, trigger a workflow, or return both text and variants
- intermediate states such as `gathering context`, `generating variants`, `rendering preview`, and `validation passed` flow through SSE-backed runtime events and workflow history

This should feel like an assistant inside the studio, not a separate general-purpose chatbot.

### Safety Rules

The server must remain the gatekeeper:

- allow edits only to approved workflow targets
- validate syntax before previewing or storing
- rebuild previews through the shared DOM runtime
- keep session-only candidate and saved-snapshot behavior explicit
- require explicit apply for promotion into the working slide
- reject overlapping operations that touch the same slide or file set

### Ideate Slide Pipeline

`Ideate Slide` stays split into smaller stages:

- collect operation inputs
- generate candidates through either local rules or the LLM path
- validate and normalize candidates as slide specs for supported slide types
- materialize candidates into source or structured variant payloads
- render and validate
- store and return compare-ready variants

## Baseline Outcome

The repository now includes a local browser app that:

- shows real slide previews generated from the current deck
- stores reusable deck and slide context
- supports direct text edits from the rendered preview for structured slides
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

Current implementation uses plain browser assets instead of React + Vite so the local-first slice stays small and works directly with the lightweight Node studio server.

## DOM-First Runtime

This section summarizes the active deck and runtime.

### Why This Pivot

- one renderer for editing, preview, and final export is simpler than keeping preview images plus a separate authoring surface
- CSS layout primitives such as Flexbox and Grid are a better long-term fit than manual slide geometry for many authoring tasks
- the project targets PDF output, so the renderer can focus on browser layout and PDF export
- structured slide JSON already exists, so the content model is strong enough to support a rendering reset

### Target Runtime

End-state request flow:

1. slide-spec JSON is loaded
2. a shared DOM renderer turns it into HTML/CSS
3. the browser uses that DOM for live studio preview
4. a headless browser uses that same DOM for exported PNGs and final PDF
5. validation inspects DOM layout boxes, overflow, spacing, and rendered output from that same runtime

### Non-Goals

- maintaining a second slide-rendering runtime
- building a freeform WYSIWYG editor before the DOM renderer is stable

### Runtime Summary

Delivered in this order:

1. slide-spec JSON became the only active source model for the supported slide families
2. a shared DOM renderer landed for `cover`, `toc`, `content`, and `summary`
3. studio preview for supported slides moved from PNG-first to DOM-first
4. headless-browser export took over PDF and preview image generation
5. validation uses DOM layout inspection plus rendered checks
6. retired slide drawing and config modules were removed for the active deck
7. repo-level scripts and studio services own command and baseline paths

### Current State

- the same DOM renderer powers live studio preview and exported PDF for supported slides
- supported slide families use the shared DOM renderer for authoritative layout
- validation results come from DOM layout and rendered output, not from the old slide-canvas geometry model
- the active demo deck uses the DOM runtime to build, preview, and validate

## UX Shape

Current implementation uses a centered white-canvas workspace with page-level separation:

- `Studio` page for preview, slide context, workflow generation, and compare/apply
- `Deck Planning` page for deck brief, manual system-slide insertion/removal, and deck-plan ideation
- compact masthead `Checks` control for deck checks, reports, and check settings
- sticky top navigation that keeps the current slide and check state visible with minimal status text
- fold-out side rails for the assistant and structured draft editor
- compact workflow chat for command-style assistant actions
- selected active-slide text can be attached to workflow chat turns as local context
- collapsed selected-slide context on the studio page so slide metadata is available without occupying persistent editing space
- manual slide add/remove controls live with the operative Slide Studio workflows while deck planning stays focused on shared deck context
- TypeScript checking now runs as a no-emit quality gate across the TypeScript runtime; keep new code type-check clean and tighten declarations opportunistically.
- a compact slide-candidate workbench that keeps generation modes, workflow progress, candidate counts, and review state close together while hiding provider diagnostics and workflow event output behind an inspectable debug panel
- an integrated slide-candidate review and compare workspace for fast visual inspection of alternatives
- a compact checks panel that keeps run actions, summary status, actionable report details, and settings available from the masthead
- an explicit check override disclosure control for rule-severity settings
- a compact deck-planning console that keeps brief, outline, palette swatches, guardrails, and deck-plan results close without expanding every plan detail by default

Visual rules for the current studio UI:

- default to sans-serif typography throughout the app shell
- keep the background clean white rather than tinted or textured
- avoid visual containers such as cards or panels; use spacing, alignment, and light dividers to separate regions instead
- keep variant-generation controls task-shaped and compact so the preview and compare surfaces remain the main work area

This is intentionally quieter than a full app shell. If a later iteration adds richer workflow controls, keep the visual hierarchy anchored around the preview rather than turning the page into a dashboard.

## Completed Rollout

The original eight-phase browser-studio rollout is complete:

| Phase | Outcome |
| --- | --- |
| Studio Shell And Runtime Bridge | Local browser studio shell and server bridge exist. |
| Preview And Status Pipeline | Preview, build, and validation feedback run through the studio. |
| Persistent Context Model | Deck and slide context persist in repo-local state. |
| Structured Workflow Operations | Slide, wording, theme, structure, and deck workflows run through guarded actions. |
| Slide Variant System | Variants are persistent, previewable, comparable, and safely applicable. |
| File Editing Boundary | Studio writes are centralized and constrained to approved paths. |
| Validation And Diff UX | Validation and compare surfaces show structured summaries and decision cues. |
| First End-To-End Milestone | The original edit, ideate, preview, apply, and validate slice is complete. |

## Current Directory Shape

```text
studio/
  baseline/
  client/
    app.ts
    index.html
    slide-dom.ts
    styles.css
  server/
    index.ts
    noop-build.ts
    services/
      assistant.ts
      baseline-utils.ts
      build.ts
      deck-theme.ts
      design-constraints.ts
      dom-export.ts
      dom-preview.ts
      dom-validate.ts
      env.ts
      llm/
        client.ts
        prompts.ts
        schemas.ts
      operations.ts
      output-config.ts
      page-artifacts.ts
      paths.ts
      sessions.ts
      slide-specs/
        index.ts
      slides.ts
      state.ts
      validate.ts
      validation-settings.ts
      variants.ts
      write-boundary.ts
  output/
  state/
    deck-context.json
```

## API Plan

Current backend routes:

- `POST /api/build`
- `GET /api/state`
- `GET /api/runtime`
- `GET /api/runtime/stream`
- `POST /api/validate`
- `POST /api/llm/check`
- `POST /api/context`
- `POST /api/context/deck-structure/apply`
- `POST /api/slides/system`
- `POST /api/slides/delete`
- `GET /api/preview/deck`
- `GET /api/dom-preview/deck`
- `GET /deck-preview`
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

These routes operate on repo state and app state, then return structured results suitable for UI updates.

## Watch Areas

- Full-deck rebuild latency can still make larger workflows feel slower than intended.
- New workflow modes must preserve the explicit write boundary and preview-before-apply model.
- The assistant should continue routing through structured actions instead of becoming a generic chat surface.
- A freeform visual editor would still fight the structured slide-spec model unless the DOM runtime grows a clearer editing abstraction first.
