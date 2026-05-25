const { app, BrowserWindow, dialog, Menu, shell } = require("electron");
const OpenBlockLink = require("./src/link/src");
const path = require("path");
const fs = require("fs");
const logger = require("./src/main/logger");
const { io } = require("socket.io-client");
const { autoUpdater } = require("electron-updater");

autoUpdater.logger = logger;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
let win;
//http://15.235.140.95:2023
const socket = io("http://15.235.140.95:2023", {
  reconnection: true,
  timeout: 10000,
});
let token = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/user.json"), "utf8"),
);

const getPythonCandidates = () => {
  const candidates = [];

  // Virtualenv Python (user-installed packages like numpy)
  try {
    const isWin = process.platform === "win32";
    const venvPython = path.join(
      __dirname,
      "data",
      "python-env",
      isWin ? "Scripts" : "bin",
      isWin ? "python.exe" : "python3",
    );
    if (fs.existsSync(venvPython)) candidates.push(venvPython);
  } catch (e) {
    // ignore
  }

  try {
    const resourcesPython = path.join(
      app.isPackaged ? process.resourcesPath : __dirname,
      "python",
    );
    if (fs.existsSync(resourcesPython)) {
      if (process.platform === "win32") {
        const pexe = path.join(resourcesPython, "python.exe");
        const pexeAlt = path.join(resourcesPython, "python", "python.exe");
        if (fs.existsSync(pexe)) candidates.push(pexe);
        if (fs.existsSync(pexeAlt)) candidates.push(pexeAlt);
      } else {
        const pyBin = path.join(resourcesPython, "bin", "python3");
        const pyBinAlt = path.join(resourcesPython, "bin", "python");
        const pyRoot = path.join(resourcesPython, "python3");
        if (fs.existsSync(pyBin)) candidates.push(pyBin);
        if (fs.existsSync(pyBinAlt)) candidates.push(pyBinAlt);
        if (fs.existsSync(pyRoot)) candidates.push(pyRoot);
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallback to system candidates
  if (process.platform === "win32") {
    candidates.push("python", "py");
  } else {
    candidates.push("python3", "python");
  }
  return candidates;
};
let link;
const appRoot = __dirname;
// delegate sync logic to helper module (keeps main.js small)
const {
  syncLibary: _syncLibary,
  syncGui: _syncGui,
  syncLink: _syncLink,
} = require("./src/main/sync");
const { setMenu: _setMenu } = require("./src/main/menu");

// lightweight wrappers so existing call sites keep working
const syncLibary = async () => _syncLibary(appRoot);

app.commandLine.appendSwitch("ignore-certificate-errors");
const createWindow = () => {
  win = new BrowserWindow({
    width: 1620,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "/src/assets/img/nomokit.png"),
    title: "Nomopro-Desktop" + " - " + "v" + app.getVersion(),
  });
  win.webContents.openDevTools();
  logger.info("socket.connected: " + socket.connected);
  // Load initial page based on current state
  if (socket.connected) {
    // Already connected, load appropriate page
    if (token.token !== undefined) {
      win.loadFile(path.join(__dirname, "/src/gui/index.html"));
    } else {
      win.loadFile(path.join(__dirname, "/src/auth/index.html"));
    }
  } else {
    if (token.token !== undefined) {
      // Wait for connection to load GUI
      setMenu();
      win.loadFile(path.join(__dirname, "/src/gui/index.html"));
    } else {
      win.loadFile(path.join(__dirname, "/src/auth/index.html"));
    }
  }
  // register ipc and socket handlers from helper modules
  const { registerIpc } = require("./src/main/ipc");
  const { initSocket } = require("./src/main/socket");
  const { registerPipHandlers } = require("./src/main/pip-manager");
  const { registerProjectDepsHandlers } = require("./src/main/project-deps");
  const { registerSafeInstallHandlers } = require("./src/main/safe-install");
  const {
    registerDiagnosticHandlers,
  } = require("./src/main/diagnostic-bundle");
  const { registerOfflineCacheHandlers } = require("./src/main/offline-cache");
  const { registerRecoveryHandlers } = require("./src/main/recovery-mode");
  registerIpc({ win, appRoot, socket });
  const bundledPythonDir = path.join(
    app.isPackaged ? process.resourcesPath : __dirname,
    "python",
  );
  registerPipHandlers({ appRoot, win, bundledPythonDir });
  registerProjectDepsHandlers({ appRoot });
  registerSafeInstallHandlers();
  registerDiagnosticHandlers({ appRoot });
  registerOfflineCacheHandlers({ appRoot });
  registerRecoveryHandlers({ appRoot });
  initSocket({ socket, appRoot, win });
  win.on("close", async () => {
    win.destroy();
  });

  //  START: Link server
  const { startLink: _startLink } = require("./src/main/link");
  link = _startLink({ win });
};
const syncGui = async (windowUpdate) => _syncGui(win, appRoot, windowUpdate);

const syncLink = async (windowUpdate) => _syncLink(win, appRoot, windowUpdate);
app.whenReady().then(async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  await syncLibary();
  await syncGui();
  await syncLink();
});

app.on("ready", async () => {
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on("update-available", () => {
    if (process.platform === "darwin") {
      dialog
        .showMessageBox({
          type: "question",
          title: "Update available",
          message:
            "Update is available, please download manually on the nomokit website",
          buttons: ["Yes", "No"],
          yes: 0,
          no: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            shell.openExternal("https://nomo-kit.com/download-macos");
          }
        });
    } else {
      dialog
        .showMessageBox({
          type: "question",
          title: "Update available",
          message: "Update Version is available",
          buttons: ["Yes", "No"],
          yes: 0,
          no: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            win.loadFile(path.join(__dirname, "/src/update/index.html"));
            autoUpdater.downloadUpdate();
          }
        });
    }
  });
  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "question",
        title: "Update available",
        message: "Update is downloaded, will be installed on restart",
        buttons: ["Yes", "No"],
        yes: 0,
        no: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, false);
          app.quit();
        }
      });
  });
  autoUpdater.on("error", (err) => {
    dialog.showErrorBox("Error: ", err == null ? "unknown" : err);
  });
  autoUpdater.on("download-progress", (progressObj) => {
    win.webContents.send("download-progress", progressObj.percent);
  });
});

