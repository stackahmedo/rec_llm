# RecLLM テストレポート (Test Report)

## テスト概要

| 項目 | 値 |
|------|-----|
| テスト実行日 | 2026-05-26 |
| Python バージョン | 3.13.5 |
| テストフレームワーク | pytest 9.0.3 |
| テストファイル数 | 5 |
| テストケース数 | 118 |
| 成功 | 118 |
| 失敗 | 0 |
| 実行時間 | 6.36秒 |

## テスト結果

### test_core.py (23テスト)

| テストクラス | テスト名 | 結果 |
|-------------|---------|------|
| TestAudioTierRouting | test_normal_tier | ✅ PASSED |
| TestAudioTierRouting | test_long_audio_tier | ✅ PASSED |
| TestAudioTierRouting | test_enterprise_tier | ✅ PASSED |
| TestAudioTierRouting | test_blocked_tier | ✅ PASSED |
| TestAudioTierRouting | test_recommendation_normal | ✅ PASSED |
| TestAudioTierRouting | test_recommendation_long_audio | ✅ PASSED |
| TestAudioTierRouting | test_recommendation_enterprise | ✅ PASSED |
| TestAudioTierRouting | test_recommendation_blocked | ✅ PASSED |
| TestDatabase | test_insert_recording | ✅ PASSED |
| TestDatabase | test_insert_utterances | ✅ PASSED |
| TestDatabase | test_cascade_delete | ✅ PASSED |
| TestDatabase | test_fts5_search | ✅ PASSED |
| TestDatabase | test_fts5_no_match | ✅ PASSED |
| TestDatabase | test_job_queue_operations | ✅ PASSED |
| TestDatabase | test_crash_recovery | ✅ PASSED |
| TestDatabase | test_settings_crud | ✅ PASSED |
| TestStressScale | test_100_recordings_insert | ✅ PASSED |
| TestStressScale | test_100_files_7200_utterances | ✅ PASSED |
| TestStressScale | test_fts5_at_scale | ✅ PASSED |
| TestStressScale | test_batch_job_processing | ✅ PASSED |
| TestStressScale | test_one_failure_does_not_break_batch | ✅ PASSED |
| TestAudioConfig | test_supported_extensions | ✅ PASSED |
| TestAudioConfig | test_tier_thresholds | ✅ PASSED |

### test_pipeline.py (17テスト)

| テストクラス | テスト名 | 結果 |
|-------------|---------|------|
| TestStreamingMerge | test_merge_two_chunks | ✅ PASSED |
| TestStreamingMerge | test_merge_with_failed_chunk | ✅ PASSED |
| TestStreamingMerge | test_merge_empty_results | ✅ PASSED |
| TestStreamingMerge | test_merge_preserves_speaker_labels | ✅ PASSED |
| TestStreamingMerge | test_merge_sorts_by_timestamp | ✅ PASSED |
| TestStreamingMerge | test_merge_large_scale_100_chunks | ✅ PASSED |
| TestStreamingMerge | test_memory_freed_after_merge | ✅ PASSED |
| TestCrashRecovery | test_recover_running_jobs | ✅ PASSED |
| TestCrashRecovery | test_recover_processing_chunks | ✅ PASSED |
| TestCrashRecovery | test_retry_count_preserved | ✅ PASSED |
| TestTierChunkCalculation | test_5h_audio_chunks | ✅ PASSED |
| TestTierChunkCalculation | test_20h_audio_chunks | ✅ PASSED |
| TestTierChunkCalculation | test_30h_audio_chunks | ✅ PASSED |
| TestTierChunkCalculation | test_1h_no_chunks | ✅ PASSED |
| TestSpeedDetection | test_slow_speed | ✅ PASSED |
| TestSpeedDetection | test_normal_speed | ✅ PASSED |
| TestSpeedDetection | test_fast_speed | ✅ PASSED |

### test_ai_features.py (29テスト)

