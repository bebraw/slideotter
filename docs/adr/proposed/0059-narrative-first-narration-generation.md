# ADR 0059: Narrative-First Narration Generation

## Status

Proposed.

## Context

ADR 0057 made narration reviewable slide-spec metadata, and ADR 0058 added local LLM refinement for those scripts. The current baseline is safe, but it can still produce scripts that mostly paraphrase the visible slide:

- deterministic materialization builds narration from the slide summary plus one support point
- slide-level refinement sees visible text, neighboring slide titles, and compact deck context, but it does not have a distinct speaker job
- validation blocks prompt leaks and unsafe text, but it does not detect when narration is too close to the visible slide copy

Good presenter narration should carry the audience between slides. It should explain why the slide matters, add connective tissue, answer the likely question the slide raises, and transition to the next beat. That is different from reading the title, summary, or bullets aloud.

## Decision

Treat generated narration as a narrative layer, not a restatement layer.

The narration workflow should produce or refine scripts from a compact speaker job that is separate from visible slide text. At minimum, a script should include:

- the role of this slide in the deck argument
- a bridge from the previous slide when available
- one interpretation, implication, or concrete example that is not a verbatim slide readout
- a transition to the next slide when available

The first implementation slice should strengthen the existing local narration refinement path before introducing new persisted fields. It should:

- make the refinement prompt require bridge, interpretation/example, and transition behavior
- tell the model that visible slide text is evidence, not a script outline
- pass compact previous and next slide context as narrative anchors
- reject or retry scripts that overlap too much with visible slide text
- keep the mutation boundary unchanged: refinement writes only `narration`, never visible slide fields

Later slices can add explicit `speakerIntent`, `audienceQuestion`, `offSlideExample`, and `transition` fields to deck plans or slide context when real usage shows the prompt-only baseline is not enough.

## Product Rules

- Narration should sound like a presenter explaining the deck, not like text-to-speech reading the slide.
- The script may use visible slide text as evidence, but it should not copy long phrases or march through bullets in order.
- Every added claim must be grounded in visible slide text, deck context, source context, or neighboring slide context.
- Failed narration refinement should leave the existing script unchanged.
- Overlap checks should prefer false positives over silently accepting a script that reads the slide aloud.
- The script remains reviewable JSON and remains subject to visible-text quarantine.

## Relationship To Existing ADRs

ADR 0057 remains the playback and review model. This ADR changes script quality, not presentation mode controls.

ADR 0058 remains the local LLM refinement boundary. This ADR hardens that workflow so the configured model writes a narrative script instead of a paraphrase.

ADR 0050 remains the semantic leak boundary. Narration overlap checks are an editorial-quality guard beside quarantine, not a replacement for prompt-leak detection.

ADR 0028 remains the token-efficiency boundary. Narration prompts should use compact narrative anchors rather than full deck JSON.

## Non-Goals

- No hidden, unreviewed presenter notes.
- No automatic rewrite during presentation playback.
- No visible slide text rewrite as part of narration improvement.
- No broad deck-planning schema migration in the first slice.
- No audio-generation or voice-selection changes.

## Implementation Plan

1. Strengthen `buildNarrationRefinementPrompts()` with explicit narrative-shape requirements and anti-readout instructions.
2. Add a reusable narration overlap check that compares the refined script with collected visible slide text.
3. Fail the single-slide refinement if the returned script is too close to visible copy.
4. Keep deck-wide refinement behavior tolerant: a failed slide keeps its existing narration while the workflow continues.
5. Add focused tests for prompt shape, overlap rejection, and unchanged visible slide fields.
6. Move this ADR to implemented when the prompt and overlap baseline ships.

## Validation

Implementation should pass:

- narration refinement unit tests
- visible-text quality tests for narration quarantine
- strict TypeScript checks
- the affected static validation paths

