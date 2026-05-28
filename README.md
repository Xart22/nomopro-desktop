# nomopro-desktop

Electron wrapper for nomopro-gui desktop runtime.

This repo provides a minimal Electron main/preload bridge to run Python scripts natively and stream NDJSON command lines back to the renderer.

Quick start (development):

1. Install dependencies

```bash
npm install
```

2. Start the app

```bash
npm start
```

API exposed to renderer (via preload):

- `window.platformInfo.isDesktop` — boolean
- `window.openblockDesktopPython.runPythonCode(code)` — invoke, returns `{ exitCode, stdout, stderr, commands }`
- `window.openblockDesktopPython.stopPythonCode()` — invoke, stops running process
- `electronAPI.on(channel, handler)` — subscribe to events; renderer can listen to `openblock-python-stdout` and `openblock-python-stderr` for live streaming.

Notes:

- The current implementation is minimal and intended for development/testing only. Installer packaging and bundled Python are planned in the main project plan (`plan-desktop.md`).
