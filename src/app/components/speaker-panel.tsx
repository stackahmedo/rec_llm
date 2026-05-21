import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Users, Pencil, Check, MessageSquare, Brain } from "lucide-react";
import { useState } from "react";
import { useTranscripts } from "../transcript-store";

const speakerColors = [
  "bg-blue-500", "bg-rose-500", "bg-amber-500",
  "bg-emerald-500", "bg-violet-500", "bg-cyan-500",
];

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SpeakerPanel() {
  const { transcripts } = useTranscripts();
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedSpeaker, setExpandedSpeaker] = useState<string | null>(null);

  // Collect unique speakers from all real transcripts
  const speakers = Array.from(
    new Map(
      transcripts.flatMap((t) =>
        t.utterances.map((u) => [u.speaker, u.speaker])
      )
    ).keys()
  );

  const startEdit = (id: string) => {
    setEditing(id);
    setEditValue(aliases[id] || "");
  };

  const saveEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      setAliases((prev) => ({ ...prev, [id]: trimmed }));
    } else {
      setAliases((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setEditing(null);
  };

  // Get all segments for a speaker
  const getSpeakerSegments = (speakerId: string) => {
    return transcripts.flatMap((t) =>
      t.utterances
        .filter((u) => u.speaker === speakerId)
        .map((u) => ({ ...u, fileName: t.fileName }))
    );
  };

  if (speakers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Users className="size-10 mx-auto mb-3 opacity-50" />
          <div className="text-lg">No speakers identified yet</div>
          <div className="mt-1">Speakers will appear here after transcription with diarization completes.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identified Speakers</CardTitle>
          <CardDescription>
            {speakers.length} speaker{speakers.length !== 1 ? "s" : ""} detected. Click the pencil to rename.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {speakers.map((id, i) => {
            const color = speakerColors[i % speakerColors.length];
            const initials = (aliases[id] || id).slice(0, 2).toUpperCase();
            const displayName = aliases[id] || `Speaker ${id}`;
            const segmentCount = transcripts.reduce(
              (sum, t) => sum + t.utterances.filter((u) => u.speaker === id).length, 0
            );
            const isEditing = editing === id;
            const isExpanded = expandedSpeaker === id;

            return (
              <div key={id} className="border rounded-lg p-4 space-y-3">
                <div className="flex gap-3">
                  <Avatar className="size-12">
                    <AvatarFallback className={`${color} text-white`}>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder={`Speaker ${id}`}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(id); }}
                          />
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(id)}>
                            <Check className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{displayName}</div>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(id)}>
                            <Pencil className="size-3" />
                          </Button>
                        </div>
                      )}
                      <Badge variant="outline">{segmentCount} segments</Badge>
                    </div>
                    {aliases[id] && (
                      <div className="text-muted-foreground text-xs mt-1">Original ID: {id}</div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isExpanded ? "secondary" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setExpandedSpeaker(isExpanded ? null : id)}
                  >
                    <MessageSquare className="size-3 mr-1" />
                    {isExpanded ? "Hide conversation" : "View conversation"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled
                    title="Coming soon"
                  >
                    <Brain className="size-3 mr-1" />
                    Analyze · Coming soon
                  </Button>
                </div>

                {/* Conversation view */}
                {isExpanded && (
                  <ScrollArea className="h-48 border rounded-md p-3">
                    <div className="space-y-2">
                      {getSpeakerSegments(id).map((seg, si) => (
                        <div key={si} className="text-sm">
                          <span className="text-muted-foreground tabular-nums text-xs mr-2">{msToTimestamp(seg.startMs)}</span>
                          <span>{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
