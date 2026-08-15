const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");

const WINDOWS_ARDUINO_DATA_ROOT = path.join(
  "C:",
  "NomokitData",
  "arduino-data",
);
let cachedArduinoDataRoot = null;

/**
 * Get a path under the persistent user data directory (%APPDATA%/nomokit-desktop).
 * This data survives app reinstalls/uninstalls.
 * @param {...string} segments - Path segments to join under the base AppData dir.
 * @returns {string} Full path.
 */
function getAppDataPath(...segments) {
  const base = app.getPath("userData"); // e.g. %APPDATA%/nomokit-desktop
  return path.join(base, ...segments);
}

/**
 * Ensure a directory exists under the AppData path.
 * @param {...string} segments
 * @returns {string} The directory path.
 */
function ensureAppDataDir(...segments) {
  const dir = getAppDataPath(...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resolve the Arduino data root path.
 * On Windows, prefer a short dedicated path outside AppData and installer dir.
 * Falls back to AppData if the preferred root can't be created.
 * @returns {string}
 */
function getArduinoDataRoot() {
  if (cachedArduinoDataRoot) {
    return cachedArduinoDataRoot;
  }

  if (process.platform === "win32") {
    try {
      fs.mkdirSync(WINDOWS_ARDUINO_DATA_ROOT, { recursive: true });
      cachedArduinoDataRoot = WINDOWS_ARDUINO_DATA_ROOT;
      return cachedArduinoDataRoot;
    } catch (e) {
      logger.warn(
        "appdata: failed to use C:/NomokitData/arduino-data, fallback to AppData: " +
          e.message,
      );
    }
  }

  cachedArduinoDataRoot = getAppDataPath("arduino-data");
  return cachedArduinoDataRoot;
}

/**
 * Join path segments under the resolved Arduino data root.
 * @param {...string} segments
 * @returns {string}
 */
function getArduinoDataPath(...segments) {
  return path.join(getArduinoDataRoot(), ...segments);
}

/**
 * Ensure Arduino data root (or child dir) exists.
 * @param {...string} segments
 * @returns {string}
 */
function ensureArduinoDataDir(...segments) {
  const dir = getArduinoDataPath(...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the path to the old arduino-data location (inside app directory).
 * Used for migration.
 * @param {string} appRoot - __dirname of main process (app root).
 * @returns {string} Path to old arduino-data.
 */
function getOldArduinoDataPath(appRoot) {
  return path.join(appRoot, "src/link/tools/Arduino/arduino-data");
}

/**
 * Get the path to the old libraries directory (inside app directory).
 * @param {string} appRoot
 * @returns {string} Path to old libraries.
 */
function getOldLibrariesPath(appRoot) {
  return path.join(appRoot, "src/link/tools/Arduino/libraries");
}

/**
 * Get the path to the old local directory.
 * @param {string} appRoot
 * @returns {string} Path to old local.
 */
function getOldLocalPath(appRoot) {
  return path.join(appRoot, "src/link/tools/Arduino/local");
}

/**
 * Get the path to the old localLib.json.
 * @param {string} appRoot
 * @returns {string}
 */
function getOldLocalLibJsonPath(appRoot) {
  return path.join(appRoot, "src/link/tools/localLib.json");
}

/**
 * Get the new localLib.json path (under AppData).
 * @returns {string}
 */
function getLocalLibJsonPath() {
  return getAppDataPath("localLib.json");
}

/**
 * Get the new library-version.json path (under AppData).
 * @returns {string}
 */
function getLibraryVersionPath() {
  return getAppDataPath("library-version.json");
}

/**
 * Merge package directories from legacy source to target without overwriting
 * existing target package vendor folders.
 * @param {string} sourcePackages
 * @param {string} targetPackages
 */
function mergePackagesDir(sourcePackages, targetPackages) {
  if (!fs.existsSync(sourcePackages)) {
    return;
  }

  fs.mkdirSync(targetPackages, { recursive: true });
  const packageVendors = fs.readdirSync(sourcePackages, {
    withFileTypes: true,
  });

  for (const entry of packageVendors) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourceVendorPath = path.join(sourcePackages, entry.name);
    const targetVendorPath = path.join(targetPackages, entry.name);
    if (!fs.existsSync(targetVendorPath)) {
      fs.cpSync(sourceVendorPath, targetVendorPath, { recursive: true });
      logger.info(
        "appdata: migrated package vendor " +
          entry.name +
          " to " +
          targetVendorPath,
      );
    }
  }
}

/**
 * Merge legacy arduino-data root into the new root.
 * Non-package files are copied if missing; package vendors are merged by folder.
 * @param {string} sourceRoot
 * @param {string} targetRoot
 */
function mergeArduinoDataRoot(sourceRoot, targetRoot) {
  if (!fs.existsSync(sourceRoot) || sourceRoot === targetRoot) {
    return;
  }

  fs.mkdirSync(targetRoot, { recursive: true });
  const sourceEntries = fs.readdirSync(sourceRoot, { withFileTypes: true });

  for (const entry of sourceEntries) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);

    if (entry.name === "packages" && entry.isDirectory()) {
      mergePackagesDir(sourcePath, targetPath);
      continue;
    }

    if (!fs.existsSync(targetPath)) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      logger.info("appdata: migrated " + sourcePath + " to " + targetPath);
    }
  }
}

