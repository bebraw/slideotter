import { createCloudflareWorker } from "gustwind/workers/cloudflare";
import { plugin as metaPlugin } from "gustwind/plugins/meta";
import { plugin as edgeRendererPlugin } from "gustwind/plugins/htmlisp-edge-renderer";
import { plugin as edgeRouterPlugin } from "gustwind/routers/edge-router";

type SiteEnvironment = Record<string, unknown>;

const routes = {
  "/": {
    layout: "Home",
    meta: {
      description:
        "slideotter is a local DOM-first presentation workbench for grounded, reviewable decks.",
      title: "slideotter",
    },
  },
};

const globalUtilities = {
  init: () => ({}),
};

const components = {
  Home: String.raw`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>slideotter</title>
    <meta name="description" content="slideotter is a local DOM-first presentation workbench for grounded, reviewable decks." />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 152 152'%3E%3Crect x='0' y='0' width='152' height='152' rx='30' fill='%23ffffff'/%3E%3Crect x='5' y='5' width='142' height='142' rx='25' fill='%23ffffff' stroke='%23183153' stroke-width='10'/%3E%3Cpath d='M28 104C33 66 55 43 88 38C118 34 139 51 146 78C151 98 144 118 126 132C108 146 81 150 57 141C38 134 27 120 28 104Z' fill='%23275d8c'/%3E%3Cpath d='M38 91C45 69 63 57 88 57C111 57 128 70 132 92C136 113 119 130 92 134C63 138 31 119 38 91Z' fill='%23f8fbfe'/%3E%3Ccircle cx='68' cy='82' r='5.5' fill='%23183153'/%3E%3Ccircle cx='109' cy='82' r='5.5' fill='%23183153'/%3E%3Cpath d='M86 96C90 93 96 93 100 96C98 102 94 105 90 105C86 105 83 102 86 96Z' fill='%23183153'/%3E%3Cpath d='M52 31C51 17 61 8 73 13C84 18 84 34 73 42Z' fill='%23275d8c'/%3E%3Cpath d='M111 42C100 34 100 18 111 13C123 8 133 17 132 31Z' fill='%23275d8c'/%3E%3Cpath d='M27 48C14 49 5 59 10 71C15 82 31 82 39 71Z' fill='%23f28f3b'/%3E%3Cpath d='M121 131C140 124 151 111 154 94' fill='none' stroke='%23f28f3b' stroke-width='12' stroke-linecap='round'/%3E%3Cpath d='M75 111C83 117 96 117 104 111' fill='none' stroke='%23183153' stroke-width='5' stroke-linecap='round'/%3E%3Cpath d='M54 99H25M55 109H28M122 99H151M121 109H148' fill='none' stroke='%23183153' stroke-width='4' stroke-linecap='round' opacity='0.72'/%3E%3C/svg%3E" />
    <style>
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap");

      :root {
        color-scheme: light;
        --ink: #183153;
        --muted: #56677c;
        --paper: #f5f8fc;
        --panel: #ffffff;
        --line: #183153;
        --green: #0f7f6f;
        --blue: #275d8c;
        --red: #cf5e3c;
        --gold: #f28f3b;
        --ice: #d7e6f5;
        --mist: #eaf2fa;
        --shadow: 0 24px 80px rgba(24, 49, 83, 0.16);
        --mono: "IBM Plex Mono", "SFMono-Regular", "Cascadia Code", "Liberation Mono", monospace;
        --sans: "IBM Plex Sans", "Segoe UI", "Helvetica Neue", sans-serif;
        --display: "IBM Plex Sans", "Segoe UI", "Helvetica Neue", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html {
        background: var(--paper);
      }

      body {
        margin: 0;
        color: var(--ink);
        font-family: var(--sans);
        background:
          linear-gradient(90deg, rgba(24, 49, 83, 0.055) 1px, transparent 1px) 0 0 / 36px 36px,
          linear-gradient(rgba(24, 49, 83, 0.055) 1px, transparent 1px) 0 0 / 36px 36px,
          radial-gradient(circle at 79% 9%, rgba(39, 93, 140, 0.2), transparent 30rem),
          radial-gradient(circle at 13% 74%, rgba(242, 143, 59, 0.18), transparent 26rem),
          var(--paper);
      }

      a {
        color: inherit;
      }

      .shell {
        margin: 0 auto;
        max-width: 1180px;
        padding: 24px;
      }

      .topbar {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 20px;
        min-height: 52px;
      }

      .brand {
        align-items: center;
        display: inline-flex;
        gap: 10px;
        font-family: var(--mono);
        font-size: 0.86rem;
        font-weight: 600;
        letter-spacing: 0;
        line-height: 1;
        text-decoration: none;
        text-transform: uppercase;
      }

      .brand-logo {
        display: block;
        height: auto;
        width: clamp(32px, 4vw, 42px);
      }

      .toplinks {
        align-items: center;
        display: flex;
        gap: 18px;
        color: var(--muted);
        font-size: 0.9rem;
      }

      .toplinks a {
        text-decoration: none;
      }

      .hero {
        align-items: center;
        display: grid;
        gap: clamp(52px, 5.5vw, 78px);
        grid-template-columns: minmax(0, 0.86fr) minmax(420px, 1.14fr);
        min-height: calc(100vh - 180px);
        padding: 58px 0 54px;
      }

      .hero > div {
        min-width: 0;
      }

      .eyebrow {
        border-bottom: 2px solid var(--line);
        border-top: 2px solid var(--line);
        display: inline-flex;
        font-family: var(--mono);
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 26px;
        padding: 8px 0;
        text-transform: uppercase;
      }

      h1 {
        font-family: var(--display);
        font-size: clamp(4rem, 6.3vw, 6.15rem);
        font-weight: 600;
        letter-spacing: 0;
        line-height: 0.86;
        margin: 0;
      }

      .dek {
        color: #233f61;
        font-size: clamp(1.15rem, 2vw, 1.46rem);
        line-height: 1.44;
        margin: 28px 0 0;
        max-width: 640px;
      }

      .actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 34px;
      }

      .button {
        align-items: center;
        background: var(--gold);
        border: 2px solid var(--line);
        color: var(--ink);
        display: inline-flex;
        font-weight: 600;
        min-height: 46px;
        padding: 0 18px;
        text-decoration: none;
      }

      .button.secondary {
        background: var(--panel);
        color: var(--ink);
      }

      .command {
        background: var(--ink);
        color: var(--paper);
        display: inline-flex;
        font-family: var(--mono);
        font-size: 0.82rem;
        line-height: 1.3;
        min-height: 46px;
        padding: 13px 14px;
      }

      .workbench {
        background: var(--panel);
        border: 2px solid var(--line);
        box-shadow: var(--shadow), 8px 8px 0 var(--line);
        min-height: 575px;
        padding: 16px;
      }

      .windowbar {
        align-items: center;
        border-bottom: 2px solid var(--line);
        display: flex;
        justify-content: space-between;
        padding: 2px 2px 14px;
      }

      .dots {
        display: flex;
        gap: 7px;
      }

      .dot {
        border: 1.5px solid var(--line);
        border-radius: 999px;
        height: 12px;
        width: 12px;
      }

      .dot:nth-child(1) { background: var(--red); }
      .dot:nth-child(2) { background: var(--gold); }
      .dot:nth-child(3) { background: var(--green); }

      .status {
        color: var(--muted);
        font-family: var(--mono);
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .workspace-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: 138px minmax(0, 1fr);
        padding-top: 16px;
      }

      .thumbs {
        display: grid;
        gap: 10px;
      }

      .thumb {
        background: var(--ice);
        border: 2px solid var(--line);
        min-height: 72px;
        padding: 8px;
      }

      .thumb:nth-child(2) {
        background: #eaf6f3;
      }

      .thumb:nth-child(3) {
        background: #fde9d8;
      }

      .thumb-title {
        display: block;
        font-family: var(--mono);
        font-size: 0.64rem;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .thumb-line {
        background: rgba(24, 49, 83, 0.32);
        display: block;
        height: 5px;
        margin: 5px 0;
        width: 84%;
      }

      .slide {
        aspect-ratio: 16 / 10;
        background:
          linear-gradient(90deg, rgba(24, 49, 83, 0.06) 1px, transparent 1px) 0 0 / 28px 28px,
          #fbfdff;
        border: 2px solid var(--line);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 26px;
      }

      .slide-kicker {
        color: var(--blue);
        font-family: var(--mono);
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .slide h2 {
        font-family: var(--display);
        font-size: clamp(1.9rem, 3.35vw, 2.8rem);
        font-weight: 600;
        line-height: 1.02;
        margin: 16px 0 0;
        max-width: 12ch;
      }

      .slide-bottom {
        align-items: end;
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 0.9fr) minmax(172px, 0.82fr);
        margin-top: 18px;
      }

      .slide-list {
        display: grid;
        gap: 8px;
      }

      .slide-list span {
        align-items: center;
        display: flex;
        font-weight: 600;
        gap: 9px;
        line-height: 1.18;
      }

      .slide-list span::before {
        background: var(--gold);
        border: 1.5px solid var(--line);
        content: "";
        display: inline-block;
        height: 10px;
        width: 10px;
      }

      .json-pane {
        background: var(--ink);
        color: #f5f8fc;
        font-family: var(--mono);
        font-size: 0.52rem;
        line-height: 1.5;
        overflow: hidden;
        padding: 12px;
        white-space: pre;
      }

      .rail {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(3, 1fr);
        margin-top: 14px;
      }

      .rail-item {
        border: 2px solid var(--line);
        min-height: 86px;
        padding: 11px;
      }

      .rail-item strong {
        display: block;
        font-family: var(--mono);
        font-size: 0.68rem;
        font-weight: 600;
        margin-bottom: 6px;
        text-transform: uppercase;
      }

      .rail-item p {
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.35;
        margin: 0;
      }

      .band {
        border-top: 2px solid var(--line);
        padding: 58px 0;
      }

      .section-head {
        align-items: end;
        display: grid;
        gap: 20px;
        grid-template-columns: minmax(0, 0.8fr) minmax(260px, 0.45fr);
        margin-bottom: 30px;
      }

      h2 {
        font-family: var(--display);
        font-size: clamp(2.4rem, 5vw, 4.8rem);
        font-weight: 600;
        letter-spacing: 0;
        line-height: 0.92;
        margin: 0;
      }

      .section-head p {
        color: var(--muted);
        font-size: 1.03rem;
        line-height: 1.55;
        margin: 0;
      }

      .feature-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(4, 1fr);
      }

      .feature {
        background: var(--panel);
        border: 2px solid var(--line);
        min-height: 220px;
        padding: 18px;
      }

      .feature-number {
        color: var(--red);
        font-family: var(--mono);
        font-size: 0.74rem;
        font-weight: 600;
      }

      .feature h3 {
        font-family: var(--display);
        font-size: 1.72rem;
        font-weight: 600;
        line-height: 0.98;
        margin: 34px 0 12px;
      }

      .feature p {
        color: var(--muted);
        line-height: 1.48;
        margin: 0;
      }

      .flow {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(5, 1fr);
      }

      .step {
        border-top: 4px solid var(--line);
        padding-top: 14px;
      }

      .step strong {
        display: block;
        font-family: var(--mono);
        font-size: 0.78rem;
        font-weight: 600;
        margin-bottom: 10px;
        text-transform: uppercase;
      }

      .step span {
        color: #233f61;
        display: block;
        line-height: 1.4;
      }

      .footer {
        align-items: center;
        border-top: 2px solid var(--line);
        color: var(--muted);
        display: flex;
        font-size: 0.9rem;
        justify-content: space-between;
        padding: 24px 0 8px;
      }

      @media (max-width: 920px) {
        .hero,
        .section-head {
          grid-template-columns: 1fr;
        }

        .hero {
          min-height: auto;
        }

        .workbench {
          min-height: 0;
        }

        .feature-grid,
        .flow {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .shell {
          padding: 18px;
        }

        .topbar,
        .footer {
          align-items: flex-start;
          flex-direction: column;
        }

        .toplinks {
          flex-wrap: wrap;
        }

        h1 {
          font-size: clamp(3.4rem, 18vw, 5.4rem);
        }

        .workspace-grid,
        .slide-bottom,
        .rail,
        .feature-grid,
        .flow {
          grid-template-columns: 1fr;
        }

        .thumbs {
          grid-template-columns: repeat(3, 1fr);
        }

        .thumb {
          min-height: 58px;
        }

        .rail-item,
        .feature {
          min-height: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <nav class="topbar" aria-label="Primary">
        <a class="brand" href="/">
          <svg class="brand-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 152 152" role="img" aria-label="slideotter">
            <rect x="0" y="0" width="152" height="152" rx="30" fill="#ffffff"/>
            <rect x="5" y="5" width="142" height="142" rx="25" fill="#ffffff" stroke="#183153" stroke-width="10"/>
            <path d="M28 104C33 66 55 43 88 38C118 34 139 51 146 78C151 98 144 118 126 132C108 146 81 150 57 141C38 134 27 120 28 104Z" fill="#275d8c"/>
            <path d="M38 91C45 69 63 57 88 57C111 57 128 70 132 92C136 113 119 130 92 134C63 138 31 119 38 91Z" fill="#f8fbfe"/>
            <circle cx="68" cy="82" r="5.5" fill="#183153"/>
            <circle cx="109" cy="82" r="5.5" fill="#183153"/>
            <path d="M86 96C90 93 96 93 100 96C98 102 94 105 90 105C86 105 83 102 86 96Z" fill="#183153"/>
            <path d="M52 31C51 17 61 8 73 13C84 18 84 34 73 42Z" fill="#275d8c"/>
            <path d="M111 42C100 34 100 18 111 13C123 8 133 17 132 31Z" fill="#275d8c"/>
            <path d="M27 48C14 49 5 59 10 71C15 82 31 82 39 71Z" fill="#f28f3b"/>
            <path d="M121 131C140 124 151 111 154 94" fill="none" stroke="#f28f3b" stroke-width="12" stroke-linecap="round"/>
            <path d="M75 111C83 117 96 117 104 111" fill="none" stroke="#183153" stroke-width="5" stroke-linecap="round"/>
            <path d="M54 99H25M55 109H28M122 99H151M121 109H148" fill="none" stroke="#183153" stroke-width="4" stroke-linecap="round" opacity="0.72"/>
          </svg>
          slideotter
        </a>
        <div class="toplinks">
          <a href="#workflow">Workflow</a>
          <a href="#fit">Fit</a>
          <a href="https://github.com/bebraw/slideotter">GitHub</a>
        </div>
      </nav>

      <section class="hero">
        <div>
          <span class="eyebrow">DOM-first presentation studio</span>
          <h1>slideotter</h1>
          <p class="dek">
            A local workbench for structured presentations that move from brief
            to approved outline, live slide drafting, review, and checked PDF archive.
          </p>
          <div class="actions">
            <a class="button" href="#workflow">See the loop</a>
            <a class="button secondary" href="#fit">Where it fits</a>
            <code class="command">npx slideotter init --template tutorial</code>
          </div>
        </div>

        <div class="workbench" aria-label="Stylized slideotter workbench preview">
          <div class="windowbar">
            <div class="dots" aria-hidden="true">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
            <span class="status">checks: clean</span>
          </div>

          <div class="workspace-grid">
            <div class="thumbs" aria-hidden="true">
              <div class="thumb">
                <span class="thumb-title">01</span>
                <span class="thumb-line"></span>
                <span class="thumb-line"></span>
              </div>
              <div class="thumb">
                <span class="thumb-title">02</span>
                <span class="thumb-line"></span>
                <span class="thumb-line"></span>
              </div>
              <div class="thumb">
                <span class="thumb-title">03</span>
                <span class="thumb-line"></span>
                <span class="thumb-line"></span>
              </div>
            </div>

            <div>
              <article class="slide">
                <div>
                  <span class="slide-kicker">Active slide</span>
                  <h2>Review before applying</h2>
                </div>
                <div class="slide-bottom">
                  <div class="slide-list">
                    <span>Brief and sources stay with the deck</span>
                    <span>Outline changes are reviewed first</span>
                    <span>One DOM renderer powers export</span>
                  </div>
                  <pre class="json-pane">{
  "family": "content",
  "state": "outline-approved",
  "grounded": true
}</pre>
                </div>
              </article>

              <div class="rail">
                <div class="rail-item">
                  <strong>Outline</strong>
                  <p>Brief, sources, reusable plans, and length controls live beside Slide Studio.</p>
                </div>
                <div class="rail-item">
                  <strong>Review</strong>
                  <p>Generated slide, layout, theme, and deck-plan options stay proposals until applied.</p>
                </div>
                <div class="rail-item">
                  <strong>Archive</strong>
                  <p>Builds and published archives are separate choices.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="band" id="workflow">
        <div class="section-head">
          <h2>Designed for the deck work between prompt and archive.</h2>
          <p>
            slideotter treats slides as structured JSON, stages new decks through an editable outline,
            and renders everything through the same DOM path for preview, validation, presentation mode, and export.
          </p>
        </div>
        <div class="flow">
          <div class="step">
            <strong>Brief</strong>
            <span>Capture purpose, audience, constraints, sources, and target length.</span>
          </div>
          <div class="step">
            <strong>Outline</strong>
            <span>Review, edit, and lock the deck structure before full slide files are written.</span>
          </div>
          <div class="step">
            <strong>Draft</strong>
            <span>Draft one slide at a time and keep partial output recoverable.</span>
          </div>
          <div class="step">
            <strong>Compare</strong>
            <span>Inspect slide, layout, theme, and deck-plan candidates before applying.</span>
          </div>
          <div class="step">
            <strong>Validate</strong>
            <span>Run text, geometry, browser, and render checks before publishing the archive.</span>
          </div>
        </div>
      </section>

      <section class="band" id="fit">
        <div class="section-head">
          <h2>Small surface, strict habits.</h2>
          <p>
            The tool is not a freeform slide editor. It is for controlled generation,
            inspectable deck state, and repeatable presentation publishing across local, desktop, and hosted paths.
          </p>
        </div>
        <div class="feature-grid">
          <article class="feature">
            <span class="feature-number">01</span>
            <h3>Local-first authoring</h3>
            <p>Deck files, materials, sources, runtime state, and archives stay presentation-scoped.</p>
          </article>
          <article class="feature">
            <span class="feature-number">02</span>
            <h3>Staged generation</h3>
            <p>Briefs become editable outlines, then validated slides draft progressively from approved beats.</p>
          </article>
          <article class="feature">
            <span class="feature-number">03</span>
            <h3>DOM rendering</h3>
            <p>The preview surface is the presentation, validation, PDF, and PPTX handoff surface.</p>
          </article>
          <article class="feature">
            <span class="feature-number">04</span>
            <h3>Cloud path baseline</h3>
            <p>Workers, D1, R2, and browser rendering proofs exist beside the local app model.</p>
          </article>
        </div>
      </section>

      <footer class="footer">
        <span>Built with Gustwind for Cloudflare Workers.</span>
        <span>slideotter: structured decks, checked output.</span>
      </footer>
    </main>
  </body>
</html>`,
};

export default createCloudflareWorker<SiteEnvironment>({
  initialPlugins: [
    [edgeRouterPlugin, { routes }],
    [
      metaPlugin,
      {
        meta: {
          title: "slideotter",
        },
      },
    ],
    [
      edgeRendererPlugin,
      {
        componentUtilities: {},
        components,
        globalUtilities,
      },
    ],
  ],
});
