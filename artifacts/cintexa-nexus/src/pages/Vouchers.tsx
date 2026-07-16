import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tag, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Loader2, Gift, Zap, CheckCircle2, XCircle, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

const API = "/api";

type Voucher = {
  id: number; code: string; description: string | null;
  discountType: string; discountValue: number;
  minOrderAmount: number | null; maxUses: number | null; usedCount: number;
  isActive: boolean; expiresAt: string | null; applicableTo: string;
  createdAt: string;
};

const defaultForm = { code: "", prefix: "CINTEXA", description: "", discountType: "percentage", discountValue: "10", minOrderAmount: "", maxUses: "", expiresAt: "", applicableTo: "all" };
const defaultBulk = { count: "10", prefix: "SALE", discountType: "percentage", discountValue: "15", expiresAt: "", maxUses: "" };

export default function Vouchers() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [bulk, setBulk] = useState(defaultBulk);
  const [creating, setCreating] = useState(false);
  const [validateCode, setValidateCode] = useState("");
  const [validateResult, setValidateResult] = useState<any>(null);

  const { data: vouchers = [], isLoading } = useQuery<Voucher[]>({
    queryKey: ["vouchers"],
    queryFn: () => fetch(`${API}/vouchers`).then(r => r.json()),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`${API}/vouchers/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vouchers"] }); toast.success("Deleted"); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => fetch(`${API}/vouchers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: val }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vouchers"] }),
  });

  const createVoucher = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/vouchers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, discountValue: Number(form.discountValue), minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null, maxUses: form.maxUses ? Number(form.maxUses) : null, expiresAt: form.expiresAt || null }) });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher created!");
      setCreateOpen(false); setForm(defaultForm);
    } catch { toast.error("Failed to create"); }
    setCreating(false);
  };

  const createBulk = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/vouchers/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...bulk, count: Number(bulk.count), discountValue: Number(bulk.discountValue), maxUses: bulk.maxUses ? Number(bulk.maxUses) : null, expiresAt: bulk.expiresAt || null }) });
      if (!res.ok) throw new Error();
      const rows = await res.json();
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`${rows.length} vouchers generated!`);
      setBulkOpen(false); setBulk(defaultBulk);
    } catch { toast.error("Failed to generate"); }
    setCreating(false);
  };

  const validate = async () => {
    if (!validateCode.trim()) return;
    const res = await fetch(`${API}/vouchers/validate/${validateCode.trim()}`);
    setValidateResult(await res.json());
  };

  const active = vouchers.filter(v => v.isActive);
  const expired = vouchers.filter(v => v.expiresAt && new Date(v.expiresAt) < new Date());
  const totalUsed = vouchers.reduce((s, v) => s + v.usedCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-mono font-semibold">Voucher Generator</h1>
            <p className="text-xs text-muted-foreground font-mono">Create discount codes to boost sales</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} className="gap-1"><Zap className="h-3.5 w-3.5" /> Bulk Generate</Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> New Voucher</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Vouchers", value: vouchers.length, icon: Tag, color: "text-primary" },
          { label: "Active", value: active.length, icon: CheckCircle2, color: "text-green-400" },
          { label: "Expired", value: expired.length, icon: Calendar, color: "text-orange-400" },
          { label: "Total Redeemed", value: totalUsed, icon: Gift, color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <Icon className={cn("h-5 w-5", color)} />
            <div><p className="text-xl font-mono font-bold">{value}</p><p className="text-xs text-muted-foreground font-mono">{label}</p></div>
          </div>
        ))}
      </div>

      {/* Validate */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-mono font-semibold mb-3">Validate a Code</h2>
        <div className="flex gap-2">
          <Input value={validateCode} onChange={e => setValidateCode(e.target.value.toUpperCase())} placeholder="Enter voucher code…" className="font-mono text-sm max-w-xs" onKeyDown={e => e.key === "Enter" && validate()} />
          <Button size="sm" onClick={validate} variant="outline">Check</Button>
        </div>
        {validateResult && (
          <div className={cn("mt-3 flex items-center gap-2 p-3 rounded-lg border text-xs font-mono", validateResult.valid ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
            {validateResult.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {validateResult.valid ? `Valid! ${validateResult.voucher?.discountValue}${validateResult.voucher?.discountType === "percentage" ? "%" : "$"} off` : validateResult.error}
          </div>
        )}
      </div>

      {/* Voucher List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-mono font-semibold">All Vouchers ({vouchers.length})</h2>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["vouchers"] })}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : vouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><Tag className="h-8 w-8 mb-2 opacity-30" /><p className="text-xs font-mono">No vouchers yet. Create one to start boosting sales.</p></div>
        ) : (
          <div className="divide-y divide-border">
            {vouchers.map(v => {
              const isExpired = v.expiresAt && new Date(v.expiresAt) < new Date();
              const usageRatio = v.maxUses ? (v.usedCount / v.maxUses) : null;
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <code className="text-sm font-mono font-bold tracking-widest text-primary">{v.code}</code>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => { navigator.clipboard.writeText(v.code); toast.success("Code copied!"); }}><Copy className="h-3 w-3" /></Button>
                      {isExpired && <Badge variant="outline" className="text-xs font-mono text-orange-400 border-orange-500/30">Expired</Badge>}
                      {!v.isActive && <Badge variant="outline" className="text-xs font-mono text-muted-foreground">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                      <span className="text-foreground font-semibold">{v.discountValue}{v.discountType === "percentage" ? "%" : "$"} off</span>
                      {v.description && <span className="truncate">{v.description}</span>}
                      {v.expiresAt && <span className={isExpired ? "text-orange-400" : ""}>{isExpired ? "Expired" : "Expires"} {formatDistanceToNow(new Date(v.expiresAt), { addSuffix: true })}</span>}
                    </div>
                    {usageRatio !== null && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 max-w-24 bg-muted/40 rounded-full h-1"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, usageRatio * 100)}%` }} /></div>
                        <span className="text-xs font-mono text-muted-foreground">{v.usedCount}/{v.maxUses} used</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleMut.mutate({ id: v.id, val: !v.isActive })} className="p-1.5 hover:bg-muted/50 rounded transition-colors">
                      {v.isActive ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => { if (confirm("Delete this voucher?")) deleteMut.mutate(v.id); }} className="p-1.5 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="font-mono">Create Voucher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">Code (leave blank to auto-generate)</label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="AUTO" className="font-mono text-sm mt-1" /></div>
              <div><label className="text-xs font-mono text-muted-foreground">Prefix</label><Input value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))} placeholder="CINTEXA" className="font-mono text-sm mt-1" /></div>
            </div>
            <div><label className="text-xs font-mono text-muted-foreground">Description</label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Summer sale 20% off" className="font-mono text-sm mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">Discount Type</label>
                <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))} className="w-full mt-1 bg-muted/40 border border-border rounded-md px-2 py-1.5 text-xs font-mono">
                  <option value="percentage">Percentage (%)</option><option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div><label className="text-xs font-mono text-muted-foreground">Value</label><Input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} className="font-mono text-sm mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">Max Uses (blank = unlimited)</label><Input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="∞" className="font-mono text-sm mt-1" /></div>
              <div><label className="text-xs font-mono text-muted-foreground">Expires At</label><Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="font-mono text-sm mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createVoucher} disabled={creating} className="gap-2">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="font-mono flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Bulk Generate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">How many codes?</label><Input type="number" value={bulk.count} onChange={e => setBulk(b => ({ ...b, count: e.target.value }))} min="1" max="100" className="font-mono text-sm mt-1" /></div>
              <div><label className="text-xs font-mono text-muted-foreground">Prefix</label><Input value={bulk.prefix} onChange={e => setBulk(b => ({ ...b, prefix: e.target.value.toUpperCase() }))} className="font-mono text-sm mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">Discount Type</label>
                <select value={bulk.discountType} onChange={e => setBulk(b => ({ ...b, discountType: e.target.value }))} className="w-full mt-1 bg-muted/40 border border-border rounded-md px-2 py-1.5 text-xs font-mono">
                  <option value="percentage">Percentage</option><option value="fixed">Fixed</option>
                </select>
              </div>
              <div><label className="text-xs font-mono text-muted-foreground">Value</label><Input type="number" value={bulk.discountValue} onChange={e => setBulk(b => ({ ...b, discountValue: e.target.value }))} className="font-mono text-sm mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-mono text-muted-foreground">Max Uses Each</label><Input type="number" value={bulk.maxUses} onChange={e => setBulk(b => ({ ...b, maxUses: e.target.value }))} placeholder="∞" className="font-mono text-sm mt-1" /></div>
              <div><label className="text-xs font-mono text-muted-foreground">Expires At</label><Input type="date" value={bulk.expiresAt} onChange={e => setBulk(b => ({ ...b, expiresAt: e.target.value }))} className="font-mono text-sm mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={createBulk} disabled={creating} className="gap-2">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Generate {bulk.count} Codes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
