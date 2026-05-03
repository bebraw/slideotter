# Reveal.js And Slideotter: Observations

This note compares Reveal.js with slideotter so we can learn from the strongest open web presentation runtime without turning slideotter into a lower-level slide framework.

Sources reviewed:

- Reveal.js home and demo: <https://revealjs.com/>
- Reveal.js markup guide: <https://revealjs.com/markup/>
- Reveal.js Markdown guide: <https://revealjs.com/markdown/>
- Reveal.js vertical slides guide: <https://revealjs.com/vertical-slides/>
- Reveal.js PDF export guide: <https://revealjs.com/pdf-export/>
- Reveal.js API methods: <https://revealjs.com/api/>
- Reveal.js plugin guide: <https://revealjs.com/plugins/>
- Reveal.js speaker view guide: <https://revealjs.com/speaker-view/>
- Reveal.js slide numbers guide: <https://revealjs.com/slide-numbers/>

## Short Read

Reveal.js is a presentation runtime and authoring framework. slideotter is a guarded presentation workbench.

Reveal.js is strongest when the author wants direct control over an HTML presentation: nested horizontal and vertical slides, fragments, animations, backgrounds, speaker notes, keyboard navigation, plugins, and a rich JavaScript API.

slideotter is strongest when the author wants the deck state, generation path, validation, and archive workflow to stay inspectable. It trades away arbitrary HTML authoring as the core model so changes can move through preview, compare, validate, and apply boundaries.

The main lesson is not "replace slideotter's presentation mode with Reveal.js." The lesson is to respect Reveal.js where it is clearly mature: two-dimensional navigation, slide coordinates, speaker tooling, plugin boundaries, and web-native presentation affordances.

## What Reveal.js Is Optimized For

Reveal.js is optimized for open web presentations:

- A deck is a `.reveal > .slides > section` DOM hierarchy.
- Top-level `section` elements are horizontal slides.
- Nested `section` elements become vertical slide stacks.
- Authors can write raw HTML or use the bundled Markdown plugin.
- Fragments, transitions, backgrounds, media, math, code highlighting, search, zoom, and notes are established features.
- The JavaScript API controls navigation, fragments, state, layout, overview, pause, and slide lookup.
- Plugins are registered during initialization and can ship as classic scripts or ES modules.
- PDF export uses a print stylesheet path in Chrome or Chromium, with Decktape documented as an alternative command-line route.
- Slides.com provides a hosted visual authoring layer for people who want Reveal.js output without writing the markup directly.

For presentation playback, Reveal.js has a very clear mental model: left/right moves across top-level slides, up/down moves inside an optional vertical stack, and Space can step through all slides. That model is worth treating as the baseline for slideotter's two-dimensional presentation behavior.

## What Slideotter Is Optimized For

slideotter is optimized for structured, reviewable deck work:

- A deck is a presentation workspace with JSON slide specs, deck context, sources, materials, candidates, validation state, and archives.
- The browser Studio is the authoring surface.
- The server owns durable writes, generation, validation, archive refresh, and apply boundaries.
- Generated and assisted changes remain proposals until the user compares and applies them.
- The shared DOM renderer powers active preview, thumbnails, presentation mode, validation, PDF output, and PPTX handoff.
- Two-dimensional presentations model core-path slides with optional vertical detours.
- Deck planning, length scaling, source grounding, layout candidates, and validation are product workflows rather than raw runtime features.

The core difference: Reveal.js asks "how should this HTML presentation behave?" slideotter asks "what deck change should become accepted state?"

## Important Differences

