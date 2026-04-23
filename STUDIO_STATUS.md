# Browser Studio Status

This file tracks the live implementation snapshot for the browser studio.

Use [`ROADMAP.md`](./ROADMAP.md) for architecture, rollout order, and the next build slice.

## Snapshot

Implemented:

- local Node studio server under `studio/server/`
- static browser client under `studio/client/`
- deck rebuild and preview rendering against the real generator
- geometry, text, and optional render validation through the studio API
- persisted deck and slide context in `studio/state/deck-context.json`
- shared generator metadata and progress chrome that now read live deck context and active slide totals instead of relying only on hardcoded defaults
- saved design constraints in deck context for minimum font size, spacing floors, and maximum words per slide, wired into studio validation and the CLI quality gate
- capture/apply variant snapshots, with structured slide variants stored alongside slide JSON and legacy fallbacks still available in `studio/state/variants.json`
- a quiet studio UI pass with sans-serif typography, white canvas treatment, and divider-based layout instead of card containers
- explicit slide workflows: `Ideate Slide`, `Drill Wording`, `Redo Layout`, `Ideate Theme`, and `Ideate Structure`
- a separated workflow surface where variant generation and variant comparison live in distinct views
- a fold-out right-side workflow assistant rail with a compact closed handle, overlay-open behavior, and a persistent open or closed state instead of an in-flow chat block
- a separate deck-planning page for deck brief editing and deck-structure ideation instead of an inline deck context block
- a fold-out left-side structured-draft rail with a compact closed handle, overlay-open behavior, and a persistent open or closed state instead of an inline JSON editor block
- a separate validation page for deck checks, validation actions, and the latest report instead of an inline or docked report block
- side-by-side compare view with current-vs-candidate previews, source-change summaries, and apply-or-validate actions
- dry-run ideation mode that renders transient variants without saving them to the variant store
- explicit before-and-after source diff panes plus operation-specific change summaries in the compare area
- per-slide workflow locking so overlapping ideation requests do not race on the working slide source
- schema-backed slide-spec materialization for `cover`, `toc`, `content`, and `summary`
- source-to-slide-spec extraction and browser JSON editing for the same four slide families
- server-side LLM client, prompt builder, and structured-output schema modules
- generation mode selection with `auto`, `local`, and `llm` plus clean local fallback
- provider-aware LLM setup for both OpenAI and LM Studio, including live verification and working LM Studio structured-output parsing
- assistant session persistence plus browser chat that can answer, trigger workflows, and run validation
- the included four-slide demo deck ported to JSON slide specs and rendered directly from that structured content
- deck-level presentation-structure ideation through both the browser UI and the assistant
- deck-plan apply that can promote retitles, reordering, inserted slide scaffolds, scaffolded slide replacement, guarded slide archival, and composed deck plans
- deck-planning candidates that can batch-author the full live deck by rewriting multiple slide specs in one guarded dry-run and apply flow
- stronger pre-apply deck-plan summaries, current/proposed sequence previews, affected-slide preview hints, transient deck-level before-and-after strip summaries, and structured deck-plan diff summaries
- slide-level compare summaries that now include structured field-change counts and content-area summaries for supported JSON slide types
- browser-visible workflow progress states through an SSE-backed shared runtime stream instead of request polling
- centralized studio write-boundary enforcement for slide files under `slides/slide-*`, repo-local state files under `studio/state/*.json`, and generated artifacts under `studio/output/**`

Current gaps:

- repo-aware deck-level workflows beyond the current file-safe compose and rewrite actions, especially where more shared generator behavior should respond to saved planning context
- legacy-variant cleanup so older entries in `studio/state/variants.json` can be folded fully into slide-local storage

## Phase Snapshot

### Phase 1: Studio Shell And Runtime Bridge

Status: complete

### Phase 2: Preview And Status Pipeline

Status: complete

### Phase 3: Persistent Context Model

Status: complete

### Phase 4: Structured Workflow Operations

Status: partial

Implemented so far:

- `Ideate Slide` workflow action for the selected slide
- `Ideate Structure` workflow action for the selected slide through both the browser UI and the assistant
- `Ideate Theme` workflow action for the selected slide through both the browser UI and the assistant
- deck-level presentation-structure ideation through both the browser UI and the assistant, with safe apply back to the saved outline, per-slide structure metadata, promoted slide titles, slide reordering, inserted slide scaffolds, scaffolded slide replacement, guarded slide archival, richer composed deck plans, whole-deck batch-authoring passes, stronger pre-apply deck-plan summaries, affected-slide preview hints, transient deck-level before-and-after strip summaries, structured diff summaries, and shared generator-aware deck metadata plus live slide totals
- `Drill Wording` workflow action through the assistant and server API
- generated multi-option source variants from stored deck and slide context
- schema-backed slide-spec generation and materialization for `cover`, `toc`, `content`, and `summary`
- source-to-slide-spec extraction for the same four slide families
- feature-flagged generation mode selection so `Ideate Slide` can run through local rules today and an LLM path when configured
- assistant session history and browser chat surface for workflow-triggering requests
- preview images for generated variants without overwriting the working slide
- side-by-side compare view, source-change summary, structured field-diff summary, and apply-plus-validate flow for one chosen variant

Still needed:

- repo-aware deck-level workflow operations beyond the current file-safe compose and rewrite actions, especially where more shared generator behavior should respond to saved planning context

### Phase 5: Slide Variant System

Status: partial

Implemented so far:

- capture current slide source as a named snapshot
- apply a stored variant back into the working slide
- generate `Ideate Slide` variants with preview images stored under studio output
- compare the current slide and one selected variant inside the workflow area before apply
- store supported slide variants directly in slide JSON so alternate options remain part of the deck content model

Still needed:

- clearer visual decision support for larger changes beyond the current field-level summaries
- cleanup path from legacy `studio/state/variants.json` entries into slide-local storage

### Phase 6: File Editing Boundary

Status: complete

Implemented so far:

- write behavior is centralized in the studio server
- current edits are limited to slide source files, generator composition, and repo-local studio state
- structured slide JSON distinguishes active content from preserved named variants in the same document
- deck-level compose actions stay file-safe by using insert, replace, retitle, reorder, and guarded archival instead of destructive delete flows
- studio writes now pass through an explicit boundary that only allows `slides/slide-*`, `studio/state/*.json`, and `studio/output/**`

### Phase 7: Validation And Diff UX

Status: partial

Implemented so far:

- geometry, text, and render validation are exposed separately
- validation results are shown in the UI
- source diffs, operation-specific summaries, and structured field-level compare summaries exist for slide-level workflows
- deck-plan summaries, affected-slide hints, transient before-and-after strip summaries, and structured diff summaries exist for deck-level workflows

Still needed:

- clearer diff-oriented visual feedback for larger changes

### Phase 8: First End-To-End Milestone

Status: in progress

What already works:

1. edit deck and slide context in the app
2. run slide-level workflows or deck-structure workflows
3. preview results and compare alternatives
4. apply one result
5. run validation

What still needs polish:

1. broader deck-level composition flows where more shared generator behavior should respond to saved planning context
2. richer diff and summary support across more workflow types
3. cleanup of remaining legacy fallback paths such as repo-global variant storage
