# ADR 0022: Selection-Scoped Chat Commands

## Status

Proposed implementation plan.

## Context

The browser studio already supports workflow chat, slide preview selection chips, structured slide specs, generated candidates, compare views, and explicit apply boundaries. That creates a natural next step: let selection on the rendered slide define the scope of chat commands.

Commands such as "rewrite", "shorten", "make this clearer", "turn this into a quote", or "add source emphasis" are ambiguous without scope. If the author has selected text on the active slide, that selection is a stronger signal than the general current slide. Treating selection as passive context would make the chat feel unpredictable because the model might use the selected text as inspiration while changing unrelated content.

Selection should therefore become an explicit command scope. This keeps chat useful for fast authoring while preserving the studio's structured, reviewable workflow model.

## Decision Direction

Use the active rendered-slide selection as the default scope for chat commands when a selection exists.

Selection-scoped commands should generate candidate changes that target only the selected structured field or range when possible. If there is no active selection, the command should target the current slide by default. Deck-wide commands require explicit deck scope.

The studio should pass selection metadata to command handling as structured scope, not just as plain chat text. Generated results remain candidates until the user explicitly applies them.

## Scope Resolution Rules

Scope should resolve in this order:

1. Explicit user scope.
2. Active slide selection.
3. Current slide.
4. Deck only for commands that are explicitly deck-level.

Examples:

- Selected bullet plus "rewrite" rewrites only that bullet.
- Selected phrase plus "make this more direct" rewrites only that phrase or its owning field, depending on the structured slide field.
- No selection plus "rewrite" proposes a current-slide rewrite.
- "Rewrite the whole deck" uses deck scope even if a slide selection exists.
- Selected body text plus "turn this into a quote slide" may produce a family-changing candidate for the current slide, but the review must show the family change and any dropped or preserved fields.

Selection narrows scope by default. The user can clear selection or explicitly expand the command scope.

## Product Rules

- The chat composer should show active selection as a compact scope chip before send.
- Saved user messages should retain the scope chip so history explains why a command affected a narrow target.
- Candidate rows should label their scope, such as `Selected bullet`, `Selected phrase`, `Current slide`, or `Deck`.
- Commands with selected text should preserve non-selected slide content unless the user explicitly asks for a broader change.
- Ambiguous commands without a selection should not silently operate on the whole deck.
- Selection-scoped commands should stay inside the preview, compare, and apply workflow.
- Applying a selection-scoped candidate should verify that the selected anchor still matches the current slide spec.
- If the selection target changed after generation, the studio should ask the user to regenerate or rebase instead of applying blindly.
- Selection should never bypass slide schema validation, family compatibility checks, source grounding requirements, or server-controlled writes.

## Command Request Shape

The command request should include enough metadata to resolve the selected text back to a structured slide field:

```json
{
  "command": "rewrite",
  "scope": {
    "kind": "selection",
    "presentationId": "slideotter",
    "slideId": "slide-12",
    "fieldPath": ["bullets", 1, "body"],
    "selectedText": "Current and candidate views.",
    "anchorText": "Current and candidate views.",
    "selectionRange": { "start": 0, "end": 28 },
    "slideRevision": "content-hash-or-version"
  }
}
```

The exact revision value can be a content hash, updated timestamp, or monotonically increasing revision, as long as apply can detect stale targets.

## Server Behavior

The server should resolve the selection to a slide spec path before generation when possible. The generation prompt can include the selected text, the full owning field, surrounding slide context, deck context, and relevant source snippets, but the returned patch must remain constrained to the resolved scope unless the user explicitly expanded it.

For selection-scoped same-family edits, the preferred output is a structured patch or candidate slide spec whose diff touches only the allowed field. For family-changing commands, the candidate should include explicit metadata about the target family, preserved fields, dropped fields, and rationale so review remains understandable.

The apply endpoint should validate:

- the candidate still targets the active presentation and slide
- the selection anchor still matches the current spec
- the patch touches only allowed fields for the resolved scope
- the resulting slide spec passes schema and render validation

## UI Behavior

Selection-scoped chat should make scope visible without making chat feel heavy:

- Show a selection chip in the composer while selected text is attached.
- Include a clear-selection action.
- Show scope labels on generated candidates.
- Show a stale-selection warning when the source field changed after candidate generation.
- Keep compare focused on the selected field for narrow edits, with the full slide preview still visible.
- For family-changing candidates, show the old and new slide family before apply.

## Hypermedia And Plugin Relationship

Under ADR 0013, action descriptors should expose whether an action accepts `selection`, `slide`, or `deck` scope. A headless or agentic client should be able to discover the same scope rules the browser uses.

Under ADR 0020, plugins may contribute selection-aware commands, but they should receive only the scoped slide context and permissions needed for that command. A plugin should not gain broad deck mutation power merely because text is selected.

## Validation

Add coverage for:

- selected bullet rewrite changes only that bullet
- selected phrase rewrite does not mutate unrelated fields
- no-selection rewrite targets the current slide
- deck-level rewrite requires explicit deck scope
- stale selection apply is rejected
- family-changing selection command surfaces preserved and dropped fields
- selection metadata is retained in chat history
- hypermedia action descriptors advertise supported scopes
- plugin-provided commands cannot exceed their declared scope

## Non-Goals

- No freeform WYSIWYG editing model.
- No direct model writes to slide files.
- No automatic deck-wide edits from ambiguous chat commands.
- No guarantee that arbitrary DOM selections can always map to a precise structured field.
- No bypass of candidate review, schema validation, or server-controlled apply.

## Open Questions

- Should phrase-level edits patch only the selected substring, or should they rewrite the smallest owning structured field?
- How should multi-field selections be represented in the first implementation?
- Should selection chips survive slide navigation, or clear when the active slide changes?
- What revision mechanism should apply use for stale-selection detection?
- Which chat verbs should be selection-aware in the first implementation?
