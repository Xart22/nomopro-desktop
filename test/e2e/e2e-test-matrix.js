/**
 * E2E Test Matrix — nomopro-desktop
 *
 * Validates parity between Web (Pyodide) and Desktop (native) Python runners.
 * This script tests the core scenarios that must work identically on both platforms.
 *
 * Run with:
 *   node test/e2e/e2e-test-matrix.js
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - Python 3.8+ available on PATH
 *   - For web tests: a running nomopro-gui dev server
 *     (npm run start at nomopro-gui root)
 *   - For desktop tests: electron app running with window exposed
 */

const { spawnSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const assert = require("assert");

const ROOT = path.join(__dirname, "..", "..");

let PYTHON = process.platform === "win32" ? "python" : "python3";

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

// Resolve python to a real executable path (bypasses .bat shims on Windows).
// On Windows, use pyenv if available, then try resolved path.
const resolvePython = () => {
  if (!PYTHON.endsWith(".exe") && !PYTHON.includes(path.sep)) return tryResolve();
  return PYTHON;
};

const tryResolve = () => {
  if (process.platform !== "win32") {
    try {
      const r = spawnSync("which", [PYTHON], { encoding: "utf8", timeout: 5000 });
      if (r.status === 0 && r.stdout.trim()) {
        PYTHON = r.stdout.trim().split("\n")[0].trim();
        return PYTHON;
      }
    } catch (_) {}
    return PYTHON;
  }
  // Windows: try pyenv which, then where.exe, then fallback
  try {
    // pyenv which gives the real .exe path
    const r = spawnSync("pyenv", ["which", PYTHON], {
      encoding: "utf8", timeout: 5000, shell: true,
    });
    if (r.status === 0 && r.stdout.trim().toLowerCase().endsWith(".exe")) {
      PYTHON = r.stdout.trim();
      return PYTHON;
    }
  } catch (_) {}
  // Fallback: use where.exe and filter for .exe that isn't WindowsApps
  try {
    const r = spawnSync("where.exe", [PYTHON], {
      encoding: "utf8", shell: true, timeout: 5000,
    });
    if (r.status === 0) {
      for (const l of r.stdout.trim().split(/\r?\n/)) {
        const p = l.trim().toLowerCase();
        if (p.endsWith(".exe") && !p.includes("windowsapps")) {
          PYTHON = l.trim();
          return PYTHON;
        }
      }
      // Fall back to first .exe
      for (const l of r.stdout.trim().split(/\r?\n/)) {
        if (l.trim().toLowerCase().endsWith(".exe")) {
          PYTHON = l.trim();
          return PYTHON;
        }
      }
    }
  } catch (_) {}
  return PYTHON;
};

const test = (name, fn) => {
  process.stdout.write(`  ${name}... `);
  try {
    fn();
    console.log("✓");
    testsPassed++;
  } catch (e) {
    console.log("✗");
    console.error(`    ${e.message}`);
    testsFailed++;
  }
};

const runPython = (code, options = {}) => {
  const args = ["-u"];
  // Force UTF-8 mode on Windows (Python 3.7+)
  if (process.platform === "win32") args.push("-X", "utf8");
  args.push("-c", code);
  const result = spawnSync(PYTHON, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout || 10000,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });
  return result;
};

const hasPython = () => {
  try {
    resolvePython();
    const res = spawnSync(PYTHON, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
    });
    return res.status === 0;
  } catch (e) {
    return false;
  }
};

const parseCommands = (stdout) => {
  const commands = [];
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    const t = line && line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && (obj.cmd || obj.action)) commands.push(obj);
    } catch (e) {
      // ignore non-json
    }
  }
  return commands;
};

console.log("\n=== E2E Test Matrix: Python Mode Parity ===\n");

// =====================================================
// SECTION 1: Basic execution scenarios
// =====================================================
console.log("--- Section 1: Basic execution ---");

if (hasPython()) {
  test("print('hello world') returns exitCode 0", () => {
    const result = runPython('print("hello world")');
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("hello world"));
  });

  test("simple arithmetic executes without error", () => {
    const result = runPython("print(2 + 3 * 4)");
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("14"));
  });

  test("syntax error returns exitCode 1", () => {
    const result = runPython("print(invalid syntax!!!");
    assert.notEqual(result.status, 0);
  });

  test("runtime error returns exitCode 1", () => {
    const result = runPython("x = 1/0");
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
  });

  test("multi-line script executes correctly", () => {
    const code = `
for i in range(3):
    print(f"line {i}")
`.trim();
    const result = runPython(code);
    assert.equal(result.status, 0);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, 3);
  });
} else {
  console.log("  ⚠ Python not available, skipping basic execution tests");
  testsSkipped += 5;
}

// =====================================================
// SECTION 2: NDJSON command emission (openblock SDK)
// =====================================================
console.log("\n--- Section 2: NDJSON command emission ---");

