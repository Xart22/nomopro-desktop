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
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100} GB`,
      uptime: `${Math.round(os.uptime() / 3600)} hours`,
      userInfo: os.userInfo().username,
    },
    app: {
      name: "nomopro-desktop",
      version: "2.1.3",
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

  // Python version check
  const candidates = ["python3", "python", "py"];
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
    const pyPath = path.join(venvDir, isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python3");
    bundle.venv.pythonExists = fs.existsSync(pyPath);
    const pipPath = path.join(venvDir, isWin ? "Scripts" : "bin", isWin ? "pip.exe" : "pip3");
    bundle.venv.pipExists = fs.existsSync(pipPath);

    // Count installed packages
    if (bundle.venv.pipExists) {
      try {
        const listRes = spawnSync(pipPath, ["list", "--format=json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10000,
        });
        if (listRes.status === 0) {
          const pkgs = JSON.parse(listRes.stdout);
          bundle.venv.packageCount = pkgs.length;
          bundle.venv.packages = pkgs.map((p) => `${p.name}==${p.version}`);
        }
      } catch (e) {
        bundle.venv.listError = e.message;
      }
    }

    // Check venv size
    try {
      const { size } = walkDirSize(venvDir, { excludeDir: "__pycache__" });
      bundle.venv.sizeBytes = size;
      bundle.venv.sizeMB = Math.round(size / 1024 / 1024 * 100) / 100;
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
  if (docsDir) {
    const storageDir = path.join(docsDir, "OpenBlock");
    bundle.fileStorage.defaultDir = storageDir;
    bundle.fileStorage.exists = fs.existsSync(storageDir);
    if (bundle.fileStorage.exists) {
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
  }

  // Check bundled python payload
  const pythonDir = path.join(appRoot, "python");
  bundle.python.bundledExists = fs.existsSync(pythonDir);
  if (bundle.python.bundledExists) {
    try {
      const entries = fs.readdirSync(pythonDir);
      bundle.python.bundledFiles = entries;
      const pexe = path.join(pythonDir, "python.exe");
      bundle.python.bundledPythonExe = fs.existsSync(pexe);
    } catch (e) {
      bundle.python.bundledError = e.message;
    }
  }

  // Check project deps profiles
  const depsDir = path.join(appRoot, "data", "project-deps");
  bundle.projectDepsExist = fs.existsSync(depsDir);
  if (bundle.projectDepsExist) {
    try {
      bundle.projectDepsProfiles = fs.readdirSync(depsDir).filter((f) => f.endsWith("-requirements.txt"));
    } catch (e) {
      bundle.projectDepsError = e.message;
    }
  }

  // Environment variables (sanitized)
  const safeEnvVars = ["PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "TMP", "TEMP", "PYTHONUNBUFFERED"];
  bundle.environment = {};
  for (const v of safeEnvVars) {
    bundle.environment[v] = process.env[v] || "(not set)";
  }

  // Read runner log if exists
  const logDir = path.join(appRoot, "logs");
  if (fs.existsSync(logDir)) {
    try {
      const logFiles = fs.readdirSync(logDir)
        .filter((f) => f.endsWith(".log"))
        .slice(-3); // Last 3 log files
      bundle.runnerLogs = logFiles.map((f) => {
        const fullPath = path.join(logDir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
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
  report += `  Nomopro-Desktop Diagnostic Report\n`;
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
 * Save diagnostic report to file
 */
const saveReport = async (event, { appRoot }) => {
  const result = await generateReport(event, { appRoot });
  if (!result.success) return result;

  const reportDir = path.join(appRoot, "data", "diagnostics");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `diagnostic-${timestamp}.txt`);
  fs.writeFileSync(reportPath, result.report, "utf8");

  logger.info(`Diagnostic report saved to ${reportPath}`);
  return { success: true, path: reportPath, report: result.report };
};

const registerDiagnosticHandlers = ({ appRoot }) => {
  ipcMain.handle("diagnostic-collect", async (event) => {
    return collectDiagnostics(event, { appRoot });
  });

  ipcMain.handle("diagnostic-generate-report", async (event) => {
    return generateReport(event, { appRoot });
  });

  ipcMain.handle("diagnostic-save-report", async (event) => {
    return saveReport(event, { appRoot });
  });

  logger.info("Diagnostic bundle IPC handlers registered");
};

module.exports = { registerDiagnosticHandlers };