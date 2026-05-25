import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { useTranscripts } from "../transcript-store";
import { useUploadJobs } from "../upload-job-store";
import { useMemo } from "react";

function Donut({ data, colors, size = 120 }: { data: { name: string; value: number }[]; colors: string[]; size?: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const seg = (
          <circle
            key={d.name}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={colors[i]}
            strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

const colors = ["#3b82f6", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6"];

export function AnalyticsPanel() {
  const { transcripts, history } = useTranscripts();
  const { jobs } = useUploadJobs();

  const stats = useMemo(() => {
    const completedJobs = history.filter((j: any) => j.status === 'done');
    const failedJobs = jobs.filter((j) => j.stage === 'failed');

    // Total duration from all completed transcripts
    let totalDurationSec = 0;
    let totalUtterances = 0;
    let totalWords = 0;
    const speakerSet = new Set<string>();
    const speedCounts = { slow: 0, normal: 0, fast: 0 };

    for (const t of transcripts) {
      for (const u of t.utterances || []) {
        totalUtterances++;
        speakerSet.add(u.speaker);
        const words = (u.text || '').split(/\s+/).length;
        totalWords += words;
        const durationSec = ((u.endMs || 0) - (u.startMs || 0)) / 1000;
        totalDurationSec += durationSec;

        // Speed classification
        if (durationSec > 0) {
          const wpm = Math.round(words / (durationSec / 60));
          if (wpm < 120) speedCounts.slow++;
          else if (wpm >= 160) speedCounts.fast++;
          else speedCounts.normal++;
        }
      }
    }

    // Processing time stats
    const processingTimes: number[] = [];
    for (const j of completedJobs) {
      if (j.createdAt && j.completedAt) {
        const elapsed = new Date(j.completedAt).getTime() - new Date(j.createdAt).getTime();
        if (elapsed > 0) processingTimes.push(elapsed / 1000);
      }
    }
    const avgProcessingTimeSec = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    // Speaker count per file
    const speakerCounts: number[] = [];
    for (const t of transcripts) {
      const speakers = new Set((t.utterances || []).map((u) => u.speaker));
      if (speakers.size > 0) speakerCounts.push(speakers.size);
    }
    const avgSpeakers = speakerCounts.length > 0
      ? Math.round(speakerCounts.reduce((a, b) => a + b, 0) / speakerCounts.length * 10) / 10
      : 0;

    return {
      totalFiles: completedJobs.length,
      failedFiles: failedJobs.length,
      pendingFiles: jobs.filter((j) => j.stage === 'queued').length,
      totalDurationHours: Math.round(totalDurationSec / 3600 * 10) / 10,
      totalUtterances,
      totalWords,
      uniqueSpeakers: speakerSet.size,
      avgSpeakers,
      avgProcessingTimeSec: Math.round(avgProcessingTimeSec),
      speedCounts,
      successRate: completedJobs.length + failedJobs.length > 0
        ? Math.round(completedJobs.length / (completedJobs.length + failedJobs.length) * 100)
        : 0,
    };
  }, [transcripts, history, jobs]);

  const speedData = [
    { name: "Slow (<120 wpm)", value: stats.speedCounts.slow },
    { name: "Normal", value: stats.speedCounts.normal },
    { name: "Fast (>160 wpm)", value: stats.speedCounts.fast },
  ];

  const statusData = [
    { name: "Completed", value: stats.totalFiles },
    { name: "Failed", value: stats.failedFiles },
    { name: "Pending", value: stats.pendingFiles },
  ];

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours} h`;
  };

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.round(sec / 60)}m`;
    return `${Math.round(sec / 3600 * 10) / 10}h`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Summary Stats */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Processing Overview</CardTitle>
          <CardDescription>Real-time statistics from your transcription history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatBox label="Files Processed" value={stats.totalFiles} />
            <StatBox label="Total Duration" value={formatDuration(stats.totalDurationHours)} />
            <StatBox label="Utterances" value={stats.totalUtterances.toLocaleString()} />
            <StatBox label="Unique Speakers" value={stats.uniqueSpeakers} sub={`avg ${stats.avgSpeakers}/file`} />
            <StatBox label="Success Rate" value={`${stats.successRate}%`} sub={`${stats.failedFiles} failed`} />
            <StatBox label="Avg Processing" value={formatTime(stats.avgProcessingTimeSec)} sub="per file" />
          </div>
        </CardContent>
      </Card>

      {/* Job Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Job Status</CardTitle>
          <CardDescription>Current queue and history breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Donut data={statusData} colors={["#10b981", "#f43f5e", "#f59e0b"]} />
            <div className="space-y-2 flex-1">
              {statusData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: ["#10b981", "#f43f5e", "#f59e0b"][i] }} />
                    <span>{d.name}</span>
                  </div>
                  <span className="font-medium tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Speaking Speed Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Speaking Speed</CardTitle>
          <CardDescription>Distribution of utterance speaking rates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Donut data={speedData} colors={["#3b82f6", "#10b981", "#f59e0b"]} />
            <div className="space-y-2 flex-1">
              {speedData.map((d, i) => {
                const total = stats.speedCounts.slow + stats.speedCounts.normal + stats.speedCounts.fast;
                const pct = total > 0 ? Math.round(d.value / total * 100) : 0;
                return (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: ["#3b82f6", "#10b981", "#f59e0b"][i] }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="font-medium tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Word Stats */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Content Statistics</CardTitle>
          <CardDescription>Aggregate text metrics across all transcripts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Words" value={stats.totalWords.toLocaleString()} />
            <StatBox
              label="Avg Words/File"
              value={stats.totalFiles > 0 ? Math.round(stats.totalWords / stats.totalFiles).toLocaleString() : '0'}
            />
            <StatBox
              label="Avg Duration/File"
              value={stats.totalFiles > 0 ? formatDuration(stats.totalDurationHours / stats.totalFiles) : '0'}
            />
            <StatBox
              label="Total Characters"
              value={stats.totalWords > 0 ? `${Math.round(stats.totalWords * 5.5 / 1000)}K` : '0'}
              sub="estimated"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
