const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const MOCHA = path.join(ROOT, "node_modules", "mocha", "bin", "mocha");

console.log("=== nomopro-desktop test suite ===\n");
let exitCode = 0;

// 1. Basic module exports validation (can't require Electron modules from plain Node)
console.log("--- Module export validation ---");
try {
  // We can test pure Node modules (no Electron dependency)
  const ipc = require("../src/main/ipc");
  const logger = require("../src/main/logger");
  const sync = require("../src/main/sync");

  require("assert").equal(typeof ipc.registerIpc, "function");
  require("assert").equal(typeof logger.info, "function");
  require("assert").equal(typeof logger.warn, "function");
  require("assert").equal(typeof logger.error, "function");
  require("assert").equal(typeof sync.syncLibrary, "function");
  require("assert").equal(typeof sync.syncGui, "function");
  require("assert").equal(typeof sync.syncLink, "function");

  // Verify new IPC file storage handlers are registered in ipc.js
  const ipcSource = fs.readFileSync(path.join(ROOT, "src/main/ipc.js"), "utf8");
  require("assert").ok(
    ipcSource.includes("file-storage-save"),
    "ipc.js must register file-storage-save handler",
  );
  require("assert").ok(
    ipcSource.includes("file-storage-read"),
    "ipc.js must register file-storage-read handler",
  );
  require("assert").ok(
    ipcSource.includes("file-storage-list"),
    "ipc.js must register file-storage-list handler",
  );
  require("assert").ok(
    ipcSource.includes("file-storage-delete"),
    "ipc.js must register file-storage-delete handler",
  );
  require("assert").ok(
    ipcSource.includes("getDefaultStorageDir"),
    "ipc.js must define getDefaultStorageDir",
  );
  require("assert").ok(
    ipcSource.includes("Documents/OpenBlock"),
    "ipc.js must use Documents/OpenBlock path",
  );

  // Verify main.js has the critical fixes
  const mainSource = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  require("assert").ok(
    mainSource.includes("getPythonCandidates"),
    "main.js must use getPythonCandidates",
  );
  require("assert").ok(
    mainSource.includes("PYTHON_EXECUTION_TIMEOUT_MS"),
    "main.js must have timeout guard",
  );
  require("assert").ok(
    mainSource.includes("proc.on(\"error\"") || mainSource.includes("proc.on('error'"),
    "main.js must have error handler for spawn",
  );
  require("assert").ok(
    mainSource.includes("Python health check"),
    "main.js must have health check",
  );

  // Verify preload.js has the right API contracts
  const preloadSource = fs.readFileSync(path.join(ROOT, "preload.js"), "utf8");
  require("assert").ok(
    preloadSource.includes("platformInfo"),
    "preload.js must expose platformInfo",
  );
  require("assert").ok(
    preloadSource.includes("nomoproDesktopPython"),
    "preload.js must expose nomoproDesktopPython",
  );
  require("assert").ok(
    preloadSource.includes("fileStorage"),
    "preload.js must expose fileStorage API",
  );

  console.log("  ✓ All module exports and source contracts verified");
} catch (e) {
  console.error("  ✗ Validation failed:", e.message);
  exitCode = 1;
}

// 2. Unit tests: Python runner
console.log("\n--- Python runner unit tests ---");
if (fs.existsSync(MOCHA)) {
  const pyResult = spawnSync(
    process.execPath,
    [MOCHA, path.join(__dirname, "unit", "python-runner.test.js")],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ROOT,
    },
  );
  if (pyResult.status === 0) {
    console.log(pyResult.stdout
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => "  " + l)
      .join("\n"));
  } else {
    console.error(pyResult.stdout);
    console.error(pyResult.stderr);
    exitCode = 1;
  }
} else {
  console.log("  ⚠ mocha not found, skipping Python runner tests");
}

// 3. Unit tests: File storage
console.log("\n--- File storage unit tests ---");
if (fs.existsSync(MOCHA)) {
  const stResult = spawnSync(
    process.execPath,
    [MOCHA, path.join(__dirname, "unit", "file-storage.test.js")],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ROOT,
    },
  );
  if (stResult.status === 0) {
    console.log(stResult.stdout
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => "  " + l)
      .join("\n"));
  } else {
    console.error(stResult.stdout);
    console.error(stResult.stderr);
    exitCode = 1;
  }
} else {
  console.log("  ⚠ mocha not found, skipping file storage tests");
}

