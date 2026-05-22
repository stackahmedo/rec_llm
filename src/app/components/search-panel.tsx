import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  Search, X, FileText, FileAudio, User, Clock, Filter,
  ExternalLink, Download, Loader2,
} from "lucide-react";
import { useTranscripts } from "../transcript-store";
import { searchAppData, SearchResult, SearchFilters } from "../search-service";
import { DevDiagnostics } from "./dev-diagnostics";

// Secret developer commands
const DEV_COMMANDS: Record<string, "error404" | "crashed"> = {
  "error404": "error404",
  "crashed": "crashed",
};

interface SearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (view: string, fileId?: string) => void;
}

export function SearchPanel({ open, onOpenChange, onNavigate }: SearchPanelProps) {
  const { transcripts, summaries, history, setActiveId } = useTranscripts();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [devMode, setDevMode] = useState<"error404" | "crashed" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setShowFilters(false);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q: string, f: SearchFilters) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Use setTimeout to avoid blocking UI on large datasets
    setTimeout(() => {
      const res = searchAppData(q, transcripts, summaries, history, f);
      setResults(res);
      setLoading(false);
    }, 10);
  }, [transcripts, summaries, history]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Check for dev commands
    const cmd = DEV_COMMANDS[value.trim().toLowerCase()];
    if (cmd) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setResults([]);
      setLoading(false);
      setDevMode(cmd);
      onOpenChange(false);
      setQuery("");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value, filters), 300);
  };

  const handleFilterChange = (patch: Partial<SearchFilters>) => {
    const newFilters = { ...filters, ...patch };
    setFilters(newFilters);
    if (query.trim()) doSearch(query, newFilters);
  };

  const openResult = (result: SearchResult) => {
    setActiveId(result.fileId);
    onOpenChange(false);
    if (result.type === "summary") {
      onNavigate?.("transcripts", result.fileId);
    } else {
      onNavigate?.("transcripts", result.fileId);
    }
  };

  // Unique languages and speakers for filter dropdowns
  const languages = Array.from(new Set(history.map((h) => h.languageCode).filter(Boolean)));
  const speakers = Array.from(
    new Set(transcripts.flatMap((t) => t.utterances.map((u) => u.speaker)))
  ).slice(0, 20);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0 shrink-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          {/* Search input */}
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search transcripts, summaries, speakers..."
              className="pl-9 pr-20 h-10"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { setQuery(""); setResults([]); }}
                >
                  <X className="size-3.5" />
                </Button>
              )}
              <Button
                type="button"
                variant={showFilters ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowFilters(!showFilters)}
                title="Filters"
              >
                <Filter className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 pb-1">
              <Select value={filters.language || "all"} onValueChange={(v) => handleFilterChange({ language: v === "all" ? undefined : v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Language" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {languages.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.speaker || "all"} onValueChange={(v) => handleFilterChange({ speaker: v === "all" ? undefined : v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Speaker" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All speakers</SelectItem>
                  {speakers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.status || "all"} onValueChange={(v) => handleFilterChange({ status: v as SearchFilters["status"] })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="done">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.hasSummary === true ? "yes" : filters.hasSummary === false ? "no" : "all"}
                onValueChange={(v) => handleFilterChange({ hasSummary: v === "yes" ? true : v === "no" ? false : null })}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Summary" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="yes">Has summary</SelectItem>
                  <SelectItem value="no">No summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogHeader>

        {/* Results */}
        <div className="flex-1 min-h-0 border-t mt-3">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : !query.trim() ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <Search className="size-6 opacity-40 mb-2" />
              <span>Type to search transcripts, summaries, and speakers</span>
              <span className="text-xs mt-1">Searches only local app data</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
              <span>No results found for "{query}"</span>
              <span className="text-xs mt-1">Try different keywords or adjust filters</span>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </div>
                {results.map((result) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    query={query}
                    onClick={() => openResult(result)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-[10px] text-muted-foreground flex items-center gap-3 shrink-0">
          <span>↵ Open</span>
          <span>Esc Close</span>
          <span className="flex-1" />
          <span>Local data only</span>
        </div>
      </DialogContent>
    </Dialog>

    {/* Developer Diagnostics Popups */}
    {devMode && (
      <DevDiagnostics
        mode={devMode}
        open={true}
        onOpenChange={(v) => { if (!v) setDevMode(null); }}
        onNavigate={onNavigate}
      />
    )}
    </>
  );
}

function SearchResultCard({ result, query, onClick }: { result: SearchResult; query: string; onClick: () => void }) {
  const typeIcon = result.type === "speaker" ? User :
    result.type === "summary" ? FileText : FileAudio;
  const Icon = typeIcon;

  return (
    <div
      className="flex items-start gap-3 p-2.5 rounded cursor-pointer hover:bg-muted/60 transition-colors group"
      onClick={onClick}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{result.fileName}</span>
          <Badge variant="outline" className="text-[9px] h-4 shrink-0">{result.matchField}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          <HighlightedText text={result.matchedText} query={query} />
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          {result.speaker && (
            <span className="flex items-center gap-0.5">
              <User className="size-2.5" />{result.speaker}
            </span>
          )}
          {result.timestamp && (
            <span className="flex items-center gap-0.5">
              <Clock className="size-2.5" />{result.timestamp}
            </span>
          )}
          {result.date && <span>{result.date.slice(0, 10)}</span>}
          {result.language && <span>{result.language.toUpperCase()}</span>}
          {result.hasSummary && <Badge variant="outline" className="text-[8px] h-3.5">Summary</Badge>}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
        title="Open"
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const parts: Array<{ text: string; highlight: boolean }> = [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let lastIdx = 0;

  let idx = lower.indexOf(qLower);
  while (idx !== -1) {
    if (idx > lastIdx) {
      parts.push({ text: text.slice(lastIdx, idx), highlight: false });
    }
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    lastIdx = idx + query.length;
    idx = lower.indexOf(qLower, lastIdx);
  }
  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), highlight: false });
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-inherit rounded-sm px-0.5">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}
