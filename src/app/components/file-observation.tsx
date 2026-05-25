import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import {
  FileAudio, Users, Clock, Smile, Frown, Meh, MessageSquare, Mic2,
  TrendingUp, Volume2, Languages, Tag, AlertTriangle, CheckCircle2,
  Download, Sparkles,
} from "lucide-react";

interface SpeakerStat {
  id: string; name: string; talkSec: number; turns: number; words: number;
  gender: "M" | "F"; pace: "slow" | "fast"; age: "young" | "adult" | "older";
  confidence: number; color: string;
}
interface SentimentBin { t: number; pos: number; neu: number; neg: number; }
interface TopicSlice { name: string; pct: number; mentions: number; }
interface ProcessedFile {
  id: string; name: string; duration: number; sizeMB: number; language: string;
  recordedAt: string; processedAt: string; accuracy: number; wer: number;
  corrections: number; segments: number; words: number;
  speakers: SpeakerStat[];
  sentiment: SentimentBin[];
  topics: TopicSlice[];
  emotions: { joy: number; neutral: number; sad: number; anger: number; surprise: number };
  keywords: { word: string; count: number; sentiment: "pos" | "neu" | "neg" }[];
  silenceRatio: number;
  overlapRatio: number;
  noiseLevel: number;
  loudnessLufs: number;
  lowConfidenceSegments: { tStart: string; speaker: string; text: string; conf: number }[];
}

const palette = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#ec4899"];

