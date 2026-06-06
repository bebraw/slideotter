import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

import {
  librariesDir,
  mode,
  outputDir
} from "./paths.ts";
import { asStudioOutputAssetUrl } from "./studio-output-assets.ts";

type PiperVoice = {
  id: string;
  language: string;
  label: string;
  quality: "low" | "medium" | "high";
  repoPath: string;
};

type InstalledPiperVoice = PiperVoice & {
  configPath: string;
  installedAt: string;
  modelPath: string;
};

type PiperVoiceStore = {
  defaultVoiceId?: string;
  installed: InstalledPiperVoice[];
  version: 1;
};

type TtsStatus = {
  configured: boolean;
  mode: "browser-fallback" | "piper";
  reason: string;
  voice?: InstalledPiperVoice | null;
};

type SynthesizeNarrationInput = {
  presentationId: string;
  slideId: string;
  text: string;
  voiceId?: string;
};

type SynthesizeNarrationResult = {
  audioUrl: string;
  cached: boolean;
  provider: "piper";
  voice: InstalledPiperVoice | null;
};

const piperVoicesBaseUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0";

const piperVoiceCatalog: readonly PiperVoice[] = [
  {
    id: "en_US-amy-medium",
    label: "Amy, US English",
    language: "en_US",
    quality: "medium",
    repoPath: "en/en_US/amy/medium/en_US-amy-medium"
  },
  {
    id: "en_US-ryan-high",
    label: "Ryan, US English",
    language: "en_US",
    quality: "high",
    repoPath: "en/en_US/ryan/high/en_US-ryan-high"
  },
  {
    id: "en_GB-cori-high",
    label: "Cori, British English",
    language: "en_GB",
    quality: "high",
    repoPath: "en/en_GB/cori/high/en_GB-cori-high"
  },
  {
    id: "fi_FI-harri-medium",
    label: "Harri, Finnish",
    language: "fi_FI",
    quality: "medium",
    repoPath: "fi/fi_FI/harri/medium/fi_FI-harri-medium"
  }
];

function piperDataDir(): string {
  return mode === "user"
    ? path.join(librariesDir, "piper-voices")
    : path.join(outputDir, "piper-voices");
}

function piperStoreFile(): string {
  return path.join(piperDataDir(), "voices.json");
}

function normalizeVoiceId(value: unknown): string {
  return String(value || "").trim().replace(/[^A-Za-z0-9_.-]/g, "");
}

function isInstalledPiperVoice(value: unknown): value is InstalledPiperVoice {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.language === "string"
    && typeof record.label === "string"
    && typeof record.modelPath === "string"
    && typeof record.configPath === "string"
    && typeof record.repoPath === "string";
}

function readPiperVoiceStore(): PiperVoiceStore {
  const fileName = piperStoreFile();
  if (!fs.existsSync(fileName)) {
    return { installed: [], version: 1 };
  }

  const parsed = JSON.parse(fs.readFileSync(fileName, "utf8")) as Record<string, unknown>;
  const installed = Array.isArray(parsed.installed)
    ? parsed.installed.filter(isInstalledPiperVoice)
    : [];
  const defaultVoiceId = normalizeVoiceId(parsed.defaultVoiceId);
  const store: PiperVoiceStore = {
    installed,
    version: 1
  };
  if (defaultVoiceId) {
    store.defaultVoiceId = defaultVoiceId;
  }
  return store;
}

