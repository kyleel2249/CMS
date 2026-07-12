import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Puzzle, Plus, Trash2, Power, TestTube2, X, Globe, Shield,
  CheckCircle, AlertCircle, Activity, Code2, Key, Zap,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Webhook = {
  id: number;
  name: string;
  url: string;
  events: string;
  isActive: boolean;
  deliveriesTotal: number;
  deliveriesSuccess: number;
  lastDeliveredAt: string | null;
  createdAt: string;
};

const AVAILABLE_EVENTS = [
  "lead.created", "lead.qualified",
  "deal.stage_changed", "deal.won", "deal.lost",
  "ticket.created", "ticket.resolved",
  "invoice.paid", "invoice.overdue",
  "contact.created", "project.completed",
  "automation.triggered", "*",
];

const INTEGRATION_CARDS = [
  { name: "Slack", icon: "💬", description: "Send NEXUS alerts to Slack channels", status: "available", tag: "Messaging" },
  { name: "HubSpot", icon: "🟠", description: "Sync contacts and deals bidirectionally", status: "available", tag: "CRM" },
  { name: "Salesforce", icon: "☁️", description: "Mirror your entire CRM pipeline", status: "available", tag: "CRM" },
  { name: "QuickBooks", icon: "📊", description: "Sync invoices and revenue data", status: "available", tag: "Finance" },
  { name: "Stripe", icon: "💳", description: "Import payment events as activity", status: "available", tag: "Payments" },
  { name: "GitHub", icon: "🐙", description: "Link commits and PRs to projects", status: "available", tag: "Dev" },
  { name: "Jira", icon: "🔵", description: "Sync project tasks and sprints", status: "available", tag: "Projects" },
  { name: "Notion", icon: "⬜", description: "Publish knowledge articles to Notion", status: "available", tag: "Knowledge" },
  { name: "Zapier", icon: "⚡", description: "Connect NEXUS to 5,000+ apps", status: "available", tag: "Platform" },
  { name: "n8n", icon: "🔄", description: "Self-hosted workflow automation bridge", status: "available", tag: "Platform" },
  { name: "Segment", icon: "🔴", description: "Stream customer events to your data warehouse", status: "available", tag: "Analytics" },
  { name: "Intercom", icon: "💙", description: "Unified customer messaging layer", status: "available", tag: "Support" },
];

