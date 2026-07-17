// Guards against "write EPIPE" uncaught exceptions when writing to a child
// process's stdin whose read end has already closed (the child exited).
//
// A child's `stdin` is a Writable stream (an EventEmitter). When the child is
// gone, a write emits an async 'error' (EPIPE) on that stream AFTER write()
// returns, so a synchronous `stdin.writable` check cannot prevent it, and the
// child-process 'error' event is a different emitter that never sees it. Node
// rethrows an unlistened stream 'error' as an uncaught exception -- which is
// the "Uncaught Exception: Error: write EPIPE" crash seen when the renderer
// keeps writing to a persistent Python session that already died.
//
// The only correct fix is an 'error' listener on the stdin stream itself; the
// process's 'close'/'exit' handler is what actually reports the death to the
// renderer, so here we just swallow-and-log so the app stays alive.

function guardChildStdin(proc, label, log) {
  if (!proc || !proc.stdin || typeof proc.stdin.on !== "function") return;
  proc.stdin.on("error", (err) => {
    if (log && typeof log.warn === "function") {
      const code = (err && (err.code || err.message)) || "unknown";
      log.warn(`${label} stdin write ignored (${code}): child pipe closed`);
    }
  });
}

// Writes to a child's stdin without ever throwing. Returns true only when the
// write was handed off to a writable stream. Async pipe errors are caught by
// guardChildStdin; this catches the rarer synchronous throw.
function safeWriteStdin(proc, data) {
  if (!proc || !proc.stdin || !proc.stdin.writable) return false;
  try {
    proc.stdin.write(data);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { guardChildStdin, safeWriteStdin };