const files: ProcessedFile[] = [
  {
    id: "f1", name: "field_session_2026-05-19.wav",
    duration: 23 * 3600 + 41 * 60, sizeMB: 1433, language: "Quechua",
    recordedAt: "2026-05-19 06:12", processedAt: "2026-05-20 02:48",
    accuracy: 91.4, wer: 7.2, corrections: 38, segments: 1487, words: 184_220,
    speakers: [
      { id: "s1", name: "Speaker A · Elena",   talkSec: 14_120, turns: 312, words: 58_400, gender: "F", pace: "fast", age: "adult", confidence: 0.94, color: palette[0] },
      { id: "s2", name: "Speaker B · Mateo",   talkSec:  9_840, turns: 287, words: 41_200, gender: "M", pace: "slow", age: "older", confidence: 0.89, color: palette[1] },
      { id: "s3", name: "Speaker C · Rosa",    talkSec:  6_310, turns: 198, words: 28_900, gender: "F", pace: "fast", age: "adult", confidence: 0.92, color: palette[2] },
      { id: "s4", name: "Speaker D · Tupac",   talkSec:  4_870, turns: 152, words: 19_500, gender: "M", pace: "slow", age: "older", confidence: 0.81, color: palette[3] },
      { id: "s5", name: "Speaker E · Unknown", talkSec:  2_120, turns:  64, words:  8_140, gender: "M", pace: "fast", age: "young", confidence: 0.62, color: palette[4] },
    ],
    sentiment: Array.from({ length: 24 }, (_, i) => ({
      t: i,
      pos: 30 + Math.round(20 * Math.sin(i / 2.4)) + Math.round(Math.random() * 10),
      neu: 35 + Math.round(10 * Math.cos(i / 3)) + Math.round(Math.random() * 8),
      neg: 15 + Math.round(15 * Math.sin(i / 1.9 + 1)) + Math.round(Math.random() * 6),
    })),
    topics: [
      { name: "Water rights",      pct: 28, mentions: 142 },
      { name: "Crop rotation",     pct: 21, mentions: 108 },
      { name: "Local governance",  pct: 17, mentions:  87 },
      { name: "School funding",    pct: 14, mentions:  72 },
      { name: "Health clinic",     pct: 11, mentions:  54 },
      { name: "Other",             pct:  9, mentions:  41 },
    ],
    emotions: { joy: 22, neutral: 48, sad: 14, anger: 11, surprise: 5 },
    keywords: [
      { word: "agua",        count: 142, sentiment: "neu" },
      { word: "comunidad",   count: 118, sentiment: "pos" },
      { word: "presupuesto", count:  94, sentiment: "neg" },
      { word: "escuela",     count:  72, sentiment: "pos" },
      { word: "alcalde",     count:  61, sentiment: "neu" },
      { word: "salud",       count:  54, sentiment: "pos" },
      { word: "sequía",      count:  47, sentiment: "neg" },
      { word: "cosecha",     count:  43, sentiment: "pos" },
    ],
    silenceRatio: 0.18, overlapRatio: 0.07, noiseLevel: 0.22, loudnessLufs: -18.4,
    lowConfidenceSegments: [
      { tStart: "02:18:44", speaker: "Speaker E", text: "...presupuesto del próximo año será...", conf: 0.58 },
      { tStart: "05:41:02", speaker: "Speaker D", text: "...la sequía nos afectó mucho en...",   conf: 0.66 },
      { tStart: "11:09:17", speaker: "Speaker B", text: "...representantes de la comunidad...",  conf: 0.71 },
    ],
  },
  {
    id: "f2", name: "interview_block_A.mp3",
    duration: 14 * 3600 + 2 * 60, sizeMB: 812, language: "Spanish",
    recordedAt: "2026-05-15 09:30", processedAt: "2026-05-16 14:11",
    accuracy: 94.1, wer: 4.9, corrections: 14, segments: 932, words: 112_400,
    speakers: [
      { id: "s1", name: "Interviewer",  talkSec: 4_200, turns: 380, words: 24_100, gender: "F", pace: "fast", age: "adult", confidence: 0.96, color: palette[0] },
      { id: "s2", name: "Subject A",    talkSec: 6_800, turns: 290, words: 52_800, gender: "M", pace: "slow", age: "older", confidence: 0.93, color: palette[1] },
      { id: "s3", name: "Subject B",    talkSec: 3_120, turns: 184, words: 35_500, gender: "F", pace: "fast", age: "young", confidence: 0.91, color: palette[2] },
    ],
    sentiment: Array.from({ length: 14 }, (_, i) => ({
      t: i, pos: 45 + Math.round(15 * Math.sin(i)), neu: 35, neg: 20 - Math.round(8 * Math.cos(i / 2)),
    })),
    topics: [
      { name: "Personal history", pct: 34, mentions: 92 },
      { name: "Migration",        pct: 22, mentions: 61 },
      { name: "Family",           pct: 18, mentions: 48 },
      { name: "Work conditions",  pct: 15, mentions: 41 },
      { name: "Other",            pct: 11, mentions: 28 },
    ],
    emotions: { joy: 31, neutral: 41, sad: 18, anger: 4, surprise: 6 },
    keywords: [
      { word: "familia",  count: 88, sentiment: "pos" },
      { word: "trabajo",  count: 72, sentiment: "neu" },
      { word: "Lima",     count: 54, sentiment: "neu" },
      { word: "infancia", count: 41, sentiment: "pos" },
      { word: "miedo",    count: 28, sentiment: "neg" },
    ],
    silenceRatio: 0.11, overlapRatio: 0.04, noiseLevel: 0.09, loudnessLufs: -16.2,
    lowConfidenceSegments: [
      { tStart: "03:12:08", speaker: "Subject B", text: "...mi abuela me contaba que...", conf: 0.74 },
    ],
  },
];

