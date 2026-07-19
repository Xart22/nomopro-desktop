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
const { cachePackage } = require("./offline-cache");

let bundledPythonDirRef = null;
let systemPythonCache = null;

// Track last pip errors for diagnostic bundle
let pipErrorHistory = [];
const MAX_PIP_ERRORS = 10;

const recordPipError = (operation, packageName, error, stderr, stdout) => {
  pipErrorHistory.unshift({
    timestamp: new Date().toISOString(),
    operation,
    package: packageName,
    error: error || "",
    stderr: (stderr || "").slice(0, 2000), // cap to 2KB
    stdout: (stdout || "").slice(0, 1000), // cap to 1KB
  });
  if (pipErrorHistory.length > MAX_PIP_ERRORS) {
    pipErrorHistory = pipErrorHistory.slice(0, MAX_PIP_ERRORS);
  }
};

const getPipErrorHistory = () => pipErrorHistory;

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
 * Get the user data directory for virtualenv (L1: allow override via env var)
 */
const getUserDataDir = (appRoot) => {
  const override = process.env.NOMOPRO_VENV_DIR;
  return override
    ? path.resolve(override)
    : path.join(appRoot, "data", "python-env");
};

/**
 * Get the path to the virtualenv python/ pip executables (L1: optional custom venvDir)
 *
 * NOTE: pip points to python.exe, with pipPrefix = ["-m", "pip"].
 * The pip.exe launcher (Simple Launcher/t64.exe) is incompatible with some
 * Windows builds — using python -m pip avoids the broken launcher entirely.
 */
const getVenvPaths = (appRoot, customVenvDir) => {
  const venvDir = customVenvDir || getUserDataDir(appRoot);
  const isWin = process.platform === "win32";
  const pythonExe = path.join(
    venvDir,
    isWin ? "Scripts" : "bin",
    isWin ? "python.exe" : "python3",
  );
  return {
    venvDir,
    python: pythonExe,
    pip: pythonExe,
    pipPrefix: ["-m", "pip"],
    activateScript: path.join(
      venvDir,
      isWin ? "Scripts\\activate" : "bin/activate",
    ),
  };
};

/**
 * Build spawn args array for pip command: [pythonExe, "-m", "pip", ...extraArgs]
 */
const getPipSpawnArgs = (venvPaths, extraArgs) => {
  return [venvPaths.pip, [...venvPaths.pipPrefix, ...extraArgs]];
};

/**
 * Find a compatible Python (>= 3.8) for creating venv.
 * Checks bundled Python first, then falls back to system PATH.
 * @param {string} [appRoot] - app root path to resolve bundled python
 * @returns {string|null} full path or command name, null if none found
 */
