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
