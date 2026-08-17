const assert = require("assert");
const { EventEmitter } = require("events");
const {
  guardChildStdin,
  safeWriteStdin,
} = require("../../src/main/python-stdin");

// Root cause under test:
//   A child process's `stdin` is a Writable stream, i.e. an EventEmitter.
//   When the child exits, its read end of the pipe closes, and a subsequent
//   write emits an async 'error' (EPIPE) on that stdin stream. Node rethrows
//   an 'error' event that has no listener as an UNCAUGHT EXCEPTION -- which is
//   exactly the "Uncaught Exception: Error: write EPIPE" crash seen when the
//   renderer keeps writing to a persistent Python session that already died.
//
// A `stdin.writable` guard cannot prevent this (writable is often still true
// at the instant of the check; the EPIPE lands after write() returns), and the
// child-process 'error' handler is a DIFFERENT emitter that never sees it.
// The only correct fix is an 'error' listener on the stdin stream itself.

// Minimal faithful model of child.stdin: an EventEmitter that throws on an
// unlistened 'error' emit, exactly like a real Writable stream.
function fakeStdin({ writable = true, writeImpl } = {}) {
  const s = new EventEmitter();
  s.writable = writable;
  s.write =
    writeImpl ||
    function () {
      return true;
    };
  return s;
}

describe("python stdin guard", () => {
  it("reproduces the crash: an unguarded stdin 'error' throws (uncaught exception)", () => {
    const stdin = fakeStdin();
    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    // No 'error' listener attached -> emit throws, mirroring the real crash.
    assert.throws(() => stdin.emit("error", epipe), /write EPIPE/);
  });

  it("guardChildStdin swallows the async pipe error and logs it (no throw)", () => {
    const stdin = fakeStdin();
    const logs = [];
    guardChildStdin({ stdin }, "[test]", { warn: (m) => logs.push(m) });
    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    assert.doesNotThrow(() => stdin.emit("error", epipe));
    assert.ok(
      logs.some((l) => /EPIPE/.test(l)),
      "guard should log the swallowed pipe error",
    );
  });

  it("guardChildStdin is a no-op when proc or stdin is missing", () => {
    assert.doesNotThrow(() => guardChildStdin(null, "[t]", { warn() {} }));
    assert.doesNotThrow(() => guardChildStdin({}, "[t]", { warn() {} }));
  });

  it("safeWriteStdin returns false without calling write when stdin is not writable", () => {
    let called = false;
    const stdin = fakeStdin({
      writable: false,
      writeImpl: () => {
        called = true;
      },
    });
    assert.strictEqual(safeWriteStdin({ stdin }, "hi\n"), false);
    assert.strictEqual(called, false);
  });

  it("safeWriteStdin returns true after a successful write", () => {
    const stdin = fakeStdin({ writable: true });
    assert.strictEqual(safeWriteStdin({ stdin }, "hi\n"), true);
  });

  it("safeWriteStdin returns false instead of throwing on a synchronous write error", () => {
    const stdin = fakeStdin({
      writable: true,
      writeImpl: () => {
        throw Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
      },
    });
    assert.strictEqual(safeWriteStdin({ stdin }, "hi\n"), false);
  });

  it("safeWriteStdin returns false when proc or stdin is missing", () => {
    assert.strictEqual(safeWriteStdin(null, "hi\n"), false);
    assert.strictEqual(safeWriteStdin({}, "hi\n"), false);
  });
});
