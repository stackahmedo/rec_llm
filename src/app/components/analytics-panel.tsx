import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { FileObservation } from "./file-observation";

function GroupedBars({ data, keys, colors, names, height = 260 }: {
  data: Record<string, any>[]; keys: string[]; colors: string[]; names: string[]; height?: number;
}) {
  const w = 600, padL = 40, padR = 12, padT = 14, padB = 28;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)));
  const groupW = innerW / data.length;
  const barW = (groupW - 8) / keys.length;
  const ticks = 4;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const y = padT + (innerH * i) / ticks;
          const val = Math.round((max * (ticks - i)) / ticks);
          return (
            <g key={`g${i}`}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">{val}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = padL + i * groupW + 4;
          return (
            <g key={`row-${i}`}>
              {keys.map((k, j) => {
                const v = Number(d[k]) || 0;
                const h = (v / max) * innerH;
                const x = gx + j * barW;
                const y = padT + innerH - h;
                return <rect key={`b-${i}-${j}`} x={x} y={y} width={barW - 2} height={h} fill={colors[j]} rx={3} />;
              })}
              <text x={gx + (groupW - 8) / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-center gap-4 mt-1">
        {names.map((n, i) => (
          <div key={n} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: colors[i] }} />{n}
          </div>
        ))}
      </div>
    </div>
  );
}

function LineSpark({ data, height = 220, min = 60, max = 100 }: {
  data: { label: string; value: number }[]; height?: number; min?: number; max?: number;
}) {
  const w = 600, padL = 40, padR = 12, padT = 14, padB = 28;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const stepX = innerW / Math.max(1, data.length - 1);
  const yFor = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${padL + i * stepX} ${yFor(d.value)}`).join(" ");
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = padT + (innerH * i) / ticks;
        const val = Math.round(max - ((max - min) * i) / ticks);
        return (
          <g key={`g${i}`}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">{val}</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#10b981" strokeWidth={3} />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={padL + i * stepX} cy={yFor(d.value)} r={4} fill="#10b981" />
          <text x={padL + i * stepX} y={height - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

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

const weekly = [
  { day: "Mon", hours: 18, corrections: 12 },
  { day: "Tue", hours: 22, corrections: 9 },
  { day: "Wed", hours: 14, corrections: 6 },
  { day: "Thu", hours: 26, corrections: 14 },
  { day: "Fri", hours: 24, corrections: 5 },
  { day: "Sat", hours: 9, corrections: 2 },
  { day: "Sun", hours: 6, corrections: 1 },
];

const classification = [
  { name: "Male", value: 58 },
  { name: "Female", value: 42 },
];
const pace = [
  { name: "Slow", value: 35 },
  { name: "Fast", value: 65 },
];
const ageGroup = [
  { name: "Young", value: 28 },
  { name: "Adult", value: 47 },
  { name: "Older", value: 25 },
];

const colors = ["#3b82f6", "#f43f5e", "#f59e0b", "#10b981"];

const accuracyTrend = [
  { w: "W1", acc: 71 }, { w: "W2", acc: 75 }, { w: "W3", acc: 79 },
  { w: "W4", acc: 83 }, { w: "W5", acc: 86 }, { w: "W6", acc: 89 }, { w: "W7", acc: 91 },
];

export function AnalyticsPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="lg:col-span-2"><FileObservation /></div>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Processing Volume & Corrections</CardTitle>
          <CardDescription>Hours of audio processed and human corrections (which train the model).</CardDescription>
        </CardHeader>
        <CardContent>
          <GroupedBars
            data={weekly.map((d) => ({ label: d.day, hours: d.hours, corrections: d.corrections }))}
            keys={["hours", "corrections"]}
            colors={["#3b82f6", "#f59e0b"]}
            names={["Hours processed", "Corrections"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Accuracy Trend</CardTitle>
          <CardDescription>Learning curve from manual corrections.</CardDescription>
        </CardHeader>
        <CardContent>
          <LineSpark data={accuracyTrend.map((d) => ({ label: d.w, value: d.acc }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Speaker Classification</CardTitle>
          <CardDescription>Distribution across the six attributes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {[
              { title: "Gender", data: classification },
              { title: "Pace", data: pace },
              { title: "Age", data: ageGroup },
            ].map((g) => (
              <div key={g.title}>
                <div className="text-center text-muted-foreground">{g.title}</div>
                <div className="flex justify-center py-2">
                  <Donut data={g.data} colors={colors} />
                </div>
                <div className="space-y-1">
                  {g.data.map((d, i) => (
                    <div key={`${g.title}-${d.name}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: colors[i] }} />
                        {d.name}
                      </div>
                      <span className="text-muted-foreground tabular-nums">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
