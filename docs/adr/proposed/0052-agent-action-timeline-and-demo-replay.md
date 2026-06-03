# ADR 0052: Agent Action Timeline And Demo Replay

## Status

Proposed implementation plan.

## Context

slideotter can already run multi-step authoring workflows: generation, candidate review, validation, rebuild, export, and presentation preview. Those operations are meaningful for an agentic demo, but their sequence is often visible only as transient status text, logs, or final state.

For a 30-minute talk, the audience needs to understand what the agent did and why it mattered. A black-box chat transcript or terminal log is too hard to follow. The demo should show a concise trace:

- what resource the agent inspected
- what affordance it followed
- what candidate it produced
- what validation it ran
- what change was accepted

The same trace is also useful for ordinary authoring because it gives users confidence that generated or assisted changes passed through the expected guarded workflow.

## Decision Direction

Add an agent action timeline with deterministic demo replay support.

The action timeline should record and display meaningful application-level events from assistant, generation, validation, candidate, and export workflows. Demo replay should allow a known scenario to run from scripted or fixture-backed responses so the stage demo can be reliable without pretending to be fully autonomous.

## Product Rules

- Timeline entries should describe application actions, not low-level implementation noise.
- Every write or candidate-producing step should show its validation or review boundary.
- Timeline entries should link back to resources when possible: slide, candidate, check report, job, export, or compare view.
- The timeline should be useful whether the workflow is LLM-backed, fixture-backed, or manually triggered.
- Demo replay must be explicit and labeled as replay/fixture-backed when used.
- Replay should reset the demo deck or scenario state predictably.
- Replay must not weaken the normal apply, validation, or write-boundary rules.
- The timeline should not expose blocked prompt text, private source text, provider secrets, or excessive raw prompts.

## Timeline Events

Initial event types should include:

- `resource-read`: inspected presentation, slide, candidate, checks, or context
- `action-advertised`: selected from available resource actions
- `candidate-requested`: started a candidate-producing workflow
- `candidate-created`: candidate available for review
- `compare-opened`: before/after view inspected
- `validation-started`: checks or render validation requested
- `validation-passed`
- `validation-failed`
- `candidate-applied`
- `deck-rebuilt`
- `export-created`
- `workflow-stopped`
- `workflow-replayed`

Each event should include:

- stable event id
- timestamp
- label
- short summary
- related resource link or slide id when available
- severity or status
- optional action id
- optional job id

## Demo Replay

Demo replay should support a small number of named scenarios, for example:

- `dense-slide-rewrite`
- `layout-repair`
- `validate-and-export`

A scenario should define:

- starting presentation id or fixture deck
- selected slide
- user task
- provider mode (`fixture`, `local-llm`, or `manual`)
- expected action sequence
- reset behavior

Fixture-backed replay should use the same public workflow interfaces as normal generation where practical. It can provide deterministic candidate payloads, but those payloads still go through schema validation, visible-text quarantine, preview, compare, apply, and render validation.

## UI Shape

The first slice should add a timeline panel near existing workflow status surfaces. It should show:

- current run title
- ordered event list
- current event state
- links to candidate compare, validation report, or rebuilt PDF where available
- compact "reset demo" and "run scenario" controls when demo mode is enabled

The timeline should use terse, stage-readable labels such as:

- Read slide context
- Found rewrite action
- Generated 2 candidates
- Opened before/after compare
- Applied candidate
- Ran validation
- Rebuilt PDF

Avoid visible instructional text explaining how to use the UI. The control labels and event labels should carry the workflow.

## Non-Goals

- No full agent observability product.
- No chain-of-thought display.
- No raw prompt log by default.
- No autonomous whole-deck rewrite mode.
- No replacement for validation reports, compare views, or job diagnostics.

## Implementation Plan

1. Define a timeline event type and persistence boundary.
   Store transient run events in runtime state first; avoid permanent deck artifacts until the shape proves useful.

2. Add server event emission for existing workflows.
   Start with candidate generation, apply, validation, rebuild, and export.

3. Add a browser timeline workbench.
   Render event labels, statuses, timestamps, and resource links.

4. Add fixture-backed demo scenarios.
   Start with one dense-slide rewrite scenario that exercises read, candidate, compare, apply, validate, and rebuild.

5. Add reset support for demo decks.
   Keep it explicit and scoped to demo fixtures so normal presentations are not accidentally overwritten.

6. Add tests around event ordering and replay determinism.

## Validation

Coverage should include:

- unit tests for event normalization and redaction
- workflow tests that assert expected events for generation, apply, validation, and export
- replay tests that reset to a known deck and produce the same accepted candidate
- browser tests that verify timeline rendering and links
- security tests proving blocked text, provider secrets, and raw private source snippets do not appear in timeline summaries

