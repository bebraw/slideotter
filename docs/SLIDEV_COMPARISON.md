# Slidev And Slideotter: Competitive Notes

This note compares Slidev with slideotter so we can position slideotter clearly against the strongest developer-focused Markdown slide tool without copying its product center.

Sources reviewed:

- Slidev Why Slidev: <https://sli.dev/guide/why>
- Slidev User Interface: <https://sli.dev/guide/ui>
- Slidev Exporting: <https://sli.dev/guide/exporting.html>
- Slidev Hosting: <https://sli.dev/guide/hosting>
- Slidev CLI: <https://sli.dev/builtin/cli>

## Short Read

Slidev is a developer presentation framework. slideotter is a guarded presentation workbench.

Slidev's strength is that a developer can write a deck in extended Markdown, use Vue components and web technology freely, get instant Vite feedback, present from the browser, and export or host the result. It is excellent for talks where the author wants code-first control, interactive demos, theming through npm, and a static-site-shaped output.

slideotter's strength is that an author can create, ground, review, validate, revise, present, export, and archive structured decks through explicit workflow boundaries. It is less hackable by design. That constraint is the value: generated changes stay inspectable before they become deck state, sources and materials remain presentation-scoped, and validation is part of the authoring loop rather than a cleanup task.

The main lesson is not "become Slidev." The lesson is to be crisp about the split: Slidev wins when the user wants Markdown plus Vue as their slide source; slideotter wins when the user wants controlled generation, structured editing, visual validation, and archived presentation state.

## What Slidev Is Optimized For

Slidev is optimized for developer-authored web decks:

- A deck is primarily an extended Markdown file.
- Authors can use Git and any editor as the main writing surface.
- Vue components, web APIs, iframes, WebGL, Monaco, Shiki, TwoSlash, Mermaid, KaTeX, UnoCSS, Vite plugins, themes, and addons are natural parts of the system.
- Live editing is fast because the browser updates through Vite HMR.
- Presentation mode includes browser playback, presenter mode, overview, notes editing, drawing, camera, recording, shortcuts, and a browser exporter.
- Export targets include PDF, PPTX, PNG, Markdown, and SPA-style hosting outputs.
- Themes and addons can be shared as npm packages.
- The hosted output fits the static web deployment model.

Slidev is strongest for technical talks, engineering education, conference demos, and authors who are comfortable owning the Markdown, CSS, Vue, and runtime behavior directly.

## What Slideotter Is Optimized For

slideotter is optimized for structured, reviewable deck work:

- A deck is a presentation workspace with JSON slide specs, deck context, sources, materials, candidates, validation state, previews, exports, baselines, and archives.
- The browser Studio is the primary workbench, while the shared DOM renderer is authoritative for preview, thumbnails, comparison, presentation mode, PDF export, PPTX handoff, PNG artifacts, and validation.
- LLM-backed work is proposal-oriented: outlines, slides, variants, layout changes, theme changes, deck-length changes, and repair suggestions are previewed and applied explicitly.
- Sources and image materials are presentation-scoped and inspectable.
- Deck creation is staged through brief, source context, editable outline, live slide drafting, theme review, validation, and export.
- Text, layout, media, source, and render checks are first-class workflow constraints.
- The internal source model is intentionally typed and bounded so generated changes can be validated before they write deck files.

The core difference: Slidev asks "what can this developer-authored web deck do?" slideotter asks "what deck change should be accepted, validated, and archived?"

## Important Differences

| Area | Slidev | slideotter |
| --- | --- | --- |
| Primary user | developer author | presentation author with guarded generation needs |
| Primary unit | Markdown slide project | presentation workspace |
| Source model | extended Markdown plus Vue/web components | structured JSON slide specs plus deck state |
| Authoring mode | code/editor first | browser workbench first |
| Generation model | AI can assist source creation, but Markdown remains the deck | LLM output becomes candidates behind review/apply boundaries |
| Runtime power | arbitrary web stack is a core strength | constrained DOM renderer is the authoritative surface |
| Layout model | Markdown, layouts, CSS, Vue components | typed slide families and reusable layout definitions |
| Validation | mostly author/tooling responsibility | layout, text, media, workflow, and render checks are product features |
| Presenter tools | mature presenter mode, notes, overview, drawing, recording | browser presentation route with lighter speaker tooling |
| Export | PDF, PPTX, PNG, Markdown, SPA | PDF archive, PNG previews, image-based PPTX handoff |
| Extensibility | themes, addons, Vite/Vue ecosystem | proposed workflow/provider/validator/exporter/layout/theme plugins |
| Best fit | code-heavy talks and interactive web slides | source-grounded, reviewable, AI-assisted deck production |

