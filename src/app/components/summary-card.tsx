import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Sparkles } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

const items = [
  "Lower-terrace planting started one week behind schedule due to dry soil.",
  "Irrigation channel rerouting proposed to avoid a repeat of the 2024 yield loss.",
  "Cooperative agreed to share two new water pumps if storage can be secured.",
  "Shed roof leak from January 2026 still unrepaired — blocker for pump storage.",
  "Three speakers identified in this 23h41m session; one new voice profile added.",
  "Overlapping speech successfully separated in 92% of multi-voice segments.",
  "Killa flagged a delay in seed delivery from the regional supplier.",
  "Amaru emphasized the need for additional volunteers during harvest week.",
  "Inti reported successful negotiation with the cooperative on equipment sharing.",
  "Sumaq shared ceremonial calendar that aligns with planting cycles.",
  "Cross-village meeting scheduled for 2026-06-02 to discuss water allocation.",
  "Sensor data referenced for soil moisture in lower terrace — to be cross-checked.",
  "Two requests for training on the new transcription dashboard noted.",
  "Reported decline in younger participation in the morning sessions.",
  "Proposal to record weekly cooperative meetings going forward.",
];

export function SummaryCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              30-Item Session Summary
            </CardTitle>
            <CardDescription>Auto-generated structured digest · powered by Gemini batch pipeline</CardDescription>
          </div>
          <Badge variant="secondary">Draft</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 pr-4">
          <ol className="space-y-2.5">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="leading-relaxed">{it}</span>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
