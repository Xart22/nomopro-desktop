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

## Creating a Release

Releases are automated via GitHub Actions. To publish a new version:

1. Update the version in `package.json`.
2. Commit and push to `main`:
   ```bash
   git add package.json
   git commit -m "bump version to X.Y.Z"
   git push
   ```
3. Tag the commit and push the tag:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

The workflow will:
1. **macOS**: build, test, create a GitHub Release draft, and upload `.dmg`.
2. **Windows**: wait for macOS to finish, then upload `.exe` to the same release.
3. Both artifacts appear under a single release — no manual intervention needed.

Notes:

- The current implementation is minimal and intended for development/testing only. Installer packaging and bundled Python are planned in the main project plan (`plan-desktop.md`).
