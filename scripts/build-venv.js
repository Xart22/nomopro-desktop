#!/usr/bin/env node
/**
 * Build virtualenv from bundled Python for offline use.
 *
 * This script:
 * 1. Detects bundled Python (from install_python_payload.js)
 * 2. Creates a virtualenv in data/python-env/
 * 3. Installs setuptools + wheel (so pip install works offline)
 * 4. Creates marker file so ensureVirtualEnv() skips creation at runtime
 *
 * Usage:
 *   node scripts/build-venv.js
 *
 * Prerequisites:
 *   - Run install_python_payload.js first (python/ directory must exist)
 *   - Internet access (for downloading setuptools/wheel)
 *
 * Called by: npm run prebuild (automated in build pipeline)
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const APP_ROOT = path.join(__dirname, "..");
const isWin = process.platform === "win32";

// Find bundled python
const findBundledPython = () => {
  const candidates = [
    path.join(
      APP_ROOT,
      "python",
      isWin ? "python.exe" : "bin",
      isWin ? "python.exe" : "python3",
    ),
    path.join(APP_ROOT, "python", isWin ? "python.exe" : "python3"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
};

const VENV_DIR = path.join(APP_ROOT, "data", "python-env");
const VENV_PYTHON = path.join(
  VENV_DIR,
  isWin ? "Scripts" : "bin",
  isWin ? "python.exe" : "python3",
);
const VENV_PIP = path.join(
  VENV_DIR,
  isWin ? "Scripts" : "bin",
  isWin ? "pip.exe" : "pip3",
);
const MARKER_FILE = path.join(APP_ROOT, "python", ".venv-installed");

const run = (cmd, args, opts = {}) => {
  console.log(`  > ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: opts.timeout || 120000,
    cwd: opts.cwd || APP_ROOT,
    ...opts,
  });
  if (result.status !== 0 && !opts.ignoreExitCode) {
    console.error(
      `  ✗ FAILED (exit ${result.status}): ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  return result;
};

const main = async () => {
  console.log(`\n=== Build Virtualenv for Offline Use ===`);
  console.log(`  Platform: ${process.platform} ${os.arch()}`);

  // Step 1: Find bundled Python
  const pythonExe = findBundledPython();
  if (!pythonExe) {
    console.error(`\n✗ Bundled Python not found.`);
    console.error(`  Run 'npm run install-python-payload' first.`);
    console.error(
      `  Expected at: ${path.join(APP_ROOT, "python", "python.exe")}`,
    );
    process.exit(1);
  }
  console.log(`  Bundled Python: ${pythonExe}`);

  // Step 2: Check version
  const verResult = run(pythonExe, ["--version"]);
  if (verResult.status !== 0) {
    console.error(`  ✗ Python executable doesn't work. Corrupted?`);
    process.exit(1);
  }
  console.log(
    `  Version: ${(verResult.stdout || verResult.stderr || "").trim()}`,
  );

  // Step 2.5: Enable import site in bundled Python (embedded Python disables it)
  const pythonDir = path.dirname(pythonExe);
  const pthFiles = fs
    .readdirSync(pythonDir)
    .filter((f) => /^python\d+(\._pth|\.pth)$/.test(f));
  for (const pthFile of pthFiles) {
    const pthPath = path.join(pythonDir, pthFile);
    let pthContent = fs.readFileSync(pthPath, "utf8");
    const hasImportSite = pthContent
      .split("\n")
      .some((line) => /^\s*import\s+site\s*$/.test(line));
    if (pthFile.endsWith("._pth") || !hasImportSite) {
      if (!hasImportSite) {
        pthContent =
          pthContent
            .split("\n")
            .filter((line) => !line.trim().startsWith("#import site"))
            .join("\n") + "\nimport site\n";
      }
      const newName = pthFile.replace("._pth", ".pth");
      fs.writeFileSync(path.join(pythonDir, newName), pthContent, "utf8");
      if (pthFile.endsWith("._pth")) {
        fs.unlinkSync(pthPath);
      }
      console.log(`  Enabled import site (${pthFile} → ${newName})`);
    } else {
      console.log(`  import site already enabled in ${pthFile}`);
    }
  }

  // Step 3: Remove old venv if exists
  if (fs.existsSync(VENV_DIR)) {
    console.log(`  Removing old venv at ${VENV_DIR}...`);
    fs.rmSync(VENV_DIR, { recursive: true, force: true });
  }

  // Step 4: Bootstrap pip if needed (embedded Python may lack ensurepip/venv)
  const tryEnsurePip = () => {
    const result = run(
      pythonExe,
      ["-m", "ensurepip", "--upgrade", "--default-pip"],
      { ignoreExitCode: true },
    );
    return result.status === 0;
  };

  const downloadGetPip = () => {
    console.log(`  Downloading get-pip.py...`);
    const getPipPath = path.join(pythonDir, "get-pip.py");
    const https = require("https");
    return new Promise((resolve) => {
      const file = fs.createWriteStream(getPipPath);
      https
        .get("https://bootstrap.pypa.io/get-pip.py", (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            file.close();
            fs.unlinkSync(getPipPath);
            https.get(res.headers.location, (res2) => {
              res2.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve(true);
              });
            });
          } else {
            res.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve(true);
            });
          }
        })
        .on("error", () => {
          file.close();
          resolve(false);
        });
    });
  };

  // Try python -m venv first
  console.log(`\n  Creating virtualenv...`);
  let venvResult = run(pythonExe, ["-m", "venv", "--copies", VENV_DIR], {
    ignoreExitCode: true,
  });

  if (venvResult.status !== 0) {
    console.log(
      `  venv not available in embedded Python, bootstrapping pip...`,
    );

    const pipAvailable = tryEnsurePip();
    if (!pipAvailable) {
      const downloaded = await downloadGetPip();
      if (downloaded) {
        const getPipPath = path.join(pythonDir, "get-pip.py");
        run(pythonExe, [getPipPath], { ignoreExitCode: true });
        try {
          fs.unlinkSync(getPipPath);
        } catch (_) {}
      }
    }

    // Install virtualenv package (works even with embedded Python pip)
    console.log(`  Installing virtualenv package...`);
    run(pythonExe, ["-m", "pip", "install", "virtualenv", "--quiet"], {
      ignoreExitCode: true,
    });

    // Retry venv creation using virtualenv
    console.log(`  Creating virtualenv via virtualenv...`);
    venvResult = run(
      pythonExe,
      ["-m", "virtualenv", "--always-copy", VENV_DIR],
      {
        ignoreExitCode: true,
      },
    );

    if (venvResult.status !== 0) {
      console.error(`  ✗ All methods failed. Cannot create virtualenv.`);
      console.error(`  Try installing Python 3.8+ from python.org`);
      process.exit(1);
    }
  }

  if (!fs.existsSync(VENV_PYTHON) || !fs.existsSync(VENV_PIP)) {
    console.error(`  ✗ Virtualenv created but python/pip not found.`);
    process.exit(1);
  }
  console.log(`  Virtualenv created at ${VENV_DIR}`);

  // Step 5: Upgrade pip
  console.log(`\n  Upgrading pip...`);
  run(VENV_PIP, ["install", "--upgrade", "pip", "--quiet"], {
    ignoreExitCode: true,
  });

  // Step 6: Install setuptools + wheel (so offline pip install works)
  console.log(`\n  Installing setuptools + wheel...`);
  run(VENV_PIP, ["install", "--upgrade", "setuptools", "wheel", "--quiet"], {
    ignoreExitCode: true,
  });

  // Step 7: Verify
  console.log(`\n  Verifying...`);
  const listResult = run(VENV_PIP, ["list", "--format=json"]);
  if (listResult.status === 0) {
    const pkgs = JSON.parse(listResult.stdout);
    console.log(
      `  Installed packages: ${pkgs.map((p) => `${p.name}==${p.version}`).join(", ")}`,
    );
  }

  // Step 8: Write marker file
  const venvPythonVersion =
    run(VENV_PYTHON, ["--version"]).stdout.trim() || "unknown";
  fs.writeFileSync(
    MARKER_FILE,
    JSON.stringify(
      {
        created: new Date().toISOString(),
        python: venvPythonVersion,
        platform: process.platform,
        arch: os.arch(),
      },
      null,
      2,
    ),
  );

  console.log(`\n  ✅ Virtualenv ready for offline use.`);
  console.log(`  Venv: ${VENV_DIR}`);
  console.log(`  Size: ${getDirSize(VENV_DIR)}`);
  console.log();
};

const getDirSize = (dir) => {
  let size = 0;
  try {
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(d, entry.name);
        if (entry.isFile()) size += fs.statSync(full).size;
        else if (entry.isDirectory()) walk(full);
      }
    };
    walk(dir);
  } catch (_) {}
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

main().catch((err) => {
  console.error(`\n✗ Build venv failed:`, err.message);
  process.exit(1);
});