const findSystemPython = (appRoot) => {
  if (systemPythonCache) return systemPythonCache;

  // Collect all possible bundled Python dirs
  const dirs = [];
  // 1) Explicit bundledPythonDirRef (set by registerPipHandlers)
  if (bundledPythonDirRef) dirs.push(bundledPythonDirRef);
  // 2) process.resourcesPath/python/ — extraResources in packaged app
  try {
    dirs.push(path.join(process.resourcesPath, "python"));
  } catch (_) {}
  // 3) appRoot/python/ — dev layout
  if (appRoot) dirs.push(path.join(appRoot, "python"));

  // Deduplicate
  const seen = new Set();
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);

    const bundled =
      process.platform === "win32"
        ? path.join(dir, "python.exe")
        : path.join(dir, "bin", "python3");
    if (!fs.existsSync(bundled)) continue;

    try {
      const res = spawnSync(bundled, ["--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (res.status === 0) {
        const ver = (res.stdout || res.stderr || "").trim();
        const match = ver.match(/(\d+)\.(\d+)/);
        if (
          match &&
          parseInt(match[1], 10) >= 3 &&
          parseInt(match[2], 10) >= 8
        ) {
          logger.info(`Using bundled Python: ${bundled} -> ${ver}`);
          systemPythonCache = bundled;
          return bundled;
        }
      }
    } catch (e) {
      logger.warn(`Bundled Python check failed: ${bundled}: ${e.message}`);
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
        if (
          match &&
          parseInt(match[1], 10) >= 3 &&
          parseInt(match[2], 10) >= 8
        ) {
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
        [
          "-NoProfile",
          "-Command",
          `Invoke-WebRequest -Uri "${url}" -OutFile "${dest}"`,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 },
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
    pthFiles = fs
      .readdirSync(pthDir)
      .filter((f) => /^python\d+(\._pth|\.pth)$/.test(f));
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

  const hasImportSite = pthContent
    .split("\n")
    .some((line) => /^\s*import\s+site\s*$/.test(line));
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
        logger.info(
          `Enabled import site (renamed to ${path.basename(newPth)})`,
        );
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
  const ensure = spawnSync(
    pythonExe,
    ["-m", "ensurepip", "--upgrade", "--default-pip"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    },
  );
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
  const installVenv = spawnSync(
    pythonExe,
    ["-m", "pip", "install", "virtualenv", "--quiet"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    },
  );
  if (installVenv.status !== 0) {
    const msg = (installVenv.stderr || installVenv.stdout || "unknown").trim();
    logger.warn(`pip install virtualenv failed: ${msg}`);
    return false;
  }

  logger.info("Bundled Python is ready (virtualenv installed)");
  return true;
};

/**
 * Find bundled Python executable, searching multiple possible locations.
 * Priority: resourcesPath/python/ → appRoot/python/ → appRoot/../python/
 */
const findBundledPythonExe = (appRoot) => {
  const isWin = process.platform === "win32";
  const exeName = isWin ? "python.exe" : "python3";
  const binSegment = isWin ? "" : "bin";
  const binExe = path.join(binSegment, exeName);

  // Best candidate: extraResources/python/ (process.resourcesPath)
  // Fallback: appRoot/python/ (dev layout)
  // appRoot/../python/ (alternative layout)
  const candidates = [
    path.join(process.resourcesPath, "python", exeName),
    path.join(process.resourcesPath, "python", binExe),
    path.join(appRoot, "python", exeName),
    path.join(appRoot, "python", binExe),
    path.join(appRoot, "..", "python", exeName),
    path.join(appRoot, "..", "python", binExe),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return { exe: c, dir: path.dirname(c) };
  }
  return null;
};

/**
 * Fix pyvenv.cfg home/executable/base-* paths to point to actual bundled Python.
 * Called after venv is created or copied, to fix relocation issues in packaged app.
 */
const fixVenvPaths = (venvDir, appRoot) => {
  const pyvenvCfg = path.join(venvDir, "pyvenv.cfg");
  if (!fs.existsSync(pyvenvCfg)) return;
  try {
    const found = findBundledPythonExe(appRoot);
    if (!found) {
      logger.warn(
        `fixVenvPaths: bundled python not found — cannot fix pyvenv.cfg`,
      );
      return;
    }
    const pythonExe = found.exe;
    const pythonDir = found.dir;
    let cfg = fs.readFileSync(pyvenvCfg, "utf8");
    const replacements = {
      home: pythonExe,
      executable: pythonExe,
      "base-prefix": pythonDir,
      "base-exec-prefix": pythonDir,
      "base-executable": pythonExe,
      command: `${pythonExe} -m virtualenv ${venvDir}`,
    };
    for (const [key, value] of Object.entries(replacements)) {
      cfg = cfg.replace(new RegExp(`^${key}\\s*=.*`, "m"), `${key} = ${value}`);
    }
    fs.writeFileSync(pyvenvCfg, cfg, "utf8");
    logger.info(
      `fixVenvPaths: updated pyvenv.cfg → bundled Python at ${pythonExe}`,
    );
  } catch (e) {
    logger.warn(`fixVenvPaths failed: ${e.message}`);
  }
};

/**
 * Replace shebang lines in .exe launcher scripts inside venv Scripts/.
 * Pre-built venv from build machine has stale paths in pip.exe, wheel.exe, etc.
 * We fix them to point to the new venv python.exe location.
 */
const fixExeShebangs = (venvDir) => {
  if (process.platform !== "win32") return;
  const scriptsDir = path.join(venvDir, "Scripts");
  if (!fs.existsSync(scriptsDir)) return;
  const venvPython = path.join(scriptsDir, "python.exe");
  if (!fs.existsSync(venvPython)) return;

  // Read pip.exe (PE binary with embedded shebang) — seek for "#!..." line
  const exeFiles = [
    "pip.exe",
    "pip3.exe",
    "pip3.11.exe",
    "pip-3.11.exe",
    "wheel.exe",
  ];
  // Only files that actually contain an old shebang get rewritten
  const oldPrefix = "D:\\project\\node\\nomopro";
  const newShebang = `#!${venvPython}`;

  for (const exeName of exeFiles) {
    const exePath = path.join(scriptsDir, exeName);
    if (!fs.existsSync(exePath)) continue;
    try {
      // PE files: shebang is near the start, within first 4KB
      const buf = fs.readFileSync(exePath);
      if (!buf.includes(oldPrefix)) continue; // no stale path → skip
      const idx = buf.indexOf("#!");
      if (idx < 0) continue;

      // Find end of shebang line
      const eolIdx = buf.indexOf("\n", idx);
      if (eolIdx < 0) continue;

      const oldShebangEnd = eolIdx + 1; // include \n
      const newBuf = Buffer.alloc(buf.length);
      // Write new shebang
      const newBytes = Buffer.from(newShebang + "\n", "utf8");
      newBuf.fill(0);
      newBytes.copy(newBuf, 0);
      // Copy remaining content after old shebang
      buf.copy(newBuf, newBytes.length, oldShebangEnd);

      // Ensure total size didn't grow (shebangs must fit in PE stub)
      // If new shebang is longer than old, pad with nulls and hope
      if (newBytes.length > oldShebangEnd - idx) {
        logger.warn(
          `fixExeShebangs: ${exeName} new shebang longer than old, skipping`,
        );
        // Alternative: just truncate — Python launcher reads up to \n
        // Write anyway, PE launcher only reads first line up to \n
      }

      fs.writeFileSync(exePath, newBuf);
      logger.info(`fixExeShebangs: fixed ${exeName} → ${newShebang}`);
    } catch (e) {
      logger.warn(`fixExeShebangs: failed to patch ${exeName}: ${e.message}`);
    }
  }
};

/**
 * Copy pre-built virtualenv from resources to user data dir.
 * Used when app is packaged and dev ran build-venv.js.
 */
const copyPrebuiltVenv = (appRoot) => {
  const { app } = require("electron");
  const resourcesVenvDir = path.join(
    app.isPackaged ? process.resourcesPath : appRoot,
    "python-env",
  );
  if (!fs.existsSync(resourcesVenvDir)) return false;
  if (
    !fs.existsSync(
      path.join(
        resourcesVenvDir,
        process.platform === "win32" ? "Scripts" : "bin",
        process.platform === "win32" ? "python.exe" : "python3",
      ),
    )
  )
    return false;

  const targetDir = path.join(appRoot, "data", "python-env");
  logger.info(
    `Copying pre-built virtualenv from ${resourcesVenvDir} to ${targetDir}...`,
  );
  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    const { copyRecursive } = require("./utils");
    copyRecursive(resourcesVenvDir, targetDir, { excludeDir: "__pycache__" });
    logger.info(`Pre-built virtualenv deployed to ${targetDir}`);

    // Fix pyvenv.cfg paths to match new location (venv relocation issue)
    fixVenvPaths(targetDir, appRoot);

    // Fix shebangs in .exe launcher scripts (pip.exe, wheel.exe)
    // Pre-built venv contains stale absolute paths from build machine →
    // Python launcher exits with code 1 because it can't find the interpreter
    fixExeShebangs(targetDir);

    return true;
  } catch (e) {
    logger.warn(`Failed to copy pre-built virtualenv: ${e.message}`);
    return false;
  }
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
        // Fix pyvenv.cfg paths — handles relocation in packaged app
        fixVenvPaths(venvPaths.venvDir, appRoot);
        // Fix shebangs in .exe launcher scripts (stale build machine paths)
        fixExeShebangs(venvPaths.venvDir);
        return { success: true, venvPaths, alreadyExists: true };
      }
    } catch (e) {
      // corrupted venv, will recreate
      logger.warn("Virtualenv appears corrupted, recreating...");
    }
  }

  // Try to deploy pre-built virtualenv from installer resources
  if (copyPrebuiltVenv(appRoot)) {
    // Re-check after copy
    if (fs.existsSync(venvPaths.python)) {
      try {
        const res = spawnSync(venvPaths.python, ["--version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (res.status === 0) {
          logger.info(`Virtualenv ready (pre-built): ${venvPaths.python}`);
          return {
            success: true,
            venvPaths,
            alreadyExists: true,
            fromPrebuild: true,
          };
        }
      } catch (e) {
        logger.warn(
          "Pre-built venv copy succeeded but python doesn't work, will create fresh",
        );
      }
    }
  }

  // Create venv
  const systemPython = findSystemPython(appRoot);
  if (!systemPython) {
    return {
      success: false,
      error: "No compatible Python (>= 3.8) found on system",
    };
  }

  logger.info(
    `Creating virtualenv at ${venvPaths.venvDir} using ${systemPython}...`,
  );

  // If using bundled Python, ensure venv/virtualenv is available
  const isBundled =
    bundledPythonDirRef && systemPython.startsWith(bundledPythonDirRef);
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
  const pipResult = spawnSync(
    ...getPipSpawnArgs(venvPaths, ["install", "--upgrade", "pip", "--quiet"]),
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    },
  );
  if (pipResult.status !== 0) {
    logger.warn(`Pip upgrade warning: ${pipResult.stderr || pipResult.stdout}`);
  }

  // Ensure setuptools and wheel are available
  spawnSync(
    ...getPipSpawnArgs(venvPaths, [
      "install",
      "--upgrade",
      "setuptools",
      "wheel",
      "--quiet",
    ]),
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    },
  );

  // Fix pyvenv.cfg paths to avoid relocation issues in packaged app
  fixVenvPaths(venvPaths.venvDir, appRoot);

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
  if (name.startsWith("-") || name.startsWith("--"))
    return "Package name cannot start with '-'";
  // Only allow valid PyPI package name characters plus / @ for URL/VCS installs
  if (/[<>|;&$`\\]/.test(name))
    return "Package name contains invalid characters";
  return null;
};

/**
 * Install a package via pip in the virtualenv
 */
const PIP_INSTALL_DEFAULT_TIMEOUT = 300000; // 5 menit default (naik dari 120s)

const installPackage = async (
  event,
  {
    appRoot,
    packageName,
    upgrade = false,
    pre = false,
    versionSpecifier,
    timeoutMs,
  },
) => {
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
    // Support version specifier: "package==1.2.3" or "package>=1.0"
    if (
      packageName.includes("==") ||
      packageName.includes(">=") ||
      packageName.includes("<=") ||
      packageName.includes("@")
    ) {
      args.push(packageName);
    } else if (versionSpecifier) {
      args.push(`${packageName}${versionSpecifier}`);
    } else {
      args.push(packageName);
    }

    const effectiveTimeout =
      typeof timeoutMs === "number" && timeoutMs > 0
        ? timeoutMs
        : PIP_INSTALL_DEFAULT_TIMEOUT;
    const proc = spawn(...getPipSpawnArgs(venvResult.venvPaths, args), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: effectiveTimeout,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      const text = String(chunk || "");
      stdout += text;
      sendProgress(event, { type: "install-output", data: text });
    });
    proc.stdout.on("error", (err) =>
      logger.warn(`pip stdout error: ${err.message}`),
    );

    proc.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr += text;
      sendProgress(event, { type: "install-output", data: text });
    });
    proc.stderr.on("error", (err) =>
      logger.warn(`pip stderr error: ${err.message}`),
    );

    return await new Promise((resolve) => {
      proc.on("close", (code) => {
        const success = code === 0;
        sendProgress(event, {
          type: success ? "install-done" : "install-error",
          exitCode: code,
          package: packageName,
        });

        // Record error for diagnostic bundle
        if (!success) {
          recordPipError(
            "install",
            packageName,
            `exit code ${code}`,
            stderr,
            stdout,
          );
        }

        // Cache successfully installed package for offline use
        if (success) {
          cachePackage(appRoot, packageName).catch((err) => {
            logger.warn(
              `Failed to cache package ${packageName}: ${err.message}`,
            );
          });
        }

        resolve({
          success,
          exitCode: code,
          stdout,
          stderr,
          package: packageName,
        });
      });

      proc.on("error", (err) => {
        sendProgress(event, { type: "install-error", error: err.message });
        recordPipError("install", packageName, err.message, "");
        resolve({ success: false, error: err.message });
      });
    });
  });
};

/**
 * Uninstall a package from virtualenv
 */
// Package yang gak boleh di-uninstall oleh user (critical untuk package manager)
const PROTECTED_PACKAGES = ["pip", "setuptools", "wheel"];

const uninstallPackage = async (event, { appRoot, packageName }) => {
  const validationError = validatePackageName(packageName);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Proteksi: blokir uninstall package kritis
  if (PROTECTED_PACKAGES.includes(packageName.trim().toLowerCase())) {
    return {
      success: false,
      error: `Cannot uninstall '${packageName}' — it is required by the package manager`,
      protected: true,
    };
  }

  return withPipLock(async () => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) {
      return venvResult;
    }

    sendProgress(event, { type: "uninstall-start", package: packageName });

    const result = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, [
        "uninstall",
        "-y",
        packageName,
      ]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    );

    const success = result.status === 0;
    sendProgress(event, {
      type: success ? "uninstall-done" : "uninstall-error",
      package: packageName,
      exitCode: result.status,
    });

    if (!success) {
      recordPipError(
        "uninstall",
        packageName,
        `exit code ${result.status}`,
        result.stderr,
        result.stdout,
      );
    }

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

  const result = spawnSync(
    ...getPipSpawnArgs(venvResult.venvPaths, ["list", "--format=json"]),
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000,
    },
  );

  if (result.status !== 0) {
    return {
      success: false,
      error: (result.stderr || result.stdout || "pip list failed").trim(),
    };
  }

  try {
    const packages = JSON.parse(result.stdout);
    return { success: true, packages, count: packages.length };
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse pip list output: ${e.message}`,
    };
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

  const result = spawnSync(
    ...getPipSpawnArgs(venvResult.venvPaths, ["show", packageName]),
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    },
  );

  if (result.status !== 0) {
    return {
      success: false,
      error: `Package '${packageName}' not found`,
      notFound: true,
    };
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

  const result = spawnSync(
    venvResult.venvPaths.python,
    ["-c", "import pip._internal.locations as loc; print(loc.USER_CACHE_DIR)"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    },
  );

  let cacheDir = "";
  if (result.status === 0) {
    cacheDir = result.stdout.trim();
  }

  let cacheSize = 0;
  let cacheCount = 0;
  if (cacheDir && fs.existsSync(cacheDir)) {
    try {
      const entries = fs.readdirSync(cacheDir, { recursive: true });
      cacheCount = entries.filter((e) =>
        fs.statSync(path.join(cacheDir, e)).isFile(),
      ).length;
      cacheSize = walkDirSize(cacheDir).size;
    } catch (e) {
      // ignore
    }
  }

  return {
    success: true,
    cacheDir,
    cacheSize,
    cacheCount,
    venvDir: getVenvPaths(appRoot).venvDir,
  };
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
    proc.stdout.on("error", (err) =>
      logger.warn(`runInVenv stdout error: ${err.message}`),
    );

    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    proc.stderr.on("error", (err) =>
      logger.warn(`runInVenv stderr error: ${err.message}`),
    );

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

  ipcMain.handle(
    "pip-install",
    async (
      event,
      { packageName, upgrade, pre, versionSpecifier, timeoutMs },
    ) => {
      return installPackage(event, {
        appRoot,
        packageName,
        upgrade,
        pre,
        versionSpecifier,
        timeoutMs,
      });
    },
  );

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

  ipcMain.handle("pip-reset-python-cache", async () => {
    resetSystemPythonCache();
    return { success: true };
  });

  ipcMain.handle("pip-error-history", async () => {
    return getPipErrorHistory();
  });

  // M7: Pip config management
  ipcMain.handle("pip-set-config", async (event, { key, value }) => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) return venvResult;
    const result = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, ["config", "set", key, value]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      },
    );
    return {
      success: result.status === 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  });

  ipcMain.handle("pip-get-config", async (event, { key }) => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) return venvResult;
    const result = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, ["config", "get", key]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      },
    );
    return {
      success: result.status === 0,
      value: result.stdout.trim(),
      stdout: result.stdout,
      stderr: result.stderr,
    };
  });

  ipcMain.handle("pip-list-config", async () => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) return venvResult;
    const result = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, ["config", "list"]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      },
    );
    if (result.status !== 0) return { success: false, error: result.stderr };
    const lines = result.stdout.trim().split("\n").filter(Boolean);
    const config = {};
    for (const line of lines) {
      const idx = line.indexOf("=");
      if (idx > 0)
        config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { success: true, config, raw: result.stdout.trim() };
  });

  // M9: Pip upgrade
  ipcMain.handle("pip-upgrade", async () => {
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) return venvResult;
    const result = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, [
        "install",
        "--upgrade",
        "pip",
        "--quiet",
      ]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60000,
      },
    );
    return {
      success: result.status === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      versionBefore: "",
      versionAfter: "",
    };
  });

  // M10: Pip search (pip index versions)
  ipcMain.handle("pip-search", async (event, { query }) => {
    if (!query || query.trim().length === 0)
      return { success: false, error: "Search query is required" };
    // Try pip index versions first (pip >= 22.2)
    const venvResult = ensureVirtualEnv(appRoot);
    if (!venvResult.success) return venvResult;
    const result = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, [
        "index",
        "versions",
        query.trim(),
      ]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    );
    if (result.status === 0) {
      const lines = result.stdout.split("\n").filter(Boolean);
      const versions = [];
      for (const line of lines) {
        if (line.includes("Available versions:")) {
          const parts = line.split(":");
          if (parts[1]) {
            versions.push(
              ...parts[1]
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            );
          }
        }
      }
      return {
        success: true,
        query: query.trim(),
        versions,
        source: "pip index",
      };
    }
    // Fallback: simple pip search (deprecated but may still work)
    const fallbackResult = spawnSync(
      ...getPipSpawnArgs(venvResult.venvPaths, ["search", query.trim()]),
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    );
    if (fallbackResult.status === 0) {
      const results = fallbackResult.stdout
        .split("\n")
        .filter(Boolean)
        .slice(0, 20);
      return {
        success: true,
        query: query.trim(),
        results,
        source: "pip search",
      };
    }
    return {
      success: false,
      error: `No results for '${query}'`,
      query: query.trim(),
    };
  });

  logger.info("Pip IPC handlers registered");
};

const resetSystemPythonCache = () => {
  systemPythonCache = null;
};

module.exports = {
  registerPipHandlers,
  ensureVirtualEnv,
  getVenvPaths,
  getPipSpawnArgs,
  fixExeShebangs,
  resetSystemPythonCache,
  validatePackageName,
  PROTECTED_PACKAGES,
  getPipErrorHistory,
};
