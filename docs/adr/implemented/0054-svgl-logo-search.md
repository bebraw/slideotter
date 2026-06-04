# ADR 0054: SVGL Logo Search

## Status

Implemented.

## Context

slideotter's material workflow supports presentation-scoped image assets, source metadata, validation, and rendered preview. That is enough for manual uploads, starter images, and sourced open-license image workflows, but agent-generated and business/product decks often need brand logos quickly.

Open Slide's integrated svgl logo search is a useful competitive reference: it lets authors search for brand SVGs from the editor and place them into a deck without leaving the authoring loop. SVGL currently exposes a public logo catalogue and API at `https://api.svgl.app`, including search by title, categories, logo route URLs, brand URLs, and direct SVG-code retrieval. Its API docs say it is open without authentication but rate-limited, and ask consumers not to recreate the same product.

For slideotter, logo search should not become a general remote-asset embedding path. Logos are presentation materials. They need provenance, validation, local copy semantics, and explicit user selection before they appear on slides.

## Decision

Add SVGL logo search as a bounded material-provider workflow.

The Studio should let users search SVGL from material-related surfaces, preview matching logos, inspect basic metadata, and import a chosen logo into the active presentation's material library. Imported logos become ordinary presentation materials with provenance metadata. Slide specs reference the imported material, not the remote SVGL URL.

SVGL search ships as a bundled provider behind the material workflow boundary. The implementation covers the smallest product slice:

- search by title through the SVGL API
- preview result title, category, brand URL, and light/dark availability where present
- import one chosen SVG into `presentations/<id>/materials/`
- record source/provider metadata in `presentations/<id>/state/materials.json`
- attach the imported logo through existing slide media controls
- surface suggested SVGL searches during staged outline review when generated or edited `visualNeed` text explicitly asks for a brand logo
- validate the imported SVG through the same SVG/custom-visual safety boundary used for other static SVG artifacts

## Product Rules

- SVGL is a logo source, not a canonical dependency of rendered decks.
- Import selected logos into the presentation; do not hotlink SVGs from rendered slides.
- Keep user selection explicit. LLM generation may suggest a brand logo search, but should not silently import a remote logo.
- Generation should consume only accepted presentation-local logo materials. It may name a logo need in outline planning, but the user must approve the SVGL import before drafting can use that material.
- Preserve provenance: provider id, SVGL title/id when available, original route URL, brand URL, retrieval time, and selected variant.
- Treat brand logos as trademarked assets. The UI should not imply license clearance beyond recording the upstream source and brand URL.
- Prefer imported SVG files for crisp presentation output, but reject SVG content that fails sanitization.
- When SVGL has light and dark routes, let the user choose the variant or import both as related materials.
- Keep provider failure non-blocking. If SVGL is unavailable or rate-limited, existing upload and material workflows should continue to work.
- Do not cache the whole SVGL catalogue locally as a product clone. Cache only query results or imported assets as needed for performance and auditability.

## Workflow Shape

The initial workflow should fit the current material panel rather than adding global chrome:

1. User opens material import/search from the active presentation.
2. User enters a brand or product name.
3. Studio queries SVGL with a bounded search request.
4. Studio shows compact results with logo preview, title, category, brand URL, and variant labels.
5. User imports one result.
6. Server fetches the selected SVG, sanitizes it, assigns a safe presentation-local filename, and writes it to the presentation materials folder.
7. Server records material metadata and provenance.
8. User may attach the imported material to the current slide through existing controls.
9. Validation checks the imported media like any other slide material.

Agent-facing flows should route through the same actions. For example, an assistant action can propose "search SVGL for Vercel logo" and wait for user selection before import.

During staged presentation creation, deck planning may name logo needs in each slide's `visualNeed`. The outline review screen derives compact "Suggested logo searches" from explicit logo wording, lets the user import one suggested SVGL result, and stores the imported SVG as a normal material before slide drafting starts.

## Data Model

The material registry should gain provider-aware provenance without making SVGL-specific fields mandatory for all materials.

Example shape:

```json
{
  "id": "material-vercel-logo-dark",
  "kind": "image",
  "mediaType": "image/svg+xml",
  "path": "materials/vercel-logo-dark.svg",
  "title": "Vercel logo",
  "alt": "Vercel logo",
  "source": {
    "provider": "svgl",
    "providerItemId": "vercel",
    "title": "Vercel",
    "url": "https://vercel.com/",
    "assetUrl": "https://svgl.app/vercel_dark.svg",
    "variant": "dark",
    "retrievedAt": "2026-06-04T00:00:00.000Z"
  }
}
```

The exact fields can follow the existing material schema, but the important boundary is stable: slides consume a presentation-local material id/path, while provenance records where the material came from.

## API Boundary

Core services should own all network fetches and writes.

Client-side search may request:

- `GET /api/presentations/:id/material-providers/svgl/search?query=...`
- `POST /api/presentations/:id/material-providers/svgl/import`

These route names are illustrative. The final API should align with the hypermedia action model from ADR 0013 and the plugin action/provider model from ADR 0020.

The import action should accept a provider result id or route URL returned by the prior search, the selected variant, and optional title/alt overrides. The server should revalidate that the import target came from an allowed SVGL result instead of trusting arbitrary client-submitted URLs.

## Validation And Security

SVGL import expands the network and SVG handling surface, so the implementation should be conservative:

- enforce query length and request timeout limits
- handle SVGL rate limits and API errors as ordinary provider failures
- restrict import to HTTPS SVG routes returned by SVGL
- fetch SVG content server-side
- sanitize SVG before writing
- reject scripts, external resource references, event handlers, unsafe namespaces, and oversized SVGs
- record provider provenance before any generated or user-authored slide can reference the logo
- keep validation warnings visible when a logo is missing alt text, has poor contrast against the slide theme, or fails render checks

If an SVG cannot pass sanitization, the server should reject the import with a clear message rather than rasterizing or weakening checks silently.

## Local And Cloud Behavior

In local app mode, SVGL search can call the public API directly from the studio server when network access is available.

In cloud mode, the worker should treat SVGL as an external provider:

- apply workspace/provider policy
- use platform-side rate limiting where needed
- avoid storing provider secrets because SVGL does not require authentication today
- store imported SVGs in the workspace material storage
- keep provider failures isolated from other studio actions

If a workspace disables external material providers, SVGL actions should simply not be advertised.

## Consequences

- Users get a fast path for common brand-logo needs without leaving Studio or the staged creation review loop.
- Imported logos become durable presentation assets, so PDF/PPTX/export/archive paths do not depend on SVGL availability.
- Material provenance becomes more important and should stay provider-neutral.
- SVG sanitization and validation become product-critical for logo imports.
- The workflow provides a concrete early test of ADR 0020's material-provider boundary.
- The Studio should avoid copying SVGL's catalogue product; it should remain a search-and-import integration for presentation work.

## Alternatives Considered

### Manual Upload Only

Manual upload keeps the implementation smaller, but it misses a common authoring need and leaves users to hunt for logos outside the guarded material workflow. It also gives agents less structured help when a deck needs recognizable product or platform logos.

### Hotlink Remote SVGs

Hotlinking is simpler, but it weakens archive fidelity, breaks offline/local use, creates privacy and availability risk, and bypasses material provenance. This does not fit slideotter's archive-ready promise.

### Bundle A Local Logo Catalogue

A bundled catalogue would improve offline behavior, but it risks becoming stale, increases package size, and moves slideotter toward recreating SVGL. A search-and-import provider is a better boundary.

### Wait For The Full Plugin System

Waiting for plugins would keep core smaller, but SVGL search is a clear enough provider slice to design now. The implementation can still be shaped so it later moves behind the plugin boundary without changing deck material semantics.

## Deferred Questions

- Should SVGL move from bundled local provider to a plugin once ADR 0020 has a material-provider extension point?
- Should slideotter import light/dark logo variants as one variant-aware material instead of separate import choices?
- Should generated theme selection influence the default light/dark logo variant instead of importing the first returned variant?
- How much trademark/licensing warning belongs in the import UI versus material metadata?
- Should cloud workspaces be able to configure an allowlist or denylist of external material providers?

## Maintenance Recommendation

Keep SVGL search constrained to search, suggestion, preview, import, attach, and validation. Defer bulk import, favorites, local catalogue caching, generated auto-import, and organization brand-kit policy until real decks show the need.
