import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Users, Target, TicketCheck, Receipt, Briefcase,
  Zap, BookOpen, MessageSquare, Sparkles, RefreshCw, Filter,
  TrendingUp, Clock, ChevronRight, Radio, BrainCircuit, X,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type StreamEvent = {
  id: string;
  type: string;
  module: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  aiComment?: string;
  commentLoading?: boolean;
};

type ModuleStat = {
  module: string;
  label: string;
  count: number;
  color: string;
};

const MODULE_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  crm:           { icon: Users,        color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20" },
  sales:         { icon: Target,       color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20"   },
  support:       { icon: TicketCheck,  color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20"   },
  marketing:     { icon: Activity,     color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"  },
  finance:       { icon: Receipt,      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20"},
  projects:      { icon: Briefcase,    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"   },
  automations:   { icon: Zap,          color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
  knowledge:     { icon: BookOpen,     color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20" },
  collaboration: { icon: MessageSquare,color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/20"   },
  system:        { icon: Activity,     color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/20"  },
};

function getMeta(module: string) {
  return MODULE_META[module] ?? MODULE_META.system;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function EventTypeLabel({ type }: { type: string }) {
  const parts = type.split(".");
  const labels: Record<string, string> = {
    "contact.created":    "Contact Added",
    "lead.created":       "New Lead",
    "lead.qualified":     "Lead Qualified",
    "deal.stage_changed": "Stage Changed",
    "deal.won":           "Deal Won 🎉",
    "deal.lost":          "Deal Lost",
    "ticket.open":        "Ticket Opened",
    "ticket.resolved":    "Ticket Resolved",
    "ticket.closed":      "Ticket Closed",
    "invoice.paid":       "Invoice Paid",
    "invoice.overdue":    "Invoice Overdue",
    "invoice.sent":       "Invoice Sent",
    "project.active":     "Project Active",
    "project.completed":  "Project Done",
    "automation.run":     "Auto Ran",
    "article.published":  "Article Published",
    "note.created":       "Note Shared",
  };
  return <span>{labels[type] ?? parts.join(" → ")}</span>;
}

function StreamEventCard({
  event,
  isNew,
  onAnalyze,
}: {
  event: StreamEvent;
  isNew: boolean;
  onAnalyze: (event: StreamEvent) => void;
}) {
  const meta = getMeta(event.module);
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, x: -16 } : { opacity: 1, x: 0 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {isNew && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0 rounded-xl bg-primary/5 pointer-events-none origin-left z-0"
        />
      )}

      <div className={`relative flex gap-3 p-4 rounded-xl border transition-all group
        ${isNew ? "border-primary/30 bg-card/70" : "border-border/40 bg-card/30"}
        hover:border-border/70 hover:bg-card/50
      `}>
        {/* Timeline line */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}>
            <Icon className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div className="flex-1 w-px bg-border/30 min-h-[8px]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 border ${meta.bg} ${meta.color} ${meta.border}`}>
              <EventTypeLabel type={event.type} />
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 capitalize text-muted-foreground border-border/40">
              {event.module}
            </Badge>
          </div>

          <p className="text-sm font-semibold leading-snug">{event.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>

          {/* AI Commentary */}
          <AnimatePresence>
            {event.commentLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
                  <Skeleton className="h-3 flex-1 bg-primary/10" />
                </div>
              </motion.div>
            )}
            {event.aiComment && !event.commentLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <div className="flex gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <BrainCircuit className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-primary/90 leading-relaxed font-mono">{event.aiComment}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-mono">
              <Clock className="w-2.5 h-2.5" />
              {relativeTime(event.timestamp)}
            </div>
            {!event.aiComment && !event.commentLoading && (
              <button
                onClick={() => onAnalyze(event)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-mono text-primary/70 hover:text-primary"
              >
                <Sparkles className="w-2.5 h-2.5" />
                Analyze
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const FILTERS = [
  { value: "all",           label: "All" },
  { value: "crm",           label: "CRM" },
  { value: "sales",         label: "Sales" },
  { value: "support",       label: "Support" },
  { value: "finance",       label: "Finance" },
  { value: "projects",      label: "Projects" },
  { value: "automations",   label: "Automations" },
  { value: "knowledge",     label: "Knowledge" },
  { value: "collaboration", label: "Collab" },
];

export default function ActivityStream() {
  const [activeModule, setActiveModule] = useState("all");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [newIds, setNewIds]   = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const knownIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<{ stats: ModuleStat[]; total: number }>({
    queryKey: ["activity-stream-stats"],
    queryFn: () => fetch(`${API}/activity/stream/stats`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const fetchEvents = useCallback(async () => {
    const url = `${API}/activity/stream?limit=50${activeModule !== "all" ? `&module=${activeModule}` : ""}`;
    const data: StreamEvent[] = await fetch(url).then((r) => r.json());

    const incoming = new Set(data.map((e) => e.id));
    const freshIds = new Set<string>();
    for (const id of incoming) {
      if (!knownIds.current.has(id)) freshIds.add(id);
    }

    knownIds.current = incoming;
    setNewIds(freshIds);
    setEvents(data);
    setLastRefreshed(new Date());

    if (freshIds.size > 0) {
      setTimeout(() => setNewIds(new Set()), 3000);
    }
  }, [activeModule]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(fetchEvents, 15_000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, fetchEvents]);

  const analyzeEvent = useCallback(async (event: StreamEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? { ...e, commentLoading: true } : e))
    );
    try {
      const res = await fetch(`${API}/activity/stream/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: event.type,
          title: event.title,
          description: event.description,
          module: event.module,
          metadata: event.metadata,
        }),
      });
      const { comment } = await res.json();
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, commentLoading: false, aiComment: comment } : e))
      );
    } catch {
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, commentLoading: false } : e))
      );
    }
  }, []);

  const analyzeAll = useCallback(async () => {
    for (const event of events.slice(0, 8)) {
      if (!event.aiComment && !event.commentLoading) {
        await analyzeEvent(event);
      }
    }
  }, [events, analyzeEvent]);

  const visibleEvents = events;
  const commentedCount = events.filter((e) => e.aiComment).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-primary" />
            Activity Stream
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            Live cross-module event feed with AI commentary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={analyzeAll}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            AI Analyze Top 8
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 text-xs ${autoRefresh ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" : "border-border/50 text-muted-foreground"}`}
            onClick={() => setAutoRefresh((p) => !p)}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-muted-foreground"}`} />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={fetchEvents}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {statsLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
          : stats?.stats.map((s) => {
              const meta = getMeta(s.module);
              const Icon = meta.icon;
              return (
                <button
                  key={s.module}
                  onClick={() => setActiveModule(activeModule === s.module ? "all" : s.module)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${
                    activeModule === s.module
                      ? `${meta.bg} ${meta.border} border`
                      : "border-border/40 bg-card/30 hover:border-border/70"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${activeModule === s.module ? meta.color : "text-muted-foreground"}`} />
                  <div className={`text-sm font-mono font-bold ${activeModule === s.module ? meta.color : "text-foreground"}`}>
                    {s.count}
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground uppercase leading-none">{s.label}</div>
                </button>
              );
            })}
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveModule(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-mono transition-all border ${
              activeModule === f.value
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_8px_rgba(0,255,255,0.3)]"
                : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        {commentedCount > 0 && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <BrainCircuit className="w-2.5 h-2.5 text-primary" />
            {commentedCount} AI insights
          </span>
        )}
      </div>

      {/* Last refreshed */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/50 -mt-2">
        <span>
          {visibleEvents.length} events · refreshed {relativeTime(lastRefreshed.toISOString())}
        </span>
        {autoRefresh && (
          <span className="flex items-center gap-1 text-emerald-500/70">
            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
            Auto-refresh every 15s
          </span>
        )}
      </div>

      {/* Event feed */}
      {visibleEvents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No events for this module yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {visibleEvents.map((event) => (
              <StreamEventCard
                key={event.id}
                event={event}
                isNew={newIds.has(event.id)}
                onAnalyze={analyzeEvent}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
