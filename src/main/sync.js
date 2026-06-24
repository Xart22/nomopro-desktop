const fs = require("fs");
const path = require("path");
const axios = require("axios");
const extract = require("extract-zip");
const Downloader = require("nodejs-file-downloader");
const logger = require("./logger");

async function syncLibrary(appRoot) {
  logger.info("Syncing library");
  try {
    const localDir = path.join(appRoot, "src/link/tools/Arduino/local");
    const librariesDir = path.join(appRoot, "src/link/tools/Arduino/libraries");
    const versionPath = path.join(appRoot, "src/link/tools/version.json");

    const versionFile = JSON.parse(fs.readFileSync(versionPath, "utf8"));
    const { data } = await axios.get("https://nomo-kit.com/api/check-update");
    if (data.version === versionFile.version) return;

    fs.mkdirSync(localDir, { recursive: true });

    // Download to isolated temp dir
    const tempDir = path.join(appRoot, "src/link/tools/temp");
    fs.mkdirSync(tempDir, { recursive: true });

    const downloader = new Downloader({ url: data.url, directory: tempDir });
    console.log("Downloading libraries from: " + data.url);
    const { filePath, downloadStatus } = await downloader.download();
    console.log("Download status: " + downloadStatus);
    if (downloadStatus !== "COMPLETE") return;

    // Stage extraction away from librariesDir
    const stageDir = path.join(tempDir, "stage");
    fs.mkdirSync(stageDir, { recursive: true });
    await extract(filePath, { dir: stageDir });

    // Extract inner zips, skip version marker
    const versionZip = data.version + ".zip";
    for (const name of fs.readdirSync(stageDir)) {
      if (!name.endsWith(".zip")) continue;
      const p = path.join(stageDir, name);
      await extract(p, { dir: stageDir });
      fs.unlinkSync(p);
    }

    // Swap staging into place
    if (fs.existsSync(librariesDir)) {
      fs.rmSync(librariesDir, { recursive: true, force: true });
    }
    fs.renameSync(stageDir, librariesDir);

    // Merge local overrides
    if (fs.existsSync(localDir)) {
      for (const file of fs.readdirSync(localDir)) {
        fs.cpSync(path.join(localDir, file), path.join(librariesDir, file), { recursive: true });
      }
    }

    // Cleanup temp
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch (e) {
      logger.warn("temp cleanup failed: " + e.message);
    }

    fs.writeFileSync(versionPath, JSON.stringify(data));
  } catch (error) {
    logger.error("syncLibrary error: " + error.message);
  }
}

async function _syncResource(win, appRoot, windowUpdate, { logLabel, versionField, urlField, targetDir, zipName }) {
  logger.info("Syncing " + logLabel);
  try {
    const version = JSON.parse(
      fs.readFileSync(path.join(appRoot, "src/version.json"), "utf8"),
    );
    const response = await axios.get(
      "https://nomo-kit.com/api/check-update-dektop",
    );
    const data = response.data;
    if (data[versionField] !== version[versionField]) {
      const { dialog } = require("electron");
      try {
        const res = await dialog.showMessageBox({
          type: "question",
          title: "Update",
          message: "Update available for " + logLabel + ", do you want to update now?",
          buttons: ["Yes", "No"],
        });
        if (res.response === 0) {
          if (win && !win.isDestroyed()) {
            win.loadFile(path.join(appRoot, "/src/update/index.html"));
          }
          const downloader = new Downloader({
            url: data[urlField],
            directory: path.join(appRoot, "src/update"),
            onProgress: function (percentage) {
              if (win && win.webContents && !win.isDestroyed())
                win.webContents.send("download-progress", percentage);
            },
          });
          const { filePath, downloadStatus } = await downloader.download();
          if (downloadStatus === "COMPLETE") {
            const targetPath = path.join(appRoot, targetDir);
            if (fs.existsSync(targetPath)) {
              fs.rmSync(targetPath, { recursive: true, force: true });
            }
            await extract(filePath, { dir: targetPath });
            fs.writeFileSync(
              path.join(appRoot, "src/version.json"),
              JSON.stringify(data),
            );
            // Cleanup downloaded zip
            try {
              if (fs.existsSync(filePath) && path.basename(filePath) === zipName) {
                fs.unlinkSync(filePath);
              }
            } catch (e) {
              logger.warn("Failed to clean up update zip: " + e.message);
            }
            const { app } = require("electron");
            app.relaunch();
            app.exit();
          }
        }
      } catch (dialogErr) {
        logger.error("sync dialog error: " + dialogErr.message);
      }
    }
  } catch (error) {
    logger.error("sync " + logLabel + " error: " + error.message);
  }
}

function syncGui(win, appRoot, windowUpdate) {
  return _syncResource(win, appRoot, windowUpdate, {
    logLabel: "Gui",
    versionField: "gui",
    urlField: "gui_url",
    targetDir: "src/gui",
    zipName: "gui.zip",
  });
}

function syncLink(win, appRoot, windowUpdate) {
  return _syncResource(win, appRoot, windowUpdate, {
    logLabel: "Link",
    versionField: "link",
    urlField: "link_url",
    targetDir: "src/link",
    zipName: "link.zip",
  });
}

module.exports = { syncLibrary, syncGui, syncLink };
