import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Slider } from "./ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { toast } from "sonner";
import {
  MousePointer2, Type, Highlighter, Pencil, Square, Circle as CircleIcon, ArrowRight,
  Stamp, Image as ImageIcon, Eraser, Undo2, Redo2, Search, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Download, Share2, Save, Layers, FileSignature,
  Lock, ScanText, Trash2, Plus, Bookmark, MessageSquare, FileText, Printer,
  Columns2, Columns3, Rows3, LayoutTemplate,
} from "lucide-react";

type Tool =
  | "select" | "text" | "highlight" | "draw" | "rect" | "circle"
  | "arrow" | "stamp" | "image" | "sign" | "erase";

interface Annotation {
  id: string;
  type: Tool;
  page: number;
  x: number; y: number; w: number; h: number;
  color: string;
  text?: string;
  label: string;
}

const tools: { id: Tool; label: string; icon: any }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Ellipse", icon: CircleIcon },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "stamp", label: "Stamp", icon: Stamp },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "sign", label: "Signature", icon: FileSignature },
  { id: "erase", label: "Erase", icon: Eraser },
];

const colorSwatches = ["#fde047", "#f87171", "#60a5fa", "#34d399", "#a78bfa", "#0f172a"];

const initialAnnotations: Annotation[] = [
  { id: "a1", type: "highlight", page: 1, x: 12, y: 22, w: 60, h: 5, color: "#fde047", label: "Key clause" },
  { id: "a2", type: "text", page: 1, x: 14, y: 40, w: 40, h: 6, color: "#0f172a", text: "Revisit pricing", label: "Note · Revisit pricing" },
  { id: "a3", type: "rect", page: 1, x: 10, y: 60, w: 75, h: 10, color: "#60a5fa", label: "Region · Section 4" },
  { id: "a4", type: "sign", page: 2, x: 50, y: 80, w: 35, h: 8, color: "#0f172a", label: "Signature · M. Rivera" },
];

const pageThumbs = [
  { p: 1, title: "Cover" },
  { p: 2, title: "Agreement" },
  { p: 3, title: "Schedule A" },
  { p: 4, title: "Schedule B" },
  { p: 5, title: "Exhibits" },
  { p: 6, title: "Signatures" },
];

