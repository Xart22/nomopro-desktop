// Crash-safe trace logger.
//
// Uses fs.appendFileSync (synchronous, immediately flushed to disk) instead
// of normal async logging, specifically so that if Windows BSODs mid-upload,
// every step logged BEFORE the crash is guaranteed to already be on disk —
// letting us see exactly which operation was last attempted.
//
// Log file lives in %TEMP% so it's easy to find after a reboot:
//   C:\Users\<you>\AppData\Local\Temp\nomokit-upload-trace.log

const fs = require("fs");
const path = require("path");
const os = require("os");

const LOG_PATH = path.join(os.tmpdir(), "nomokit-upload-trace.log");

function trace(tag, msg) {
  const line = `[${new Date().toISOString()}] [${tag}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch (e) {
    // If even this fails, there's nothing more we can do — don't throw,
    // logging must never break the actual upload/flash flow.
  }
}

/** Call once at app startup to start each run in a fresh, clearly marked section. */
function startSession(label) {
  try {
    fs.appendFileSync(
      LOG_PATH,
      `\n${"=".repeat(60)}\n[SESSION START ${new Date().toISOString()}] ${label || ""}\n${"=".repeat(60)}\n`,
    );
  } catch (e) {
    // ignore
  }
}

function getLogPath() {
  return LOG_PATH;
}

module.exports = { trace, startSession, getLogPath };
