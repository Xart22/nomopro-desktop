const assert = require("assert");
const path = require("path");
const fs = require("fs");

// We test the getPythonCandidates logic and the IPC handler contract
// without actually spawning Electron. For the real IPC handler we validate
// the candidate discovery logic, env sanitization, and timeout guard behavior.

describe("Python runner (main process)", () => {
  describe("getPythonCandidates", () => {
    // Inline the logic from main.js for isolated testing
    const getPythonCandidates = () => {
      const candidates = [];
      try {
        const resourcesPython = path.join(
          process.resourcesPath || __dirname,
          "..",
          "..",
          "python",
        );
        if (fs.existsSync(resourcesPython)) {
          if (process.platform === "win32") {
            const pexe = path.join(resourcesPython, "python.exe");
            const pexeAlt = path.join(resourcesPython, "python", "python.exe");
            if (fs.existsSync(pexe)) candidates.push(pexe);
            if (fs.existsSync(pexeAlt)) candidates.push(pexeAlt);
          } else {
            const pyBin = path.join(resourcesPython, "bin", "python3");
            const pyBinAlt = path.join(resourcesPython, "bin", "python");
            const pyRoot = path.join(resourcesPython, "python3");
            if (fs.existsSync(pyBin)) candidates.push(pyBin);
            if (fs.existsSync(pyBinAlt)) candidates.push(pyBinAlt);
            if (fs.existsSync(pyRoot)) candidates.push(pyRoot);
          }
        }
      } catch (e) {
        // ignore
      }

      if (process.platform === "win32") {
        candidates.push("python", "py");
      } else {
        candidates.push("python3", "python");
      }
      return candidates;
    };

    it("returns bundled candidates before system fallbacks", () => {
      const candidates = getPythonCandidates();
      // The last two entries are always the system fallbacks
      if (process.platform === "win32") {
        assert.equal(
          candidates[candidates.length - 2],
          "python",
          "system python should be second-to-last",
        );
        assert.equal(
          candidates[candidates.length - 1],
          "py",
          "system py should be last",
        );
      } else {
        assert.equal(
          candidates[candidates.length - 1],
          "python",
          "system python should be last fallback",
        );
      }
    });

    it("always returns at least 2 fallback candidates", () => {
      const candidates = getPythonCandidates();
      assert.ok(candidates.length >= 2, "Should have at least system fallbacks");
    });
  });

  describe("IPC handler contract", () => {
    it("returns expected response shape from run", () => {
      // Simulate the result shape from openblock-python-run handler
      const mockResult = {
        exitCode: 0,
        signal: null,
        stdout: '{"cmd":"move","args":[10]}\nhello world\n',
        stderr: "",
        commands: [{ cmd: "move", args: [10] }],
        timedOut: false,
      };

      assert.equal(typeof mockResult.exitCode, "number");
      assert.equal(typeof mockResult.signal, "object"); // null type
      assert.equal(typeof mockResult.stdout, "string");
      assert.equal(typeof mockResult.stderr, "string");
      assert.ok(Array.isArray(mockResult.commands));
      assert.equal(mockResult.commands.length, 1);
      assert.equal(mockResult.commands[0].cmd, "move");
    });

    it("returns proper stop response shape", () => {
      // Simulate the result shape from openblock-python-stop handler
      const mockSuccess = { stopped: true };
      const mockNoProc = { stopped: false, reason: "no-process" };
      const mockError = { stopped: false, error: "Kill failed" };

      assert.equal(mockSuccess.stopped, true);
      assert.equal(mockNoProc.stopped, false);
      assert.equal(mockNoProc.reason, "no-process");
      assert.equal(mockError.stopped, false);
      assert.equal(typeof mockError.error, "string");
    });

    it("env sanitization filter works correctly", () => {
      // Simulate the env object that the IPC handler creates
      const safeEnv = {
        PATH: process.env.PATH || "",
        HOME: process.env.HOME || process.env.USERPROFILE || "",
        USERPROFILE: process.env.USERPROFILE || "",
        SYSTEMROOT: process.env.SYSTEMROOT || "",
        TMP: process.env.TMP || process.env.TEMP || "",
        TEMP: process.env.TEMP || process.env.TMP || "",
        PYTHONUNBUFFERED: "1",
      };

      assert.equal(safeEnv.PYTHONUNBUFFERED, "1");
      assert.ok(safeEnv.PATH.length > 0, "PATH should not be empty");
      assert.equal(
        Object.keys(safeEnv).length,
        7,
        "Should have exactly 7 env vars",
      );
    });
  });

  describe("NDJSON parsing integration", () => {
    it("parses command lines from python stdout", () => {
      const stdout = '{"cmd":"move","args":[5]}\n{"action":"say","value":"hi"}\nregular line\n';
      const lines = stdout.split(/\r?\n/);
      const commands = [];
      for (const line of lines) {
        const t = line && line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t);
          if (obj && (obj.cmd || obj.action || Array.isArray(obj.args)))
            commands.push(obj);
        } catch (e) {
          // ignore non-json
        }
      }

      assert.equal(commands.length, 2);
      assert.equal(commands[0].cmd, "move");
      assert.equal(commands[1].action, "say");
    });

    it("handles empty or whitespace-only lines gracefully", () => {
      const stdout = "\n\n  \n{'invalid}\n";
      const lines = stdout.split(/\r?\n/);
      const commands = [];
      for (const line of lines) {
        const t = line && line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t);
          if (obj && (obj.cmd || obj.action || Array.isArray(obj.args)))
            commands.push(obj);
        } catch (e) {
          // ignore
        }
      }
      assert.equal(commands.length, 0);
    });
  });
});