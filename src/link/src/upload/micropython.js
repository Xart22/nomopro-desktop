const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { SerialPort } = require("serialport");
const ansi = require("ansi-string");
const os = require("os");

const DEFAULT_BAUD = 115200;
const FLASH_BAUD = 460800;

const FIRMWARE = {
  esp32: {
    file: "ESP32_GENERIC-20240105-v1.22.1.bin",
    flashOffset: "0x1000",
  },
  esp8266: {
    file: "ESP8266_GENERIC-20260406-v1.28.0.bin",
    flashOffset: "0x0",
  },
  rpi_pico: {
    file: "RPI_PICO-20240105-v1.22.1.uf2",
  },
};

class MicroPython {
  constructor(peripheralPath, config, userDataPath, toolsPath, sendstd) {
    const normalized = this._normalizePortPath(peripheralPath);
    console.log(
      "[MicroPython] raw:",
      peripheralPath,
      "normalized:",
      normalized,
    );
    this._peripheralPath = normalized;
    this._config = config || {};
    this._userDataPath = userDataPath;
    this._toolsPath = toolsPath;
    this._sendstd = sendstd;

    this._pythonPath = path.join(toolsPath, "Python");
    const isWin = os.platform() === "win32";
    this._esptoolPath = path.join(
      this._pythonPath,
      "Scripts",
      "esptool" + (isWin ? ".exe" : ""),
    );

    if (os.platform() === "darwin") {
      this._pyPath = path.join(this._pythonPath, "python3");
    } else if (os.platform() === "linux") {
      this._pyPath = path.join(this._pythonPath, "bin", "python3");
    } else {
      this._pyPath = path.join(
        this._pythonPath,
        "python" + (isWin ? ".exe" : ""),
      );
    }

    this._firmwareDir = path.join(
      userDataPath,
      "link",
      "firmwares",
      "micropython",
    );
    if (!fs.existsSync(this._firmwareDir)) {
      fs.mkdirSync(this._firmwareDir, { recursive: true });
    }

    this._abort = false;
  }

  _normalizePortPath(pathOrName) {
    if (!pathOrName) return pathOrName;
    const match = pathOrName.match(/\((COM\d+)\)/i);
    if (match) return match[1];
    return pathOrName;
  }

  static get FIRMWARE() {
    return FIRMWARE;
  }

  abortUpload() {
    this._abort = true;
  }

  // =================================================================
  // FIRMWARE DETECTION
  // =================================================================

  async detectFirmware(portPath, baudRate) {
    const rate = baudRate || DEFAULT_BAUD;
    this._sendstd(`Probing ${portPath} at ${rate} baud...\n`);
    try {
      const port = new SerialPort({
        path: portPath,
        baudRate: rate,
        autoOpen: false,
      });
      await this._openPort(port);

      await this._sendRaw(port, "\r\x03");
      await this._sleep(200);
      await this._sendRaw(port, "\x03");
      await this._sleep(200);
      await this._sendRaw(port, "\r\x02");
      await this._sleep(500);

      const response = await this._readAvailable(port, 1500);
      await this._closePort(port);

      if (response.includes("MicroPython")) {
        const m = response.match(/MicroPython\s+v?([\d.]+)/);
        this._sendstd(
          `${ansi.green_dark}MicroPython ${m ? m[1] : ""} detected\n`,
        );
        return {
          installed: true,
          type: "micropython",
          version: m ? m[1] : "unknown",
        };
      }
      if (response.includes("Arduino") || response.includes("ready")) {
        this._sendstd(`${ansi.yellow_dark}Arduino/Firmata firmware detected\n`);
        return { installed: true, type: "arduino" };
      }
      this._sendstd("No known firmware detected\n");
      return { installed: false, type: "unknown" };
    } catch (err) {
      this._sendstd(`${ansi.red}Detection error: ${err.message}\n`);
      return { installed: false, type: "error", error: err.message };
    }
  }

  // =================================================================
  // MAIN ENTRY: Flash + Upload (called from serialport.js)
  // =================================================================

  async flashFirmwareAndUpload(code) {
    const board = this._config.board || "esp32";

    // First, try to flash firmware
    if (board === "esp32" || board === "esp8266") {
      await this.flashWithEsptool(board);
    } else if (board === "rpi_pico") {
      await this.flashPicoUF2();
    }

    // Wait for board to reboot
    this._sendstd(`${ansi.clear}Waiting for board to reboot...\n`);
    await this._sleep(5000);

    // Upload code via raw REPL
    await this.uploadCode(code);
  }

