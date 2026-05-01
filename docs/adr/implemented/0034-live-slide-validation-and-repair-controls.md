# ADR 0034: Live Slide Validation And Repair Controls

## Status

Implemented.

## Context

Slide Studio can render the active slide through the shared DOM runtime, run deck checks, and validate layout, text, media, captions, sources, progress-area spacing, and related render state. Custom layout authoring now lets users change treatment, region pattern, spacing, and layout definitions while previewing against real slide content.

That makes invalid intermediate states more likely. A user can adjust a layout, media fit, or title treatment and end up with clipped text, cropped media, progress-area overlap, or a valid JSON definition that produces an invalid rendered slide. Full deck checks catch these problems, but they happen too late for an interactive layout workflow. The author needs to know what broke while editing and needs a simple repair path that does not require editing JSON.

Cropping is the clearest example. A slide can be structurally valid while its image is visually wrong: the subject is cropped, the caption is detached, or the media region makes the image unreadable. The tool should surface that problem close to the control that caused it and offer direct fixes such as `Fit image`, focal-point adjustment, or a safer layout.

## Decision Direction

Add live slide validation and targeted repair controls to Slide Studio editing surfaces.

When a user changes layout, media, or other render-affecting controls, the studio should validate the rendered current-slide preview quickly and show a compact result near the controls. Validation should be advisory during editing, but saving, applying, or promoting reusable layouts should require either a passing result or an explicit draft/unsafe state.

The first implementation should focus on current-slide validation inside the Layout drawer and media controls. It should reuse the shared DOM validation rules where practical, run against the rendered preview, and expose a small set of local mechanical repairs before reaching for broader ADR 0025 assisted remediation candidates.

The implemented baseline covers the Layout drawer and Materials controls. Custom layout preview returns current-slide DOM validation metadata, shows compact validation status beside layout controls, and blocks favorite-ready custom layout saves unless validation passes. Media controls persist structured `media.fit` and `media.focalPoint`, render those values through the shared DOM runtime, and validate the current slide after direct treatment changes.

## Product Rules

- Validation feedback should appear beside the editing controls that can fix the issue.
- The current slide preview should remain the visual source of truth; validation must inspect the rendered DOM result, not only the JSON source.
- Editing may enter invalid states, but the UI should label them clearly.
- Save, apply, and favorite-ready reusable layout actions should require passing required checks unless the user explicitly saves a draft or unsafe layout.
- Common mechanical issues should have direct controls instead of asking regular users to edit JSON.
- Repair controls should be scoped to the active slide or active layout draft.
- Editorial repairs, slide splitting, and LLM rewrites should remain normal candidates under ADR 0025.
- Validation should not silently mutate slide content, media, or layout definitions.
- Validation status should be compact enough to keep the active slide dominant.

## Validation States

Interactive slide editing should expose simple states:

- **Looks good**: current preview passes required current-slide checks.
- **Needs attention**: warning-level issues exist, but the user may continue previewing.
- **Blocked**: required checks fail, so save/apply/favorite-ready promotion is disabled.
- **Draft unchecked**: the preview is stale, invalid JSON prevented validation, or validation has not run yet.

The UI should show the issue category first, then the affected region or field when known:

- `Text clipped in cards`
- `Image cropped in media region`
- `Caption detached from image`
- `Progress area overlap`
- `Too dense for minimum font`

## Repair Controls

The first repair controls should be mechanical and reversible:

- **Fit image**: change media fit from `cover` to `contain`.
- **Fill region**: change media fit from `contain` to `cover` when the issue is empty space rather than cropping.
- **Recenter**: reset media focal point to center.
- **Move focal point**: choose a simple 3x3 focal point.
- **Use safer layout**: switch to a compatible layout with more media or text room.
- **Increase region height**: adjust a bounded layout region when custom layout controls are active.
- **Use compact spacing**: reduce spacing within declared layout tokens.
- **Restore last valid preview**: return to the last locally passing draft.

For cropping, the preferred initial repair is `Fit image`. It is easy to understand, keeps all image pixels visible, and avoids requiring the user to know media-fit JSON. Focal-point controls should be added when users want to keep `cover` while preserving an important subject.

The implemented first repair set includes `Fit image`, `Fill region`, `Recenter`, 3x3 focal-point selection, and `Use compact spacing`. Safer-layout, region-height, and last-valid-preview controls remain optional future extensions that should be driven by observed deck failures.

## Workflow

The live validation loop should be:

1. User changes a render-affecting control.
2. Studio rerenders the current slide preview.
3. Studio runs a bounded current-slide validation pass.
4. Sidebar shows compact validation status and issue list.
5. If an issue has a mechanical fix, show direct repair controls.
6. User applies a repair control.
7. Studio rerenders and reruns the same validation subset.
8. Save/apply/favorite-ready actions become available only when required checks pass.

This loop should not replace full deck checks. It is an immediate authoring guardrail for the current slide.

## Relationship To Existing ADRs

ADR 0015's DOM-first rendering boundary remains authoritative. Live validation should inspect the same DOM runtime used by preview, export, and deck checks.

ADR 0025 covers assisted check remediation after validation reports. This ADR adds local, immediate repair controls for common mechanical failures during editing. Complex or editorial fixes should still become ADR 0025 remediation candidates.

ADR 0026 requires custom layouts to validate before save/apply. This ADR defines how that validation should become visible and actionable while the user adjusts layout controls.

ADR 0005's reusable layout definitions remain JSON data with validation constraints. Live repair controls may edit those structured definitions through bounded controls, but should not introduce arbitrary CSS or hidden renderer behavior.

## Validation

Add coverage for:

- changing layout controls rerenders and validates the current slide preview
- invalid current-slide preview shows a compact blocked state
- text clipping disables apply/save until fixed or saved as draft
- media cropping reports the affected media region
- `Fit image` changes media treatment and clears a cropping issue when appropriate
- focal-point controls update media treatment without changing slide copy
- custom layout favorite save requires a passing current-slide or multi-slide validation result
- manually editing layout JSON returns the preview to an unchecked draft state
- validation findings are cleared or updated after the next render

Browser coverage should include at least one media-heavy slide, one custom layout draft, and one title or cover slide so treatment-only changes do not bypass validation.

## Non-Goals

- No automatic fix-all while the user edits.
- No hidden mutation during validation.
- No replacement for full deck checks before export or quality gate.
- No JSON-only repair requirement for common issues.
- No LLM rewrite as the first answer to mechanical cropping or spacing issues.
- No freeform canvas behavior.
- No guarantee that every validation issue has a local repair control.

## Remaining Questions

- Which current DOM validation checks are fast enough to run on every layout control change?
- Should custom-layout current-slide validation run synchronously after every control change or remain tied to explicit preview?
- How should the UI preserve the last passing draft when the user makes several invalid changes?
- How should focal-point controls represent subject-aware cropping when the image has no detected subject metadata?
