import { normalizeVisualTheme, theme as defaultVisualTheme } from "./deck-theme.ts";
import { generateThemeFromBrief } from "./theme-generation.ts";

type VisualTheme = Record<string, unknown>;

type ThemeCandidate = {
  id: string;
  label: string;
  note: string;
  source: string;
  theme: VisualTheme;
};

type ThemeCandidateFields = {
  audience?: unknown;
  brief?: unknown;
  currentTheme?: unknown;
  refreshIndex?: unknown;
  themeBrief?: unknown;
  title?: unknown;
  tone?: unknown;
  visualTheme?: unknown;
};

function normalizeCandidateTheme(theme: unknown): VisualTheme {
  return normalizeVisualTheme({
    ...defaultVisualTheme,
    ...(theme && typeof theme === "object" ? theme : {})
  });
}

function createCandidate(id: string, label: string, note: string, theme: unknown, source = "fallback"): ThemeCandidate {
  return {
    id,
    label,
    note,
    source,
    theme: normalizeCandidateTheme(theme)
  };
}

function getBaseFont(currentTheme: VisualTheme): string {
  const fontFamily = currentTheme && currentTheme.fontFamily;
  if (String(fontFamily || "").toLowerCase().includes("georgia")) {
    return "editorial";
  }
  if (String(fontFamily || "").toLowerCase().includes("trebuchet")) {
    return "workshop";
  }
  if (String(fontFamily || "").toLowerCase().includes("mono") || String(fontFamily || "").toLowerCase().includes("consolas")) {
    return "mono";
  }
  return "avenir";
}

