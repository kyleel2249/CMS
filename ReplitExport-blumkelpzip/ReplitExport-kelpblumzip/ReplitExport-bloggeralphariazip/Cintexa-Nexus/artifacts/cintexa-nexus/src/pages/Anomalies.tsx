import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShieldAlert, AlertTriangle, Info, Scan, RefreshCw,
  Users, Target, TicketCheck, Receipt, Briefcase, Zap,
  TrendingDown, TrendingUp, BrainCircuit, CheckCircle,
  Clock, ChevronRight, Sparkles,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type AnomalySeverity = "critical" | "warning" | "info";

type Anomaly = {
  id: string;
  module: string;
  metric: string;
  severity: AnomalySeverity;
  current: number;
  baseline: number;
  deviation: number;
  unit: string;
  title: string;
  description: string;
  aiExplanation: string | null;
  suggestedAction: string | null;
  detectedAt: string;
};

type AnomalyResponse = {
  anomalies: Anomaly[];
  cachedAt: string;
  fresh: boolean;
};

const SEVERITY_CONFIG: Record<AnomalySeverity, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
  ring: string;
}> = {
  critical: {
    icon: ShieldAlert,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    label: "Critical",
    ring: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Warning",
    ring: "shadow-[0_0_12px_rgba(245,158,11,0.1)]",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Info",
    ring: "",
  },
};

const MODULE_ICON: Record<string, React.ElementType> = {
  support:     TicketCheck,
  finance:     Receipt,
  sales:       Target,
  crm:         Users,
  automations: Zap,
  projects:    Briefcase,
};

const MODULE_COLOR: Record<string, string> = {
  support:     "text-rose-400",
  finance:     "text-emerald-400",
  sales:       "text-cyan-400",
  crm:         "text-violet-400",
  automations: "text-orange-400",
  projects:    "text-blue-400",
};