app.on("window-all-closed", () => {
  socket.emit("logout", token);
  win.destroy();
  app.exit();
});

const setMenu = () => _setMenu({ win, appRoot, app });

app.on("before-quit", (event) => {
  event.preventDefault();
  win.destroy();
});

// ipc handlers and socket listeners are registered by modules in createWindow

// ---- Hardened Python runner IPC for renderer bridge ----
const { ipcMain } = require("electron");
const childProcess = require("child_process");

let currentPythonProc = null;
let currentPythonTimeout = null;
const PYTHON_EXECUTION_TIMEOUT_MS = 30000; // 30s default timeout

const killCurrentPython = () => {
  if (currentPythonTimeout) {
    clearTimeout(currentPythonTimeout);
    currentPythonTimeout = null;
  }
  if (currentPythonProc && !currentPythonProc.killed) {
    try {
      currentPythonProc.kill("SIGKILL");
    } catch (e) {
      logger.warn("Failed to kill existing python process");
    }
    currentPythonProc = null;
  }
};

ipcMain.handle("nomopro-python-run", async (event, { code, timeoutMs }) => {
  // Kill any existing process first
  killCurrentPython();

  const script = String(code || "");
  const effectiveTimeout =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? timeoutMs
      : PYTHON_EXECUTION_TIMEOUT_MS;

  // Use getPythonCandidates() which bundles bundled + system candidates
  const candidates = getPythonCandidates();

  let proc = null;
  let used = null;
  logger.info("[Python] Candidates: " + candidates.join(", "));
  let stdout = "";
  let stderr = "";
  let timedOut = false;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const isAbsolute = path.isAbsolute(candidate);
      const args = isAbsolute
        ? ["-u", "-c", script]
        : candidate === "py"
          ? ["-3", "-u", "-c", script]
          : ["-u", "-c", script];

      // Sanitized environment: only pass essential vars
      const env = {
        PATH: process.env.PATH || "",
        HOME: process.env.HOME || process.env.USERPROFILE || "",
        USERPROFILE: process.env.USERPROFILE || "",
        SYSTEMROOT: process.env.SYSTEMROOT || "",
        TMP: process.env.TMP || process.env.TEMP || "",
        TEMP: process.env.TEMP || process.env.TMP || "",
        PYTHONUNBUFFERED: "1",
      };

      proc = childProcess.spawn(candidate, args, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
      used = candidate;
      logger.info("[Python] Using: " + candidate);
      break;
    } catch (err) {
      proc = null;
    }
  }

  if (!proc) {
    throw new Error(
      `Python executable not found. Tried: ${candidates.join(", ")}`,
    );
  }

  currentPythonProc = proc;

  // Line-buffered stdout streaming
  let stdoutBuffer = "";
  proc.stdout.on("data", (chunk) => {
    const text = String(chunk || "");
    stdout += text;
    stdoutBuffer += text;
    try {
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      lines.forEach((line) => {
        if (win && win.webContents)
          win.webContents.send("nomopro-python-stdout", line);
      });
    } catch (e) {
      // ignore send errors
    }
  });

  // Line-buffered stderr streaming
  let stderrBuffer = "";
  proc.stderr.on("data", (chunk) => {
    const text = String(chunk || "");
    stderr += text;
    stderrBuffer += text;
    try {
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || "";
      lines.forEach((line) => {
        if (win && win.webContents)
          win.webContents.send("nomopro-python-stderr", line);
      });
    } catch (e) {
      // ignore send errors
    }
  });

  // Error handler - prevents hanging promise on spawn failure
  const procError = new Promise((_, reject) => {
    proc.on("error", (err) => {
      killCurrentPython();
      reject(new Error(`Python process error: ${err.message}`));
    });
  });

  // Timeout guard
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      killCurrentPython();
      reject(
        new Error(`Python execution timed out after ${effectiveTimeout}ms.`),
      );
    }, effectiveTimeout);
  });
  currentPythonTimeout = timeoutId;

  // Process close handler
  const closePromise = new Promise((resolve) => {
    proc.on("close", (exitCode, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        currentPythonTimeout = null;
      }
      if (timedOut) {
        resolve({
          exitCode: -1,
          signal: "SIGTERM",
          stdout,
          stderr: stderr + "\n[Execution timed out]",
          commands: [],
          timedOut: true,
        });
        return;
      }
      currentPythonProc = null;

      // Flush remaining buffers
      if (stdoutBuffer) {
        stdout += "\n" + stdoutBuffer;
        if (win && win.webContents)
          win.webContents.send("nomopro-python-stdout", stdoutBuffer);
      }
      if (stderrBuffer) {
        stderr += "\n" + stderrBuffer;
        if (win && win.webContents)
          win.webContents.send("nomopro-python-stderr", stderrBuffer);
      }

      // NDJSON parse stdout for VM commands
      const commands = [];
      try {
        const allLines = stdout.split(/\r?\n/);
        for (const line of allLines) {
          const t = line && line.trim();
          if (!t) continue;
          try {
            const obj = JSON.parse(t);
            if (obj && (obj.cmd || obj.action || Array.isArray(obj.args)))
              commands.push(obj);
          } catch (e) {
            // ignore non-json lines
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      resolve({ exitCode, signal, stdout, stderr, commands, timedOut: false });
    });
  });

  // Race: close vs error vs timeout
  return await Promise.race([closePromise, procError, timeoutPromise]);
});

