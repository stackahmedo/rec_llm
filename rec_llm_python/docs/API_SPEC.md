# RecLLM API仕様書 (API Specification)

## Base URL

```
http://127.0.0.1:8765/api
```

## 認証

ローカルアプリケーションのため認証不要。localhost限定。

---

## Endpoints

### Health Check

```
GET /api/health
```

**Response:**
```json
{ "status": "ok", "version": "0.2.0" }
```

---

### Recordings

#### 一覧取得

```
GET /api/recordings/?limit=50&offset=0
```

**Response:**
```json
{
  "recordings": [
    {
      "id": "abc123",
      "original_file_name": "meeting_2025.mp3",
      "duration_seconds": 3600.5,
      "language_code": "ja",
      "speaker_count": 3,
      "status": "done",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### 詳細取得

```
GET /api/recordings/{recording_id}
```

**Response:**
```json
{
  "recording": { ... },
  "utterances": [
    {
      "id": 1,
      "speaker": "Speaker A",
      "text": "こんにちは",
      "start_ms": 0,
      "end_ms": 2000,
      "confidence": 0.95,
      "wpm": 140,
      "speed_label": "normal"
    }
  ]
}
```

#### インポート

```
POST /api/recordings/import
Content-Type: application/json

{ "file_path": "/path/to/audio.mp3" }
```

**Response:**
```json
{
  "id": "abc123",
  "file_name": "audio.mp3",
  "duration_seconds": 7200.0,
  "tier": "long_audio",
  "recommendation": "Long audio: 10 chunks × 45min, parallel processing.",
  "total_chunks": 10
}
```

#### 削除

```
DELETE /api/recordings/{recording_id}
```

**Response:**
```json
{ "ok": true }
```

#### 統計

```
GET /api/recordings/{recording_id}/stats
```

**Response:**
```json
{
  "utterance_count": 450,
  "speaker_count": 3,
  "avg_wpm": 142.5,
  "duration_seconds": 3600.0
}
```

---

### Jobs

#### 一覧取得

```
GET /api/jobs/?status=queued&limit=50
```

**Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "recording_id": "abc123",
      "job_type": "transcribe",
      "status": "running",
      "progress": 45.0,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### 統計

```
GET /api/jobs/stats
```

**Response:**
```json
{
  "total": 100,
  "queued": 5,
  "running": 2,
  "done": 88,
  "failed": 5
}
```

#### リトライ

```
POST /api/jobs/{job_id}/retry
```

**Response:**
```json
{ "ok": true, "job_id": 5 }
```

#### キャンセル

```
POST /api/jobs/{job_id}/cancel
```

#### 全失敗リトライ

```
POST /api/jobs/retry-all-failed
```

**Response:**
```json
{ "ok": true, "retried": 3 }
```

---

### Search

#### 全文検索

```
POST /api/search/
Content-Type: application/json

{
  "query": "議事録",
  "date_from": "2025-01-01",
  "date_to": "2025-12-31",
  "language": "ja",
  "speaker": "田中",
  "limit": 50
}
```

**Response:**
```json
{
  "results": [
    {
      "recording_id": "abc123",
      "file_name": "meeting.mp3",
      "speaker": "Speaker A",
      "matched_text": "...本日の議事録について...",
      "match_field": "Transcript",
      "date": "2025-01-15T10:30:00Z",
      "language": "ja"
    }
  ],
  "total": 12
}
```

---

### Settings

#### 全設定取得

```
GET /api/settings/
```

**Response:**
```json
{
  "language": "ja",
  "noise_reduction": true,
  "speaker_detection": true
}
```

#### 設定更新

```
PUT /api/settings/
Content-Type: application/json

{ "key": "language", "value": "\"ja\"" }
```

#### APIキー保存

```
POST /api/settings/api-keys
Content-Type: application/json

{
  "assemblyai": "sk-xxx...",
  "gemini": "AIza...",
  "openai": "sk-..."
}
```

#### APIキー状態確認

```
GET /api/settings/api-keys/status
```

**Response:**
```json
{
  "assemblyai": true,
  "gemini": false,
  "openai": true
}
```

---

## AI Processing

#### 要約生成

```
POST /api/ai/summarize
Content-Type: application/json