// 4. Unit tests: Pip manager
console.log("\n--- Pip manager unit tests ---");
if (fs.existsSync(MOCHA)) {
  const pipResult = spawnSync(
    process.execPath,
    [MOCHA, path.join(__dirname, "unit", "pip-manager.test.js")],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ROOT,
    },
  );
  if (pipResult.status === 0) {
    console.log(pipResult.stdout
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => "  " + l)
      .join("\n"));
  } else {
    console.error(pipResult.stdout);
    console.error(pipResult.stderr);
    exitCode = 1;
  }
} else {
  console.log("  ⚠ mocha not found, skipping pip manager tests");
}

// 5. Source contract validation for pip
console.log("\n--- Pip source contract validation ---");
try {
  const pipSource = fs.readFileSync(path.join(ROOT, "src/main/pip-manager.js"), "utf8");
  require("assert").ok(
    pipSource.includes("registerPipHandlers"),
    "pip-manager.js must export registerPipHandlers",
  );
  require("assert").ok(
    pipSource.includes("pip-install"),
    "pip-manager.js must register pip-install handler",
  );
  require("assert").ok(
    pipSource.includes("pip-uninstall"),
    "pip-manager.js must register pip-uninstall handler",
  );
  require("assert").ok(
    pipSource.includes("pip-list"),
    "pip-manager.js must register pip-list handler",
  );
  require("assert").ok(
    pipSource.includes("pip-cache-info"),
    "pip-manager.js must register pip-cache-info handler",
  );
  require("assert").ok(
    pipSource.includes("pip-run-in-venv"),
    "pip-manager.js must register pip-run-in-venv handler",
  );
  require("assert").ok(
    pipSource.includes("python-env"),
    "pip-manager.js must use python-env directory for venv",
  );

  const preloadSource = fs.readFileSync(path.join(ROOT, "preload.js"), "utf8");
  require("assert").ok(
    preloadSource.includes("pip:") || preloadSource.includes("pip."),
    "preload.js must expose pip API",
  );
  require("assert").ok(
    preloadSource.includes("pip-install"),
    "preload.js must call pip-install IPC",
  );
  require("assert").ok(
    preloadSource.includes("pip-uninstall"),
    "preload.js must call pip-uninstall IPC",
  );
  require("assert").ok(
    preloadSource.includes("pip-list"),
    "preload.js must call pip-list IPC",
  );
  require("assert").ok(
    preloadSource.includes("pip-cache"),
    "preload.js must call pip-cache IPC",
  );
  require("assert").ok(
    preloadSource.includes("pip-run-in-venv"),
    "preload.js must call pip-run-in-venv IPC",
  );
  require("assert").ok(
    preloadSource.includes("pip-ensure-venv"),
    "preload.js must call pip-ensure-venv IPC",
  );
  require("assert").ok(
    preloadSource.includes("onProgress"),
    "preload.js must expose pip onProgress listener",
  );

  const mainSource = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  require("assert").ok(
    mainSource.includes("registerPipHandlers"),
    "main.js must register pip handlers",
  );

  console.log("  ✓ All pip source contracts verified");
} catch (e) {
  console.error("  ✗ Pip contract validation failed:", e.message);
  exitCode = 1;
}

// 6. Check bundled Python (smoke)
console.log("\n--- Bundled Python check ---");
const pyResult = spawnSync(
  process.execPath,
  [path.join(__dirname, "smoke", "check_bundled_python.js")],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: ROOT,
  },
);
if (pyResult.status === 0) {
  console.log("  ✓ Bundled Python check passed");
} else {
  console.log("  ⚠ Python check non-fatal (system python may not be available):");
  const out = (pyResult.stderr || pyResult.stdout || "unknown").trim();
  if (out) {
    console.log("    " + out.split("\n").join("\n    "));
  }
}

console.log("\n=== All tests completed" + (exitCode ? " (with failures)" : " (all passed)") + " ===");
process.exit(exitCode);