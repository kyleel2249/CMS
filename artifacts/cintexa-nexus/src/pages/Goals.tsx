import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Trophy, Plus, Sparkles, RefreshCw, Target, TrendingUp,
  TrendingDown, Minus, CheckCircle2, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Zap, X, BrainCircuit, BarChart3,
  Users, Receipt, TicketCheck, Briefcase,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type KRStatus = "on_track" | "at_risk" | "behind" | "completed";
type GoalStatus = "on_track" | "at_risk" | "behind" | "completed";

type KeyResult = {
  id: number;
  goalId: number;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  status: KRStatus;
  linkedMetric: string | null;
  autoTracked: boolean;
  createdAt: string;
  updatedAt: string;
};

type Goal = {
  id: number;
  title: string;
  description: string | null;
  owner: string;
  quarter: string;
  year: number;
  status: GoalStatus;
  progress: number;
  aiNarrative: string | null;
  createdAt: string;
  updatedAt: string;
  keyResults: KeyResult[];
};

// --- Status configs ---
const STATUS_CFG: Record<GoalStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  on_track:  { label: "On Track",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: TrendingUp  },
  at_risk:   { label: "At Risk",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   icon: AlertTriangle },
  behind:    { label: "Behind",    color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    icon: TrendingDown },
  completed: { label: "Completed", color: "text-primary",     bg: "bg-primary/10",     border: "border-primary/30",     icon: CheckCircle2 },
};

const METRIC_ICON: Record<string, React.ElementType> = {
  revenue:            Receipt,
  win_rate:           Target,
  avg_deal_size:      Target,
  open_deals:         Target,
  pipeline_value:     TrendingUp,
  ticket_open_rate:   TicketCheck,
  open_tickets:       TicketCheck,
  lead_conversion:    Users,
  projects_completed: Briefcase,
  active_automations: Zap,
};

const METRIC_LABELS: Record<string, string> = {
  revenue:            "Revenue ($)",
  win_rate:           "Win Rate (%)",
  avg_deal_size:      "Avg Deal Size ($)",
  open_deals:         "Open Deals",
  pipeline_value:     "Pipeline Value ($)",
  ticket_open_rate:   "Ticket Open Rate (%)",
  open_tickets:       "Open Tickets",
  lead_conversion:    "Lead Conversion (%)",
  projects_completed: "Projects Completed",
  active_automations: "Active Automations",
};

function krProgress(kr: KeyResult): number {
  if (!kr.targetValue) return 0;
  return Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100);
}

function formatValue(value: number, unit: string): string {
  if (unit === "$" || unit === "revenue" || unit === "currency") return `$${value.toLocaleString()}`;
  if (unit === "%") return `${value}%`;
  return value.toLocaleString();
}

function ProgressRing({ progress, size = 56, status }: { progress: number; size?: number; status: GoalStatus }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;
  const cfg = STATUS_CFG[status];
  const colors: Record<GoalStatus, string> = {
    on_track: "stroke-emerald-500", at_risk: "stroke-amber-500",
    behind: "stroke-rose-500", completed: "stroke-primary",
  };
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ minWidth: size }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        className={`${colors[status]} transition-all duration-700`}
      />
    </svg>
  );
}

