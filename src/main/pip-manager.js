/**
 * Pip Package Manager for nomopro-desktop
 *
 * Manages per-user virtualenv:
 * - Bootstrap venv di lokasi user data
 * - IPC untuk install/list/uninstall package
 * - Lock concurrency instalasi
 * - Wheel cache untuk reinstall cepat
 * - Support progress streaming ke renderer
 */

const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { ipcMain } = require("electron");
const { walkDirSize } = require("./utils");

let bundledPythonDirRef = null;
let systemPythonCache = null;

// Lock for pip operations (prevents concurrent install/uninstall)
let pipLock = false;
let pipLockQueue = [];

const withPipLock = async (fn) => {
  if (pipLock) {
    return new Promise((resolve) => {
      pipLockQueue.push(() => {
        resolve(fn());
      });
    });
  }
  pipLock = true;
  try {
    return await fn();
  } finally {
    pipLock = false;
    if (pipLockQueue.length > 0) {
      const next = pipLockQueue.shift();
      next();
    }
  }
};

/**
 * Get the user data directory for virtualenv
 */
const getUserDataDir = (appRoot) => {
  const userDataPath = path.join(appRoot, "data", "python-env");
  return userDataPath;
};

/**
 * Get the path to the virtualenv python/ pip executables
 */