/**
 * Migrate old arduino data (inside app dir) to new AppData location.
 * Only runs once — if AppData destination already exists, skip.
 * @param {string} appRoot
 */
function migrateArduinoData(appRoot) {
  const newDataPath = getArduinoDataPath();
  const legacyAppDataPath = getAppDataPath("arduino-data");
  const oldDataPath = getOldArduinoDataPath(appRoot);
  const candidates = [legacyAppDataPath, oldDataPath];

  try {
    fs.mkdirSync(newDataPath, { recursive: true });
  } catch (e) {
    logger.warn("appdata: failed to ensure target arduino-data: " + e.message);
    return;
  }

  for (const source of candidates) {
    if (!source || source === newDataPath || !fs.existsSync(source)) {
      continue;
    }

    try {
      mergeArduinoDataRoot(source, newDataPath);
      logger.info(
        "appdata: merged arduino-data from " + source + " to " + newDataPath,
      );
    } catch (e) {
      logger.warn(
        "appdata: failed to merge arduino-data from " +
          source +
          ": " +
          e.message,
      );
    }
  }

  // Note: libraries stay at src/link/tools/Arduino/libraries (arduino-cli reads them there).
  // Only local (user-added) libraries go to AppData.

  // Migrate local
  const newLocalPath = getAppDataPath("local");
  if (!fs.existsSync(newLocalPath)) {
    const oldLocalPath = getOldLocalPath(appRoot);
    if (fs.existsSync(oldLocalPath)) {
      try {
        fs.cpSync(oldLocalPath, newLocalPath, { recursive: true });
        logger.info("appdata: migrated local to " + newLocalPath);
      } catch (e) {
        logger.warn("appdata: failed to migrate local: " + e.message);
      }
    }
  }

  // Migrate localLib.json
  const newLibJsonPath = getLocalLibJsonPath();
  if (!fs.existsSync(newLibJsonPath)) {
    const oldLibJsonPath = getOldLocalLibJsonPath(appRoot);
    if (fs.existsSync(oldLibJsonPath)) {
      try {
        fs.copyFileSync(oldLibJsonPath, newLibJsonPath);
        logger.info("appdata: migrated localLib.json to " + newLibJsonPath);
      } catch (e) {
        logger.warn("appdata: failed to migrate localLib.json: " + e.message);
      }
    }
  }

  // Migrate library-version.json (from tools/version.json)
  const newVerPath = getLibraryVersionPath();
  if (!fs.existsSync(newVerPath)) {
    const oldVerPath = path.join(appRoot, "src/link/tools/version.json");
    if (fs.existsSync(oldVerPath)) {
      try {
        fs.copyFileSync(oldVerPath, newVerPath);
        logger.info("appdata: migrated version.json to " + newVerPath);
      } catch (e) {
        logger.warn("appdata: failed to migrate version.json: " + e.message);
      }
    }
  }
}

/**
 * Extract bundled avr-core from installer resources to AppData on first run.
 * After this, arduino-cli can find packages at the data dir configured in yaml.
 * @param {string} appRoot
 */
