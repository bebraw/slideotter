# ADR 0056: Visual Editorial Quality System

## Status

Implemented.

## Context

Recent generated decks exposed a quality gap: slideotter can now avoid obvious layout failures, semantic leaks, and unreadable overflows, but the resulting slides can still feel bland. Plain bullets are useful as a safe fallback, yet they should not become the default visual target for generated decks.

The current system has strong mechanical boundaries:

- structured slide specs
- DOM-first rendering and validation
- visible-text quarantine
- minimal built-in layout primitives
- custom and saved layout definitions
- generated candidates that require explicit review/apply

Those boundaries protect correctness, but they do not yet encode enough visual editorial judgment. Good presentation systems need more than fit checks. They need focal point, hierarchy, rhythm, contrast, and slide-type variation.

External presentation guidance is consistent on several points:

- Slides should communicate one main idea quickly, often as a visual aid rather than a document page.
- Titles and body text should be presentation-scale; several current guides recommend roughly 36-44pt titles and 24pt or larger body text for projected readability.
- Body line length should be constrained rather than spanning the full slide.
- Whitespace should create intentional hierarchy, not accidental emptiness.
- Strong deck systems map layouts to slide jobs instead of using one generic content layout everywhere.

Useful public references include:

- Duarte's slide design makeover guidance: https://www.duarte.com/resources/webinars-videos/what-would-duarte-do-slide-design-makeovers/
- Duarte's presentation-system case study framing: https://www.duarte.com/approach/case-studies/scaling-communication-with-presentation-systems/
- Whitepage presentation font-size guidance: https://www.whitepage.studio/blog/presentation-font-sizes
- SlidesMate typography guidance: https://slidesmate.com/blog/presentation-fonts-and-typography
- PresentationGo font guidance: https://www.presentationgo.com/article/best-fonts-for-powerpoint-presentations/
- SlideModel visual hierarchy guidance: https://slidemodel.com/visual-hierarchy-for-presentations/
- Pitch Deck Inspo as a slide-type inspiration gallery: https://www.pitchdeckinspo.com/

## Decision Direction

Add a visual editorial quality layer for generated and candidate slides.

This layer should improve how slides look and feel without weakening slideotter's existing guarded workflow. It should remain data-driven, DOM-rendered, validated, reviewable, and compatible with ADR 0049's minimal built-in layout boundary.

The goal is not to add a large template gallery to core. The goal is to make generation choose and validate stronger compositions from a small set of presentation-scale editorial patterns, then route long-tail style variety through custom layouts, saved layouts, layout packs, materials, and themes.

Plain bullets should remain a baseline fallback for clarity. They should not be the normal aspiration for content slides.

## Implementation Summary

The implemented baseline adds `compositionIntent` metadata to generated slide specs, LLM slide schemas, staged drafting context, and slide-spec validation. Generated materialization now chooses between statement, spotlight, bullets, checklist, cover, summary, divider, photo-grid, and image-split archetypes from slide role, layout, content shape, and available materials.

The DOM renderer includes dedicated statement, spotlight, bullet, and image-split paths so content slides can avoid default container-heavy layouts when a stronger composition is available. Rendered validation reports editorial diagnostics for focal dominance, line length, vertical balance, and repeated adjacent composition rhythm while preserving existing geometry, text, and media checks.

Deterministic tests cover composition-intent schema validation, image-split rendering, material-aware archetype choice, and explainable editorial diagnostics. The ADR remains the durable rule set for future improvements, while broader template variety continues through custom and saved layout definitions rather than a large built-in gallery.

## Product Rules

- Every generated slide should have an explicit focal point: a claim, number, quote, visual, comparison, timeline step, or dominant artifact.
- Text should be sized for presentation use, not document reading. Shrinking text below readable thresholds is a failure mode, not a solution.
- Generated content slides should prefer one strong statement plus concise support over same-weight lists.
- Body text should use constrained line lengths.
- Whitespace should be compositionally intentional: enough breathing room, but with a clear visual landing point.
- Adjacent slides should vary by job and composition where the narrative allows.
- Containers, borders, and panels should be used only when they clarify structure or frame a real artifact. They should not be the default way to make text feel designed.
- Themes should produce useful contrast, accent behavior, and slide rhythm, not just a palette applied to the same layout.
- Visual inspiration should be stored or represented as reusable layout/theme guidance, not copied as opaque screenshots or arbitrary CSS.

## Editorial Archetypes

The first implementation should define a small set of generated composition archetypes. These are not a broad template marketplace; they are reusable slide jobs that can be validated mechanically.