function writePiperVoiceStore(store: PiperVoiceStore): void {
  const dir = piperDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(piperStoreFile(), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function piperVoiceFileNames(voice: PiperVoice): { configFile: string; modelFile: string } {
  return {
    configFile: path.join(piperDataDir(), `${voice.id}.onnx.json`),
    modelFile: path.join(piperDataDir(), `${voice.id}.onnx`)
  };
}

function piperVoiceUrls(voice: PiperVoice): { configUrl: string; modelUrl: string } {
  return {
    configUrl: `${piperVoicesBaseUrl}/${voice.repoPath}.onnx.json?download=true`,
    modelUrl: `${piperVoicesBaseUrl}/${voice.repoPath}.onnx?download=true`
  };
}

function resolvePiperVoice(voiceId?: string): InstalledPiperVoice | null {
  const store = readPiperVoiceStore();
  const selectedId = normalizeVoiceId(voiceId)
    || normalizeVoiceId(process.env.SLIDEOTTER_PIPER_VOICE)
    || normalizeVoiceId(store.defaultVoiceId);
  if (selectedId) {
    const selected = store.installed.find((voice) => voice.id === selectedId);
    if (selected) {
      return selected;
    }
  }

  return store.installed[0] || null;
}

function piperModelPath(voiceId?: string): { modelPath: string; voice: InstalledPiperVoice | null } | null {
  const explicitModel = String(process.env.SLIDEOTTER_PIPER_MODEL || process.env.PIPER_MODEL || "").trim();
  if (explicitModel) {
    return {
      modelPath: path.resolve(explicitModel),
      voice: resolvePiperVoice(voiceId)
    };
  }

  const voice = resolvePiperVoice(voiceId);
  return voice ? { modelPath: voice.modelPath, voice } : null;
}

function getTtsStatus(voiceId?: string): TtsStatus {
  const provider = String(process.env.SLIDEOTTER_TTS_PROVIDER || process.env.SLIDEOTTER_TTS || "").trim().toLowerCase();
  const model = piperModelPath(voiceId);
  if (provider && provider !== "piper") {
    return {
      configured: false,
      mode: "browser-fallback",
      reason: `Unsupported TTS provider "${provider}". Use "piper" or leave it unset.`
    };
  }

  if (!model) {
    return {
      configured: false,
      mode: "browser-fallback",
      reason: "Install a Piper voice or set SLIDEOTTER_PIPER_MODEL to enable local narration."
    };
  }

  if (!fs.existsSync(model.modelPath)) {
    return {
      configured: false,
      mode: "browser-fallback",
      reason: `Piper model file does not exist: ${model.modelPath}`,
      voice: model.voice
    };
  }

  return {
    configured: true,
    mode: "piper",
    reason: "Piper narration is available.",
    voice: model.voice
  };
}

function sanitizeSegment(value: string, fallback: string): string {
  const normalized = normalizeVoiceId(value);
  return normalized || fallback;
}

function narrationAudioFile(input: SynthesizeNarrationInput, voice: InstalledPiperVoice | null): string {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({
      slideId: input.slideId,
      text: input.text,
      voiceId: voice?.id || process.env.SLIDEOTTER_PIPER_MODEL || "piper"
    }))
    .digest("hex")
    .slice(0, 18);
  const presentationId = sanitizeSegment(input.presentationId, "presentation");
  const slideId = sanitizeSegment(input.slideId, "slide");
  return path.join(outputDir, "narration", presentationId, `${slideId}-${hash}.wav`);
}

function runPiper(text: string, modelPath: string, outputFile: string): Promise<void> {
  const piperBin = String(process.env.SLIDEOTTER_PIPER_BIN || process.env.PIPER_BIN || "piper").trim() || "piper";
  return new Promise((resolve, reject) => {
    const child = spawn(piperBin, ["--model", modelPath, "--output_file", outputFile], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputFile)) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Piper exited with code ${code ?? "unknown"}.`));
    });
    child.stdin.end(`${text}\n`);
  });
}

async function synthesizeNarration(input: SynthesizeNarrationInput): Promise<SynthesizeNarrationResult> {
  const text = String(input.text || "").trim();
  if (!text) {
    throw new Error("Narration text is required.");
  }

  const model = piperModelPath(input.voiceId);
  if (!model || !fs.existsSync(model.modelPath)) {
    throw new Error(getTtsStatus(input.voiceId).reason);
  }

  const audioFile = narrationAudioFile(input, model.voice);
  if (fs.existsSync(audioFile)) {
    return {
      audioUrl: asStudioOutputAssetUrl(audioFile),
      cached: true,
      provider: "piper",
      voice: model.voice
    };
  }

  fs.mkdirSync(path.dirname(audioFile), { recursive: true });
  await runPiper(text, model.modelPath, audioFile);
  return {
    audioUrl: asStudioOutputAssetUrl(audioFile),
    cached: false,
    provider: "piper",
    voice: model.voice
  };
}

function listPiperVoices(): { catalog: readonly PiperVoice[]; installed: InstalledPiperVoice[]; storeDir: string } {
  return {
    catalog: piperVoiceCatalog,
    installed: readPiperVoiceStore().installed,
    storeDir: piperDataDir()
  };
}

async function downloadToFile(url: string, fileName: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "slideotter-piper-model-installer/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(fileName), { recursive: true });
  fs.writeFileSync(fileName, data);
}

async function installPiperVoice(voiceId: string): Promise<InstalledPiperVoice> {
  const normalizedId = normalizeVoiceId(voiceId);
  const voice = piperVoiceCatalog.find((candidate) => candidate.id === normalizedId);
  if (!voice) {
    throw new Error(`Unknown Piper voice "${voiceId}". Run slideotter tts voices to list supported voices.`);
  }

  const { configFile, modelFile } = piperVoiceFileNames(voice);
  const { configUrl, modelUrl } = piperVoiceUrls(voice);
  await downloadToFile(modelUrl, modelFile);
  await downloadToFile(configUrl, configFile);

  const installed: InstalledPiperVoice = {
    ...voice,
    configPath: configFile,
    installedAt: new Date().toISOString(),
    modelPath: modelFile
  };
  const store = readPiperVoiceStore();
  const nextInstalled = [
    installed,
    ...store.installed.filter((candidate) => candidate.id !== voice.id)
  ];
  writePiperVoiceStore({
    defaultVoiceId: store.defaultVoiceId || voice.id,
    installed: nextInstalled,
    version: 1
  });

  return installed;
}

function setDefaultPiperVoice(voiceId: string): InstalledPiperVoice {
  const normalizedId = normalizeVoiceId(voiceId);
  const store = readPiperVoiceStore();
  const selected = store.installed.find((voice) => voice.id === normalizedId);
  if (!selected) {
    throw new Error(`Piper voice "${voiceId}" is not installed.`);
  }
  writePiperVoiceStore({
    ...store,
    defaultVoiceId: selected.id
  });
  return selected;
}

export {
  getTtsStatus,
  installPiperVoice,
  listPiperVoices,
  setDefaultPiperVoice,
  synthesizeNarration
};
export type {
  InstalledPiperVoice,
  PiperVoice,
  SynthesizeNarrationResult,
  TtsStatus
};
