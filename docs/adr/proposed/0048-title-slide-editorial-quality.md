# ADR 0048: Title Slide Editorial Quality

## Status

Accepted implementation plan.

## Context

Generated title slides currently tend to use the safest available cover pattern: a large title, a short summary, and three compact cards. That pattern is clear and validates well, but repeated use makes generated decks feel templated and less editorial than hand-authored presentations.

The problem is not only visual variety. Opening slides have different jobs:

- name the deck
- establish a point of view
- orient a specific audience
- introduce a place, product, person, or project
- preview a workflow or decision
- create a clean section handoff

Treating all of those jobs as the same card-backed cover weakens the first impression. At the same time, adding many hardcoded cover templates would increase renderer, validation, prompt, and maintenance cost.

## Decision Direction

Improve title slides by adding explicit opening intent and a small number of editorial cover treatments instead of expanding a large template gallery.

The opening slide should be materialized from a declared or derived `coverIntent`, such as `statement`, `identity`, `agenda`, `proof`, or `chapter`. Each intent maps to a constrained rendering treatment with clear text budgets and validation rules.

Cover cards should become optional for generated title slides. The model should not be required to fill three cards when a stronger opening would be a single statement, a visual anchor, or a concise agenda question set.

## Product Rules

- Title slides should feel like editorial openings, not generic dashboards.
- The first slide should have one clear job.
- Generated opening slides should not default to three cards unless cards support the job.
- Strong title-only or title-plus-image openings are valid.
- Cover text should be even shorter than content-slide text.
- Title slide treatments must remain structured slide specs, not arbitrary HTML or custom CSS.
- The renderer should validate title, summary, cards, and media against the selected cover treatment.
- Users should be able to override or save title slide treatments through the existing layout workflow.

## Cover Intents

The first implementation should support a small set of opening intents:

- **Statement**: large title, one concise subtitle, no cards.
- **Identity**: brand, place, product, or project-first opening with optional image/logo.
- **Agenda**: title plus two or three short audience questions or section promises.
- **Proof**: title plus one material-backed visual or concrete evidence card.
- **Chapter**: section-like title slide used when a generated deck starts a major topic.

These are product intents, not necessarily separate slide families. They can be represented as cover slide fields plus a constrained `layout` or layout definition.

## Generation Behavior

Generation should produce or allow the server to derive:

- opening intent
- title
- subtitle or summary
- optional cards, only when useful
- optional material id for image-led openings
- rationale for why the treatment fits the deck

Materialization should choose from available cover treatments based on the intent and available material. If the requested treatment cannot validate, it should fall back to a simpler treatment rather than adding more text.

Prompts should explicitly say that the opening slide does not need three cards. The model should optimize for a crisp first viewport, not for filling every schema field with visible copy.

## Renderer And Schema Direction

Keep the existing `cover` family, but loosen the cover contract where needed:

- allow zero to three cards for cover slides
- keep title and summary required
- keep note optional when a treatment does not show it
- add or derive `coverIntent` if it materially improves generation and review
- validate each treatment with its own text and media limits

The renderer should expose a small number of cover treatment classes or layout definitions, but those treatments should be reusable through the layout library rather than hardwired to one prompt path.

## Validation

Coverage should include:

- generated cover slides without cards
- generated cover slides with one material-backed visual
- title and subtitle text budgets
- first-slide validation for overflow and progress-area spacing
- fallback when an intended cover treatment cannot fit
- regression tests that generated decks do not always use the same card-heavy cover treatment

Rendered browser/PDF output remains authoritative for visual quality.

## Relationship To Existing ADRs

ADR 0010 keeps LLM output behind validated structured candidates. Title-slide intent should be model-proposed or server-derived data, not direct rendering authority.

ADR 0015 keeps the DOM renderer authoritative. Title-slide treatments should render through the same preview, export, and validation path.

ADR 0018 records the existing slide-family and layout-library baseline. This ADR improves the cover family without introducing a broad new family set.

ADR 0026 records custom layout authoring. Strong title treatments should be saveable and reusable through the same layout library when practical.

ADR 0049 should govern how many built-in title treatments belong in core. If a title treatment is brand-, domain-, or team-specific, it should likely be a user-defined or imported layout rather than a new core template.

## Non-Goals

- No large gallery of built-in cover templates.
- No arbitrary CSS for title slides.
- No second rendering path.
- No model-written layout code.
- No guarantee that every title slide uses an image.
- No decorative variety that weakens validation or readability.

## Open Questions

## Resolved Questions

- `coverIntent` should be persisted as an optional cover-slide field. It is descriptive intent for generation, review, and treatment-specific validation, not direct rendering authority. Older cover slides may derive an intent from existing fields and layout choices.
- Cover cards should become optional for all `cover` slides, not only generated cover slides. The cover family should allow zero to three cards, while specific treatments or reusable layout definitions may require a stricter count. `toc` slides should keep their exact-card outline contract.
- Title treatments should use both named `layout` values and reusable layout definitions. Core named layouts provide stable primitives; deck-local, favorite, imported, or generated layout definitions provide team-specific and long-tail variety.
- Core fixtures should cover only baseline editorial jobs: `statement`, `identity`, `agenda`, `proof`, and `chapter`. Decorative variants, brand-specific treatments, unusual crops, and typography experiments should move through user-defined layouts under ADR 0049.