{ "recording_id": "abc123", "language": "ja" }
```

**Response:**
```json
{
  "ok": true,
  "summary": "会議の要約...",
  "pointNotes": ["ポイント1", "ポイント2"],
  "actionItems": ["アクション1"],
  "decisions": ["決定事項1"],
  "risks": ["リスク1"]
}
```

#### 文法修正

```
POST /api/ai/grammar
Content-Type: application/json

{ "recording_id": "abc123" }
```

**Response:**
```json
{ "ok": true, "correctedCount": 15 }
```

#### 翻訳

```
POST /api/ai/translate
Content-Type: application/json

{ "recording_id": "abc123", "target_language": "en", "mode": "full" }
```

**Response:**
```json
{ "ok": true, "translatedCount": 120, "targetLanguage": "en" }
```

#### 要約取得

```
GET /api/ai/summaries/{recording_id}
```

**Response:**
```json
{
  "summaries": [
    {
      "id": 1,
      "summaryType": "executive",
      "language": "ja",
      "summary": "...",
      "pointNotes": [],
      "actionItems": [],
      "decisions": [],
      "risks": [],
      "generatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

## Speakers

#### 録音の話者分析

```
GET /api/speakers/{recording_id}
```

**Response:**
```json
{
  "speakers": [
    {
      "speaker": "Speaker A",
      "utterance_count": 45,
      "total_words": 1200,
      "avg_wpm": 142,
      "speed_label": "normal",
      "estimated_voice_type": "male",
      "voice_confidence": 0.85
    }
  ]
}
```

#### 全話者一覧

```
GET /api/speakers/?limit=50
```

#### 話者名変更

```
PUT /api/speakers/{recording_id}/rename?old_name=Speaker+A&new_name=田中
```

---

## Batch Import

#### 一括インポート

```
POST /api/batch/batch-import
Content-Type: application/json

{
  "files": [
    { "file_path": "/path/to/file1.mp3" },
    { "file_path": "/path/to/file2.wav" }
  ],
  "auto_start": true
}
```

**Response:**
```json
{
  "imported": 2,
  "failed": 0,
  "results": [
    { "id": "abc123", "file_name": "file1.mp3", "duration_seconds": 3600, "tier": "normal", "total_chunks": 1 }
  ],
  "errors": []
}
```

---

## Exports

#### エクスポート作成

```
POST /api/exports/
Content-Type: application/json

{
  "recording_id": "abc123",
  "export_type": "pdf",
  "include_metadata": true,
  "include_summary": true,
  "language": "ja"
}
```

**Response:**
```json
{ "ok": true, "filePath": "/path/to/output.pdf", "exportType": "pdf" }
```

#### エクスポート履歴

```
GET /api/exports/history?recording_id=abc123
```

---

## Analytics

#### 概要統計

```
GET /api/analytics/overview
```

**Response:**
```json
{
  "totalRecordings": 150,
  "totalHours": 245.5,
  "totalUtterances": 50000,
  "uniqueSpeakers": 25,
  "avgWpm": 142.5,
  "statusCounts": { "done": 140, "failed": 5, "pending": 3, "processing": 2 },
  "speedCounts": { "slow": 5000, "normal": 40000, "fast": 5000 }
}
```

#### 本日の統計

```
GET /api/analytics/today
```

#### 話者統計

```
GET /api/analytics/speakers
```

---

## Folder Watcher

#### 状態確認

```
GET /api/watcher/status
```

**Response:**
```json
{ "active": true, "folderPath": "/path/to/watch", "knownFileCount": 15 }
```

#### 監視開始

```
POST /api/watcher/start
Content-Type: application/json

{ "folder_path": "/path/to/watch" }
```

#### 監視停止

```
POST /api/watcher/stop
```

---

## エラーレスポンス

```json
{
  "detail": "Recording not found"
}
```

HTTP Status Codes:
- 200: 成功
- 400: リクエスト不正
- 404: リソース未検出
- 500: サーバーエラー

---

## WebSocket (将来実装)

```
WS /api/ws/progress
```

リアルタイム進捗通知用。ジョブの進捗更新をプッシュ配信。
