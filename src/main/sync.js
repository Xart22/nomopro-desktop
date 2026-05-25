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
      fs.rmSync(path.join(appRoot, "src/link/tools/Arduino/libraries"), {
        recursive: true,
        force: true,
      });
      const downloader = new Downloader({
        url: data.url,
        directory: path.join(appRoot, "src/link/tools/Arduino/libraries"),
      });

      const { filePath, downloadStatus } = await downloader.download();
      if (downloadStatus === "COMPLETE") {
        await extract(filePath, {
          dir: path.join(appRoot, "src/link/tools/Arduino/libraries"),
        });

        fs.readdir(
          path.join(appRoot, "src/link/tools/Arduino/libraries"),
          (err, files) => {
            files.forEach(async (file) => {
              if (file !== data.version + ".zip") {
                await extract(
                  path.join(
                    appRoot,
                    "src/link/tools/Arduino/libraries/" + file,
                  ),
                  {
                    dir: path.join(appRoot, "src/link/tools/Arduino/libraries"),
                  },
                );
                fs.unlinkSync(
                  path.join(
                    appRoot,
                    "src/link/tools/Arduino/libraries/" + file,
                  ),
                );
              } else {
                fs.unlinkSync(
                  path.join(appRoot, "src/link/tools/Arduino/libraries", file),
                );
              }
            });
          },
        );
        fs.readdir(
          path.join(appRoot, "src/link/tools/Arduino/local"),
          (err, files) => {
            files.forEach(async (file) => {
              fs.cpSync(
                path.join(appRoot, "src/link/tools/Arduino/local/" + file),
                path.join(appRoot, "src/link/tools/Arduino/libraries/" + file),
                { recursive: true },
              );
            });
          },
        );

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
      dialog
        .showMessageBox({
          type: "question",
          title: "Update",
          message: "Update available for " + logLabel + ", do you want to update now?",
          buttons: ["Yes", "No"],
        })
        .then(async (res) => {
          if (res.response === 0) {
            win.loadFile(path.join(appRoot, "/src/update/index.html"));
            const downloader = new Downloader({
              url: data[urlField],
              directory: path.join(appRoot, "src/update"),
              onProgress: function (percentage) {
                if (win && win.webContents)
                  win.webContents.send("download-progress", percentage);
              },
            });
            const { filePath, downloadStatus } = await downloader.download();
            if (downloadStatus === "COMPLETE") {
              fs.rmSync(path.join(appRoot, targetDir), {
                recursive: true,
                force: true,
              });
              await extract(filePath, { dir: path.join(appRoot, targetDir) });
              fs.writeFileSync(
                path.join(appRoot, "src/version.json"),
                JSON.stringify(data),
              );
              dialog
                .showMessageBox({
                  type: "info",
                  title: "Success",
                  message: "Update success",
                })
                .then(() => {
                  fs.readdir(path.join(appRoot, "src/update"), (err, files) => {
                    files.forEach((file) => {
                      if (file === zipName) {
                        fs.unlinkSync(path.join(appRoot, "src/update", file));
                      }
                    });
                  });
                  const { app } = require("electron");
                  app.relaunch();
                  app.exit();
                });
            }
          }
        });
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
