const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
} = require("electron");
const OpenBlockLink = require("./src/link/src");
const clc = require("cli-color");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const extract = require("extract-zip");
const Downloader = require("nodejs-file-downloader");
const console = require("console");
const getHwid = require("node-machine-id").machineIdSync;
const logger = require("electron-log");
const { io } = require("socket.io-client");
const { autoUpdater } = require("electron-updater");

logger.transports.file.level = "info";
autoUpdater.logger = logger;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
//http://15.235.140.95:2023
const socket = io("http://15.235.140.95:2023", {
  reconnection: true,
  timeout: 10000,
});
let token = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/user.json"), "utf8")
);
const link = new OpenBlockLink();
const syncLibary = async () => {
  logger.info("Syncing libary");

  try {
    const localDir = path.join(__dirname, "src/link/tools/Arduino/local");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir);
    }
    const versionFile = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "src/link/tools/version.json"),
        "utf8"
      )
    );
    const response = await axios.get("https://nomo-kit.com/api/check-update");
    const data = response.data;
    if (data.version !== versionFile.version) {
      fs.rmSync(path.join(__dirname, "src/link/tools/Arduino/libraries"), {
        recursive: true,
        force: true,
      });
      const downloader = new Downloader({
        url: data.url,
        directory: path.join(__dirname, "src/link/tools/Arduino/libraries"),
      });

      const { filePath, downloadStatus } = await downloader.download();
      if (downloadStatus === "COMPLETE") {
        await extract(
          filePath,
          { dir: path.join(__dirname, "src/link/tools/Arduino/libraries") },
          function (err) {
            if (err) {
              console.log(err);
            }
          }
        );

        fs.readdir(
          path.join(__dirname, "src/link/tools/Arduino/libraries"),
          (err, files) => {
            files.forEach(async (file) => {
              if (file !== data.version + ".zip") {
                await extract(
                  path.join(
                    __dirname,
                    "src/link/tools/Arduino/libraries/" + file
                  ),
                  {
                    dir: path.join(
                      __dirname,
                      "src/link/tools/Arduino/libraries"
                    ),
                  },
                  function (err) {
                    if (err) {
                      console.log(err);
                    }
                  }
                );
                fs.unlinkSync(
                  path.join(
                    __dirname,
                    "src/link/tools/Arduino/libraries/" + file
                  )
                );
              } else {
                fs.unlinkSync(
                  path.join(__dirname, "src/link/tools/Arduino/libraries", file)
                );
              }
            });
          }
        );
        fs.readdir(
          path.join(__dirname, "src/link/tools/Arduino/local"),
          (err, files) => {
            files.forEach(async (file) => {
              fs.cpSync(
                path.join(__dirname, "src/link/tools/Arduino/local/" + file),
                path.join(
                  __dirname,
                  "src/link/tools/Arduino/libraries/" + file
                ),

                { recursive: true }
              );
            });
          }
        );

        fs.writeFileSync(
          path.join(__dirname, "src/link/tools/version.json"),
          JSON.stringify(data)
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
};

app.commandLine.appendSwitch("ignore-certificate-errors");

const template = [
  {
    label: "View",
    submenu: [
      {
        role: "reload",
      },
      {
        type: "separator",
      },
      {
        role: "resetzoom",
      },
      {
        role: "zoomin",
      },
      {
        role: "zoomout",
      },
      {
        type: "separator",
      },
      {
        role: "togglefullscreen",
      },
    ],
  },

  {
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click: async () => {
          const { shell } = require("electron");
          await shell.openExternal("https://nomo-kit.com/");
        },
      },
      {
        label: "Exit",
        click: async () => {
          app.quit();
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
let win;
const createWindow = () => {
  win = new BrowserWindow({
    width: 1620,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "/src/assets/img/nomokit.png"),
    title: "Nomopro-Desktop" + " - " + "v" + app.getVersion(),
  });

  logger.info(socket.connected);
  win.loadFile(path.join(__dirname, "/src/connection/index.html"));

  //win.webContents.openDevTools();

  ipcMain.on("login", async (event, arg) => {
    const hwid = getHwid();
    arg.hwid = hwid;
    arg.app = "nomopro";
    await axios
      .post("https://nomo-kit.com/api/login", arg)
      .then(async (res) => {
        if (res.data.user.subscriptions == null) {
          if (res.data.user.trial != null) {
            res.data.user.subscriptions = res.data.user.trial;
          }
        }
        if (res.data.user.subscriptions == null) {
          event.reply("no-subscription", res.data);
          await axios.get("https://nomo-kit.com/api/logout", {
            headers: { Authorization: "Bearer " + res.data.token },
          });
        } else {
          if (res.data.user.subscriptions.is_active == 0) {
            event.reply("no-subscription", res.data);
            arg.status = "fail";
            await axios.get("https://nomo-kit.com/api/logout", {
              headers: { Authorization: "Bearer " + res.data.token },
            });
          } else {
            fs.writeFileSync(
              path.join(__dirname, "/data/user.json"),
              JSON.stringify(res.data)
            );
            token = await JSON.parse(
              fs.readFileSync(path.join(__dirname, "data/user.json"), "utf8")
            );

            socket.emit("login", res.data);
            setMenu();
            win.loadFile(path.join(__dirname, "/src/gui/index.html"));
          }
        }

        //win.loadFile(path.join(__dirname, "/src/gui/index.html"));
      })
      .catch((err) => {
        console.log(err);
        event.reply("login-fail", err.response.data);
      });
  });

  ipcMain.on("logout", async (event, arg) => {
    fs.writeFileSync(
      path.join(__dirname, "data/user.json"),
      JSON.stringify({})
    );
    win.loadFile(path.join(__dirname, "/src/auth/index.html"));
  });
  socket.on("disconnect", () => {
    win.loadFile(path.join(__dirname, "/src/connection/index.html"));
  });

  socket.on("connect", () => {
    if (token.token !== undefined) {
      if (token.user.subscriptions !== null) {
        let date = new Date(
          token.user.subscriptions.end_date ??
            token.user.subscriptions.trial_ends
        );
        let now = new Date();
        if (date < now) {
          fs.writeFileSync(
            path.join(__dirname, "data/user.json"),
            JSON.stringify({})
          );
          win.loadFile(path.join(__dirname, "/src/auth/index.html"));
        } else {
          setMenu();
          win.loadFile(path.join(__dirname, "/src/gui/index.html"));
        }
      }
    } else {
      win.loadFile(path.join(__dirname, "/src/auth/index.html"));
    }
  });
  win.on("close", async () => {
    win.destroy();
  });
  syncLibary();

  //  START: Link server
  link.listen();
  logger.info("Link server started");
  return win;
};
app.whenReady().then(() => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
socket.on("login-fail", async (data) => {
  if (data == token.token) {
    await axios
      .get("https://nomo-kit.com/api/logout", {
        headers: { Authorization: "Bearer " + token.token },
      })
      .then((res) => {
        fs.writeFileSync(
          path.join(__dirname, "data/user.json"),
          JSON.stringify({})
        );
        // win.loadFile(path.join(__dirname, "/src/auth/index.html"));
        dialog.showErrorBox(
          "Error: ",
          "Seseorang telah login dengan akun anda, silahkan login kembali"
        );
        app.quit();
        app.relaunch();
      })
      .catch((err) => {
        console.log(err);
      });
  }
});

app.on("ready", async () => {
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on("update-available", () => {
    if (process.platform === "darwin") {
      dialog
        .showMessageBox({
          type: "question",
          title: "Update available",
          message:
            "Update is available, please download manually on the nomokit website",
          buttons: ["Yes", "No"],
          yes: 0,
          no: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            shell.openExternal("https://nomo-kit.com/download-macos");
          }
        });
    } else {
      dialog
        .showMessageBox({
          type: "question",
          title: "Update available",
          message: "Update Version is available",
          buttons: ["Yes", "No"],
          yes: 0,
          no: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            win.loadFile(path.join(__dirname, "/src/update/index.html"));
            autoUpdater.downloadUpdate();
          }
        });
    }
  });
  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "question",
        title: "Update available",
        message: "Update is downloaded, will be installed on restart",
        buttons: ["Yes", "No"],
        yes: 0,
        no: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, false);
          app.quit();
        }
      });
  });
  autoUpdater.on("error", (err) => {
    dialog.showErrorBox("Error: ", err == null ? "unknown" : err);
  });
  autoUpdater.on("download-progress", (progressObj) => {
    win.webContents.send("download-progress", progressObj.percent);
  });
});

