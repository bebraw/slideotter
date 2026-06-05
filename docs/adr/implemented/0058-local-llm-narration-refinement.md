# ADR 0058: Local LLM Narration Refinement

## Status

Implemented.

## Context

ADR 0057 added reviewable narration metadata and browser speech synthesis playback. The first implementation creates narration during slide materialization through explicit speaker notes or a deterministic fallback from visible slide text. That is safe and offline-friendly, but it cannot reliably shape a whole-deck speaking arc.

Good narration is not just a longer version of visible slide copy. It should:

- explain the point behind the slide instead of reading the slide aloud
- use natural spoken language with short, pause-friendly sentences
- keep one clear idea per slide
- add context, implication, or a transition when that helps the audience follow the story
- stay reviewable before playback

Slideotter already has a local LLM boundary through LM Studio and other configured providers. The narration refinement workflow should use that boundary to improve spoken scripts while preserving ADR 0050's visible-text quarantine and ADR 0057's reviewable slide-spec model.

## Decision

Add a local-LLM narration refinement workflow that rewrites `narration.script` for the active presentation without changing visible slide copy.

The workflow should support:

- refining the current slide narration
- refining all slides in a presentation
- using the configured local LLM/provider path, with LM Studio as the expected local demo provider
- including compact deck context, current slide visible text, existing narration, and neighboring slide titles in the prompt
- returning only `narration.script`, `narration.durationSeconds`, and `narration.advance`
- validating and quarantining the returned script before writing the slide spec

The deterministic narration materializer remains the fallback for generation, tests, and unconfigured local LLM environments.

## Product Rules

- Narration refinement changes only narration metadata, never visible slide fields.
- Refined narration must be in the deck language and should match the deck tone.
- Refined narration should not start by simply reading the title when summary or speaker-note material exists.
- The workflow must preserve reviewability: scripts remain plain JSON in the slide spec and visible in presentation mode.
- Failed refinement should leave the existing narration unchanged.
- Local refinement should use the same configured provider and runtime model override boundary as other local generation workflows.
- Quarantine failures are blocking, because narration is audience-facing presentation copy.

## Relationship To Existing ADRs

ADR 0011 remains the LM Studio runtime model-selection boundary.

ADR 0028 remains the token-efficiency boundary. Narration prompts should use compact slide windows rather than full deck JSON.

ADR 0050 remains the semantic leak boundary. Narration scripts pass through the same audience-facing text quarantine as visible slide fields.

ADR 0057 remains the playback and review model. This ADR improves authoring of `narration.script`; it does not add server-side voice generation.

## Non-Goals

- No server-side text-to-speech or audio file generation.
- No automatic narration rewrite during every render or presentation playback.
- No hidden speaker notes outside slide specs.
- No visible slide copy rewrite as part of narration refinement.
- No external cloud-only dependency for the local demo path.

## Implementation Plan

1. Add a server-owned narration-refinement service that builds compact prompts from presentation metadata, slide visible text, existing narration, and neighboring slide titles.
2. Add schema-bound LLM output for a single narration result.
3. Add server operations for current-slide and all-slide refinement, preserving slide-spec validation and visible-text quarantine.
4. Expose the operations through the existing hypermedia/action API surface.
5. Add browser controls in Slide Studio for improving narration on the current slide and across the deck.
6. Add focused tests covering prompt shape, narration-only mutation, quarantine blocking, and unchanged slides on failure.

## Validation

Implementation should pass:

- narration refinement service tests with deterministic mocked LLM output
- slide-spec validation for updated narration metadata
- visible-text quarantine checks on refined scripts
- browser-client fixture checks for the new controls
- `npm run quality:gate`

## Implementation Notes

Implemented by adding schema-bound narration refinement prompts, a narration-only server operation for one slide or the full deck, hypermedia actions for discoverability, and Studio controls in the current-slide improvement panel. Failed deck-wide refinements leave the affected slide's existing narration unchanged.
