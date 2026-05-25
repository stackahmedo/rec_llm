# RecLLM — Windows Installation Guide

> **Build type:** Local test build (ARM64)
> **Version:** 0.1.0
> **Status:** Pre-release — unsigned installer

This guide walks you through installing and using RecLLM on Windows. No programming knowledge is required.

---

## 1. System Requirements

| Requirement | Details |
|-------------|---------|
| Operating System | Windows 10 (version 1809+) or Windows 11 |
| Architecture | ARM64 (this build) — x64 build coming soon for most PCs |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk Space | ~400 MB for installation |
| Internet | Required for transcription and AI summarization |

**No pre-installation required.** The following are all bundled inside the app:

- No Python needed
- No Node.js needed
- No npm needed
- No FFmpeg needed

All runtime dependencies are packaged internally. You only need the installer file.

---

## 2. Download / Copy Installer

The installer file is:

```
RecLLM Setup 0.1.0.exe
```

**Size:** approximately 284 MB

Since this is a local test build, you will receive the installer directly (USB drive, shared folder, or file transfer). There is no public download page yet.

Copy the `.exe` file to a convenient location such as your Desktop or Downloads folder.

---

## 3. How to Install

1. Double-click **RecLLM Setup 0.1.0.exe**
2. If a Windows SmartScreen warning appears, see Section 4 below
3. Choose installation options:
   - **Install for current user only** (recommended) — no admin rights needed
   - **Install for all users** — requires administrator password
4. Choose the installation folder or accept the default
5. Click **Install**
6. Wait for the installation to complete
7. Click **Finish** to close the installer

<!-- Screenshot placeholder: installation wizard -->

---

## 4. Windows SmartScreen Warning

Because this is an unsigned test build, Windows will show a security warning. This is expected and normal for pre-release software.

**How to proceed:**

1. When you see "Windows protected your PC", click **More info**
2. The publisher will show as "Unknown publisher"
3. Click **Run anyway**

<!-- Screenshot placeholder: SmartScreen warning dialog -->
<!-- Screenshot placeholder: SmartScreen "Run anyway" button -->

> **Why does this happen?**
> Microsoft requires developers to purchase a code-signing certificate for the warning to disappear. This will be resolved in the stable release.

---

## 5. First Launch

1. Open the Start Menu
2. Search for **RecLLM**
3. Click the app to launch it

On first launch:
- The app window will appear after a few seconds
- You will see the main upload screen
- No login or account creation is required

<!-- Screenshot placeholder: main screen on first launch -->

---

## 6. How to Add API Keys

RecLLM uses external AI services for transcription and summarization. You need to provide at least one API key.

### Adding a Transcription Key (AssemblyAI)

1. Open **Settings** (gear icon in the sidebar)
2. Find the **AssemblyAI** section
3. Paste your API key into the field
4. The key is saved automatically and stored securely (encrypted)

### Adding a Summarization Key

You can use one of the following providers:

| Provider | Where to get a key |
|----------|-------------------|
| Google Gemini | ai.google.dev |
| OpenAI (ChatGPT) | platform.openai.com |
| Groq | console.groq.com |

1. Open **Settings**
2. Select your preferred summarization provider
3. Paste the API key
4. Choose your preferred model from the dropdown

<!-- Screenshot placeholder: settings panel with API key fields -->

> **Your keys are encrypted** on your machine using Windows system-level encryption. They are never sent anywhere except to the respective AI service.

---

## 7. How to Transcribe Audio

1. From the main screen, click **Upload** or drag and drop an audio file
2. Supported formats: MP3, WAV, M4A, FLAC, OGG, WMA, and most common audio/video formats
3. Select the language of the audio (or leave on auto-detect)
4. Click **Start Transcription**
5. Wait for processing — progress is shown on screen

Once complete:
- The transcript appears with speaker labels (Speaker 1, Speaker 2, etc.)
- You can rename speakers by clicking on their labels
- You can request an AI summary by clicking the summarize button

<!-- Screenshot placeholder: transcription in progress -->
<!-- Screenshot placeholder: completed transcript with speakers -->

> **Long recordings:** Files over 1 hour are automatically processed in chunks. You can close the app and reopen it — processing continues in the background.

---

## 8. Export PDF / TXT / DOCX

After transcription is complete:

1. Click the **Export** button (top-right area of the transcript view)
2. Choose your format:
   - **PDF** — formatted report with speaker labels and optional summary
   - **TXT** — plain text transcript
   - **DOCX** — Word document format
3. Choose where to save the file
4. Click **Save**

The PDF export includes:
- Meeting/recording title
- Date and duration
- Speaker-labeled transcript
- AI-generated summary (if requested)

<!-- Screenshot placeholder: export options menu -->
<!-- Screenshot placeholder: sample PDF output -->

---

## 9. Default Storage Locations

RecLLM stores its data in the following locations:

| Data | Location |
|------|----------|
| App installation | `C:\Users\<you>\AppData\Local\Programs\RecLLM\` |
| Settings & history | `C:\Users\<you>\AppData\Roaming\RecLLM\` |
| Exported files | Wherever you choose during export |

> **Note:** Your original audio files are never copied or moved. The app reads them from wherever you selected them.

---

## 10. Troubleshooting

### App won't start

- Make sure you are running Windows 10 version 1809 or later
- Try right-clicking the app and selecting **Run as administrator**
- Check if antivirus software is blocking the app — add an exception if needed

### Transcription fails

- Verify your AssemblyAI API key is correct in Settings
- Check your internet connection
- Ensure the audio file is not corrupted (try playing it in another app first)

### Summarization fails

- Verify your summarization API key is correct
- Check that you have remaining credits/quota with your AI provider
- Try switching to a different provider in Settings

### App shows blank white screen

- Close the app completely (check system tray)
- Delete the cache folder: `C:\Users\<you>\AppData\Roaming\RecLLM\Cache`
- Relaunch the app

### Audio format not recognized

- The app handles most formats automatically via the bundled FFmpeg
- If a file fails, try converting it to MP3 or WAV using any free converter

---

## 11. Uninstall Instructions

### Method 1: Windows Settings

1. Open **Settings** → **Apps** → **Installed apps**
2. Search for **RecLLM**
3. Click the three-dot menu → **Uninstall**
4. Follow the prompts

### Method 2: From Start Menu

1. Open the Start Menu
2. Right-click **RecLLM**
3. Select **Uninstall**

### Removing leftover data

After uninstalling, you can optionally delete:
- `C:\Users\<you>\AppData\Roaming\RecLLM\` (settings and history)

---

## 12. Notes for Future Stable Release

This is an early test build. The following improvements are planned:

- **x64 build** — will support the majority of Windows PCs (Intel/AMD processors)
- **Code signing** — eliminates the SmartScreen warning
- **Auto-update** — the app will update itself when new versions are available
- **Public download page** — no more manual file transfers
- **Installer size optimization** — smaller download through better compression
- **Windows Store listing** — one-click install from the Microsoft Store (under consideration)

---

*RecLLM v0.1.0 — Local Test Build (ARM64)*
