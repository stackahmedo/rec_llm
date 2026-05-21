import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Lang = "en" | "ja" | "both";

type Dict = Record<string, string>;

const en: Dict = {
  // Brand
  "brand.name": "VoiceLens AI",
  "brand.tagline": "Audio Intelligence",
  "user.role": "Researcher",

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
};

const ja: Dict = {
  // Brand
  "brand.name": "VoiceLens AI",
  "brand.tagline": "音声インテリジェンス",
  "user.role": "リサーチャー",

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
