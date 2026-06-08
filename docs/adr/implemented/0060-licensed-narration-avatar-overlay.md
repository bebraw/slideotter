# ADR 0060: Licensed Narration Avatar Overlay

## Status

Implemented.

## Context

ADR 0057 added reviewable narration scripts and browser/local TTS playback in presentation mode. ADR 0059 tightened narration so the spoken layer explains the deck instead of reading slide text. A visual presenter can make narrated playback feel more intentional, especially when the deck is being shown asynchronously or during demos where a small character helps signal that narration is active.

The useful version is not a photorealistic generated human video. It is a small, optional, stylized presenter overlay that can sit beside the existing narration controls, react to audio, and use prebuilt idle, speaking, listening, and emphasis motions. A comic figure is a good fit because it can avoid uncanny realism and reduce the expectation of exact lip sync.

Licensing is the hard boundary. The web has many attractive avatar and animation assets, but "free to view" is not "safe to bundle." Research notes:

- Adobe's Mixamo FAQ says Mixamo characters and animations can be used royalty-free for personal, commercial, and non-profit projects, including films and video games, and Mixamo works with humanoid characters. See <https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html>.
- The TalkingHead JavaScript project is MIT-licensed and supports browser-rendered GLB avatars, Mixamo FBX animations, viseme blend shapes, and real-time lip sync. Its own README also warns that its example assets have different licenses, including non-commercial-only examples and one CC0 MPFB example. See <https://github.com/met4citizen/TalkingHead>.
- Live2D sample model use is conditional: commercial use is allowed for general users or small-scale enterprises below the published revenue threshold, but not for medium or larger enterprises without written approval, and each model has individual terms. See <https://help.live2d.com/en/other/other_16/>.
- VRM explicitly carries avatar permission and license metadata, including whether commercial use is allowed. See <https://vrm.dev/en/vrm/meta/license/>.
- Rive community content is available under Creative Commons Attribution 4.0 only when a user marks it as community content, and Rive's terms place responsibility on the uploader to have the needed rights. See <https://rive.app/docs/legal/terms-of-service>.

The decision should therefore separate the runtime capability from the asset choice. slideotter can support a talking comic presenter, but it should not ship or import a character unless the asset's license, attribution, and redistribution rights are explicit.

## Decision

Add an optional presentation-mode narration avatar overlay backed by licensed avatar assets.

The first implementation uses a small stylized character overlay that reacts while narration plays. It prefers lightweight audio-reactive animation over generated video:

- uses the existing presentation-mode narration lifecycle as the trigger
- uses Piper audio playback when available for amplitude-driven mouth movement
- falls back to a simpler speaking/idle state for browser speech synthesis
- renders inside the `/present` DOM route without changing slide specs or export output
- keeps the avatar optional, hideable, and presentation-only

The core includes two original project-owned comic sample figures, Beacon and Mica. They are not third-party characters, celebrity likenesses, brand mascots, generated from copyrighted references, or downloaded sample assets. Richer third-party character packs remain deferred until plugin and material metadata paths can enforce exact license terms.

## Product Rules

- The avatar is presentation support, not slide content.
- The avatar must not cover slide content, captions, source lines, or the progress area.
- The avatar should be stylized or comic-like by default; avoid photorealistic generated humans in core.
- Do not bundle recognizable copyrighted characters, celebrity likenesses, brand mascots, or assets with unclear provenance.
- Do not rely on public-domain assumptions for modern characters. Treat "fan art", "free download", and "community file" as unsafe unless license terms are explicit.
- Every bundled or imported avatar asset must carry source, author, license, attribution, and allowed-use metadata.
- License metadata should record at least commercial use, redistribution, modification, attribution, and any character-performance restrictions.
- If license terms prohibit commercial use, redistribution, modification, or general performance, the asset must not be bundled as a default and should be blocked or clearly marked as local-only experimental material.
- Avatar playback must work without a cloud video or avatar-generation service.
- The narration script remains reviewable JSON; the avatar must not add hidden narration text, claims, or runtime LLM behavior.

## Asset Model

Bundled avatar assets are represented by a typed rendering catalog with explicit license metadata. Future external avatar assets should be represented as presentation-scoped materials or plugin-provided material packs, not as arbitrary remote runtime URLs.

Useful metadata:

