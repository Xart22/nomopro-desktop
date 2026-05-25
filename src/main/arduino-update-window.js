const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function showArduinoUpdateWindow({ emitter } = {}) {
  if (!emitter) return;

  let canClose = false;

  const updateWin = new BrowserWindow({
    width: 520,
    height: 500,
    resizable: false,
    title: "Update Tools Arduino",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../../preload-update.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  updateWin.loadFile(path.join(__dirname, "../update/arduino-update.html"))
    .catch((err) => console.error("Arduino update window loadFile error:", err));

  // Buffer IPC messages until the page finishes loading (preload not yet ready)
  const pending = [];
  let pageReady = false;

  function send(data) {
    if (updateWin.isDestroyed()) return;
    if (pageReady) {
      updateWin.webContents.send("arduino-update-progress", data);
    } else {
      pending.push(data);
    }
  }

  updateWin.webContents.on("did-finish-load", () => {
    pageReady = true;
    for (const data of pending) {
      if (!updateWin.isDestroyed())
        updateWin.webContents.send("arduino-update-progress", data);
    }
    pending.length = 0;
  });

  emitter.on("start", () => send({ status: "start" }));

  emitter.on("progress", (data) =>
    send({ status: "line", message: data.message })
  );

  emitter.on("complete", () => {
    canClose = true;
    send({ status: "complete" });
    setTimeout(() => {
      if (!updateWin.isDestroyed()) updateWin.close();
    }, 4000);
  });

  emitter.on("error", (data) => {
    canClose = true;
    send({ status: "error", message: data.message });
  });

  updateWin.on("close", (e) => {
    if (!canClose) e.preventDefault();
  });

  ipcMain.once("arduino-update-close", () => {
    canClose = true;
    if (!updateWin.isDestroyed()) updateWin.close();
  });
}

module.exports = { showArduinoUpdateWindow };
