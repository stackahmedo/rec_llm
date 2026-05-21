import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "./ui/sheet";
import { toast } from "sonner";
import {
  Search, Filter, Download, FileAudio, FileText, FileType2, MoreHorizontal,
  Tag, Calendar, HardDrive, Users, Clock, Database, Share2, Trash2,
  Copy, Star, Lock, RefreshCw, ArrowDownToLine,
} from "lucide-react";

type Kind = "audio" | "transcript" | "summary" | "pdf";

interface FileRow {
  id: string;
  name: string;
  kind: Kind;
  year: number;
  capturedAt: string;
  duration?: string;
  size: string;
  speakers: string[];
  owner: string;
  tags: string[];
  encrypted: boolean;
  starred?: boolean;
  version: number;
  checksum: string;
  language: string;
}

const rows: FileRow[] = [
  { id: "f001", name: "field_session_2026-05-19.wav", kind: "audio", year: 2026, capturedAt: "2026-05-19 06:12", duration: "23h 41m", size: "1.4 GB", speakers: ["Amaru","Killa","Inti"], owner: "Maria R.", tags: ["field","planting"], encrypted: true, starred: true, version: 1, checksum: "8a2c…f91", language: "qu-PE" },
  { id: "f002", name: "field_session_2026-05-19.transcript.json", kind: "transcript", year: 2026, capturedAt: "2026-05-19 18:44", size: "412 KB", speakers: ["Amaru","Killa","Inti"], owner: "Maria R.", tags: ["field","planting","verified"], encrypted: true, version: 3, checksum: "1d4e…22a", language: "qu-PE" },
  { id: "f003", name: "field_session_2026-05-19.summary.md", kind: "summary", year: 2026, capturedAt: "2026-05-19 19:02", size: "18 KB", speakers: ["Amaru","Killa","Inti"], owner: "Maria R.", tags: ["digest","30-item"], encrypted: true, version: 2, checksum: "6c7b…0e1", language: "en" },
  { id: "f004", name: "interview_block_A.mp3", kind: "audio", year: 2026, capturedAt: "2026-05-17 09:30", duration: "14h 02m", size: "812 MB", speakers: ["Killa","Sumaq"], owner: "Daniel V.", tags: ["interview"], encrypted: true, version: 1, checksum: "2f9a…cd3", language: "qu-PE" },
  { id: "f005", name: "village_meeting_north.wav", kind: "audio", year: 2026, capturedAt: "2026-05-15 14:10", duration: "21h 18m", size: "2.1 GB", speakers: ["Amaru","Mayu","Wayra"], owner: "Priya S.", tags: ["meeting","water"], encrypted: true, version: 1, checksum: "b81e…44f", language: "es-PE" },
  { id: "f006", name: "cooperative_agreement.pdf", kind: "pdf", year: 2026, capturedAt: "2026-05-21 10:01", size: "1.8 MB", speakers: [], owner: "Maria R.", tags: ["legal","signed"], encrypted: true, starred: true, version: 4, checksum: "3aa1…99b", language: "en" },
  { id: "f007", name: "morning_round.m4a", kind: "audio", year: 2026, capturedAt: "2026-05-21 05:48", duration: "9h 50m", size: "640 MB", speakers: ["Inti","Mayu"], owner: "Daniel V.", tags: ["field"], encrypted: false, version: 1, checksum: "0fe2…7c5", language: "qu-PE" },
  { id: "f008", name: "harvest_2025_archive.transcript.json", kind: "transcript", year: 2025, capturedAt: "2025-10-04 08:22", size: "1.2 MB", speakers: ["Amaru","Sumaq","Wayra"], owner: "Maria R.", tags: ["archive","harvest"], encrypted: true, version: 5, checksum: "94c0…b1a", language: "qu-PE" },
  { id: "f009", name: "harvest_2025_archive.summary.md", kind: "summary", year: 2025, capturedAt: "2025-10-04 09:00", size: "26 KB", speakers: ["Amaru","Sumaq","Wayra"], owner: "Maria R.", tags: ["archive","digest"], encrypted: true, version: 2, checksum: "ee71…403", language: "en" },
  { id: "f010", name: "schedule_A_exhibit.pdf", kind: "pdf", year: 2026, capturedAt: "2026-05-20 16:11", size: "624 KB", speakers: [], owner: "Priya S.", tags: ["legal","exhibit"], encrypted: true, version: 2, checksum: "57da…12c", language: "en" },
];

