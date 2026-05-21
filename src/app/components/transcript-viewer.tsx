import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Play, Pause, Edit3, Check, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import { Slider } from "./ui/slider";

interface Segment {
  id: number;
  speaker: string;
  initials: string;
  color: string;
  start: string;
  text: string;
  tags: string[];
  confidence: number;
  edited?: boolean;
}

const segments: Segment[] = [
  {
    id: 1, speaker: "Speaker 01 · Amaru",
    initials: "AM", color: "bg-blue-500",
    start: "00:00:12", confidence: 0.96,
    text: "We started the planting in the lower terrace last week. The soil there is much drier than I expected after the late rains.",
    tags: ["male", "slow", "older"],
  },
  {
    id: 2, speaker: "Speaker 02 · Killa",
    initials: "KI", color: "bg-rose-500",
    start: "00:00:34", confidence: 0.92,
    text: "We may need to reroute the irrigation channel before the next cycle — otherwise we lose another harvest like in 2024.",
    tags: ["female", "fast", "adult"], edited: true,
  },
  {
    id: 3, speaker: "Speaker 03 · Inti",
    initials: "IN", color: "bg-amber-500",
    start: "00:01:08", confidence: 0.74,
    text: "[overlapping] ... and the cooperative meeting agreed to share two of the new pumps if we can store them safely.",
    tags: ["male", "fast", "young"],
  },
  {
    id: 4, speaker: "Speaker 01 · Amaru",
    initials: "AM", color: "bg-blue-500",
    start: "00:01:41", confidence: 0.88,
    text: "Storage is the difficult part. The shed roof still has the leak from January that we never repaired.",
    tags: ["male", "slow", "older"],
  },
];

export function TranscriptViewer() {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState([12]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>field_session_2026-05-19.wav</CardTitle>
          <CardDescription>23h 41m · 3 speakers identified · captured 2026-05-19 06:12 UTC</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Sparkles className="size-4 mr-1" />Summarize</Button>
          <Button size="sm">Export</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <Button size="icon" onClick={() => setPlaying(!playing)}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <div className="tabular-nums text-muted-foreground">00:{pos[0].toString().padStart(2, "0")}:34</div>
            <Slider value={pos} onValueChange={setPos} max={100} className="flex-1" />
            <div className="tabular-nums text-muted-foreground">23:41:00</div>
            <Button variant="ghost" size="icon"><Volume2 className="size-4" /></Button>
          </div>
          <div className="mt-3 flex items-end gap-0.5 h-12">
            {Array.from({ length: 80 }).map((_, i) => {
              const h = 20 + Math.abs(Math.sin(i * 0.7)) * 70 + Math.abs(Math.cos(i * 0.3)) * 20;
              return <div key={i} className="flex-1 bg-primary/60 rounded-sm" style={{ height: `${h}%` }} />;
            })}
          </div>
        </div>

        <div className="space-y-4">
          {segments.map((seg) => (
            <div key={seg.id} className="flex gap-3 group">
              <Avatar className="size-9">
                <AvatarFallback className={`${seg.color} text-white`}>{seg.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{seg.speaker}</span>
                  <span className="text-muted-foreground tabular-nums">{seg.start}</span>
                  {seg.tags.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                  <Badge variant={seg.confidence > 0.9 ? "secondary" : "outline"}>
                    {Math.round(seg.confidence * 100)}%
                  </Badge>
                  {seg.edited && (
                    <Badge className="bg-emerald-600"><Check className="size-3 mr-1" />corrected · trained</Badge>
                  )}
                </div>
                <p className="mt-1 leading-relaxed">{seg.text}</p>
                <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-7"><Edit3 className="size-3 mr-1" />Correct & train AI</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
