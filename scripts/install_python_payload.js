#!/usr/bin/env node
/**
 * Install bundled Python runtime into nomopro-desktop/build-resources/python/
 *
 * This script downloads the embeddable Python distribution for the current platform
 * and places it in the expected location for electron-builder extraResources.
 *
 * Usage:
 *   node scripts/install_python_payload.js           # auto-detect platform
 *   node scripts/install_python_payload.js --win     # force Windows
 *   node scripts/install_python_payload.js --mac     # force macOS
 *
 * Prerequisites:
 *   - curl or wget available on PATH
 *   - Internet access to python.org
 */

const https = require("https");
const http = require("http");
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
const PYTHON_VERSION = "3.11.9";

const getDownloadUrl = () => {
  if (PLATFORM === "win32") {
    // Embeddable Python for Windows
    const archSuffix = ARCH === "x64" ? "amd64" : ARCH;
    return {
      url: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-${archSuffix}.zip`,
      type: "zip",
    };
  } else if (PLATFORM === "darwin") {
    // macOS: use official installer or portable
    const archSuffix = ARCH === "arm64" ? "arm64" : "x86_64";
    return {
      url: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-macos11.pkg`,
      type: "pkg",
    };
  }
  throw new Error(`Unsupported platform: ${PLATFORM}`);
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith("https") ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve, reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(
          new Error(`Download failed with status ${response.statusCode}: ${url}`),
        );
        return;
      }

      const total = parseInt(response.headers["content-length"], 10);
      let downloaded = 0;

      response.on("data", (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  Downloading: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`);
        }
      });

      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("\n  Download complete.");
        resolve(dest);
      });
    }).on("error", (err) => {
      file.close();
      fs.unlinkSync(dest, () => {});
      reject(err);
    });
  });
};

const extractZip = (zipPath, destDir) => {
  console.log(`  Extracting to ${destDir}...`);
  try {
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true);
    console.log("  Extraction complete.");
    return true;
  } catch (e) {
    console.error(`  adm-zip not available, trying system unzip...`);
    const result = spawnSync("unzip", ["-o", zipPath, "-d", destDir], {
      stdio: "inherit",
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`Extraction failed: ${result.stderr || result.error}`);
    }
    return true;
  }
};

const main = async () => {
  console.log(`\n=== Bundled Python Payload Installer ===`);
  console.log(`  Platform: ${PLATFORM} (${ARCH})`);
  console.log(`  Python: ${PYTHON_VERSION}`);
  console.log();

  const targetDir = path.join(
    __dirname,
    "..",
    "python",
  );
  ensureDir(targetDir);

  const downloadInfo = getDownloadUrl();
  const ext = downloadInfo.type === "zip" ? ".zip" : ".pkg";
  const downloadDest = path.join(
    os.tmpdir(),
    `python-${PYTHON_VERSION}-${PLATFORM}${ext}`,
  );

  // Check if already installed
  const markerFile = path.join(targetDir, ".installed");
  if (fs.existsSync(markerFile)) {
    console.log("  Python runtime already installed. Skipping download.");
    console.log(`  To reinstall, delete: ${targetDir}`);
    return;
  }

  console.log(`  Downloading from: ${downloadInfo.url}`);
  console.log(`  Saving to: ${downloadDest}`);
  console.log();

  await downloadFile(downloadInfo.url, downloadDest);

  if (downloadInfo.type === "zip") {
    extractZip(downloadDest, targetDir);

    // On Windows, rename python._pth to disable path restriction
    const pthFile = path.join(targetDir, "python._pth");
    if (fs.existsSync(pthFile)) {
      try {
        const content = fs.readFileSync(pthFile, "utf8");
        // Remove the import site restriction
        const modified = content
          .split("\n")
          .filter((line) => !line.trim().startsWith("#import site"))
          .join("\n") + "\nimport site\n";
        fs.writeFileSync(pthFile.replace("._pth", ".pth"), modified, "utf8");
        fs.unlinkSync(pthFile);
        console.log("  Updated python path configuration for pip compatibility.");
      } catch (e) {
        console.warn(`  Warning: Could not update ._pth file: ${e.message}`);
      }
    }

    // Install pip using ensurepip
    const pythonExe = path.join(targetDir, "python.exe");
    if (fs.existsSync(pythonExe)) {
      console.log("  Bootstrapping pip...");
      const result = spawnSync(pythonExe, ["-m", "ensurepip", "--upgrade", "--default-pip"], {
        stdio: "inherit",
        encoding: "utf8",
        cwd: targetDir,
      });
      if (result.status === 0) {
        console.log("  pip installed successfully.");
      } else {
        console.warn("  Warning: pip installation may have failed.");
      }
    }
  } else if (downloadInfo.type === "pkg") {
    // For macOS pkg, we just note the user needs to extract manually
    console.log(`
  macOS .pkg downloaded to: ${downloadDest}
  To extract Python.framework manually:
    cd ${targetDir}
    pkgutil --expand-full ${downloadDest} python-extracted
  Then copy python binary to: ${targetDir}/bin/
  
  Alternatively, install a portable Python build instead.
    `);
  }

  // Write marker
  fs.writeFileSync(markerFile, `Installed ${PYTHON_VERSION} for ${PLATFORM} on ${new Date().toISOString()}`);
  console.log(`\n  Python runtime installed successfully at: ${targetDir}`);
  console.log(`  Size: ${getDirSize(targetDir)}`);
  console.log();
};

const getDirSize = (dir) => {
  let size = 0;
  try {
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isFile()) size += fs.statSync(fullPath).size;
        else if (entry.isDirectory()) walk(fullPath);
      }
    };
    walk(dir);
  } catch (e) {
    return "unknown";
  }
  const mb = (size / 1024 / 1024).toFixed(1);
  return `${mb} MB`;
};

main().catch((err) => {
  console.error("\n✗ Failed to install Python payload:", err.message);
  process.exit(1);
});