import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { normalizeVisualTheme } = require("../studio/server/services/deck-theme.ts");
const { generateThemeFromBrief } = require("../studio/server/services/theme-generation.ts");
const { generateThemeCandidates } = require("../studio/server/services/theme-candidates.ts");

type ThemeCandidate = {
  label?: string;
  theme: {
    bg: string;
    primary: string;
  };
};

const llmEnvKeys = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "LMSTUDIO_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

function restoreLlmEnv(previousEnv: Record<string, string | undefined>): void {
  llmEnvKeys.forEach((key) => {
    if (previousEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previousEnv[key];
    }
  });
}

function disableLlmProviders(): Record<string, string | undefined> {
  const previousEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
  process.env.STUDIO_LLM_PROVIDER = "disabled";
  ["OPENAI_API_KEY", "OPENAI_MODEL", "LMSTUDIO_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "STUDIO_LLM_MODEL"].forEach((key) => {
    delete process.env[key];
  });
  return previousEnv;
}

test.after(() => {
  global.fetch = originalFetch;
  restoreLlmEnv(originalLlmEnv);
});

function testRelativeLuminance(hex: string): number {
  const normalized = String(hex || "").replace(/^#/, "");
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * (channels[0] ?? 0)) + (0.7152 * (channels[1] ?? 0)) + (0.0722 * (channels[2] ?? 0));
}

