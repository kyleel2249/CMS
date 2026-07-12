import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Plus, X, Loader2,
  CreditCard, Calendar, CheckCircle2, AlertCircle, Clock, BarChart3,
  RefreshCw, Cpu, ArrowUpRight, ChevronRight, Filter, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

const API = "/api";

type Invoice = { id: number; number: string; clientName: string; amount: number; tax: number | null; status: string; dueDate: string; paidAt: string | null; createdAt: string; };
type Metrics = { mrr: number; arr: number; totalPaid: number; totalOutstanding: number; totalOverdue: number; activeSubscriptions: number; trend: { month: string; revenue: number }[] };
type Schedule = { id: number; clientName: string; description: string; amount: number; currency: string; interval: string; status: string; nextBillingAt: string | null; };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

function InvoiceDialog({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice?: Invoice }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ clientName: invoice?.clientName ?? "", amount: String(invoice?.amount ?? ""), tax: String(invoice?.tax ?? ""), status: invoice?.status ?? "draft", dueDate: invoice?.dueDate ?? "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const url = invoice ? `${API}/invoices/${invoice.id}` : `${API}/invoices`;
      const method = invoice ? "PATCH" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), tax: form.tax ? Number(form.tax) : undefined }) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["billing-metrics"] });
      toast.success(invoice ? "Invoice updated" : "Invoice created");
      onClose();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">{invoice ? "Edit Invoice" : "New Invoice"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Client name" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="font-mono text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="font-mono text-sm" />
            <Input type="number" placeholder="Tax" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} className="font-mono text-sm" />
          </div>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="font-mono text-sm" />
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{["draft", "sent", "paid", "overdue", "cancelled"].map(s => <SelectItem key={s} value={s} className="font-mono">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice: Invoice }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: String(invoice.amount), method: "bank_transfer", reference: "" });
  const [saving, setSaving] = useState(false);

  const record = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/invoices/${invoice.id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["billing-metrics"] });
      toast.success("Payment recorded");
      onClose();
    } catch { toast.error("Failed to record payment"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">Record Payment — {invoice.number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="font-mono text-sm" />
          <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
            <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{["bank_transfer", "credit_card", "wire", "check", "crypto"].map(m => <SelectItem key={m} value={m} className="font-mono">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Reference / memo" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="font-mono text-sm" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={record} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ clientName: "", description: "", amount: "", currency: "USD", interval: "monthly", intervalCount: "1" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/billing/schedules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), intervalCount: Number(form.intervalCount) }) });
      qc.invalidateQueries({ queryKey: ["billing-schedules"] });
      qc.invalidateQueries({ queryKey: ["billing-metrics"] });
      toast.success("Billing schedule created");
      onClose();
    } catch { toast.error("Failed to create schedule"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="font-mono">New Billing Schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Client name" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="font-mono text-sm" />
          <Input placeholder="Description (e.g. Pro Plan)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="font-mono text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="font-mono text-sm" />
            <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
              <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{["USD", "EUR", "GBP", "CAD", "AUD"].map(c => <SelectItem key={c} value={c} className="font-mono">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Select value={form.interval} onValueChange={v => setForm(f => ({ ...f, interval: v }))}>
            <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{["weekly", "monthly", "quarterly", "yearly"].map(i => <SelectItem key={i} value={i} className="font-mono capitalize">{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FinanceInvoices() {
  const qc = useQueryClient();
  const [newInvoice, setNewInvoice] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [newSchedule, setNewSchedule] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["invoices"], queryFn: () => fetch(`${API}/invoices`).then(r => r.json()) });
  const { data: metrics } = useQuery<Metrics>({ queryKey: ["billing-metrics"], queryFn: () => fetch(`${API}/billing/metrics`).then(r => r.json()) });
  const { data: schedules = [] } = useQuery<Schedule[]>({ queryKey: ["billing-schedules"], queryFn: () => fetch(`${API}/billing/schedules`).then(r => r.json()) });

  const deleteInvoice = useMutation({
    mutationFn: (id: number) => fetch(`${API}/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Deleted"); },
  });

  const filtered = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);

  const fmt = (n: number) => `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold">Finance & Revenue</h1>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">Invoices, billing schedules, and revenue intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewSchedule(true)} size="sm" className="gap-2 font-mono">
            <RefreshCw className="h-4 w-4" /> Billing Schedule
          </Button>
          <Button onClick={() => setNewInvoice(true)} size="sm" className="gap-2 font-mono">
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "MRR", value: fmt(metrics?.mrr ?? 0), icon: TrendingUp, color: "text-green-400", sub: "Monthly recurring" },
          { label: "ARR", value: fmt(metrics?.arr ?? 0), icon: BarChart3, color: "text-blue-400", sub: "Annual run rate" },
          { label: "Outstanding", value: fmt(metrics?.totalOutstanding ?? 0), icon: Clock, color: "text-yellow-400", sub: "Awaiting payment" },
          { label: "Overdue", value: fmt(metrics?.totalOverdue ?? 0), icon: AlertCircle, color: "text-red-400", sub: `${schedules.filter(s => s.status === "active").length} active schedules` },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{label}</p>
                    <p className={cn("text-2xl font-mono font-bold mt-1", color)}>{value}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{sub}</p>
                  </div>
                  <Icon className={cn("h-5 w-5 mt-1", color)} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="invoices">
        <TabsList className="font-mono">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
          <TabsTrigger value="schedules">Billing Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          {/* Status filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "draft", "sent", "paid", "overdue"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-mono border transition-colors", statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                {s} {s !== "all" && <span className="ml-1 opacity-60">{invoices.filter(i => i.status === s).length}</span>}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm font-mono">
              <thead className="bg-muted/50">
                <tr>{["Invoice", "Client", "Amount", "Status", "Due Date", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(inv => (
                  <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-primary">{inv.number}</td>
                    <td className="px-4 py-3">{inv.clientName}</td>
                    <td className="px-4 py-3 text-green-400 font-semibold">${Number(inv.amount).toLocaleString()}{inv.tax ? <span className="text-muted-foreground text-xs ml-1">+${inv.tax} tax</span> : ""}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={cn("font-mono text-xs", STATUS_STYLES[inv.status])}>{inv.status}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {inv.status !== "paid" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setPayInvoice(inv)}>
                            <CreditCard className="h-3 w-3" /> Pay
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditInvoice(inv)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:text-red-300" onClick={() => deleteInvoice.mutate(inv.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="font-mono text-base">Revenue Collected (Last 6 Months)</CardTitle></CardHeader>
            <CardContent>
              {metrics?.trend && metrics.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={metrics.trend}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "monospace" }} stroke="rgba(255,255,255,0.2)" />
                    <YAxis tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} tick={{ fontSize: 11, fontFamily: "monospace" }} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Revenue"]} contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground font-mono text-sm">No revenue data yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-mono text-muted-foreground">{schedules.filter(s => s.status === "active").length} active recurring schedules</p>
            <Button size="sm" onClick={() => setNewSchedule(true)} className="gap-2 font-mono"><Plus className="h-4 w-4" /> Add Schedule</Button>
          </div>
          <div className="grid gap-3">
            {schedules.map(s => (
              <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-semibold">{s.clientName}</p>
                        <Badge variant="outline" className={cn("font-mono text-xs", s.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground")}>{s.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.description}</p>
                      {s.nextBillingAt && <p className="text-xs text-muted-foreground font-mono mt-0.5">Next billing: {format(new Date(s.nextBillingAt), "MMM d, yyyy")}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-green-400">${Number(s.amount).toLocaleString()} {s.currency}</p>
                      <p className="text-xs text-muted-foreground font-mono capitalize">/ {s.interval}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {schedules.length === 0 && <div className="text-center py-8 text-muted-foreground font-mono text-sm">No billing schedules yet</div>}
          </div>
        </TabsContent>
      </Tabs>

      <InvoiceDialog open={newInvoice} onClose={() => setNewInvoice(false)} />
      {editInvoice && <InvoiceDialog open onClose={() => setEditInvoice(null)} invoice={editInvoice} />}
      {payInvoice && <PaymentDialog open onClose={() => setPayInvoice(null)} invoice={payInvoice} />}
      <ScheduleDialog open={newSchedule} onClose={() => setNewSchedule(false)} />
    </div>
  );
}