  async uploadCode(code) {
    const baudRate = this._config.baudRate || DEFAULT_BAUD;
    const fileName = this._config.fileName || "main.py";

    const port = new SerialPort({
      path: this._peripheralPath,
      baudRate: baudRate,
      autoOpen: false,
    });
    await this._openPort(port);

    try {
      await this._enterRawREPL(port);

      this._sendstd(`Uploading ${code.length} bytes -> ${fileName}...\n`);
      const uploadScript = this._buildUploadScript(code, fileName);
      await this._sendRaw(port, uploadScript);
      await this._sendRaw(port, "\x04");

      const response = await this._readUntil(port, "UPLOAD_OK", 15000);
      if (!response.includes("UPLOAD_OK")) {
        throw new Error("Upload failed: no UPLOAD_OK response");
      }

      this._sendstd(`${ansi.green_dark}Upload complete!\n`);
      return { success: true, fileName };
    } finally {
      await this._closePort(port);
    }
  }

  _buildUploadScript(code, fileName) {
    const safe = code
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r\n/g, "\\n")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\n");

    return `import os\r\nf=open('${fileName}','w')\r\nf.write('${safe}')\r\nf.close()\r\nprint('UPLOAD_OK')\r\n`;
  }

  // =================================================================
  // ESP32/ESP8266 FLASH — esptool.py
  // =================================================================

  async flashWithEsptool(chip) {
    const info = this._config.firmwareInfo || FIRMWARE[chip] || FIRMWARE.esp32;
    const firmwarePath = await this._downloadFirmware(null, info.file);
    const offset = this._config.flashOffset || info.flashOffset || "0x1000";
    const baud = chip === "esp32" ? FLASH_BAUD : 115200;

    this._sendstd(
      `${chip.toUpperCase()} flash: python=${this._pyPath} esptool=${this._esptoolPath} port=${this._peripheralPath}\n`,
    );
    this._sendstd(
      `Waiting 10 seconds for port to be released by Link server...\n`,
    );
    await new Promise((r) => setTimeout(r, 10000));

    this._sendstd(`${ansi.clear}Erasing ${chip.toUpperCase()} flash...\n`);
    await this._spawnEsptool([
      "--chip",
      "auto",
      "--port",
      this._peripheralPath,
      "--baud",
      baud.toString(),
      "--before",
      "default_reset",
      "--after",
      "hard_reset",
      "erase_flash",
    ]);

    this._sendstd(
      `${ansi.green_dark}Writing MicroPython firmware (1-2 min)...\n`,
    );
    await this._spawnEsptool([
      "--chip",
      "auto",
      "--port",
      this._peripheralPath,
      "--baud",
      baud.toString(),
      "--before",
      "default_reset",
      "--after",
      "hard_reset",
      "write_flash",
      "-z",
      offset,
      firmwarePath,
    ]);

    this._sendstd(`${ansi.green_dark}${chip.toUpperCase()} firmware flashed!\n`);
  }

  // =================================================================
  // PI PICO FLASH — UF2 copy to RPI-RP2 drive
  // =================================================================

  async flashPicoUF2() {
    this._sendstd(
      `${ansi.yellow_dark}Looking for Pi Pico in bootloader mode...\n`,
    );

    let rpiDrive = this._detectRpiRp2Drive();

    if (!rpiDrive) {
      this._sendstd(`${ansi.clear}Trying to enter bootloader via serial...\n`);
      try {
        await this._sendMachineBootloader();
        for (let i = 0; i < 20; i++) {
          await this._sleep(1000);
          rpiDrive = this._detectRpiRp2Drive();
          if (rpiDrive) break;
        }
      } catch (e) {
        this._sendstd(`${ansi.yellow_dark}Auto bootloader entry failed.\n`);
      }
    }

    if (!rpiDrive) {
      throw new Error(
        "Pi Pico not in bootloader mode. Hold BOOTSEL on the board, reconnect USB, and try again.",
      );
    }

    const info = this._config.firmwareInfo || FIRMWARE.rpi_pico;
    const firmwarePath = await this._downloadFirmware(null, info.file);

    this._sendstd(`${ansi.green_dark}Copying firmware to ${rpiDrive}...\n`);
    const dest = path.join(rpiDrive, path.basename(firmwarePath));
    fs.copyFileSync(firmwarePath, dest);

    this._sendstd(`${ansi.clear}Board rebooting...\n`);
    await this._sleep(3000);

    this._sendstd(`${ansi.green_dark}Pi Pico firmware flashed!\n`);
  }

  _detectRpiRp2Drive() {
    if (os.platform() === "win32") {
      const letters = "DEFGHIJKLMNOPQRSTUVWXYZ".split("");
      for (const letter of letters) {
        const drive = `${letter}:\\`;
        try {
          const files = fs.readdirSync(drive);
          if (files.includes("INFO_UF2.TXT")) return drive;
        } catch (e) {
          /* skip */
        }
      }
    } else if (os.platform() === "darwin") {
      const candidates = ["/Volumes/RPI-RP2/", "/Volumes/RPI-RP2"];
      for (const p of candidates) {
        try {
          fs.accessSync(p);
          return p;
        } catch (e) {}
      }
    } else {
      const username = os.userInfo().username;
      const candidates = [
        `/media/${username}/RPI-RP2/`,
        `/media/${username}/RPI-RP2`,
        "/mnt/RPI-RP2/",
      ];
      for (const p of candidates) {
        try {
          fs.accessSync(p);
          return p;
        } catch (e) {}
      }
    }
    return null;
  }

  async _sendMachineBootloader() {
    const port = new SerialPort({
      path: this._peripheralPath,
      baudRate: DEFAULT_BAUD,
      autoOpen: false,
    });
    await this._openPort(port);
    try {
      await this._sendRaw(port, "\r\x03");
      await this._sleep(200);
      await this._sendRaw(port, "\x03");
      await this._sleep(200);
      await this._sendRaw(port, "import machine\r\nmachine.bootloader()\r\n");
      await this._sleep(500);
    } finally {
      await this._closePort(port);
    }
  }

  // =================================================================
  // HELPERS
  // =================================================================

  _openPort(port) {
    return new Promise((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });
  }

  _closePort(port) {
    return new Promise((resolve) => {
      if (!port.isOpen) return resolve();
      port.close(() => resolve());
    });
  }

  _sendRaw(port, data) {
    return new Promise((resolve, reject) => {
      port.write(data, (err) => (err ? reject(err) : resolve()));
      port.drain(() => {});
    });
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async _enterRawREPL(port) {
    await this._sendRaw(port, "\r\x03");
    await this._sleep(200);
    await this._sendRaw(port, "\x03");
    await this._sleep(200);
    await this._sendRaw(port, "\x01");
    await this._sleep(300);
  }

  _readAvailable(port, timeout) {
    return new Promise((resolve) => {
      let buf = "";
      const t = setTimeout(() => {
        port.removeAllListeners("data");
        resolve(buf);
      }, timeout);
      port.on("data", (d) => {
        buf += d.toString();
        clearTimeout(t);
        setTimeout(() => resolve(buf), 200);
      });
    });
  }

  _readUntil(port, marker, timeout) {
    return new Promise((resolve, reject) => {
      let buf = "";
      const t = setTimeout(() => {
        port.removeAllListeners("data");
        reject(new Error(`Timeout waiting for "${marker}"`));
      }, timeout);
      port.on("data", (d) => {
        buf += d.toString();
        if (buf.includes(marker)) {
          clearTimeout(t);
          port.removeAllListeners("data");
          resolve(buf);
        }
      });
    });
  }

  async _downloadFirmware(url, filename) {
    // 1. Cek bundled firmware (shipped with app)
    const bundledPath = path.join(
      __dirname,
      "../../firmwares/micropython",
      filename,
    );
    if (fs.existsSync(bundledPath)) {
      this._sendstd(`Using bundled firmware: ${filename}\n`);
      return bundledPath;
    }

    // 2. Cek cache di userData
    const localPath = path.join(this._firmwareDir, filename);
    if (fs.existsSync(localPath)) {
      this._sendstd(`Using cached firmware: ${filename}\n`);
      return localPath;
    }

    // 3. Fallback: download if url provided
    if (url) {
      this._sendstd(`Downloading ${filename}...\n`);
      const fetch = require("node-fetch").default || require("node-fetch");
      const response = await fetch(url);
      fs.writeFileSync(localPath, await response.buffer());
      this._sendstd(`${ansi.green_dark}Download complete\n`);
      return localPath;
    }

    throw new Error(`Firmware not found: ${filename}`);
  }

  _spawnEsptool(args) {
    return new Promise(async (resolve, reject) => {
      const maxAttempts = 5;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this._sendstd(
            `[esptool] Attempt ${attempt}/${maxAttempts}: ${this._pyPath} ${this._esptoolPath} ${args.join(" ")}\n`,
          );
          const result = await this._trySpawn(args);
          return resolve(result);
        } catch (err) {
          lastError = err;
          const msg = err.message || "";
          const isPortBusy =
            msg.includes("Access is denied") ||
            msg.includes("Permission denied") ||
            msg.includes("could not open port");

          if (isPortBusy && attempt < maxAttempts) {
            const waitMs = attempt * 2000;
            this._sendstd(
              `[esptool] Port busy (${msg}), retrying in ${waitMs / 1000}s...\n`,
            );
            await new Promise((r) => setTimeout(r, waitMs));
          } else {
            return reject(err);
          }
        }
      }
    });
  }

  _trySpawn(args) {
    return new Promise((resolve, reject) => {
      let out = "";
      const proc = spawn(this._pyPath, [this._esptoolPath, ...args]);
      proc.stdout.on("data", (d) => {
        const t = d.toString();
        out += t;
        this._sendstd(t);
      });
      proc.stderr.on("data", (d) => {
        const t = d.toString();
        out += t;
        this._sendstd(`[stderr] ${t}`);
      });
      proc.on("error", (err) => {
        reject(new Error(`Failed to start esptool: ${err.message}`));
      });
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(out);
        } else {
          const tail = out.slice(-800).replace(/\r/g, "");
          reject(new Error(`esptool exit ${code}\n${tail}`));
        }
      });
    });
  }
}

module.exports = MicroPython;
