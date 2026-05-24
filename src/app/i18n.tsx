import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Lang = "en" | "ja" | "both";

type Dict = Record<string, string>;

const en: Dict = {
  // Brand
  "brand.name": "RecLLM",
  "brand.tagline": "Audio Intelligence",
  "user.role": "User",

  // Nav
  "nav.dashboard": "Dashboard",
  "nav.upload": "Upload & Process",
  "nav.transcripts": "Transcripts",
  "nav.pdf": "PDF Editor",
  "nav.library": "File Library",
  "nav.speakers": "Speakers",
  "nav.analytics": "Analytics",
  "nav.settings": "Settings",

  // Page subtitles
  "page.dashboard.sub": "Overview of recordings, processing and AI learning",
  "page.upload.sub": "Batch-transfer multi-hour recordings for transcription",
  "page.transcripts.sub": "Review, correct and export diarized transcripts",
  "page.pdf.sub": "Annotate, sign, redact and edit documents",
  "page.library.sub": "Metadata storage — browse, filter and export every file",
  "page.speakers.sub": "Manage voice profiles and recognition accuracy",
  "page.analytics.sub": "Processing throughput and classification breakdowns",
  "page.settings.sub": "Pipeline, model and access configuration",

  // Header
  "header.search": "Search recordings, speakers...",
  "header.newSession": "New Session",

  // Dashboard stats
  "stat.audioProcessed": "Audio processed",
  "stat.audioProcessed.delta": "+38h this week",
  "stat.activeRecordings": "Active recordings",
  "stat.activeRecordings.delta": "3 in queue",
  "stat.speakerProfiles": "Speaker profiles",
  "stat.speakerProfiles.delta": "2 awaiting training",
  "stat.avgAccuracy": "Avg. accuracy",
  "stat.avgAccuracy.delta": "+3.2% vs last week",

  // Needs attention
  "attention.title": "Needs Attention",
  "attention.sub": "Tasks waiting on a human",
  "attention.review": "Review",
  "attention.assign": "Assign",
  "attention.inspect": "Inspect",

  // Upload panel
  "upload.title": "Batch Processing Queue",
  "upload.desc": "Drop multi-hour recordings here. Metadata (duration, sample rate, language) is captured automatically.",
  "upload.drag": "Drag recordings here or click to browse",
  "upload.release": "Release to upload",
  "upload.formats": "WAV · MP3 · M4A · FLAC · OGG · up to 24h per file",
  "upload.select": "Select Files",
  "upload.selectFolder": "Select Folder",
  "upload.queue": "Queue",
  "upload.clearDone": "Clear completed",
  "upload.files": "Files",
  "upload.active": "Active",
  "upload.totalSize": "Total size",
  "upload.totalAudio": "Total audio",
  "upload.eta": "ETA",
  "upload.stage": "stage",
  "upload.of": "of",
  "upload.pause": "Pause",
  "upload.resume": "Resume",
  "upload.retry": "Retry",
  "upload.viewDetails": "View details",
  "upload.restart": "Restart pipeline",
  "upload.remove": "Remove",

  // Stages
  "stage.queued": "Queued",
  "stage.uploading": "Uploading",
  "stage.preprocess": "Preprocess",
  "stage.diarizing": "Diarizing",
  "stage.transcribing": "Transcribing",
  "stage.classifying": "Classifying",
  "stage.summarizing": "Summarizing",
  "stage.done": "Complete",
  "stage.failed": "Failed",
  "stage.paused": "Paused",

  // Settings
  "settings.language.title": "Language / 言語",
  "settings.language.desc": "Switch the interface language. Applies instantly.",
  "settings.language.english": "English",
  "settings.language.japanese": "日本語 (Japanese)",
  "settings.language.both": "Dual (English + 日本語)",
  "settings.transcription.title": "Transcription Engine",
  "settings.transcription.desc": "Audio → text. Used for diarization and segment-level confidence scoring.",
  "settings.summary.title": "Summary Engine",
  "settings.summary.desc": "Generates the structured 30-item digest from each transcript. Pick one provider.",
  "settings.storage.title": "Storage & Security",
  "settings.storage.desc": "API keys are encrypted at rest. Only this workspace can decrypt them.",
  "settings.reset": "Reset",
  "settings.save": "Save settings",
  "settings.apiKey": "API key",
  "settings.model": "Model",
  "settings.checkConnection": "Check connection",
  "settings.getKey": "Get a key",
  "settings.notVerified": "Not verified",
  "settings.checking": "Checking…",
  "settings.connected": "Connected",
  "settings.invalidKey": "Invalid key",
  "settings.active": "Active",
  "settings.defaultLanguage": "Default language",
  "settings.diarization": "Speaker diarization",
  "settings.diarizationDesc": "Separate overlapping voices into channels.",

  // Roles & engines
  "roles.title": "Roles & AI Engines",
  "roles.desc": "Assign a different engine (or your own custom one) to each pipeline role.",
  "roles.addEngine": "Add engine",
  "roles.pipelineRoles": "Pipeline roles",
  "roles.enginePool": "Engine pool",
  "roles.reuse": "Any role can reuse these engines",
  "roles.live": "Live",
  "roles.unverified": "Unverified",
  "roles.unused": "Unused",
  "roles.custom": "custom",
  "role.transcription": "Transcription",
  "role.transcription.desc": "Audio → text",
  "role.diarization": "Diarization",
  "role.diarization.desc": "Separate overlapping voices",
  "role.summary": "Summary",
  "role.summary.desc": "Generate 30-item digest",
  "role.classification": "Voice Classification",
  "role.classification.desc": "Gender, pace, age tagging",
  "role.translation": "Translation",
  "role.translation.desc": "Translate transcripts",
  "role.chatbot": "Chat Assistant",
  "role.chatbot.desc": "Ask questions about recordings",

  // Common
  "common.cancel": "Cancel",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.verify": "Verify",
  "common.copy": "Copy",
  "common.export": "Export",
  "common.save": "Save",
  "common.close": "Close",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.loading": "Loading...",
  "common.retry": "Retry",
  "common.generate": "Generate",
  "common.regenerate": "Regenerate",
  "common.translate": "Translate",
  "common.print": "Print",
  "common.download": "Download",
  "common.copied": "Copied to clipboard",
  "common.processing": "Processing...",
  "common.done": "Done",
  "common.failed": "Failed",
  "common.noData": "No data",

  // Transcript workspace
  "transcript.title": "Transcripts",
  "transcript.segments": "segments",
  "transcript.speakers": "speakers",
  "transcript.duration": "duration",
  "transcript.noSelected": "No transcript selected",
  "transcript.noSelectedDesc": "Upload and process audio files to begin, or select a session from the list.",
  "transcript.loading": "Loading transcript…",
  "transcript.empty": "Transcript is empty",
  "transcript.emptyDesc": "This file produced no segments.",
  "transcript.segmentUpdated": "Segment updated",
  "transcript.loadMore": "Load more",
  "transcript.remaining": "remaining",
  "transcript.jumpTo": "Jumped to",
  "transcript.editSegment": "Click to edit",
  "transcript.expandSpeaker": "Expand speaker",
  "transcript.collapseSpeaker": "Collapse speaker",

  // AI Workspace
  "ai.summary": "Summary",
  "ai.keyPoints": "Key Points",
  "ai.actions": "Actions",
  "ai.translation": "Translation",
  "ai.chat": "AI Chat",
  "ai.executiveSummary": "Executive Summary",
  "ai.noSummary": "No summary yet",
  "ai.generateSummary": "Generate Summary",
  "ai.actionItems": "Action Items",
  "ai.generateActions": "Generate summary to extract actions",
  "ai.generateKeyPoints": "Generate summary to extract key points",
  "ai.decisions": "Decisions",
  "ai.risks": "Risks",
  "ai.commandPlaceholder": "Ask AI about this transcript…",
  "ai.commandSlash": "/ for commands",
  "ai.chatPlaceholder": "Ask about this transcript...",
  "ai.chatEmpty": "Ask AI about this transcript",
  "ai.chatExamples.1": "\"Summarize professionally\"",
  "ai.chatExamples.2": "\"Extract all deadlines\"",
  "ai.chatExamples.3": "\"What did Speaker A decide?\"",
  "ai.lastGenerated": "ago",
  "ai.analysisModules": "AI Analysis Modules",
  "ai.sentiment": "Sentiment",
  "ai.sentimentDesc": "Emotional tone analysis",
  "ai.topics": "Topics",
  "ai.topicsDesc": "Discussion themes",
  "ai.speakerInsights": "Speaker Insights",
  "ai.speakerInsightsDesc": "Per-speaker analysis",
  "ai.timeline": "Timeline",
  "ai.timelineDesc": "Key moments",
  "ai.followups": "Follow-ups",
  "ai.followupsDesc": "Unresolved items",

  // Translation
  "translation.full": "Translate Full Transcript",
  "translation.bilingual": "Bilingual View",
  "translation.bySpeaker": "Translate by Speaker",
  "translation.preserves": "Preserves timestamps and speaker labels.",

  // Filters
  "filter.all": "All",
  "filter.questions": "Questions",
  "filter.decisions": "Decisions",
  "filter.tasks": "Tasks",
  "filter.risks": "Risks",
  "filter.speaker": "Speaker",
  "filter.allSpeakers": "All Speakers",

  // Export
  "export.pdf": "PDF Report",
  "export.txt": "Plain Text",
  "export.pdfExported": "PDF exported",
  "export.txtExported": "TXT exported",

  // PDF Editor
  "pdf.properties": "Properties",
  "pdf.inspector": "Inspector",
  "pdf.toolSettings": "Tool Settings",
  "pdf.color": "Color",
  "pdf.opacity": "Opacity",
  "pdf.fontSize": "Font Size",
  "pdf.stroke": "Stroke",
  "pdf.annotations": "Annotations",
  "pdf.template": "Template",
  "pdf.watermark": "Watermark",
  "pdf.review": "Review",
  "pdf.enableWatermark": "Enable watermark",
  "pdf.presets": "Presets",
  "pdf.text": "Text",
  "pdf.rotation": "Rotation",
  "pdf.submitReview": "Submit for Review",
  "pdf.history": "History",

  // Queue
  "queue.title": "Processing Queue",
  "queue.files": "files",
  "queue.noFiles": "No files in queue",
  "queue.noFilesDesc": "Add audio files using the toolbar above",
  "queue.chunk": "Chunk",
  "queue.longAudio": "Long audio detected",

  // Notifications
  "notify.summaryGenerated": "Summary generated",
  "notify.summaryFailed": "Summary generation failed",
  "notify.notAvailable": "Not available in browser mode",

  // Settings - UI
  "settings.uiScale.title": "UI Text Size",
  "settings.uiScale.desc": "Adjust the interface text scaling for readability.",
  "settings.uiScale.compact": "Compact",
  "settings.uiScale.default": "Default",
  "settings.uiScale.large": "Large",
  "settings.uiScale.extraLarge": "Extra Large",
};

