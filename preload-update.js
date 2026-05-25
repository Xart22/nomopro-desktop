const { ipcRenderer, contextBridge } = require("electron");

let callback = null;
const pending = [];

const handler = (event, data) => {
  if (callback) {
    callback(data);
  } else {
    pending.push(data);
  }
};

ipcRenderer.on("arduino-update-progress", handler);

contextBridge.exposeInMainWorld("arduinoUpdate", {
  onProgress: (cb) => {
    callback = cb;
    for (const data of pending) {
      callback(data);
    }
    pending.length = 0;
    return () => ipcRenderer.removeListener("arduino-update-progress", handler);
  },
  closeWindow: () => {
    ipcRenderer.send("arduino-update-close");
  },
});