function KRRow({ kr }: { kr: KeyResult }) {
  const pct = krProgress(kr);
  const cfg = STATUS_CFG[kr.status as GoalStatus] ?? STATUS_CFG.on_track;
  const MetricIcon = kr.linkedMetric ? (METRIC_ICON[kr.linkedMetric] ?? Zap) : Target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {kr.autoTracked && (
            <span title="Auto-tracked by NEXUS AI">
              <Zap className="w-3 h-3 text-primary shrink-0" />
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">{kr.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono ${cfg.color}`}>
            {formatValue(kr.currentValue, kr.unit)} / {formatValue(kr.targetValue, kr.unit)}
          </span>
          <span className={`text-[10px] font-mono font-bold ${cfg.color}`}>{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${
            kr.status === "completed" ? "bg-primary" :
            kr.status === "on_track"  ? "bg-emerald-500" :
            kr.status === "at_risk"   ? "bg-amber-500" : "bg-rose-500"
          }`}
        />
      </div>
      {kr.linkedMetric && (
        <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50">
          <MetricIcon className="w-2.5 h-2.5" />
          Live: {METRIC_LABELS[kr.linkedMetric] ?? kr.linkedMetric}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[goal.status];
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${cfg.border} bg-card/40 backdrop-blur overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Progress ring */}
          <div className="relative shrink-0">
            <ProgressRing progress={goal.progress} status={goal.status} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[11px] font-mono font-bold ${cfg.color}`}>{goal.progress}%</span>
            </div>
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                <StatusIcon className="w-2.5 h-2.5 mr-1" />{cfg.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border border-border/40 text-muted-foreground">
                {goal.quarter} {goal.year}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border border-border/40 text-muted-foreground">
                {goal.owner}
              </Badge>
            </div>
            <h3 className="font-semibold text-sm leading-snug">{goal.title}</h3>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{goal.description}</p>
            )}
          </div>

          <button
            onClick={() => setExpanded((p) => !p)}
            className="shrink-0 p-1 rounded hover:bg-muted/30 transition-colors text-muted-foreground"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="mt-3">
          <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${
                goal.status === "completed" ? "bg-primary" :
                goal.status === "on_track"  ? "bg-emerald-500" :
                goal.status === "at_risk"   ? "bg-amber-500" : "bg-rose-500"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Expanded: KRs + AI narrative */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 bg-card/20"
          >
            <div className="p-4 space-y-4">
              {/* Key Results */}
              {goal.keyResults.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Key Results ({goal.keyResults.length})
                  </p>
                  {goal.keyResults.map((kr) => (
                    <KRRow key={kr.id} kr={kr} />
                  ))}
                </div>
              )}

              {/* AI Narrative */}
              {goal.aiNarrative && (
                <div className="flex gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <BrainCircuit className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-mono text-primary uppercase mb-1">NEXUS AI Forecast</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{goal.aiNarrative}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => onDelete(goal.id)}
                  className="text-[10px] font-mono text-muted-foreground/50 hover:text-destructive transition-colors"
                >
                  Delete goal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewGoalModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Partial<Goal>) => void }) {
  const [form, setForm] = useState({ title: "", description: "", owner: "", quarter: "Q3", year: 2026 });
  const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> New Goal</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <input className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Goal title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <input className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <input className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Owner (e.g. Jordan Lee)" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block uppercase">Quarter</label>
              <select value={form.quarter} onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block uppercase">Year</label>
              <select value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title || !form.owner} onClick={() => { onCreate(form); onClose(); }}>Create Goal</Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Goals() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<GoalStatus | "all">("all");

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => fetch(`${API}/goals`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Goal>) =>
      fetch(`${API}/goals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal created"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal deleted"); },
  });

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/goals/ai/sync`, { method: "POST" });
      const d = await r.json();
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success(`AI synced ${d.updatedKRCount ?? 0} key results with live metrics`);
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  };

  const filtered = filter === "all" ? goals : goals.filter((g) => g.status === filter);
  const onTrack   = goals.filter((g) => g.status === "on_track").length;
  const atRisk    = goals.filter((g) => g.status === "at_risk").length;
  const behind    = goals.filter((g) => g.status === "behind").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const avgProgress = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  const FILTER_OPTS: Array<{ value: GoalStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "on_track", label: "On Track" },
    { value: "at_risk", label: "At Risk" },
    { value: "behind", label: "Behind" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <AnimatePresence>
        {showNew && <NewGoalModal onClose={() => setShowNew(false)} onCreate={(d) => createMutation.mutate(d)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-primary" /> Goals & OKRs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            NEXUS AI maps live metrics to key results and forecasts quarter-end outcomes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleSync} disabled={syncing}>
            <Sparkles className={`w-3.5 h-3.5 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Syncing…" : "AI Sync Metrics"}
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={() => setShowNew(true)}>
            <Plus className="w-3.5 h-3.5" /> New Goal
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {!isLoading && goals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Avg Progress", value: `${avgProgress}%`, color: "text-primary", icon: BarChart3 },
            { label: "On Track",   value: onTrack,   color: "text-emerald-400", icon: TrendingUp   },
            { label: "At Risk",    value: atRisk,    color: "text-amber-400",   icon: AlertTriangle },
            { label: "Behind",     value: behind,    color: "text-rose-400",    icon: TrendingDown  },
            { label: "Completed",  value: completed, color: "text-primary",     icon: CheckCircle2  },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-card/30 border border-border/40 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              <div>
                <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_OPTS.map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-full text-xs font-mono transition-all border ${
              filter === value
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_8px_rgba(0,255,255,0.3)]"
                : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Goals list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm mb-3">No goals yet. Create your first OKR and let NEXUS AI track it automatically.</p>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="w-3.5 h-3.5" /> New Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Live metrics legend */}
      {goals.some((g) => g.keyResults.some((kr) => kr.autoTracked)) && (
        <div className="flex items-center gap-2 pt-2 text-[10px] font-mono text-muted-foreground/50">
          <Zap className="w-3 h-3 text-primary" />
          Key results marked with <Zap className="w-2.5 h-2.5 text-primary mx-0.5" /> are auto-tracked by NEXUS AI from live data.
          Click "AI Sync Metrics" to update all values now.
        </div>
      )}
    </div>
  );
}
