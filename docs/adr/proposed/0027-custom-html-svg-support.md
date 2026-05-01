# ADR 0027: Custom HTML And SVG Support

## Status

Proposed implementation plan.

## Context

slideotter's supported slide families intentionally use structured JSON, shared DOM rendering, validation, and explicit apply boundaries. That keeps ordinary deck work predictable, but it also limits authors who need a bespoke visual that does not fit the current families: annotated diagrams, one-off process maps, technical architecture sketches, custom charts, or branded SVG artwork.

The current layout decisions explicitly reject raw HTML and SVG inside layout definitions. That boundary should remain. Custom HTML/SVG support is a content capability, not a layout-definition escape hatch. It needs its own storage, validation, preview, and export rules so bespoke visuals do not become hidden executable renderer behavior.

## Decision Direction

Add guarded custom HTML and SVG content as first-class presentation artifacts.

Authors may attach a sanitized custom visual artifact to a supported slide family or use a dedicated custom-visual slide family once the schema exists. The artifact is rendered through the shared DOM runtime, previewed before apply, validated from rendered output, and exported through the same PDF/PNG path as other slides.

Support should start with static SVG and a constrained static HTML subset. Interactive or scripted content is out of scope for the first implementation.

## Product Rules

- Custom HTML/SVG artifacts should be presentation-scoped, versioned, and stored with other presentation state or materials.
- The studio should show the custom visual through the normal slide preview, thumbnail, compare, and export surfaces.
- Authors should be able to preview a custom visual before applying it to a slide.
- Custom visuals should declare an intended role such as diagram, chart, illustration, or branded artwork.
- Custom visuals should carry alt text or a short description for review and future accessibility work.
- The artifact should be reusable within the same presentation and exportable as part of presentation packaging.
- Custom visual apply should remain explicit: attaching or replacing a custom artifact creates a candidate or reviewed write, not a hidden mutation.
- Custom visuals should not be used to smuggle layout rules, deck navigation, workflow behavior, or app chrome changes.

## Security Boundary

The first implementation should allow only static content.

Allowed SVG should be sanitized to a safe element and attribute subset. Allowed HTML should be a constrained fragment subset that can express static visual structure but not executable behavior.

Reject:

- `script`, inline event handlers, and JavaScript URLs
- external network loads
- iframes, embeds, objects, and forms
- mutation observers, timers, custom elements, and dynamic imports
- arbitrary style tags or unbounded CSS selectors
- references that escape the presentation asset boundary
- content that overlays or manipulates studio UI outside the slide viewport

If a future implementation needs interactive custom content, it should get a separate ADR with an isolation model, permission boundary, and export story.

## Rendering And Export

Custom HTML/SVG support should not introduce a second renderer.

The shared DOM slide runtime should place sanitized custom artifacts into known slide regions. Preview, thumbnails, compare views, `/deck-preview`, `/present`, PDF export, preview PNG generation, render-baseline validation, and geometry/media validation should all exercise that same output.

SVG may render inline after sanitization or as a generated local asset if that makes validation and export more predictable. HTML fragments should render in a constrained slide-owned container, not as full documents that can redefine the page.

## Authoring Flow

The first custom-visual workflow should be conservative:

1. Create or import a static SVG or constrained HTML fragment.
2. Sanitize and validate the artifact before it is previewable.
3. Preview it against the selected slide through the shared DOM runtime.
4. Show validation findings for bounds, legibility, contrast where measurable, media loading, and progress-area spacing.
5. Save it as a presentation artifact, attach it to the current slide, or discard it.

Generated custom visuals should follow the same path. An LLM may propose SVG or constrained HTML as candidate content, but local sanitization, validation, preview, and explicit apply remain authoritative.

## Data Model Direction

Custom visual artifacts should use a structured wrapper instead of storing anonymous markup directly inside arbitrary slide fields:

```json
{
  "id": "custom-visual-architecture-map",
  "kind": "customVisual",
  "format": "svg",
  "role": "diagram",
  "title": "Architecture map",
  "description": "Shows the browser studio rendering and validation flow.",
  "content": "<svg ...></svg>",
  "sanitizerVersion": 1,
  "createdAt": "2026-04-27T00:00:00.000Z",
  "updatedAt": "2026-04-27T00:00:00.000Z"
}
```

Slide specs should reference custom visual ids or validated artifact attachments rather than embedding large markup blobs repeatedly. This keeps diff review, reuse, import/export, and sanitizer migrations tractable.

## Relationship To Existing ADRs

ADR 0010's LLM-planned candidate boundary still applies. The model may propose markup, but local code owns sanitization, validation, preview, and apply.

ADR 0015's DOM-first rendering boundary remains unchanged. Custom HTML/SVG content must render through the shared DOM runtime and pass the same export path.

ADR 0018 and ADR 0026 keep layout definitions declarative and non-executable. This ADR does not allow raw HTML or SVG inside layout definitions.

ADR 0020's plugin model remains separate. Custom HTML/SVG artifacts are slide content, not executable plugins.

ADR 0025's assisted remediation may eventually propose custom visuals when a diagram or chart would resolve a dense slide, but it should not silently create or attach markup.

## Validation

Coverage should include:

- sanitizer tests for disallowed tags, attributes, URLs, external references, and CSS
- schema validation for custom visual artifact wrappers
- preview rendering through the shared DOM runtime
- export validation for PDF and PNG paths
- geometry checks that custom visuals stay inside the slide viewport and clear the progress area
- media checks for any local referenced assets
- stale-candidate rejection when the referenced artifact or slide changes
- import/export round trip for presentation-scoped custom artifacts
- browser workflow coverage for import/create, preview, save, attach, replace, and discard

## Non-Goals

- No scripted or interactive slide-authored behavior in the first implementation.
- No arbitrary full-document HTML.
- No external network dependencies at render time.
- No raw HTML/SVG inside custom layout definitions.
- No bypass of candidate preview, validation, and explicit apply.
- No custom content that can alter studio chrome or deck navigation.

## Open Questions

Resolved direction:

- The first implementation supports SVG only. Constrained HTML waits until real deck usage shows a need that static SVG cannot satisfy.
- Custom visuals live in a separate presentation artifact store. Materials remain source assets, slide state remains per-slide content, and slides reference custom visual artifact ids.
- Sanitized SVG stays as vector DOM content by default so preview, thumbnails, compare, PDF, and PNG export use the shared DOM path. Rasterized artifacts can be added later only if real render instability appears.
- Sanitization is server-owned behind a local sanitizer module with a strict static-SVG allowlist. The canonical policy allows static visual elements, safe text, basic geometry, paths, local bounded gradients or patterns, and presentation-local image references if needed. It rejects scripts, event handlers, `foreignObject`, external URLs, animation, expensive or risky filters, and arbitrary CSS selectors.
- Theme-token references are out of scope for the first slice. Custom SVG stores explicit resolved colors. A later token syntax should resolve before rendering, and contrast validation should inspect the resolved rendered output.
