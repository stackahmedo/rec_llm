import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Users } from "lucide-react";
import { useTranscripts } from "../transcript-store";

export function SpeakerPanel() {
  const { transcripts } = useTranscripts();

  // Collect unique speakers from all real transcripts
  const speakers = Array.from(
    new Map(
      transcripts.flatMap((t) =>
        t.utterances.map((u) => [u.speaker, u.speaker])
      )
    ).keys()
  );

  const speakerColors = [
    "bg-blue-500", "bg-rose-500", "bg-amber-500",
    "bg-emerald-500", "bg-violet-500", "bg-cyan-500",
  ];

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
    <Card>
      <CardHeader>
        <CardTitle>Identified Speakers</CardTitle>
        <CardDescription>{speakers.length} speaker{speakers.length !== 1 ? "s" : ""} detected from transcriptions.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {speakers.map((name, i) => {
          const color = speakerColors[i % speakerColors.length];
          const initials = name.slice(0, 2).toUpperCase();
          const utteranceCount = transcripts.reduce(
            (sum, t) => sum + t.utterances.filter((u) => u.speaker === name).length, 0
          );
          return (
            <div key={name} className="border rounded-lg p-4 flex gap-3">
              <Avatar className="size-12">
                <AvatarFallback className={`${color} text-white`}>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>Speaker {name}</div>
                  <Badge variant="outline">{utteranceCount} utterances</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
