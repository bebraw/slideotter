# ADR 0053: Demo Candidate Review Loop

## Status

Implemented.

## Context

slideotter's authoring model is intentionally guarded: generated or assisted changes become candidates, candidates can be previewed and compared, and only explicit apply actions write them into the deck. This is a good product boundary and a good hypermedia demo boundary.

For a talk, however, the existing candidate and variant surfaces need to be especially crisp. The audience should see a clear before/after change and the validation gate that makes the change credible. If the demo becomes a series of hidden mutations or a broad "make this deck better" command, it obscures the architectural point.

The most useful demo scenario is small:

> This slide is too dense for a 30-minute talk. Improve it without changing the thesis.

The product should make that loop obvious: inspect, propose, compare, apply, validate, rebuild.

## Decision Direction

Hone the candidate review loop as a demo-quality workflow for agentic slide improvement.

The first goal is not broad autonomous deck editing. The goal is a reliable current-slide improvement flow that visibly preserves the preview-before-apply and validation-before-keep model.

## Product Rules

- Scope the demo workflow to the selected slide by default.
- Keep the user task visible as the run goal.
- Generate a small number of candidates, preferably one or two.
- Present before/after changes side by side with changed fields highlighted.
- Show what stayed unchanged when preservation matters: slide id, position, thesis, source links, material references, or layout family.
- Apply only through explicit user action or an advertised apply action.
- Offer a combined "apply and validate" path for demo speed.
- Rebuild/export only after the accepted candidate passes the relevant checks.
- Keep visible copy concise and presentation-scale.
- Avoid autonomous whole-deck rewrites in the first demo slice.

## Workflow Shape

The default demo task should follow this sequence:

1. User selects a slide.
2. User or agent starts a scoped improvement action.
3. Server creates candidate slide specs.
4. Browser opens a before/after compare view.
5. User or agent applies one candidate.
6. Studio runs current-slide or deck validation.
7. Studio rebuilds the PDF when validation passes or shows repair affordances when it fails.

This sequence should be available through browser controls and through hypermedia actions so the same path can be followed by an agent.

## Compare View Requirements

The compare view should emphasize:

- changed title, summary, panel title, and item fields
- removed or shortened visible text
- layout treatment changes
- validation status before apply
- apply target and base version
- source/material preservation where relevant

For the demo, a compact "what changed" summary is more valuable than raw JSON. Raw JSON should remain available for debugging, but not be the primary stage surface.

## Agent Contract

An agent operating this loop should:

- start from the selected slide resource
- read available actions rather than constructing hidden route sequences
- request candidates before writes
- inspect compare and validation resources
- apply only a reviewed candidate
- stop when the requested improvement is complete or when validation reports a blocker

This contract should be reflected in action descriptors, timeline events, and tests.

## Demo Scenario

The first fixture scenario should use a realistic dense content slide from a hypermedia talk. The expected result should:

- preserve the core claim
- reduce visible text
- prefer one-column readable layout when appropriate
- keep sources or citations intact
- pass text/layout validation
- rebuild to a current PDF

The scenario should be deterministic enough for a conference demo but realistic enough that it still exercises actual validation and apply boundaries.

## Non-Goals

- No unreviewed whole-deck rewrite.
- No automatic source invention.
- No "best effort" apply when validation fails.
- No hidden direct slide-file writes from the agent.
- No pixel-only comparison as the first implementation; structured field comparison stays primary.

## Implementation Plan

1. Define a current-slide demo improvement action.
   Reuse existing candidate generation where possible and keep the request scoped to the selected slide.

2. Improve the compare summary.
   Highlight changed visible fields, preserved fields, and validation status.

3. Add an apply-and-validate control.
   It should apply the selected candidate, run the appropriate checks, and surface failures without hiding them.

4. Add a deterministic dense-slide fixture.
   Use it for browser validation and demo replay.

5. Wire the workflow into the affordance explorer and action timeline.
   The candidate, apply, validation, and rebuild steps should all be visible as resource actions and timeline entries.

6. Validate the rebuilt PDF.
   Keep render validation part of the final demo path when visual output changes.

## Validation

Coverage should include:

- candidate generation tests for selected-slide scope
- compare summary tests for changed and preserved fields
- apply-and-validate tests for success and failure paths
- visible-text quarantine tests for candidate output
- browser tests for before/after review and apply controls
- render validation for the demo fixture

