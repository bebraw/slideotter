const fs = require("node:fs");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell
} = require("electron");

const host = "127.0.0.1";
let mainWindow = null;
let presentationWindow = null;
let server = null;
let serverUrl = null;
let runtimeModules = null;

function ensureDesktopEnvironment() {
  if (!process.env.SLIDEOTTER_HOME && !process.env.SLIDEOTTER_DATA_DIR) {
    process.env.SLIDEOTTER_HOME = path.join(app.getPath("home"), ".slideotter");
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  }
}

function resolveRuntimeModule(relativePath) {
  const appPath = app.getAppPath();
  const packagedPath = path.join(appPath, "dist", relativePath);
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  return path.join(appPath, relativePath);
}

function loadRuntimeModules() {
  if (runtimeModules) {
    return runtimeModules;
  }

  runtimeModules = {
    outputConfig: require(resolveRuntimeModule("studio/server/services/output-config.js")),
    runtimeConfig: require(resolveRuntimeModule("studio/server/services/runtime-config.js")),
    server: require(resolveRuntimeModule("studio/server/index.js"))
  };
  return runtimeModules;
}

function verifyBrowserDependency() {
  try {
    const { chromium } = require("playwright");
    const executablePath = chromium.executablePath();
    if (fs.existsSync(executablePath)) {
      return;
    }

    throw new Error(`Chromium was not found at ${executablePath}`);
  } catch (error) {
    const message = [
      "PDF export and render validation need a packaged Playwright Chromium browser.",
      "Run `npm run desktop:browsers` before creating the macOS desktop package.",
      error && error.message ? error.message : String(error)
    ].join("\n\n");
    if (process.env.SLIDEOTTER_ELECTRON_SMOKE === "1") {
      throw new Error(message);
    }
    dialog.showMessageBox({
      message,
      title: "slideotter desktop dependency check",
      type: "warning"
    });
  }
}

function waitForServerListening(activeServer) {
  if (activeServer.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    activeServer.once("error", reject);
    activeServer.once("listening", resolve);
  });
}

async function startStudioServer() {
  ensureDesktopEnvironment();
  const modules = loadRuntimeModules();
  verifyBrowserDependency();
  modules.runtimeConfig.initializeUserData({
    userDataRoot: process.env.SLIDEOTTER_HOME || process.env.SLIDEOTTER_DATA_DIR
  });

  server = modules.server.startServer({ host, port: 0 });
  await waitForServerListening(server);

  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("The studio server did not expose a loopback port.");
  }

  serverUrl = `http://${host}:${address.port}`;
  return serverUrl;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    height: 900,
    minHeight: 720,
    minWidth: 1100,
    show: false,
    title: "slideotter",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true
    },
    width: 1440
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isLocalStudioUrl(targetUrl, "/present")) {
      openPresentationWindow(targetUrl);
      return { action: "deny" };
    }

    if (isLocalStudioUrl(targetUrl)) {
      return { action: "allow" };
    }

    shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (isLocalStudioUrl(targetUrl)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(targetUrl);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(url);
}

function openPresentationWindow(targetUrl = `${serverUrl}/present`) {
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.focus();
    presentationWindow.loadURL(targetUrl);
    return;
  }

  presentationWindow = new BrowserWindow({
    fullscreenable: true,
    height: 900,
    minHeight: 720,
    minWidth: 960,
    title: "slideotter presentation",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true
    },
    width: 1280
  });

  presentationWindow.on("closed", () => {
    presentationWindow = null;
  });
  presentationWindow.loadURL(targetUrl);
}

function isLocalStudioUrl(targetUrl, pathPrefix = "") {
  try {
    const parsed = new URL(targetUrl);
    const expected = new URL(serverUrl);
    return parsed.origin === expected.origin && parsed.pathname.startsWith(pathPrefix);
  } catch (error) {
    return false;
  }
}

function showStartupError(error) {
  dialog.showErrorBox("slideotter could not start", error && error.message ? error.message : String(error));
}

function openPathIfExists(filePath, missingMessage) {
  if (!filePath || !fs.existsSync(filePath)) {
    dialog.showMessageBox({
      buttons: ["OK"],
      message: missingMessage,
      type: "info"
    });
    return;
  }

  shell.openPath(filePath);
}

function openCurrentOutput() {
  const { outputConfig } = loadRuntimeModules();
  const { pdfFile } = outputConfig.getOutputConfig();
  openPathIfExists(pdfFile, "The active presentation does not have a generated PDF yet.");
}

function createAppMenu() {
  const { runtimeConfig } = loadRuntimeModules();
  const config = runtimeConfig.getRuntimeConfig();

  const template = [
    ...(process.platform === "darwin" ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" }
      ]
    }] : []),
    {
      label: "File",
      submenu: [
        {
          click: () => openPathIfExists(config.userDataRoot, "The data folder has not been created yet."),
          label: "Open Data Folder"
        },
        {
          click: () => openPathIfExists(config.archiveDir, "The archive folder has not been created yet."),
          label: "Open Archive Folder"
        },
        {
          click: openCurrentOutput,
          label: "Open Current Presentation Output"
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          accelerator: "Shift+CommandOrControl+P",
          click: () => openPresentationWindow(),
          label: "Open Presentation Window"
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          click: () => dialog.showMessageBox({
            detail: `Data folder: ${config.userDataRoot}`,
            message: "slideotter",
            type: "info"
          }),
          label: "About slideotter"
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function runSmokeCheck() {
  const response = await fetch(`${serverUrl}/api/runtime`);
  if (!response.ok) {
    throw new Error(`Runtime health check failed with HTTP ${response.status}`);
  }
  await response.json();
  app.quit();
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (server) {
    server.close();
    server = null;
  }
});

app.whenReady()
  .then(startStudioServer)
  .then((url) => {
    createAppMenu();
    createWindow(url);
    if (process.env.SLIDEOTTER_ELECTRON_SMOKE === "1") {
      return runSmokeCheck();
    }
    return null;
  })
  .catch((error) => {
    showStartupError(error);
    app.exit(1);
  });

app.on("activate", () => {
  if (!mainWindow && serverUrl) {
    createWindow(serverUrl);
  }
});