## Competitive Positioning

### Slideotter Should Not Claim To Be A Better Slidev

That would be the wrong fight. Slidev is already very strong at developer-first Markdown decks. It has the ecosystem, community expectations, and web-stack openness that code-first authors want.

slideotter should instead claim a different job:

> slideotter is for authors who want AI-assisted presentation work to stay structured, reviewable, validated, and archive-ready.

That positioning makes Slidev a useful adjacent tool rather than a direct replacement target.

### Where Slideotter Can Win

slideotter has a credible advantage when the user cares about:

- controlled LLM generation instead of raw generated Markdown
- source-grounded drafting with presentation-scoped materials
- candidate comparison before writes
- repairable validation failures
- deck-length planning and reversible skip/restore behavior
- local presentation libraries and archives
- visual PDF validation against the rendered output
- typed slide specs that agents can modify safely
- a workbench for non-code authoring decisions

The competitive message should emphasize reliability of the authoring loop, not maximal expressiveness.

### Where Slidev Will Stay Better

Slidev should remain the better choice when the user wants:

- a single Markdown file as the main artifact
- hand-authored Vue components inside slides
- live coding and technical demo primitives
- arbitrary CSS and JavaScript control
- npm theme/addon reuse today
- static-site hosting as the default product shape
- mature presenter notes, overview, drawing, camera, and recording surfaces

Trying to close all of those gaps would pull slideotter away from its strongest product boundary.

## Lessons Worth Borrowing

### 1. The First Run Should Feel Direct

Slidev's path is clear: initialize, edit Markdown, see the deck. slideotter has a richer staged workflow, but the first deck still needs to feel direct.

Useful lesson:

- Keep `npx slideotter init --template tutorial` and `npx slideotter studio` prominent.
- Keep initial creation focused on brief, sources, outline, and first preview.
- Avoid making validation or generation settings feel required before the first successful deck.

### 2. Presenter Tooling Matters

Slidev treats playback as a product surface, not only a rendered output. Presenter mode, overview, notes editing, drawing, camera, and recording make the deck usable during the talk.

Useful lesson:

- Keep `/present` as a real playback product, not a thin preview wrapper.
- Add speaker notes, next-slide preview, elapsed timer, and overview before adding decorative presentation effects.
- Keep presenter-only features read-only unless they intentionally flow back through Studio review.

### 3. Theme And Addon Packaging Should Be Understandable

Slidev's npm theme and addon model gives users a simple mental model: install a package, use it in the deck.

Useful lesson:

- slideotter plugins should have named contribution types and inspectable manifests.
- Layout packs, theme packs, validators, source providers, material providers, and exporters should feel installable without granting arbitrary write access.
- Plugin output that changes deck state should become candidates, materials, validation reports, or export artifacts.

This reinforces ADR 0020's minimal-core plugin direction.

### 4. Web Output Is A Distribution Advantage

Slidev can export or host decks as web apps. That makes sharing natural for developer audiences.

Useful lesson:

- slideotter's Cloudflare hosting path should become a first-class publish target, not just an infrastructure proof.
- Local archive, hosted preview, public link, and imported bundle should share vocabulary.
- Publishing should leave visible metadata in the presentation workspace.

### 5. Developer Ergonomics Still Matter

Even though slideotter is not a code-first Markdown deck tool, the repository and package are still developer-facing.

Useful lesson:

- Keep commands boring and memorable.
- Keep generated files and user data paths easy to inspect.
- Keep the slide-spec model stable enough for agents, scripts, and future plugins to edit safely.

## Where Slideotter Should Not Copy Slidev

### Do Not Make Markdown The Internal Source Of Truth

