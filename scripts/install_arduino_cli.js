#!/usr/bin/env node
/**
 * Install the arduino-cli binary into src/link/tools/Arduino/
 *
 * Runtime code (src/link/src/upload/arduino.js, src/main/menu.js,
 * src/main/arduino-updater.js) all resolve arduino-cli from this project-local
 * path rather than the system PATH, so it must be physically present here for
 * both local dev (npm start) and packaged builds (electron-builder's
 * `files: ["**\/*"]` bundles whatever already exists in this directory).
 *
 * Usage:
 *   node scripts/install_arduino_cli.js           # auto-detect platform
 *   node scripts/install_arduino_cli.js --win     # force Windows
 *   node scripts/install_arduino_cli.js --mac     # force macOS
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const os = require("os");

const PLATFORM = process.argv.includes("--win")
  ? "win32"
  : process.argv.includes("--mac")
    ? "darwin"
    : process.platform;

const ARCH = os.arch();
const ARDUINO_CLI_VERSION = "1.5.1";

const getDownloadUrl = () => {
  const base = `https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}`;
  if (PLATFORM === "win32") {
    return { url: `${base}/arduino-cli_${ARDUINO_CLI_VERSION}_Windows_64bit.zip`, type: "zip" };
  } else if (PLATFORM === "darwin") {
    const asset = ARCH === "arm64" ? "macOS_ARM64" : "macOS_64bit";
    return { url: `${base}/arduino-cli_${ARDUINO_CLI_VERSION}_${asset}.tar.gz`, type: "tar-gz" };
  }
  throw new Error(`Unsupported platform: ${PLATFORM}`);
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          file.close();
          fs.unlinkSync(dest);
          return downloadFile(response.headers.location, dest).then(resolve, reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Download failed with status ${response.statusCode}: ${url}`));
          return;
        }
        const total = parseInt(response.headers["content-length"], 10);
        let downloaded = 0;
        response.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(
              `\r  Downloading: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`,
            );
          }
        });
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log("\n  Download complete.");
          resolve(dest);
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
};

const main = async () => {
  console.log(`\n=== arduino-cli Installer ===`);
  console.log(`  Platform: ${PLATFORM} (${ARCH})`);
  console.log(`  arduino-cli: ${ARDUINO_CLI_VERSION}`);
  console.log();

  const targetDir = path.join(__dirname, "..", "src", "link", "tools", "Arduino");
  ensureDir(targetDir);

  const cliName = PLATFORM === "win32" ? "arduino-cli.exe" : "arduino-cli";
  const cliPath = path.join(targetDir, cliName);
  const markerFile = path.join(targetDir, ".arduino-cli-version");

  if (fs.existsSync(cliPath) && fs.existsSync(markerFile)) {
    const installed = fs.readFileSync(markerFile, "utf8").trim();
    if (installed === ARDUINO_CLI_VERSION) {
      console.log(`  arduino-cli ${ARDUINO_CLI_VERSION} already installed. Skipping download.`);
      console.log(`  To reinstall, delete: ${cliPath}`);
      return;
    }
  }

  const downloadInfo = getDownloadUrl();
  const ext = downloadInfo.type === "zip" ? ".zip" : ".tar.gz";
  const downloadDest = path.join(os.tmpdir(), `arduino-cli-${ARDUINO_CLI_VERSION}-${PLATFORM}${ext}`);

  console.log(`  Downloading from: ${downloadInfo.url}`);
  console.log(`  Saving to: ${downloadDest}`);
  console.log();

  await downloadFile(downloadInfo.url, downloadDest);

  console.log(`  Extracting to ${targetDir}...`);
  if (downloadInfo.type === "zip") {
    try {
      const AdmZip = require("adm-zip");
      const zip = new AdmZip(downloadDest);
      zip.extractAllTo(targetDir, true);
    } catch (e) {
      const result = spawnSync("unzip", ["-o", downloadDest, "-d", targetDir], {
        stdio: "inherit",
      });
      if (result.status !== 0) throw new Error(`Extraction failed: ${result.stderr || result.error}`);
    }
  } else {
    const result = spawnSync("tar", ["xzf", downloadDest, "-C", targetDir], {
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error(`Extraction failed: ${result.stderr || result.error}`);
  }

  if (!fs.existsSync(cliPath)) {
    throw new Error(`Expected binary not found after extraction: ${cliPath}`);
  }
  if (PLATFORM !== "win32") {
    fs.chmodSync(cliPath, 0o755);
  }

  fs.writeFileSync(markerFile, ARDUINO_CLI_VERSION);
  try {
    fs.unlinkSync(downloadDest);
  } catch (_) {
    /* ignore */
  }

  console.log(`\n  arduino-cli ${ARDUINO_CLI_VERSION} installed successfully at: ${cliPath}`);
  console.log();
};

main().catch((err) => {
  console.error("\n✗ Failed to install arduino-cli:", err.message);
  process.exit(1);
});
