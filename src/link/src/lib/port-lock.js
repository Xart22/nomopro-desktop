// Simple in-process registry so different subsystems that can each open a
// SerialPort (the WebSocket-based SerialportSession used for live connect /
// serial monitor, and the direct IPC handlers in main.js used for
// upload/flash/input) never open the SAME COM port at the same time.
//
// Opening a given COM port twice from the same Node process is exactly the
// kind of race that can destabilize a flaky USB-to-serial kernel driver on
// Windows (WDF_VIOLATION / BSOD). This module doesn't touch the OS driver at
// all — it just makes sure our own app never attempts it.

const traceLog = require("./trace-log");

const locks = new Map(); // normalizedPath -> { owner, since }

function normalize(portPath) {
  if (!portPath) return portPath;
  const match = String(portPath).match(/\((COM\d+)\)/i);
  return (match ? match[1] : portPath).toUpperCase();
}

/**
 * Try to acquire the lock for a port.
 * @returns {boolean} true if acquired, false if already held by someone else
 */
function acquire(portPath, owner) {
  const key = normalize(portPath);
  const existing = locks.get(key);
  if (existing && existing.owner !== owner) {
    traceLog.trace(
      "port-lock",
      `ACQUIRE DENIED for ${key} by "${owner}" — already held by "${existing.owner}" since ${new Date(existing.since).toISOString()}`,
    );
    return false;
  }
  locks.set(key, { owner, since: Date.now() });
  traceLog.trace("port-lock", `ACQUIRED ${key} by "${owner}"`);
  return true;
}

function release(portPath, owner) {
  const key = normalize(portPath);
  const existing = locks.get(key);
  if (existing && existing.owner === owner) {
    locks.delete(key);
    traceLog.trace("port-lock", `RELEASED ${key} by "${owner}"`);
  }
}

function whoHolds(portPath) {
  const key = normalize(portPath);
  const existing = locks.get(key);
  return existing ? existing.owner : null;
}

module.exports = { acquire, release, whoHolds };