Candidate archetypes:

- **Statement**: large claim, short support line, optional tiny evidence row.
- **Big Number Or Keyword**: one large datum or phrase with two short implications.
- **Image Split**: full-height or full-bleed visual area with attached caption/source and compact text.
- **Quote Pull**: dominant quote or source excerpt with attribution/context.
- **Compare**: two-sided contrast with strong labels and balanced copy.
- **Timeline Or Steps**: sparse sequence with clear motion and consistent spacing.
- **Evidence Stack**: one claim supported by two or three compact evidence points.
- **Plain Bullets**: fallback when no stronger structure is justified or available.

Generation should choose these based on slide role, content shape, available materials, and neighboring slide rhythm.

## Quality Metrics

Extend validation and/or candidate scoring with visual editorial signals. These should start as diagnostics and become stricter only when they prove reliable.

Potential checks:

- focal point exists and is visually dominant
- title/body/caption font sizes meet presentation thresholds
- body line length stays within readable bounds
- slide text density stays within deck constraints
- content does not crowd edges, captions, neighboring panels, or progress area
- major elements align to an intentional grid
- whitespace is not extremely top-heavy, bottom-heavy, or empty around tiny content
- adjacent slides do not all use the same composition
- images are large enough to matter when selected
- accent color is used deliberately and with adequate contrast

These checks should inspect rendered DOM geometry where possible, following ADR 0015.

## Theme Direction

Theme generation should become more editorial.

Themes should define:

- type scale and hierarchy, not only font family
- accent usage rules
- background strategy
- image treatment defaults
- progress treatment
- section or archetype rhythm
- contrast constraints

Themes should avoid one-note palettes and should not rely on decorative gradient blobs or arbitrary ornament. When a deck has a real brand, product, venue, or person, the theme should make that subject visible through appropriate media or brand tokens rather than generic decoration.

## Relationship To Existing ADRs

ADR 0015 remains authoritative: visual editorial quality must be evaluated through the shared DOM renderer and rendered PDF/PNG output.

ADR 0018 provides the existing rich slide-family baseline. This ADR adds editorial composition quality on top of those families rather than replacing them.

ADR 0048 owns title-slide editorial quality. This ADR extends the same concern to content, summary, media, and generated deck rhythm.

ADR 0049 keeps core built-ins minimal and routes long-tail layout variety through user-defined layouts. This ADR should add only a small, high-quality set of editorial archetypes to core and use custom/saved layout definitions for broader style variety.

ADR 0050 remains the text safety boundary. Visual quality work must not allow planning labels, source scaffolds, or authoring guardrails to leak into visible slide fields.

ADR 0028 remains the token-efficiency boundary. Visual inspiration and composition guidance should be compact, structured, and scoped to the current workflow.

## Implementation Plan

1. Define a compact `visualIntent` or `compositionIntent` layer for generated slides.
2. Add two or three high-impact content archetypes first: statement, big-number/keyword, and image split.
3. Keep plain bullets as fallback and require generation to explain why no stronger archetype applies when used for normal content slides.
4. Add rendered diagnostics for focal dominance, body line length, readable font size, and vertical balance.
5. Teach staged generation and Redo Layout to consider neighboring slide composition rhythm.
6. Extend theme generation with type scale, accent behavior, and image-treatment guidance.
7. Store reusable editorial layouts as layout definitions where possible, with preview and validation evidence before favorite/save.
8. Add deterministic fixtures for bland-slide regressions: all-bullet decks, same-layout repetition, tiny-text layouts, and container-heavy content slides.
9. Run real-provider fuzz checks against LM Studio when changing generation prompts or visual archetype choice.

## Non-Goals

- Do not introduce arbitrary model-authored CSS, HTML, JavaScript, or SVG as a route to visual polish.
- Do not add a broad built-in template gallery to core.
- Do not make validation depend on subjective aesthetic scores without explainable rendered evidence.
- Do not lower readability thresholds to fit more copy.
- Do not copy third-party deck designs into repository assets.
- Do not bypass candidate review/apply boundaries for visual improvements.

## Validation

Before moving this ADR to implemented:

- `npm run quality:gate` passes.
- New layout/archetype fixtures validate geometry, text, and rendered output.
- Generated decks demonstrate at least three distinct content compositions without semantic leaks.
- Plain bullets remain available and readable, but are no longer the dominant generated content default.
- Visual diagnostics are explainable in check output or candidate metadata.
- Rendered examples are inspected from PDF/PNG output, not only source coordinates.
