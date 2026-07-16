import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive, Upload, Download, Trash2, Zap, Shield, Cpu, Gauge, Sparkles, Flame,
  FileText, Image, Film, Music, Code2, Database, ChevronRight, BarChart3,
  Clock, CheckCircle2, XCircle, Loader2, Info, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const API = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type CompressionMode = "lossless" | "smart" | "ultra" | "fast" | "balanced" | "maximum";

type CompressionResult = {
  jobId: number;
  filename: string;
  outFilename: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  algorithm: string;
  timeTakenMs: number;
  category: string;
  fileType: string;
  entropy: number;
  redundancy: number;
};

type Job = {
  id: number;
  filename: string;
  originalSize: number;
  compressedSize: number | null;
  algorithm: string | null;
  mode: string;
  fileType: string | null;
  status: string;
  savingsPercent: number | null;
  timeTakenMs: number | null;
  createdAt: string;
};

type Stats = {
  totalJobs: number;
  completedJobs: number;
  totalSavedBytes: number;
  avgSavingsPercent: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function categoryIcon(cat: string) {
  const cls = "w-4 h-4";
  if (cat === "image")    return <Image    className={cls} />;
  if (cat === "video")    return <Film     className={cls} />;
  if (cat === "audio")    return <Music    className={cls} />;
  if (cat === "code")     return <Code2    className={cls} />;
  if (cat === "document") return <FileText className={cls} />;
  if (cat === "data")     return <Database className={cls} />;
  return <Archive className={cls} />;
}

const MODES: { id: CompressionMode; label: string; icon: React.FC<{ className?: string }>; desc: string; color: string }[] = [
  { id: "lossless", label: "Lossless",  icon: Shield,   desc: "Bit-perfect restoration, SHA-256 verified",           color: "text-green-400 border-green-500/30 bg-green-500/10"  },
  { id: "smart",    label: "Smart",     icon: Sparkles, desc: "AI-selected pipeline, visually lossless",             color: "text-blue-400 border-blue-500/30 bg-blue-500/10"     },
  { id: "balanced", label: "Balanced",  icon: Gauge,    desc: "Balance between size, quality and speed",             color: "text-primary border-primary/30 bg-primary/10"         },
  { id: "fast",     label: "Fast",      icon: Zap,      desc: "Optimized for speed, good compression",               color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"},
  { id: "ultra",    label: "Ultra",     icon: Cpu,      desc: "Maximum compression, all algorithms",                 color: "text-purple-400 border-purple-500/30 bg-purple-500/10"},
  { id: "maximum",  label: "Maximum",   icon: Flame,    desc: "Up to 98% smaller — AVIF · H.265 · Opus · Brotli 11", color: "text-red-400 border-red-500/30 bg-red-500/10"         },
];

// ─── Queued file ──────────────────────────────────────────────────────────────
type QueuedFile = {
  id: string;
  file: File;
  state: "pending" | "compressing" | "done" | "error";
  result?: CompressionResult;
  error?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Compression() {
  const qc = useQueryClient();
  const [mode, setMode]       = useState<CompressionMode>("balanced");
  const [quality, setQuality] = useState(80);
  const [showQuality, setShowQuality] = useState(false);
  const [queue, setQueue]     = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);
  const processingRef         = useRef(false);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["compression-stats"],
    queryFn: () => fetch(`${API}/compression/stats`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["compression-jobs"],
    queryFn: () => fetch(`${API}/compression/jobs`).then(r => r.json()),
    refetchInterval: 3000,
  });

  // ─── Add files to queue ────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems: QueuedFile[] = arr.map(f => ({
      id: `${f.name}-${f.lastModified}-${Math.random()}`,
      file: f,
      state: "pending",
    }));
    setQueue(prev => [...prev, ...newItems]);
    // auto-detect image for quality slider
    if (arr.some(f => f.type.startsWith("image/"))) setShowQuality(true);
  }, []);

  // ─── Drag & Drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // ─── Compress one file ─────────────────────────────────────────────────────
  const compressFile = useCallback(async (item: QueuedFile) => {
    setQueue(q => q.map(i => i.id === item.id ? { ...i, state: "compressing" } : i));

    const fd = new FormData();
    fd.append("file", item.file);
    fd.append("mode", mode);
    fd.append("quality", String(quality));

    try {
      const res = await fetch(`${API}/compression/compress`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Compression failed");
      }
      const result: CompressionResult = await res.json();
      setQueue(q => q.map(i => i.id === item.id ? { ...i, state: "done", result } : i));
      qc.invalidateQueries({ queryKey: ["compression-stats"] });
      qc.invalidateQueries({ queryKey: ["compression-jobs"] });
      toast.success(`${item.file.name} → ${result.savingsPercent}% smaller`);
    } catch (err: any) {
      setQueue(q => q.map(i => i.id === item.id ? { ...i, state: "error", error: err.message } : i));
      toast.error(`Failed: ${item.file.name}`);
    }
  }, [mode, quality, qc]);

  // ─── Run all pending ───────────────────────────────────────────────────────
  const runQueue = useCallback(async () => {
    if (processingRef.current) return;
    const pending = queue.filter(i => i.state === "pending");
    if (!pending.length) { toast.info("No pending files"); return; }
    processingRef.current = true;
    for (const item of pending) await compressFile(item);
    processingRef.current = false;
  }, [queue, compressFile]);

  // ─── Download ──────────────────────────────────────────────────────────────
  const download = (jobId: number, filename: string) => {
    const a = document.createElement("a");
    a.href = `${API}/compression/download/${jobId}`;
    a.download = filename;
    a.click();
    toast.success("Download started");
  };

  // ─── Delete from DB ────────────────────────────────────────────────────────
  const deleteJob = async (id: number) => {
    await fetch(`${API}/compression/jobs/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["compression-jobs"] });
    qc.invalidateQueries({ queryKey: ["compression-stats"] });
  };

  const pendingCount    = queue.filter(i => i.state === "pending").length;
  const compressingCount = queue.filter(i => i.state === "compressing").length;
  const doneCount       = queue.filter(i => i.state === "done").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Archive className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-mono font-semibold">AI Compression Engine</h1>
          <p className="text-xs text-muted-foreground font-mono">Intelligent multi-algorithm compression — images, documents, code, and more</p>
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-xs gap-1 text-purple-400 border-purple-500/30">
          <Sparkles className="h-3 w-3" /> AI-Powered
        </Badge>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Jobs",     value: stats.totalJobs,       icon: BarChart3, color: "text-primary" },
            { label: "Completed",      value: stats.completedJobs,   icon: CheckCircle2, color: "text-green-400" },
            { label: "Space Saved",    value: fmtBytes(stats.totalSavedBytes), icon: Archive, color: "text-blue-400" },
            { label: "Avg Savings",    value: `${stats.avgSavingsPercent}%`, icon: Gauge, color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-md flex items-center justify-center bg-muted/50", s.color)}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono">{s.label}</p>
                <p className="text-sm font-mono font-semibold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        {/* ─── Left: Controls ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 select-none",
              dragging
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-muted/20"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
            />
            <motion.div animate={dragging ? { scale: 1.1 } : { scale: 1 }} className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Upload className={cn("w-6 h-6 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="font-mono text-sm font-medium">{dragging ? "Drop to add files" : "Drag & drop files here"}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">or click to browse — all file types supported · 200 MB max</p>
              </div>
            </motion.div>
          </div>

          {/* Mode selector */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Compression Mode</p>
            <div className="space-y-2">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                    mode === m.id ? m.color : "border-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <m.icon className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold">{m.label}</p>
                    <p className="text-[10px] font-mono opacity-70 truncate">{m.desc}</p>
                  </div>
                  {mode === m.id && <ChevronRight className="w-3 h-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Quality slider (images only) */}
          <AnimatePresence>
            {(showQuality || mode !== "lossless") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-card border border-border rounded-lg p-4 space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Image Quality</p>
                  <Badge variant="outline" className="font-mono text-xs">{quality}%</Badge>
                </div>
                <Slider
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                  min={10} max={100} step={5}
                  className="w-full"
                  disabled={mode === "lossless"}
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Smallest</span>
                  <span className="text-center">Balanced</span>
                  <span>Perfect</span>
                </div>
                {mode === "lossless" && (
                  <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" /> Quality fixed at 100% in Lossless mode
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Run button */}
          <Button
            className="w-full font-mono gap-2"
            onClick={runQueue}
            disabled={pendingCount === 0 || compressingCount > 0}
          >
            {compressingCount > 0 ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Compressing {compressingCount} file{compressingCount !== 1 ? "s" : ""}…</>
            ) : (
              <><Zap className="w-4 h-4" /> Compress {pendingCount} file{pendingCount !== 1 ? "s" : ""}</>
            )}
          </Button>

          {/* Queue summary */}
          {queue.length > 0 && (
            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
              {pendingCount > 0    && <span className="flex items-center gap-1"><Clock        className="w-3 h-3" /> {pendingCount} pending</span>}
              {compressingCount > 0 && <span className="flex items-center gap-1 text-primary"><Loader2  className="w-3 h-3 animate-spin" /> {compressingCount} running</span>}
              {doneCount > 0       && <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" /> {doneCount} done</span>}
              <button onClick={() => setQueue([])} className="ml-auto hover:text-foreground transition-colors">Clear all</button>
            </div>
          )}
        </div>

        {/* ─── Right: Queue + History ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Current queue */}
          {queue.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Queue</p>
                <p className="text-xs font-mono text-muted-foreground">{queue.length} files</p>
              </div>
              <div className="divide-y divide-border max-h-80 overflow-y-auto custom-scrollbar">
                <AnimatePresence initial={false}>
                  {queue.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {item.state === "pending"     && <Clock         className="w-4 h-4 text-muted-foreground" />}
                        {item.state === "compressing" && <Loader2       className="w-4 h-4 text-primary animate-spin" />}
                        {item.state === "done"        && <CheckCircle2  className="w-4 h-4 text-green-400" />}
                        {item.state === "error"       && <XCircle       className="w-4 h-4 text-destructive" />}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono truncate">{item.file.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{fmtBytes(item.file.size)}</p>
                        {item.state === "done" && item.result && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono text-green-400">{fmtBytes(item.result.compressedSize)} ({item.result.savingsPercent}% saved)</span>
                            <span className="text-[10px] font-mono text-muted-foreground truncate">· {item.result.algorithm}</span>
                          </div>
                        )}
                        {item.state === "error" && (
                          <p className="text-[10px] font-mono text-destructive">{item.error}</p>
                        )}
                      </div>

                      {/* Progress bar */}
                      {item.state === "compressing" && (
                        <Progress value={undefined} className="w-20 h-1" />
                      )}

                      {/* Savings badge */}
                      {item.state === "done" && item.result && (
                        <Badge variant="outline" className="font-mono text-xs text-green-400 border-green-500/30 shrink-0">
                          -{item.result.savingsPercent}%
                        </Badge>
                      )}

                      {/* Download / retry */}
                      {item.state === "done" && item.result && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => download(item.result!.jobId, item.result!.outFilename)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {item.state === "error" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground" onClick={() => compressFile({ ...item, state: "pending" })}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setQueue(q => q.filter(i => i.id !== item.id))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Compression history from DB */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">History</p>
              <p className="text-xs font-mono text-muted-foreground">{jobs.length} records</p>
            </div>
            {jobs.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Archive className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs font-mono text-muted-foreground">No compressions yet — add files above to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto custom-scrollbar">
                {jobs.map(job => (
                  <div key={job.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/20 transition-colors">
                    <div className="shrink-0 text-muted-foreground">
                      {categoryIcon(job.fileType ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate">{job.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{fmtBytes(job.originalSize)}</span>
                        {job.compressedSize && (
                          <>
                            <span className="text-[10px] text-muted-foreground">→</span>
                            <span className="text-[10px] font-mono text-green-400">{fmtBytes(job.compressedSize)}</span>
                          </>
                        )}
                        {job.algorithm && (
                          <span className="text-[10px] font-mono text-muted-foreground truncate">· {job.algorithm}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.status === "done" && job.savingsPercent != null && (
                        <Badge variant="outline" className={cn("font-mono text-xs", job.savingsPercent > 0 ? "text-green-400 border-green-500/30" : "text-muted-foreground")}>
                          {job.savingsPercent > 0 ? `-${job.savingsPercent}%` : "0%"}
                        </Badge>
                      )}
                      {job.status === "processing" && <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">Processing</Badge>}
                      {job.status === "error"      && <Badge variant="outline" className="font-mono text-xs text-destructive border-destructive/30">Error</Badge>}
                      {job.timeTakenMs != null && (
                        <span className="text-[10px] font-mono text-muted-foreground">{job.timeTakenMs}ms</span>
                      )}
                      {job.status === "done" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => download(job.id, job.filename)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={() => deleteJob(job.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Algorithm info panel */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3 h-3" /> AI Pipeline Overview
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Images",     algos: "Sharp + MozJPEG + WebP" },
                { label: "Text/Code",  algos: "Brotli (quality 11)" },
                { label: "Binary",     algos: "GZIP / Brotli auto-select" },
                { label: "Archives",   algos: "Passthrough (pre-compressed)" },
                { label: "Documents",  algos: "GZIP entropy coding" },
                { label: "Ultra mode", algos: "Multi-algo race + best result" },
              ].map(({ label, algos }) => (
                <div key={label} className="bg-muted/20 rounded-md p-2">
                  <p className="text-[10px] font-mono font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{algos}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              The AI engine analyzes file entropy and redundancy before compression to automatically select the optimal algorithm and settings for each file type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
