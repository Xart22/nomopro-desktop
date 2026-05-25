const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Check if an Arduino update is needed.
 * Returns config object if update should run, or null if already installed / missing.
 */
function checkArduinoUpdateNeeded({ toolsPath } = {}) {
  if (!toolsPath) return null;

  const isWin = process.platform === "win32";
  const arduinoDir = path.join(toolsPath, "Arduino");
  const updateJsonPath = path.join(arduinoDir, "update.json");
  const scriptFile = isWin ? "update.bat" : "update.sh";
  const scriptPath = path.join(arduinoDir, scriptFile);
  const shellCmd = isWin ? "cmd.exe" : "/bin/sh";
  const shellArgs = isWin ? ["/c", scriptPath] : [scriptPath];

  if (!fs.existsSync(scriptPath)) {
    logger.error("arduino-updater: script not found at " + scriptPath);
    return null;
  }

  try {
    if (fs.existsSync(updateJsonPath)) {
      const data = JSON.parse(fs.readFileSync(updateJsonPath, "utf8"));
      if (data.installed) {
        logger.info("arduino-updater: Arduino tools already installed, skipping");
        return null;
      }
    }
  } catch (e) {
    logger.warn("arduino-updater: failed to read update.json, will re-run: " + e.message);
  }

  return { arduinoDir, scriptPath, shellCmd, shellArgs, updateJsonPath };
}

/**
 * Start the Arduino update process.
 * Emits events on the provided emitter:
 *   - "start"              when process begins
 *   - "progress" {message}  per stdout/stderr line
 *   - "complete"            process exited with 0
 *   - "error"   {message}   process error or non-zero exit
 */
function startArduinoUpdate({ emitter, arduinoDir, shellCmd, shellArgs, updateJsonPath } = {}) {
  if (!emitter) return;

  const child = spawn(shellCmd, shellArgs, {
    windowsHide: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: arduinoDir,
  });

  emitter.emit("start");

  child.stdout.on("data", (chunk) => {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        emitter.emit("progress", { message: line.trimEnd() });
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        emitter.emit("progress", { message: line.trimEnd() });
      }
    }
  });

  child.on("error", (err) => {
    logger.error("arduino-updater: spawn error: " + err.message);
    emitter.emit("error", { message: err.message });
  });

  child.on("close", (code) => {
    if (code === 0) {
      try {
        fs.writeFileSync(updateJsonPath, JSON.stringify({ installed: true }));
        logger.info("arduino-updater: update complete, marked as installed");
      } catch (e) {
        logger.error("arduino-updater: failed to write update.json: " + e.message);
      }
      emitter.emit("complete");
    } else {
      const msg = `update script exited with code ${code}`;
      logger.error("arduino-updater: " + msg);
      emitter.emit("error", { message: msg });
    }
  });
}

/**
 * Run arduino-cli core install/uninstall with progress events.
 * Emits:
 *   - "start"              when process begins
 *   - "progress" {message}  per stdout/stderr line
 *   - "complete"            process exited with 0
 *   - "error"   {message}   process error or non-zero exit
 */
function runArduinoCoreAction({ appRoot, coreId, action, emitter } = {}) {
  if (!emitter || !coreId) return;

  const isWin = process.platform === "win32";
  const arduinoDir = path.resolve(appRoot, "src/link/tools/Arduino");
  const cli = path.join(arduinoDir, isWin ? "arduino-cli.exe" : "arduino-cli");
  const cfg = path.join(arduinoDir, "arduino-cli.yaml");

  const child = spawn(cli, ["core", action, coreId, "--config-file", cfg], {
    windowsHide: isWin,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: arduinoDir,
  });

  emitter.emit("start");

  child.stdout.on("data", (chunk) => {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        emitter.emit("progress", { message: line.trimEnd() });
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        emitter.emit("progress", { message: line.trimEnd() });
      }
    }
  });

  child.on("error", (err) => {
    logger.error("arduino-core: spawn error: " + err.message);
    emitter.emit("error", { message: err.message });
  });

  child.on("close", (code) => {
    if (code === 0) {
      emitter.emit("complete");
    } else {
      emitter.emit("error", { message: `${action} ${coreId} exited with code ${code}` });
    }
  });
}

module.exports = { checkArduinoUpdateNeeded, startArduinoUpdate, runArduinoCoreAction };