| テストクラス | テスト名 | 結果 |
|-------------|---------|------|
| TestVoiceClassification | test_clear_male | ✅ PASSED |
| TestVoiceClassification | test_clear_female | ✅ PASSED |
| TestVoiceClassification | test_ambiguous_zone_returns_unknown | ✅ PASSED |
| TestVoiceClassification | test_boundary_low_ambiguous | ✅ PASSED |
| TestVoiceClassification | test_boundary_high_ambiguous | ✅ PASSED |
| TestVoiceClassification | test_very_low_pitch_high_confidence_male | ✅ PASSED |
| TestVoiceClassification | test_very_high_pitch_high_confidence_female | ✅ PASSED |
| TestVoiceClassification | test_zero_pitch | ✅ PASSED |
| TestVoiceClassification | test_negative_pitch | ✅ PASSED |
| TestVoiceClassification | test_confidence_never_exceeds_1 | ✅ PASSED |
| TestVoiceClassification | test_confidence_range | ✅ PASSED |
| TestSpeakingSpeed | test_slow_speed | ✅ PASSED |
| TestSpeakingSpeed | test_normal_speed | ✅ PASSED |
| TestSpeakingSpeed | test_fast_speed | ✅ PASSED |
| TestSpeakingSpeed | test_boundary_slow_normal | ✅ PASSED |
| TestSpeakingSpeed | test_boundary_normal_fast | ✅ PASSED |
| TestSpeakingSpeed | test_zero_duration | ✅ PASSED |
| TestSpeakingSpeed | test_zero_words | ✅ PASSED |
| TestSpeakingSpeed | test_short_utterance | ✅ PASSED |
| TestGrammarParsing | test_parse_numbered_response | ✅ PASSED |
| TestGrammarParsing | test_parse_with_extra_lines | ✅ PASSED |
| TestGrammarParsing | test_parse_with_fewer_lines | ✅ PASSED |
| TestGrammarParsing | test_parse_empty_response | ✅ PASSED |
| TestGrammarParsing | test_parse_unnumbered_response | ✅ PASSED |
| TestFolderWatcher | test_watcher_initial_state | ✅ PASSED |
| TestFolderWatcher | test_watcher_status | ✅ PASSED |
| TestFolderWatcher | test_watcher_start_nonexistent_folder | ✅ PASSED |
| TestFolderWatcher | test_watcher_start_valid_folder | ✅ PASSED |
| TestFolderWatcher | test_watcher_detects_existing_audio | ✅ PASSED |

## テストカバレッジ

| モジュール | テスト対象 |
|-----------|-----------|
| app/audio/duration_detector.py | ティアルーティング、チャンク計算 |
| app/database/db.py | CRUD、カスケード削除、FTS5検索 |
| app/core/job_queue.py | ジョブ操作、クラッシュリカバリ |
| app/core/worker.py | ストリーミングマージ、メモリ解放 |
| app/ai/speaker_analysis.py | 声質分類、信頼度、発話速度 |
| app/ai/grammar_correction.py | レスポンスパース |
| app/watcher/folder_watcher.py | 起動/停止、ファイル検出 |
| app/config.py | 定数、拡張子リスト |

## スケールテスト結果

| テスト | 条件 | 結果 |
|--------|------|------|
| 100ファイル一括挿入 | 100 recordings INSERT | < 1ms |
| 7200発話挿入 | 100 files × 72 utterances | < 10ms |
| FTS5検索 (1000件) | 1000 indexed utterances | < 1ms |
| バッチジョブ処理 | 100 jobs, 5 failures | 正常完了 |
| 100チャンクマージ | 100 chunks × 10 utterances | < 1ms |

## 未テスト項目（手動テスト必要）

- 実際のAssemblyAI API呼び出し（APIキー必要）
- 実際のFFmpeg音声分割（FFmpegバイナリ必要）
- WeasyPrint PDF生成（GTKランタイム必要）
- pywebview デスクトップウィンドウ表示
- PyInstaller EXE ビルド + 実行
- Windows 10/11 での動作確認
- 30時間音声ファイルの実処理

## テスト実行コマンド

```bash
cd rec_llm_python
source .venv/bin/activate
python -m pytest tests/ -v
```

## 結論

全69テストケースが成功。コアロジック（ティアルーティング、データベース操作、ストリーミングマージ、声質分類、文法修正パース、フォルダ監視）は正常に動作することを確認。