const kindMeta: Record<Kind, { label: string; icon: any; color: string }> = {
  audio:      { label: "Audio",      icon: FileAudio, color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  transcript: { label: "Transcript", icon: FileText,  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  summary:    { label: "Summary",    icon: FileType2, color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  pdf:        { label: "PDF",        icon: FileType2, color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

export function FileLibrary() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<FileRow | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (year !== "all" && String(r.year) !== year) return false;
      if (owner !== "all" && r.owner !== owner) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!r.name.toLowerCase().includes(q)
          && !r.tags.some((t) => t.toLowerCase().includes(q))
          && !r.speakers.some((s) => s.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [query, kind, year, owner]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const exportSelected = (format: string) => {
    const count = selected.size || filtered.length;
    toast.success(`Exporting ${count} file${count === 1 ? "" : "s"} as ${format.toUpperCase()}`, {
      description: "A signed download link will be emailed when the bundle is ready.",
    });
  };

  const totalSize = "8.4 GB";
  const owners = Array.from(new Set(rows.map((r) => r.owner)));
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><Database className="size-5" /></div>
          <div><div className="text-muted-foreground">Stored objects</div><div>{rows.length}</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><HardDrive className="size-5" /></div>
          <div><div className="text-muted-foreground">Total size</div><div>{totalSize}</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><Lock className="size-5" /></div>
          <div><div className="text-muted-foreground">Encrypted at rest</div><div>{rows.filter(r => r.encrypted).length} / {rows.length}</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><RefreshCw className="size-5" /></div>
          <div><div className="text-muted-foreground">Last sync</div><div>2 min ago</div></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Metadata Storage</CardTitle>
              <CardDescription>Every recording, transcript, summary and PDF, with full metadata. Export individually or in bulk.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Share2 className="size-4 mr-1" />Share view</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <ArrowDownToLine className="size-4 mr-1" />
                    Export {selected.size > 0 ? `(${selected.size})` : "all"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Export format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => exportSelected("zip")}>ZIP archive (files + metadata.json)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelected("csv")}>CSV (metadata only)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelected("json")}>JSON manifest</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelected("pdf")}>PDF report</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => exportSelected("s3")}>Push to S3 bucket</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelected("drive")}>Send to Google Drive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-60">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name, tag, speaker..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-40"><Filter className="size-4 mr-1" /><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="transcript">Transcript</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32"><Calendar className="size-4 mr-1" /><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="w-40"><Users className="size-4 mr-1" /><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Speakers</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const km = kindMeta[r.kind];
                  const Icon = km.icon;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`size-7 rounded-md flex items-center justify-center ${km.color}`}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {r.starred && <Star className="size-3 fill-amber-400 text-amber-400" />}
                              <span className="truncate">{r.name}</span>
                            </div>
                            <div className="text-muted-foreground">v{r.version} · {r.checksum}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{km.label}</Badge></TableCell>
                      <TableCell className="tabular-nums">{r.year}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.capturedAt}</TableCell>
                      <TableCell className="tabular-nums">{r.duration || "—"}</TableCell>
                      <TableCell className="tabular-nums">{r.size}</TableCell>
                      <TableCell>
                        <div className="flex -space-x-1">
                          {r.speakers.slice(0, 3).map((s) => (
                            <div key={s} title={s} className="size-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                              {s.slice(0,1)}
                            </div>
                          ))}
                          {r.speakers.length > 3 && (
                            <div className="size-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-muted-foreground">
                              +{r.speakers.length - 3}
                            </div>
                          )}
                          {r.speakers.length === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>{r.owner}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {r.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.success(`Downloading ${r.name}`)}>
                              <Download className="size-4 mr-2" />Download original
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success(`Exporting metadata for ${r.name}`)}>
                              <ArrowDownToLine className="size-4 mr-2" />Export metadata
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success("Share link copied")}>
                              <Share2 className="size-4 mr-2" />Copy share link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success("Checksum copied")}>
                              <Copy className="size-4 mr-2" />Copy checksum
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="size-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                      No files match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <div>{filtered.length} of {rows.length} files · {selected.size} selected</div>
            <div className="flex items-center gap-1">
              <Tag className="size-3" /> Encrypted at rest · audit trail enabled
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="truncate">{detail.name}</SheetTitle>
                <SheetDescription>
                  {kindMeta[detail.kind].label} · v{detail.version} · {detail.size}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => toast.success(`Downloading ${detail.name}`)}>
                    <Download className="size-4 mr-1" />Download
                  </Button>
                  <Button variant="outline" onClick={() => toast.success("Metadata exported")}>
                    <ArrowDownToLine className="size-4 mr-1" />Export metadata
                  </Button>
                </div>

                <div>
                  <div className="text-muted-foreground mb-2">Metadata</div>
                  <div className="rounded-md border divide-y">
                    {[
                      ["ID", detail.id],
                      ["Type", kindMeta[detail.kind].label],
                      ["Year", String(detail.year)],
                      ["Captured", detail.capturedAt],
                      ["Duration", detail.duration || "—"],
                      ["Size", detail.size],
                      ["Owner", detail.owner],
                      ["Language", detail.language],
                      ["Version", `v${detail.version}`],
                      ["Checksum (SHA-256)", detail.checksum],
                      ["Encryption", detail.encrypted ? "AES-256 at rest" : "Not encrypted"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 p-2.5">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="text-right truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.speakers.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-2">Speakers</div>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.speakers.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-muted-foreground mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-muted-foreground mb-2">Version history</div>
                  <ScrollArea className="h-40 pr-2">
                    <ol className="space-y-2">
                      {Array.from({ length: detail.version }).map((_, i) => {
                        const v = detail.version - i;
                        return (
                          <li key={v} className="flex items-start gap-2 border rounded-md p-2">
                            <Clock className="size-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between">
                                <span>v{v}</span>
                                <span className="text-muted-foreground tabular-nums">2026-05-{(21 - i).toString().padStart(2,"0")}</span>
                              </div>
                              <div className="text-muted-foreground">{i === 0 ? "Current revision" : "Edit / correction"}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
