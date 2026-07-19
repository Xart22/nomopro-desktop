/**
 * Diagnostic Bundle (Phase 7 — Step 27)
 *
 * One-click diagnostic report generator:
 * - Collects runner logs, pip logs, runtime version, path env
 * - Preload contract verification
 * - System information
 * - Useful for support tickets
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const logger = require("./logger");
const { ipcMain } = require("electron");
const { walkDirSize } = require("./utils");

/**
 * Collect all diagnostic information
 */
const collectDiagnostics = async (event, { appRoot }) => {
  const bundle = {
    timestamp: new Date().toISOString(),
    platform: {
      os: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      memory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
      freeMemory: `${Math.round((os.freemem() / 1024 / 1024 / 1024) * 100) / 100} GB`,
      uptime: `${Math.round(os.uptime() / 3600)} hours`,
      userInfo: os.userInfo().username,
    },
    app: {
      name: "nomopro-desktop",
      version: (() => {
        try {
          const pkg = JSON.parse(
            fs.readFileSync(path.join(appRoot, "package.json"), "utf8"),
          );
          return pkg.version || "unknown";
        } catch (e) {
          return "unknown";
        }
      })(),
      appRoot: appRoot,
      nodeVersion: process.version,
      electronVersion: process.versions.electron || "unknown",
      chromeVersion: process.versions.chrome || "unknown",
    },
    python: {},
    pip: {},
    venv: {},
    fileStorage: {},
    preloadContracts: {},
    runnerLogs: [],
    errors: [],
  };

  // Python version check — prioritaskan bundled Python, mirror getPythonCandidates() di main.js
  const candidates = [];
  // Bundled Python — try resourcesPath first (packaged), fallback appRoot (dev)
  const bundledDirs = [path.join(appRoot, "python")];
  try {
    const { app } = require("electron");
    if (app.isPackaged) {
      bundledDirs.unshift(path.join(process.resourcesPath, "python"));
    }
  } catch (_) {}
  for (const pythonDir of bundledDirs) {
    try {
      if (fs.existsSync(pythonDir)) {
        const isWin = process.platform === "win32";
        const pexe = path.join(
          pythonDir,
          isWin ? "python.exe" : "bin",
          isWin ? "python.exe" : "python3",
        );
        if (fs.existsSync(pexe)) candidates.push(pexe);
      }
    } catch (e) {}
  }
  // Virtualenv Python
  try {
    const venvDir = path.join(appRoot, "data", "python-env");
    const isWin = process.platform === "win32";
    const venvPy = path.join(
      venvDir,
      isWin ? "Scripts" : "bin",
      isWin ? "python.exe" : "python3",
    );
    if (fs.existsSync(venvPy)) candidates.push(venvPy);
  } catch (e) {}
  // System PATH fallback
  candidates.push("python3", "python", "py");
  for (const c of candidates) {
    try {
      const args = c === "py" ? ["-3", "--version"] : ["--version"];
      const res = spawnSync(c, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (res.status === 0) {
        bundle.python.found = true;
        bundle.python.path = c;
        bundle.python.version = (res.stdout || res.stderr || "").trim();
        break;
      }
    } catch (e) {}
  }
  if (!bundle.python.found) {
    bundle.python.found = false;
    bundle.python.version = "Not found";
  }

  // Pip version check
  try {
    const pipRes = spawnSync("pip", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (pipRes.status === 0) {
      bundle.pip.found = true;
      bundle.pip.version = (pipRes.stdout || pipRes.stderr || "").trim();
    }
  } catch (e) {}
  if (!bundle.pip.found) {
    try {
      const pip3Res = spawnSync("pip3", ["--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (pip3Res.status === 0) {
        bundle.pip.found = true;
        bundle.pip.version = (pip3Res.stdout || pip3Res.stderr || "").trim();
      }
    } catch (e) {}
  }

  // Venv status
  const venvDir = path.join(appRoot, "data", "python-env");
  if (fs.existsSync(venvDir)) {
    bundle.venv.exists = true;
    bundle.venv.path = venvDir;
    const isWin = process.platform === "win32";
    const pyPath = path.join(
      venvDir,
      isWin ? "Scripts" : "bin",
      isWin ? "python.exe" : "python3",
    );
    bundle.venv.pythonExists = fs.existsSync(pyPath);
    // Use python -m pip instead of pip.exe (incompatible launcher on some Windows builds)
    bundle.venv.pipExists = fs.existsSync(pyPath);

    // Get pip version
    if (bundle.venv.pipExists) {
      try {
        const verRes = spawnSync(pyPath, ["-m", "pip", "--version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10000,
        });
        if (verRes.status === 0) {
          bundle.venv.pipVersion = (verRes.stdout || "").trim();
        }
      } catch (_) {}
    }

    // Count installed packages
    if (bundle.venv.pipExists) {
      try {
        const listRes = spawnSync(
          pyPath,
          ["-m", "pip", "list", "--format=json"],
          {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 10000,
          },
        );
        if (listRes.status === 0) {
          try {
            const pkgs = JSON.parse(listRes.stdout);
            bundle.venv.packageCount = pkgs.length;
            bundle.venv.packages = pkgs.map((p) => `${p.name}==${p.version}`);
          } catch (parseErr) {
            bundle.venv.packageCount = -1;
            bundle.venv.listRaw = listRes.stdout.slice(0, 500);
            bundle.venv.listError = `JSON parse error: ${parseErr.message}`;
          }
        } else {
          bundle.venv.packageCount = -1;
          bundle.venv.listError = `pip list exit ${listRes.status}: ${(listRes.stderr || "").slice(0, 200)}`;
        }
      } catch (e) {
        bundle.venv.listError = e.message;
      }
    }

    // Warn: venv exists but packages = 0 (likely relocation issue)
    if (bundle.venv.pipExists && bundle.venv.packageCount === 0) {
      bundle.venv.warning =
        "Venv has 0 packages — pyvenv.cfg home path may be stale. Run Recovery → Restore Python.";
    }

    // Check venv size
    try {
      const { size } = walkDirSize(venvDir, { excludeDir: "__pycache__" });
      bundle.venv.sizeBytes = size;
      bundle.venv.sizeMB = Math.round((size / 1024 / 1024) * 100) / 100;
    } catch (e) {
      bundle.venv.sizeError = e.message;
    }
  } else {
    bundle.venv.exists = false;
  }

  // File storage status
  const docsDir = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, "Documents")
    : process.env.HOME
      ? path.join(process.env.HOME, "Documents")
      : null;

  // Use the same logic as ipc.js ensureDefaultStorageDir
  let storageDir = null;
  if (docsDir) {
    storageDir = path.join(docsDir, "Nomokit");
    bundle.fileStorage.defaultDir = storageDir;
    bundle.fileStorage.exists = fs.existsSync(storageDir);
  } else {
    bundle.fileStorage.defaultDir = null;
    bundle.fileStorage.exists = false;
  }

  // Also check fallback dir (used when Documents is inaccessible)
  const fallbackDir = path.join(appRoot, "data", "projects");
  const fallbackExists = fs.existsSync(fallbackDir);

  // Use whichever actually exists
  if (!bundle.fileStorage.exists && fallbackExists) {
    storageDir = fallbackDir;
    bundle.fileStorage.defaultDir = fallbackDir;
    bundle.fileStorage.exists = true;
  }

  if (bundle.fileStorage.exists && storageDir) {
    try {
      const files = fs.readdirSync(storageDir).filter((f) => {
        const full = path.join(storageDir, f);
        return fs.statSync(full).isFile();
      });
      bundle.fileStorage.fileCount = files.length;
      bundle.fileStorage.files = files;
    } catch (e) {
      bundle.fileStorage.listError = e.message;
    }
  }

  // Check bundled python payload — try resourcesPath first when packaged
  const pythonDirs = [path.join(appRoot, "python")];
  try {
    const { app } = require("electron");
    if (app.isPackaged) {
      pythonDirs.unshift(path.join(process.resourcesPath, "python"));
    }
  } catch (_) {}
  let pythonDir = null;
  for (const d of pythonDirs) {
    if (fs.existsSync(d)) {
      pythonDir = d;
      break;
    }
  }
  bundle.python.bundledExists = !!pythonDir;
  if (pythonDir) {
    try {
      const entries = fs.readdirSync(pythonDir);
      bundle.python.bundledFiles = entries;
      const pexe = path.join(pythonDir, "python.exe");
      bundle.python.bundledPythonExe = fs.existsSync(pexe);
    } catch (e) {
      bundle.python.bundledError = e.message;
    }
  }

  // Preload contracts verification — scan preload.js for contextBridge exposures
  try {
    const preloadPath = path.join(appRoot, "preload.js");
    if (fs.existsSync(preloadPath)) {
      const preloadContent = fs.readFileSync(preloadPath, "utf8");
      const exposures = [];
      const regex = /exposeInMainWorld\("(\w+)"\s*,\s*\{/g;
      let match;
      while ((match = regex.exec(preloadContent)) !== null) {
        exposures.push(match[1]);
      }
      bundle.preloadContracts = {
        file: "preload.js",
        exists: true,
        exposedApis: exposures,
        functionCount: (preloadContent.match(/async\s+\(/g) || []).length,
      };
    } else {
      bundle.preloadContracts = {
        file: "preload.js",
        exists: false,
        exposedApis: [],
      };
    }
  } catch (e) {
    bundle.preloadContracts = {
      file: "preload.js",
      exists: false,
      error: e.message,
      exposedApis: [],
    };
  }

  // Hardware / Serial ports (M1)
  try {
    const { SerialPort } = require("serialport");
    bundle.serialPorts = [];
    SerialPort.list()
      .then((ports) => {
        bundle.serialPorts = ports.map((p) => ({
          path: p.path,
          manufacturer: p.manufacturer || "unknown",
          productId: p.productId || "",
          vendorId: p.vendorId || "",
        }));
      })
      .catch(() => {
        bundle.serialPorts = [{ error: "Failed to list serial ports" }];
      });
  } catch (e) {
    bundle.serialPorts = [{ error: "serialport not available" }];
  }

  // GPU info (M4)
  try {
    const gpuResult = spawnSync(
      process.platform === "win32" ? "wmic" : "system_profiler",
      process.platform === "win32"
        ? ["path", "win32_VideoController", "get", "name"]
        : ["SPDisplaysDataType"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 },
    );
    if (gpuResult.status === 0) {
      bundle.gpu = { raw: gpuResult.stdout.trim() };
    } else {
      bundle.gpu = { notAvailable: true };
    }
    // Also check nvidia-smi
    const nvidiaResult = spawnSync(
      "nvidia-smi",
      ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 },
    );
    if (nvidiaResult.status === 0) {
      bundle.gpu.nvidia = nvidiaResult.stdout.trim();
      bundle.gpu.hasCuda = true;
    }
  } catch (_) {
    bundle.gpu = { notAvailable: true };
  }

  // Check project deps profiles
  const depsDir = path.join(appRoot, "data", "project-deps");
  bundle.projectDepsExist = fs.existsSync(depsDir);
  if (bundle.projectDepsExist) {
    try {
      bundle.projectDepsProfiles = fs
        .readdirSync(depsDir)
        .filter((f) => f.endsWith("-requirements.txt"));
    } catch (e) {
      bundle.projectDepsError = e.message;
    }
  }

  // Network connectivity check (M2)
  try {
    const https = require("https");
    const http = require("http");
    bundle.network = { nomokit: false, pypi: false };
    // Check nomo-kit.com
    try {
      await new Promise((resolve) => {
        const req = https.get(
          "https://nomo-kit.com/api/ping",
          { timeout: 5000 },
          (res) => {
            bundle.network.nomokit = res.statusCode === 200;
            resolve();
          },
        );
        req.on("error", () => {
          bundle.network.nomokit = false;
          resolve();
        });
        req.on("timeout", () => {
          req.destroy();
          bundle.network.nomokit = false;
          resolve();
        });
      });
    } catch (_) {}
    // Check pypi.org
    try {
      await new Promise((resolve) => {
        const req = https.get("https://pypi.org", { timeout: 5000 }, (res) => {
          bundle.network.pypi = res.statusCode === 200;
          resolve();
        });
        req.on("error", () => {
          bundle.network.pypi = false;
          resolve();
        });
        req.on("timeout", () => {
          req.destroy();
          bundle.network.pypi = false;
          resolve();
        });
      });
    } catch (_) {}
  } catch (_) {
    bundle.network = {
      nomokit: false,
      pypi: false,
      error: "Network check unavailable",
    };
  }

  // IPC handler verification (M5) — list of expected handlers
  const expectedHandlers = [
    "file-storage-save",
    "file-storage-read",
    "file-storage-list",
    "file-storage-delete",
    "file-storage-get-default-dir",
    "getUserData",
    "get-python-candidates",
    "nomopro-python-run",
    "nomopro-python-stop",
    "nomopro-python-write-stdin",
    "micropython-flash",
    "micropython-upload",
    "micropython-detect",
    "pip-install",
    "pip-uninstall",
    "pip-list",
    "pip-show",
    "pip-cache-info",
    "pip-cache-clear",
    "pip-run-in-venv",
    "pip-ensure-venv",
    "pip-reset-python-cache",
    "project-deps-generate",
    "project-deps-install",
    "project-deps-export",
    "project-deps-import",
    "project-deps-diff",
    "project-deps-list-profiles",
    "project-deps-delete-profile",
    "safe-install-classify",
    "safe-install-preflight",
    "safe-install-warning",
    "safe-install-allowlist",
    "diagnostic-collect",
    "diagnostic-generate-report",
    "diagnostic-save-report",
    "offline-cache-info",
    "offline-cache-install",
    "offline-cache-clear",
    "offline-cache-remove",
    "recovery-verify-python",
    "recovery-restore-python",
    "recovery-create-backup",
    "recovery-verify-shortcuts",
  ];
  // IPC handler verification (M5) — scan source files for ipcMain.handle calls
  // Electron 42+ no longer exposes ipcMain._events, so we scan source code.
  let foundCount = 0;
  const missingList = [];
  try {
    const scanDirs = [path.join(appRoot, "main.js")];
    // Also scan src/main/ directory
    const mainSrcDir = path.join(appRoot, "src", "main");
    if (fs.existsSync(mainSrcDir)) {
      const files = fs
        .readdirSync(mainSrcDir)
        .filter((f) => f.endsWith(".js"))
        .map((f) => path.join(mainSrcDir, f));
      scanDirs.push(...files);
    }
    const registeredHandlers = new Set();
    const handleRegex = /ipcMain\.handle\(["']([\w-]+)["']/g;
    for (const filePath of scanDirs) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      let m;
      while ((m = handleRegex.exec(content)) !== null) {
        registeredHandlers.add(m[1]);
      }
    }
    for (const expected of expectedHandlers) {
      if (registeredHandlers.has(expected)) {
        foundCount++;
      } else {
        missingList.push(expected);
      }
    }
  } catch (e) {
    bundle.ipcHandlers = {
      expected: expectedHandlers.length,
      verificationNote: e.message,
    };
  }
  bundle.ipcHandlers = {
    expected: expectedHandlers.length,
    found: foundCount,
    missing: missingList,
  };

  // Environment variables (sanitized)
  const safeEnvVars = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "SYSTEMROOT",
    "TMP",
    "TEMP",
    "PYTHONUNBUFFERED",
  ];
  bundle.environment = {};
  for (const v of safeEnvVars) {
    bundle.environment[v] = process.env[v] || "(not set)";
  }

  // Pip error history — record of failed install/uninstall for diagnostic
  try {
    const { getPipErrorHistory } = require("./pip-manager");
    bundle.pipErrors = getPipErrorHistory();
  } catch (e) {
    bundle.pipErrors = [];
  }

  // Read runner log if exists — include last 50 lines of content (M3)
  const logDir = path.join(appRoot, "logs");
  if (fs.existsSync(logDir)) {
    try {
      const logFiles = fs
        .readdirSync(logDir)
        .filter((f) => f.endsWith(".log"))
        .slice(-3);
      bundle.runnerLogs = logFiles.map((f) => {
        const fullPath = path.join(logDir, f);
        const stat = fs.statSync(fullPath);
        let content = "";
        try {
          const raw = fs.readFileSync(fullPath, "utf8");
          const lines = raw.split("\n").filter(Boolean);
          content = lines.slice(-50).join("\n");
        } catch (_) {}
        return {
          name: f,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          lastLines: content,
        };
      });
    } catch (e) {
      bundle.runnerLogsError = e.message;
    }
  }

  return { success: true, bundle };
};

/**
 * Generate a diagnostic report as text
 */
const generateReport = async (event, { appRoot }) => {
  const result = await collectDiagnostics(event, { appRoot });
  if (!result.success) return result;

  const { bundle } = result;

  let report = `============================================\n`;
  report += `  Nomokit-Desktop Diagnostic Report\n`;
  report += `  Generated: ${bundle.timestamp}\n`;
  report += `============================================\n\n`;

  report += `## System\n`;
  report += `  OS: ${bundle.platform.os}\n`;
  report += `  Arch: ${bundle.platform.arch}\n`;
  report += `  Host: ${bundle.platform.hostname}\n`;
  report += `  CPU Cores: ${bundle.platform.cpus}\n`;
  report += `  RAM: ${bundle.platform.memory}\n`;
  report += `  Free RAM: ${bundle.platform.freeMemory}\n\n`;

  report += `## App\n`;
  report += `  Version: ${bundle.app.version}\n`;
  report += `  Node: ${bundle.app.nodeVersion}\n`;
  report += `  Electron: ${bundle.app.electronVersion}\n`;
  report += `  Chrome: ${bundle.app.chromeVersion}\n\n`;

  report += `## Python (System)\n`;
  report += `  Found: ${bundle.python.found}\n`;
  report += `  Version: ${bundle.python.version}\n`;
  report += `  Bundled payload exists: ${bundle.python.bundledExists}\n`;
  if (bundle.python.bundledExists) {
    report += `  Bundled python.exe: ${bundle.python.bundledPythonExe}\n`;
  }
  report += `\n`;

  report += `## Virtualenv\n`;
  report += `  Exists: ${bundle.venv.exists}\n`;
  if (bundle.venv.exists) {
    report += `  Path: ${bundle.venv.path}\n`;
    report += `  Python: ${bundle.venv.pythonExists}\n`;
    report += `  Pip: ${bundle.venv.pipExists}\n`;
    report += `  Package Count: ${bundle.venv.packageCount || 0}\n`;
    report += `  Size: ${bundle.venv.sizeMB || 0} MB\n`;
    if (bundle.venv.packages && bundle.venv.packages.length > 0) {
      report += `  Packages:\n`;
      for (const pkg of bundle.venv.packages.slice(0, 50)) {
        report += `    - ${pkg}\n`;
      }
      if (bundle.venv.packages.length > 50) {
        report += `    ... (${bundle.venv.packages.length - 50} more)\n`;
      }
    }
  }
  report += `\n`;

  report += `## File Storage\n`;
  report += `  Default Dir: ${bundle.fileStorage.defaultDir || "N/A"}\n`;
  report += `  Dir Exists: ${bundle.fileStorage.exists}\n`;
  if (bundle.fileStorage.exists) {
    report += `  File Count: ${bundle.fileStorage.fileCount || 0}\n`;
  }
  report += `\n`;

  report += `## Environment (sanitized)\n`;
  if (bundle.environment) {
    for (const [key, val] of Object.entries(bundle.environment)) {
      report += `  ${key}=${val}\n`;
    }
  }
  report += `\n`;

  report += `## Project Deps\n`;
  report += `  Directory exists: ${bundle.projectDepsExist}\n`;
  if (bundle.projectDepsExist && bundle.projectDepsProfiles) {
    report += `  Profiles: ${bundle.projectDepsProfiles.join(", ") || "(none)"}\n`;
  }
  report += `\n`;

  report += `## Diagnostics Logs\n`;
  if (bundle.runnerLogs && bundle.runnerLogs.length > 0) {
    for (const log of bundle.runnerLogs) {
      report += `  ${log.name} (${log.size} bytes, ${log.modifiedAt})\n`;
    }
  } else {
    report += `  (none)\n`;
  }
  report += `\n`;
  report += `============================================\n`;
  report += `  End of Report\n`;
  report += `============================================\n`;

  return { success: true, report, bundle };
};

/**
 * Generate diagnostic report as JSON (M6)
 */
const generateJsonReport = async (event, { appRoot }) => {
  const result = await collectDiagnostics(event, { appRoot });
  if (!result.success) return result;
  return {
    success: true,
    jsonReport: JSON.stringify(result.bundle, null, 2),
    bundle: result.bundle,
  };
};

/**
 * Save diagnostic report to file — user picks path via save dialog
 */
const saveReport = async (event, { appRoot, format }) => {
  const fmt = format === "json" ? "json" : "txt";
  const result =
    fmt === "json"
      ? await generateJsonReport(event, { appRoot })
      : await generateReport(event, { appRoot });
  if (!result.success) return result;

  // Show native save dialog so user picks location
  const { dialog } = require("electron");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultName = `diagnostic-${timestamp}.${fmt}`;

  const dialogResult = await dialog.showSaveDialog({
    title: "Save Diagnostic Report",
    defaultPath: defaultName,
    filters: [{ name: fmt === "json" ? "JSON" : "Text", extensions: [fmt] }],
  });

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, canceled: true };
  }

  const content = fmt === "json" ? result.jsonReport : result.report;
  fs.writeFileSync(dialogResult.filePath, content, "utf8");

  logger.info(`Diagnostic report saved to ${dialogResult.filePath} (${fmt})`);
  return {
    success: true,
    path: dialogResult.filePath,
    format: fmt,
    report: content,
  };
};

const registerDiagnosticHandlers = ({ appRoot }) => {
  ipcMain.handle("diagnostic-collect", async (event) => {
    return collectDiagnostics(event, { appRoot });
  });

  ipcMain.handle("diagnostic-generate-report", async (event) => {
    return generateReport(event, { appRoot });
  });

  ipcMain.handle("diagnostic-generate-json", async (event) => {
    return generateJsonReport(event, { appRoot });
  });

  ipcMain.handle("diagnostic-save-report", async (event, opts) => {
    const { format } = opts || {};
    return saveReport(event, { appRoot, format });
  });

  logger.info("Diagnostic bundle IPC handlers registered");
};

module.exports = { registerDiagnosticHandlers };
