const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const logger = require("./src/main/logger");
const { io } = require("socket.io-client");
const { autoUpdater } = require("electron-updater");

autoUpdater.logger = logger;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
let win;
let socket = null;
let isInstallingUpdate = false;
let token = {};
try {
  token = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data/user.json"), "utf8"),
  );
} catch (e) {
  logger.warn("Failed to read user.json, starting with empty token");
}

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
  syncLibrary: _syncLibrary,
  syncGui: _syncGui,
  syncLink: _syncLink,
} = require("./src/main/sync");
const { setMenu: _setMenu } = require("./src/main/menu");
let registerNlpHandlers = () => {};
try {
  registerNlpHandlers = require("./src/main/nlp").registerNlpHandlers;
} catch (e) {
  console.warn("[main] NLP require failed:", e.message);
}
// lightweight wrappers so existing call sites keep working
const syncLibrary = async () => _syncLibrary(appRoot);

app.commandLine.appendSwitch("ignore-certificate-errors");
const createWindow = () => {
  // Initialize socket inside createWindow so handlers can be registered before connect events
  socket = io("http://15.235.140.95:2023", {
    reconnection: true,
    timeout: 10000,
  });
  win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "/src/assets/img/nomokit.png"),
    title: "Nomokit-Desktop" + " - " + "v" + app.getVersion(),
  });
  win.maximize();
  if (!app.isPackaged) win.webContents.openDevTools();
  logger.info("socket.connected: " + socket.connected);
  // Load initial page based on current state
  if (socket.connected) {
    if (token.token !== undefined) {
      //win.loadURL("http://127.0.0.1:8601");
      win.loadFile(path.join(__dirname, "/src/gui/index.html"));
    } else {
      win.loadFile(path.join(__dirname, "/src/auth/index.html"));
    }
  } else {
    if (token.token !== undefined) {
      win.loadFile(path.join(__dirname, "/src/gui/index.html"));
      //win.loadURL("http://127.0.0.1:8601");
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

  // Set application menu (must be called after window is ready)
  _setMenu({ win, appRoot, app });
  //  START: Link server
  const { startLink: _startLink } = require("./src/main/link");
  link = _startLink({ win });
};
const syncGui = async (windowUpdate) => _syncGui(win, appRoot, windowUpdate);

const syncLink = async (windowUpdate) => _syncLink(win, appRoot, windowUpdate);
app.whenReady().then(async () => {
  const {
    ensureAppDataDir,
    migrateArduinoData,
    extractBundledAvrCore,
    ensureArduinoCliConfig,
  } = require("./src/main/appdata");
  ensureAppDataDir("arduino-data");
  ensureAppDataDir("libraries");
  ensureAppDataDir("local");
  migrateArduinoData(__dirname);
  extractBundledAvrCore(__dirname);
  ensureArduinoCliConfig(__dirname);

  // If sync window update is invoked, we need a fresh cli config set after sync
  // (syncLink is expected to be called after this in the startup sequence)

  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  await syncLibrary();
  await syncGui();
  await syncLink();
});

app.on("ready", async () => {
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
        })
        .catch((err) => logger.warn("Update dialog error: " + err.message));
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
            if (win && !win.isDestroyed()) {
              win.loadFile(path.join(__dirname, "/src/update/index.html"));
              autoUpdater.downloadUpdate();
            }
          }
        })
        .catch((err) => logger.warn("Update dialog error: " + err.message));
    }
  });
  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "question",
        title: "Update available",
        message: "Update Version is downloaded, do you want to install now?",
        buttons: ["Yes", "No"],
        yes: 0,
        no: 1,
      })
      .then(async (result) => {
        if (result.response === 0) {
          await cleanupBeforeInstallUpdate();
          // Grab downloaded installer path from electron-updater.
          const installerPath = autoUpdater.installerPath;
          if (installerPath && fs.existsSync(installerPath)) {
            // Spawn installer visible (no /S). NSIS shows progress UI.
            // App must fully exit first so NSIS doesn't detect it running.
            const { spawn } = require("child_process");
            const child = spawn(installerPath, ["--updated", "--force-run"], {
              detached: true,
              stdio: "ignore",
            });
            child.unref();
          }
          // Force-kill this process so installer can overwrite files.
          app.exit(0);
        }
      })
      .catch((err) => logger.warn("Update dialog error: " + err.message));
  });
  autoUpdater.on("error", (err) => {
    dialog.showErrorBox(
      "Error: ",
      err == null ? "unknown" : err.message || String(err),
    );
  });
  autoUpdater.on("download-progress", (progressObj) => {
    if (win && win.webContents && !win.isDestroyed()) {
      win.webContents.send("download-progress", progressObj.percent);
    }
  });
  // Register all listeners before triggering the update check
  autoUpdater.checkForUpdatesAndNotify();
});