function DeviationBar({ current, baseline, severity }: { current: number; baseline: number; severity: AnomalySeverity }) {
  const max = Math.max(current, baseline) * 1.3;
  const baselinePct = Math.min((baseline / max) * 100, 100);
  const currentPct  = Math.min((current  / max) * 100, 100);
  const cfg = SEVERITY_CONFIG[severity];
  const isBelow = current < baseline;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>Baseline: {baseline}</span>
        <span className={cfg.color}>Current: {current}</span>
      </div>
      <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-muted/60 rounded-full transition-all"
          style={{ width: `${baselinePct}%` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${currentPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`absolute left-0 top-0 h-full rounded-full ${
            severity === "critical" ? "bg-rose-500" : severity === "warning" ? "bg-amber-500" : "bg-blue-500"
          }`}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/40"
          style={{ left: `${baselinePct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="w-2 h-0.5 bg-foreground/40 rounded" /> Baseline
        </span>
        <span className="flex items-center gap-1">
          {isBelow
            ? <TrendingDown className="w-2.5 h-2.5 text-rose-400" />
            : <TrendingUp   className="w-2.5 h-2.5 text-rose-400" />}
          {isBelow ? "" : "+"}{Math.round(((current - baseline) / Math.max(baseline, 1)) * 100)}% vs baseline
        </span>
      </div>
    </div>
  );
}

function AnomalyCard({ anomaly, index }: { anomaly: Anomaly; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[anomaly.severity];
  const SevIcon  = cfg.icon;
  const ModIcon  = MODULE_ICON[anomaly.module] ?? ShieldAlert;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Card className={`border ${cfg.border} ${cfg.bg} ${cfg.ring} transition-all hover:brightness-105`}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* Severity icon */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
              <SevIcon className={`w-4.5 h-4.5 ${cfg.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <Badge className={`text-[10px] font-mono px-1.5 py-0 border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                  {cfg.label}
                </Badge>
                <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 capitalize ${MODULE_COLOR[anomaly.module] ?? "text-muted-foreground"} border-border/40`}>
                  <ModIcon className="w-2.5 h-2.5 mr-1 inline" />{anomaly.module}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">
                  {anomaly.metric}
                </span>
              </div>
              <CardTitle className="text-sm font-semibold leading-snug">{anomaly.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{anomaly.description}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Deviation bar */}
          <DeviationBar current={anomaly.current} baseline={anomaly.baseline} severity={anomaly.severity} />

          {/* AI Explanation */}
          <AnimatePresence>
            {anomaly.aiExplanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="p-3 rounded-lg bg-card/60 border border-border/40 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <BrainCircuit className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-mono text-primary uppercase tracking-wider">NEXUS AI Analysis</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{anomaly.aiExplanation}</p>
                </div>
                {anomaly.suggestedAction && (
                  <div className="flex gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-mono text-primary uppercase mb-0.5">Suggested action</p>
                      <p className="text-xs text-foreground leading-relaxed">{anomaly.suggestedAction}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!anomaly.aiExplanation && (
            <p className="text-[10px] text-muted-foreground/50 font-mono italic">
              AI analysis not available — add an OPENAI_API_KEY to enable insights.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PulsingDot({ severity }: { severity: AnomalySeverity }) {
  const colors: Record<AnomalySeverity, string> = {
    critical: "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
    warning:  "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    info:     "bg-blue-500",
  };
  return <div className={`w-2 h-2 rounded-full animate-pulse ${colors[severity]}`} />;
}

export default function Anomalies() {
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery<AnomalyResponse>({
    queryKey: ["anomalies"],
    queryFn: () => fetch(`${API}/anomalies`).then((r) => r.json()),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const scanMutation = useMutation({
    mutationFn: () => fetch(`${API}/anomalies/scan`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (d: AnomalyResponse) => {
      setLastScan(new Date());
      toast.success(`Scan complete — ${d.anomalies.length} anomal${d.anomalies.length === 1 ? "y" : "ies"} detected`);
      refetch();
    },
    onError: () => toast.error("Scan failed"),
  });

  useEffect(() => {
    timerRef.current = setInterval(() => refetch(), 2 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refetch]);

  const anomalies = data?.anomalies ?? [];
  const criticals = anomalies.filter((a) => a.severity === "critical");
  const warnings  = anomalies.filter((a) => a.severity === "warning");
  const infos     = anomalies.filter((a) => a.severity === "info");

  const systemStatus =
    criticals.length > 0 ? "critical" :
    warnings.length  > 0 ? "degraded" :
    anomalies.length > 0 ? "attention" : "nominal";

  const statusConfig = {
    critical:  { label: "System Critical",  color: "text-rose-400",    dot: "bg-rose-500",    border: "border-rose-500/30"   },
    degraded:  { label: "System Degraded",  color: "text-amber-400",   dot: "bg-amber-500",   border: "border-amber-500/30"  },
    attention: { label: "Attention Needed", color: "text-blue-400",    dot: "bg-blue-500",    border: "border-blue-500/30"   },
    nominal:   { label: "All Systems Nominal", color: "text-emerald-400", dot: "bg-emerald-500", border: "border-emerald-500/30" },
  }[systemStatus];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-primary" />
            Anomaly Detection
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            AI monitors your metrics 24/7 and flags deviations from baseline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            <Scan className={`w-3.5 h-3.5 ${scanMutation.isPending ? "animate-pulse" : ""}`} />
            {scanMutation.isPending ? "Scanning…" : "Scan Now"}
          </Button>
        </div>
      </div>

      {/* System status banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center justify-between px-5 py-3.5 rounded-xl border ${statusConfig.border} bg-card/40 backdrop-blur`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${statusConfig.dot}`} />
          <span className={`font-mono font-semibold text-sm ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            — {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"} detected across {new Set(anomalies.map(a => a.module)).size} modules
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          {data?.cachedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Scanned {new Date(data.cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="text-muted-foreground/40">Auto-scan every 2m</span>
        </div>
      </motion.div>

      {/* Severity summary */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Critical", count: criticals.length, severity: "critical" as AnomalySeverity, icon: ShieldAlert },
            { label: "Warning",  count: warnings.length,  severity: "warning"  as AnomalySeverity, icon: AlertTriangle },
            { label: "Info",     count: infos.length,     severity: "info"     as AnomalySeverity, icon: Info },
          ].map(({ label, count, severity, icon: Icon }) => {
            const cfg = SEVERITY_CONFIG[severity];
            return (
              <div
                key={label}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  count > 0 ? `${cfg.border} ${cfg.bg}` : "border-border/30 bg-card/20 opacity-50"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${count > 0 ? cfg.color : "text-muted-foreground"}`} />
                <div>
                  <div className={`text-2xl font-mono font-bold ${count > 0 ? cfg.color : "text-muted-foreground"}`}>
                    {count}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">{label}</div>
                </div>
                {count > 0 && <PulsingDot severity={severity} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Anomaly cards */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : anomalies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-emerald-400 font-mono">All systems nominal</p>
            <p className="text-sm text-muted-foreground mt-1">No anomalies detected across any module.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-xs mt-2" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
            <Scan className="w-3.5 h-3.5" /> Run fresh scan
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {/* Critical first, then warning, then info */}
          {[...criticals, ...warnings, ...infos].map((anomaly, i) => (
            <AnomalyCard key={anomaly.id} anomaly={anomaly} index={i} />
          ))}
        </div>
      )}

      {/* Footer note */}
      {anomalies.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50 pt-2">
          <Sparkles className="w-3 h-3" />
          AI explanations generated by NEXUS AI using live company metrics as context.
        </div>
      )}
    </div>
  );
}
