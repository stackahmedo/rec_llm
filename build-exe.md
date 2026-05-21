# Build a Desktop EXE (Windows / macOS / Linux)

VoiceLens is a React SPA. To ship it as a native desktop app — `.exe` on Windows, `.dmg` on macOS, `.AppImage` / `.deb` on Linux — wrap it with **Tauri** (recommended, ~10 MB) or **Electron** (familiar, ~150 MB).

Recommendation: **Tauri**. Smaller binaries, lower RAM, native webview, no Chromium bundled.

---

## Option A — Tauri (recommended)

### 1. Prerequisites

| Platform | Install |
|---|---|
| Windows | [Rust](https://rustup.rs) + Microsoft C++ Build Tools + WebView2 (preinstalled on Win11) |
| macOS   | `xcode-select --install`, then [Rust](https://rustup.rs) |
| Linux   | Rust, `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` |

Verify:

```bash
rustc --version
node --version   # >= 18
pnpm --version
```

### 2. Add Tauri to the project

```bash
pnpm add -D @tauri-apps/cli @tauri-apps/api
pnpm tauri init
```

Answer the prompts:

- App name: `VoiceLens AI`
- Window title: `VoiceLens AI`
- Web assets dir (relative to `src-tauri/tauri.conf.json`): `../dist`
- Dev server URL: `http://localhost:5173`
- Dev command: `pnpm dev`
- Build command: `pnpm build`

This creates `src-tauri/` next to your app.

### 3. Configure `src-tauri/tauri.conf.json`

Key fields to set:

```json
{
  "productName": "VoiceLens AI",
  "version": "0.1.0",
  "identifier": "ai.voicelens.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [{
      "title": "VoiceLens AI",
      "width": 1400,
      "height": 900,
      "minWidth": 1024,
      "minHeight": 700
    }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg", "appimage", "deb"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

Drop your icons into `src-tauri/icons/`. Tauri ships a helper:

```bash
pnpm tauri icon path/to/source-1024.png
```

### 4. Run in dev

```bash
pnpm tauri dev
```

A native window opens around the live dev server. Hot reload works.

### 5. Build the installer

```bash
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`:

| OS | Artifact |
|---|---|
| Windows | `nsis/VoiceLens AI_0.1.0_x64-setup.exe` |
| macOS   | `dmg/VoiceLens AI_0.1.0_aarch64.dmg` |
| Linux   | `appimage/voicelens-ai_0.1.0_amd64.AppImage` |

### 6. Cross-compiling

You can only build the artifact for the OS you're currently on. To get all three, use GitHub Actions with three matrix jobs (`windows-latest`, `macos-latest`, `ubuntu-latest`) — a starter workflow lives at https://tauri.app/v1/guides/building/cross-platform.

### 7. Code-signing (optional but recommended)

- **Windows**: buy an EV code-signing cert, set `TAURI_KEY_PASSWORD` and `TAURI_PRIVATE_KEY` env vars before `tauri build`.
- **macOS**: enroll in the Apple Developer Program, set `APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. Notarization runs automatically.
- **Linux**: no signing needed for AppImage; for `.deb` use `dpkg-sig`.

---

## Option B — Electron (if you need Node APIs)

```bash
pnpm add -D electron electron-builder concurrently wait-on
```

Create `electron/main.cjs`:

```js
const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  if (isDev) win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
```

Add to `package.json`:

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "electron:dev": "concurrently -k \"pnpm dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "pnpm build && electron-builder"
  },
  "build": {
    "appId": "ai.voicelens.app",
    "productName": "VoiceLens AI",
    "files": ["dist/**/*", "electron/**/*"],
    "win":   { "target": "nsis", "icon": "build/icon.ico" },
    "mac":   { "target": "dmg",  "icon": "build/icon.icns" },
    "linux": { "target": "AppImage", "icon": "build/icon.png" }
  }
}
```

Run:

```bash
pnpm electron:dev     # develop
pnpm electron:build   # produce installer in dist/
```

---

## Which one to pick

| | Tauri | Electron |
|---|---|---|
| Installer size | ~8–12 MB | ~120–180 MB |
| RAM at idle | ~80 MB | ~250 MB |
| Native APIs | Rust commands | Node APIs |
| Webview | OS-native (WebView2 / WKWebView) | Bundled Chromium |
| Learning curve | Some Rust if you extend the backend | All JS |

If you only need to ship the React UI in a window, **Tauri** wins. If you need heavy Node-side libraries (e.g. local FFmpeg via `fluent-ffmpeg`), **Electron** is simpler.

---

## Notes specific to VoiceLens

- The dev server runs on **5173** by default — make sure `devUrl` matches.
- All API keys are stored in `localStorage` (encrypted). In the desktop build they live in the webview's profile dir, which Tauri persists per-OS:
  - Windows: `%APPDATA%\ai.voicelens.app\`
  - macOS:   `~/Library/Application Support/ai.voicelens.app/`
  - Linux:   `~/.local/share/ai.voicelens.app/`
- CORS-restricted providers (notably AssemblyAI uploads) work natively in the desktop build because the webview is not subject to browser-origin CORS the same way — but you may still want to proxy them through a Tauri command for production hardening.
- The PDF editor uses `OffscreenCanvas` + WASM (Tesseract.js). Both are supported by WebView2 and WKWebView.
