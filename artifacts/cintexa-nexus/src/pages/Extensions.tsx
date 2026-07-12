import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle, Plus, X, Loader2, Webhook, Globe, Zap, CheckCircle2,
  AlertCircle, Settings, Trash2, Play, Box, ChevronRight,
  MessageSquare, Mail, CreditCard, Cloud, BookOpen, Calendar,
  Phone, Cpu, Layers, DollarSign, Briefcase, Search, Filter,
  Link, ArrowRight, MoreHorizontal, Toggle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = "/api";

type Webhook = { id: number; name: string; url: string; events: string[]; isActive: boolean; deliveriesTotal: number; deliveriesSuccess: number; lastDeliveredAt: string | null; };
type CatalogueItem = { key: string; name: string; category: string; description: string; icon: string; color: string; popular: boolean; };
type Connection = { id: number; integrationKey: string; displayName: string; status: string; connectedAt: string | null; };
type CustomObjectDef = { id: number; name: string; pluralName: string; icon: string; color: string; fields: any[]; isActive: boolean; };
type WorkflowDef = { id: number; name: string; description: string | null; isActive: boolean; trigger: any; steps: any[]; runsTotal: number; runsSuccess: number; lastRunAt: string | null; };

const ICON_MAP: Record<string, any> = { MessageSquare, Mail, CreditCard, Cloud, BookOpen, Calendar, Phone, Cpu, Layers, DollarSign, Briefcase, Zap, Box };
const EVENTS = ["lead.created", "deal.won", "deal.lost", "ticket.created", "ticket.resolved", "invoice.paid", "contact.created", "project.completed"];
const TRIGGER_TYPES = ["record.created", "record.updated", "field.changed", "deal.stage_changed", "lead.score_threshold", "invoice.overdue", "schedule.daily", "schedule.weekly"];
const ACTION_TYPES = ["send_email", "create_task", "update_field", "send_webhook", "create_note", "notify_slack", "ai.qualify_lead", "ai.draft_email"];

function WebhookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });
  const [saving, setSaving] = useState(false);
  const toggle = (ev: string) => setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));
  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/webhooks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created"); onClose();
    } catch { toast.error("Failed to create"); }
    setSaving(false);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">New Webhook</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-sm" />
          <Input placeholder="https://your-endpoint.com/hook" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="font-mono text-sm" />
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-2">Subscribe to events:</p>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map(ev => (
                <button key={ev} onClick={() => toggle(ev)} className={cn("px-2 py-1 rounded border text-xs font-mono transition-colors", form.events.includes(ev) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                  {ev}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name || !form.url}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomObjectDialog({ open, onClose, def }: { open: boolean; onClose: () => void; def?: CustomObjectDef }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: def?.name ?? "", pluralName: def?.pluralName ?? "", icon: def?.icon ?? "Box", color: def?.color ?? "#6366f1", fields: def?.fields ?? [] as { name: string; type: string; required: boolean }[] });
  const [saving, setSaving] = useState(false);
  const addField = () => setForm(f => ({ ...f, fields: [...f.fields, { name: "", type: "text", required: false }] }));
  const updateField = (i: number, patch: any) => setForm(f => ({ ...f, fields: f.fields.map((fld: any, idx: number) => idx === i ? { ...fld, ...patch } : fld) }));
  const removeField = (i: number) => setForm(f => ({ ...f, fields: f.fields.filter((_: any, idx: number) => idx !== i) }));
  const save = async () => {
    setSaving(true);
    try {
      const url = def ? `${API}/custom-objects/defs/${def.id}` : `${API}/custom-objects/defs`;
      await fetch(url, { method: def ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      qc.invalidateQueries({ queryKey: ["custom-object-defs"] });
      toast.success(def ? "Updated" : "Object type created"); onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">{def ? "Edit Object Type" : "New Custom Object"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Name (e.g. Asset)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-sm" />
            <Input placeholder="Plural (e.g. Assets)" value={form.pluralName} onChange={e => setForm(f => ({ ...f, pluralName: e.target.value }))} className="font-mono text-sm" />
          </div>
          <div className="flex gap-3 items-center">
            <Input placeholder="#6366f1" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="font-mono text-sm" />
            <div className="w-8 h-8 rounded-md border border-border" style={{ background: form.color }} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-muted-foreground">Fields</p>
              <Button size="sm" variant="ghost" onClick={addField} className="text-xs font-mono gap-1"><Plus className="h-3 w-3" /> Add Field</Button>
            </div>
            <div className="space-y-2">
              {(form.fields as any[]).map((fld, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={fld.name} onChange={e => updateField(i, { name: e.target.value })} placeholder="Field name" className="font-mono text-xs h-8" />
                  <Select value={fld.type} onValueChange={v => updateField(i, { type: v })}>
                    <SelectTrigger className="w-28 h-8 font-mono text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{["text", "number", "date", "boolean", "select"].map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeField(i)}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowDialog({ open, onClose, wf }: { open: boolean; onClose: () => void; wf?: WorkflowDef }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: wf?.name ?? "", description: wf?.description ?? "",
    trigger: wf?.trigger ?? { type: "record.created", module: "leads" },
    steps: wf?.steps ?? [] as { type: string; config: any }[],
  });
  const [saving, setSaving] = useState(false);
  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { type: "send_email", config: {} }] }));
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_: any, idx: number) => idx !== i) }));
  const updateStep = (i: number, patch: any) => setForm(f => ({ ...f, steps: f.steps.map((s: any, idx: number) => idx === i ? { ...s, ...patch } : s) }));

  const save = async () => {
    setSaving(true);
    try {
      const url = wf ? `${API}/workflows/${wf.id}` : `${API}/workflows`;
      await fetch(url, { method: wf ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(wf ? "Updated" : "Workflow created"); onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-mono">{wf ? "Edit Workflow" : "New Workflow"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Workflow name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="font-mono text-sm" />
          <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="font-mono text-sm" rows={2} />

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-mono text-primary font-semibold mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> TRIGGER</p>
            <Select value={form.trigger.type} onValueChange={v => setForm(f => ({ ...f, trigger: { ...f.trigger, type: v } }))}>
              <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGER_TYPES.map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Actions</p>
              <Button size="sm" variant="ghost" onClick={addStep} className="text-xs gap-1"><Plus className="h-3 w-3" /> Add Step</Button>
            </div>
            {(form.steps as any[]).map((step, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-border bg-card">
                <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <Select value={step.type} onValueChange={v => updateStep(i, { type: v })}>
                  <SelectTrigger className="font-mono text-xs h-8 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => removeStep(i)}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            {form.steps.length === 0 && <p className="text-xs font-mono text-muted-foreground text-center py-3">No actions yet — add steps above</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Workflow"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Extensions() {
  const qc = useQueryClient();
  const [newWebhook, setNewWebhook] = useState(false);
  const [newCustomObj, setNewCustomObj] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState(false);
  const [editWorkflow, setEditWorkflow] = useState<WorkflowDef | null>(null);
  const [editObj, setEditObj] = useState<CustomObjectDef | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const { data: webhooks = [] } = useQuery<Webhook[]>({ queryKey: ["webhooks"], queryFn: () => fetch(`${API}/webhooks`).then(r => r.json()) });
  const { data: catalogue = [] } = useQuery<CatalogueItem[]>({ queryKey: ["marketplace-catalogue"], queryFn: () => fetch(`${API}/marketplace/catalogue`).then(r => r.json()) });
  const { data: connections = [] } = useQuery<Connection[]>({ queryKey: ["marketplace-connections"], queryFn: () => fetch(`${API}/marketplace/connections`).then(r => r.json()) });
  const { data: objectDefs = [] } = useQuery<CustomObjectDef[]>({ queryKey: ["custom-object-defs"], queryFn: () => fetch(`${API}/custom-objects/defs`).then(r => r.json()) });
  const { data: workflows = [] } = useQuery<WorkflowDef[]>({ queryKey: ["workflows"], queryFn: () => fetch(`${API}/workflows`).then(r => r.json()) });

  const testWebhook = useMutation({
    mutationFn: (id: number) => fetch(`${API}/webhooks/${id}/test`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => toast[data.success ? "success" : "error"](data.success ? "Test delivered successfully" : "Test delivery failed"),
  });
  const deleteWebhook = useMutation({
    mutationFn: (id: number) => fetch(`${API}/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Deleted"); },
  });
  const connectIntegration = useMutation({
    mutationFn: (key: string) => fetch(`${API}/marketplace/connections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integrationKey: key }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketplace-connections"] }); toast.success("Connected"); },
  });
  const disconnectIntegration = useMutation({
    mutationFn: (id: number) => fetch(`${API}/marketplace/connections/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketplace-connections"] }); toast.success("Disconnected"); },
  });
  const deleteObj = useMutation({
    mutationFn: (id: number) => fetch(`${API}/custom-objects/defs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-object-defs"] }),
  });
  const toggleWorkflow = useMutation({
    mutationFn: (id: number) => fetch(`${API}/workflows/${id}/toggle`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
  const runWorkflow = useMutation({
    mutationFn: (id: number) => fetch(`${API}/workflows/${id}/run`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workflows"] }); toast.success("Workflow executed"); },
  });
  const deleteWorkflow = useMutation({
    mutationFn: (id: number) => fetch(`${API}/workflows/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const categories = ["All", ...Array.from(new Set(catalogue.map(c => c.category)))];
  const filteredCatalogue = catalogue.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || c.category === catFilter;
    return matchSearch && matchCat;
  });

  const connectedKeys = new Set(connections.map(c => c.integrationKey));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Puzzle className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-mono font-bold">Platform & Extensions</h1>
          <p className="text-muted-foreground font-mono text-sm">Marketplace · Custom Objects · Workflow Builder · Webhooks</p>
        </div>
      </div>

      <Tabs defaultValue="marketplace">
        <TabsList className="font-mono">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="workflows">Workflow Builder</TabsTrigger>
          <TabsTrigger value="objects">Custom Objects</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {/* ── Marketplace ── */}
        <TabsContent value="marketplace" className="mt-4 space-y-4">
          {connections.length > 0 && (
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Connected ({connections.length})</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {connections.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span className="text-xs font-mono text-green-400">{c.displayName}</span>
                    <button onClick={() => disconnectIntegration.mutate(c.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations..." className="pl-9 font-mono text-sm" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-40 font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="font-mono text-sm">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalogue.map(item => {
              const Icon = ICON_MAP[item.icon] ?? Box;
              const isConnected = connectedKeys.has(item.key);
              const conn = connections.find(c => c.integrationKey === item.key);
              return (
                <motion.div key={item.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={cn("border-border hover:border-primary/30 transition-colors h-full", isConnected && "border-green-500/30")}>
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.color + "20", border: `1px solid ${item.color}40` }}>
                          <Icon className="h-5 w-5" style={{ color: item.color }} />
                        </div>
                        <div className="flex items-center gap-2">
                          {item.popular && <Badge variant="outline" className="text-xs font-mono px-1 h-4 text-primary border-primary/30">Popular</Badge>}
                          {isConnected && <Badge variant="outline" className="text-xs font-mono px-1 h-4 text-green-400 border-green-500/30">Connected</Badge>}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-mono font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 mb-2">{item.category}</p>
                        <p className="text-xs text-muted-foreground font-mono leading-relaxed">{item.description}</p>
                      </div>
                      <div className="mt-3">
                        {isConnected ? (
                          <Button size="sm" variant="outline" className="w-full font-mono text-xs text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-400/50" onClick={() => conn && disconnectIntegration.mutate(conn.id)}>
                            Disconnect
                          </Button>
                        ) : (
                          <Button size="sm" className="w-full font-mono text-xs gap-1" onClick={() => connectIntegration.mutate(item.key)}>
                            <Link className="h-3 w-3" /> Connect
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Workflow Builder ── */}
        <TabsContent value="workflows" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-mono">{workflows.filter(w => w.isActive).length} active workflows · {workflows.reduce((a, w) => a + w.runsTotal, 0)} total runs</p>
            </div>
            <Button onClick={() => setNewWorkflow(true)} size="sm" className="gap-2 font-mono"><Plus className="h-4 w-4" /> New Workflow</Button>
          </div>
          <div className="space-y-3">
            {workflows.map(wf => (
              <motion.div key={wf.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className={cn("border-border hover:border-primary/30 transition-colors", wf.isActive && "border-green-500/20")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Zap className={cn("h-4 w-4", wf.isActive ? "text-green-400" : "text-muted-foreground")} />
                          <p className="font-mono font-semibold">{wf.name}</p>
                          <Badge variant="outline" className={cn("text-xs font-mono px-1 h-4", wf.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-muted-foreground")}>{wf.isActive ? "Active" : "Paused"}</Badge>
                        </div>
                        {wf.description && <p className="text-xs text-muted-foreground font-mono mt-1">{wf.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" /> Trigger: {(wf.trigger as any)?.type ?? "custom"}</span>
                          <span className="text-xs font-mono text-muted-foreground">{wf.steps.length} steps</span>
                          <span className="text-xs font-mono text-muted-foreground">{wf.runsTotal} runs · {wf.runsSuccess} success</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => runWorkflow.mutate(wf.id)} title="Run now"><Play className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => toggleWorkflow.mutate(wf.id)}>{wf.isActive ? "Pause" : "Activate"}</Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditWorkflow(wf)}><Settings className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-red-400 hover:text-red-300" onClick={() => deleteWorkflow.mutate(wf.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {workflows.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Zap className="h-10 w-10 mb-3 mx-auto opacity-30" />
                <p className="font-mono text-sm">No workflows yet — build your first automation</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Custom Objects ── */}
        <TabsContent value="objects" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-mono text-muted-foreground">{objectDefs.length} custom object type{objectDefs.length !== 1 ? "s" : ""}</p>
            <Button onClick={() => setNewCustomObj(true)} size="sm" className="gap-2 font-mono"><Plus className="h-4 w-4" /> New Object Type</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {objectDefs.map(obj => (
              <motion.div key={obj.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="border-border hover:border-primary/30 transition-colors group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: obj.color + "20", border: `1px solid ${obj.color}40` }}>
                        <Box className="h-5 w-5" style={{ color: obj.color }} />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditObj(obj)}><Settings className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => deleteObj.mutate(obj.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <p className="font-mono font-semibold">{obj.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{obj.pluralName}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-mono text-muted-foreground">{obj.fields.length} field{obj.fields.length !== 1 ? "s" : ""}</span>
                      <Badge variant="outline" className={cn("text-xs font-mono px-1 h-4", obj.isActive ? "text-green-400 border-green-500/30" : "text-muted-foreground")}>{obj.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                    {obj.fields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(obj.fields as any[]).slice(0, 4).map((f: any, i: number) => <Badge key={i} variant="secondary" className="text-xs font-mono px-1 h-4">{f.name}</Badge>)}
                        {obj.fields.length > 4 && <Badge variant="secondary" className="text-xs font-mono px-1 h-4">+{obj.fields.length - 4}</Badge>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {objectDefs.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Box className="h-10 w-10 mb-3 mx-auto opacity-30" />
                <p className="font-mono text-sm">No custom objects yet — define your own data models</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Webhooks ── */}
        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-mono text-muted-foreground">{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} · {webhooks.filter(w => w.isActive).length} active</p>
            <Button onClick={() => setNewWebhook(true)} size="sm" className="gap-2 font-mono"><Plus className="h-4 w-4" /> New Webhook</Button>
          </div>
          <div className="space-y-3">
            {webhooks.map(wh => (
              <motion.div key={wh.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Webhook className="h-4 w-4 text-muted-foreground" />
                          <p className="font-mono font-semibold">{wh.name}</p>
                          <Badge variant="outline" className={cn("text-xs font-mono px-1 h-4", wh.isActive ? "bg-green-500/20 text-green-400" : "text-muted-foreground")}>{wh.isActive ? "Active" : "Paused"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{wh.url}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {wh.events?.map((ev: string) => <Badge key={ev} variant="secondary" className="text-xs font-mono px-1 h-4">{ev}</Badge>)}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{wh.deliveriesTotal} deliveries · {wh.deliveriesSuccess} success</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-8 px-2 text-xs font-mono" onClick={() => testWebhook.mutate(wh.id)} disabled={testWebhook.isPending}>Test</Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-red-400 hover:text-red-300" onClick={() => deleteWebhook.mutate(wh.id)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {webhooks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Webhook className="h-10 w-10 mb-3 mx-auto opacity-30" />
                <p className="font-mono text-sm">No webhooks configured</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <WebhookDialog open={newWebhook} onClose={() => setNewWebhook(false)} />
      <CustomObjectDialog open={newCustomObj || !!editObj} onClose={() => { setNewCustomObj(false); setEditObj(null); }} def={editObj ?? undefined} />
      <WorkflowDialog open={newWorkflow || !!editWorkflow} onClose={() => { setNewWorkflow(false); setEditWorkflow(null); }} wf={editWorkflow ?? undefined} />
    </div>
  );
}
