import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Zap, Plus, Play, Pause, Trash2, Sparkles, CheckCircle,
  AlertCircle, Clock, TrendingUp, X, ChevronRight, Settings2,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Automation = {
  id: number;
  name: string;
  description: string | null;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
  status: string;
  runsTotal: number;
  runsSuccess: number;
  lastRunAt: string | null;
  createdAt: string;
};

type AiSuggestion = {
  name: string;
  trigger: string;
  action: string;
  description: string;
  impact: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  "lead.created":       "Lead Created",
  "lead.qualified":     "Lead Qualified",
  "deal.stage_changed": "Deal Stage Changed",
  "deal.won":           "Deal Won",
  "deal.lost":          "Deal Lost",
  "ticket.created":     "Ticket Created",
  "ticket.resolved":    "Ticket Resolved",
  "invoice.overdue":    "Invoice Overdue",
  "invoice.paid":       "Invoice Paid",
  "contact.created":    "Contact Added",
  "project.completed":  "Project Completed",
  "schedule.daily":     "Daily Schedule",
  "schedule.weekly":    "Weekly Schedule",
};

const ACTION_LABELS: Record<string, string> = {
  "ai.qualify_lead":     "AI: Qualify Lead",
  "ai.triage_ticket":    "AI: Triage Ticket",
  "ai.generate_copy":    "AI: Generate Copy",
  "ai.morning_brief":    "AI: Morning Brief",
  "ai.finance_forecast": "AI: Finance Forecast",
  "ai.detect_anomalies": "AI: Detect Anomalies",
  "ai.map_okrs":         "AI: OKR Intelligence",
  "email.send_reminder": "Email: Send Reminder",
  "email.send_welcome":  "Email: Send Welcome",
  "crm.update_status":   "CRM: Update Status",
  "crm.create_task":     "CRM: Create Task",
  "slack.notify":        "Slack: Notify Channel",
  "webhook.fire":        "Webhook: Fire Event",
  "report.generate":     "Report: Generate PDF",
};

