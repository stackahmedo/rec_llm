# Upload Queue UX Redesign

## Problems (Before)

1. **Blocking modal** — `UploadConfirmDialog` showed ALL pending files in a modal. With 85+ files, the modal overflowed and froze the UI.
2. **No folder upload** — Only individual file selection via `dialog.showOpenDialog({ properties: ['openFile'] })`.
3. **No virtualization** — `ProcessingQueue` rendered every `QueueCard` in the DOM. 100+ items caused visible lag.
4. **No batch actions** — No way to start all, pause all, retry failed, or remove multiple items at once.
5. **Tiny card layout** — Each job used a full card (~80px height), wasting vertical space at scale.

## Architecture (After)

### State Management

`upload-job-store.tsx` — Context store with localStorage persistence:
- `addJobs()` — direct queue insertion (no intermediate "paused" state)
- `startAll()` — resume all paused → queued
- `pauseAll()` — pause all queued → paused
- `retryFailed()` — retry all failed → queued
- `removeSelected(ids)` — batch remove by ID set
- `clearDone()` — remove completed items

### Electron IPC

| Handler | Purpose |
|---------|---------|
| `dialog:openAudioFiles` | Multi-file picker (existing) |
| `dialog:openAudioFolder` | Folder picker + recursive scan (new) |

`scanFolderForAudio(dirPath)` recursively walks directories, filters by `AUDIO_EXTENSIONS`, returns `AudioFileMeta[]`.

### Renderer Components

| Component | Role |
|-----------|------|
| `upload-toolbar.tsx` | Add Files + Add Folder buttons, drag-drop, batch action buttons, stats |
| `processing-queue.tsx` | Virtualized list (`@tanstack/react-virtual`), compact 36px rows, multi-select |
| `upload-workstation.tsx` | Layout: toolbar + queue + inspector (unchanged) |

### Renderer Optimization

- **Virtualization**: `useVirtualizer` from `@tanstack/react-virtual` renders only visible rows
- **Memoized rows**: `QueueRow` wrapped in `memo()` — only re-renders when its specific job changes
- **Compact layout**: 36px row height vs 80px cards = 2.2x more visible items
- **No blocking modal**: Files go directly to queue with a toast notification

## Flow

```
User clicks "Add Files" or "Add Folder"
  → Native dialog opens
  → Files/folder scanned
  → Jobs added directly to queue as "queued"
  → Toast: "85 files added to queue"
  → Processing engine picks up queued jobs sequentially
  → Long audio auto-routes to chunked pipeline
  → Failed jobs persist with retry option
  → Completed jobs stay until "Clear Done"
```

## Persistence

- Jobs persist to `localStorage` key `recllm-upload-jobs`
- On app restart, in-progress jobs marked as "paused" (interrupted)
- Completed/failed/queued jobs survive restart
- Only manual "Clear Done" or "Remove" deletes items

## Implementation Phases

1. ✅ Folder upload IPC (`electron/main.ts`, `preload.ts`, `electron.d.ts`)
2. ✅ Batch actions in store (`upload-job-store.tsx`)
3. ✅ Direct-to-queue toolbar (`upload-toolbar.tsx`)
4. ✅ Virtualized queue with compact rows (`processing-queue.tsx`)
5. ✅ i18n keys for batch actions (`i18n.tsx`)