function formatHMS(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

function StackedSentiment({ data, height = 180 }: { data: SentimentBin[]; height?: number }) {
  const w = 600, padL = 32, padR = 8, padT = 8, padB = 22;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const barW = innerW / data.length - 2;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#e5e7eb" />
      {data.map((d, i) => {
        const total = d.pos + d.neu + d.neg || 1;
        const x = padL + i * (barW + 2);
        const hPos = (d.pos / total) * innerH;
        const hNeu = (d.neu / total) * innerH;
        const hNeg = (d.neg / total) * innerH;
        return (
          <g key={`s-${i}`}>
            <rect x={x} y={padT}                          width={barW} height={hPos} fill="#10b981" />
            <rect x={x} y={padT + hPos}                   width={barW} height={hNeu} fill="#94a3b8" />
            <rect x={x} y={padT + hPos + hNeu}            width={barW} height={hNeg} fill="#ef4444" />
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="#6b7280">{d.t}h</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SpeakerTimeline({ speakers, duration }: { speakers: SpeakerStat[]; duration: number }) {
  // Pretend turn pattern by hashing speaker id
  const segs = useMemo(() => {
    const out: { sx: string; w: string; color: string; name: string }[] = [];
    let cursor = 0;
    while (cursor < 100) {
      const sp = speakers[Math.floor(Math.random() * speakers.length)] || speakers[0];
      const len = Math.min(100 - cursor, 1 + Math.random() * 6);
      out.push({ sx: `${cursor}%`, w: `${len}%`, color: sp.color, name: sp.name });
      cursor += len;
    }
    return out;
  }, [speakers, duration]);
  return (
    <div className="relative h-6 w-full rounded overflow-hidden bg-muted">
      {segs.map((s, i) => (
        <div key={`seg-${i}`} className="absolute top-0 bottom-0" style={{ left: s.sx, width: s.w, background: s.color }} title={s.name} />
      ))}
    </div>
  );
}

export function FileObservation() {
  const [fileId, setFileId] = useState(files[0].id);
  const file = files.find((f) => f.id === fileId)!;
  const talkTotal = file.speakers.reduce((s, sp) => s + sp.talkSec, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> Per-file Observation
              <span className="text-[9px] font-normal bg-yellow-100 text-yellow-800 border border-yellow-300 rounded px-1.5 py-0.5 uppercase tracking-wider">Preview</span>
            </CardTitle>
            <CardDescription>Deep analysis of any completed recording — speakers, sentiment, topics, quality. Sample data shown below.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={fileId} onValueChange={setFileId}>
              <SelectTrigger className="w-72">
                <FileAudio className="size-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {files.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm"><Download className="size-4 mr-1" />Export</Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { k: "Duration",      v: formatHMS(file.duration),     icon: Clock },
            { k: "Words",         v: file.words.toLocaleString(),   icon: MessageSquare },
            { k: "Segments",      v: file.segments.toLocaleString(),icon: Mic2 },
            { k: "Speakers",      v: file.speakers.length,          icon: Users },
            { k: "Accuracy",      v: `${file.accuracy}%`,           icon: CheckCircle2 },
            { k: "WER",           v: `${file.wer}%`,                icon: AlertTriangle },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.k} className="border rounded-md p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-3.5" />{s.k}</div>
                <div className="tabular-nums mt-1">{s.v}</div>
              </div>
            );
          })}
        </div>

        {/* File meta */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline"><Languages className="size-3 mr-1" />{file.language}</Badge>
          <Badge variant="outline">{file.sizeMB} MB</Badge>
          <Badge variant="outline">Recorded {file.recordedAt}</Badge>
          <Badge variant="outline">Processed {file.processedAt}</Badge>
          <Badge variant="outline">{file.corrections} corrections accepted</Badge>
        </div>

        <Tabs defaultValue="speakers">
          <TabsList>
            <TabsTrigger value="speakers">Speakers</TabsTrigger>
            <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="quality">Audio Quality</TabsTrigger>
            <TabsTrigger value="review">Needs Review</TabsTrigger>
          </TabsList>

          {/* SPEAKERS */}
          <TabsContent value="speakers" className="space-y-4 mt-4">
            <div>
              <div className="text-muted-foreground mb-2">Talk-time timeline</div>
              <SpeakerTimeline speakers={file.speakers} duration={file.duration} />
              <div className="flex flex-wrap gap-3 mt-2">
                {file.speakers.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: sp.color }} />
                    <span className="text-muted-foreground">{sp.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              {file.speakers.map((sp) => {
                const pct = (sp.talkSec / talkTotal) * 100;
                return (
                  <div key={sp.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ background: sp.color }} />
                        <span>{sp.name}</span>
                        <Badge variant="outline">{sp.gender === "M" ? "Male" : "Female"}</Badge>
                        <Badge variant="outline">{sp.pace}</Badge>
                        <Badge variant="outline">{sp.age}</Badge>
                      </div>
                      <div className="text-muted-foreground tabular-nums">
                        {formatHMS(sp.talkSec)} · {sp.turns} turns · {sp.words.toLocaleString()} words · conf {Math.round(sp.confidence * 100)}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={pct} className="h-2 flex-1 [&>div]:bg-[var(--c)]" style={{ ["--c" as any]: sp.color }} />
                      <span className="text-muted-foreground tabular-nums shrink-0">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* SENTIMENT */}
          <TabsContent value="sentiment" className="space-y-4 mt-4">
            <div>
              <div className="text-muted-foreground mb-2">Sentiment over time (per hour)</div>
              <StackedSentiment data={file.sentiment} />
              <div className="flex justify-center gap-4 mt-2">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Positive</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-slate-400" />Neutral</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-500" />Negative</span>
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-2">Emotion distribution</div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { k: "Joy",      v: file.emotions.joy,      icon: Smile,  c: "text-emerald-600" },
                  { k: "Neutral",  v: file.emotions.neutral,  icon: Meh,    c: "text-slate-500" },
                  { k: "Sad",      v: file.emotions.sad,      icon: Frown,  c: "text-blue-600" },
                  { k: "Anger",    v: file.emotions.anger,    icon: AlertTriangle, c: "text-red-600" },
                  { k: "Surprise", v: file.emotions.surprise, icon: TrendingUp,    c: "text-amber-600" },
                ].map((e) => {
                  const Icon = e.icon;
                  return (
                    <div key={e.k} className="border rounded-md p-3 text-center">
                      <Icon className={`size-5 mx-auto ${e.c}`} />
                      <div className="mt-1">{e.k}</div>
                      <div className="text-muted-foreground tabular-nums">{e.v}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* TOPICS */}
          <TabsContent value="topics" className="space-y-3 mt-4">
            <div className="flex h-3 rounded overflow-hidden">
              {file.topics.map((t, i) => (
                <div key={t.name} title={`${t.name} ${t.pct}%`} style={{ width: `${t.pct}%`, background: palette[i % palette.length] }} />
              ))}
            </div>
            <div className="space-y-2">
              {file.topics.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: palette[i % palette.length] }} />
                    <span>{t.name}</span>
                  </div>
                  <div className="text-muted-foreground tabular-nums">{t.mentions} mentions · {t.pct}%</div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* KEYWORDS */}
          <TabsContent value="keywords" className="mt-4">
            <div className="flex flex-wrap gap-2">
              {file.keywords.map((k) => {
                const size = 12 + Math.min(28, k.count / 5);
                const color = k.sentiment === "pos" ? "text-emerald-700 bg-emerald-50 border-emerald-300"
                  : k.sentiment === "neg" ? "text-red-700 bg-red-50 border-red-300"
                  : "text-slate-700 bg-slate-50 border-slate-300";
                return (
                  <span key={k.word} className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 ${color}`} style={{ fontSize: size }}>
                    <Tag className="size-3.5" />{k.word}
                    <span className="text-muted-foreground tabular-nums">{k.count}</span>
                  </span>
                );
              })}
            </div>
          </TabsContent>

          {/* AUDIO QUALITY */}
          <TabsContent value="quality" className="space-y-3 mt-4">
            {[
              { k: "Silence ratio",  v: file.silenceRatio,  hint: "Portion of audio with no speech detected" },
              { k: "Overlap ratio",  v: file.overlapRatio,  hint: "Two or more speakers talking simultaneously" },
              { k: "Background noise", v: file.noiseLevel, hint: "Estimated noise floor" },
            ].map((m) => (
              <div key={m.k} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>{m.k}</div>
                  <div className="text-muted-foreground tabular-nums">{(m.v * 100).toFixed(1)}%</div>
                </div>
                <Progress value={m.v * 100} className="h-2 mt-2" />
                <div className="text-muted-foreground mt-1">{m.hint}</div>
              </div>
            ))}
            <div className="border rounded-md p-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Volume2 className="size-4 text-muted-foreground" />Integrated loudness</div>
              <div className="tabular-nums">{file.loudnessLufs} LUFS</div>
            </div>
          </TabsContent>

          {/* REVIEW */}
          <TabsContent value="review" className="space-y-2 mt-4">
            {file.lowConfidenceSegments.length === 0 ? (
              <div className="text-muted-foreground">No low-confidence segments — nothing to review.</div>
            ) : file.lowConfidenceSegments.map((seg, i) => (
              <div key={`lc-${i}`} className="border rounded-md p-3 flex items-start gap-3">
                <Badge variant="outline" className="shrink-0 font-mono">{seg.tStart}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground">{seg.speaker}</div>
                  <div>"{seg.text}"</div>
                </div>
                <Badge variant="destructive" className="shrink-0">{Math.round(seg.conf * 100)}%</Badge>
                <Button variant="outline" size="sm">Review</Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