const TRIGGER_COLORS: Record<string, string> = {
  "lead":    "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "deal":    "text-primary bg-primary/10 border-primary/20",
  "ticket":  "text-destructive bg-destructive/10 border-destructive/20",
  "invoice": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "contact": "text-secondary bg-secondary/10 border-secondary/20",
  "project": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "schedule":"text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

function triggerColor(trigger: string) {
  const prefix = trigger.split(".")[0];
  return TRIGGER_COLORS[prefix] ?? "text-muted-foreground bg-muted/20 border-border";
}

function successRate(a: Automation) {
  if (!a.runsTotal) return null;
  return Math.round((a.runsSuccess / a.runsTotal) * 100);
}

function AutomationCard({ automation, onToggle, onRun, onDelete }: {
  automation: Automation;
  onToggle: (id: number) => void;
  onRun: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const rate = successRate(automation);
  const isActive = automation.status === "active";

  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur transition-all ${isActive ? "hover:border-primary/30" : "opacity-60 hover:opacity-80"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-muted-foreground"}`} />
              <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 border ${triggerColor(automation.trigger)}`}>
                {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
              </Badge>
            </div>
            <CardTitle className="text-sm font-semibold">{automation.name}</CardTitle>
            {automation.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{automation.description}</p>
            )}
          </div>
          <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] font-mono shrink-0">
            {isActive ? "Active" : "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs">
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span className="font-mono text-[11px] text-muted-foreground">{ACTION_LABELS[automation.action] ?? automation.action}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <div className="text-sm font-mono font-bold">{automation.runsTotal}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Runs</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono font-bold text-emerald-400">{automation.runsSuccess}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Success</div>
          </div>
          <div className="text-center">
            <div className={`text-sm font-mono font-bold ${rate !== null ? (rate >= 90 ? "text-emerald-400" : rate >= 70 ? "text-amber-400" : "text-destructive") : "text-muted-foreground"}`}>
              {rate !== null ? `${rate}%` : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase">Rate</div>
          </div>
        </div>

        {automation.lastRunAt && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <Clock className="w-2.5 h-2.5" />
            Last run {new Date(automation.lastRunAt).toLocaleString()}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1.5"
            onClick={() => onToggle(automation.id)}
          >
            {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isActive ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => onRun(automation.id)}
            disabled={!isActive}
          >
            <Play className="w-3 h-3" />
            Run
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(automation.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AiSuggestionsPanel({ suggestions, onUse, onClose }: {
  suggestions: AiSuggestion[];
  onUse: (s: AiSuggestion) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="border-primary/30 bg-gradient-to-b from-card to-primary/5 shadow-[0_0_20px_rgba(0,255,255,0.05)]">
        <CardHeader className="pb-3 border-b border-primary/10 flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> NEXUS AI Recommendations
          </CardTitle>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className="border border-border/50 rounded-lg p-3 space-y-2 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                  onClick={() => onUse(s)}
                >
                  Use
                </Button>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  {TRIGGER_LABELS[s.trigger] ?? s.trigger}
                </span>
                <ChevronRight className="w-3 h-3" />
                <span>{ACTION_LABELS[s.action] ?? s.action}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <TrendingUp className="w-2.5 h-2.5" /> {s.impact}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NewAutomationModal({ onClose, onCreate, prefill }: {
  onClose: () => void;
  onCreate: (data: Partial<Automation>) => void;
  prefill?: Partial<AiSuggestion>;
}) {
  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    description: prefill?.description ?? "",
    trigger: prefill?.trigger ?? "lead.created",
    action: prefill?.action ?? "ai.qualify_lead",
    status: "active",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2"><Settings2 className="w-5 h-5 text-primary" /> New Automation</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <input
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Automation name…"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block uppercase">When this happens (Trigger)</label>
            <select
              value={form.trigger}
              onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block uppercase">Do this (Action)</label>
            <select
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => { if (form.name) { onCreate({ ...form, triggerConfig: {}, actionConfig: {} }); onClose(); } }}
            disabled={!form.name}
          >
            Create Automation
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Automations() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [prefill, setPrefill] = useState<Partial<AiSuggestion> | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const { data: automations = [], isLoading } = useQuery<Automation[]>({
    queryKey: ["automations"],
    queryFn: () => fetch(`${API}/automations`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Automation>) => fetch(`${API}/automations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); toast.success("Automation created"); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/automations/${id}/toggle`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/automations/${id}/run`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); toast.success("Automation triggered successfully"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/automations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); toast.success("Automation deleted"); },
  });

  const handleAiSuggest = async () => {
    setSuggestLoading(true);
    try {
      const r = await fetch(`${API}/ai/automations/suggest`, { method: "POST" });
      const data = await r.json();
      setSuggestions(data.suggestions ?? []);
      setShowSuggestions(true);
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleUseSuggestion = (s: AiSuggestion) => {
    setPrefill(s);
    setShowSuggestions(false);
    setShowNew(true);
  };

  const active = automations.filter((a) => a.status === "active");
  const paused = automations.filter((a) => a.status !== "active");
  const totalRuns = automations.reduce((s, a) => s + a.runsTotal, 0);
  const successRuns = automations.reduce((s, a) => s + a.runsSuccess, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <AnimatePresence>
        {showNew && (
          <NewAutomationModal
            onClose={() => { setShowNew(false); setPrefill(undefined); }}
            onCreate={(data) => createMutation.mutate(data)}
            prefill={prefill}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" /> Automations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">Set rules once. Let NEXUS AI run them forever.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleAiSuggest}
            disabled={suggestLoading}
          >
            <Sparkles className="w-4 h-4" />
            {suggestLoading ? "Analyzing…" : "AI Suggest"}
          </Button>
          <Button className="gap-2" onClick={() => { setPrefill(undefined); setShowNew(true); }}>
            <Plus className="w-4 h-4" /> New Automation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: automations.length, color: "text-foreground" },
          { label: "Active", value: active.length, color: "text-emerald-400", icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> },
          { label: "Paused", value: paused.length, color: "text-amber-400", icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> },
          { label: "Total Runs", value: totalRuns.toLocaleString(), color: "text-primary" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-card/30 border border-border/50 rounded-xl px-4 py-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 flex items-center gap-1">{icon}{label}</div>
            <div className={`text-xl font-mono font-bold ${color}`}>{isLoading ? <Skeleton className="h-6 w-10" /> : value}</div>
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      {totalRuns > 0 && (
        <div className="bg-card/30 border border-border/50 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-muted-foreground uppercase">Overall Success Rate</span>
            <span className="text-sm font-mono font-bold text-emerald-400">{Math.round((successRuns / totalRuns) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round((successRuns / totalRuns) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <AiSuggestionsPanel suggestions={suggestions} onUse={handleUseSuggestion} onClose={() => setShowSuggestions(false)} />
        )}
      </AnimatePresence>

      {/* Automations Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : automations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm mb-3">No automations yet. Let NEXUS AI suggest some, or build your own.</p>
          <Button variant="outline" onClick={handleAiSuggest} className="gap-2">
            <Sparkles className="w-4 h-4" /> Get AI Suggestions
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-emerald-400" /> Active ({active.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((a) => (
                  <AutomationCard
                    key={a.id}
                    automation={a}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onRun={(id) => runMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}
          {paused.length > 0 && (
            <div>
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-amber-400" /> Paused ({paused.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paused.map((a) => (
                  <AutomationCard
                    key={a.id}
                    automation={a}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onRun={(id) => runMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
