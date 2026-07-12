import { useState } from "react";
import {
  useListDeals, useGetPipelineSummary, useGetDealsForecast,
  useCreateDeal, useUpdateDeal, useDeleteDeal,
  getListDealsQueryKey, getGetPipelineSummaryQueryKey, getGetDealsForecastQueryKey,
} from "@workspace/api-client-react";
import type { Deal, DealInput, DealUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, GripVertical, Building, MoreHorizontal, Pencil, Trash2, ChevronRight, Flame, Target, TrendingUp, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { DealInputStage, DealUpdateStage } from "@workspace/api-client-react";

const STAGES: DealInputStage[] = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};
const STAGE_COLORS: Record<string, string> = {
  prospecting: "text-muted-foreground",
  qualification: "text-blue-400",
  proposal: "text-yellow-400",
  negotiation: "text-orange-400",
  closed_won: "text-primary",
  closed_lost: "text-destructive",
};

// ─── Deal Dialog ──────────────────────────────────────────────────────────────
function DealDialog({ open, onClose, deal }: { open: boolean; onClose: () => void; deal?: Deal }) {
  const qc = useQueryClient();
  const create = useCreateDeal();
  const update = useUpdateDeal();
  const [form, setForm] = useState<DealInput>({
    title: deal?.title ?? "",
    value: deal?.value ?? 0,
    stage: (deal?.stage as DealInputStage) ?? "prospecting",
    probability: deal?.probability ?? 10,
    contactName: deal?.contactName ?? "",
    companyName: deal?.companyName ?? "",
    expectedCloseDate: deal?.expectedCloseDate ?? "",
    notes: deal?.notes ?? "",
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListDealsQueryKey({}) });
    qc.invalidateQueries({ queryKey: getGetPipelineSummaryQueryKey() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, value: Number(form.value), probability: Number(form.probability) };
    if (deal) {
      update.mutate({ id: deal.id, data: payload as DealUpdate }, {
        onSuccess: () => { toast.success("Deal updated"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to update deal"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { toast.success("Deal created"); invalidate(); onClose(); },
        onError: () => toast.error("Failed to create deal"),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{deal ? "Edit Deal" : "New Deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Deal Title</Label>
            <Input value={form.title} onChange={f("title")} required className="bg-muted/50 border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Value ($)</Label>
              <Input type="number" min={0} value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: Number(e.target.value) }))} required className="bg-muted/50 border-border font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Probability (%)</Label>
              <Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm((p) => ({ ...p, probability: Number(e.target.value) }))} className="bg-muted/50 border-border font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => setForm((p) => ({ ...p, stage: v as DealInputStage }))}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={f("contactName")} required className="bg-muted/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={form.companyName ?? ""} onChange={f("companyName")} className="bg-muted/50 border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Close Date</Label>
            <Input type="date" value={form.expectedCloseDate ?? ""} onChange={f("expectedCloseDate")} className="bg-muted/50 border-border font-mono" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Move Stage Dialog ────────────────────────────────────────────────────────
function MoveStageDialog({ open, onClose, deal }: { open: boolean; onClose: () => void; deal: Deal }) {
  const qc = useQueryClient();
  const update = useUpdateDeal();
  const [stage, setStage] = useState<DealUpdateStage>(deal.stage as DealUpdateStage);

  const handleMove = () => {
    update.mutate({ id: deal.id, data: { stage } }, {
      onSuccess: () => {
        toast.success(`Deal moved to ${STAGE_LABELS[stage]}`);
        qc.invalidateQueries({ queryKey: getListDealsQueryKey({}) });
        qc.invalidateQueries({ queryKey: getGetPipelineSummaryQueryKey() });
        onClose();
      },
      onError: () => toast.error("Failed to move deal"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Move Stage — {deal.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s as DealUpdateStage)}
              className={`w-full text-left px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${stage === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
            >
              <span className={STAGE_COLORS[s]}>{STAGE_LABELS[s]}</span>
              {s === deal.stage && <span className="ml-2 text-xs text-muted-foreground">(current)</span>}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMove} disabled={update.isPending || stage === deal.stage}>
            {update.isPending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Forecast Panel ───────────────────────────────────────────────────────────
// NEXUS Revenue Intelligence: merges Salesforce-style forecast categories
// (Pipeline / Best Case / Commit / Closed) with Pipedrive-style deal-rot
// detection into one panel, plus a quota attainment readout tied to the
// linked revenue OKR when one exists.
function ForecastPanel() {
  const { data: forecast, isLoading } = useGetDealsForecast({ query: { queryKey: getGetDealsForecastQueryKey() } });

  if (isLoading || !forecast) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  const { category, quota, stalledDeals } = forecast;
  const attainmentClamped = Math.max(0, Math.min(100, quota.attainmentPct));

  const cards = [
    { label: "Pipeline", value: category.pipeline, icon: TrendingUp, tone: "text-muted-foreground" },
    { label: "Weighted Pipeline", value: category.weightedPipeline, icon: TrendingUp, tone: "text-blue-400" },
    { label: "Best Case", value: category.bestCase, icon: Target, tone: "text-yellow-400" },
    { label: "Commit", value: category.commit, icon: Flame, tone: "text-orange-400" },
    { label: "Closed Won", value: category.closedWon, icon: Flame, tone: "text-primary" },
  ];

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold text-foreground">Revenue Forecast</h3>
          <Badge variant="outline" className="font-mono text-[10px]">
            Quota source: {quota.source === "linked_okr" ? "Linked OKR" : "Default target"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <Icon className={`w-3 h-3 ${tone}`} />
                {label}
              </div>
              <div className={`font-mono font-bold text-lg ${tone}`}>${value.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1.5">
            <span>Quota attainment</span>
            <span className="text-foreground font-semibold">
              ${quota.attained.toLocaleString()} / ${quota.target.toLocaleString()} ({quota.attainmentPct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${attainmentClamped >= 80 ? "bg-primary" : attainmentClamped >= 40 ? "bg-yellow-400" : "bg-destructive"}`}
              style={{ width: `${attainmentClamped}%` }}
            />
          </div>
        </div>
        {stalledDeals.length > 0 && (
          <div className="pt-1 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-2 mt-3">
              <Clock className="w-3.5 h-3.5 text-destructive" />
              {stalledDeals.length} deal{stalledDeals.length !== 1 ? "s" : ""} stalled 14+ days in early stage
            </div>
            <div className="flex flex-wrap gap-2">
              {stalledDeals.slice(0, 6).map((d) => (
                <Badge key={d.id} variant="destructive" className="font-mono text-[10px]">
                  {d.title} — {d.ageDays}d
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({ deal, onEdit, onMove, stalled }: { deal: Deal; onEdit: () => void; onMove: () => void; stalled?: boolean }) {
  const qc = useQueryClient();
  const deleteDeal = useDeleteDeal();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this deal?")) return;
    deleteDeal.mutate({ id: deal.id }, {
      onSuccess: () => {
        toast.success("Deal deleted");
        qc.invalidateQueries({ queryKey: getListDealsQueryKey({}) });
        qc.invalidateQueries({ queryKey: getGetPipelineSummaryQueryKey() });
      },
      onError: () => toast.error("Failed to delete deal"),
    });
  };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -2 }} className="group">
      <Card className={`border-border bg-card hover:border-primary/50 hover:shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all ${stalled ? "border-destructive/50" : ""}`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-medium text-sm leading-tight text-foreground line-clamp-2 flex-1">{deal.title}</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 -mr-1" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-2" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={onMove}><ChevronRight className="w-3.5 h-3.5 mr-2" />Move Stage</DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
            <Building className="w-3 h-3" />
            <span className="truncate">{deal.companyName || deal.contactName}</span>
          </div>
          <div className="flex items-center justify-between mt-auto">
            <span className="font-mono font-bold text-sm text-primary">${deal.value.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              {stalled && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px] gap-1">
                  <Clock className="w-2.5 h-2.5" /> Stalled
                </Badge>
              )}
              <Badge variant={deal.probability >= 70 ? 'success' : deal.probability >= 40 ? 'warning' : 'secondary'} className="px-1.5 py-0 text-[10px]">
                {deal.probability}%
              </Badge>
            </div>
          </div>
          {deal.expectedCloseDate && (
            <div className="text-[10px] text-muted-foreground font-mono mt-2 pt-2 border-t border-border/30">
              Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── SalesPipeline ────────────────────────────────────────────────────────────
export default function SalesPipeline() {
  const { data: deals, isLoading } = useListDeals({}, { query: { queryKey: getListDealsQueryKey({}) } });
  const { data: summary } = useGetPipelineSummary({ query: { queryKey: getGetPipelineSummaryQueryKey() } });
  const { data: forecast } = useGetDealsForecast({ query: { queryKey: getGetDealsForecastQueryKey() } });
  const [createOpen, setCreateOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [moveDeal, setMoveDeal] = useState<Deal | null>(null);

  const getDealsByStage = (stage: string) => deals?.filter((d) => d.stage === stage) || [];
  const totalValue = summary?.reduce((acc, curr) => acc + curr.value, 0) || 0;
  const stalledIds = new Set((forecast?.stalledDeals ?? []).map((d) => d.id));

  return (
    <div className="h-full flex flex-col space-y-6 pb-6">
      {createOpen && <DealDialog open onClose={() => setCreateOpen(false)} />}
      {editDeal && <DealDialog open onClose={() => setEditDeal(null)} deal={editDeal} />}
      {moveDeal && <MoveStageDialog open onClose={() => setMoveDeal(null)} deal={moveDeal} />}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales Pipeline</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">
            Total Pipeline Value: <span className="text-primary font-bold">${totalValue.toLocaleString()}</span>
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add Deal</Button>
      </div>

      <div className="shrink-0">
        <ForecastPanel />
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {STAGES.map((stage) => {
            const stageDeals = getDealsByStage(stage);
            const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
            return (
              <div key={stage} className="w-80 flex flex-col h-full bg-muted/30 border border-border/50 rounded-xl overflow-hidden shrink-0">
                <div className="p-4 border-b border-border/50 bg-card/50 flex justify-between items-center shrink-0">
                  <h3 className={`font-semibold text-sm ${STAGE_COLORS[stage]}`}>{STAGE_LABELS[stage]}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">${(stageValue / 1000).toFixed(1)}k</Badge>
                    <Badge variant="outline" className="font-mono text-xs">{stageDeals.length}</Badge>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {isLoading ? (
                    <><Skeleton className="h-32 w-full rounded-lg" /><Skeleton className="h-32 w-full rounded-lg" /></>
                  ) : (
                    <AnimatePresence>
                      {stageDeals.map((deal) => (
                        <DealCard key={deal.id} deal={deal} onEdit={() => setEditDeal(deal)} onMove={() => setMoveDeal(deal)} stalled={stalledIds.has(deal.id)} />
                      ))}
                    </AnimatePresence>
                  )}
                  {!isLoading && stageDeals.length === 0 && (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg text-muted-foreground text-sm">
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