const getVenvPaths = (appRoot) => {
  const venvDir = getUserDataDir(appRoot);
  const isWin = process.platform === "win32";
  return {
    venvDir,
    python: path.join(venvDir, isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python3"),
    pip: path.join(venvDir, isWin ? "Scripts" : "bin", isWin ? "pip.exe" : "pip3"),
    activateScript: path.join(venvDir, isWin ? "Scripts\\activate" : "bin/activate"),
  };
};

/**
 * Find a compatible Python (>= 3.8) for creating venv.
 * Checks bundled Python first, then falls back to system PATH.
 * @param {string} [appRoot] - app root path to resolve bundled python
 * @returns {string|null} full path or command name, null if none found
 */
const findSystemPython = (appRoot) => {
  if (systemPythonCache) return systemPythonCache;
  // 1) Check bundledPythonDirRef first (correct path when packaged)
  if (bundledPythonDirRef) {
    const bundled = process.platform === "win32"
      ? path.join(bundledPythonDirRef, "python.exe")
      : path.join(bundledPythonDirRef, "bin", "python3");
    if (fs.existsSync(bundled)) {
      try {
        const res = spawnSync(bundled, ["--version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (res.status === 0) {
          const ver = (res.stdout || res.stderr || "").trim();
          const match = ver.match(/(\d+)\.(\d+)/);
          if (match && parseInt(match[1], 10) >= 3 && parseInt(match[2], 10) >= 8) {
            logger.info(`Using bundled Python: ${bundled} -> ${ver}`);
            systemPythonCache = bundled;
            return bundled;
          }
        }
      } catch (e) {
        logger.warn(`Bundled Python check failed: ${e.message}`);
      }
    }
  }

  // 2) Check appRoot/python (dev mode)
  if (appRoot) {
    const pythonDir = path.join(appRoot, "python");
    if (fs.existsSync(pythonDir)) {
      const bundled = process.platform === "win32"
        ? path.join(pythonDir, "python.exe")
        : path.join(pythonDir, "bin", "python3");
      if (fs.existsSync(bundled)) {
        try {
          const res = spawnSync(bundled, ["--version"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          });
          if (res.status === 0) {
            const ver = (res.stdout || res.stderr || "").trim();
            const match = ver.match(/(\d+)\.(\d+)/);
            if (match && parseInt(match[1], 10) >= 3 && parseInt(match[2], 10) >= 8) {
              logger.info(`Using bundled Python: ${bundled} -> ${ver}`);
              systemPythonCache = bundled;
              return bundled;
            }
          }
        } catch (e) {
          logger.warn(`Bundled Python check failed: ${e.message}`);
        }
      }
    }
  }

  // Fallback to system PATH
  const candidates = ["python3", "python", "py"];
  for (const c of candidates) {
    try {
      const args = c === "py" ? ["-3", "--version"] : ["--version"];
      const res = spawnSync(c, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (res.status === 0) {
        const ver = (res.stdout || res.stderr || "").trim();
        const match = ver.match(/(\d+)\.(\d+)/);
        if (match && parseInt(match[1], 10) >= 3 && parseInt(match[2], 10) >= 8) {
          logger.info(`Using system Python: ${c} -> ${ver}`);
          systemPythonCache = c;
          return c;
        }
      }
    } catch (e) {
      // continue
    }
  }
  systemPythonCache = null;
  return null;
};

/**
 * Download a file synchronously using powershell (Windows) or curl (macOS).
 */
const downloadFileSync = (url, dest) => {
  const isWin = process.platform === "win32";
  const result = isWin
    ? spawnSync(
        "powershell",
        ["-NoProfile", "-Command", `Invoke-WebRequest -Uri "${url}" -OutFile "${dest}"`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 }
      )
    : spawnSync("curl", ["-fsSL", url, "-o", dest], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60000,
      });
  return result.status === 0;
};

/**
 * Ensure bundled Python has venv/virtualenv available.
 * Embeddable Python omits ensurepip/venv — bootstrap via get-pip.py + virtualenv.
 */
const ensureBundledPythonReady = (pythonExe) => {
  // Quick check: does venv already work?
  const check = spawnSync(pythonExe, ["-m", "venv", "--help"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (check.status === 0) return true;

  logger.info("venv not available in bundled Python, bootstrapping...");

  // 1) Enable import site via _pth → .pth rename
  const pthDir = path.dirname(pythonExe);
  let pthFiles;
  try {
    pthFiles = fs.readdirSync(pthDir).filter((f) => /^python\d+(\._pth|\.pth)$/.test(f));
  } catch (e) {
    logger.warn(`Cannot read python dir ${pthDir}: ${e.message}`);
    return false;
  }

  if (pthFiles.length === 0) {
    logger.warn("No ._pth or .pth file found — cannot enable site module");
    return false;
  }

  const pthFile = pthFiles[0];
  const pthPath = path.join(pthDir, pthFile);

  // Read current content and check if import site is already enabled
  let pthContent;
  try {
    pthContent = fs.readFileSync(pthPath, "utf8");
  } catch (e) {
    logger.warn(`Failed to read ${pthFile}: ${e.message}`);
    return false;
  }

  const hasImportSite = pthContent.split("\n").some((line) => /^\s*import\s+site\s*$/.test(line));
  if (!hasImportSite) {
    const modified =
      pthContent
        .split("\n")
        .filter((line) => !line.trim().startsWith("#import site"))
        .join("\n") + "\nimport site\n";

    if (pthFile.endsWith("._pth")) {
      // Rename _pth → .pth AND enable import site
      const newPth = path.join(pthDir, pthFile.replace("._pth", ".pth"));
      try {
        fs.writeFileSync(newPth, modified, "utf8");
        fs.unlinkSync(pthPath);
        logger.info(`Enabled import site (renamed to ${path.basename(newPth)})`);
      } catch (e) {
        logger.warn(`Failed to rename ._pth file: ${e.message}`);
        return false;
      }
    } else {
      // Already .pth, just write the modified content back
      try {
        fs.writeFileSync(pthPath, modified, "utf8");
        logger.info(`Enabled import site in ${pthFile}`);
      } catch (e) {
        logger.warn(`Failed to update ${pthFile}: ${e.message}`);
        return false;
      }
    }
  } else {
    logger.info(`import site already enabled in ${pthFile}`);
  }

  // 2) Try ensurepip (works in some embeddable builds with .pth renamed)
  logger.info("Trying ensurepip...");
  const ensure = spawnSync(pythonExe, ["-m", "ensurepip", "--upgrade", "--default-pip"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });
  if (ensure.status === 0) {
    logger.info("ensurepip succeeded");
  } else {
    // 3) Fallback: download get-pip.py and run it
    logger.info("ensurepip not available, downloading get-pip.py...");
    const getPipPath = path.join(path.dirname(pythonExe), "get-pip.py");
    if (!downloadFileSync("https://bootstrap.pypa.io/get-pip.py", getPipPath)) {
      logger.warn("Failed to download get-pip.py (no internet?)");
      return false;
    }
    const gpResult = spawnSync(pythonExe, [getPipPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    try {
      fs.unlinkSync(getPipPath);
    } catch (_) {}
    if (gpResult.status !== 0) {
      const msg = (gpResult.stderr || gpResult.stdout || "unknown").trim();
      logger.warn(`get-pip.py failed: ${msg}`);
      return false;
    }
    logger.info("pip installed via get-pip.py");
  }

  // 4) Install virtualenv package via pip
  logger.info("Installing virtualenv package...");
  const installVenv = spawnSync(pythonExe, ["-m", "pip", "install", "virtualenv", "--quiet"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000,
  });
  if (installVenv.status !== 0) {
    const msg = (installVenv.stderr || installVenv.stdout || "unknown").trim();
    logger.warn(`pip install virtualenv failed: ${msg}`);
    return false;
  }

  logger.info("Bundled Python is ready (virtualenv installed)");
  return true;
};

/**
 * Initialize/ensure virtualenv exists
 */
const ensureVirtualEnv = (appRoot) => {
  const venvPaths = getVenvPaths(appRoot);

  // Check if venv already exists and has a working python
  if (fs.existsSync(venvPaths.python)) {
    try {
      const res = spawnSync(venvPaths.python, ["--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (res.status === 0) {
        logger.info(`Virtualenv python OK: ${venvPaths.python}`);
        return { success: true, venvPaths, alreadyExists: true };
      }
    } catch (e) {
      // corrupted venv, will recreate
      logger.warn("Virtualenv appears corrupted, recreating...");
    }
  }

  // Create venv
  const systemPython = findSystemPython(appRoot);
  if (!systemPython) {
    return { success: false, error: "No compatible Python (>= 3.8) found on system" };
  }

  logger.info(`Creating virtualenv at ${venvPaths.venvDir} using ${systemPython}...`);

  // If using bundled Python, ensure venv/virtualenv is available
  const isBundled = bundledPythonDirRef && systemPython.startsWith(bundledPythonDirRef);
  if (isBundled) {
    const ready = ensureBundledPythonReady(systemPython);
    if (!ready) {
      return {
        success: false,
        error:
          "Bundled Python missing venv/virtualenv. " +
          "Please install Python (>= 3.8) on your system or reinstall this application.",
      };
    }
  }

  // Remove broken venv if exists
  if (fs.existsSync(venvPaths.venvDir)) {
    try {
      fs.rmSync(venvPaths.venvDir, { recursive: true, force: true });
    } catch (e) {
      logger.warn(`Could not remove old venv: ${e.message}`);
    }
  }

  // Try python -m venv first, fallback to python -m virtualenv
  let result = spawnSync(systemPython, ["-m", "venv", venvPaths.venvDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
  });

  if (result.status !== 0 && isBundled) {
    logger.info("venv failed, trying virtualenv package...");
    result = spawnSync(systemPython, ["-m", "virtualenv", venvPaths.venvDir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    });
  }

  if (result.status !== 0) {
    const errMsg = (result.stderr || result.stdout || "unknown error").trim();
    logger.error(`Failed to create virtualenv: ${errMsg}`);
    return { success: false, error: `Failed to create virtualenv: ${errMsg}` };
  }

  // Upgrade pip in venv
  logger.info("Upgrading pip in virtualenv...");
  const pipResult = spawnSync(venvPaths.pip, [
    "install", "--upgrade", "pip", "--quiet"
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });
  if (pipResult.status !== 0) {
    logger.warn(`Pip upgrade warning: ${pipResult.stderr || pipResult.stdout}`);
  }

  // Ensure setuptools and wheel are available
  spawnSync(venvPaths.pip, [
    "install", "--upgrade", "setuptools", "wheel", "--quiet"
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });

  logger.info(`Virtualenv created successfully at ${venvPaths.venvDir}`);
  return { success: true, venvPaths, alreadyExists: false };
};

/**
 * Stream progress to renderer
 */
const sendProgress = (event, data) => {
  try {
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send("pip-operation-progress", data);
    }
  } catch (e) {
    logger.warn(`sendProgress error: ${e.message}`);
  }
};

const validatePackageName = (name) => {
  if (!name || typeof name !== "string") return "Package name is required";
  // Block pip flags/options being passed as package names
  if (name.startsWith("-") || name.startsWith("--")) return "Package name cannot start with '-'";
  // Only allow valid PyPI package name characters plus / @ for URL/VCS installs
  if (/[<>|;&$`\\]/.test(name)) return "Package name contains invalid characters";
  return null;
};

/**
 * Install a package via pip in the virtualenv
 */
const installPackage = async (event, { appRoot, packageName, upgrade = false, pre = false }) => {
  const validationError = validatePackageName(packageName);
  if (validationError) {
    return { success: false, error: validationError };
  }
  return withPipLock(async () => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) {
      return venvResult;
    }

    sendProgress(event, { type: "install-start", package: packageName });

    const args = ["install"];
    if (upgrade) args.push("--upgrade");
    if (pre) args.push("--pre");
    args.push(packageName);

    const proc = spawn(venvResult.venvPaths.pip, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      const text = String(chunk || "");
      stdout += text;
      sendProgress(event, { type: "install-output", data: text });
    });
    proc.stdout.on("error", (err) => logger.warn(`pip stdout error: ${err.message}`));

    proc.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr += text;
      sendProgress(event, { type: "install-output", data: text });
    });
    proc.stderr.on("error", (err) => logger.warn(`pip stderr error: ${err.message}`));

    return await new Promise((resolve) => {
      proc.on("close", (code) => {
        const success = code === 0;
        sendProgress(event, {
          type: success ? "install-done" : "install-error",
          exitCode: code,
          package: packageName,
        });
        resolve({ success, exitCode: code, stdout, stderr, package: packageName });
      });

      proc.on("error", (err) => {
        sendProgress(event, { type: "install-error", error: err.message });
        resolve({ success: false, error: err.message });
      });
    });
  });
};

/**
 * Uninstall a package from virtualenv
 */
const uninstallPackage = async (event, { appRoot, packageName }) => {
  const validationError = validatePackageName(packageName);
  if (validationError) {
    return { success: false, error: validationError };
  }
  return withPipLock(async () => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) {
      return venvResult;
    }

    sendProgress(event, { type: "uninstall-start", package: packageName });

    const result = spawnSync(venvResult.venvPaths.pip, [
      "uninstall", "-y", packageName
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    });

    const success = result.status === 0;
    sendProgress(event, {
      type: success ? "uninstall-done" : "uninstall-error",
      package: packageName,
      exitCode: result.status,
    });

    return {
      success,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      package: packageName,
    };
  });
};

/**
 * List installed packages in virtualenv
 */
const listPackages = async (event, { appRoot }) => {
  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  const result = spawnSync(venvResult.venvPaths.pip, ["list", "--format=json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
  });

  if (result.status !== 0) {
    return { success: false, error: (result.stderr || result.stdout || "pip list failed").trim() };
  }

  try {
    const packages = JSON.parse(result.stdout);
    return { success: true, packages, count: packages.length };
  } catch (e) {
    return { success: false, error: `Failed to parse pip list output: ${e.message}` };
  }
};

/**
 * Check details of a specific package
 */
const showPackage = async (event, { appRoot, packageName }) => {
  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  const result = spawnSync(venvResult.venvPaths.pip, ["show", packageName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
  });

  if (result.status !== 0) {
    return { success: false, error: `Package '${packageName}' not found`, notFound: true };
  }

  return { success: true, info: result.stdout.trim() };
};

/**
 * Get wheel cache status
 */
const getWheelCacheInfo = async (event, { appRoot }) => {
  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  const result = spawnSync(venvResult.venvPaths.python, [
    "-c",
    "import pip._internal.locations as loc; print(loc.USER_CACHE_DIR)"
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
  });

  let cacheDir = "";
  if (result.status === 0) {
    cacheDir = result.stdout.trim();
  }

  let cacheSize = 0;
  let cacheCount = 0;
  if (cacheDir && fs.existsSync(cacheDir)) {
    try {
      const entries = fs.readdirSync(cacheDir, { recursive: true });
      cacheCount = entries.filter((e) => fs.statSync(path.join(cacheDir, e)).isFile()).length;
      cacheSize = walkDirSize(cacheDir).size;
    } catch (e) {
      // ignore
    }
  }

  return { success: true, cacheDir, cacheSize, cacheCount, venvDir: getVenvPaths(appRoot).venvDir };
};

/**
 * Clear wheel cache
 */
const clearWheelCache = async (event, { appRoot }) => {
  const info = await getWheelCacheInfo(event, { appRoot });
  if (!info.success) return info;

  if (info.cacheDir && fs.existsSync(info.cacheDir)) {
    try {
      fs.rmSync(info.cacheDir, { recursive: true, force: true });
      return { success: true, cleared: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return { success: true, cleared: false, reason: "no-cache-dir" };
};

/**
 * Execute a Python script using the virtualenv python (with all installed packages available)
 */
const runInVenv = async (event, { appRoot, code }) => {
  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) {
    return venvResult;
  }

  return new Promise((resolve) => {
    const proc = spawn(venvResult.venvPaths.python, ["-u", "-c", code], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    proc.stdout.on("error", (err) => logger.warn(`runInVenv stdout error: ${err.message}`));

    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    proc.stderr.on("error", (err) => logger.warn(`runInVenv stderr error: ${err.message}`));

    proc.on("close", (code) => {
      resolve({ success: code === 0, exitCode: code, stdout, stderr });
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
};

/**
 * Register all pip IPC handlers
 */
const registerPipHandlers = ({ appRoot, win, bundledPythonDir }) => {
  bundledPythonDirRef = bundledPythonDir || null;

  ipcMain.handle("pip-install", async (event, { packageName, upgrade, pre }) => {
    return installPackage(event, { appRoot, packageName, upgrade, pre });
  });

  ipcMain.handle("pip-uninstall", async (event, { packageName }) => {
    return uninstallPackage(event, { appRoot, packageName });
  });

  ipcMain.handle("pip-list", async (event) => {
    return listPackages(event, { appRoot });
  });

  ipcMain.handle("pip-show", async (event, { packageName }) => {
    return showPackage(event, { appRoot, packageName });
  });

  ipcMain.handle("pip-cache-info", async (event) => {
    return getWheelCacheInfo(event, { appRoot });
  });

  ipcMain.handle("pip-cache-clear", async (event) => {
    return clearWheelCache(event, { appRoot });
  });

  ipcMain.handle("pip-run-in-venv", async (event, { code }) => {
    return runInVenv(event, { appRoot, code });
  });

  ipcMain.handle("pip-ensure-venv", async () => {
    const result = ensureVirtualEnv(appRoot);
    return result;
  });

  logger.info("Pip IPC handlers registered");
};

module.exports = { registerPipHandlers, ensureVirtualEnv, getVenvPaths };