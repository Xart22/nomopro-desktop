/**
 * prepare-avr-core.js
 *
 * Download arduino:avr core via arduino-cli, then extract to build/avr-core/
 * so electron-builder can bundle it into NSIS installer.
 *
 * Usage: node scripts/prepare-avr-core.js
 * Called by: prebuild script in package.json
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..");
const TARGET = path.join(ROOT, "build", "avr-core");
const PACKAGES_DST = path.join(TARGET, "packages");

function dereferenceSymlinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(full);
      fs.unlinkSync(full);
      fs.copyFileSync(real, full);
    } else if (entry.isDirectory()) {
      dereferenceSymlinks(full);
    }
  }
}

function main() {
  const avrHardwareDir = path.join(PACKAGES_DST, "arduino/hardware/avr");
  const avrToolsDir = path.join(PACKAGES_DST, "arduino/tools");
  const hasHardware =
    fs.existsSync(avrHardwareDir) && fs.readdirSync(avrHardwareDir).length > 0;
  const hasTools =
    fs.existsSync(avrToolsDir) && fs.readdirSync(avrToolsDir).length > 0;
  // The tools/ payload (avr-gcc, avrdude) is a platform-specific binary
  // download — a bundle generated on macOS is useless (and silently broken)
  // if bundled into a Windows build, and vice versa. Only skip regeneration
  // if the existing bundle was built for the platform we're on right now.
  const platformFile = path.join(TARGET, ".avr-platform");
  const bundledPlatform = fs.existsSync(platformFile)
    ? fs.readFileSync(platformFile, "utf8").trim()
    : null;
  const platformMatches = bundledPlatform === process.platform;
  if (hasHardware && hasTools && platformMatches) {
    console.log(
      `[prepare-avr-core] avr core already present at ${TARGET} for ${process.platform}, skipping regeneration.`,
    );
    return;
  }
  if (hasHardware && hasTools && !platformMatches) {
    console.log(
      `[prepare-avr-core] avr core at ${TARGET} was built for platform '${bundledPlatform}', but this is '${process.platform}' — regenerating.`,
    );
  }
  if (hasHardware && !hasTools) {
    console.log(
      `[prepare-avr-core] avr core at ${TARGET} has hardware defs but no toolchain (avr-gcc/avrdude) — regenerating.`,
    );
  }

  console.log("[prepare-avr-core] Installing arduino:avr core…");

  // Determine arduino-cli path
  const isWin = process.platform === "win32";
  const arduinoDir = path.join(ROOT, "src/link/tools/Arduino");
  const cli = path.join(arduinoDir, isWin ? "arduino-cli.exe" : "arduino-cli");

  if (!fs.existsSync(cli)) {
    console.error("[prepare-avr-core] ERROR: arduino-cli not found at", cli);
    console.error(
      "[prepare-avr-core] Either install arduino-cli locally at that path, " +
        "or ensure build/avr-core/ (committed to git) is present so this step can be skipped.",
    );
    process.exit(1);
  }

  // Generate temp arduino-cli.yaml with data dir pointing to a local staging folder
  // so we can access the installed files after. The original yaml may have data dir
  // pointing to AppData (after the persistence refactor).
  const tmpDataDir = path.join(os.tmpdir(), "nomokit-avr-staging");
  if (fs.existsSync(tmpDataDir))
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDataDir, { recursive: true });

  const tmpCfgPath = path.join(tmpDataDir, "arduino-cli.yaml");
  const yamlContent = `daemon:
  port: "50051"
directories:
  data: ${tmpDataDir.replace(/\\/g, "/")}
  downloads: ${tmpDataDir.replace(/\\/g, "/")}/staging
  user: ${tmpDataDir.replace(/\\/g, "/")}
board_manager:
  additional_urls:
    - https://dl.espressif.com/dl/package_esp32_index.json
    - https://arduino.esp8266.com/stable/package_esp8266com_index.json
    - https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
`;
  fs.writeFileSync(tmpCfgPath, yamlContent, "utf8");

  try {
    execSync(
      `"${cli}" core install arduino:avr --config-file "${tmpCfgPath}"`,
      {
        cwd: arduinoDir,
        stdio: "inherit",
        timeout: 300000,
      },
    );
  } catch (e) {
    // core may already be installed — ignore
    console.warn("[prepare-avr-core] core install warning:", e.message);
  }

  // Find installed files
  const pkgDir = path.join(tmpDataDir, "packages/arduino");
  if (!fs.existsSync(pkgDir)) {
    console.error(
      "[prepare-avr-core] ERROR: packages/arduino not found at expected path:",
      pkgDir,
    );
    console.log("[prepare-avr-core] Contents of tmp dir:");
    try {
      const ls = fs.readdirSync(tmpDataDir, { recursive: true });
      ls.forEach((f) => console.log("  " + f));
    } catch (_) {}
    process.exit(1);
  }

  // Copy entire packages/arduino/ — includes hardware + tools
  if (fs.existsSync(TARGET))
    fs.rmSync(TARGET, { recursive: true, force: true });
  fs.mkdirSync(PACKAGES_DST, { recursive: true });
  const destDir = path.join(PACKAGES_DST, "arduino");
  fs.cpSync(pkgDir, destDir, { recursive: true });
  // Some toolchain files (e.g. liblto_plugin.so) are symlinks with absolute
  // targets inside tmpDataDir, which gets deleted by this script's own
  // cleanup below. fs.cpSync's `dereference` option doesn't apply to
  // symlinks found while recursing into subdirectories, so resolve them
  // manually here (while tmpDataDir still exists) to avoid shipping a
  // dangling link.
  dereferenceSymlinks(destDir);

  // Write version marker
  const versions = fs
    .readdirSync(path.join(destDir, "hardware/avr"))
    .filter((f) =>
      fs.statSync(path.join(destDir, "hardware/avr", f)).isDirectory(),
    );
  fs.writeFileSync(
    path.join(TARGET, ".avr-version"),
    versions.join(",") || "unknown",
  );
  fs.writeFileSync(path.join(TARGET, ".avr-platform"), process.platform);

  // Clean tmp staging
  try {
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }

  const size = getDirSize(TARGET);
  console.log(
    `[prepare-avr-core] Done. avr core bundled at ${TARGET} (${(size / 1024 / 1024).toFixed(1)} MB)`,
  );
  const folders = fs.readdirSync(path.join(TARGET, "packages/arduino"));
  console.log(`[prepare-avr-core] Folders: ${folders.join(", ")}`);
  console.log(`[prepare-avr-core] Versions: ${versions.join(", ")}`);
}

function getDirSize(dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += getDirSize(full);
      else total += fs.statSync(full).size;
    }
  } catch (_) {
    /* ignore */
  }
  return total;
}

main();
