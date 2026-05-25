/**
 * Offline Wheel Cache Policy (Phase 7 — Step 28)
 *
 * Caches successfully installed packages for:
 * - Faster reinstall
 * - Offline partial support
 * - Invalidation per Python version / platform
 * - Cache stats and management
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { ipcMain } = require("electron");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patternForPackage = (name) => escapeRegex(name).replace(/[-_]/g, "[-_]");

/**
 * Get the offline wheel cache directory
 */
const getCacheDir = (appRoot) => {
  const pv = process.versions && process.versions.python ? process.versions.python.replace(/\./g, "") : "unknown";
  const platform = process.platform;
  return path.join(appRoot, "data", "wheel-cache", `${platform}-py${pv}`);
};

/**
 * Ensure cache directory exists
 */
const ensureCacheDir = (appRoot) => {
  const dir = getCacheDir(appRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Get full cache info
 */
const getCacheInfo = async (event, { appRoot }) => {
  const cacheDir = getCacheDir(appRoot);
  const info = {
    cacheDir,
    exists: fs.existsSync(cacheDir),
    totalSize: 0,
    packageCount: 0,
    packages: [],
    platform: process.platform,
    pythonVersion: process.versions.python || "unknown",
  };

  if (!info.exists) {
    return { success: true, ...info };
  }

  try {
    const entries = fs.readdirSync(cacheDir, { withFileTypes: true });
    let totalSize = 0;
    const packages = [];

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".whl") || entry.name.endsWith(".tar.gz") || entry.name.endsWith(".zip"))) {
        const fullPath = path.join(cacheDir, entry.name);
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;

        // Parse package name from filename
        // e.g. requests-2.31.0-py3-none-any.whl
        const nameMatch = entry.name.match(/^([a-zA-Z0-9_.-]+?)-(\d+\.\d+(?:\.\d+)?)/);
        const pkgName = nameMatch ? nameMatch[1].replace(/_/g, "-") : entry.name;
        const pkgVersion = nameMatch ? nameMatch[2] : "unknown";

        packages.push({
          fileName: entry.name,
          packageName: pkgName,
          version: pkgVersion,
          size: stat.size,
          sizeMB: Math.round(stat.size / 1024 / 1024 * 100) / 100,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }

    info.totalSize = totalSize;
    info.totalSizeMB = Math.round(totalSize / 1024 / 1024 * 100) / 100;
    info.packageCount = packages.length;
    info.packages = packages.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch (e) {
    return { success: false, error: e.message, ...info };
  }

  return { success: true, ...info };
};

/**
 * Copy a package's wheel to the offline cache when install succeeds
 * This is called by pip-manager after successful install
 */
const cachePackage = async (appRoot, packageName, pipCacheDir) => {
  const cacheDir = ensureCacheDir(appRoot);

  // Find recently downloaded wheels in pip's cache
  try {
    if (pipCacheDir && fs.existsSync(pipCacheDir)) {
      const wheels = [];
      const walkDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isFile() && (entry.name.endsWith(".whl") || entry.name.endsWith(".tar.gz"))) {
            // Check if wheel matches the package
            const namePart = patternForPackage(packageName.toLowerCase());
            if (entry.name.toLowerCase().match(new RegExp(namePart))) {
              wheels.push(full);
            }
          } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
            walkDir(full);
          }
        }
      };
      walkDir(pipCacheDir);

      // Copy matching wheels to our cache
      for (const wheel of wheels.slice(-3)) { // Max 3 per package
        const dest = path.join(cacheDir, path.basename(wheel));
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(wheel, dest);
          logger.info(`Cached wheel: ${path.basename(wheel)}`);
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to cache package ${packageName}: ${e.message}`);
  }
};

/**
 * Install a package from cache (offline)
 */
const installFromCache = async (event, { appRoot, packageName }) => {
  const { getVenvPaths, ensureVirtualEnv } = require("./pip-manager");

  const venvResult = ensureVirtualEnv(appRoot);
  if (!venvResult.success) return venvResult;

  const cacheDir = getCacheDir(appRoot);
  if (!fs.existsSync(cacheDir)) {
    return { success: false, error: "No offline cache available", requiresNetwork: true };
  }

  // Find wheel in cache matching package
  const entries = fs.readdirSync(cacheDir);
  const matchingWheels = entries.filter((f) => {
    const name = f.toLowerCase();
    const pn = patternForPackage(packageName.toLowerCase());
    return name.match(new RegExp(pn)) && (f.endsWith(".whl") || f.endsWith(".tar.gz"));
  });

  if (matchingWheels.length === 0) {
    return { success: false, error: `Package '${packageName}' not found in offline cache`, requiresNetwork: true };
  }

  // Install from local wheel file
  const wheelPath = path.join(cacheDir, matchingWheels[0]);
  const result = spawnSync(venvResult.venvPaths.pip, ["install", wheelPath, "--quiet"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });

  return {
    success: result.status === 0,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    installedFromCache: true,
    wheel: matchingWheels[0],
  };
};

/**
 * Clear the offline wheel cache
 */
const clearCache = async (event, { appRoot }) => {
  const cacheDir = getCacheDir(appRoot);
  if (fs.existsSync(cacheDir)) {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      logger.info(`Cleared offline wheel cache: ${cacheDir}`);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true, alreadyEmpty: true };
};

/**
 * Remove specific package from cache
 */
const removeFromCache = async (event, { appRoot, packageName }) => {
  const cacheDir = getCacheDir(appRoot);
  if (!fs.existsSync(cacheDir)) {
    return { success: false, error: "Cache is empty" };
  }

  const entries = fs.readdirSync(cacheDir);
  const pn = patternForPackage(packageName.toLowerCase());
  let removed = 0;

  for (const entry of entries) {
    if (entry.toLowerCase().match(new RegExp(pn)) && (entry.endsWith(".whl") || entry.endsWith(".tar.gz"))) {
      try {
        fs.unlinkSync(path.join(cacheDir, entry));
        removed++;
      } catch (e) {
        logger.warn(`Failed to remove ${entry} from cache: ${e.message}`);
      }
    }
  }

  return { success: true, removed, package: packageName };
};

const registerOfflineCacheHandlers = ({ appRoot }) => {
  ipcMain.handle("offline-cache-info", async (event) => {
    return getCacheInfo(event, { appRoot });
  });

  ipcMain.handle("offline-cache-install", async (event, { packageName }) => {
    return installFromCache(event, { appRoot, packageName });
  });

  ipcMain.handle("offline-cache-clear", async (event) => {
    return clearCache(event, { appRoot });
  });

  ipcMain.handle("offline-cache-remove", async (event, { packageName }) => {
    return removeFromCache(event, { appRoot, packageName });
  });

  logger.info("Offline wheel cache IPC handlers registered");
};

module.exports = {
  registerOfflineCacheHandlers,
  cachePackage,
  getCacheDir,
};