function createFallbackCandidates(currentTheme: VisualTheme, refreshIndex = 0): ThemeCandidate[] {
  const baseFont = getBaseFont(currentTheme);
  const candidateSets = [
    [
      createCandidate("clean", "Clean", "Bright, direct, and neutral.", {
        accent: "#d97a2b",
        bg: "#f7fafc",
        fontFamily: baseFont,
        light: "#dbe8f2",
        muted: "#526273",
        panel: "#ffffff",
        primary: "#102033",
        progressFill: "#2f6f9f",
        progressTrack: "#dbe8f2",
        secondary: "#2f6f9f",
        surface: "#ffffff"
      }),
      createCandidate("editorial", "Editorial", "Warmer and more authored.", {
        accent: "#c64f2d",
        bg: "#fbf4ec",
        fontFamily: "editorial",
        light: "#f1d9c4",
        muted: "#655a66",
        panel: "#fffaf5",
        primary: "#2f2530",
        progressFill: "#c64f2d",
        progressTrack: "#f1d9c4",
        secondary: "#8f4e2b",
        surface: "#ffffff"
      }),
      createCandidate("dark", "Dark", "High contrast on black.", {
        accent: "#09b5c4",
        bg: "#000000",
        fontFamily: baseFont,
        light: "#183b40",
        muted: "#dcefed",
        panel: "#101820",
        primary: "#f7fcfb",
        progressFill: "#b6fff8",
        progressTrack: "#183b40",
        secondary: "#b6fff8",
        surface: "#f7fcfb"
      }),
      createCandidate("workshop", "Workshop", "Practical and structured.", {
        accent: "#b05f2a",
        bg: "#ffffff",
        fontFamily: "workshop",
        light: "#dcefed",
        muted: "#346065",
        panel: "#f7fcfb",
        primary: "#183b40",
        progressFill: "#09b5c4",
        progressTrack: "#dcefed",
        secondary: "#09b5c4",
        surface: "#ffffff"
      })
    ],
    [
      createCandidate("calm", "Calm", "Quiet blue-gray focus.", {
        accent: "#7a5cce",
        bg: "#f4f7fb",
        fontFamily: baseFont,
        light: "#dbe5f2",
        muted: "#5a6677",
        panel: "#ffffff",
        primary: "#172232",
        progressFill: "#466fa8",
        progressTrack: "#dbe5f2",
        secondary: "#466fa8",
        surface: "#ffffff"
      }),
      createCandidate("field", "Field", "Green, grounded, and open.", {
        accent: "#b86b22",
        bg: "#f3f8f4",
        fontFamily: "workshop",
        light: "#d9eadb",
        muted: "#536b59",
        panel: "#fbfdfb",
        primary: "#183322",
        progressFill: "#2d7a4b",
        progressTrack: "#d9eadb",
        secondary: "#2d7a4b",
        surface: "#ffffff"
      }),
      createCandidate("ink", "Ink", "Dense contrast with warm signal.", {
        accent: "#ffb454",
        bg: "#111315",
        fontFamily: baseFont,
        light: "#33383d",
        muted: "#d5dde5",
        panel: "#1b1f23",
        primary: "#f7fafc",
        progressFill: "#ffb454",
        progressTrack: "#33383d",
        secondary: "#9bd4ff",
        surface: "#f7fafc"
      }),
      createCandidate("studio", "Studio", "Crisp white with graphic accents.", {
        accent: "#e0475b",
        bg: "#ffffff",
        fontFamily: "editorial",
        light: "#e8eef5",
        muted: "#5e6570",
        panel: "#f7f9fb",
        primary: "#111820",
        progressFill: "#1f7a8c",
        progressTrack: "#e8eef5",
        secondary: "#1f7a8c",
        surface: "#ffffff"
      })
    ],
    [
      createCandidate("signal", "Signal", "Sharp contrast with cyan energy.", {
        accent: "#00a6c8",
        bg: "#f6f8fb",
        fontFamily: baseFont,
        light: "#d8e7ef",
        muted: "#50606a",
        panel: "#ffffff",
        primary: "#111c24",
        progressFill: "#00a6c8",
        progressTrack: "#d8e7ef",
        secondary: "#325f74",
        surface: "#ffffff"
      }),
      createCandidate("paper", "Paper", "Soft editorial warmth.", {
        accent: "#a8552d",
        bg: "#f9f5ef",
        fontFamily: "editorial",
        light: "#eadbc9",
        muted: "#665f59",
        panel: "#fffdf9",
        primary: "#2b2521",
        progressFill: "#a8552d",
        progressTrack: "#eadbc9",
        secondary: "#70563c",
        surface: "#ffffff"
      }),
      createCandidate("night", "Night", "Dark, blue, and restrained.", {
        accent: "#7dd3fc",
        bg: "#050914",
        fontFamily: baseFont,
        light: "#1c2940",
        muted: "#d7e3f5",
        panel: "#101827",
        primary: "#f8fbff",
        progressFill: "#7dd3fc",
        progressTrack: "#1c2940",
        secondary: "#b7c7ff",
        surface: "#f8fbff"
      }),
      createCandidate("board", "Board", "Practical with high readability.", {
        accent: "#d58a1f",
        bg: "#f7faf8",
        fontFamily: "workshop",
        light: "#dbe9df",
        muted: "#4f6257",
        panel: "#ffffff",
        primary: "#16241c",
        progressFill: "#38775b",
        progressTrack: "#dbe9df",
        secondary: "#38775b",
        surface: "#ffffff"
      })
    ]
  ];

  return candidateSets[((refreshIndex % candidateSets.length) + candidateSets.length) % candidateSets.length] || [];
}

async function generateThemeCandidates(fields: ThemeCandidateFields = {}, options: Record<string, unknown> = {}) {
  const currentTheme = normalizeCandidateTheme(fields.currentTheme || fields.visualTheme);
  const refreshIndex = Number.isFinite(Number(fields.refreshIndex)) ? Number(fields.refreshIndex) : 0;
  const candidates = [
    createCandidate("current", "Current", "Use the selected controls.", currentTheme, "current")
  ];
  const brief = String(fields.themeBrief || fields.brief || "").trim();

  if (brief) {
    const generated = await generateThemeFromBrief({
      audience: fields.audience,
      currentTheme,
      themeBrief: brief,
      title: fields.title,
      tone: fields.tone
    }, options);
    candidates.push(createCandidate(
      "generated",
      generated.name || "Generated",
      generated.source === "llm" ? "LLM-generated from the theme brief." : "Fallback generated from the theme brief.",
      generated.theme,
      generated.source || "fallback"
    ));
  }

  return {
    candidates: [
      ...candidates,
      ...createFallbackCandidates(currentTheme, refreshIndex)
    ]
  };
}

export {
  generateThemeCandidates
};