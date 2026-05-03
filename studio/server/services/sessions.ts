import * as fs from "fs";
import * as path from "path";
import { stateDir } from "./paths.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";

const sessionsFile = path.join(stateDir, "sessions.json");

const defaultSessions = {
  sessions: {}
};

type AssistantMessage = {
  content: string;
  createdAt: string;
  id: string;
  role: string;
} & Record<string, unknown>;

type AssistantSession = {
  createdAt: string;
  id: string;
  messages: AssistantMessage[];
  title: string;
  updatedAt: string;
};

type SessionsStore = {
  sessions: Record<string, AssistantSession>;
};

function ensureDir(dir: string): void {
  ensureAllowedDir(dir);
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown): void {
  writeAllowedJson(fileName, value);
}

function ensureSessionsState() {
  ensureDir(stateDir);

  if (!fs.existsSync(sessionsFile)) {
    writeJson(sessionsFile, defaultSessions);
  }
}

function getSessionsStore(): SessionsStore {
  ensureSessionsState();
  return readJson(sessionsFile, defaultSessions);
}

function saveSessionsStore(nextStore: SessionsStore): SessionsStore {
  ensureSessionsState();
  writeJson(sessionsFile, nextStore);
  return nextStore;
}

function createMessage(role: string, content: string, extra: Record<string, unknown> = {}): AssistantMessage {
  return {
    content,
    createdAt: new Date().toISOString(),
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    ...extra
  };
}

function ensureSession(sessionId = "default"): AssistantSession {
  const store = getSessionsStore();
  const existing = store.sessions[sessionId];

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextSession = {
    createdAt: now,
    id: sessionId,
    messages: [],
    title: sessionId === "default" ? "Studio assistant" : sessionId,
    updatedAt: now
  };

  saveSessionsStore({
    sessions: {
      ...store.sessions,
      [sessionId]: nextSession
    }
  });

  return nextSession;
}

function getSession(sessionId = "default") {
  return ensureSession(sessionId);
}

function appendSessionMessages(sessionId = "default", messages: AssistantMessage[] = []): AssistantSession {
  const session = ensureSession(sessionId);
  const nextSession = {
    ...session,
    messages: [...session.messages, ...messages],
    updatedAt: new Date().toISOString()
  };
  const store = getSessionsStore();

  saveSessionsStore({
    sessions: {
      ...store.sessions,
      [sessionId]: nextSession
    }
  });

  return nextSession;
}

export {
  appendSessionMessages,
  createMessage,
  ensureSessionsState,
  getSession,
  getSessionsStore,
  saveSessionsStore,
  sessionsFile
};