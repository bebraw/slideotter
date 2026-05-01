# ADR 0025: Assisted Check Remediation

## Status

Proposed implementation plan.

## Context

The browser studio can run deck checks from a compact masthead control and show focused validation reports. The checks cover schema, geometry, text fit, render state, media placement, captions, sources, progress-area spacing, and related workflow fixtures.

That makes problems visible, but it does not yet give authors a clear path to resolve them. A validation error can be technically precise while still leaving the author unsure whether to shorten text, change layout, swap an image, relax a severity setting, split a slide, or accept the issue as intentional.

The studio should help turn failed checks into repair decisions without hiding judgment from the user. Fixing a presentation is partly mechanical and partly editorial; the tool can propose options, but the author should decide which option preserves the intended story.

## Decision Direction

Add assisted remediation for check results.

Each actionable validation issue should be able to produce one or more repair options. Repair options should become normal candidates with preview, compare, rationale, and explicit apply. The user chooses how to resolve each issue or issue group.

Checks should remain independent from repair. Running checks reports current state. Repair starts only when the user asks for options for a specific issue, slide, or group of related issues.

## Product Rules

- Check results should identify the affected slide, rule, severity, and likely cause.
- Actionable issues should offer a `Resolve` or `Suggest fixes` affordance.
- The tool should present multiple strategies when there is more than one reasonable fix.
- The user should choose the repair strategy before the deck is mutated.
- Repairs should flow through the existing candidate, preview, compare, validate, and apply path.
- Repairs should preserve slide intent and visible meaning unless the user explicitly chooses an editorial rewrite.
- Mechanical fixes may adjust layout, spacing, media fit, caption placement, or theme tokens within declared limits.
- Editorial fixes may rewrite text, split content, or change slide family, but must be clearly labeled.
- Severity changes should be treated as policy changes, not content fixes.
- Dismissed or accepted issues should be recorded separately from fixed issues.

## Remediation Strategies

Common repair strategies should include:

- **Rewrite shorter**: reduce overflowing text while preserving the core claim.
- **Adjust layout**: choose a compatible layout treatment with more space for the current content.
- **Split slide**: turn one dense slide into two or more structured slides.
- **Change family**: convert content to a better slide family such as quote, divider, photo, photo-grid, checklist, or summary.
- **Repair media placement**: crop, fit, resize, or realign media and captions.
- **Move caption/source**: attach figure text more clearly to the related visual.
- **Adjust theme tokens**: repair contrast or progress-indicator visibility.
- **Change severity**: update validation policy when the issue is acceptable for this deck.
- **Dismiss intentionally**: mark an issue as reviewed when no change should be made.

The UI should describe the consequence of each option before the user chooses it.

## UI Shape

The check report should become a decision surface:

- group issues by slide and rule
- show a concise issue explanation
- link to the affected slide
- show the relevant preview area when possible
- offer repair options for actionable issues
- show candidate previews and diffs before apply
- allow the user to apply one fix, skip the issue, dismiss the issue, or change severity
- rerun the relevant checks after apply

For issue groups, the studio may offer batch suggestions, but batch apply still needs review. The user should be able to apply fixes one at a time when editorial tradeoffs matter.

## Candidate Shape

Repair candidates should use the same proposal model as other generated changes:

```json
{
  "kind": "check-remediation",
  "sourceIssue": {
    "ruleId": "text-fit",
    "severity": "error",
    "slideId": "slide-12"
  },
  "strategy": "rewrite-shorter",
  "rationale": "Shortens the second bullet to fit the available card height.",
  "changeScope": "slide-field",
  "requiresReview": true
}
```

The candidate should carry enough metadata to explain why it exists and which check it intends to resolve. Apply should verify that the original issue still exists or that the affected source has not changed in a way that invalidates the candidate.

## Server Behavior

The server should own remediation planning and apply boundaries:

- map validation issues to supported remediation strategies
- generate mechanical candidates locally where possible
- use configured LLMs for editorial candidates when needed
- render candidate previews through the shared DOM runtime
- validate candidate output before returning it
- apply only after explicit user confirmation
- rerun the relevant validation subset after apply

The server should not automatically repair every failing check after validation. Automatic repair is too risky for editorial content and would make the validation loop less inspectable.

## Relationship To Existing ADRs

ADR 0001's validation controls remain the policy layer for check severity and media validation depth. Assisted remediation adds an action layer after check results.

ADR 0010's LLM-planned candidate model applies to editorial remediation. The model may propose shorter wording or slide-family changes, while local validation owns materialization, preview, and apply.

ADR 0015's DOM-first rendering boundary remains unchanged. Repair candidates should be judged against rendered output, not only source coordinates.

ADR 0022's selection-scoped command model can inform issue-scoped repairs: a validation issue should behave like an explicit scope, so repair proposals only touch the affected slide field or visual region unless the user expands scope.

ADR 0024's inline current-slide generation direction means slide-local repairs should be reachable from the current slide workbench as well as from the check report.

## Validation

Add coverage for:

- check report lists actionable remediation options for known issue types
- repair candidates carry source rule, slide id, strategy, and rationale
- applying a repair candidate requires explicit confirmation
- repair candidates cannot mutate unrelated slides or fields without expanded scope
- stale repair candidates are rejected when the underlying slide changed
- mechanical media repairs rerun media validation after apply
- editorial text repairs rerun text/geometry validation after apply
- severity changes update validation settings, not slide content
- dismissed issues remain visible as reviewed decisions

## Non-Goals

- No automatic fix-all on validation failure.
- No hidden mutation during check runs.
- No bypass of preview, compare, validation, or apply.
- No guarantee that every validation issue has an automated fix.
- No replacement for author judgment on editorial tradeoffs.
- No weakening of validation defaults to make reports look clean.

## Accepted Answers

- First remediation support should target mechanical, low-judgment issues: `media-legibility`, `caption-source-spacing`, `bounds`, and simple text overflow or text-fit failures. Editorial rewrites, slide splitting, and family changes should wait until the candidate plumbing is proven.
- Dismissals should persist per issue fingerprint scoped to the presentation and slide. The fingerprint should include `slideId`, `rule`, normalized message or category, and relevant field or region when available. If the slide content changes materially, the dismissal should no longer match.
- Batch repair is allowed for purely mechanical issues, but only as a reviewed candidate group. The user must preview the combined result and apply explicitly; there is no automatic fix-all.
- Candidates that fix multiple related issues should carry a `sourceIssues` array, a clear strategy label, and a summary such as `Fixes 3 media spacing issues on slide 8`. The compare view should list every source issue it claims to address and rerun validation after apply.
- Headless clients should eventually receive remediation through ADR 0013 hypermedia actions, but only after the browser path works. Hypermedia should expose issue-scoped remediation discovery and candidate creation, not direct mutation, and should preserve the same preview/apply boundary as the UI.
