# ADR 0063: Surface-Specific Browser Support And Web Guidance

## Status

Implemented.

## Context

slideotter has several browser-facing surfaces with different audiences and evidence. The public website is an ordinary web destination. The Studio client also powers `/deck-preview`, `/present`, the hosted-client baseline, the Electron wrapper, and browser-driven PDF/PPTX generation. Current automated browser checks run only in the pinned Playwright Chromium runtime.

Treating one Chromium run as a universal compatibility claim would overstate the evidence. Treating every internal authoring surface as a general-purpose cross-browser site would also impose a broader support burden than the project currently verifies. At the same time, browser APIs evolve quickly enough that implementation choices benefit from current, focused platform guidance.

## Decision

Define support per surface:

- Public `website/` behavior targets Baseline Widely available features for its core path. Newer capabilities are progressive enhancements with feature detection and a usable fallback.
- Studio, `/deck-preview`, `/present`, the hosted client, Electron, and browser-driven export automation have an explicit Chromium-tested support baseline. Chromium results are evidence for that path, not proof of Firefox, Safari, or mobile-browser compatibility.
- Generated PDF and PPTX artifacts have no browser-runtime requirement after export. Their production path remains part of the Chromium-tested DOM renderer.
- Prefer small local feature detection and fallbacks. A polyfill, compatibility dependency, or expanded browser matrix requires an explicit use case and matching verification.

Add a repo-local `modern-web-guidance` skill for substantive browser-platform feature selection, compatibility interpretation, and fallback design. It retrieves a reviewed, exact CLI release with telemetry disabled and keeps queries generic. It is development guidance only: no application dependency, automatic update, or CI gate.

The skill does not replace repository authority. `AGENTS.md`, `docs/ARCHITECTURE.md`, typed client/server contracts, security boundaries, user instructions, and tests take precedence over retrieved examples.

## Consequences

- Public website changes have a clear broad-compatibility core without forcing the same test promise onto the authoring application.
- Studio and export work can use the Chromium capabilities the project actually validates while keeping unsupported claims out of documentation.
- Limited-availability browser features need an observable fallback, or an explicit decision to narrow support further.
- Cross-browser support can be added later by expanding the test matrix and revising this contract with evidence.
- Current platform retrieval remains reproducible and privacy-conscious, but maintainers must deliberately review any future pin update.

## Validation

- Keep public website behavior usable when progressive enhancements are unavailable.
- Run the focused Studio, presentation, or broad browser validation command for changes to those surfaces.
- Treat Playwright results as Chromium evidence in change summaries.
- Validate the repo-local skill metadata and keep every CLI invocation pinned with `DISABLE_TELEMETRY=1`.
