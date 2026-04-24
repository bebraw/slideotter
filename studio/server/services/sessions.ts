const fs = require("fs");
const path = require("path");
const { stateDir } = require("./paths.ts");
const {
  ensureAllowedDir,
  writeAllowedJson
} = require("./write-boundary.ts");

const sessionsFile = path.join(stateDir, "sessions.json");

const defaultSessions = {
  sessions: {}
};

function ensureDir(dir) {
  ensureAllowedDir(dir);
}

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  writeAllowedJson(fileName, value);
}

function ensureSessionsState() {
  ensureDir(stateDir);

  if (!fs.existsSync(sessionsFile)) {
    writeJson(sessionsFile, defaultSessions);
  }
}

function getSessionsStore() {
  ensureSessionsState();
  return readJson(sessionsFile, defaultSessions);
}

function saveSessionsStore(nextStore) {
  ensureSessionsState();
  writeJson(sessionsFile, nextStore);
  return nextStore;
}

/** @returns {any} */
function createMessage(role, content, extra: any = {}) {
  return {
    content,
    createdAt: new Date().toISOString(),
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    ...extra
  };
}

function ensureSession(sessionId = "default") {
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

function appendSessionMessages(sessionId = "default", messages = []) {
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

module.exports = {
  appendSessionMessages,
  createMessage,
  ensureSessionsState,
  getSession,
  getSessionsStore,
  saveSessionsStore,
  sessionsFile
};