| Area | Reveal.js | slideotter |
| --- | --- | --- |
| Primary unit | HTML presentation | presentation workspace |
| Source model | DOM sections, optional Markdown | structured JSON slide specs plus deck state |
| Authoring mode | code-first, with Slides.com as visual option | browser workbench first |
| Runtime model | web presentation framework | guarded authoring plus shared DOM renderer |
| Two-dimensional slides | nested `section` stacks | core slides with optional detours |
| Navigation | mature horizontal/vertical keyboard model | should mimic Reveal.js behavior where applicable |
| Changes | direct edits to markup/source | proposal, compare, validate, apply |
| Plugins | runtime plugins and built-in feature plugins | proposed workflow, provider, validator, exporter, and pack plugins |
| Speaker tools | notes plugin, next-slide preview, timer, pacing | browser presentation mode, still lighter on speaker tooling |
| Export | browser print path or Decktape | build/export/archive through controlled services |
| Validation | runtime correctness mostly left to the author | layout, media, text, browser workflow, and render baselines |

## Lessons Worth Borrowing

### 1. Two-Dimensional Navigation Should Feel Boring

Reveal.js has trained many users on the horizontal/vertical deck convention. Top-level slides form the main line; vertical slides are optional depth below a top-level slide.

Useful lesson:

- Keep left/right on the core path.
- Keep down/up inside detours.
- Let presenters skip detours by continuing right.
- Represent the current position with coordinates that make the relationship clear.

This reinforces slideotter's recent presentation-mode fixes: optional depth should be available without confusing the main path.

### 2. Slide Coordinates Need Better Product Language

Reveal.js supports multiple slide-number formats, including horizontal/vertical coordinates and flattened numbers. That flexibility exists because nested slides create a real numbering ambiguity.

Useful lesson:

- Avoid pretending detours are ordinary linear slides.
- Prefer labels such as `2`, `2a`, `2b` or `2.1`, `2.2` depending on context.
- In authoring surfaces, explain detours as attached depth, not as separate top-level slides.
- In export/archive paths, keep the core path visibly distinct from optional material.

This directly informs slideotter's subslide numbering and thumbnail work.

### 3. Speaker Tooling Is Part Of Playback, Not Authoring

Reveal.js speaker view includes per-slide notes, next-slide preview, elapsed time, wall-clock time, and pacing timers. It is separate from authoring, but tightly integrated with playback.

Useful lesson:

- slideotter should keep presentation mode lightweight, but speaker notes and next-slide preview are natural additions.
- Presenter-only surfaces should not mutate deck state.
- Any future speaker window should reuse the existing presentation route and deck coordinates rather than inventing a parallel playback model.

### 4. Runtime Plugins Are Not Workflow Plugins

Reveal.js plugins extend runtime behavior: Markdown parsing, highlighting, speaker notes, search, math, zoom, and more. They are loaded during presentation initialization.

Useful lesson:

- slideotter can borrow the clarity of named plugin contributions, but not the runtime trust model.
- A slideotter plugin that changes deck content should produce candidates, materials, validation reports, or export artifacts.
- Presentation-runtime extensions should be narrower than authoring-workflow extensions.

This supports ADR 0020's minimal-core plugin direction.

### 5. HTML Is A Great Output Runtime And A Risky Authoring Core

Reveal.js works because open web technologies are the product. Authors can use CSS, JavaScript, iframes, custom backgrounds, and arbitrary markup.

Useful lesson:

- slideotter should keep the browser DOM as the reference rendering surface.
- It should not make arbitrary HTML the core editable model.
- Custom HTML/SVG should stay constrained, sanitized, previewed, and validated through the same candidate path as other rich content.

This reinforces ADR 0015's DOM-first rendering boundary and ADR 0027's constrained custom artifact support.

### 6. PDF Export Should Stay Browser-Based But Automated

Reveal.js documents a browser print path and points to Decktape for command-line conversion. That is pragmatic for an HTML presentation framework.

Useful lesson:

- slideotter is right to use browser rendering for PDF, but should keep export automated through project commands and server services.
- Manual browser print settings are a poor fit for slideotter's archive guarantee.
- Export diagnostics should remain part of the workflow, not an afterthought.

This reinforces the existing build/archive model.

## Where Slideotter Should Not Copy Reveal.js

### Do Not Make Raw HTML Sections The Source Of Truth