app.on("window-all-closed", () => {
  socket.emit("logout", token);
  win.destroy();
  app.exit();
});

const setMenu = () => {
  const localLib = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "src/link/tools/localLib.json"),
      "utf8"
    )
  );
  const libary = localLib.map((item, index) => {
    return {
      label: `${index + 1}. ${item}`,
    };
  });
  const template = [
    {
      label: "View",
      submenu: [
        {
          role: "reload",
        },
        {
          type: "separator",
        },
        {
          role: "resetzoom",
        },
        {
          role: "zoomin",
        },
        {
          role: "zoomout",
        },
        {
          type: "separator",
        },
        {
          role: "togglefullscreen",
        },
      ],
    },

    {
      label: "Local Library",
      submenu: [
        {
          label: "Add .ZIP Library",
          click: async () => {
            dialog
              .showOpenDialog({
                properties: ["openFile"],
                filters: [{ name: "Zip", extensions: ["zip"] }],
              })
              .then(async (res) => {
                if (!res.canceled) {
                  try {
                    await extract(
                      res.filePaths[0],
                      {
                        dir: path.join(
                          __dirname,
                          "src/link/tools/Arduino/local"
                        ),
                      },
                      function (err) {
                        if (err) {
                          console.log(err);
                        }
                      }
                    );
                    await extract(
                      res.filePaths[0],
                      {
                        dir: path.join(
                          __dirname,
                          "src/link/tools/Arduino/libraries"
                        ),
                      },
                      function (err) {
                        if (err) {
                          console.log(err);
                        }
                      }
                    );

                    const filesName = [];
                    fs.readdir(
                      path.join(__dirname, "src/link/tools/Arduino/local"),
                      (err, files) => {
                        files.forEach(async (file) => {
                          if (!file.includes(".txt")) {
                            filesName.push(file + ".h");
                          }
                        });
                        fs.writeFileSync(
                          path.join(__dirname, "src/link/tools/localLib.json"),
                          JSON.stringify(filesName)
                        );
                      }
                    );
                    dialog.showMessageBox({
                      type: "info",
                      title: "Success",
                      message: "Add libary success",
                    });
                    setMenu();
                  } catch (error) {
                    console.log(error);
                  }
                }
              });
          },
        },
        ...libary,
      ],
    },

    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://nomo-kit.com/");
          },
        },
        {
          label: "Exit",
          click: async () => {
            app.quit();
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.on("before-quit", (event) => {
  event.preventDefault();
  win.destroy();
  link.close();
  app.quit();
});