app.on("window-all-closed", () => {
  if (socket) {
    socket.emit("logout", token);
  }
  app.quit();
});

app.on("before-quit", () => {
  // Allow guarded windows to close when app is quitting for update install.
  if (isInstallingUpdate) {
    app.emit("nomokit-force-close-update-windows");
  }
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

const cleanupBeforeInstallUpdate = async () => {
  isInstallingUpdate = true;

  // Notify guarded update windows to bypass close prevention logic.
  app.emit("nomokit-force-close-update-windows");

  // Stop socket reconnection loops during shutdown.
  try {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  } catch (e) {
    logger.warn("Update cleanup socket error: " + e.message);
  }

  // Stop link server if active.
  try {
    if (link && typeof link.close === "function") {
      link.close();
    }
  } catch (e) {
    logger.warn("Update cleanup link error: " + e.message);
  }

  // Kill active python task if any.
  try {
    killCurrentPython();
  } catch (e) {
    logger.warn("Update cleanup python error: " + e.message);
  }

  // Force close all windows to avoid close guards blocking updater.
  try {
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.removeAllListeners("close");
        w.destroy();
      } catch (_) {
        // ignore per-window errors
      }
    });
  } catch (e) {
    logger.warn("Update cleanup window error: " + e.message);
  }
};

