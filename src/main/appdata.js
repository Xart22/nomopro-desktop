const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");

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
 * Migrate old arduino data (inside app dir) to new AppData location.
 * Only runs once — if AppData destination already exists, skip.
 * @param {string} appRoot
 */
function migrateArduinoData(appRoot) {
  const newDataPath = getAppDataPath("arduino-data");
  if (fs.existsSync(newDataPath)) {
    logger.info("appdata: arduino-data already migrated, skipping");
    return;
  }

  const oldDataPath = getOldArduinoDataPath(appRoot);
  if (fs.existsSync(oldDataPath)) {
    try {
      fs.cpSync(oldDataPath, newDataPath, { recursive: true });
      logger.info("appdata: migrated arduino-data to " + newDataPath);
    } catch (e) {
      logger.warn("appdata: failed to migrate arduino-data: " + e.message);
    }
  }

  // Migrate libraries
  const newLibsPath = getAppDataPath("libraries");
  if (!fs.existsSync(newLibsPath)) {
    const oldLibsPath = getOldLibrariesPath(appRoot);
    if (fs.existsSync(oldLibsPath)) {
      try {
        fs.cpSync(oldLibsPath, newLibsPath, { recursive: true });
        logger.info("appdata: migrated libraries to " + newLibsPath);
      } catch (e) {
        logger.warn("appdata: failed to migrate libraries: " + e.message);
      }
    }
  }

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
  const dataDir = getAppDataPath("arduino-data");
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
    const devPkg = path.join(appRoot, "..", "build", "avr-core", "packages");
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
  const dataDir = getAppDataPath("arduino-data").replace(/\\/g, "/");
  const arduinoDir = path.join(appRoot, "src/link/tools/Arduino");
  const configPath = path.join(arduinoDir, "arduino-cli.yaml");

  try {
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

    fs.writeFileSync(configPath, require("js-yaml").dump(config), "utf8");
    logger.info("appdata: generated arduino-cli.yaml -> data dir: " + dataDir);
  } catch (e) {
    logger.error("appdata: failed to generate arduino-cli.yaml: " + e.message);
  }
}

module.exports = {
  getAppDataPath,
  ensureAppDataDir,
  getOldArduinoDataPath,
  getOldLibrariesPath,
  getOldLocalPath,
  getOldLocalLibJsonPath,
  getLocalLibJsonPath,
  getLibraryVersionPath,
  migrateArduinoData,
  extractBundledAvrCore,
  ensureArduinoCliConfig,
};
