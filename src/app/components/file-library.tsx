import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import {
  Search, FileAudio, MoreHorizontal, HardDrive, Database, Trash2, Eye,
} from "lucide-react";
import { useTranscripts, HistoryJob } from "../transcript-store";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export function FileLibrary() {
  const { history, setActiveId } = useTranscripts();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return history;
    const q = query.toLowerCase();
    return history.filter((j) =>
      j.fileName.toLowerCase().includes(q) ||
      j.languageCode.toLowerCase().includes(q)
    );
  }, [query, history]);

  const totalSize = useMemo(() => {
    return history.reduce((s, j) => s + j.sizeBytes, 0);
  }, [history]);

  const handleSelect = (job: HistoryJob) => {
    setActiveId(job.id);
    toast.success(`Loaded: ${job.fileName}`);
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI?.history?.delete(id);
    toast.success("Removed from history");
  };

  if (history.length === 0) {
    return (
      <div className="space-y-5">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Database className="size-10 mx-auto mb-3 opacity-50" />
            <div className="text-lg">No files in library</div>
            <div className="mt-1">Completed transcriptions will appear here automatically.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><Database className="size-5" /></div>
          <div><div className="text-muted-foreground">Completed jobs</div><div className="tabular-nums">{history.length}</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><HardDrive className="size-5" /></div>
          <div><div className="text-muted-foreground">Total audio size</div><div className="tabular-nums">{formatBytes(totalSize)}</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted flex items-center justify-center"><FileAudio className="size-5" /></div>
          <div><div className="text-muted-foreground">Stored locally</div><div>JSON persistence</div></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>File Library</CardTitle>
              <CardDescription>All completed transcriptions. Select a file to view its transcript and summary.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by file name or language..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Speakers</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelect(job)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileAudio className="size-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]">{job.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{job.languageCode}</Badge></TableCell>
                    <TableCell className="tabular-nums">{job.speakerCount}</TableCell>
                    <TableCell className="tabular-nums">{formatBytes(job.sizeBytes)}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(job.completedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{job.fileName}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSelect(job); }}>
                            <Eye className="size-4 mr-2" />View transcript
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(job.id); }}>
                            <Trash2 className="size-4 mr-2" />Remove from history
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
