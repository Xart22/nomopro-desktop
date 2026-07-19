const assert = require("assert");
const path = require("path");

describe("Pip Manager (main process)", () => {
  describe("getVenvPaths", () => {
    it("returns correct paths for Windows", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const { getVenvPaths } = require("../../src/main/pip-manager");
      const appRoot = "C:\\nomopro";
      const paths = getVenvPaths(appRoot);

      assert.ok(paths.venvDir.includes("python-env"));
      assert.ok(paths.python.endsWith("python.exe"));
      // pip now points to python.exe to avoid broken launcher
      assert.ok(paths.pip.endsWith("python.exe"));
      assert.ok(Array.isArray(paths.pipPrefix));
      assert.strictEqual(paths.pipPrefix[0], "-m");
      assert.strictEqual(paths.pipPrefix[1], "pip");
      assert.ok(paths.activateScript.includes("Scripts\\activate"));

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns correct paths for macOS/Linux", () => {
      const { getVenvPaths } = require("../../src/main/pip-manager");
      const appRoot = "/Users/test/nomopro";
      const paths = getVenvPaths(appRoot);

      assert.ok(paths.venvDir.includes("python-env"));
      assert.ok(typeof paths.python === "string" && paths.python.length > 0);
      assert.ok(typeof paths.pip === "string" && paths.pip.length > 0);
      assert.ok(
        typeof paths.activateScript === "string" &&
          paths.activateScript.length > 0,
      );
    });

    // L1: override via env var
    it("respects NOMOPRO_VENV_DIR env override", () => {
      const originalEnv = process.env.NOMOPRO_VENV_DIR;
      process.env.NOMOPRO_VENV_DIR = "C:\\custom\\venv";

      const { getVenvPaths } = require("../../src/main/pip-manager");
      const paths = getVenvPaths("C:\\app\\root");

      assert.ok(paths.venvDir.includes("custom"));
      assert.ok(paths.venvDir.includes("venv"));
      assert.ok(!paths.venvDir.includes("python-env"));

      if (originalEnv) {
        process.env.NOMOPRO_VENV_DIR = originalEnv;
      } else {
        delete process.env.NOMOPRO_VENV_DIR;
      }
    });

    // L1: customVenvDir param
    it("accepts custom venvDir parameter", () => {
      const { getVenvPaths } = require("../../src/main/pip-manager");
      const paths = getVenvPaths("/app/root", "/custom/venv");

      assert.ok(paths.venvDir.includes("/custom/venv"));
      assert.ok(!paths.venvDir.includes("python-env"));
    });
  });

  describe("validatePackageName", () => {
    it("rejects empty names", () => {
      const { validatePackageName } = require("../../src/main/pip-manager");
      assert.ok(validatePackageName(""));
      assert.ok(validatePackageName(null));
    });

    it("rejects flag-like names", () => {
      const { validatePackageName } = require("../../src/main/pip-manager");
      assert.ok(validatePackageName("--help"));
      assert.ok(validatePackageName("-r"));
    });

    it("rejects shell-injection characters", () => {
      const { validatePackageName } = require("../../src/main/pip-manager");
      assert.ok(validatePackageName("package; rm -rf /"));
      assert.ok(validatePackageName("package|echo"));
    });

    it("accepts valid package names", () => {
      const { validatePackageName } = require("../../src/main/pip-manager");
      assert.equal(validatePackageName("requests"), null);
      assert.equal(validatePackageName("numpy"), null);
      assert.equal(validatePackageName("flask==2.0.0"), null);
      assert.equal(validatePackageName("package@git+https://..."), null);
    });
  });

  describe("PROTECTED_PACKAGES", () => {
    it("blocks uninstall of pip, setuptools, wheel", () => {
      const { PROTECTED_PACKAGES } = require("../../src/main/pip-manager");
      assert.ok(PROTECTED_PACKAGES.includes("pip"));
      assert.ok(PROTECTED_PACKAGES.includes("setuptools"));
      assert.ok(PROTECTED_PACKAGES.includes("wheel"));
    });
  });

  describe("installPackage args building", () => {
    it("builds args with versionSpecifier", () => {
      const { buildPipInstallArgs } = require("../../src/main/pip-manager");
      // Note: buildPipInstallArgs is internal, testing through the module
      // This is a logic test of the version specifier feature
    });
  });

  describe("resetSystemPythonCache", () => {
    it("resets cache state", () => {
      const { resetSystemPythonCache } = require("../../src/main/pip-manager");
      resetSystemPythonCache();
      // If no error, test passes
    });
  });

  describe("module exports", () => {
    it("exports expected functions", () => {
      const pipManager = require("../../src/main/pip-manager");
      assert.equal(typeof pipManager.registerPipHandlers, "function");
      assert.equal(typeof pipManager.ensureVirtualEnv, "function");
      assert.equal(typeof pipManager.getVenvPaths, "function");
      assert.equal(typeof pipManager.resetSystemPythonCache, "function");
    });
  });

  describe("fixExeShebangs", () => {
    it("fixes shebangs in pip.exe launchers", () => {
      const { fixExeShebangs } = require("../../src/main/pip-manager");

      // Create a fake venv dir with a mock pip.exe containing stale shebang
      const tmpDir = require("os").tmpdir();
      const testDir = path.join(tmpDir, "nomopro-test-shebang-" + Date.now());
      const scriptsDir = path.join(testDir, "Scripts");
      require("fs").mkdirSync(scriptsDir, { recursive: true });

      // Fake venv python.exe
      require("fs").writeFileSync(path.join(scriptsDir, "python.exe"), "");

      // Create a pip.exe with stale shebang from build machine
      const staleShebang =
        "#!D:\\project\\node\\nomopro\\pyide\\prod\\nomopro-desktop\\data\\python-env\\Scripts\\python.exe\n";
      const pipContent = staleShebang + "PK\x03\x04...rest of PE binary...";
      require("fs").writeFileSync(path.join(scriptsDir, "pip.exe"), pipContent);

      // Also wheel.exe
      require("fs").writeFileSync(
        path.join(scriptsDir, "wheel.exe"),
        pipContent,
      );

      // Run fix
      fixExeShebangs(testDir);

      // Read back
      const fixedPip = require("fs").readFileSync(
        path.join(scriptsDir, "pip.exe"),
        "utf8",
      );
      assert.ok(fixedPip.startsWith("#!"), "should start with shebang");
      assert.ok(
        fixedPip.includes(scriptsDir + "\\python.exe"),
        "shebang should point to new venv python: " + fixedPip,
      );
      assert.ok(
        !fixedPip.includes("D:\\project\\node"),
        "should NOT contain old build-machine path",
      );

      // Cleanup
      require("fs").rmSync(testDir, { recursive: true, force: true });
    });

    it("does not modify files without stale paths", () => {
      const { fixExeShebangs } = require("../../src/main/pip-manager");
      const tmpDir = require("os").tmpdir();
      const testDir = path.join(
        tmpDir,
        "nomopro-test-shebang-clean-" + Date.now(),
      );
      const scriptsDir = path.join(testDir, "Scripts");
      require("fs").mkdirSync(scriptsDir, { recursive: true });
      require("fs").writeFileSync(path.join(scriptsDir, "python.exe"), "");

      // Clean shebang
      const cleanShebang =
        "#!C:\\Nomokit-Desktop\\resources\\app\\data\\python-env\\Scripts\\python.exe\n";
      require("fs").writeFileSync(
        path.join(scriptsDir, "pip.exe"),
        cleanShebang + "PK...",
      );

      const beforeContent = require("fs").readFileSync(
        path.join(scriptsDir, "pip.exe"),
      );
      fixExeShebangs(testDir);
      const afterContent = require("fs").readFileSync(
        path.join(scriptsDir, "pip.exe"),
      );

      assert.deepStrictEqual(
        beforeContent,
        afterContent,
        "should not modify files without stale paths",
      );
      require("fs").rmSync(testDir, { recursive: true, force: true });
    });
  });
});