```json
{
  "id": "avatar-comic-speaker",
  "kind": "narrationAvatar",
  "sourceUrl": "https://example.com/avatar",
  "author": "Example Artist",
  "license": "CC0-1.0",
  "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
  "attribution": "Example Artist",
  "commercialUse": "allowed",
  "redistribution": "allowed",
  "modification": "allowed",
  "performance": "allowed",
  "rawAssetRedistribution": "allowed",
  "notes": "Bundled use is permitted."
}
```

The supported asset formats can grow in stages:

1. **Static comic figure with CSS/Web Audio states**
   Implemented baseline: idle, speaking, paused, and stopped/idle states driven by narration state.

2. **Sprite or Rive-style 2D animation**
   Useful when a licensed figure already has loopable motions. Require local asset packaging and attribution metadata.

3. **GLB/VRM avatar**
   Use Three.js or a bounded avatar runtime when the model has explicit commercial/redistribution permissions. Respect VRM license metadata when available.

4. **TalkingHead-style full avatar runtime**
   Consider as a plugin-backed implementation because it brings a richer runtime, GLB/viseme requirements, and third-party asset-license complexity.

Live2D sample models and Ready Player Me or similar generated avatars should not be default bundled assets unless their exact current terms permit the intended bundled, commercial, redistributable use for this project. They may still be useful as user-provided local assets when the user accepts the asset's own terms.

## Runtime Behavior

Presentation mode already creates an `Audio` element for local Piper narration and falls back to browser speech synthesis. The avatar overlay attaches to that existing lifecycle:

- idle before narration starts
- speaking while Piper audio or browser speech is active
- paused when narration pauses
- stopped when narration stops or slide navigation cancels speech
- optional emphasis pose at sentence or amplitude peaks when local audio data is available

For Piper audio, the implementation uses the Web Audio API to derive coarse amplitude and drive mouth movement. It does not require phoneme timestamps. For browser speech synthesis, it uses the existing `speechSynthesis` start/end/pause/resume events and accepts less precise animation.

The avatar should not auto-open, auto-play, or change slide advancement rules. It follows the same explicit narration controls and auto-advance toggle already defined by ADR 0057.

## Relationship To Existing ADRs

ADR 0057 remains the playback and review model. This ADR adds an optional visual presenter layer beside narrated playback.

ADR 0059 remains the script-quality boundary. The avatar must not encourage slide readout or create new unreviewed narration.

ADR 0020 is the preferred path for richer avatar runtimes, third-party asset packs, and provider integrations. TalkingHead, Live2D, VRM tooling, or Rive-style packs should fit plugin extension points once those exist.

ADR 0027 remains relevant for custom visual safety. Avatar assets should avoid arbitrary script injection, external runtime loads, and unbounded SVG or HTML.

ADR 0015 remains authoritative for DOM-first rendering. The avatar is presentation-mode chrome and should not create a second slide renderer.

## Implementation Notes

- `studio/rendering/narration-avatars.ts` owns the bundled avatar catalog, license metadata, and selector/overlay markup.
- `/present` exposes an **Avatar** selector in the narration controls, defaults to **No avatar**, and remembers the selected avatar in session storage.
- The overlay is presentation chrome, not slide spec content. It is hidden by default and does not appear in normal preview, PDF, or PPTX exports.
- The presentation script drives idle, speaking, and paused states from the existing narration lifecycle.
- Piper audio playback can drive coarse mouth movement through Web Audio amplitude. Browser speech synthesis falls back to a simple speaking animation.
- Beacon and Mica are original project-owned sample characters with explicit allowed-use metadata.
- Richer GLB/VRM/TalkingHead/Live2D/Rive integration remains deferred to a plugin or later ADR slice.

## Validation

Coverage should include:

- presentation-mode rendering with the avatar disabled by default
- show/hide and placement behavior across desktop and mobile presentation viewports
- narration lifecycle state changes for Piper audio and browser speech fallback
- layout checks that the avatar does not cover active slide content or the progress area
- asset metadata validation for missing license, attribution, source URL, commercial-use permission, redistribution permission, and modification permission
- regression tests that slide specs and PDF/PPTX exports remain unchanged unless a future explicit export option includes presenter chrome

Manual validation should include a rendered `/present` pass with narration enabled, auto-advance enabled, and the avatar shown.

## Non-Goals

- No photorealistic generated presenter in core.
- No generated talking-head video pipeline.
- No cloud avatar-generation or video-generation dependency.
- No use of copyrighted characters, celebrity likenesses, brand mascots, or fan art as bundled defaults.
- No hidden model-authored runtime behavior.
- No avatar in PDF/PPTX export unless a later explicit export decision adds presentation-chrome recording.