const ja: Dict = {
  // Brand
  "brand.name": "RecLLM",
  "brand.tagline": "音声インテリジェンス",
  "user.role": "ユーザー",

  // Nav
  "nav.dashboard": "ダッシュボード",
  "nav.upload": "アップロードと処理",
  "nav.transcripts": "文字起こし",
  "nav.pdf": "PDFエディター",
  "nav.library": "ファイルライブラリ",
  "nav.speakers": "話者",
  "nav.analytics": "分析",
  "nav.settings": "設定",

  // Page subtitles
  "page.dashboard.sub": "録音・処理・AI学習の概要",
  "page.upload.sub": "長時間録音を一括で文字起こし用に転送",
  "page.transcripts.sub": "話者分離済みの文字起こしを確認・修正・エクスポート",
  "page.pdf.sub": "ドキュメントに注釈・署名・墨消し・編集",
  "page.library.sub": "メタデータ保管庫 — すべてのファイルを閲覧・絞り込み・エクスポート",
  "page.speakers.sub": "音声プロファイルと認識精度の管理",
  "page.analytics.sub": "処理スループットと分類の内訳",
  "page.settings.sub": "パイプライン・モデル・アクセス設定",

  // Header
  "header.search": "録音や話者を検索...",
  "header.newSession": "新規セッション",

  // Dashboard stats
  "stat.audioProcessed": "処理済み音声",
  "stat.audioProcessed.delta": "今週 +38時間",
  "stat.activeRecordings": "進行中の録音",
  "stat.activeRecordings.delta": "3件待機中",
  "stat.speakerProfiles": "話者プロファイル",
  "stat.speakerProfiles.delta": "2件が学習待ち",
  "stat.avgAccuracy": "平均精度",
  "stat.avgAccuracy.delta": "先週比 +3.2%",

  // Needs attention
  "attention.title": "要対応",
  "attention.sub": "人間の対応待ちタスク",
  "attention.review": "確認",
  "attention.assign": "割り当て",
  "attention.inspect": "調査",

  // Upload panel
  "upload.title": "一括処理キュー",
  "upload.desc": "長時間の録音をここにドロップ。メタデータ(再生時間・サンプルレート・言語)は自動取得されます。",
  "upload.drag": "録音をドラッグ、またはクリックして選択",
  "upload.release": "離してアップロード",
  "upload.formats": "WAV · MP3 · M4A · FLAC · OGG · 1ファイル最大24時間",
  "upload.select": "ファイルを選択",
  "upload.selectFolder": "フォルダを選択",
  "upload.queue": "キュー",
  "upload.clearDone": "完了分をクリア",
  "upload.files": "ファイル",
  "upload.active": "実行中",
  "upload.totalSize": "合計サイズ",
  "upload.totalAudio": "合計時間",
  "upload.eta": "残り",
  "upload.stage": "ステージ",
  "upload.of": "/",
  "upload.pause": "一時停止",
  "upload.resume": "再開",
  "upload.retry": "再試行",
  "upload.viewDetails": "詳細を表示",
  "upload.restart": "パイプラインを再開",
  "upload.remove": "削除",

  // Stages
  "stage.queued": "待機中",
  "stage.uploading": "アップロード中",
  "stage.preprocess": "前処理",
  "stage.diarizing": "話者分離中",
  "stage.transcribing": "文字起こし中",
  "stage.classifying": "分類中",
  "stage.summarizing": "要約中",
  "stage.done": "完了",
  "stage.failed": "失敗",
  "stage.paused": "一時停止",

  // Settings
  "settings.language.title": "言語 / Language",
  "settings.language.desc": "UIの言語を切り替えます。即時反映されます。",
  "settings.language.english": "English (英語)",
  "settings.language.japanese": "日本語",
  "settings.language.both": "デュアル (英語 + 日本語)",
  "settings.transcription.title": "文字起こしエンジン",
  "settings.transcription.desc": "音声 → テキスト。話者分離とセグメント単位の信頼度評価に使用。",
  "settings.summary.title": "要約エンジン",
  "settings.summary.desc": "各文字起こしから30項目の構造化サマリを生成します。1つを選択してください。",
  "settings.storage.title": "ストレージとセキュリティ",
  "settings.storage.desc": "APIキーは保存時に暗号化されます。このワークスペースのみが復号できます。",
  "settings.reset": "リセット",
  "settings.save": "設定を保存",
  "settings.apiKey": "APIキー",
  "settings.model": "モデル",
  "settings.checkConnection": "接続を確認",
  "settings.getKey": "キーを取得",
  "settings.notVerified": "未確認",
  "settings.checking": "確認中…",
  "settings.connected": "接続済み",
  "settings.invalidKey": "無効なキー",
  "settings.active": "有効",
  "settings.defaultLanguage": "既定の言語",
  "settings.diarization": "話者分離",
  "settings.diarizationDesc": "重なった音声をチャンネルごとに分離します。",

  // Roles & engines
  "roles.title": "ロールとAIエンジン",
  "roles.desc": "パイプラインの各ロールに異なるエンジン(または独自のもの)を割り当てます。",
  "roles.addEngine": "エンジンを追加",
  "roles.pipelineRoles": "パイプラインのロール",
  "roles.enginePool": "エンジンプール",
  "roles.reuse": "どのロールからも再利用できます",
  "roles.live": "稼働中",
  "roles.unverified": "未確認",
  "roles.unused": "未使用",
  "roles.custom": "カスタム",
  "role.transcription": "文字起こし",
  "role.transcription.desc": "音声 → テキスト",
  "role.diarization": "話者分離",
  "role.diarization.desc": "重なった音声を分離",
  "role.summary": "要約",
  "role.summary.desc": "30項目のダイジェストを生成",
  "role.classification": "音声分類",
  "role.classification.desc": "性別・話速・年齢のタグ付け",
  "role.translation": "翻訳",
  "role.translation.desc": "文字起こしを翻訳",
  "role.chatbot": "チャットアシスタント",
  "role.chatbot.desc": "録音について質問する",

  // Common
  "common.cancel": "キャンセル",
  "common.edit": "編集",
  "common.delete": "削除",
  "common.verify": "確認",
  "common.copy": "コピー",
  "common.export": "エクスポート",
  "common.save": "保存",
  "common.close": "閉じる",
  "common.search": "検索",
  "common.filter": "フィルター",
  "common.loading": "読み込み中...",
  "common.retry": "再試行",
  "common.generate": "生成",
  "common.regenerate": "再生成",
  "common.translate": "翻訳",
  "common.print": "印刷",
  "common.download": "ダウンロード",
  "common.copied": "クリップボードにコピーしました",
  "common.processing": "処理中...",
  "common.done": "完了",
  "common.failed": "失敗",
  "common.noData": "データなし",

  // Transcript workspace
  "transcript.title": "文字起こし",
  "transcript.segments": "セグメント",
  "transcript.speakers": "話者",
  "transcript.duration": "再生時間",
  "transcript.noSelected": "文字起こしが選択されていません",
  "transcript.noSelectedDesc": "音声ファイルをアップロードして処理を開始するか、リストからセッションを選択してください。",
  "transcript.loading": "文字起こしを読み込み中…",
  "transcript.empty": "文字起こしが空です",
  "transcript.emptyDesc": "このファイルからセグメントは生成されませんでした。",
  "transcript.segmentUpdated": "セグメントを更新しました",
  "transcript.loadMore": "さらに読み込む",
  "transcript.remaining": "件残り",
  "transcript.jumpTo": "ジャンプ先",
  "transcript.editSegment": "クリックして編集",
  "transcript.expandSpeaker": "話者を展開",
  "transcript.collapseSpeaker": "話者を折りたたむ",

  // AI Workspace
  "ai.summary": "要約",
  "ai.keyPoints": "要点",
  "ai.actions": "アクション",
  "ai.translation": "翻訳",
  "ai.chat": "AIチャット",
  "ai.executiveSummary": "エグゼクティブサマリー",
  "ai.noSummary": "要約がまだありません",
  "ai.generateSummary": "要約を生成",
  "ai.actionItems": "アクション項目",
  "ai.generateActions": "要約を生成してアクションを抽出",
  "ai.generateKeyPoints": "要約を生成して要点を抽出",
  "ai.decisions": "決定事項",
  "ai.risks": "リスク",
  "ai.commandPlaceholder": "この文字起こしについてAIに質問…",
  "ai.commandSlash": "/ でコマンド",
  "ai.chatPlaceholder": "この文字起こしについて質問...",
  "ai.chatEmpty": "この文字起こしについてAIに質問",
  "ai.chatExamples.1": "「プロフェッショナルに要約して」",
  "ai.chatExamples.2": "「すべての期限を抽出して」",
  "ai.chatExamples.3": "「話者Aは何を決定した？」",
  "ai.lastGenerated": "前",
  "ai.analysisModules": "AI分析モジュール",
  "ai.sentiment": "感情分析",
  "ai.sentimentDesc": "感情トーンの分析",
  "ai.topics": "トピック",
  "ai.topicsDesc": "議論テーマ",
  "ai.speakerInsights": "話者インサイト",
  "ai.speakerInsightsDesc": "話者ごとの分析",
  "ai.timeline": "タイムライン",
  "ai.timelineDesc": "重要な瞬間",
  "ai.followups": "フォローアップ",
  "ai.followupsDesc": "未解決の項目",

  // Translation
  "translation.full": "全文を翻訳",
  "translation.bilingual": "バイリンガル表示",
  "translation.bySpeaker": "話者別に翻訳",
  "translation.preserves": "タイムスタンプと話者ラベルを保持します。",

  // Filters
  "filter.all": "すべて",
  "filter.questions": "質問",
  "filter.decisions": "決定事項",
  "filter.tasks": "タスク",
  "filter.risks": "リスク",
  "filter.speaker": "話者",
  "filter.allSpeakers": "全話者",

  // Export
  "export.pdf": "PDFレポート",
  "export.txt": "プレーンテキスト",
  "export.pdfExported": "PDFをエクスポートしました",
  "export.txtExported": "TXTをエクスポートしました",

  // PDF Editor
  "pdf.properties": "プロパティ",
  "pdf.inspector": "インスペクター",
  "pdf.toolSettings": "ツール設定",
  "pdf.color": "色",
  "pdf.opacity": "不透明度",
  "pdf.fontSize": "フォントサイズ",
  "pdf.stroke": "線幅",
  "pdf.annotations": "注釈",
  "pdf.template": "テンプレート",
  "pdf.watermark": "透かし",
  "pdf.review": "レビュー",
  "pdf.enableWatermark": "透かしを有効にする",
  "pdf.presets": "プリセット",
  "pdf.text": "テキスト",
  "pdf.rotation": "回転",
  "pdf.submitReview": "レビューに提出",
  "pdf.history": "履歴",

  // Queue
  "queue.title": "処理キュー",
  "queue.files": "ファイル",
  "queue.noFiles": "キューにファイルがありません",
  "queue.noFilesDesc": "上のツールバーから音声ファイルを追加してください",
  "queue.chunk": "チャンク",
  "queue.longAudio": "長時間音声を検出しました",

  // Notifications
  "notify.summaryGenerated": "要約を生成しました",
  "notify.summaryFailed": "要約の生成に失敗しました",
  "notify.notAvailable": "ブラウザモードでは利用できません",

  // Settings - UI
  "settings.uiScale.title": "UI文字サイズ",
  "settings.uiScale.desc": "読みやすさのためにインターフェースの文字サイズを調整します。",
  "settings.uiScale.compact": "コンパクト",
  "settings.uiScale.default": "標準",
  "settings.uiScale.large": "大",
  "settings.uiScale.extraLarge": "特大",
};

const dictionaries: Record<"en" | "ja", Dict> = { en, ja };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem("voicelens.lang") as Lang) || "en";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("voicelens.lang", l); } catch {}
  };

  const value = useMemo<I18nCtx>(() => ({
    lang,
    setLang,
    t: (key: string) => {
      const e = dictionaries.en[key] ?? key;
      const j = dictionaries.ja[key] ?? e;
      if (lang === "en") return e;
      if (lang === "ja") return j;
      if (e === j) return e;
      return `${e} / ${j}`;
    },
  }), [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