Markdown is central to Slidev's strength. It is also too loose for slideotter's current value: structured slide families, candidate diffs, material metadata, source grounding, validation settings, layout libraries, deck planning, and reversible state.

Markdown import/export can be valuable later, but it should be a boundary capability, not the canonical deck model.

### Do Not Let Arbitrary Vue Become A Deck Mutation Path

Slidev is powerful because authors can use Vue and web APIs freely. slideotter's generated and assisted workflows need a narrower trust boundary.

Custom HTML/SVG support should remain constrained, sanitized, previewed, validated, and explicit. Arbitrary runtime behavior should not bypass review/apply.

### Do Not Optimize For Live-Only Effects Before Archive Fidelity

Slidev can lean into live interactivity because the web deck is the product. slideotter's promise includes PDF output, PPTX handoff, validation, and archive-ready artifacts.

Effects that cannot survive export should be explicit live-only features, not silent authoring defaults.

### Do Not Treat Static Hosting As The Whole Collaboration Story

Static-site deployment is enough for many Slidev decks. slideotter's Cloudflare direction includes workspace state, jobs, sources, materials, imports, exports, and future collaboration. That is a different problem.

The useful lesson is simple publishing ergonomics, not static output as the whole architecture.

## Opportunities For Slideotter

### Slidev Import Plugin

A plugin could import a Slidev project into slideotter:

- parse slide boundaries from Markdown
- map frontmatter and layout names into deck context
- convert simple slides into supported structured slide families
- import referenced images as presentation materials
- preserve notes as slide context
- detect Vue components, iframes, custom CSS, and live-only behavior as non-round-trippable content
- attach warnings to the imported presentation

This would help Slidev users bring a deck into a reviewable workflow without pretending the round trip is lossless.

### Slidev Export Plugin

A plugin could export a slideotter deck to a constrained Slidev project:

- write a Markdown deck from active slide specs
- copy material assets
- emit frontmatter for theme and basic deck metadata
- map detours into a documented export convention
- include speaker notes where available
- warn when validation metadata, source provenance, custom layouts, or candidate history cannot be represented

This should be an explicit lossy export target, not a replacement for the DOM renderer.

### Competitive Landing Copy

Useful public-facing copy could be:

> Slidev is excellent when you want to hand-code a web-native Markdown deck. slideotter is for the moments before the final deck: shaping the argument, grounding it in sources, comparing generated alternatives, validating the rendered result, and publishing an archive you can inspect later.

This gives Slidev credit and keeps slideotter's claim narrow.

### Presenter Mode Slice

A practical future slice could add:

- current slide
- next slide preview
- speaker notes
- elapsed timer and wall clock
- overview navigation
- optional audience window sync

This would narrow one of Slidev's clearest product advantages without changing slideotter's source model.

### Markdown Bridge

A Markdown bridge could support:

- Markdown import for outlines and simple decks
- Markdown export for review drafts
- Slidev-specific export as a plugin
- Markdown snippets as source material

The bridge should remain explicit and lossy where needed.

## Practical Recommendations

1. Position slideotter as a reviewable AI-assisted presentation workbench, not as a Markdown slide framework.
2. Keep structured JSON slide specs as the canonical deck source.
3. Treat Slidev import/export as plugin territory with loss warnings.
4. Improve presenter tooling only where it supports real talks: notes, next slide, timers, overview, and audience sync.
5. Keep Cloudflare publishing work focused on clear publish targets and durable presentation metadata.
6. Use Slidev's theme/addon packaging as inspiration for manifest-driven plugin contribution types.
7. Keep export promises tied to the shared DOM renderer and validation pipeline.
8. Avoid arbitrary runtime component support unless it stays constrained, sanitized, previewed, and validation-aware.

## Bottom Line

Slidev is the stronger tool for code-first, interactive, Markdown-authored developer talks. slideotter should not compete by becoming a less mature Slidev.

slideotter's stronger opportunity is the workbench around the deck: grounded creation, structured revision, candidate review, validation, presentation-scoped materials, and archive-ready output. The competitive wedge is not "more hackable slides." It is "safer, more inspectable presentation work."
