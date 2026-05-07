# ADR 0050: Visible Text Quarantine

## Status

Proposed implementation plan.

## Context

slideotter now generates, repairs, scales, and rewrites presentation content through several LLM-backed workflows. The project already rejects many obvious semantic leaks: weak schema labels, authoring instructions, placeholder phrases, dangling fragments, repeated card text, unsupported bibliographic-looking claims, known bad translations, and some semantic deck-length planning phrases.

Those checks are useful, but they are scattered across generation quality, text hygiene, deck-length scaling, prompting, and workflow-specific normalizers. That makes leak handling reactive. Each new workflow has to remember which helpers to call, and semantic leaks can still slip through when a string is produced outside the main generated-slide finalization path.

The problem is broader than bad phrases. A semantic leak happens when text meant for one role becomes visible in another role:

- model instructions become slide copy
- schema field names become panel labels
- reviewer guardrails become audience-facing bullets
- source retrieval notes become citations or claims
- layout hints become visual captions
- deck-planning rationale becomes new slide content
- fallback or scaffold copy survives into the rendered deck

The user-facing deck should only contain audience-visible presentation content. Internal planning, validation, sourcing, layout, and workflow language should stay inspectable in diagnostics or candidate metadata, not in slide-visible fields.

## Decision Direction

Introduce a shared visible-text quarantine boundary for all generated, repaired, imported, or candidate-produced text before it can become slide-visible content.

The quarantine should classify and either repair, reject, or mark suspicious visible strings before preview or apply. It should be role-aware: a string is evaluated in the context of where it will appear, such as title, summary, card body, guardrail body, resource title, caption, source line, alt text, or generated outline field.

The quarantine should not replace schema validation, DOM layout validation, source grounding, or human review. It should become the semantic content gate that runs before those later checks.

## Product Rules

- Audience-visible slide text must be presentation content, not authoring metadata.
- Candidate previews should not show known semantic leaks as if they were acceptable output.
- Internal workflow rationale belongs in candidate metadata, diagnostics, or review copy, not in slide specs.
- Repair is allowed only when the result is clearly safer and still useful; otherwise block the candidate and report the reason.
- Prompt instructions remain useful but are not trusted as the primary defense.
- Leak rules should be shared across generation, semantic deck scaling, variants, assistant edits, outline materialization, plugin outputs, and future providers.
- False positives should be visible and debuggable through structured reasons, not hidden behind generic generation failure text.

## Quarantine Model

Add a service such as `studio/server/services/visible-text-quality.ts` that owns visible text classification.

The service should expose a small API:

- collect visible text fields from a slide spec with field roles and paths
- validate one visible field with its role and workflow context
- validate an entire slide spec
- validate a candidate deck or generated slide batch for cross-slide repetition
- return structured issue objects with severity, code, field path, field role, message, and original text

Initial issue codes should include:

- `weak-label`
- `schema-label`
- `authoring-meta`
- `workflow-rationale`
- `planning-language`
- `source-instruction`
- `layout-instruction`
- `fallback-scaffold`
- `dangling-fragment`
- `ellipsis-truncation`
- `known-bad-translation`
- `unsupported-bibliographic-claim`
- `near-duplicate-visible-text`
- `source-language-copy`

The service should preserve the existing deterministic checks first. It can later add optional model-assisted review or embeddings when real decks show misses that simple classifiers cannot catch.

## Role-Aware Validation

The same phrase can be valid or invalid depending on its destination.

Examples:

- A source URL can appear in a source field or reference item, but not as a made-up citation in a bullet body.
- A caveat can appear as audience-facing content, but a command such as "ensure claims are verified" cannot.
- "Guardrails" may be an internal schema concept, but a visible panel needs a concrete audience label.
- A layout treatment note can live in candidate metadata, but not in a slide caption.

The quarantine should therefore evaluate text with both a field role and workflow origin. Workflows should pass enough context to distinguish initial generation, semantic length insertion, variant generation, assistant edits, outline planning, source import, and plugin output.

## Preview And Apply Boundary

Candidate-producing workflows should run quarantine before returning previewable candidates. Apply endpoints should run it again before writing slide specs because browser state, plugin output, or stale candidates may bypass the initial generation path.

For blocked candidates, the UI should show a concise reason in the candidate review surface. Detailed classifier output belongs in diagnostics.

For repairable candidates, the service can return a sanitized spec plus repair notes. Repairs should stay conservative:

- trim dangling fragments
- remove ellipsis truncation
- replace weak panel labels with a useful item title when obvious
- repair known bad translations
- reject instead of inventing content when the replacement would need new meaning

## Diagnostics And Fixtures

Generation errors are already captured under `studio/output/logs/generation-errors/`. Those examples should become negative fixtures instead of only historical logs.

Coverage should include:

- examples of model instructions leaked into visible text
- schema labels used as slide labels
- semantic deck-length planning rationale used as slide content
- source retrieval instructions copied into bullets
- layout or visual treatment instructions used as captions
- duplicated card bodies across nearby slides
- language mismatch cases where source-page text is copied instead of translated
- valid audience-facing caveats that should not be blocked

The fixture runner should report which classifier code failed or passed so maintainers can tune rules without masking regressions.

## Implementation Plan

1. Extract shared visible text collection and deterministic checks.
   Move the reusable parts of generated text hygiene, generated slide quality, and semantic length leak detection into a single visible-text-quality service.

2. Add structured issue reporting.
   Replace generic boolean leak helpers at new call sites with issue objects that carry field paths, roles, codes, and messages.

3. Gate generated slide finalization.
   Keep the current repair-then-assert behavior, but route final validation through the quarantine service.

4. Gate semantic deck-length insertion.
   Validate inserted slide specs before they are returned as candidates and again before `insertStructuredSlide`.

5. Gate variant, assistant, and outline workflows.
   Run quarantine on every slide-spec candidate before preview and apply.

6. Add negative fixtures from observed generation logs.
   Convert representative leak examples into deterministic tests so regressions fail before they reach manual browser use.

7. Surface candidate review diagnostics.
   Show blocked or repaired visible-text issues in candidate metadata while keeping detailed classifier output in the Debug drawer.

8. Extend only from real misses.
   Add embeddings, language identification, or model-assisted review only when deterministic fixtures show repeated semantic misses that cannot be handled with role-aware rules.

## Consequences

The generation pipeline gains one more required validation boundary, but it becomes easier to reason about where visible text is allowed to enter the deck.

Some currently accepted weak output may start failing. That is intentional when the output contains internal planning language, schema labels, or unsafe fallback copy. The UI must make those failures actionable so authors understand whether they should retry, edit the candidate, or adjust the source brief.

Workflow code becomes simpler over time because leak policy moves out of feature-specific normalizers. The cost is that every candidate-producing workflow must pass field-role context into the shared service instead of treating slide specs as untyped JSON blobs.

## Validation

The implementation is done when:

- generated slide finalization uses the shared quarantine
- semantic deck-length insertion cannot write unchecked visible text
- variant, assistant, outline, and plugin candidate paths have a documented quarantine call before preview/apply
- negative fixtures cover observed leak classes
- quality gate includes the fixture runner
- diagnostics expose structured issue codes for blocked or repaired text
- no workflow-specific leak helper remains unless it adds context before delegating to the shared service