function WebhookCard({ webhook, onToggle, onTest, onDelete, testingId }: {
  webhook: Webhook;
  onToggle: (id: number) => void;
  onTest: (id: number) => void;
  onDelete: (id: number) => void;
  testingId: number | null;
}) {
  const rate = webhook.deliveriesTotal > 0
    ? Math.round((webhook.deliveriesSuccess / webhook.deliveriesTotal) * 100)
    : null;

  const events = webhook.events.split(",").map((e) => e.trim());

  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur transition-all ${webhook.isActive ? "hover:border-primary/30" : "opacity-60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${webhook.isActive ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-muted-foreground"}`} />
              <Badge variant="outline" className="text-[10px] font-mono">
                {webhook.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <CardTitle className="text-sm font-semibold">{webhook.name}</CardTitle>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{webhook.url}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1.5">Subscribed Events</p>
          <div className="flex flex-wrap gap-1">
            {events.slice(0, 4).map((e) => (
              <span key={e} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                {e === "*" ? "all events" : e}
              </span>
            ))}
            {events.length > 4 && <span className="text-[9px] font-mono text-muted-foreground">+{events.length - 4} more</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <div className="text-sm font-mono font-bold">{webhook.deliveriesTotal}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono font-bold text-emerald-400">{webhook.deliveriesSuccess}</div>
            <div className="text-[9px] text-muted-foreground uppercase">OK</div>
          </div>
          <div className="text-center">
            <div className={`text-sm font-mono font-bold ${rate !== null ? (rate >= 90 ? "text-emerald-400" : "text-amber-400") : "text-muted-foreground"}`}>
              {rate !== null ? `${rate}%` : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase">Rate</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => onToggle(webhook.id)}>
            <Power className="w-3 h-3" /> {webhook.isActive ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-secondary/30 text-secondary hover:bg-secondary/10"
            onClick={() => onTest(webhook.id)}
            disabled={testingId === webhook.id || !webhook.isActive}
          >
            <TestTube2 className="w-3 h-3" />
            {testingId === webhook.id ? "…" : "Test"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(webhook.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewWebhookModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Partial<Webhook>) => void }) {
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });

  const toggleEvent = (e: string) =>
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> New Webhook</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <Input placeholder="Webhook name…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input placeholder="https://your-endpoint.com/webhook" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className="font-mono text-sm" />
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Subscribe to Events</p>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_EVENTS.map((evt) => (
              <button
                key={evt}
                onClick={() => toggleEvent(evt)}
                className={`text-[10px] font-mono px-2 py-1 rounded-full border transition-colors ${form.events.includes(evt) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                {evt === "*" ? "all events" : evt}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => { if (form.name && form.url && form.events.length > 0) { onCreate({ ...form, events: form.events.join(",") }); onClose(); } }}
            disabled={!form.name || !form.url || form.events.length === 0}
          >
            Create Webhook
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Extensions() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"webhooks" | "integrations" | "api">("webhooks");

  const { data: webhooks = [], isLoading } = useQuery<Webhook[]>({
    queryKey: ["webhooks"],
    queryFn: () => fetch(`${API}/webhooks`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Webhook>) => fetch(`${API}/webhooks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook created"); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/webhooks/${id}/toggle`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook removed"); },
  });

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const r = await fetch(`${API}/webhooks/${id}/test`, { method: "POST" });
      const data = await r.json();
      if (data.success) {
        toast.success("Test delivery successful");
      } else {
        toast.error("Test delivery failed — check your endpoint URL");
      }
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    } catch {
      toast.error("Test delivery failed");
    } finally {
      setTestingId(null);
    }
  };

  const totalDeliveries = webhooks.reduce((s, w) => s + w.deliveriesTotal, 0);
  const totalSuccess = webhooks.reduce((s, w) => s + w.deliveriesSuccess, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <AnimatePresence>
        {showNew && <NewWebhookModal onClose={() => setShowNew(false)} onCreate={(data) => createMutation.mutate(data)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Puzzle className="w-7 h-7 text-primary" /> Extensions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">Webhooks, integrations, and API access. Connect NEXUS to everything.</p>
        </div>
        {activeTab === "webhooks" && (
          <Button className="gap-2 shrink-0" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> New Webhook
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["webhooks", "integrations", "api"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono capitalize transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "webhooks" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Webhooks", value: webhooks.length, color: "text-primary" },
              { label: "Active", value: webhooks.filter((w) => w.isActive).length, color: "text-emerald-400" },
              { label: "Deliveries", value: totalDeliveries.toLocaleString(), color: "text-secondary" },
              { label: "Success Rate", value: totalDeliveries > 0 ? `${Math.round((totalSuccess / totalDeliveries) * 100)}%` : "—", color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card/30 border border-border/50 rounded-xl px-4 py-3">
                <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{label}</div>
                <div className={`text-xl font-mono font-bold ${color}`}>{isLoading ? <Skeleton className="h-6 w-10" /> : value}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-3">No webhooks configured. Start streaming NEXUS events to any endpoint.</p>
              <Button variant="outline" onClick={() => setShowNew(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create First Webhook
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {webhooks.map((w) => (
                <WebhookCard
                  key={w.id}
                  webhook={w}
                  onToggle={(id) => toggleMutation.mutate(id)}
                  onTest={handleTest}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  testingId={testingId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "integrations" && (
        <div className="space-y-4">
          <p className="text-xs font-mono text-muted-foreground">
            Connect NEXUS to your existing tools. Click any integration to configure it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRATION_CARDS.map((int) => (
              <motion.div key={int.name} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
                <Card
                  className="border-border/50 bg-card/50 backdrop-blur cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => toast.info(`${int.name} integration — connect your API key in Settings to activate`)}
                >
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{int.icon}</span>
                        <div>
                          <p className="font-semibold text-sm">{int.name}</p>
                          <Badge variant="outline" className="text-[9px] font-mono mt-0.5">{int.tag}</Badge>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[9px] font-mono">Available</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{int.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "api" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <Key className="w-5 h-5 text-primary" />, title: "API Keys", desc: "Generate and rotate API keys for programmatic access to all NEXUS modules.", badge: "REST" },
              { icon: <Code2 className="w-5 h-5 text-secondary" />, title: "OpenAPI Spec", desc: "Full OpenAPI 3.1 specification with 40+ endpoints covering every module.", badge: "v3.1" },
              { icon: <Zap className="w-5 h-5 text-amber-400" />, title: "Event Streaming", desc: "Subscribe to real-time NEXUS events via Server-Sent Events or WebSockets.", badge: "SSE/WS" },
            ].map(({ icon, title, desc, badge }) => (
              <Card key={title} className="border-border/50 bg-card/50 backdrop-blur hover:border-primary/30 transition-all cursor-pointer" onClick={() => toast.info(`${title} — available in the enterprise tier`)}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">{icon}</div>
                    <Badge variant="outline" className="text-[10px] font-mono">{badge}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Reference Preview */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm flex items-center gap-2 font-mono text-muted-foreground">
                <Activity className="w-4 h-4" /> API Reference Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2 font-mono text-xs">
                {[
                  { method: "GET",    path: "/api/contacts",         desc: "List all contacts with pagination" },
                  { method: "POST",   path: "/api/leads",            desc: "Create lead (triggers AI qualification)" },
                  { method: "POST",   path: "/api/ai/chat",          desc: "Query NEXUS intelligence" },
                  { method: "GET",    path: "/api/knowledge",        desc: "Search knowledge base" },
                  { method: "POST",   path: "/api/automations",      desc: "Create automation rule" },
                  { method: "POST",   path: "/api/webhooks/:id/test", desc: "Test webhook delivery" },
                  { method: "GET",    path: "/api/dashboard/stats",  desc: "Executive KPI snapshot" },
                  { method: "POST",   path: "/api/ai/morning-brief", desc: "Generate AI morning brief" },
                ].map(({ method, path, desc }) => (
                  <div key={path} className="flex items-center gap-3 p-2 rounded border border-border/30 hover:border-primary/20 transition-colors">
                    <span className={`text-[10px] font-bold w-10 text-center ${method === "GET" ? "text-emerald-400" : method === "POST" ? "text-primary" : "text-amber-400"}`}>
                      {method}
                    </span>
                    <span className="text-foreground">{path}</span>
                    <span className="text-muted-foreground ml-auto">{desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