export function PdfEditor() {
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(colorSwatches[0]);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState([110]);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedId, setSelectedId] = useState<string | null>("a2");

  // Layout state
  const [columns, setColumns] = useState<"1" | "2" | "3">("1");
  const [transcriptMode, setTranscriptMode] = useState(false);
  const [headerText, setHeaderText] = useState("VoiceLens AI · Cooperative Service Agreement");
  const [footerText, setFooterText] = useState("Confidential · © 2026 VoiceLens");
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [pageNumPos, setPageNumPos] = useState<"left" | "center" | "right">("right");
  const [paperSize, setPaperSize] = useState("Letter");

  const transcriptLines = [
    ["00:00:12", "Amaru", "We started the planting in the lower terrace last week. The soil there is much drier than expected after the late rains."],
    ["00:00:34", "Killa", "We may need to reroute the irrigation channel before the next cycle — otherwise we lose another harvest like in 2024."],
    ["00:01:08", "Inti", "...and the cooperative meeting agreed to share two of the new pumps if we can store them safely."],
    ["00:01:41", "Amaru", "Storage is the difficult part. The shed roof still has the leak from January that we never repaired."],
    ["00:02:10", "Killa", "Let's draft a maintenance list before the next assembly and prioritise the items that block planting."],
    ["00:02:48", "Sumaq", "The ceremonial calendar this year places the blessing on the second Sunday — coordinate planting around it."],
    ["00:03:21", "Inti", "I can speak with the supplier on Friday about expediting the seed delivery for the southern parcel."],
    ["00:04:02", "Amaru", "Good. Note that we still owe the cooperative a written report on last cycle's yields before the meeting."],
    ["00:04:45", "Mayu", "The training session on the new dashboard is set for Wednesday morning — please bring the tablets."],
    ["00:05:12", "Wayra", "I'll handle logistics for the equipment transfer; we need two more volunteers for loading."],
  ];

  const handlePrint = () => {
    toast.success("Opening print dialog", { description: `Pages 1–${pageThumbs.length} · ${paperSize}` });
    setTimeout(() => window.print(), 200);
  };

  const selected = annotations.find((a) => a.id === selectedId) || null;
  const pageAnnotations = annotations.filter((a) => a.page === page);

  const addAnnotation = () => {
    if (tool === "select" || tool === "erase") return;
    const id = `a${Date.now()}`;
    const a: Annotation = {
      id, type: tool, page, color,
      x: 20 + Math.random() * 40, y: 20 + Math.random() * 50,
      w: tool === "text" ? 30 : 25, h: tool === "highlight" ? 5 : 12,
      text: tool === "text" ? "New annotation" : undefined,
      label: `${tool.charAt(0).toUpperCase() + tool.slice(1)} · page ${page}`,
    };
    setAnnotations((prev) => [...prev, a]);
    setSelectedId(id);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-9rem)] gap-3">
        {/* Top toolbar */}
        <Card className="p-2 flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-1">
            {tools.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool(t.id)}
                    >
                      <Icon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <Separator orientation="vertical" className="h-7 mx-1" />
          <div className="flex items-center gap-1">
            {colorSwatches.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`size-6 rounded-full border-2 transition-transform ${color === c ? "border-primary scale-110" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <Separator orientation="vertical" className="h-7 mx-1" />
          <Select defaultValue="inter">
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inter">Inter</SelectItem>
              <SelectItem value="serif">Serif</SelectItem>
              <SelectItem value="mono">Mono</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="12">
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["10","12","14","16","20","24","32"].map((s) => (
                <SelectItem key={s} value={s}>{s}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Separator orientation="vertical" className="h-7 mx-1" />
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon"><Undo2 className="size-4" /></Button>
          </TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon"><Redo2 className="size-4" /></Button>
          </TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search in document..." className="pl-8 h-8 w-56" />
            </div>
            <Button variant="outline" size="sm"><ScanText className="size-4 mr-1" />OCR</Button>
            <Button variant="outline" size="sm"><Lock className="size-4 mr-1" />Protect</Button>
            <Button variant="outline" size="sm"><Share2 className="size-4 mr-1" />Share</Button>
            <Button size="sm"><Save className="size-4 mr-1" />Save</Button>
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="size-4 mr-1" />Print</Button>
            <Button variant="outline" size="sm"><Download className="size-4 mr-1" />Export</Button>
          </div>
        </Card>

        {/* Body: thumbnails | canvas | properties */}
        <div className="flex-1 grid grid-cols-[14rem_1fr_18rem] gap-3 min-h-0">
          {/* Thumbnails */}
          <Card className="p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div>Pages</div>
              <Button variant="ghost" size="icon"><Plus className="size-4" /></Button>
            </div>
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-2">
                {pageThumbs.map((pt) => {
                  const active = pt.p === page;
                  const count = annotations.filter((a) => a.page === pt.p).length;
                  return (
                    <button
                      key={pt.p}
                      onClick={() => setPage(pt.p)}
                      className={`w-full text-left rounded-md border p-2 transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}
                    >
                      <div className="aspect-[3/4] rounded bg-white shadow-sm border relative overflow-hidden">
                        <div className="absolute inset-3 space-y-1.5">
                          <div className="h-1.5 bg-muted rounded w-2/3" />
                          <div className="h-1 bg-muted rounded w-full" />
                          <div className="h-1 bg-muted rounded w-5/6" />
                          <div className="h-1 bg-muted rounded w-4/6" />
                          <div className="h-1 bg-muted rounded w-3/4" />
                        </div>
                        {count > 0 && (
                          <Badge className="absolute top-1 right-1 h-5 px-1.5">{count}</Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-muted-foreground tabular-nums">{pt.p}</span>
                        <span className="truncate ml-2">{pt.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Canvas */}
          <Card className="flex flex-col min-h-0 bg-muted/40">
            <div className="px-3 py-2 border-b flex items-center gap-2 bg-background">
              <Button variant="ghost" size="icon" onClick={() => setPage(Math.max(1, page - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <div className="tabular-nums">
                Page <Input
                  className="inline-block w-12 h-7 mx-1 text-center"
                  value={page}
                  onChange={(e) => {
                    const v = parseInt(e.target.value || "1");
                    if (!isNaN(v) && v >= 1 && v <= pageThumbs.length) setPage(v);
                  }}
                /> / {pageThumbs.length}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPage(Math.min(pageThumbs.length, page + 1))}>
                <ChevronRight className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Button variant="ghost" size="icon" onClick={() => setZoom([Math.max(50, zoom[0] - 10)])}>
                <ZoomOut className="size-4" />
              </Button>
              <Slider value={zoom} onValueChange={setZoom} min={50} max={200} className="w-32" />
              <Button variant="ghost" size="icon" onClick={() => setZoom([Math.min(200, zoom[0] + 10)])}>
                <ZoomIn className="size-4" />
              </Button>
              <div className="tabular-nums text-muted-foreground w-12">{zoom[0]}%</div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{tool} tool</Badge>
                <span className="size-4 rounded-full border" style={{ background: color }} />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="flex justify-center p-6">
                <div
                  onClick={addAnnotation}
                  className="bg-white shadow-lg relative origin-top transition-transform"
                  style={{
                    width: 612,
                    height: 792,
                    transform: `scale(${zoom[0] / 100})`,
                    cursor: tool === "select" ? "default" : "crosshair",
                  }}
                >
                  {/* Header */}
                  {showHeader && (
                    <div className="absolute top-0 left-0 right-0 px-12 py-4 border-b border-slate-200 flex items-center justify-between text-slate-600 select-none pointer-events-none">
                      <span className="truncate">{headerText}</span>
                      <span className="tabular-nums shrink-0 ml-3">{pageThumbs.find(p => p.p === page)?.title}</span>
                    </div>
                  )}

                  {/* Body */}
                  <div
                    className="absolute inset-x-0 px-16 select-none pointer-events-none"
                    style={{
                      top: showHeader ? 64 : 32,
                      bottom: showFooter ? 64 : 32,
                      columnCount: Number(columns),
                      columnGap: "2rem",
                      columnRule: columns === "1" ? "none" : "1px solid #e2e8f0",
                    }}
                  >
                    {!transcriptMode && (
                      <>
                        <div className="h-6 bg-slate-200 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/3 mb-6" />
                        <div className="space-y-2.5">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-2.5 bg-slate-100 rounded break-inside-avoid"
                              style={{ width: `${60 + ((i * 13) % 35)}%` }}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {transcriptMode && (
                      <div className="space-y-3">
                        <div className="mb-3 break-inside-avoid">
                          <div className="text-slate-800">Field Session Transcript</div>
                          <div className="text-slate-500">2026-05-19 · diarized</div>
                        </div>
                        {transcriptLines.map(([t, sp, txt], i) => (
                          <div key={i} className="break-inside-avoid">
                            <div className="text-slate-500 tabular-nums">
                              {t} · <span className="text-slate-700">{sp}</span>
                            </div>
                            <div className="text-slate-800 leading-snug">{txt}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {showFooter && (
                    <div className="absolute bottom-0 left-0 right-0 px-12 py-4 border-t border-slate-200 flex items-center text-slate-500 select-none pointer-events-none">
                      <span className={`truncate ${pageNumPos === "left" ? "order-1" : ""}`}>{footerText}</span>
                      {showPageNumbers && (
                        <span
                          className={`tabular-nums shrink-0 ${
                            pageNumPos === "left" ? "mr-auto order-0" :
                            pageNumPos === "center" ? "mx-auto" : "ml-auto"
                          }`}
                        >
                          Page {page} of {pageThumbs.length}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Annotation overlay */}
                  {pageAnnotations.map((a) => {
                    const isSel = a.id === selectedId;
                    const common: React.CSSProperties = {
                      position: "absolute",
                      left: `${a.x}%`, top: `${a.y}%`,
                      width: `${a.w}%`, height: `${a.h}%`,
                    };
                    const onClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (tool === "erase") removeAnnotation(a.id);
                      else setSelectedId(a.id);
                    };
                    const ring = isSel ? "outline outline-2 outline-primary outline-offset-2" : "";

                    if (a.type === "highlight") {
                      return (
                        <div key={a.id} style={{ ...common, background: a.color, opacity: 0.45 }}
                          className={`${ring} cursor-pointer`} onClick={onClick} />
                      );
                    }
                    if (a.type === "text") {
                      return (
                        <div key={a.id} style={{ ...common, color: a.color }}
                          className={`${ring} cursor-pointer px-1 py-0.5 bg-yellow-50 border border-yellow-300`}
                          onClick={onClick}>
                          <span className="leading-none">{a.text}</span>
                        </div>
                      );
                    }
                    if (a.type === "rect") {
                      return (
                        <div key={a.id} style={{ ...common, border: `2px solid ${a.color}` }}
                          className={`${ring} cursor-pointer`} onClick={onClick} />
                      );
                    }
                    if (a.type === "circle") {
                      return (
                        <div key={a.id} style={{ ...common, border: `2px solid ${a.color}`, borderRadius: "9999px" }}
                          className={`${ring} cursor-pointer`} onClick={onClick} />
                      );
                    }
                    if (a.type === "arrow") {
                      return (
                        <div key={a.id} style={common} className={`${ring} cursor-pointer flex items-center`} onClick={onClick}>
                          <div className="flex-1 h-0.5" style={{ background: a.color }} />
                          <ArrowRight className="size-4 -ml-1" style={{ color: a.color }} />
                        </div>
                      );
                    }
                    if (a.type === "sign") {
                      return (
                        <div key={a.id} style={common} className={`${ring} cursor-pointer border-b-2 flex items-end`}
                          onClick={onClick}>
                          <span className="italic" style={{ color: a.color, fontFamily: "cursive" }}>M. Rivera</span>
                        </div>
                      );
                    }
                    return (
                      <div key={a.id} style={{ ...common, background: a.color, opacity: 0.3 }}
                        className={`${ring} cursor-pointer`} onClick={onClick} />
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </Card>

          {/* Right properties panel */}
          <Card className="flex flex-col min-h-0">
            <Tabs defaultValue="props" className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid grid-cols-4 m-2">
                <TabsTrigger value="props"><Layers className="size-3.5 mr-1" />Layers</TabsTrigger>
                <TabsTrigger value="layout"><LayoutTemplate className="size-3.5 mr-1" />Layout</TabsTrigger>
                <TabsTrigger value="comments"><MessageSquare className="size-3.5 mr-1" />Notes</TabsTrigger>
                <TabsTrigger value="doc"><FileText className="size-3.5 mr-1" />Doc</TabsTrigger>
              </TabsList>

              <TabsContent value="props" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-4">
                    <div>
                      <div className="mb-2 text-muted-foreground">Annotations on page {page}</div>
                      <div className="space-y-1.5">
                        {pageAnnotations.length === 0 && (
                          <div className="text-muted-foreground border rounded-md p-3 text-center">
                            No annotations yet
                          </div>
                        )}
                        {pageAnnotations.map((a) => (
                          <div key={a.id}
                            className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${selectedId === a.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                            onClick={() => setSelectedId(a.id)}>
                            <span className="size-3 rounded-sm shrink-0" style={{ background: a.color }} />
                            <span className="flex-1 truncate">{a.label}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); removeAnnotation(a.id); }}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selected && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div className="text-muted-foreground">Properties</div>
                          <div>
                            <label className="text-muted-foreground">Label</label>
                            <Input
                              value={selected.label}
                              onChange={(e) =>
                                setAnnotations((prev) =>
                                  prev.map((x) => x.id === selected.id ? { ...x, label: e.target.value } : x)
                                )
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                          {selected.text !== undefined && (
                            <div>
                              <label className="text-muted-foreground">Text</label>
                              <Input
                                value={selected.text}
                                onChange={(e) =>
                                  setAnnotations((prev) =>
                                    prev.map((x) => x.id === selected.id ? { ...x, text: e.target.value } : x)
                                  )
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-muted-foreground">Color</label>
                            <div className="flex gap-1 mt-1">
                              {colorSwatches.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setAnnotations((prev) =>
                                    prev.map((x) => x.id === selected.id ? { ...x, color: c } : x))}
                                  className={`size-6 rounded-full border-2 ${selected.color === c ? "border-primary" : "border-transparent"}`}
                                  style={{ background: c }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-muted-foreground">X</label>
                              <Input className="mt-1 h-8" value={Math.round(selected.x)} readOnly />
                            </div>
                            <div>
                              <label className="text-muted-foreground">Y</label>
                              <Input className="mt-1 h-8" value={Math.round(selected.y)} readOnly />
                            </div>
                            <div>
                              <label className="text-muted-foreground">W</label>
                              <Input className="mt-1 h-8" value={Math.round(selected.w)} readOnly />
                            </div>
                            <div>
                              <label className="text-muted-foreground">H</label>
                              <Input className="mt-1 h-8" value={Math.round(selected.h)} readOnly />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="layout" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-5">
                    <div>
                      <div className="text-muted-foreground mb-2">Transcript layout</div>
                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label className="leading-none">Use as transcript</Label>
                          <div className="text-muted-foreground mt-1">Fill the page with diarized transcript content.</div>
                        </div>
                        <Switch checked={transcriptMode} onCheckedChange={setTranscriptMode} />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Columns</Label>
                      <ToggleGroup
                        type="single"
                        value={columns}
                        onValueChange={(v) => v && setColumns(v as any)}
                        className="grid grid-cols-3 gap-2"
                      >
                        <ToggleGroupItem value="1" className="flex flex-col gap-1 h-auto py-2">
                          <Rows3 className="size-4" /><span>1</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="2" className="flex flex-col gap-1 h-auto py-2">
                          <Columns2 className="size-4" /><span>2</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="3" className="flex flex-col gap-1 h-auto py-2">
                          <Columns3 className="size-4" /><span>3</span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Custom header</Label>
                        <Switch checked={showHeader} onCheckedChange={setShowHeader} />
                      </div>
                      <Textarea
                        rows={2}
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        placeholder="Header text shown on every page"
                        disabled={!showHeader}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Custom footer</Label>
                        <Switch checked={showFooter} onCheckedChange={setShowFooter} />
                      </div>
                      <Textarea
                        rows={2}
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        placeholder="Footer text shown on every page"
                        disabled={!showFooter}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Page numbers</Label>
                        <Switch checked={showPageNumbers} onCheckedChange={setShowPageNumbers} />
                      </div>
                      <Select value={pageNumPos} onValueChange={(v) => setPageNumPos(v as any)} disabled={!showPageNumbers}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div>
                      <Label className="mb-2 block">Paper size</Label>
                      <Select value={paperSize} onValueChange={setPaperSize}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                          <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                          <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
                          <SelectItem value="A3">A3 (297 × 420 mm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button className="w-full" onClick={handlePrint}>
                      <Printer className="size-4 mr-2" />Print preview
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="comments" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {[
                      { who: "Maria R.", when: "2m ago", txt: "Confirm the figure in section 4 matches the schedule." },
                      { who: "Daniel V.", when: "1h ago", txt: "Legal cleared this paragraph — safe to lock." },
                      { who: "Priya S.", when: "yesterday", txt: "Replaced signature block with the updated template." },
                    ].map((c) => (
                      <div key={c.who} className="border rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div>{c.who}</div>
                          <div className="text-muted-foreground">{c.when}</div>
                        </div>
                        <p className="mt-1">{c.txt}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="doc" className="flex-1 min-h-0 m-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {[
                      ["Title", "Cooperative Service Agreement"],
                      ["Author", "Maria Rivera"],
                      ["Created", "2026-05-12"],
                      ["Modified", "2026-05-21"],
                      ["Pages", `${pageThumbs.length}`],
                      ["Size", "1.8 MB"],
                      ["Encryption", "AES-256"],
                      ["Permissions", "Edit · Sign · Comment"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b pb-2 last:border-b-0">
                        <span className="text-muted-foreground">{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-2">
                      <Bookmark className="size-4 mr-2" />Add bookmark
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
