# UI/UX Review: Slideotter Studio

Date: 2026-05-02

## Scope

This review inspected the live browser Studio with Playwright on desktop and mobile viewports, then cross-checked the result against `ROADMAP.md`, `STUDIO_STATUS.md`, ADR 0002, and the current client implementation shape.

The review uses a pragmatic frontend lens: the Studio is an authoring workbench, not a marketing app. The strongest direction is quiet, dense, utilitarian, and centered on the active slide plus explicit preview/apply boundaries.

## Summary

The core product direction is right: the rendered slide is dominant on desktop, primary workflows stay explicit, and the modular CSS split has made styling more navigable. The main UX debt is now interaction model complexity, not visual polish. The Studio exposes too many peer-level surfaces at once: seven drawer tabs, several collapsed cards below the preview, and overlapping deck-level controls. This makes the interface feel more complicated than the underlying workflow needs to be.

The next simplification pass should reduce the number of always-visible controls and make the current slide task model clearer:

1. Replace the exposed drawer rail cluster with one predictable tool switcher surface.
2. Convert below-preview cards into a single current-slide task strip with progressive disclosure.
3. Make Outline a task mode with opaque, compact sections rather than a large translucent drawer.
4. Add interaction tests for drawer switching, mobile rail overlap, and 2D thumbnail nesting.

## Findings

### P1: Open Drawers Block Other Drawer Tabs

Evidence: In a Playwright run, opening Outline and then clicking the Layout drawer tab timed out because the `outline-drawer-panel` intercepted pointer events over the Layout tab.

Impact: Users cannot reliably switch tools by clicking another drawer tab after opening a wide drawer. This breaks the mental model that the rail is a persistent tool switcher.

Recommendation: Keep drawer tab targets outside the open panel hit area, or replace the separate fixed tabs with a single tool switcher that changes the active panel. Add a browser regression that opens each drawer and switches to every other drawer.

### P1: Mobile Drawer Tabs Compete With Content

Evidence: At 390px width, the right-side drawer handles sit over the slide preview, workflow cards, and content. The visual order is also different from the keyboard shortcut order, making the 1-7 shortcut mapping hard to learn from the screen.

Impact: Mobile can still operate, but the primary slide and action cards feel visually interrupted. The handles also look like unrelated floating controls rather than a coherent tool system.

Recommendation: Collapse mobile drawers behind one bottom "Tools" handle or a compact horizontal tool bar. Keep shortcuts on desktop, but do not let mobile expose seven separate fixed handles.

### P1: Current-Slide Actions Are Fragmented

Evidence: The desktop Studio shows the preview, then separate cards for Generate variants, Materials, and Custom visuals, each with its own `Open controls +` or `Manage +` affordance. Related slide-editing tasks are spread across below-preview cards and right drawers.

Impact: The user has to choose between several similar entry points before doing common slide work. The controls are calm, but the workflow still reads as a menu of features instead of "what can I do to this slide now?"

Recommendation: Introduce a single current-slide task strip under the preview with tabs or segmented actions: `Improve`, `Media`, `Layout`, `Spec`, `Context`. Each task can still use existing workbench code, but the user sees one entry surface.

### P1: Outline Drawer Is Too Broad For Its First View

Evidence: The Outline drawer first viewport includes deck outline framing, planning actions, reusable outline plans, plan actions, collapsed details, and deck identity fields. The translucent panel also lets slide text show through, reducing legibility.

Impact: Outline is now strategically important, but its first view mixes three jobs: edit deck context, manage reusable plans, and apply/propose structure changes.

Recommendation: Make Outline an opaque panel with explicit modes: `Brief`, `Plans`, `Changes`, `Length`. Default to the active mode needed for the current task. Keep deck identity fields behind `Brief` rather than visible below plan controls.

### P2: Presentations Empty State Is Too Sparse

Evidence: The Presentations screen can show a large empty area with "0 presentations" and only a small Create button, even though the top-level app still has an active Studio route.

Impact: Empty workspace states feel unfinished and can make the app look broken. This is especially confusing when a deck is active elsewhere.

Recommendation: Show one compact empty-state block with the primary creation action, import/open affordances if available, and a clear explanation of where presentations are stored. If an active deck exists but the library is empty, surface that mismatch explicitly.

### P2: Drawer Implementation Is Mechanically Repetitive

Evidence: `drawers.css` and `responsive.css` repeat fixed positioning, widths, transforms, open states, toggle sizing, and panel sizing across seven drawer families. `navigation-shell.ts` already has the drawer metadata needed to centralize behavior.

Impact: Small visibility bugs have already appeared around hidden drawers and hit areas. More drawer variants make future layout fixes more fragile.

Recommendation: Move drawer layout to one shared `.studio-drawer` structure with CSS variables for width, color, offset, and panel size. Keep feature-specific panel styling in separate classes, but make availability, hit targets, and responsive behavior common.

### P2: The Codebase Has A Clear Next Simplification Boundary

Evidence: The largest client files are still workbench-scale modules: `slide-editor-workbench.ts`, `presentation-creation-workbench.ts`, `app.ts`, `deck-planning-workbench.ts`, and `variant-review-workbench.ts` are all around 1,300-1,600 lines.

Impact: The modularization direction worked, but each large workbench still mixes state shaping, rendering, command binding, and status copy. This makes UI simplification harder because visual changes require touching behavior-heavy files.

Recommendation: Extract small view-model helpers before further visual work:

- `slide-action-model.ts`: current slide task availability and labels.
- `drawer-tool-model.ts`: ordered tool metadata, shortcut mapping, mobile grouping.
- `outline-plan-view-model.ts`: plan summaries, action availability, and mode selection.

These should be pure helpers covered by node tests, with the existing workbenches still owning DOM mutation.

## Proposed Sequence

1. Fix drawer switching and add a browser regression for drawer-to-drawer clicks.
2. Replace mobile right-rail handles with a single tools handle.
3. Consolidate below-preview current-slide cards into one task strip while keeping existing workbench internals.
4. Refactor drawer CSS to a shared drawer shell.
5. Split Outline into `Brief`, `Plans`, `Changes`, and `Length` modes.
6. Add pure view-model helpers for current-slide actions and drawer metadata.

## Non-Goals

- Do not introduce Tailwind or a component framework as part of this pass.
- Do not change slide rendering semantics, validation, export behavior, or explicit apply boundaries.
- Do not make the UI more decorative. The right aesthetic is still focused authoring, dense controls, and a dominant slide canvas.

