# Clean Windows Test Checklist

## Purpose

This checklist verifies that `RecLLM.exe` works on a clean Windows PC with NO developer tools installed.

## Definition of "Clean Windows PC"

The test machine must NOT have:
- [ ] Python (any version)
- [ ] Node.js / npm
- [ ] Git
- [ ] FFmpeg (not on PATH, not installed anywhere)
- [ ] Visual Studio / Build Tools
- [ ] Any pip-installed packages

The test machine SHOULD have:
- [ ] Windows 10 or 11 (64-bit)
- [ ] Internet connection (for API calls to AssemblyAI/OpenAI/Gemini)
- [ ] A test audio file (MP3 or WAV, 1-5 minutes)

## Pre-Test Setup

1. Copy `RecLLM.exe` to the test machine (USB, network share, or download)
2. Place it anywhere (Desktop, Downloads, etc.)
3. Prepare a test audio file (any MP3/WAV, 1-5 minutes with speech)

## Test Procedure

### Test 1: Application Launch

- [ ] Double-click `RecLLM.exe`
- [ ] Windows SmartScreen may appear — click "More info" → "Run anyway"
- [ ] Application window opens (pywebview) OR browser opens to `http://127.0.0.1:8765`
- [ ] Dashboard loads with stats (all zeros on first run)
- [ ] API connection indicator shows green ("API接続済み")

**Expected time**: 3-10 seconds for first launch (EXE extracts to temp)

### Test 2: Settings / API Keys

- [ ] Navigate to Settings (click "設定" or press 4)
- [ ] Enter AssemblyAI API key
- [ ] Save settings
- [ ] Toast notification confirms save

**Verify**: Settings persist after closing and reopening the app.

### Test 3: File Upload

- [ ] Navigate to Upload (click "アップロード" or press 2)
- [ ] Drag and drop a test audio file, OR click to browse
- [ ] File appears in upload queue
- [ ] Upload completes (progress bar fills, status shows "完了")
- [ ] Toast notification confirms upload

### Test 4: Audio Processing

- [ ] After upload, job appears in dashboard "最近のジョブ"
- [ ] Status changes from "処理中" to "完了"
- [ ] Recording appears in Transcripts list

**Note**: This requires a valid AssemblyAI API key. Without it, the job will fail (expected).

### Test 5: Transcript Viewing

- [ ] Navigate to Transcripts (press 3)
- [ ] Click on a completed recording
- [ ] Transcript detail view shows utterances with timestamps
- [ ] Speaker labels are visible
- [ ] WPM badges display correctly

### Test 6: Export

- [ ] From transcript detail, click "TXT出力"
- [ ] File saves to `%APPDATA%\recllm-data\exports\`
- [ ] Open the exported file — content is correct

### Test 7: Copy to Clipboard

- [ ] From transcript detail, click "コピー"
- [ ] Toast confirms copy
- [ ] Paste into Notepad — formatted transcript appears

### Test 8: Search

- [ ] Navigate to Search (press 4... wait, that's settings. Use the search bar)
- [ ] Press Cmd+K (or Ctrl+K on Windows) to focus search
- [ ] Type a word from the transcript
- [ ] Results appear

### Test 9: Dark Mode

- [ ] Click the moon/sun icon in the header
- [ ] UI switches to dark mode
- [ ] Close and reopen app — dark mode persists

### Test 10: Application Close

- [ ] Close the window (X button)
- [ ] Verify no orphan processes remain (check Task Manager for "RecLLM")
- [ ] Reopen the app — all data persists

## File Location Verification

After running the app, verify these paths exist:

```
%APPDATA%\recllm-data\
  rec_llm.sqlite          ← database with recordings, settings
  recordings\             ← uploaded audio files
  exports\                ← exported documents
  processing.log          ← log file
```

To check: open File Explorer, type `%APPDATA%\recllm-data` in the address bar.

## Error Scenarios to Test

### No Internet
- [ ] App launches without internet
- [ ] Upload works (file is stored locally)
- [ ] Processing fails gracefully with error message (no crash)

### Invalid API Key
- [ ] Enter an invalid API key
- [ ] Processing fails with clear error (not a crash)
- [ ] App remains usable

### Large File (>100MB)
- [ ] Upload a large audio file
- [ ] App does not freeze during upload
- [ ] Progress is visible

### Unsupported Format
- [ ] Try uploading a .txt or .jpg file
- [ ] App rejects with clear error message

## Known Limitations

1. **First launch is slow** — PyInstaller extracts bundled files to a temp directory (~5-10s)
2. **Windows SmartScreen** — unsigned EXE triggers a warning on first run
3. **Antivirus** — some AV software may flag the EXE; whitelist if needed
4. **Port 8765** — if another app uses this port, RecLLM won't start (rare)

## Reporting Issues

If a test fails, collect:
1. Screenshot of the error
2. The log file: `%APPDATA%\recllm-data\processing.log`
3. Windows version (Settings → System → About)
4. Whether any error dialog appeared

## Pass Criteria

All tests 1-10 pass = **Client-ready**
Tests 1-3 pass but 4+ fail = **Packaging works, API integration issue**
Test 1 fails = **Build/packaging issue — do not ship**
