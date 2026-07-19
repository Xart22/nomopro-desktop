# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

See `../CLAUDE.md` for how this repo fits into the wider NomoKit family. This doc goes deeper on
`nomopro-desktop` itself.

Two other checkouts in the workspace are related but out of scope here:
- **`nomo-link`** — the standalone legacy "Nomolink" Electron flasher this repo's `src/link` module
  was ported from (see "Lineage from nomo-link" below). It's superseded for this app's purposes but
  still shipped separately for macOS downloads.
- **`nomopro-desktop-mac`** — an older, flat-structure checkout of this same `Xart22/nomopro-desktop`
  repo (no `src/{main,link,gui,...}` split). Treat it as a stale snapshot, not a separate product;
  don't write parallel docs for it.

## Commands

All commands run from this directory (`npm install` first; `postinstall` runs
`electron-rebuild -f -w @abandonware/noble` automatically — this recompiles noble's native BLE
binding for Electron's ABI and requires a working native toolchain (Xcode CLT / build-essential /
Visual Studio Build Tools). It can be slow or fail silently on a machine without one; if BLE
flashing misbehaves after `npm install`, check this step first).

**Dev**
```bash
npm start                 # electron .  (opens DevTools automatically when unpackaged)
```

**Test**
```bash
npm test                  # test/run-tests.js (mocha-based smoke checks) + test/e2e/e2e-test-matrix.js
npm run test:smoke        # just test/run-tests.js
npm run test:e2e          # just test/e2e/e2e-test-matrix.js
npm run check-bundled-python   # test/smoke/check_bundled_python.js — verifies a Python interpreter resolves
```
- `test/run-tests.js` does static/structural validation (asserts specific handler names and strings
  exist in `src/main/ipc.js` / `main.js`) rather than deep behavioral testing — it's a regression
  guard against previously-fixed bugs, not full coverage.
- `test/e2e/e2e-test-matrix.js` checks **parity between the web (Pyodide) and desktop (native
  subprocess) Python runners** — same code should behave the same on both. It expects Python 3.8+ on
  PATH and, for the web half, a running `nomopro-gui` dev server.
- `test/unit/*.test.js` (file-storage, pip-manager, python-runner) are additional unit specs beside
  the two runners above.

**Build / release** (electron-builder; unsigned dev builds work without `prebuild`, but real
packaging needs it)
```bash
npm run build              # prebuild + electron-builder --win  (NSIS installer)
npm run build:mac          # prebuild + electron-builder --mac  (dmg, x64+arm64)
npm run deploy:mac / deploy:win / deploy:all   # same, plus -p always (publishes to GitHub Releases)
```
- `prebuild` = `clean:tools` (wipes `src/link/tools/Arduino/{staging,tmp}`) + `prebuild:avr`.
- `prebuild:avr` runs `arduino-cli core install arduino:avr --config-file arduino-cli.yaml` **only
  if** `src/link/tools/Arduino/arduino-cli.yaml` exists and the AVR core isn't already installed
  under its configured data dir. This needs `arduino-cli` on PATH and network access to Arduino's
  package index — expect it to be slow (or to silently no-op with a console warning if the yaml is
  missing) on a fresh checkout that hasn't run `fetch:driver` yet.
- `fetch:driver` — `rimraf tools firmwares && node src/link/script/download-tools.js && node
  src/link/script/download-firmwares.js` — populates `src/link/tools/` (arduino-cli, avrdude, bossac,
  esptool, etc.) and firmware images from GitHub releases. This is a prerequisite for `src/link` to
  do anything useful and is not run automatically by `npm install`.
- `install-python-payload` (`scripts/install_python_payload.js`) downloads a portable Python
  (3.11.9) — the Windows embeddable zip or an `indygreg/python-build-standalone` tarball on macOS —
  into `python/`, which `extraResources` in `package.json` bundles into the packaged app at
  `resourcesPath/python`. Requires network access; on macOS it additionally shells out to `zstd`
  (`brew install zstd`) to decompress the `.tar.zst`. Skips re-downloading if `python/.installed`
  exists.
- Actual release flow (from README, still accurate): bump `version` in `package.json`, commit, push,
  then tag `vX.Y.Z` and push the tag — GitHub Actions builds macOS first (dmg) then Windows (exe) and
  attaches both to one draft Release.

Release-relevant `package.json` quirks worth knowing before touching the build config: `asar` is
`false` and `npmRebuild` is `false` (native `@abandonware/noble`/`serialport` binaries are rebuilt
once via `postinstall`, not on every package). `files` explicitly excludes `python`, `test`, and the
Arduino `staging/tmp/packages` dirs from the app bundle — `python` and `src/nomokitjr` are instead
injected via `extraResources` so they land in `resourcesPath` rather than inside the asar-less app
directory.

## Architecture

