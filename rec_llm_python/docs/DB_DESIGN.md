# RecLLM データベース設計書 (DB Design Document)

## 概要

SQLite 3 を使用。WALモード有効。FTS5による全文検索対応。

## ER図

```
recordings ─┬── chunks
            ├── utterances
            ├── summaries
            ├── exports
            └── metadata

speakers (独立テーブル)
jobs (独立テーブル)
settings (独立テーブル)
search_index (FTS5仮想テーブル)
```

## テーブル定義

### recordings (録音)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | TEXT | PRIMARY KEY | 一意識別子 |
| original_file_name | TEXT | NOT NULL | 元ファイル名 |
| generated_file_name | TEXT | | 生成ファイル名 |
| display_name | TEXT | | 表示名 |
| file_path | TEXT | | ファイルパス |
| file_extension | TEXT | | 拡張子 |
| size_bytes | INTEGER | DEFAULT 0 | ファイルサイズ |
| duration_seconds | REAL | | 音声長（秒） |
| recording_date | TEXT | | 録音日 |
| language_code | TEXT | DEFAULT 'auto' | 言語コード |
| speaker_count | INTEGER | DEFAULT 0 | 話者数 |
| status | TEXT | NOT NULL | pending/processing/done/failed |
| noise_reduction | INTEGER | DEFAULT 0 | ノイズ除去適用 |
| model_provider | TEXT | | AIプロバイダー |
| model_name | TEXT | | モデル名 |
| imported_at | TEXT | NOT NULL | インポート日時 |
| processed_at | TEXT | | 処理完了日時 |
| created_at | TEXT | NOT NULL | 作成日時 |

### chunks (チャンク)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| recording_id | TEXT | FK → recordings(id) CASCADE | 親録音 |
| chunk_index | INTEGER | NOT NULL | チャンク番号 |
| start_time_sec | REAL | NOT NULL | 開始時刻（秒） |
| end_time_sec | REAL | NOT NULL | 終了時刻（秒） |
| file_path | TEXT | | チャンクファイルパス |
| status | TEXT | DEFAULT 'pending' | pending/processing/done/failed/retrying |
| retry_count | INTEGER | DEFAULT 0 | リトライ回数 |
| error_message | TEXT | | エラーメッセージ |
| created_at | TEXT | NOT NULL | 作成日時 |

### utterances (発話)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| recording_id | TEXT | FK → recordings(id) CASCADE | 親録音 |
| chunk_id | INTEGER | FK → chunks(id) | 元チャンク |
| speaker | TEXT | NOT NULL DEFAULT 'Speaker' | 話者ラベル |
| text | TEXT | NOT NULL | 文字起こしテキスト |
| corrected_text | TEXT | | 修正済みテキスト |
| start_ms | INTEGER | NOT NULL | 開始時刻（ミリ秒） |
| end_ms | INTEGER | NOT NULL | 終了時刻（ミリ秒） |
| confidence | REAL | DEFAULT 1.0 | 信頼度 |
| word_count | INTEGER | | 単語数 |
| wpm | INTEGER | | 発話速度 |
| speed_label | TEXT | | slow/normal/fast |
| estimated_voice_type | TEXT | | male/female/unknown |
| voice_confidence | REAL | | 声質推定信頼度 |
| pitch_hz | REAL | | 基本周波数 |

### speakers (話者プロファイル)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| name | TEXT | NOT NULL | 話者名 |
| display_name | TEXT | | 表示名 |
| recording_count | INTEGER | DEFAULT 1 | 出現録音数 |
| total_utterances | INTEGER | DEFAULT 0 | 総発話数 |
| avg_wpm | REAL | | 平均発話速度 |
| estimated_voice_type | TEXT | | 推定声質 |
| voice_confidence | REAL | | 信頼度 |
| first_seen | TEXT | | 初出日時 |
| last_seen | TEXT | | 最終出現日時 |

### summaries (要約)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| recording_id | TEXT | FK → recordings(id) CASCADE | 親録音 |
| summary_type | TEXT | DEFAULT 'executive' | executive/mapreduce/minutes |
| language | TEXT | NOT NULL DEFAULT 'ja' | 言語 |
| summary | TEXT | | 要約テキスト |
| point_notes | TEXT | | 重要ポイント (JSON配列) |
| action_items | TEXT | | アクション項目 (JSON配列) |
| decisions | TEXT | | 決定事項 (JSON配列) |
| risks | TEXT | | リスク (JSON配列) |
| generated_at | TEXT | NOT NULL | 生成日時 |

### jobs (ジョブ)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| recording_id | TEXT | FK → recordings(id) SET NULL | 対象録音 |
| job_type | TEXT | NOT NULL | transcribe/summarize/export/grammar/translate |
| status | TEXT | NOT NULL DEFAULT 'queued' | queued/running/done/failed/cancelled |
| progress | REAL | DEFAULT 0 | 進捗 (0-100) |
| error_message | TEXT | | エラーメッセージ |
| metadata | TEXT | | ジョブ固有パラメータ (JSON) |
| created_at | TEXT | NOT NULL | 作成日時 |
| started_at | TEXT | | 開始日時 |
| completed_at | TEXT | | 完了日時 |

### exports (エクスポート履歴)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| recording_id | TEXT | FK → recordings(id) CASCADE | 対象録音 |
| export_type | TEXT | NOT NULL | pdf/txt/docx |
| file_path | TEXT | NOT NULL | 出力ファイルパス |
| include_metadata | INTEGER | DEFAULT 1 | メタデータ含む |
| created_at | TEXT | NOT NULL | 作成日時 |

### metadata (キーバリュー)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| recording_id | TEXT | FK → recordings(id) CASCADE | 対象録音 |
| key | TEXT | NOT NULL | キー |
| value | TEXT | | 値 |
| | | UNIQUE(recording_id, key) | |

### settings (設定)

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| key | TEXT | PRIMARY KEY | 設定キー |
| value | TEXT | | 設定値 (JSON) |

### search_index (FTS5全文検索)

```sql
CREATE VIRTUAL TABLE search_index USING fts5(
    recording_id,
    file_name,
    speaker,
    text,
    tokenize='unicode61'
);
```

## インデックス

```sql
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_date ON recordings(created_at);
CREATE INDEX idx_chunks_recording ON chunks(recording_id);
CREATE INDEX idx_utterances_recording ON utterances(recording_id);
CREATE INDEX idx_utterances_speaker ON utterances(speaker);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_recording ON jobs(recording_id);
CREATE INDEX idx_summaries_recording ON summaries(recording_id);
```

## PRAGMA設定

```sql
PRAGMA journal_mode = WAL;       -- 並行読み取り対応
PRAGMA synchronous = NORMAL;     -- 安全性とパフォーマンスのバランス
PRAGMA cache_size = -64000;      -- 64MBキャッシュ
PRAGMA foreign_keys = ON;        -- 外部キー制約有効
PRAGMA temp_store = MEMORY;      -- 一時テーブルをメモリに
```

## データ量見積もり

| 項目 | 1000ファイル時 |
|------|---------------|
| recordings | 1,000行 |
| chunks | ~50,000行 |
| utterances | ~500,000行 |
| search_index | ~500,000行 |
| DBファイルサイズ | ~500MB |