ipcMain.handle("nomopro-python-run", async (event, { code, timeoutMs }) => {
  // Kill any existing process first
  killCurrentPython();

  const script = String(code || "");
  // timeoutMs === 0 means "no timeout" (event/realtime mode)
  const effectiveTimeout =
    typeof timeoutMs === "number"
      ? timeoutMs === 0
        ? Infinity
        : timeoutMs
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
      // Validate candidate can actually execute (mirrors health check logic)
      const validateArgs =
        candidate === "py" ? ["-3", "--version"] : ["--version"];
      const check = childProcess.spawnSync(candidate, validateArgs, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (check.status !== 0) {
        logger.info(
          `[Python] Skipping ${candidate} (spawnSync --version exit code ${check.status})`,
        );
        continue;
      }

      // Write script to temp file so stdin stays open for RPC responses
      // (_extension_rpc, _device_rpc)
      const tmpFile = path.join(
        require("os").tmpdir(),
        "nomopro_" +
          Date.now() +
          "_" +
          Math.random().toString(36).slice(2) +
          ".py",
      );
      try {
        fs.writeFileSync(tmpFile, script, "utf-8");
      } catch (_) {}
      const args = ["-u", tmpFile];

      // Use full inherited environment so CreateProcess succeeds
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      };

      proc = childProcess.spawn(candidate, args, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
      if (!proc) {
        logger.info(`[Python] spawn returned falsy for ${candidate}`);
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {}
        continue;
      }
      // Clean up temp file after process exits
      proc.on("exit", () => {
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {}
      });
      proc.on("error", (e) => {
        logger.info(
          `[Python] spawn error event for ${candidate}: ${e.message}`,
        );
      });
      used = candidate;
      logger.info("[Python] Using: " + candidate);
      break;
    } catch (err) {
      logger.info(`[Python] Candidate ${candidate} threw: ${err.message}`);
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

  // Error handler - closes process and triggers cleanup
  proc.on("error", (err) => {
    killCurrentPython();
    logger.warn(`Python process error: ${err.message}`);
  });

  // Timeout guard — skip when effectiveTimeout is Infinity (event mode)
  let timeoutId;
  let timeoutTriggered = false;
  let timeoutPromise;
  if (!isFinite(effectiveTimeout)) {
    timeoutPromise = new Promise(() => {}); // never resolve/reject
  } else {
    timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timeoutTriggered = true;
        timedOut = true;
        killCurrentPython();
        reject(
          new Error(`Python execution timed out after ${effectiveTimeout}ms.`),
        );
      }, effectiveTimeout);
    });
  }
  currentPythonTimeout = timeoutId;

  // Process close handler
  const closePromise = new Promise((resolve) => {
    proc.on("close", (exitCode, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        currentPythonTimeout = null;
      }
      if (currentPythonProc === proc) {
        currentPythonProc = null;
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

  // Race: close vs timeout.
  // Event mode (no timeout): closePromise never resolves → invoke hangs
  // until stopPythonCode() is called. This keeps event target alive.
  return await Promise.race([closePromise, timeoutPromise]).catch((err) => {
    if (!timeoutTriggered) throw err;
    return {
      exitCode: -1,
      signal: "SIGTERM",
      stdout,
      stderr: stderr + "\n[Execution timed out]",
      commands: [],
      timedOut: true,
    };
  });
});

ipcMain.handle("nomopro-python-write-stdin", async (event, data) => {
  logger.info("[Python-writeStdin] proc exists:", !!currentPythonProc);
  if (
    currentPythonProc &&
    currentPythonProc.stdin &&
    currentPythonProc.stdin.writable
  ) {
    const payload = String(data) + "\n";
    logger.info("[Python-writeStdin] writing:", payload.trim());
    currentPythonProc.stdin.write(payload);
    return { written: true };
  }
  logger.warn("[Python-writeStdin] FAILED - no process or stdin not writable");
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

// ---- MicroPython Upload & Flash IPC ----
const MicroPython = require("./src/link/src/upload/micropython");
const portLock = require("./src/link/src/lib/port-lock");
const traceLog = require("./src/link/src/lib/trace-log");
const IPC_LOCK_OWNER = "ipc-handler";

const _assertPortFree = (portPath) => {
  const holder = portLock.whoHolds(portPath);
  if (holder && holder !== IPC_LOCK_OWNER) {
    throw new Error(
      `Port ${portPath} is currently connected/in use elsewhere (e.g. live serial monitor). Please disconnect it in the app before uploading or flashing.`,
    );
  }
};

// Rate-limit our OWN attempts to open a given port, no matter how fast the
// renderer calls us. This is a defensive measure: repeatedly hammering
// SerialPort.open() on a port that's already open elsewhere (hundreds of
// times per minute, as observed in trace logs) is exactly the kind of
// handle churn that can destabilize a flaky USB-serial kernel driver, even
// though each individual failed attempt looks harmless on its own.
const _lastAttempt = new Map(); // normalizedPort -> timestamp
const MIN_INTERVAL_MS = 1000;
const _shouldThrottle = (portPath) => {
  const key = String(portPath || "").toUpperCase();
  const now = Date.now();
  const last = _lastAttempt.get(key) || 0;
  if (now - last < MIN_INTERVAL_MS) {
    return true;
  }
  _lastAttempt.set(key, now);
  return false;
};

/**
 * Resolve tools and userData paths from the link server if available.
 */
const _getMicroPythonConfig = () => {
  const toolsPath = link
    ? link.toolsPath
    : path.join(__dirname, "src", "link", "tools");
  const userDataPath = link ? link.userDataPath : app.getPath("userData");
  return { toolsPath, userDataPath };
};

ipcMain.handle(
  "micropython-flash",
  async (event, { portPath, board, firmwareUrl, flashOffset }) => {
    if (!portPath) throw new Error("portPath is required");

    // Normalize Windows friendly name: "USB-SERIAL (COM6)" -> "COM6"
    const normalizedPort = portPath.replace(/.*\((COM\d+)\).*/i, "$1");
    console.log(
      "[micropython-flash] raw port:",
      portPath,
      "normalized:",
      normalizedPort,
    );

    const { toolsPath, userDataPath } = _getMicroPythonConfig();

    const config = { board: board || "esp32", firmwareUrl, flashOffset };

    _assertPortFree(normalizedPort);
    portLock.acquire(normalizedPort, IPC_LOCK_OWNER);
    try {
      const mp = new MicroPython(
        normalizedPort,
        config,
        userDataPath,
        toolsPath,
        (msg) => {
          if (win && win.webContents) {
            win.webContents.send("micropython-flash-progress", { text: msg });
          }
        },
      );

      if (board === "rpi_pico") {
        const info = MicroPython.FIRMWARE
          ? MicroPython.FIRMWARE.rpi_pico
          : null;
        if (info) mp._config.firmwareInfo = info;
        await mp.flashPicoUF2();
      } else {
        await mp.flashWithEsptool(board || "esp32");
      }

      return { success: true };
    } finally {
      portLock.release(normalizedPort, IPC_LOCK_OWNER);
    }
  },
);

ipcMain.handle(
  "micropython-upload",
  async (event, { portPath, code, fileName, board, baudRate }) => {
    if (!portPath || !code) throw new Error("portPath and code are required");
    traceLog.trace(
      "ipc:micropython-upload",
      `CALLED portPath=${portPath} bytes=${code.length} board=${board} fileName=${fileName}`,
    );
    const { toolsPath, userDataPath } = _getMicroPythonConfig();

    const config = {
      board: board || "esp32",
      fileName: fileName || "main.py",
      baudRate: baudRate || 115200,
    };

    _assertPortFree(portPath);
    portLock.acquire(portPath, IPC_LOCK_OWNER);
    try {
      const mp = new MicroPython(
        portPath,
        config,
        userDataPath,
        toolsPath,
        (msg) => {
          if (win && win.webContents) {
            win.webContents.send("micropython-progress", { text: msg });
          }
        },
      );

      const result = await mp.uploadCode(code);
      return result;
    } finally {
      portLock.release(portPath, IPC_LOCK_OWNER);
    }
  },
);

ipcMain.handle("micropython-detect", async (event, { portPath, baudRate }) => {
  if (!portPath) throw new Error("portPath is required");

  // Already connected live elsewhere (WebSocket session) — don't even try to
  // open a second handle, just say so immediately. This is what was missing
  // before: this handler used to attempt SerialPort.open() unconditionally,
  // and the renderer was calling it in a tight poll loop with no backoff,
  // producing hundreds of failed opens per minute against the same port
  // that was already held open — exactly the kind of handle churn that can
  // destabilize a flaky USB-serial driver over time.
  const holder = portLock.whoHolds(portPath);
  if (holder && holder !== IPC_LOCK_OWNER) {
    return {
      installed: true,
      type: "unknown",
      note: "port already connected via live session",
    };
  }

  if (_shouldThrottle(portPath)) {
    traceLog.trace(
      "ipc:micropython-detect",
      `THROTTLED for ${portPath} (called again within ${MIN_INTERVAL_MS}ms)`,
    );
    return { installed: false, type: "throttled" };
  }

  const { toolsPath, userDataPath } = _getMicroPythonConfig();

  const config = { baudRate: baudRate || 115200 };
  portLock.acquire(portPath, IPC_LOCK_OWNER);
  try {
    const mp = new MicroPython(
      portPath,
      config,
      userDataPath,
      toolsPath,
      (msg) => {
        if (win && win.webContents) {
          win.webContents.send("micropython-progress", { text: msg });
        }
      },
    );

    return await mp.detectFirmware(portPath, baudRate || 115200);
  } finally {
    portLock.release(portPath, IPC_LOCK_OWNER);
  }
});

ipcMain.on("micropython-input", (event, { portPath, text }) => {
  if (!portPath || !text) return;
  if (portLock.whoHolds(portPath) === "websocket-session") {
    // Live session already owns this port — let it handle input instead of
    // racing it with a second SerialPort open.
    return;
  }
  const { SerialPort: SP } = require("serialport");
  const port = new SP({ path: portPath, baudRate: 115200, autoOpen: false });
  portLock.acquire(portPath, IPC_LOCK_OWNER);
  port.open((err) => {
    if (err) {
      portLock.release(portPath, IPC_LOCK_OWNER);
      return;
    }
    port.write(text + "\r\n", () => {});
    port.drain(() =>
      port.close(() => portLock.release(portPath, IPC_LOCK_OWNER)),
    );
  });
});

// ---- NLP IPC handlers ----
try {
  registerNlpHandlers();
} catch (e) {
  console.error("[main] NLP register failed:", e.message);
}

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