**`src/gui` is a copied snapshot, not built from source here.** It's a manually-dropped-in copy of
`nomopro/openblock-gui`'s combined production build (confirmed matching file listing, including that
build's own nested `src/gui/nomokitjr/` — see `nomopro/openblock-gui/CLAUDE.md`'s "Embedded sibling
bundles" section and `nomopro/CLAUDE.md`'s bundling overview for how that upstream build is
assembled). Editing anything under `src/gui` directly, or editing `openblock-gui`'s source in the
sibling repo, has **no effect** on this app until someone rebuilds `openblock-gui` and re-copies its
`build/` output here — there is no build step in this repo's own `package.json` that produces
`src/gui`. Note this checkout's `src/gui` does **not** have a nested `nomokit-ml/` folder (unlike the
current `nomopro/openblock-gui` checkout, which does) — the copied snapshot here predates that embed,
or ML-tool bundling for desktop just hasn't been done yet; don't assume the ML overlay works in this
app without checking `src/gui` for a `nomokit-ml/` folder first. Separately, `package.json`'s
`extraResources` config lists `{ "from": "src/nomokitjr", "to": "nomokitjr" }` — but there is no
`src/nomokitjr` directory in this repo, only `src/gui/nomokitjr`; as written, that `extraResources`
entry is either a no-op or an electron-builder error, not a real copy of the Jr bundle into the
packaged app. Confirm before relying on it.

**Process split.** Standard Electron main/preload/renderer, but the app boots straight into static
HTML pages loaded via `win.loadFile` rather than a single SPA shell — `main.js` decides which page to
show based on socket connectivity and whether `data/user.json` has a token (auth vs GUI vs
disconnected). `preload.js` is the bridge for the main GUI window; `preload-update.js` is a second,
narrower bridge used only by the Arduino-tools update popup window.

**`src/main/*.js` — one helper module per concern, all wired together in `main.js`'s `createWindow`:**

| Module | Role |
|---|---|
| `ipc.js` | Core IPC: `login`/`logout`/`getUserData` handlers (calls `nomo-kit.com/api/login`), plus the renderer-facing file storage API (save/read/list/delete project files under `~/Documents/OpenBlock`). |
| `socket.js` | Socket.IO client event handlers: reloads to the disconnected page, redirects to GUI/auth on `connect`, force-logs-out and relaunches on `login-fail` (another device logged into the same account). |
| `sync.js` | Startup self-update: `syncLibrary` pulls Arduino library bundle updates from `/api/check-update`; `syncGui`/`syncLink` poll `/api/check-update-dektop` and, on version mismatch, download+extract a fresh `src/gui` or `src/link` zip and relaunch the app. |
| `link.js` | Boots the embedded `OpenBlockLink` WebSocket server (see below) and triggers a first-run/needed Arduino toolchain update via `arduino-updater.js` + `arduino-update-window.js`. |
| `arduino-updater.js` | Runs `update.sh`/`update.bat` inside `src/link/tools/Arduino` (first-time AVR core bootstrap) and generic `arduino-cli core install/uninstall` actions, streaming line-by-line progress via an `EventEmitter`. |
| `arduino-update-window.js` | A small always-on-top `BrowserWindow` (using `preload-update.js`) that renders that progress stream and blocks closing until the operation finishes. |
| `menu.js` | Builds the native app menu: install/uninstall extra Arduino cores (ESP32/ESP8266/Nano 33 BLE/Uno R4), manage local `.zip` libraries, "Check Update" (re-runs `sync.js`), Sign Out, Exit. |
| `pip-manager.js` | Per-user Python virtualenv lifecycle (bootstrap, install/uninstall/list/show packages, wheel cache) with a mutex so concurrent pip operations queue rather than race. |
| `project-deps.js` | Per-project `requirements.txt` snapshot: generate/install/import/export/diff, keyed by a sanitized `projectId`. |
| `safe-install.js` | Classifies pip packages as "safe" (pure-Python, from a large hardcoded allowlist) vs "risky" (native build required) and gates installs behind a warning/preflight check. |
| `offline-cache.js` | Wheel cache under `data/wheel-cache/<platform>-py<version>/` for offline reinstall. |
| `diagnostic-bundle.js` | Collects a support bundle: OS/hardware info, pip/runner logs, preload contract check — for troubleshooting reports. |
| `recovery-mode.js` | Self-heal for a corrupted/missing bundled Python: verifies the runtime, can re-extract it and rebuild shortcuts. |
| `logger.js` | Thin wrapper around `electron-log` (file transport, `info` level). Everything else in `src/main` logs through this. |
| `utils.js` | Shared `walkDirSize`/`copyRecursive` filesystem helpers used by diagnostics and recovery. |
| `nlp.js` | Desktop-only NLP extension (sentiment/entities/intent classification/training) shelling out to a bundled/system Python one-liner per call; not part of the licensing/update flow. |

The pip/project-deps/safe-install/offline-cache/diagnostic/recovery modules are all tagged in
comments as "Phase 7" steps — they're a fairly recent, cohesive feature set for making the bundled
Python environment self-service and resilient, layered on top of the older auth/link/sync core.

