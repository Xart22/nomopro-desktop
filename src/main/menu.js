const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const { Menu, dialog, shell } = require("electron");
const { execSync } = require("child_process");
const logger = require("./logger");

const { runArduinoCoreAction } = require("./arduino-updater");
const { showArduinoUpdateWindow } = require("./arduino-update-window");

function getArduinoDir(appRoot) {
  return path.join(appRoot, "src/link/tools/Arduino");
}

function getArduinoCli(appRoot) {
  const exe = process.platform === "win32" ? "arduino-cli.exe" : "arduino-cli";
  return path.join(getArduinoDir(appRoot), exe);
}

function getArduinoConfig(appRoot) {
  return path.join(getArduinoDir(appRoot), "arduino-cli.yaml");
}

function getInstalledCores(appRoot) {
  const cli = getArduinoCli(appRoot);
  const cfg = getArduinoConfig(appRoot);
  const dir = getArduinoDir(appRoot);
  try {
    const out = execSync(
      `"${cli}" core list --format json --config-file "${cfg}"`,
      { cwd: dir, encoding: "utf8", timeout: 15000 },
    ).trim();
    return JSON.parse(out).platforms;
  } catch {
    return [];
  }
}

function getAdditionalCores() {
  return [
    { id: "esp32:esp32", label: "ESP32" },
    { id: "esp8266:esp8266", label: "ESP8266" },
    { id: "arduino:mbed_nano", label: "Arduino Nano 33 BLE" },
    { id: "arduino:renesas_uno", label: "Arduino Uno R4" },
  ];
}

function arduinoCoreAction(appRoot, action, coreId) {
  const emitter = new EventEmitter();
  showArduinoUpdateWindow({ emitter });
  runArduinoCoreAction({ appRoot, coreId, action, emitter });
}

function showInstalledCores(appRoot) {
  const cores = getInstalledCores(appRoot);
  const win = require("electron").BrowserWindow.getFocusedWindow();
  if (cores.length === 0) {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Installed Boards",
      message: "No boards installed.",
    });
    return;
  }
  const list = cores.map((c) => `  - ${c.name ?? c.id} (${c.installed})`).join("\n");
  dialog.showMessageBox(win, {
    type: "info",
    title: "Installed Boards",
    message: `Installed boards:\n${list}`,
  });
}

function setMenu({ win, appRoot, app }) {
  let localLib = [];
  let version = {};
  try {
    localLib = JSON.parse(
      fs.readFileSync(path.join(appRoot, "src/link/tools/localLib.json"), "utf8"),
    );
  } catch (e) {
    logger.warn("Failed to read localLib.json: " + e.message);
  }
  try {
    version = JSON.parse(
      fs.readFileSync(path.join(appRoot, "src/version.json"), "utf8"),
    );
  } catch (e) {
    logger.warn("Failed to read version.json: " + e.message);
  }
  const libary = localLib.map((item, index) => ({
    label: `${index + 1}. ${item}`,
  }));

  const installedCores = getInstalledCores(appRoot);
  const installedIds = installedCores.map((c) => c.id);

  const installSubmenu = getAdditionalCores().map((core) => ({
    label: `Install ${core.label}`,
    click: () => arduinoCoreAction(appRoot, "install", core.id),
  }));

  const uninstallItems = getAdditionalCores()
    .filter((core) => installedIds.includes(core.id))
    .map((core) => ({
      label: `Uninstall ${core.label}`,
      click: () => arduinoCoreAction(appRoot, "uninstall", core.id),
    }));

  if (uninstallItems.length === 0) {
    uninstallItems.push({
      label: "No Board Installed",
      enabled: false,
    });
  }

  const template = [
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },

    {
      label: "Tools",
      submenu: [
        {
          label: "Arduino Board",
          submenu: [
            {
              label: "Install Board",
              submenu: installSubmenu,
            },
            {
              label: "Uninstall Board",
              submenu: uninstallItems,
            },
            { type: "separator" },
            {
              label: "Check Installed Boards",
              click: () => showInstalledCores(appRoot),
            },
          ],
        },
      ],
    },

    {
      label: "Local Library",
      submenu: [
        {
          label: "Add .ZIP Library",
          click: async () => {
            const { dialog } = require("electron");
            const extract = require("extract-zip");
            dialog
              .showOpenDialog({
                properties: ["openFile"],
                filters: [{ name: "Zip", extensions: ["zip"] }],
              })
              .then(async (res) => {
                if (!res.canceled) {
                  try {
                    await extract(res.filePaths[0], {
                      dir: path.join(appRoot, "src/link/tools/Arduino/local"),
                    });
                    await extract(res.filePaths[0], {
                      dir: path.join(
                        appRoot,
                        "src/link/tools/Arduino/libraries",
                      ),
                    });

                    const filesName = [];
                    fs.readdir(
                      path.join(appRoot, "src/link/tools/Arduino/local"),
                      (err, files) => {
                        files.forEach(async (file) => {
                          if (!file.includes(".txt")) {
                            filesName.push(file + ".h");
                          }
                        });
                        fs.writeFileSync(
                          path.join(appRoot, "src/link/tools/localLib.json"),
                          JSON.stringify(filesName),
                        );
                      },
                    );
                    dialog.showMessageBox({
                      type: "info",
                      title: "Success",
                      message: "Add libary success",
                    });
                    // Refresh menu
                    setMenu({ win, appRoot, app });
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
          label: "Check Update",
          click: async () => {
            const { syncGui, syncLink, syncLibrary } = require(
              path.join(appRoot, "src/main/sync"),
            );
            await syncGui(win, appRoot);
            await syncLink(win, appRoot);
            await syncLibrary(appRoot);
          },
        },
        { label: "Version GUI: " + version.gui, enabled: false },
        { label: "Version LINK: " + version.link, enabled: false },
        {
          label: "Sign Out",
          click: async () => {
            try {
              const fsPromise = require("fs").promises;
              const userDataPath = path.join(appRoot, "/data/user.json");
              await fsPromise.writeFile(userDataPath, JSON.stringify({}), {
                encoding: "utf8",
              });
              app.relaunch();
              app.quit();
            } catch (error) {
              console.error("Error during sign out:", error);
            }
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
}

module.exports = { setMenu };