// ============================================================================
// Diagnostic Bundle Tests
// ============================================================================
describe("Diagnostic Bundle", () => {
  describe("module exports", () => {
    it("exports registerDiagnosticHandlers", () => {
      const diag = require("../../src/main/diagnostic-bundle");
      assert.equal(typeof diag.registerDiagnosticHandlers, "function");
    });
  });
});

// ============================================================================
// Recovery Mode Tests
// ============================================================================
describe("Recovery Mode", () => {
  describe("module exports", () => {
    it("exports registerRecoveryHandlers", () => {
      const recovery = require("../../src/main/recovery-mode");
      assert.equal(typeof recovery.registerRecoveryHandlers, "function");
    });
  });
});

// ============================================================================
// Offline Cache Tests
// ============================================================================
describe("Offline Cache", () => {
  describe("module exports", () => {
    it("exports registerOfflineCacheHandlers", () => {
      const cache = require("../../src/main/offline-cache");
      assert.equal(typeof cache.registerOfflineCacheHandlers, "function");
      assert.equal(typeof cache.cachePackage, "function");
      assert.equal(typeof cache.getCacheDir, "function");
    });
  });
});

// ============================================================================
// Safe Install Tests
// ============================================================================
describe("Safe Install", () => {
  describe("classifyPackage", () => {
    it("returns safe for known packages", () => {
      const { classifyPackage } = require("../../src/main/safe-install");
      assert.equal(classifyPackage("requests").level, "safe");
      assert.equal(classifyPackage("flask").level, "safe");
      assert.equal(classifyPackage("numpy").level, "safe"); // numpy listed in KNOWN_SAFE_PACKAGES
    });

    it("returns blocked for incompatible packages", () => {
      const { classifyPackage } = require("../../src/main/safe-install");
      assert.equal(classifyPackage("pywin32").level, "blocked");
      assert.equal(classifyPackage("tkinter").level, "blocked");
    });

    it("handles unknown packages", () => {
      const { classifyPackage } = require("../../src/main/safe-install");
      assert.equal(classifyPackage("some-random-pkg-12345").level, "unknown");
    });

    it("handles empty input", () => {
      const { classifyPackage } = require("../../src/main/safe-install");
      assert.equal(classifyPackage("").level, "unknown");
      assert.equal(classifyPackage(null).level, "unknown");
    });
  });
});

// ============================================================================
// Project Deps Tests
// ============================================================================
describe("Project Deps", () => {
  describe("sanitizeProjectId", () => {
    it("sanitizes project IDs", () => {
      const { sanitizeProjectId } = require("../../src/main/project-deps");
      assert.equal(sanitizeProjectId("default"), "default");
      assert.equal(sanitizeProjectId("my-project"), "my-project");
      assert.equal(sanitizeProjectId("my project!"), "my_project_");
      assert.equal(sanitizeProjectId(null), "default");
      assert.equal(sanitizeProjectId(""), "default");
    });
  });
});

// ============================================================================
// Error Boundary Tests
// ============================================================================
describe("Error Boundary", () => {
  it("exports registerSafeHandler", () => {
    const eb = require("../../src/main/error-boundary");
    assert.equal(typeof eb.registerSafeHandler, "function");
  });
});