ipcMain.handle("nomopro-python-write-stdin", async (event, data) => {
  if (
    currentPythonProc &&
    currentPythonProc.stdin &&
    currentPythonProc.stdin.writable
  ) {
    currentPythonProc.stdin.write(String(data) + "\n");
    return { written: true };
  }
  return { written: false, reason: "no-process-or-stdin" };
});

ipcMain.handle("nomopro-python-stop", async () => {
  if (currentPythonProc && !currentPythonProc.killed) {
    try {
      currentPythonProc.kill("SIGKILL");
      currentPythonProc = null;
      if (currentPythonTimeout) {
        clearTimeout(currentPythonTimeout);
        currentPythonTimeout = null;
      }
      return { stopped: true };
    } catch (e) {
      return { stopped: false, error: String(e) };
    }
  }
  if (currentPythonTimeout) {
    clearTimeout(currentPythonTimeout);
    currentPythonTimeout = null;
  }
  return { stopped: false, reason: "no-process" };
});

ipcMain.handle("get-python-candidates", async () => {
  return getPythonCandidates();
});

// ---- Startup health check for bundled Python ----
app.whenReady().then(async () => {
  // Run health check in background (non-blocking)
  setTimeout(async () => {
    try {
      const candidates = getPythonCandidates();
      let found = false;
      for (const c of candidates) {
        try {
          const res = childProcess.spawnSync(c, ["--version"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          });
          if (res.status === 0) {
            const ver = (res.stdout || res.stderr || "").trim();
            logger.info(`Python health check OK: ${c} -> ${ver}`);
            found = true;
            break;
          }
        } catch (e) {
          // continue
        }
      }
      if (!found) {
        logger.warn(
          `Python health check FAILED. No working interpreter found from candidates: ${candidates.join(", ")}`,
        );
      }
    } catch (e) {
      logger.warn(`Python health check error: ${e.message}`);
    }
  }, 3000); // Run 3s after startup
});
