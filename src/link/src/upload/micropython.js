const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { SerialPort } = require("serialport");
const ansi = require("ansi-string");
const os = require("os");
const traceLog = require("../lib/trace-log");

const DEFAULT_BAUD = 115200;
const FLASH_BAUD = 460800;
// MicroPython raw REPL input buffer ~256 byte. Chunk 128 raw byte ->
// ~171 char base64 -> aman di bawah batas buffer input.
const CHUNK_BYTES = 128;

const FIRMWARE = {
  esp32: {
    file: "ESP32_GENERIC-20260406-v1.28.0.bin",
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

    traceLog.startSession(
      `MicroPython instance created — port=${normalized} config=${JSON.stringify(this._config)}`,
    );
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
    traceLog.trace("detectFirmware", `START port=${portPath} baud=${rate}`);
    try {
      const port = new SerialPort({
        path: portPath,
        baudRate: rate,
        autoOpen: false,
      });
      port.on("error", (e) =>
        traceLog.trace("detectFirmware", `PORT ERROR EVENT: ${e.message}`),
      );
      await this._openPort(port, "detectFirmware");

      await this._sendRaw(port, "\r\x03");
      await this._sleep(200);
      await this._sendRaw(port, "\x03");
      await this._sleep(200);
      await this._sendRaw(port, "\r\x02");
      await this._sleep(500);

      const response = await this._readAvailable(port, 1500);
      await this._closePort(port, "detectFirmware");

      traceLog.trace("detectFirmware", "DONE");

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
      traceLog.trace("detectFirmware", `ERROR: ${err.message}`);
      this._sendstd(`${ansi.red}Detection error: ${err.message}\n`);
      return { installed: false, type: "error", error: err.message };
    }
  }

  // =================================================================
  // UPLOAD CODE — raw REPL (backend, port eksklusif)
  // =================================================================

  async uploadFiles(files, folders) {
    const fileList = files || [];
    if (fileList.length === 0) {
      throw new Error("no files to upload");
    }
    const folderList = folders || [];
    const baud = this._config.baudRate || DEFAULT_BAUD;
    this._sendstd(
      `${ansi.clear}Opening port ${this._peripheralPath} at ${baud} baud...\n`,
    );

    const port = new SerialPort({
      path: this._peripheralPath,
      baudRate: baud,
      autoOpen: false,
    });
    port.on("error", (e) =>
      traceLog.trace("uploadFiles", `PORT ERROR EVENT: ${e.message}`),
    );

    try {
      await this._openPort(port, "uploadFiles");
      await this._enterRawRepl(port);
      await this._execRaw(port, "import binascii");

      for (const folder of folderList) {
        this._sendstd(`mkdir: ${folder}\n`);
        await this._execRaw(
          port,
          `try:\n import os; os.mkdir('${folder}')\nexcept: pass`,
        );
      }

      for (const file of fileList) {
        this._sendstd(`Writing ${file.path}\n`);
        // Truncate sekali, lalu append chunk kecil (1024 byte) dengan flow
        // control terminator \x04 per chunk. Kirim utuh 20KB membanjiri UART
        // RX ESP32 -> file kosong. Chunk kecil + waitForMarker aman.
        await this._execRaw(port, `open('${file.path}','wb').close()`);

        const b64 = this._toBase64(file.content);
        const chunks = this._chunkBase64(b64, CHUNK_BYTES);
        for (let c = 0; c < chunks.length; c++) {
          await this._execRaw(
            port,
            `f=open('${file.path}','ab');f.write(binascii.a2b_base64('${chunks[c]}'));f.close()`,
            30000,
          );
          if ((c + 1) % 10 === 0) {
            await this._execRaw(port, "import gc;gc.collect()");
          }
        }
      }

      // Keluar raw REPL dengan soft reset \x02: kembali ke friendly REPL dan
      // auto-run main.py. Output main.py terbaca di _readAndSend (log upload).
      await this._sendRaw(port, "\x02");
      await this._readAndSend(port, 3000);
      this._sendstd(`${ansi.green_dark}Upload complete\n`);
    } finally {
      await this._closePort(port, "uploadFiles");
    }
  }

  // Baca output device selama durasi tertentu dan kirim ke FE via _sendstd.
  // Dipakai setelah soft reset agar output main.py terlihat user.
  _readAndSend(port, durationMs) {
    return new Promise((resolve) => {
      let buf = "";
      let idleTimer = null;
      let hardTimer = null;
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        if (idleTimer) clearTimeout(idleTimer);
        if (hardTimer) clearTimeout(hardTimer);
        port.removeListener("data", onData);
        resolve(buf);
      };

      const onData = (d) => {
        const text = d.toString("utf-8");
        buf += text;
        this._sendstd(text);
        // Hentikan lebih awal kalau 800ms tanpa data (program selesai).
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, 800);
      };

      port.on("data", onData);
      // Batas maksimal — jangan gantung kalau output deras terus.
      hardTimer = setTimeout(finish, durationMs);
    });
  }

  _toBase64(str) {
    return Buffer.from(str, "utf-8").toString("base64");
  }

  _chunkBase64(b64, chunkBytes) {
    const charCount = Math.floor(chunkBytes / 3) * 4;
    const chunks = [];
    for (let i = 0; i < b64.length; i += charCount) {
      chunks.push(b64.slice(i, i + charCount));
    }
    return chunks;
  }

  async _enterRawRepl(port) {
    this._readBuffer = "";
    // Soft reset ke friendly REPL dulu — kalau device masih dalam raw mode
    // dari sesi sebelumnya, Ctrl+A tidak memunculkan banner "raw REPL"
    // (hanya prompt ">"), sehingga tunggu banner pasti timeout.
    await this._sendRaw(port, "\x02");
    await this._sleep(500);
    await this._sendRaw(port, "\r\x03");
    await this._sleep(200);
    await this._sendRaw(port, "\x03");
    await this._sleep(200);
    await this._sendRaw(port, "\x01");
    await this._readUntilMarker(port, "raw REPL", 3000);
  }

  async _execRaw(port, command, timeoutMs = 15000) {
    // Buang sisa buffer sebelum kirim. Marker \x04 sisa dari perintah
    // sebelumnya membuat waitForMarker resolve prematur -> chunk tertukar
    // dan file kacau.
    this._readBuffer = "";
    await this._sendRaw(port, `${command}\x04`);
    await this._readUntilMarker(port, "\x04", timeoutMs);
  }

  _readUntilAnyMarker(port, markers, timeoutMs) {
    return new Promise((resolve, reject) => {
      const findIdx = (buf) => {
        let best = -1;
        let bestMarker = null;
        for (const m of markers) {
          const i = buf.indexOf(m);
          if (i >= 0 && (best === -1 || i < best)) {
            best = i;
            bestMarker = m;
          }
        }
        return { idx: best, marker: bestMarker };
      };

      const buf = this._readBuffer || "";
      const found = findIdx(buf);
      if (found.idx >= 0) {
        this._readBuffer = buf.substring(found.idx + found.marker.length);
        return resolve();
      }

      const onData = (d) => {
        const chunk = d.toString("utf-8");
        this._readBuffer = (this._readBuffer || "") + chunk;
        const hit = findIdx(this._readBuffer);
        if (hit.idx >= 0) {
          cleanup();
          this._readBuffer = this._readBuffer.substring(
            hit.idx + hit.marker.length,
          );
          resolve();
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout menunggu marker ${JSON.stringify(markers)}`));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        port.removeListener("data", onData);
      };
      port.on("data", onData);
    });
  }

  _readUntilMarker(port, marker, timeoutMs) {
    return this._readUntilAnyMarker(port, [marker], timeoutMs);
  }

  // =================================================================
  // ESP32/ESP8266 FLASH — esptool.py
  // =================================================================

  async flashWithEsptool(chip) {
    const info = this._config.firmwareInfo || FIRMWARE[chip] || FIRMWARE.esp32;
    const firmwarePath = await this._downloadFirmware(null, info.file);
    const offset = this._config.flashOffset || info.flashOffset || "0x1000";
    const baud = chip === "esp32" ? FLASH_BAUD : 115200;

    traceLog.trace(
      "flashWithEsptool",
      `START chip=${chip} port=${this._peripheralPath} baud=${baud} offset=${offset}`,
    );

    this._sendstd(
      `${chip.toUpperCase()} flash: python=${this._pyPath} esptool=${this._esptoolPath} port=${this._peripheralPath}\n`,
    );
    this._sendstd(
      `Waiting 10 seconds for port to be released by Link server...\n`,
    );
    await new Promise((r) => setTimeout(r, 10000));

    this._sendstd(`${ansi.clear}Erasing ${chip.toUpperCase()} flash...\n`);
    traceLog.trace(
      "flashWithEsptool",
      "Calling esptool erase_flash (--after no_reset)",
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
      "no_reset",
      "erase_flash",
    ]);
    traceLog.trace("flashWithEsptool", "erase_flash finished OK");

    this._sendstd(
      `${ansi.green_dark}Writing MicroPython firmware (1-2 min)...\n`,
    );
    traceLog.trace(
      "flashWithEsptool",
      "Calling esptool write_flash (--after hard_reset)",
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
    traceLog.trace("flashWithEsptool", "write_flash finished OK — DONE");

    this._sendstd(
      `${ansi.green_dark}${chip.toUpperCase()} firmware flashed!\n`,
    );
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
    port.on("error", (e) =>
      traceLog.trace(
        "_sendMachineBootloader",
        `PORT ERROR EVENT: ${e.message}`,
      ),
    );
    await this._openPort(port, "_sendMachineBootloader");
    try {
      await this._sendRaw(port, "\r\x03");
      await this._sleep(200);
      await this._sendRaw(port, "\x03");
      await this._sleep(200);
      await this._sendRaw(port, "import machine\r\nmachine.bootloader()\r\n");
      await this._sleep(500);
    } finally {
      await this._closePort(port, "_sendMachineBootloader");
    }
  }

  // =================================================================
  // HELPERS
  // =================================================================

  _openPort(port, caller = "?") {
    return this._openPortWithRetry(port, caller, 0);
  }

  // "Access denied" right after a port was just closed elsewhere is a known
  // Windows COM-port quirk — the OS sometimes needs a brief moment to fully
  // release the handle. Retry a couple of times with a short delay before
  // giving up, instead of failing instantly on the first attempt.
  _openPortWithRetry(port, caller, attempt) {
    const maxAttempts = 3;
    const retryDelayMs = 400;
    traceLog.trace(
      "_openPort",
      `[${caller}] opening ${port.path || this._peripheralPath}... (attempt ${attempt + 1}/${maxAttempts})`,
    );
    return new Promise((resolve, reject) => {
      port.open(async (err) => {
        if (err) {
          const isAccessDenied = /access.*denied|access is denied/i.test(
            err.message || "",
          );
          traceLog.trace(
            "_openPort",
            `[${caller}] OPEN FAILED: ${err.message}`,
          );
          if (isAccessDenied && attempt + 1 < maxAttempts) {
            traceLog.trace(
              "_openPort",
              `[${caller}] Access denied, retrying in ${retryDelayMs}ms...`,
            );
            await this._sleep(retryDelayMs);
            try {
              await this._openPortWithRetry(port, caller, attempt + 1);
              resolve();
            } catch (retryErr) {
              reject(retryErr);
            }
            return;
          }
          return reject(err);
        }
        traceLog.trace(
          "_openPort",
          `[${caller}] OPEN OK (attempt ${attempt + 1})`,
        );
        resolve();
      });
    });
  }

  _closePort(port, caller = "?") {
    return new Promise((resolve) => {
      if (!port.isOpen) {
        traceLog.trace("_closePort", `[${caller}] already closed`);
        return resolve();
      }
      traceLog.trace("_closePort", `[${caller}] closing...`);
      port.close(() => {
        traceLog.trace("_closePort", `[${caller}] CLOSED`);
        resolve();
      });
    });
  }

  _sendRaw(port, data) {
    return new Promise((resolve, reject) => {
      port.write(data, (err) => {
        if (err) {
          traceLog.trace("_sendRaw", `write ERROR: ${err.message}`);
          return reject(err);
        }
        port.drain((drainErr) => {
          if (drainErr) {
            traceLog.trace("_sendRaw", `drain ERROR: ${drainErr.message}`);
            return reject(drainErr);
          }
          resolve();
        });
      });
    });
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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
          traceLog.trace(
            "_spawnEsptool",
            `attempt ${attempt}/${maxAttempts}: ${args.join(" ")}`,
          );
          const result = await this._trySpawn(args);
          return resolve(result);
        } catch (err) {
          lastError = err;
          const msg = err.message || "";
          traceLog.trace("_spawnEsptool", `attempt ${attempt} FAILED: ${msg}`);
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
        traceLog.trace("_trySpawn", `spawn ERROR: ${err.message}`);
        reject(new Error(`Failed to start esptool: ${err.message}`));
      });
      proc.on("close", (code) => {
        traceLog.trace(
          "_trySpawn",
          `esptool process closed, exit code=${code}`,
        );
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
