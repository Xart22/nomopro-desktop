const fs = require("fs");
const path = require("path");
const axios = require("axios");
const extract = require("extract-zip");
const Downloader = require("nodejs-file-downloader");
const logger = require("./logger");

async function syncLibary(appRoot) {
  logger.info("Syncing libary");
  try {
    const localDir = path.join(appRoot, "src/link/tools/Arduino/local");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir);
    }
    const versionFile = JSON.parse(
      fs.readFileSync(
        path.join(appRoot, "src/link/tools/version.json"),
        "utf8",
      ),
    );
    const response = await axios.get("https://nomo-kit.com/api/check-update");
    const data = response.data;
    if (data.version !== versionFile.version) {
      // Download first, then delete only on success
      const librariesDir = path.join(appRoot, "src/link/tools/Arduino/libraries");
      const downloader = new Downloader({
        url: data.url,
        directory: librariesDir,
      });

      const { filePath, downloadStatus } = await downloader.download();
      if (downloadStatus === "COMPLETE") {
        // Delete old libraries after successful download
        if (fs.existsSync(librariesDir)) {
          fs.rmSync(librariesDir, { recursive: true, force: true });
        }
        fs.mkdirSync(librariesDir, { recursive: true });
        await extract(filePath, { dir: librariesDir });

        // Extract inner archives sequentially
        const files = fs.readdirSync(librariesDir);
        for (const file of files) {
          if (file !== data.version + ".zip") {
            await extract(path.join(librariesDir, file), { dir: librariesDir });
            fs.unlinkSync(path.join(librariesDir, file));
          } else {
            fs.unlinkSync(path.join(librariesDir, file));
          }
        }

        // Copy local files
        if (fs.existsSync(localDir)) {
          const localFiles = fs.readdirSync(localDir);
          for (const file of localFiles) {
            fs.cpSync(
              path.join(localDir, file),
              path.join(librariesDir, file),
              { recursive: true },
            );
          }
        }

        // Write version only after everything is done
        fs.writeFileSync(
          path.join(appRoot, "src/link/tools/version.json"),
          JSON.stringify(data),
        );
      }
    }
  } catch (error) {
    logger.error("syncLibary error: " + error.message);
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

module.exports = { syncLibary, syncGui, syncLink };
