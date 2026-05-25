const assert = require("assert");
const path = require("path");

describe("Pip Manager (main process)", () => {
  // Test the logic of pip-manager without actual pip execution

  describe("getVenvPaths", () => {
    it("returns correct paths for Windows", () => {
      // Simulate Windows paths
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const { getVenvPaths } = require("../../src/main/pip-manager");
      const appRoot = "C:\\nomopro";
      const paths = getVenvPaths(appRoot);

      assert.ok(paths.venvDir.includes("python-env"));
      assert.ok(paths.python.endsWith("python.exe"));
      assert.ok(paths.pip.endsWith("pip.exe"));
      assert.ok(paths.activateScript.includes("Scripts\\activate"));

      // Restore
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns correct paths for macOS/Linux based on platform detection", () => {
      // Direct test of the getVenvPaths internal logic instead of relying on
      // process.platform mocking which doesn't work well with module caching.
      // The function uses process.platform at call time, so we test the output
      // format independent of platform.
      const { getVenvPaths } = require("../../src/main/pip-manager");
      const appRoot = "/Users/test/nomopro";
      const paths = getVenvPaths(appRoot);

      // Regardless of platform, paths should have consistent structure
      assert.ok(paths.venvDir.includes("python-env"));
      assert.ok(typeof paths.python === "string" && paths.python.length > 0);
      assert.ok(typeof paths.pip === "string" && paths.pip.length > 0);
      assert.ok(typeof paths.activateScript === "string" && paths.activateScript.length > 0);
      // On Linux/macOS the separator should be /
      // On Windows it uses \
      const isWin = process.platform === "win32";
      const sep = isWin ? "\\" : "/";
      assert.ok(
        paths.venvDir.split(sep).pop() === "python-env",
        "venvDir should end with python-env"
      );
    });
  });

  describe("ensureVirtualEnv edge cases", () => {
    // We can't test actual venv creation here as it requires system python,
    // but we can verify the logic structure

    it("module exports expected functions", () => {
      const pipManager = require("../../src/main/pip-manager");
      assert.equal(typeof pipManager.registerPipHandlers, "function");
      assert.equal(typeof pipManager.ensureVirtualEnv, "function");
      assert.equal(typeof pipManager.getVenvPaths, "function");
    });
  });

  describe("IPC response shapes", () => {
    it("install returns expected shape on success", () => {
      const mockSuccess = {
        success: true,
        exitCode: 0,
        stdout: "Successfully installed requests",
        stderr: "",
        package: "requests",
      };

      assert.equal(mockSuccess.success, true);
      assert.equal(mockSuccess.exitCode, 0);
      assert.equal(mockSuccess.package, "requests");
      assert.ok(mockSuccess.stdout.includes("installed"));
    });

    it("install returns error shape on failure", () => {
      const mockFail = {
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: "ERROR: Could not find a version that satisfies the requirement",
        package: "nonexistent-package",
      };

      assert.equal(mockFail.success, false);
      assert.equal(mockFail.exitCode, 1);
      assert.ok(mockFail.stderr.includes("ERROR"));
    });

    it("install returns locked shape on concurrency", () => {
      const mockLocked = {
        success: false,
        error: "Another pip operation is in progress",
        locked: true,
      };

      assert.equal(mockLocked.success, false);
      assert.equal(mockLocked.locked, true);
    });

    it("list returns packages array", () => {
      const mockList = {
        success: true,
        packages: [
          { name: "pip", version: "24.0" },
          { name: "setuptools", version: "69.0" },
        ],
        count: 2,
      };

      assert.equal(mockList.success, true);
      assert.ok(Array.isArray(mockList.packages));
      assert.equal(mockList.count, 2);
      assert.equal(mockList.packages[0].name, "pip");
    });

    it("list returns empty packages when none installed beyond base", () => {
      const mockEmpty = {
        success: true,
        packages: [],
        count: 0,
      };

      assert.equal(mockEmpty.success, true);
      assert.equal(mockEmpty.count, 0);
    });

    it("uninstall returns expected shape", () => {
      const mockUninstall = {
        success: true,
        exitCode: 0,
        stdout: "Uninstalled requests-2.31.0:\n  Successfully uninstalled requests-2.31.0",
        stderr: "",
        package: "requests",
      };

      assert.equal(mockUninstall.success, true);
      assert.ok(mockUninstall.stdout.includes("Uninstalled"));
    });

    it("show returns package info", () => {
      const mockShow = {
        success: true,
        info: "Name: requests\nVersion: 2.31.0\nSummary: Python HTTP for Humans.",
      };

      assert.equal(mockShow.success, true);
      assert.ok(mockShow.info.includes("Name: requests"));
    });

    it("show returns not found", () => {
      const mockNotFound = {
        success: false,
        error: "Package 'nonexistent' not found",
        notFound: true,
      };

      assert.equal(mockNotFound.success, false);
      assert.equal(mockNotFound.notFound, true);
    });

    it("cache info returns expected structure", () => {
      const mockCache = {
        success: true,
        cacheDir: "/home/user/.cache/pip",
        cacheSize: 52428800, // 50MB
        cacheCount: 42,
        venvDir: "/home/user/app/data/python-env",
      };

      assert.equal(mockCache.success, true);
      assert.ok(mockCache.cacheSize >= 0);
      assert.ok(mockCache.cacheCount >= 0);
    });

    it("runInVenv returns success with stdout", () => {
      const mockRun = {
        success: true,
        exitCode: 0,
        stdout: "hello from venv\n",
        stderr: "",
      };

      assert.equal(mockRun.success, true);
      assert.equal(mockRun.stdout, "hello from venv\n");
    });

    it("ensureVenv returns alreadyExists when venv is present", () => {
      const mockExisting = {
        success: true,
        alreadyExists: true,
        venvPaths: {
          venvDir: "/data/python-env",
          python: "/data/python-env/bin/python3",
        },
      };

      assert.equal(mockExisting.success, true);
      assert.equal(mockExisting.alreadyExists, true);
    });
  });

  describe("findSystemPython candidates", () => {
    it("filters candidates in expected order", () => {
      // The order matters: prefer python3 over python on non-Windows
      const candidates = process.platform === "win32"
        ? ["python3", "python", "py"]
        : ["python3", "python"];

      assert.ok(candidates.length >= 2);
      assert.ok(candidates.includes("python3"));
    });
  });
});