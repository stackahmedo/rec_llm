// Search service — searches local app data only (transcripts, summaries, history, speakers)

export interface SearchResult {
  id: string;
  type: "transcript" | "summary" | "history" | "speaker";
  fileId: string;
  fileName: string;
  matchedText: string;
  matchField: string;
  date: string;
  language: string;
  speaker?: string;
  timestamp?: string;
  hasSummary: boolean;
  hasPdf: boolean;
  status: "done" | "failed";
}

export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  language?: string;
  speaker?: string;
  status?: "done" | "failed" | "all";
  hasSummary?: boolean | null;
  hasPdf?: boolean | null;
}

interface TranscriptData {
  fileId: string;
  fileName: string;
  fullText: string;
  languageCode: string;
  utterances: Array<{ speaker: string; startMs: number; endMs: number; text: string }>;
  completedAt?: string;
}

interface SummaryData {
  fileId: string;
  language: string;
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
  generatedAt: string;
}

interface HistoryJob {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  status: "done" | "failed";
  languageCode: string;
  speakerCount: number;
  createdAt: string;
  completedAt: string;
  pdfPath?: string;
}

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function extractSnippet(text: string, query: string, contextChars: number = 60): string {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text.slice(0, contextChars * 2);
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

function matchesFilters(
  job: HistoryJob,
  summaries: SummaryData[],
  filters: SearchFilters
): boolean {
  if (filters.status && filters.status !== "all" && job.status !== filters.status) return false;
  if (filters.language && job.languageCode !== filters.language) return false;
  if (filters.dateFrom && job.completedAt < filters.dateFrom) return false;
  if (filters.dateTo && job.completedAt > filters.dateTo + "T23:59:59") return false;
  if (filters.hasSummary === true && !summaries.find((s) => s.fileId === job.id)) return false;
  if (filters.hasSummary === false && summaries.find((s) => s.fileId === job.id)) return false;
  if (filters.hasPdf === true && !job.pdfPath) return false;
  if (filters.hasPdf === false && job.pdfPath) return false;
  return true;
}

export function searchAppData(
  query: string,
  transcripts: TranscriptData[],
  summaries: SummaryData[],
  history: HistoryJob[],
  filters: SearchFilters = {}
): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  if (!q) return [];

  // Build lookup maps
  const summaryMap = new Map(summaries.map((s) => [s.fileId, s]));
  const historyMap = new Map(history.map((h) => [h.id, h]));

  // Search transcripts (file name + utterance text + speaker names)
  for (const tr of transcripts) {
    const job = historyMap.get(tr.fileId);
    if (job && !matchesFilters(job, summaries, filters)) continue;

    // Filter by speaker if specified
    const speakerFilter = filters.speaker?.toLowerCase();

    // Match file name
    if (tr.fileName.toLowerCase().includes(q)) {
      results.push({
        id: `tr-name-${tr.fileId}`,
        type: "transcript",
        fileId: tr.fileId,
        fileName: tr.fileName,
        matchedText: tr.fileName,
        matchField: "File name",
        date: tr.completedAt || "",
        language: tr.languageCode,
        hasSummary: summaryMap.has(tr.fileId),
        hasPdf: !!job?.pdfPath,
        status: job?.status || "done",
      });
    }

    // Match utterances
    for (const u of tr.utterances) {
      if (speakerFilter && !u.speaker.toLowerCase().includes(speakerFilter)) continue;

      if (u.text.toLowerCase().includes(q)) {
        results.push({
          id: `tr-utt-${tr.fileId}-${u.startMs}`,
          type: "transcript",
          fileId: tr.fileId,
          fileName: tr.fileName,
          matchedText: extractSnippet(u.text, q),
          matchField: "Transcript",
          date: tr.completedAt || "",
          language: tr.languageCode,
          speaker: u.speaker,
          timestamp: msToTimestamp(u.startMs),
          hasSummary: summaryMap.has(tr.fileId),
          hasPdf: !!job?.pdfPath,
          status: job?.status || "done",
        });
        // Limit utterance matches per transcript to avoid flooding
        if (results.filter((r) => r.fileId === tr.fileId && r.type === "transcript").length >= 5) break;
      }

      // Match speaker name
      if (u.speaker.toLowerCase().includes(q) && !results.find((r) => r.id === `sp-${tr.fileId}-${u.speaker}`)) {
        results.push({
          id: `sp-${tr.fileId}-${u.speaker}`,
          type: "speaker",
          fileId: tr.fileId,
          fileName: tr.fileName,
          matchedText: u.speaker,
          matchField: "Speaker",
          date: tr.completedAt || "",
          language: tr.languageCode,
          speaker: u.speaker,
          hasSummary: summaryMap.has(tr.fileId),
          hasPdf: !!job?.pdfPath,
          status: job?.status || "done",
        });
      }
    }
  }

  // Search summaries
  for (const sm of summaries) {
    const job = historyMap.get(sm.fileId);
    if (job && !matchesFilters(job, summaries, filters)) continue;

    const tr = transcripts.find((t) => t.fileId === sm.fileId);
    const fileName = tr?.fileName || job?.fileName || sm.fileId;

    const searchableFields = [
      { text: sm.summary, field: "Summary" },
      ...sm.pointNotes.map((n) => ({ text: n, field: "Key point" })),
      ...sm.actionItems.map((n) => ({ text: n, field: "Action item" })),
      ...sm.decisions.map((n) => ({ text: n, field: "Decision" })),
      ...sm.risks.map((n) => ({ text: n, field: "Risk" })),
    ];

    for (const { text, field } of searchableFields) {
      if (text.toLowerCase().includes(q)) {
        results.push({
          id: `sm-${sm.fileId}-${field}-${text.slice(0, 20)}`,
          type: "summary",
          fileId: sm.fileId,
          fileName,
          matchedText: extractSnippet(text, q),
          matchField: field,
          date: sm.generatedAt || "",
          language: sm.language,
          hasSummary: true,
          hasPdf: !!job?.pdfPath,
          status: job?.status || "done",
        });
        break; // One match per field type per summary
      }
    }
  }

  // Search history (file names for jobs without loaded transcripts)
  for (const job of history) {
    if (!matchesFilters(job, summaries, filters)) continue;
    // Skip if already matched via transcript
    if (results.find((r) => r.fileId === job.id && r.matchField === "File name")) continue;

    if (job.fileName.toLowerCase().includes(q)) {
      results.push({
        id: `hist-${job.id}`,
        type: "history",
        fileId: job.id,
        fileName: job.fileName,
        matchedText: job.fileName,
        matchField: "File name",
        date: job.completedAt,
        language: job.languageCode,
        hasSummary: summaryMap.has(job.id),
        hasPdf: !!job.pdfPath,
        status: job.status,
      });
    }
  }

  // Sort by date descending
  results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Limit total results
  return results.slice(0, 50);
}