Reveal.js sections are elegant for author-controlled decks. slideotter's value depends on typed slide families, material metadata, source grounding, candidate diffs, deck planning, validation settings, and reversible length behavior.

Raw HTML can be an import/export or custom-artifact boundary. It should not replace structured slide specs.

### Do Not Add Presentation Effects Before Workflow Clarity

Reveal.js has fragments, transitions, backgrounds, auto-animate, auto-slide, overview, and many other expressive features. Those are useful when the author controls pacing and markup.

slideotter should add effects only when they strengthen the deck argument and remain visible in preview, validation, PDF/PPTX handoff, and archive output. Effects that only work live are risky unless explicitly marked as live-only.

### Do Not Let Runtime Plugins Write Deck State

Reveal.js plugins run inside the presentation. That is appropriate for a runtime framework.

In slideotter, deck mutation belongs behind server-owned actions and review/apply boundaries. Runtime plugins should not silently rewrite slides or deck context.

### Do Not Treat Slides.com As The Product Target

Slides.com proves that Reveal.js can support a visual authoring layer. But slideotter's workbench is not a general visual editor; it is a structured review surface for grounded, generated, and validated deck changes.

The useful lesson is ergonomic authoring, not freeform canvas parity.

## Opportunities For Slideotter

### Reveal.js Import Plugin

A plugin could import a Reveal.js deck into slideotter:

- parse the `.reveal > .slides > section` hierarchy
- map horizontal slides to core slides
- map vertical stacks to detours
- import images and media as presentation materials
- preserve speaker notes as slide context
- convert simple fragments into notes or staged bullet states
- warn when custom JavaScript, complex CSS, or live-only behavior cannot round-trip

This would help users bring existing HTML decks into the structured workbench without making HTML the internal model.

### Reveal.js Export Plugin

A plugin could export a slideotter deck to a constrained Reveal.js project:

- emit `index.html` with the required Reveal.js hierarchy
- copy material assets
- map core slides and detours into nested sections
- include speaker notes where available
- emit a minimal config file or initialization block
- warn when slideotter validation, archive metadata, or workflow state cannot be represented

This should be a named export target with loss warnings, not a hidden replacement for the DOM renderer.

### Presentation Mode Benchmark

Reveal.js should remain the behavioral reference for slideotter's `/present` route:

- keyboard direction behavior
- URL coordinate behavior
- overview or jump affordance
- slide-number conventions
- speaker notes behavior
- touch navigation expectations

The goal is not full API compatibility. The goal is to avoid surprising presenters who already understand two-dimensional web decks.

### Speaker View Slice

A small future slice could add:

- current slide
- next core slide or next detour preview
- speaker notes from slide context
- elapsed timer
- current clock
- slide coordinate

This would be a presentation-mode feature, not a Studio editing feature.

## Practical Recommendations

1. Keep slideotter's internal source model as structured JSON.
2. Treat Reveal.js as the reference for two-dimensional presentation navigation.
3. Improve detour labels and thumbnails so optional depth does not read as ordinary linear slide numbering.
4. Keep browser PDF export automated through slideotter commands rather than manual print instructions.
5. Consider a constrained Reveal.js import/export plugin after the plugin system has a stable data boundary.
6. Add speaker-view support only as a read-only playback companion.
7. Keep custom HTML/SVG constrained and validated; do not widen it into arbitrary deck source.
8. Use Reveal.js plugin clarity as inspiration, but keep slideotter workflow plugins behind server-owned review/apply boundaries.

## Bottom Line

Reveal.js is the stronger model for hand-authored, web-native presentation playback.

slideotter's stronger opportunity is structured, reviewable, AI-assisted deck authoring that can still present well in the browser. The best lessons from Reveal.js are playback lessons: horizontal/vertical navigation, coordinate clarity, speaker tooling, plugin naming, and web-native rendering.

Those ideas fit slideotter best when they make presentation mode feel familiar while preserving the stricter workbench model that protects deck state.