function extractBundledAvrCore(appRoot) {
  const dataDir = getArduinoDataPath();
  const destPackages = path.join(dataDir, "packages");

  // Already extracted — skip
  if (fs.existsSync(destPackages)) {
    logger.info("appdata: avr-core packages already extracted, skipping");
    return;
  }

  let srcDir = null;

  // Packaged app: look in extraResources
  try {
    const { app: electronApp } = require("electron");
    if (electronApp.isPackaged) {
      const candidates = [
        path.join(process.resourcesPath, "avr-core"),
        path.join(process.resourcesPath, "..", "avr-core"),
      ];
      for (const c of candidates) {
        const pkg = path.join(c, "packages");
        if (fs.existsSync(pkg)) {
          srcDir = pkg;
          break;
        }
      }
    }
  } catch (_) {
    // ignore
  }

  // Dev/unpacked: check build/avr-core
  if (!srcDir) {
    const devPkg = path.join(appRoot, "build", "avr-core", "packages");
    if (fs.existsSync(devPkg)) {
      srcDir = devPkg;
    }
  }

  if (!srcDir) {
    logger.warn(
      "appdata: bundled avr-core packages not found — arduino:avr may need manual install",
    );
    return;
  }

  try {
    fs.mkdirSync(destPackages, { recursive: true });
    fs.cpSync(srcDir, destPackages, { recursive: true });
    logger.info("appdata: extracted avr-core packages to " + destPackages);
  } catch (e) {
    logger.error("appdata: failed to extract avr-core: " + e.message);
  }
}

/**
 * Generate arduino-cli.yaml with data directory pointing to AppData.
 * Overwrites the existing config file in the app directory.
 * @param {string} appRoot
 */
function ensureArduinoCliConfig(appRoot) {
  const dataDir = getArduinoDataPath().replace(/\\/g, "/");
  const arduinoDir = path.join(appRoot, "src/link/tools/Arduino");
  const configPath = path.join(arduinoDir, "arduino-cli.yaml");

  try {
    const yaml = require("js-yaml");
    const config = {
      daemon: { port: "50051" },
      directories: {
        data: dataDir,
        downloads: dataDir + "/staging",
        user: dataDir,
      },
      library: { enable_unsafe_install: false },
      logging: { file: "", format: "text", level: "info" },
      metrics: { addr: ":9090", enabled: true },
      sketch: { always_export_binaries: false },
      board_manager: {
        additional_urls: [
          "https://dl.espressif.com/dl/package_esp32_index.json",
          "https://arduino.esp8266.com/stable/package_esp8266com_index.json",
          "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json",
        ],
      },
    };

    if (fs.existsSync(configPath)) {
      try {
        const current = yaml.load(fs.readFileSync(configPath, "utf8")) || {};
        const currentDirs = current.directories || {};
        const desiredDirs = config.directories;
        const currentUrls = (
          (current.board_manager || {}).additional_urls || []
        ).map(String);
        const desiredUrls = config.board_manager.additional_urls;

        const sameDirs =
          currentDirs.data === desiredDirs.data &&
          currentDirs.downloads === desiredDirs.downloads &&
          currentDirs.user === desiredDirs.user;
        const sameUrls =
          JSON.stringify(currentUrls) === JSON.stringify(desiredUrls);

        if (sameDirs && sameUrls) {
          logger.info(
            "appdata: arduino-cli.yaml already up to date -> data dir: " +
              dataDir,
          );
          return;
        }
      } catch (e) {
        logger.warn(
          "appdata: failed to parse existing arduino-cli.yaml, rewriting: " +
            e.message,
        );
      }
    }

    fs.writeFileSync(configPath, yaml.dump(config), "utf8");
    logger.info("appdata: generated arduino-cli.yaml -> data dir: " + dataDir);
  } catch (e) {
    logger.error("appdata: failed to generate arduino-cli.yaml: " + e.message);
  }
}

module.exports = {
  getAppDataPath,
  ensureAppDataDir,
  getArduinoDataRoot,
  getArduinoDataPath,
  ensureArduinoDataDir,
  getOldArduinoDataPath,
  getOldLibrariesPath,
  getOldLocalPath,
  getOldLocalLibJsonPath,
  getLocalLibJsonPath,
  getLibraryVersionPath,
  mergePackagesDir,
  mergeArduinoDataRoot,
  migrateArduinoData,
  extractBundledAvrCore,
  ensureArduinoCliConfig,
};
