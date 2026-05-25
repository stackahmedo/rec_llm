# Windows Shortcut Fix — Root Cause and Resolution

## Problem

After installing RecLLM via the NSIS installer on Windows, users encountered a "missing shortcut" warning. Desktop and Start Menu shortcuts were either not created or pointed to an incorrect target.

## Root Cause

Two issues in `package.json`:

### 1. Missing top-level `productName`

```json
// BEFORE — top-level productName was absent
{
  "name": "recllm",
  "private": true,
  ...
}
```

electron-builder uses `productName` to determine the executable filename and shortcut display name. When only `build.productName` is set (not the top-level field), some NSIS template variables resolve inconsistently — particularly the shortcut target path and display name.

### 2. NSIS config missing explicit shortcut directives

```json
// BEFORE
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowToChangeInstallationDirectory": true
}
```

Without `createDesktopShortcut`, `createStartMenuShortcut`, and `shortcutName`, electron-builder's NSIS template falls back to heuristic behavior that can fail when:
- The build is cross-compiled (macOS → Windows via Wine)
- The executable name contains mixed case
- `perMachine` is false (per-user install paths differ from defaults)

## Fix Applied

### package.json changes

```json
// Added top-level productName
{
  "name": "recllm",
  "productName": "RecLLM",
  "private": true,
  ...
}
```

```json
// Explicit NSIS shortcut config
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "RecLLM"
}
```

## What each field does

| Field | Purpose |
|-------|---------|
| `productName` (top-level) | Sets exe filename (`RecLLM.exe`) and default shortcut label |
| `createDesktopShortcut` | Explicitly instructs NSIS to create a Desktop `.lnk` |
| `createStartMenuShortcut` | Explicitly instructs NSIS to create a Start Menu `.lnk` |
| `shortcutName` | The display name for both shortcuts (overrides any fallback) |

## Shortcut target resolution

After the fix, the NSIS installer creates shortcuts pointing to:

```
Per-user install:
  %LOCALAPPDATA%\Programs\RecLLM\RecLLM.exe

Per-machine install:
  %PROGRAMFILES%\RecLLM\RecLLM.exe
```

The shortcut name displayed to the user is "RecLLM" in both Desktop and Start Menu.

## Verification

- Build completes without errors: `npm run dist:win`
- Installer produced: `release/RecLLM Setup 0.1.0.exe` (284 MB)
- Unpacked exe: `release/win-arm64-unpacked/RecLLM.exe`
- Uninstall entry uses the same `shortcutName` for Add/Remove Programs display

## Notes

- No app code was modified — only `package.json` build configuration
- No branding changes — `shortcutName` matches existing `build.productName`
- x64 target remains available for future builds (change `win.target` or pass `--x64`)
- The fix is architecture-independent and applies to both ARM64 and x64 builds
