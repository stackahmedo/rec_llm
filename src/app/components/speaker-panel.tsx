import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

const speakers = [
  { name: "Amaru", initials: "AM", color: "bg-blue-500", traits: ["male", "slow", "older"], samples: 142, accuracy: 96, style: "Reflective, agricultural domain" },
  { name: "Killa", initials: "KI", color: "bg-rose-500", traits: ["female", "fast", "adult"], samples: 118, accuracy: 92, style: "Decisive, planning-oriented" },
  { name: "Inti", initials: "IN", color: "bg-amber-500", traits: ["male", "fast", "young"], samples: 76, accuracy: 81, style: "Cooperative coordination" },
  { name: "Sumaq", initials: "SU", color: "bg-emerald-500", traits: ["female", "slow", "older"], samples: 64, accuracy: 89, style: "Ceremonial, storytelling" },
  { name: "Mayu", initials: "MA", color: "bg-violet-500", traits: ["female", "fast", "young"], samples: 51, accuracy: 78, style: "Education outreach" },
  { name: "Wayra", initials: "WA", color: "bg-cyan-500", traits: ["male", "slow", "adult"], samples: 40, accuracy: 85, style: "Logistics" },
];

export function SpeakerPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Identified Speakers</CardTitle>
        <CardDescription>{speakers.length} of ~10 voice profiles trained. Accuracy improves with each correction.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {speakers.map((s) => (
          <div key={s.name} className="border rounded-lg p-4 flex gap-3">
            <Avatar className="size-12">
              <AvatarFallback className={`${s.color} text-white`}>{s.initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>{s.name}</div>
                <Badge variant="outline">{s.samples} samples</Badge>
              </div>
              <div className="text-muted-foreground">{s.style}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.traits.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Recognition accuracy</span>
                  <span>{s.accuracy}%</span>
                </div>
                <Progress value={s.accuracy} className="mt-1" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