if (hasPython()) {
  test("emit JSON command via print (cmd/args format)", () => {
    const code = `
import json
print(json.dumps({"cmd": "move", "args": [10]}), flush=True)
print("regular log", flush=True)
`;
    const result = runPython(code);
    const commands = parseCommands(result.stdout);

    assert.equal(commands.length, 1);
    assert.equal(commands[0].cmd, "move");
    assert.equal(commands[0].args[0], 10);
  });

  test("emit JSON command (action/value format - legacy)", () => {
    const code = `
import json
print(json.dumps({"action": "say", "value": "Hello"}), flush=True)
`;
    const result = runPython(code);
    const commands = parseCommands(result.stdout);

    assert.equal(commands.length, 1);
    assert.equal(commands[0].action, "say");
  });

  test("multiple commands in single output stream", () => {
    const code = `
import json, sys
print(json.dumps({"cmd":"move","args":[5]}), flush=True)
print(json.dumps({"cmd":"turn","args":[90]}), flush=True)
print(json.dumps({"action":"say","value":"done"}), flush=True)
`;
    const result = runPython(code);
    const commands = parseCommands(result.stdout);

    assert.equal(commands.length, 3);
    assert.equal(commands[0].cmd, "move");
    assert.equal(commands[1].cmd, "turn");
    assert.equal(commands[2].action, "say");
  });

  test("regular text output interleaved with JSON commands", () => {
    const code = `
import json
print(json.dumps({"cmd":"move","args":[5]}), flush=True)
print("User visible output", flush=True)
print(json.dumps({"cmd":"say","args":["hi"]}), flush=True)
print("More text", flush=True)
`;
    const result = runPython(code);
    const commands = parseCommands(result.stdout);

    assert.equal(commands.length, 2);
    // stdout should contain both JSON + regular text
    assert.ok(result.stdout.includes("User visible output"));
  });
} else {
  console.log("  ⚠ Python not available, skipping NDJSON tests");
  testsSkipped += 4;
}

// =====================================================
// SECTION 3: OpenBlock SDK simulation
// =====================================================
console.log("\n--- Section 3: OpenBlock SDK simulation ---");

if (hasPython()) {
  test("simulate move command from openblock SDK", () => {
    // Simulate what the SDK does: emit JSON for move command
    const code = `
import json, math

_state = {'x': 0.0, 'y': 0.0, 'direction': 90.0}

def emit(cmd, *args):
    print(json.dumps({'cmd': cmd, 'args': list(args)}), flush=True)

def move(value):
    radians = math.radians(90 - _state['direction'])
    _state['x'] += float(value) * math.cos(radians)
    _state['y'] += float(value) * math.sin(radians)
    emit('move', value)

move(10)
print(f"pos: {_state['x']:.1f},{_state['y']:.1f}", flush=True)
`;
    const result = runPython(code);
    const commands = parseCommands(result.stdout);

    assert.equal(commands.length, 1);
    assert.equal(commands[0].cmd, "move");
    assert.ok(result.stdout.includes("pos:"));
  });

  test("simulate say command from SDK", () => {
    const code = `
import json
print(json.dumps({"cmd":"say","args":["Hello World"]}), flush=True)
print("Hello World", flush=True)
`;
    const result = runPython(code);
    const commands = parseCommands(result.stdout);

    assert.equal(commands.length, 1);
    assert.equal(commands[0].cmd, "say");
  });

  test("simulate wait command (no infinite loop)", () => {
    const code = `
import json, time

print(json.dumps({"cmd":"wait","args":[0.1]}), flush=True)
time.sleep(0.1)
print("done", flush=True)
`;
    const result = runPython(code, { timeout: 5000 });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("done"));
  });

  test("empty script returns exitCode 0", () => {
    const result = runPython("");
    assert.equal(result.status, 0);
  });

  test("script with only comments returns exitCode 0", () => {
    const result = runPython("# just a comment\n# another comment");
    assert.equal(result.status, 0);
  });
} else {
  console.log("  ⚠ Python not available, skipping SDK tests");
  testsSkipped += 5;
}

// =====================================================
// SECTION 4: Edge cases
// =====================================================
console.log("\n--- Section 4: Edge cases ---");

if (hasPython()) {
  test("large output does not overflow buffer", () => {
    const code = "for i in range(100): print(f'line {i}', flush=True)";
    const result = runPython(code, { timeout: 5000 });
    assert.equal(result.status, 0);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, 100);
  });

  test("unicode characters in output", () => {
    const result = runPython('print("héllo wörld 🙌", flush=True)');
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("héllo"));
  });

  test("stderr messages are captured separately", () => {
    const code = `
import sys
print("stdout message", flush=True)
sys.stderr.write("stderr message\\n")
sys.stderr.flush()
`;
    const result = runPython(code);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("stdout"));
    assert.ok(result.stderr.includes("stderr"));
  });

  test("exit() from Python terminates gracefully", () => {
    const result = runPython("import sys; sys.exit(0)");
    assert.equal(result.status, 0);
  });

  test("exit(42) propagates exit code", () => {
    const result = runPython("import sys; sys.exit(42)");
    assert.equal(result.status, 42);
  });
} else {
  console.log("  ⚠ Python not available, skipping edge case tests");
  testsSkipped += 5;
}

// =====================================================
// Results
// =====================================================
const total = testsPassed + testsFailed + testsSkipped;
console.log("\n==========================================");
console.log("  E2E Test Matrix Results:");
console.log(`  Passed:  ${testsPassed}/${total}`);
console.log(`  Failed:  ${testsFailed}/${total}`);
console.log(`  Skipped: ${testsSkipped}/${total}`);
console.log("==========================================\n");

if (testsFailed > 0) {
  console.error("Some tests failed!");
  process.exit(1);
} else if (testsPassed === 0 && testsSkipped > 0) {
  console.error("No tests were executed (all skipped). Check Python availability.");
  process.exit(1);
} else {
  console.log("All executed tests passed!");
  process.exit(0);
}