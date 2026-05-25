const { ipcMain, dialog } = require("electron");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const getHwid = require("node-machine-id").machineIdSync;
const logger = require("./logger");

// Default storage path: Documents/OpenBlock (Windows) or ~/Documents/OpenBlock (macOS)
const getDefaultStorageDir = () => {
  const docsDir =
    process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "Documents")
      : process.env.HOME
        ? path.join(process.env.HOME, "Documents")
        : path.join(__dirname, "..", "..", "data", "projects");

  const storageDir = path.join(docsDir, "OpenBlock");
  return storageDir;
};

const ensureDefaultStorageDir = () => {
  const dir = getDefaultStorageDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (e) {
    // If Documents path fails, fallback to app-local data
    const fallback = path.join(__dirname, "..", "..", "data", "projects");
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
};

const registerFileStorageHandlers = () => {
  ipcMain.handle("file-storage-save", async (event, { fileName, content }) => {
    try {
      const dir = ensureDefaultStorageDir();
      // Validate extension
      const safeName = path.basename(fileName || "untitled.txt");
      const targetPath = path.join(dir, safeName);

      // Conflict handling: if file exists, rename with (1), (2), etc.
      let finalPath = targetPath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const ext = path.extname(safeName);
        const base = path.basename(safeName, ext);
        finalPath = path.join(dir, `${base} (${counter})${ext}`);
        counter++;
      }

      fs.writeFileSync(finalPath, content, "utf8");
      logger.info(`File saved: ${finalPath}`);
      return { success: true, path: finalPath, fileName: path.basename(finalPath) };
    } catch (e) {
      logger.error(`File save error: ${e.message}`);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("file-storage-read", async (event, { fileName }) => {
    try {
      const dir = getDefaultStorageDir();
      const targetPath = path.join(dir, path.basename(fileName || ""));
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: "File not found" };
      }
      const content = fs.readFileSync(targetPath, "utf8");
      return { success: true, content, path: targetPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("file-storage-list", async () => {
    try {
      const dir = ensureDefaultStorageDir();
      const files = fs.readdirSync(dir).filter((f) => {
        const fullPath = path.join(dir, f);
        return fs.statSync(fullPath).isFile();
      });
      const fileInfos = files.map((f) => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };
      });
      return { success: true, files: fileInfos, dir };
    } catch (e) {
      return { success: false, error: e.message, files: [] };
    }
  });

  ipcMain.handle("file-storage-delete", async (event, { fileName }) => {
    try {
      const dir = getDefaultStorageDir();
      const targetPath = path.join(dir, path.basename(fileName || ""));
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: "File not found" };
      }
      fs.unlinkSync(targetPath);
      logger.info(`File deleted: ${targetPath}`);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("file-storage-get-default-dir", async () => {
    const dir = ensureDefaultStorageDir();
    return { success: true, dir };
  });
};

function registerIpc({ win, appRoot, socket }) {
  ipcMain.on("login", async (event, arg) => {
    logger.info("Login (ipc)");
    const hwid = getHwid();
    arg.hwid = hwid;
    arg.app = "nomopro";
    try {
      const res = await axios.post("https://nomo-kit.com/api/login", arg);
      fs.writeFileSync(
        path.join(appRoot, "/data/user.json"),
        JSON.stringify(res.data),
      );
      socket.emit("login", res.data);
      // refresh menu and load gui
      const { setMenu } = require(path.join(appRoot, "src/main/menu"));
      setMenu({ win, appRoot, app: require("electron").app });
      win.loadFile(path.join(appRoot, "/src/gui/index.html"));
    } catch (err) {
      logger.error("login error: " + (err?.message || "unknown"));
      event.reply("login-fail", err?.response?.data ?? { error: "unknown" });
    }
  });

  ipcMain.on("logout", async (event, arg) => {
    fs.writeFileSync(path.join(appRoot, "data/user.json"), JSON.stringify({}));
    if (win && !win.isDestroyed())
      win.loadFile(path.join(appRoot, "/src/auth/index.html"));
  });

  // Legacy getUserData (send-based) — keep for backward compat
  ipcMain.on("getUserData", (event, arg) => {
    const userDataFilePath = path.join(appRoot, "data", "user.json");
    fs.readFile(userDataFilePath, "utf8", (err, data) => {
      if (err) {
        logger.error("Error reading user data: " + err.message);
        event.sender.send("responseUserData", {
          error: "Failed to read user data",
        });
        return;
      }
      try {
        const parsedData = JSON.parse(data);
        const userId = parsedData.user?.id;
        event.sender.send("responseUserData", { id: userId });
      } catch (e) {
        logger.error("Error parsing user data: " + e.message);
        event.sender.send("responseUserData", {
          error: "Failed to parse user data",
        });
      }
    });
  });

  // New invoke-based getUserData for preload bridge
  ipcMain.handle("getUserData", async () => {
    const userDataFilePath = path.join(appRoot, "data", "user.json");
    try {
      const data = fs.readFileSync(userDataFilePath, "utf8");
      const parsedData = JSON.parse(data);
      const userId = parsedData.user?.id;
      const userName = parsedData.user?.name || parsedData.user?.username || "";
      const token = parsedData.token || "";
      return { id: userId, name: userName, token };
    } catch (e) {
      logger.error(`Error reading user data: ${e.message}`);
      return { error: "Failed to read user data" };
    }
  });

  // Register file storage handlers
  registerFileStorageHandlers();
}

module.exports = { registerIpc };