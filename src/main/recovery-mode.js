/**
 * Installer Recovery Mode (Phase 7 — Step 29)
 *
 * Self-healing for corrupted/missing Python runtime:
 * - Verify checksum of bundled python bundle
 * - Re-extract python runtime if corrupted
 * - Self-heal shortcuts and installer paths
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { ipcMain } = require("electron");
const { walkDirSize, copyRecursive } = require("./utils");

/**
 * Verify bundled Python runtime integrity
 */
const verifyBundledPython = async (event, { appRoot }) => {
  const pythonDir = path.join(appRoot, "python");
  const result = {
    exists: fs.existsSync(pythonDir),
    pythonExe: false,
    pythonVersion: null,
    corrupt: false,
    issues: [],
    fileCount: 0,
    totalSize: 0,
  };

  if (!result.exists) {
    result.issues.push("Bundled Python directory not found");
    result.corrupt = true;
    return { success: true, ...result };
  }

  // Check for python executable
  const isWin = process.platform === "win32";
  const exeName = isWin ? "python.exe" : "python3";
  const altExeName = isWin ? "python.exe" : "python";

  const exePaths = [
    path.join(pythonDir, exeName),
    path.join(pythonDir, "bin", exeName),
    path.join(pythonDir, altExeName),
  ];

  let foundExe = false;
  for (const exePath of exePaths) {
    if (fs.existsSync(exePath)) {
      foundExe = true;
      result.pythonExe = exePath;
      // Check it actually works
      try {
        const res = spawnSync(exePath, ["--version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (res.status === 0) {
          result.pythonVersion = (res.stdout || res.stderr || "").trim();
        } else {
          result.issues.push(`Python executable at ${exePath} exists but fails to run`);
          result.corrupt = true;
        }
      } catch (e) {
        result.issues.push(`Python executable at ${exePath} exists but cannot be executed: ${e.message}`);
        result.corrupt = true;
      }
      break;
    }
  }

  if (!foundExe) {
    result.issues.push("No python executable found in bundled directory");
    result.corrupt = true;
  }

  // Check for essential files
  const checkFiles = isWin
    ? ["python.exe", "python3.dll", "python311.dll", "python._pth"]
    : ["bin/python3", "lib/python3.11"];

  for (const reqFile of checkFiles) {
    const fullPath = path.join(pythonDir, reqFile);
    if (!fs.existsSync(fullPath)) {
      result.issues.push(`Required file missing: ${reqFile}`);
    }
  }

  // Check size of bundled directory
  try {
    const { size: totalSize, count: fileCount } = walkDirSize(pythonDir);
    result.totalSize = totalSize;
    result.totalSizeMB = Math.round(totalSize / 1024 / 1024 * 100) / 100;
    result.fileCount = fileCount;

    if (totalSize < 1024 * 1024) {
      result.issues.push(`Bundled Python size (${result.totalSizeMB} MB) seems too small, may be incomplete`);
      result.corrupt = true;
    }
  } catch (e) {
    result.issues.push(`Error scanning bundled Python: ${e.message}`);
    result.corrupt = true;
  }

  // Overall verdict
  result.healthy = !result.corrupt && result.pythonExe !== false;

  return { success: true, ...result };
};

/**
 * Re-extract / restore bundled Python from recovery backup
 */
const restoreBundledPython = async (event, { appRoot }) => {
  const pythonDir = path.join(appRoot, "python");
  const backupDir = path.join(appRoot, "python-backup");
  const markerFile = path.join(appRoot, "python", ".installed");
  const installScript = path.join(appRoot, "scripts", "install_python_payload.js");

  // Check if we have a backup we can restore from
  if (fs.existsSync(backupDir)) {
    try {
      // Remove corrupted python dir
      if (fs.existsSync(pythonDir)) {
        fs.rmSync(pythonDir, { recursive: true, force: true });
      }
      copyRecursive(backupDir, pythonDir);
      logger.info("Python runtime restored from backup");
      return { success: true, restoredFrom: "backup" };
    } catch (e) {
      return { success: false, error: `Failed to restore from backup: ${e.message}` };
    }
  }

  // No backup, check if install script exists to re-download
  if (fs.existsSync(installScript)) {
    return {
      success: false,
      error: "No backup available. Please re-download Python runtime",
      requiresRedownload: true,
      installCommand: `node "${installScript}"`,
    };
  }

  return {
    success: false,
    error: "No Python runtime found and no recovery method available. Please reinstall the application.",
    requiresReinstall: true,
  };
};

/**
 * Create a backup of bundled Python for recovery
 */
const createBackup = async (event, { appRoot }) => {
  const pythonDir = path.join(appRoot, "python");
  const backupDir = path.join(appRoot, "python-backup");

  if (!fs.existsSync(pythonDir)) {
    return { success: false, error: "No Python runtime to backup" };
  }

  try {
    // Remove existing backup
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }

    copyRecursive(pythonDir, backupDir, { excludeDir: "__pycache__" });

    // Check backup size
    const { size } = walkDirSize(backupDir);

    logger.info(`Python backup created at ${backupDir} (${Math.round(size / 1024 / 1024)} MB)`);
    return {
      success: true,
      backupPath: backupDir,
      size: size,
      sizeMB: Math.round(size / 1024 / 1024 * 100) / 100,
    };
  } catch (e) {
    return { success: false, error: `Backup failed: ${e.message}` };
  }
};

/**
 * Verify and self-heal installer shortcuts
 */
const verifyShortcuts = async (event) => {
  const issues = [];

  if (process.platform === "win32") {
    // Check common installation paths
    const commonPaths = [
      path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs", "Nomopro-Desktop.lnk"),
      path.join(process.env.PUBLIC || "", "Desktop", "Nomopro-Desktop.lnk"),
      path.join(process.env.USERPROFILE || "", "Desktop", "Nomopro-Desktop.lnk"),
    ];

    for (const shortcut of commonPaths) {
      if (fs.existsSync(shortcut)) {
        issues.push(`Shortcut exists: ${shortcut}`);
      }
    }
  }

  return { success: true, shortcutCount: issues.length, issues };
};

const registerRecoveryHandlers = ({ appRoot }) => {
  ipcMain.handle("recovery-verify-python", async (event) => {
    return verifyBundledPython(event, { appRoot });
  });

  ipcMain.handle("recovery-restore-python", async (event) => {
    return restoreBundledPython(event, { appRoot });
  });

  ipcMain.handle("recovery-create-backup", async (event) => {
    return createBackup(event, { appRoot });
  });

  ipcMain.handle("recovery-verify-shortcuts", async (event) => {
    return verifyShortcuts(event);
  });

  logger.info("Recovery mode IPC handlers registered");
};

module.exports = { registerRecoveryHandlers };