**Firmware flashing — `src/link` (ported from `nomo-link`).** `src/main/link.js` instantiates
`OpenBlockLink` (`src/link/src/index.js`), a WebSocket server on port `20111` exposing
`/openblock/ble` and `/openblock/serialport` routes (BLE route is skipped on macOS) — this is the
same "openblock-link-server" protocol/architecture used by `nomo-link`. `src/link/src/session/`
holds per-connection session handlers (`ble.js`, `serialport.js`, `session.js`); `src/link/src/upload/`
holds board-specific flashers (`arduino.js`, `microbit.js`, `micropython.js` for ESP32/RP2040).
`src/link/script/download-tools.js` and `download-firmwares.js` populate `src/link/tools` /
`firmwares` from GitHub releases — the `fetch:driver` script (`rimraf tools firmwares && node
src/link/script/download-tools.js && node src/link/script/download-firmwares.js`) is nearly a
byte-for-byte match of `nomo-link`'s own `fetch` script, and both repos share dependencies
(`@abandonware/noble`, `serialport`, `download-github-release`, `js-yaml`) — strong evidence `src/link`
is a direct port of `nomo-link`'s `link/` folder rather than an independent rewrite. `main.js` also
exposes separate `micropython-flash` / `micropython-upload` / `micropython-detect` IPC handlers that
call `src/link/src/upload/micropython.js` directly (bypassing the WebSocket server) for the
renderer's MicroPython flashing UI.

**Auxiliary windows — `src/auth`, `src/connection`, `src/update`.** These are plain static
HTML/CSS/JS pages (Bootstrap-styled, Indonesian-language copy), not React/GUI-framework views —
each is loaded wholesale via `win.loadFile` in place of the main GUI:
- `src/auth/index.html` — login form; its own inline script `ipcRenderer.send("login", ...)`,
  handled by `ipc.js`.
- `src/connection/index.html` — "connection lost" holding page shown on Socket.IO `disconnect`
  (`socket.js`), auto-retries and lets the user reload.
- `src/update/index.html` (+ `arduino-update.html`) — shown while `sync.js` downloads a new
  `gui`/`link` bundle, and while `arduino-update-window.js` streams Arduino toolchain install
  progress respectively.

**Bundled Python execution flow.** Renderer calls `window.nomoproDesktopPython.runPythonCode(code)`
→ `preload.js` `ipcRenderer.invoke("nomopro-python-run", ...)` → the handler in `main.js` picks a
Python candidate via `getPythonCandidates()` (priority: per-user venv under `data/python-env` →
bundled `python/` in `resourcesPath` → system `python3`/`python`/`py`), writes the code to a temp
`.py` file (so stdin stays open for RPC-style callbacks), spawns it with `-u` (unbuffered), and
streams stdout/stderr line-by-line to the renderer via `nomopro-python-stdout`/`-stderr` events while
also buffering full output. On process close it re-parses all stdout lines as NDJSON, collecting any
line that parses as an object with a `cmd`/`action`/`args` shape into a `commands` array returned
alongside `{ exitCode, stdout, stderr, commands }`. There's also a 30s default execution timeout and
a `nomopro-python-stop`/`nomopro-python-write-stdin` pair for interactive control.

**Note:** the README documents this global as `window.openblockDesktopPython`, but the actual
`contextBridge.exposeInMainWorld` call in `preload.js` names it `nomoproDesktopPython` — that's the
name the bundled `src/gui/lib.min.js` actually calls. Trust the code over the README if they ever
disagree here. Also, `preload.js` calls `contextBridge.exposeInMainWorld("electronAPI", ...)` twice
(the whole API object, then again at the bottom with just `getAppPath`) — the second call throws in
a real contextIsolation'd renderer (`electronAPI` is already bound), so that trailing block is dead
code; don't assume both take effect.

**Auth/licensing relationship to `nomokit` (Laravel backend).** Confirmed from source (not just
inference): `src/main/ipc.js`'s `login` handler `axios.post`s to
`https://nomo-kit.com/api/login` with `{ email, password, hwid, app: "nomopro" }` — `hwid` from
`node-machine-id`'s `machineIdSync()` — which lines up with `nomokit`'s `routes/api.php` `POST
/login` route and the `hwid` / `hwid_pro` / `hwid_jr` fillable fields on `nomokit`'s `User` model
(`app/Models/User.php`); the `app: "nomopro"` tag strongly suggests the backend uses it to pick
which `hwid_*` column to bind, though the exact selection logic lives in `nomokit`'s
`AuthController` and wasn't re-verified here. `src/main/sync.js` polls
`https://nomo-kit.com/api/check-update-dektop` (matching `nomokit`'s
`CheckUpdateController::checkUpdateDesktop` route, typo included) to decide whether to download a
newer `src/gui`/`src/link` bundle, and a separate `/api/check-update` call drives the Arduino
library sync. `socket.js` also calls `nomo-kit.com/api/logout` when it detects a concurrent login
from elsewhere (`login-fail` socket event) and force-relaunches the app. The desktop app does **not**
appear to call `API\KitController::show` (the entitlement/serial-number-unlock endpoint documented in
`nomokit/CLAUDE.md`) directly from anything read here — that check is likely performed
server-side as part of what the bundled `src/gui` build fetches at runtime, not from this repo's own
main-process code.
