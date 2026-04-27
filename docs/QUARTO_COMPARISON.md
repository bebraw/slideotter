# Quarto And Slideotter: Observations

This note compares Quarto with slideotter so we can learn from a mature publishing tool without drifting away from slideotter's product shape.

Sources reviewed:

- Quarto presentations overview: <https://quarto.org/docs/presentations/>
- Quarto Revealjs guide: <https://quarto.org/docs/presentations/revealjs/>
- Quarto project basics: <https://quarto.org/docs/projects/quarto-projects.html>
- Quarto extensions and filters: <https://quarto.org/docs/extensions/formats.html>, <https://quarto.org/docs/extensions/filters.html>
- Quarto publishing docs: <https://quarto.org/docs/publishing/>
- Quarto visual editor docs: <https://quarto.org/docs/visual-editor/>

## Short Read

Quarto is a document-publishing system. slideotter is a guarded presentation workbench.

Quarto's strength is that authors write portable text-first documents and render them to many targets. It leans on Pandoc, Markdown, YAML metadata, executable code cells, projects, extensions, and publishing commands.

slideotter's strength is that authors work with structured slide specs, sources, materials, candidates, previews, validation, and archives through an explicit review/apply loop. It is less general than Quarto, but that is also the point: it keeps generated presentation changes inspectable before they become deck state.

The main lesson is not "become Quarto." The lesson is to borrow Quarto's mature boundaries: plain project configuration, extension packaging, multi-output discipline, freeze/cache semantics, and publishing ergonomics.

## What Quarto Is Optimized For

Quarto is optimized for source-first technical publishing:

- Documents are usually `.qmd`, `.ipynb`, `.md`, or `.Rmd` files.
- Markdown and YAML metadata are the primary authoring surface.
- Projects share metadata through `_quarto.yml`.
- Rendering can target HTML, PDF, Word, websites, books, manuscripts, and presentations.
- Presentation formats include Revealjs, PowerPoint, and Beamer.
- Computation can be embedded and rendered with controlled execution behavior.
- Publishing can target services such as GitHub Pages, Netlify, Posit Connect, Quarto Pub, Confluence, and others.
- Extensions can add formats, filters, shortcodes, templates, and bundled resources.

For presentations, Quarto treats slides as a document-rendering target. Slide boundaries come from headings or horizontal rules, and Revealjs is the most capable presentation format. This gives authors a fast path from Markdown to slides, especially when the deck is technical, code-heavy, or part of a broader publishing project.

## What Slideotter Is Optimized For

slideotter is optimized for structured presentation authoring:

- A deck is a presentation folder with JSON slide specs, deck context, sources, materials, generated candidates, and state.
- The browser studio is the primary authoring surface.
- The server owns writes, generation, validation, and apply boundaries.
- Generated work is proposal-oriented: candidates are previewed and compared before apply.
- The shared DOM runtime is authoritative for preview, presentation mode, PDF export, PNG artifacts, and validation.
- Sources and materials are presentation-scoped and inspectable.
- Deck length changes are reversible through skip/restore state.
- ADRs now define future directions for hypermedia APIs, statecharts, Cloudflare hosting, and plugins.

The core difference: Quarto asks "how do we render this source document?" slideotter asks "what change should this deck accept?"

## Important Differences

| Area | Quarto | slideotter |
| --- | --- | --- |
| Primary unit | document or project | presentation workspace |
| Source model | Markdown plus YAML metadata | structured JSON slide specs plus deck state |
| Authoring mode | source-first, with optional visual editing | browser workbench first |
| Generation model | render source to output | propose, compare, validate, apply |
| Extensions | Pandoc filters, formats, shortcodes, templates | proposed plugin actions, providers, validators, packs |
| Output targets | many document and web formats | DOM preview, presentation mode, PDF, archive |
| Computation | first-class executable code cells | not a core goal |
| Publishing | broad publish command ecosystem | local archive now, Cloudflare hosting proposed |
| Validation | render and toolchain correctness | slide layout, media, text, workflow, render baselines |

## Lessons Worth Borrowing

### 1. Project Configuration Should Be Boring

Quarto projects use `_quarto.yml` to share metadata, output options, and render behavior across files. slideotter already has deck context and presentation state, but the split is more product-specific.

Useful lesson:

- Keep durable deck/project configuration explicit and reviewable.
- Prefer stable config files over hidden runtime state for decisions that should travel with a deck.
- Reserve ignored runtime state for sessions, drafts, transient jobs, and local UI state.

This reinforces ADR 0006's user-data direction and ADR 0013's need for discoverable application state.

### 2. Extension Boundaries Need Package Shapes

Quarto's extension model is mature because extension types are named and packaged: filters, formats, shortcodes, templates, and resources. Filters operate on Pandoc's AST; formats provide defaults and assets.

Useful lesson:

- slideotter plugins should not be vague "run custom code" hooks.
- Plugin contribution types should stay named: workflow action, validator, material provider, source provider, exporter, layout pack, theme pack, provider adapter.
- Each contribution should have a manifest entry, permission requirements, input/output schemas, and validation.

This supports ADR 0020's minimal-core plugin direction.

### 3. Multi-Output Is A Discipline, Not A Checkbox

Quarto can render the same source into multiple outputs because it has a strong intermediate document model and accepts output-specific behavior. Presentations can become Revealjs, PowerPoint, or Beamer, but the formats do not have identical capabilities.

Useful lesson:

- slideotter should be careful about promising multiple export targets.
- If future plugins add exporters, each exporter needs capability declarations and validation expectations.
- The DOM renderer should remain the reference output unless a new ADR defines another renderer boundary.

This reinforces ADR 0015: do not add a second renderer casually.

### 4. Publishing Should Be A First-Class Workflow

Quarto has a clear publishing story: render locally or in CI, then publish to known destinations. It also records publish destinations in project files where appropriate.

Useful lesson:

- slideotter's archive command is a good local publishing primitive, but it should grow into a clearer "publish target" model.
- Cloudflare hosting should have explicit deploy/export/publish records rather than hidden one-off commands.
- Local archive, hosted preview links, and public presentation links should share a vocabulary.

This directly informs ADR 0019.

### 5. Freeze/Cache Semantics Matter

Quarto's freeze behavior is valuable because executable documents can be expensive or fragile to rerun. slideotter has analogous problems with LLM generation, image search, exports, and validation.

Useful lesson:

- Treat generated candidates, retrieved sources, imported materials, and export artifacts as cacheable results with explicit provenance.
- Preserve enough job metadata to know when a result is stale.
- Make re-run versus reuse a product choice, not an accidental cache hit.

This fits ADR 0012's progressive generation state and ADR 0017's source-grounding diagnostics.

### 6. Visual Editing Should Not Hide Source

Quarto's visual editor is WYSIWYM: it improves editing ergonomics while preserving Markdown as the underlying document model.

Useful lesson:

- slideotter should keep direct manipulation subordinate to structured slide specs.
- A future visual editor should edit schema fields and layout parameters, not become a freeform canvas.
- The user should always be able to inspect the structured source behind the rendered slide.

This matches the roadmap warning that a freeform visual editor would fight the structured model.

## Where Slideotter Should Not Copy Quarto

### Do Not Make Markdown The Core Slide Model

Markdown is excellent for portable documents. slideotter's richer behavior depends on structured fields: slide family, media metadata, source grounding, candidate diffs, layout treatments, validation settings, and reversible skip/archive state.

Markdown import/export could be useful later, but Markdown should be a boundary format or plugin capability, not the internal source of truth.

### Do Not Adopt A General Computation Model Too Early

Quarto's executable-code model is central to scientific and technical publishing. slideotter's current value is grounded deck authoring, not reproducible notebooks.

If charts, data snippets, or computed visuals become important, they should arrive as plugins or material providers with explicit provenance and validation.

### Do Not Let Extensions Bypass Review

Quarto filters transform documents during render. That is powerful, but slideotter's safety comes from candidates and explicit apply. A slideotter plugin should not silently rewrite deck files during export.

Plugin output should become candidates, imported materials, validation reports, or export artifacts through core services.

### Do Not Let Output Formats Dictate Authoring

Quarto accepts output-specific syntax and options because it is a publishing system. slideotter should keep authoring focused on the presentation argument, visual hierarchy, source grounding, and review flow.

Export-specific knobs should stay secondary.

## Opportunities For Slideotter

### Quarto Import Plugin

A plugin could import a `.qmd` presentation into slideotter:

- parse headings into outline beats
- map Revealjs sections to divider slides
- map images into presentation materials
- map speaker notes into slide context
- convert simple two-column layouts into supported slide families

This would help users start from existing Quarto decks without changing slideotter's internal model.

### Quarto Export Plugin

A plugin could export a slideotter deck to a constrained Quarto Revealjs project:

- write `.qmd` from active slide specs
- copy material assets
- emit `_quarto.yml`
- preserve references and captions where possible
- warn when slideotter features cannot round-trip

This should be an explicit export with loss warnings, not a hidden parallel renderer.

### Plugin Manifest Inspiration

Quarto extensions suggest that slideotter plugin packages should be easy to inspect:

- manifest
- contribution files
- resources
- examples
- version compatibility
- install/update commands later

This is especially useful for enterprise brand kits, internal source connectors, export pipelines, and validation packs.

### Publishing Records

Quarto's publishing workflows suggest a future slideotter concept:

```json
{
  "publishTargets": [
    {
      "id": "cloud-demo",
      "type": "cloudflare",
      "url": "https://example.slideotter.app/decks/demo",
      "lastPublishedAt": "2026-04-27T10:00:00.000Z"
    }
  ]
}
```

The exact shape can change, but the concept is useful: publishing should leave a visible trace.

## Practical Recommendations

1. Keep slideotter's internal source model as structured JSON.
2. Treat Markdown/Quarto as import/export plugin territory.
3. Design ADR 0020's plugin manifest with Quarto-like inspectability: clear contribution types, resources, version compatibility, examples.
4. Add publish-target metadata before cloud hosting becomes complex.
5. Add generated-result provenance and stale/reuse semantics for LLM outputs, source retrieval, image imports, and exports.
6. Keep any future visual editor WYSIWYM: editing structured presentation intent, not arbitrary pixels.
7. Consider a small Quarto import/export experiment once the plugin system has a data-only or command-plugin path.

## Bottom Line

Quarto is the stronger model for source-first technical publishing. slideotter should not compete with that directly.

slideotter's stronger opportunity is structured, reviewable, AI-assisted presentation authoring. The best lessons from Quarto are architectural: portable project config, disciplined extension packaging, explicit publishing workflows, cache/freeze semantics, and source-visible editing.

Those ideas fit slideotter best when they strengthen the existing guarded loop rather than replacing it.
