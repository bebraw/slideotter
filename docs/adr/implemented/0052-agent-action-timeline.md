# ADR 0052: Agent Action Timeline

## Status

Implemented.

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

Add an agent action timeline.

The action timeline should record and display meaningful application-level events from assistant, generation, validation, candidate, and export workflows. The demo should use the real app workflow and live timeline events rather than a scripted or fixture-backed replay surface.

## Product Rules

- Timeline entries should describe application actions, not low-level implementation noise.
- Every write or candidate-producing step should show its validation or review boundary.
- Timeline entries should link back to resources when possible: slide, candidate, check report, job, export, or compare view.
- The timeline should be useful whether the workflow is LLM-backed, fixture-backed, or manually triggered.
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

Each event should include:

- stable event id
- timestamp
- label
- short summary
- related resource link or slide id when available
- severity or status
- optional action id
- optional job id

## Demo Path

The demo should be improvised from the live studio workflow:

- inspect the active slide resource in the affordance explorer
- trigger candidate generation for the selected slide
- inspect the real operation status and timeline events while generation runs
- compare a candidate before applying it
- apply and validate the accepted candidate
- return to the timeline to show the recorded review and validation trail

Do not maintain a built-in replay button or fixture-backed walkthrough in the product UI. A scripted replay made the demo feel abstract because it could show events without the underlying panels visibly doing the work.

## UI Shape

The first slice should add a timeline panel near existing workflow status surfaces. It should show:

- current run title
- ordered event list
- current event state
- links to candidate compare, validation report, or rebuilt PDF where available
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

4. Add tests around event ordering and timeline rendering.

## Validation

Coverage should include:

- unit tests for event normalization and redaction
- workflow tests that assert expected events for generation, apply, validation, and export
- browser tests that verify timeline rendering and links
- security tests proving blocked text, provider secrets, and raw private source snippets do not appear in timeline summaries