function testContrastRatio(foreground: string, background: string): number {
  const first = testRelativeLuminance(foreground);
  const second = testRelativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("visual theme normalization enforces readable contrast", () => {
  const visualTheme = normalizeVisualTheme({
    accent: "123456",
    bg: "000000",
    muted: "1b2a3a",
    primary: "113153",
    progressFill: "222222",
    progressTrack: "111111",
    secondary: "123456"
  });

  assert.ok(testContrastRatio(visualTheme.primary, visualTheme.bg) >= 4.5, "primary text should meet WCAG AA contrast");
  assert.ok(testContrastRatio(visualTheme.muted, visualTheme.bg) >= 4.5, "muted text should meet WCAG AA contrast");
  assert.ok(testContrastRatio(visualTheme.secondary, visualTheme.bg) >= 4.5, "secondary text should meet WCAG AA contrast");
  assert.ok(testContrastRatio(visualTheme.progressFill, visualTheme.progressTrack) >= 3, "progress fill should contrast against the track");
});

test("theme generation fallback understands sky-blue theme descriptions", async () => {
  const previousEnv = disableLlmProviders();

  try {
    const result = await generateThemeFromBrief({
      themeBrief: "Blue like a sky",
      currentTheme: {}
    });

    assert.equal(result.source, "fallback");
    assert.equal(result.name, "Sky Blue");
    assert.match(result.theme.bg, /^[0-9a-f]{6}$/i);
    assert.match(result.theme.secondary, /^[0-9a-f]{6}$/i);
    assert.notEqual(result.theme.bg, normalizeVisualTheme({}).bg, "sky brief should not keep the default background");
  } finally {
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation fallback understands brown tree theme descriptions", async () => {
  const previousEnv = disableLlmProviders();

  try {
    const result = await generateThemeFromBrief({
      themeBrief: "Brown like a tree.",
      currentTheme: {}
    });

    assert.equal(result.source, "fallback");
    assert.equal(result.name, "Tree Brown");
    assert.match(result.theme.bg, /^[0-9a-f]{6}$/i);
    assert.match(result.theme.secondary, /^[0-9a-f]{6}$/i);
    assert.notEqual(result.theme.bg, normalizeVisualTheme({}).bg, "tree brief should not keep the default background");
  } finally {
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation fallback handles additional arbitrary color metaphors", async () => {
  const previousEnv = disableLlmProviders();

  try {
    const lavender = await generateThemeFromBrief({
      themeBrief: "Soft lavender like spring flowers",
      currentTheme: {}
    });
    const ocean = await generateThemeFromBrief({
      themeBrief: "Deep ocean but still readable",
      currentTheme: {}
    });

    assert.equal(lavender.source, "fallback");
    assert.equal(lavender.name, "Lavender");
    assert.notEqual(lavender.theme.bg, ocean.theme.bg, "distinct color metaphors should not collapse to one palette");
    assert.equal(ocean.source, "fallback");
    assert.equal(ocean.name, "Ocean Blue");
  } finally {
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation fallback infers font family from theme descriptions", async () => {
  const previousEnv = disableLlmProviders();

  try {
    const technical = await generateThemeFromBrief({
      currentTheme: {},
      themeBrief: "Technical terminal theme with green code energy"
    });
    const editorial = await generateThemeFromBrief({
      currentTheme: {},
      themeBrief: "Classic editorial magazine theme with deep purple"
    });
    const workshop = await generateThemeFromBrief({
      currentTheme: {},
      themeBrief: "Warm hands-on workshop theme for grilling"
    });

    assert.equal(technical.source, "fallback");
    assert.equal(technical.theme.fontFamily, normalizeVisualTheme({ fontFamily: "mono" }).fontFamily);
    assert.equal(editorial.theme.fontFamily, normalizeVisualTheme({ fontFamily: "editorial" }).fontFamily);
    assert.equal(workshop.theme.fontFamily, normalizeVisualTheme({ fontFamily: "workshop" }).fontFamily);
  } finally {
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation can extract site colors from a pasted URL", async () => {
  const previousEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.STUDIO_LLM_PROVIDER = "disabled";
  ["OPENAI_API_KEY", "OPENAI_MODEL", "LMSTUDIO_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "STUDIO_LLM_MODEL"].forEach((key) => {
    delete process.env[key];
  });
  global.fetch = async (url) => {
    if (String(url) === "https://example.test/brand.css") {
      return new Response(`
        @font-face { font-family: inter; src: url(/fonts/Inter-Regular.ttf); }
        body { font-family: inter, sans-serif; }
      `, {
        headers: {
          "content-type": "text/css; charset=utf-8"
        }
      });
    }
    assert.equal(String(url), "https://example.test/");
    return new Response(`
      <html>
        <head>
          <title>Example Brand</title>
          <meta name="theme-color" content="#146ef5">
          <link rel="stylesheet" href="/brand.css">
          <style>
            :root { --brand: #146ef5; --accent: #ffb000; --muted: #2b3440; }
            .button { color: #146ef5; background: #ffb000; }
          </style>
        </head>
      </html>
    `, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  };

  try {
    const result = await generateThemeFromBrief({
      themeBrief: "https://example.test/",
      currentTheme: {}
    });

    assert.equal(result.source, "fallback");
    assert.equal(result.name, "Example Brand");
    assert.match(result.theme.secondary, /^[0-9a-f]{6}$/i);
    assert.equal(result.theme.progressFill, "1350aa");
    assert.equal(result.theme.fontFamily, "inter, sans-serif");
    assert.notEqual(result.theme.bg, normalizeVisualTheme({}).bg, "URL theme should not keep the default background");
  } finally {
    global.fetch = originalFetch;
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation prefers site brand tokens over social colors", async () => {
  const previousEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.STUDIO_LLM_PROVIDER = "disabled";
  ["OPENAI_API_KEY", "OPENAI_MODEL", "LMSTUDIO_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "STUDIO_LLM_MODEL"].forEach((key) => {
    delete process.env[key];
  });
  global.fetch = async (url) => {
    if (String(url) === "https://cdn.overleaf.example/main.css") {
      return new Response(`
        :root {
          --facebook-logo-background: #0866ff;
          --linkedin-logo-background: #2867b2;
          --bs-primary: #098842;
          --bs-success: #098842;
          --bs-info: #366cbf;
          --bs-dark: #1b222c;
        }
        body { font-family: "Noto Sans", sans-serif; }
        svg path { fill: #0866ff; }
        .social-link { color: #2867b2; }
      `, {
        headers: {
          "content-type": "text/css; charset=utf-8"
        }
      });
    }
    assert.equal(String(url), "https://overleaf.example/");
    return new Response(`
      <html>
        <head>
          <title>Overleaf Example</title>
          <link rel="stylesheet" href="https://cdn.overleaf.example/main.css">
        </head>
      </html>
    `, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  };

  try {
    const result = await generateThemeFromBrief({
      currentTheme: {},
      themeBrief: "https://overleaf.example/"
    });

    assert.equal(result.source, "fallback");
    assert.equal(result.name, "Overleaf Example");
    assert.equal(result.theme.secondary, "0b6136");
    assert.equal(result.theme.fontFamily, "\"Noto Sans\", sans-serif");
  } finally {
    global.fetch = originalFetch;
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation extracts CDN design tokens and font stacks", async () => {
  const previousEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.STUDIO_LLM_PROVIDER = "disabled";
  ["OPENAI_API_KEY", "OPENAI_MODEL", "LMSTUDIO_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "STUDIO_LLM_MODEL"].forEach((key) => {
    delete process.env[key];
  });
  global.fetch = async (url) => {
    if (String(url) === "https://cdn.popular.example/app.css") {
      return new Response(`
        :root {
          --color-progressive: #36c;
          --text-bright-accent: #1ed760;
          --encore-body-font-stack: SpotifyMixUI, CircularSp-Arab, var(--fallback-fonts, sans-serif);
        }
        .asset-icon { color: #590810; }
      `, {
        headers: {
          "content-type": "text/css; charset=utf-8"
        }
      });
    }
    assert.equal(String(url), "https://popular.example/");
    return new Response(`
      <html>
        <head>
          <title>Popular Example</title>
          <link rel="stylesheet" href="https://cdn.popular.example/app.css">
        </head>
      </html>
    `, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  };

  try {
    const result = await generateThemeFromBrief({
      currentTheme: {},
      themeBrief: "https://popular.example/"
    });

    assert.equal(result.source, "fallback");
    assert.equal(result.name, "Popular Example");
    assert.equal(result.theme.progressTrack, "3366cc");
    assert.equal(result.theme.fontFamily, "SpotifyMixUI, CircularSp-Arab");
  } finally {
    global.fetch = originalFetch;
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation can choose light or dark site color modes", async () => {
  const previousEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.STUDIO_LLM_PROVIDER = "disabled";
  ["OPENAI_API_KEY", "OPENAI_MODEL", "LMSTUDIO_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "STUDIO_LLM_MODEL"].forEach((key) => {
    delete process.env[key];
  });
  global.fetch = async (url) => {
    if (String(url) === "https://mode.example/site.css") {
      return new Response(`
        body { font-family: inter, sans-serif; }
        .bg-primary { background-color: #f7e159; }
        .bg-secondary { background-color: #ffffff; }
        .text-muted { color: #505050; }
        @media (prefers-color-scheme: dark) {
          .bg-primary { background-color: #46a5ff; }
          .bg-secondary { background-color: #151515; }
          .text-muted { color: #f2f2f2; }
        }
      `, {
        headers: {
          "content-type": "text/css; charset=utf-8"
        }
      });
    }
    assert.equal(String(url), "https://mode.example/");
    return new Response(`
      <html>
        <head>
          <title>Mode Brand</title>
          <link rel="stylesheet" href="/site.css">
        </head>
      </html>
    `, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  };

  try {
    const light = await generateThemeFromBrief({
      colorSchemePreference: "light",
      currentTheme: {},
      themeBrief: "https://mode.example/"
    });
    const dark = await generateThemeFromBrief({
      colorSchemePreference: "dark",
      currentTheme: {},
      themeBrief: "https://mode.example/"
    });

    assert.equal(light.theme.fontFamily, "inter, sans-serif");
    assert.equal(dark.theme.fontFamily, "inter, sans-serif");
    assert.notEqual(dark.theme.progressFill, light.theme.progressFill, "Dark mode should use dark media colors instead of the light palette");
    assert.notEqual(dark.theme.light, light.theme.light, "Dark and light site modes should produce different extracted theme colors");
  } finally {
    global.fetch = originalFetch;
    restoreLlmEnv(previousEnv);
  }
});

test("theme generation extracts rgba utility colors from generated site CSS", async () => {
  const previousEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.STUDIO_LLM_PROVIDER = "disabled";
  ["OPENAI_API_KEY", "OPENAI_MODEL", "LMSTUDIO_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "STUDIO_LLM_MODEL"].forEach((key) => {
    delete process.env[key];
  });
  global.fetch = async (url) => {
    assert.equal(String(url), "https://survivejs.example/");
    return new Response(`
      <html>
        <head>
          <title>SurviveJS</title>
          <style>
            .prose { --tw-prose-hr: rgba(229,231,235,1); --tw-prose-invert-lead: rgba(156,163,175,1); }
            .bg-primary { --tw-bg-opacity: 1; background-color: rgba(9,181,196,var(--tw-bg-opacity)); }
            .bg-secondary { --tw-bg-opacity: 1; background-color: rgba(182,255,248,var(--tw-bg-opacity)); }
            .text-muted { --tw-text-opacity: 1; color: rgba(52,96,101,var(--tw-text-opacity)); }
            .border-primary { --tw-border-opacity: 1; border-color: rgba(9,181,196,var(--tw-border-opacity)); }
          </style>
        </head>
      </html>
    `, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  };

  try {
    const result = await generateThemeFromBrief({
      currentTheme: {},
      themeBrief: "https://survivejs.example/"
    });

    assert.equal(result.source, "fallback");
    assert.equal(result.name, "SurviveJS");
    assert.equal(result.theme.secondary, "0b7e8b");
    assert.equal(result.theme.accent, "346065");
    assert.equal(result.theme.light, "b6fff8");
    assert.equal(result.theme.progressTrack, "b6fff8");
    assert.match(String(result.theme.fontFamily), /Avenir Next/);
    assert.notEqual(result.theme.secondary, "101820", "brand utility colors should be darkened for contrast instead of falling back to neutral ink");
    assert.notEqual(result.theme.secondary, "e5e7eb", "generated CSS grays should not outrank named brand utility colors");
  } finally {
    global.fetch = originalFetch;
    restoreLlmEnv(previousEnv);
  }
});

test("theme candidate generation returns normalized server-owned candidates", async () => {
  const previousEnv = disableLlmProviders();

  try {
    const result = await generateThemeCandidates({
      currentTheme: {
        fontFamily: "workshop",
        primary: "#183153"
      },
      refreshIndex: 1,
      themeBrief: "Blue like a sky"
    });

    assert.ok(Array.isArray(result.candidates));
    assert.ok(result.candidates.length >= 5);
    assert.equal(result.candidates[0].id, "current");
    assert.equal(result.candidates[1].id, "generated");
    assert.equal(result.candidates[1].source, "fallback");
    result.candidates.forEach((candidate: ThemeCandidate) => {
      assert.match(candidate.theme.bg, /^[0-9a-f]{6}$/i);
      assert.match(candidate.theme.primary, /^[0-9a-f]{6}$/i);
      assert.ok(candidate.label);
    });
  } finally {
    restoreLlmEnv(previousEnv);
  }
});
