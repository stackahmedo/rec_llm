import { Card, CardContent } from "./ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning";
}

export function StatCard({ label, value, delta, icon: Icon, tone = "default" }: StatCardProps) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-muted-foreground">{label}</div>
            <div className="mt-2">{value}</div>
            {delta && <div className={`mt-1 ${toneClass}`}>{delta}</div>}
          </div>
          <div className="size-10 rounded-md bg-muted flex items-center justify-center">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
